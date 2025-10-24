import React, { useState, useMemo } from 'react';
import { GenerateContentResponse, Type, Modality } from '@google/genai';
import { Language } from '../types';
import { Notification } from './Notification';
import { BookOpenIcon, ExportIcon, ArrowPathIcon, SpinnerIcon, SpeakerIcon } from './icons';

// Declare html2pdf from CDN
declare const html2pdf: any;

// Audio utility functions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

interface StorytellingTeacherProps {
    language: Language;
}

interface StoryContent {
    title: string;
    story: string;
    moral: string;
    questions: string[];
}

// Helper for serverless API calls
async function generateContent(body: object): Promise<GenerateContentResponse> {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'API request failed with no details.' }));
        console.error('API Error Response:', errorData);
        throw new Error(errorData.error || 'API request failed');
    }
    return response.json();
}

export const StorytellingTeacher: React.FC<StorytellingTeacherProps> = ({ language }) => {
    const [topic, setTopic] = useState<string>('');
    const [storyContent, setStoryContent] = useState<StoryContent | null>(null);
    const [stage, setStage] = useState<'input' | 'generating' | 'results'>('input');
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "AI Storytelling Teacher",
            subtitle: "Enter a topic or a keyword (e.g., honesty, environment), and the AI will craft a unique story for you.",
            placeholder: "Enter a topic for the story...",
            generate: "Generate Story",
            generating: "Generating your story...",
            startOver: "Generate Another Story",
            exportPdf: "Save as PDF",
            listen: "Listen to Story",
            storyTitle: "Story",
            moralTitle: "Moral of the Story",
            questionsTitle: "Comprehension Questions",
            inputError: "Please enter a topic to generate a story.",
            generationError: "The AI couldn't generate a story for this topic. Please try a different one.",
        },
        [Language.UR]: {
            title: "AI کہانی گو استاد",
            subtitle: "ایک موضوع یا کلیدی لفظ درج کریں (جیسے ایمانداری، ماحول)، اور AI آپ کے لیے ایک منفرد کہانی تیار کرے گا۔",
            placeholder: "کہانی کے لیے ایک موضوع درج کریں...",
            generate: "کہانی بنائیں",
            generating: "آپ کی کہانی تیار ہو رہی ہے...",
            startOver: "ایک اور کہانی بنائیں",
            exportPdf: "پی ڈی ایف کے طور پر محفوظ کریں",
            listen: "کہانی سنیں",
            storyTitle: "کہانی",
            moralTitle: "کہانی کا سبق",
            questionsTitle: "تفہیمی سوالات",
            inputError: "کہانی بنانے کے لیے براہ کرم ایک موضوع درج کریں۔",
            generationError: "AI اس موضوع کے لیے کہانی نہیں بنا سکا۔ براہ کرم کوئی دوسرا موضوع آزمائیں۔",
        }
    }), [language]);

    const handleGenerateStory = async () => {
        if (!topic.trim()) {
            setError(uiText[language].inputError);
            return;
        }
        setStage('generating');
        setError(null);
        setStoryContent(null);

        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    story: { type: Type.STRING },
                    moral: { type: Type.STRING },
                    questions: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: ["title", "story", "moral", "questions"]
            };

            const langName = language === Language.EN ? 'English' : 'Urdu';
            const prompt = `You are a storytelling teacher for young learners.
- Generate a short, age-appropriate story based on the topic: "${topic}".
- The story must be between 200 and 300 words and suitable for children. Avoid complex themes unless specified.
- Give the story a suitable title.
- At the end of the story, include a clear 'moral' or lesson.
- After the moral, provide exactly 3 simple comprehension questions (e.g., Who..., What..., Why...).
- The entire response (title, story, moral, questions) must be in ${langName}.
- Your entire response must be a single, valid JSON object conforming to the provided schema.`;

            const response = await generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const content: StoryContent = JSON.parse(response.text);
            setStoryContent(content);
            setStage('results');

        } catch (e) {
            console.error("Error generating story:", e);
            setError(uiText[language].generationError);
            setStage('input');
        }
    };

    const handleListen = async () => {
        if (!storyContent || isSpeaking) return;
        setIsSpeaking(true);
        try {
            const textToSpeak = `${storyContent.title}. ${storyContent.story}. The moral of the story is: ${storyContent.moral}`;
            const response = await generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: textToSpeak }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: language === Language.EN ? 'Kore' : 'Puck' },
                        },
                    },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start();
                source.onended = () => {
                    audioContext.close();
                    setIsSpeaking(false);
                };
            } else {
                setIsSpeaking(false);
            }
        } catch (e) {
            console.error("TTS Error:", e);
            setError("Failed to generate audio.");
            setIsSpeaking(false);
        }
    };

    const handleExportPdf = () => {
        if (!storyContent) return;
        const isUrdu = language === Language.UR;

        const pdfStyles = `
          .pdf-container { padding: 25px; font-family: 'Inter', sans-serif; color: #111827; line-height: 1.6; background-color: white; }
          h1, h2, h3 { font-family: 'Inter', sans-serif; color: #111827; }
          h1 { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 25px; }
          h2 { font-size: 1.25rem; margin-top: 20px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
          p { margin-bottom: 1rem; text-align: justify; }
          ul { list-style-position: inside; padding-left: 5px; }
          li { margin-bottom: 4px; }
          .urdu-text, .urdu-text h1, .urdu-text h2, .urdu-text h3, .urdu-text li, .urdu-text p { font-family: 'Noto Nastaliq Urdu', serif !important; direction: rtl; text-align: right; }
          .urdu-text ul { padding-left: 0; padding-right: 20px; }
        `;

        const storyHtml = `<p>${storyContent.story.replace(/\n/g, '<br/>')}</p>`;
        const moralHtml = `<p><em>${storyContent.moral}</em></p>`;
        const questionsHtml = `<ul>${storyContent.questions.map(q => `<li>${q}</li>`).join('')}</ul>`;

        const fullHtml = `
          <html>
            <head>
              <meta charset="UTF-8">
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
              <style>${pdfStyles}</style>
            </head>
            <body>
              <div class="pdf-container ${isUrdu ? 'urdu-text' : ''}">
                <h1>${storyContent.title}</h1>
                <h2>${uiText[language].storyTitle}</h2>
                ${storyHtml}
                <h2>${uiText[language].moralTitle}</h2>
                ${moralHtml}
                <h2>${uiText[language].questionsTitle}</h2>
                ${questionsHtml}
              </div>
            </body>
          </html>
        `;

        const element = document.createElement('div');
        element.innerHTML = fullHtml;
        document.body.appendChild(element);

        const opt = {
          margin: 0.5,
          filename: `${storyContent.title}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(element);
        });
    };

    const handleStartOver = () => {
        setStage('input');
        setStoryContent(null);
        setTopic('');
        setError(null);
    };

    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';

    return (
        <div className={`flex flex-col h-full ${languageFontClass} bg-gray-900/50`}>
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                {stage === 'results' && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleStartOver} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">
                           <ArrowPathIcon/> {uiText[language].startOver}
                        </button>
                         <button onClick={handleExportPdf} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                           <ExportIcon/> {uiText[language].exportPdf}
                        </button>
                    </div>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                {stage === 'input' && (
                    <div className="max-w-xl mx-auto text-center">
                        <BookOpenIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
                        <h2 className="text-2xl font-semibold mb-2">{uiText[language].title}</h2>
                        <p className="text-gray-400 mb-6">{uiText[language].subtitle}</p>
                        <textarea
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={uiText[language].placeholder}
                            className={`w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-center text-lg ${language === Language.UR ? 'text-right' : ''}`}
                            rows={2}
                        />
                        <button
                            onClick={handleGenerateStory}
                            className="w-full mt-4 px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-lg"
                            disabled={!topic.trim()}
                        >
                            {uiText[language].generate}
                        </button>
                    </div>
                )}

                {stage === 'generating' && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <SpinnerIcon className="w-12 h-12 mb-4" />
                        <h2 className="text-2xl font-semibold">{uiText[language].generating}</h2>
                    </div>
                )}

                {stage === 'results' && storyContent && (
                    <div className="max-w-3xl mx-auto prose prose-invert prose-p:text-gray-300 prose-headings:text-teal-300">
                        <div className="text-center mb-6">
                            <h2 className="text-3xl font-bold ">{storyContent.title}</h2>
                            <button onClick={handleListen} disabled={isSpeaking} className="flex items-center justify-center gap-2 mx-auto mt-2 px-3 py-1.5 text-sm font-semibold bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-500 transition-colors w-32">
                                {isSpeaking ? <SpinnerIcon className="w-4 h-4" /> : <><SpeakerIcon/> {uiText[language].listen}</>}
                            </button>
                        </div>
                        
                        <h3 className="font-semibold">{uiText[language].storyTitle}</h3>
                        <p>{storyContent.story}</p>
                        
                        <h3 className="font-semibold mt-6">{uiText[language].moralTitle}</h3>
                        <p className="italic text-teal-200">"{storyContent.moral}"</p>

                        <h3 className="font-semibold mt-6">{uiText[language].questionsTitle}</h3>
                        <ul className="list-disc list-inside">
                            {storyContent.questions.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                    </div>
                )}

                {error && (
                    <div className="mt-6 max-w-xl mx-auto">
                        <Notification message={error} type="error" onClose={() => setError(null)} />
                    </div>
                )}
            </div>
        </div>
    );
};
