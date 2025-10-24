
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const { model, contents, config } = req.body;
        
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash',
            contents,
            config,
        });
        
        // Vercel automatically stringifies the object.
        res.status(200).json(response);

    } catch (error: any) {
        console.error('Error in /api/generate:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
