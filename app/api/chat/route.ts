import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { message, conversation } = await request.json()

    const systemPrompt = `You are Harshvardhan Sharma speaking in first person. You are a 22-year-old computer science student from India.

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

Respond naturally and personally, sharing your experiences and insights. Keep responses conversational and under 150 words for voice interaction.`

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversation.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message },
    ]

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response."

    return NextResponse.json({ response: aiResponse })
  } catch (error) {
    console.error("Chat error:", error)
    return NextResponse.json({ error: "Chat failed" }, { status: 500 })
  }
}
