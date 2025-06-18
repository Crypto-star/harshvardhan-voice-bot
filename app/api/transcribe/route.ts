import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("file") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Create FormData for OpenAI API
    const openAIFormData = new FormData()
    openAIFormData.append("file", audioFile)
    openAIFormData.append("model", "whisper-1")

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAIFormData,
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error("Transcription error:", error)
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
  }
}
