import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // For now, we'll return the API key directly (in production, use proper session management)
    return NextResponse.json({
      token: process.env.OPENAI_API_KEY,
    })
  } catch (error) {
    console.error("Session creation error:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
