
import { GoogleGenAI } from '@google/genai';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { history, newMessage, config: userConfig } = await req.json();
        
        // IMPORTANT: The API key is sourced from environment variables on Vercel
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: userConfig.systemInstruction ? { systemInstruction: userConfig.systemInstruction } : {}
        });

        const responseStream = await chat.sendMessageStream({ message: newMessage, config: userConfig });

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of responseStream) {
                    const chunkText = chunk.text;
                    if (chunkText) {
                       controller.enqueue(new TextEncoder().encode(chunkText));
                    }
                }
                controller.close();
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error: any) {
        console.error('Error in /api/chat:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
