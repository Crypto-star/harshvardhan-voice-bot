"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, MicOff, Volume2, AlertCircle } from "lucide-react"

export default function VoiceBot() {
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [recordingDuration, setRecordingDuration] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsRecording(false)
    setIsSpeaking(false)
    setIsProcessing(false)
    setRecordingDuration(0)
    audioChunksRef.current = []
  }, [])

  const startRecording = async () => {
    if (isProcessing || isSpeaking) {
      setError("Please wait for the current operation to complete")
      return
    }

    try {
      setError(null)
      audioChunksRef.current = []
      setRecordingDuration(0)

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      streamRef.current = stream

      // Use WAV format if supported, otherwise webm
      let mimeType = "audio/wav"
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm;codecs=opus"
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/webm"
        }
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start(1000) // Collect data every second
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 0.1)
      }, 100)

      console.log("Recording started")
    } catch (error) {
      console.error("Failed to start recording:", error)
      setError(`Microphone error: ${error.message}`)
    }
  }

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) return

    setIsRecording(false)

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    if (recordingDuration < 1.0) {
      setError("Please record for at least 1 second")
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      return
    }

    try {
      setIsProcessing(true)
      mediaRecorderRef.current.stop()

      await new Promise<void>((resolve, reject) => {
        if (!mediaRecorderRef.current) {
          reject(new Error("MediaRecorder not available"))
          return
        }

        const timeoutId = setTimeout(() => {
          reject(new Error("Recording stop timeout"))
        }, 10000)

        mediaRecorderRef.current.onstop = async () => {
          clearTimeout(timeoutId)
          try {
            console.log(`Processing ${audioChunksRef.current.length} audio chunks`)

            if (audioChunksRef.current.length === 0) {
              throw new Error("No audio data recorded")
            }

            const audioBlob = new Blob(audioChunksRef.current, {
              type: audioChunksRef.current[0].type || "audio/webm",
            })
            console.log(`Audio blob size: ${audioBlob.size} bytes`)

            // Step 1: Transcribe audio using Whisper
            const transcript = await transcribeAudio(audioBlob)
            console.log("Transcript:", transcript)

            if (!transcript.trim()) {
              throw new Error("No speech detected in the recording")
            }

            // Add user message to conversation
            setConversation((prev) => [...prev, { role: "user", content: transcript }])

            // Step 2: Get AI response using ChatGPT
            const aiResponse = await getAIResponse(transcript)
            console.log("AI Response:", aiResponse)

            // Add AI response to conversation
            setConversation((prev) => [...prev, { role: "assistant", content: aiResponse }])

            // Step 3: Convert AI response to speech using TTS
            await speakText(aiResponse)

            resolve()
          } catch (error) {
            reject(error)
          }
        }
      })

      // Clean up
      audioChunksRef.current = []
      setRecordingDuration(0)

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      setIsProcessing(false)
    } catch (error) {
      console.error("Error processing audio:", error)
      setError(`Processing error: ${error.message}`)
      setIsProcessing(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append("file", audioBlob, "recording.webm")
    formData.append("model", "whisper-1")

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.text || ""
  }

  const getAIResponse = async (userMessage: string): Promise<string> => {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        conversation: conversation,
      }),
    })

    if (!response.ok) {
      throw new Error(`AI response failed: ${response.statusText}`)
    }

    const data = await response.json()
    return data.response || "I'm sorry, I couldn't generate a response."
  }

  const speakText = async (text: string): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        setIsSpeaking(true)

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            voice: "alloy",
          }),
        })

        if (!response.ok) {
          throw new Error(`TTS failed: ${response.statusText}`)
        }

        const audioBuffer = await response.arrayBuffer()
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })
        const audioUrl = URL.createObjectURL(audioBlob)

        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
          resolve()
        }

        audio.onerror = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
          reject(new Error("Audio playback failed"))
        }

        await audio.play()
      } catch (error) {
        setIsSpeaking(false)
        reject(error)
      }
    })
  }

  const canRecord = !isRecording && !isSpeaking && !isProcessing

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-gray-800">Chat with Harshvardhan Sharma</CardTitle>
            <p className="text-gray-600 mt-2">AI Engineer & Computer Science Student - Voice Bot</p>
            <p className="text-sm text-gray-500 mt-1">Using OpenAI Whisper (STT) + ChatGPT + TTS</p>
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
              {isRecording && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Recording:</span>
                  <span className="text-blue-600 font-semibold">{recordingDuration.toFixed(1)}s</span>
                </div>
              )}

              {isProcessing && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <span className="text-orange-600 font-semibold">Processing...</span>
                </div>
              )}

              {isSpeaking && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <span className="text-green-600 font-semibold">AI Speaking...</span>
                </div>
              )}

              <div className="space-y-3">
                {canRecord ? (
                  <Button onClick={startRecording} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                    <Mic className="w-4 h-4 mr-2" />
                    Start Speaking
                  </Button>
                ) : isRecording ? (
                  <Button
                    onClick={stopRecording}
                    className="w-full bg-red-600 hover:bg-red-700"
                    size="lg"
                    disabled={recordingDuration < 1.0}
                  >
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop & Process {recordingDuration < 1.0 ? `(${(1.0 - recordingDuration).toFixed(1)}s more)` : ""}
                  </Button>
                ) : (
                  <Button disabled className="w-full" size="lg">
                    <Volume2 className="w-4 h-4 mr-2" />
                    {isProcessing ? "Processing..." : "AI Speaking..."}
                  </Button>
                )}

                <Button onClick={cleanup} variant="outline" className="w-full">
                  Reset
                </Button>
              </div>

              {error && (
                <div className="p-3 bg-red-100 border border-red-300 rounded-md flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 Tip: Record for at least 1 second and speak clearly. The system will transcribe your speech,
                  generate a response, and speak it back to you.
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
              <CardTitle>Conversation History</CardTitle>
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
