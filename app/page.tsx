"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, AlertCircle } from "lucide-react"

export default function VoiceBot() {
  const [isConnected, setIsConnected] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected")

  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioQueueRef = useRef<ArrayBuffer[]>([])
  const isPlayingRef = useRef(false)

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsRecording(false)
    setIsSpeaking(false)
    setIsConnected(false)
    audioQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  const connectToRealtime = async () => {
    try {
      setError(null)
      setConnectionStatus("Connecting...")

      const response = await fetch("/api/realtime-token")
      if (!response.ok) {
        throw new Error("Failed to get session token")
      }

      const { token } = await response.json()

      const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`, [
        "realtime",
        `openai-insecure-api-key.${token}`,
        "openai-beta.realtime-v1",
      ])

      ws.onopen = () => {
        console.log("Connected to OpenAI Realtime API")
        setIsConnected(true)
        setConnectionStatus("Connected")

        // Configure session for streaming
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: `You are Harshvardhan Sharma speaking in first person. You are a 22-year-old computer science student from India.

ABOUT YOU:
- Born in Rajasthan, raised in Kolkata, currently in Bhubaneswar, Odisha
- Final year B.Tech Computer Science at KIIT University (GPA: 7.39/10)
- From supportive middle-class Brahmin Marwadi family
- Father runs "Hardik I Tech" (Hardik is your pet name)
- Passionate about AI/ML since childhood, exposed to computers from age 3-4
- Goal: Win the Alan Turing Award

YOUR SUPERPOWER: Perseverance, adaptability, and quick learning. You complete any assignment within deadlines, even outside your knowledge base.

TOP 3 GROWTH AREAS:
1. Public Speaking - want more confidence presenting ideas
2. Cloud Computing - deepen knowledge of cloud platforms  
3. Leadership - develop skills to guide and inspire teams

MISCONCEPTION: As an introvert, people think you're angry or have attitude, but you're just taking time to open up.

KEY PROJECTS:
- Drishti: AI navigation for blind (patent-pending, $15K funding)
- SupportSpace: Mental health chatbot (100+ daily users)
- Multi-agent research assistant
- YOLOv8 orthodontic detection system (95% accuracy)

Respond naturally and personally, sharing your experiences and insights. Keep responses conversational.`,
              voice: "alloy",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
              },
            },
          }),
        )
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log("Received:", data.type)

          switch (data.type) {
            case "session.created":
              console.log("Session created successfully")
              break

            case "input_audio_buffer.speech_started":
              console.log("Speech started")
              setIsRecording(true)
              break

            case "input_audio_buffer.speech_stopped":
              console.log("Speech stopped")
              setIsRecording(false)
              break

            case "conversation.item.input_audio_transcription.completed":
              if (data.transcript) {
                setConversation((prev) => [...prev, { role: "user", content: data.transcript }])
              }
              break

            case "response.audio.delta":
              if (data.delta) {
                // Queue audio for streaming playback
                const audioData = base64ToArrayBuffer(data.delta)
                audioQueueRef.current.push(audioData)
                if (!isPlayingRef.current) {
                  playAudioQueue()
                }
              }
              break

            case "response.audio_transcript.delta":
              // Real-time transcript updates
              if (data.delta) {
                setConversation((prev) => {
                  const newConv = [...prev]
                  const lastMessage = newConv[newConv.length - 1]
                  if (lastMessage && lastMessage.role === "assistant") {
                    lastMessage.content += data.delta
                  } else {
                    newConv.push({ role: "assistant", content: data.delta })
                  }
                  return newConv
                })
              }
              break

            case "response.done":
              console.log("Response completed")
              setIsSpeaking(false)
              break

            case "error":
              console.error("OpenAI API Error:", data.error)
              setError(`API Error: ${data.error.message || "Unknown error"}`)
              break
          }
        } catch (err) {
          console.error("Error parsing message:", err)
        }
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        setError("Connection error occurred")
        setConnectionStatus("Error")
      }

      ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason)
        setIsConnected(false)
        setConnectionStatus("Disconnected")
        setIsRecording(false)
        setIsSpeaking(false)
      }

      wsRef.current = ws
    } catch (error) {
      console.error("Failed to connect:", error)
      setError(`Connection failed: ${error.message}`)
      setConnectionStatus("Failed")
    }
  }

  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  const playAudioQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    isPlayingRef.current = true
    setIsSpeaking(true)

    try {
      // Use a single AudioContext for better performance
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 })
      }

      const audioContext = audioContextRef.current

      // Resume context if suspended (required by some browsers)
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      while (audioQueueRef.current.length > 0) {
        const audioData = audioQueueRef.current.shift()!

        try {
          // Convert PCM16 data to AudioBuffer
          const pcm16Array = new Int16Array(audioData)
          const audioBuffer = audioContext.createBuffer(1, pcm16Array.length, 24000)
          const channelData = audioBuffer.getChannelData(0)

          // Convert PCM16 to float32
          for (let i = 0; i < pcm16Array.length; i++) {
            channelData[i] = pcm16Array[i] / 32768.0
          }

          await new Promise<void>((resolve) => {
            const source = audioContext.createBufferSource()
            source.buffer = audioBuffer
            source.connect(audioContext.destination)
            source.onended = () => resolve()
            source.start()
          })
        } catch (decodeError) {
          console.error("Audio decode error:", decodeError)
          // Continue with next chunk if one fails
        }
      }
    } catch (error) {
      console.error("Audio playback error:", error)
    } finally {
      isPlayingRef.current = false
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false)
      } else {
        // Continue playing if more audio arrived
        setTimeout(() => playAudioQueue(), 10)
      }
    }
  }

  const startListening = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("Not connected to voice service")
      return
    }

    try {
      setError(null)

      // Browser mic stream (often 48 kHz)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // AudioContext at the input sample-rate (usually 48 kHz)
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const inputSampleRate = audioContext.sampleRate // 44 100 / 48 000

      const source = audioContext.createMediaStreamSource(stream)

      // 4 096 frame buffer gives <100 ms latency
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

        const inputData = event.inputBuffer.getChannelData(0) // Float32

        /* down-sample to 24 kHz if needed */
        const ratio = inputSampleRate / 24000
        const downSampledLength = Math.floor(inputData.length / ratio)
        const pcm16 = new Int16Array(downSampledLength)

        for (let i = 0, j = 0; i < downSampledLength; i++, j += ratio) {
          // clip, convert Float32 −1…1 → Int16
          const s = Math.max(-1, Math.min(1, inputData[Math.floor(j)]))
          pcm16[i] = s * 0x7fff
        }

        // Uint8 view for base-64
        const uint8 = new Uint8Array(pcm16.buffer)
        const base64 = btoa(String.fromCharCode(...uint8))

        wsRef.current.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64,
          }),
        )
      }

      source.connect(processor)
      processor.connect(audioContext.destination)
      console.log("Started raw PCM streaming (24 kHz mono)")
      setIsRecording(true)
    } catch (err: any) {
      console.error("Failed to start listening:", err)
      setError(`Microphone error: ${err.message}`)
    }
  }

  const stopListening = () => {
    if (processorRef.current) {
      try {
        if (processorRef.current instanceof MediaRecorder && processorRef.current.state !== "inactive") {
          processorRef.current.stop()
        }
      } catch (error) {
        console.error("Error stopping MediaRecorder:", error)
      }
      processorRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    console.log("Stopped audio streaming")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800">Chat with Harshvardhan Sharma</CardTitle>
            <p className="text-gray-600 mt-2">Real-time Voice Conversation</p>
            <p className="text-sm text-gray-500 mt-1">Streaming Audio with Voice Activity Detection</p>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Voice Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status:</span>
                <span
                  className={`font-semibold ${
                    connectionStatus === "Connected"
                      ? "text-green-600"
                      : connectionStatus === "Connecting..."
                        ? "text-yellow-600"
                        : connectionStatus === "Error" || connectionStatus === "Failed"
                          ? "text-red-600"
                          : "text-gray-600"
                  }`}
                >
                  {connectionStatus}
                </span>
              </div>

              {isRecording && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Listening:</span>
                  <span className="text-blue-600 font-semibold animate-pulse">🎤 Active</span>
                </div>
              )}

              {isSpeaking && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">AI Speaking:</span>
                  <span className="text-green-600 font-semibold animate-pulse">🔊 Playing</span>
                </div>
              )}

              {!isConnected ? (
                <Button
                  onClick={connectToRealtime}
                  className="w-full"
                  size="lg"
                  disabled={connectionStatus === "Connecting..."}
                >
                  {connectionStatus === "Connecting..." ? "Connecting..." : "Connect Voice Bot"}
                </Button>
              ) : (
                <div className="space-y-3">
                  {!streamRef.current ? (
                    <Button onClick={startListening} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                      <Mic className="w-4 h-4 mr-2" />
                      Start Real-time Conversation
                    </Button>
                  ) : (
                    <Button onClick={stopListening} className="w-full bg-red-600 hover:bg-red-700" size="lg">
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Listening
                    </Button>
                  )}

                  <Button onClick={cleanup} variant="outline" className="w-full">
                    Disconnect
                  </Button>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 Real-time conversation: Just speak naturally! The AI will detect when you start and stop talking,
                  and respond immediately with streaming audio.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sample Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">
                    "What should we know about your life story in a few sentences?"
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-800">"What's your #1 superpower?"</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm font-medium text-purple-800">
                    "What are the top 3 areas you'd like to grow in?"
                  </p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm font-medium text-orange-800">
                    "What misconception do your coworkers have about you?"
                  </p>
                </div>
                <div className="p-3 bg-pink-50 rounded-lg">
                  <p className="text-sm font-medium text-pink-800">"How do you push your boundaries and limits?"</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {conversation.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Live Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversation.map((message, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${message.role === "user" ? "bg-blue-100 ml-8" : "bg-gray-100 mr-8"}`}
                  >
                    <p className="text-sm font-medium mb-1">{message.role === "user" ? "You" : "Harshvardhan"}</p>
                    <p className="text-sm">{message.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
