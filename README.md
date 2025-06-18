# Crypto-Star Harshvardhan Voice Bot

**Live Demo:** [https://voice-bot-project.vercel.app/](https://voice-bot-project.vercel.app/)

---

## Overview

Crypto-Star Harshvardhan Voice Bot is a web-based conversational AI that allows users to interact with a persona—Harshvardhan Sharma, a 22-year-old computer science student from India—using their voice. The bot leverages OpenAI’s ChatGPT, Whisper (speech-to-text), and TTS (text-to-speech) APIs to provide a seamless, interactive, and universally accessible experience for both technical and non-technical users

---

## Features

- **Voice Interaction:** Speak directly to the bot and receive spoken responses.
- **Persona-Based Answers:** Responds as Harshvardhan Sharma, using a detailed biography and personality.
- **Sample Questions:** Interface suggests example prompts to guide users.
- **Conversation History:** View your chat in a chat-style format.
- **Error Handling:** Friendly messages for common issues (e.g., short recordings, microphone errors).
- **Modern UI:** Built with React, Next.js, and Tailwind CSS for a responsive and visually appealing experience.

---

## How It Works

1. **Start Speaking:** Click “Start Speaking” to record your question (minimum 1 second).
2. **Speech-to-Text:** Your voice is transcribed using OpenAI Whisper.
3. **ChatGPT Conversation:** The transcript is sent to ChatGPT, which responds as Harshvardhan Sharma.
4. **Text-to-Speech:** The response is converted to audio and played back to you.
5. **Conversation History:** The chat is displayed, alternating between user and bot.

---

## Example Questions

- What should we know about your life story in a few sentences?
- What’s your #1 superpower?
- What are the top 3 areas you’d like to grow in?
- What misconception do your coworkers have about you?
- How do you push your boundaries and limits?

---

## Persona Details

- **Name:** Harshvardhan Sharma
- **Background:** Born in Rajasthan, raised in Kolkata, studying in Bhubaneswar, Odisha.
- **Education:** Final year B.Tech in Computer Science at KIIT University.
- **Family:** Middle-class Brahmin Marwadi family; father runs "Hardik I Tech."
- **Interests:** AI/ML, cloud computing, public speaking, leadership.
- **Superpower:** Perseverance, adaptability, quick learning.
- **Growth Areas:** Public speaking, cloud computing, leadership.
- **Misconception:** Appears introverted/aloof but is just reserved.
- **Key Projects:** Drishti (AI navigation for blind), SupportSpace (mental health chatbot), multi-agent research assistant, YOLOv8 orthodontic detection system.

---

## User Experience

- **Universal Accessibility:** No coding or technical knowledge required.
- **Responsive Design:** Works on desktop and mobile.
- **Clear Instructions:** UI guides users on how to interact with the bot.
- **Error Handling:** Friendly messages for common issues.

---

## Setup & Usage (For Developers)

1. **Clone the Repository:**
   ```bash
   git clone 
   cd crypto-star-harshvardhan-voice-bot
   ```
2. **Install Dependencies:**
   ```bash
   pnpm install
   # or
   npm install
   ```
3. **Set Environment Variables:**
   ```
   OPENAI_API_KEY=your_openai_api_key
   ```
4. **Run the Development Server:**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```
5. **Open in Browser:** Go to `http://localhost:3000` to use the voice bot.

**Production:**  
Build and start with:
```bash
pnpm build
pnpm start
```

---

## Customization

- **Persona:** Edit the system prompt in `app/api/chat/route.ts` to change the bot’s personality.
- **UI:** Update Tailwind CSS and React components for branding or layout changes.
- **Voice:** Change the TTS voice in `/api/tts` route as desired.

---

## Security Notes

- The OpenAI API key is exposed for demo purposes only. In production, use secure environment variable management and never expose API keys to the client.

---

## Submission

- **Live Demo:** [https://voice-bot-project.vercel.app/](https://voice-bot-project.vercel.app/)
- Deploy your app to a public platform (e.g., Vercel, Netlify).
- Ensure the demo is accessible and user-friendly for non-technical users.
- Submit the link as required.

---

## License

This project is provided for assignment/demo purposes. For production use, review and update security, privacy, and licensing as needed.

---

## Contact

For questions or support, contact the project maintainer or submit an issue via the repository.

---
