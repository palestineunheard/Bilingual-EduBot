
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Language } from '../types';
import { Notification } from './Notification';
import { MicIcon, SpinnerIcon, ClipboardCopyIcon, SparklesIcon } from './icons';

declare const marked: any;

interface AudioTranscriberProps {
    language: Language;
}

type Stage = 'idle' | 'recording' | 'transcribing' | 'done';

export const AudioTranscriber: React.FC<AudioTranscriberProps> = ({ language }) => {
    const [stage, setStage] = useState<Stage>('idle');
    const [transcribedText, setTranscribedText] = useState<string>('');
    const [summary, setSummary] = useState<string>('');
    const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Audio Transcriber",
            subtitle: "Click the microphone to start recording your voice. The AI will transcribe it into text.",
            record: "Start Recording",
            recording: "Recording...",
            stop: "Stop Recording",
            transcribing: "Transcribing...",
            result: "Transcription Result",
            copy: "Copy Text",
            copied: "Copied to clipboard!",
            micError: "Could not access microphone. Please check permissions.",
            apiError: "The AI failed to transcribe the audio. Please try again.",
            summarize: "Summarize & Find Key Points",
            summarizing: "Summarizing...",
            summaryError: "Failed to generate summary. Please try again.",
        },
        [Language.UR]: {
            title: "آڈیو ٹرانسکرائبر",
            subtitle: "اپنی آواز ریکارڈ کرنے کے لیے مائیکروفون پر کلک کریں۔ AI اسے متن میں نقل کرے گا۔",
            record: "ریکارڈنگ شروع کریں",
            recording: "ریکارڈنگ جاری ہے...",
            stop: "ریکارڈنگ روکیں",
            transcribing: "نقل کیا جا رہا ہے...",
            result: "نقل شدہ نتیجہ",
            copy: "متن کاپی کریں",
            copied: "کلپ بورڈ پر کاپی ہو گیا!",
            micError: "مائیکروفون تک رسائی حاصل نہیں ہو سکی۔ براہ کرم اجازتیں چیک کریں۔",
            apiError: "AI آڈیو کو نقل کرنے میں ناکام رہا۔ براہ کرم دوبارہ کوشش کریں۔",
            summarize: "خلاصہ اور کلیدی نکات تلاش کریں",
            summarizing: "خلاصہ کیا جا رہا ہے۔..",
            summaryError: "خلاصہ بنانے میں ناکام۔ براہ کرم دوبارہ کوشش کریں۔",
        }
    }), [language]);

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = reader.result as string;
                resolve(base64data.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const startRecording = async () => {
        setTranscribedText('');
        setSummary('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = event => {
                audioChunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = async () => {
                setStage('transcribing');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                try {
                    const base64Audio = await blobToBase64(audioBlob);
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: {
                            parts: [
                                { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
                                { text: `Transcribe the audio. The language is likely ${language === Language.EN ? 'English' : 'Urdu'}.` }
                            ]
                        }
                    });
                    setTranscribedText(response.text);
                    setStage('done');
                } catch (e) {
                    console.error("Transcription error:", e);
                    setError(uiText[language].apiError);
                    setStage('idle');
                }
            };
            
            mediaRecorderRef.current.start();
            setStage('recording');
        } catch (e) {
            console.error("Microphone error:", e);
            setError(uiText[language].micError);
        }
    };
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && stage === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleCopy = () => {
        if (!transcribedText) return;
        navigator.clipboard.writeText(transcribedText);
        setNotification(uiText[language].copied);
    };

    const handleSummarize = async () => {
        if (!transcribedText || isSummarizing) return;
        setIsSummarizing(true);
        setSummary('');
        setError(null);

        try {
            const langName = language === Language.EN ? 'English' : 'Urdu';
            const prompt = `You are a note-taking assistant. Read the following transcribed text and provide a concise summary and a list of key points. The response should be in ${langName} and formatted with Markdown. Use a "Summary" heading and a "Key Points" heading with a bulleted list.

Transcribed Text:
"""
${transcribedText}
"""`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setSummary(response.text);
        } catch (e) {
            console.error("Summarization error:", e);
            setError(uiText[language].summaryError);
        } finally {
            setIsSummarizing(false);
        }
    };


    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';
    
    const recordButtonText = {
        idle: uiText[language].record,
        recording: uiText[language].stop,
        transcribing: uiText[language].transcribing,
        done: uiText[language].record,
    };

    return (
        <div className={`flex flex-col h-full ${languageFontClass} items-center p-4 text-center`}>
            <header className="mb-8">
                <h1 className="text-3xl font-bold">{uiText[language].title}</h1>
                <p className="text-gray-400 max-w-md">{uiText[language].subtitle}</p>
            </header>
            
            <main className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl">
                 <button 
                    onClick={stage === 'recording' ? stopRecording : startRecording}
                    disabled={stage === 'transcribing'}
                    className={`w-48 h-48 rounded-full flex flex-col items-center justify-center text-white transition-all duration-300 transform hover:scale-105 shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed
                    ${stage === 'recording' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}
                    `}
                >
                    {stage === 'transcribing' ? <SpinnerIcon className="w-16 h-16"/> : <MicIcon className="w-16 h-16" />}
                 </button>
                 <p className="mt-4 text-xl font-semibold capitalize">{recordButtonText[stage]}</p>
                 {stage === 'recording' && <p className="text-red-400 animate-pulse">{uiText[language].recording}</p>}
                 
                 {error && <div className="mt-4"><Notification message={error} type="error" onClose={() => setError(null)} /></div>}

                 {stage === 'done' && transcribedText && (
                     <div className="w-full mt-8 bg-gray-800/50 p-4 rounded-lg border border-gray-700 text-left animate-fade-in">
                         <div className="flex justify-between items-center mb-2">
                            <h2 className="text-lg font-semibold">{uiText[language].result}</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSummarize} disabled={isSummarizing} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-500">
                                    {isSummarizing ? <SpinnerIcon className="w-4 h-4" /> : <SparklesIcon className="w-4 h-4"/>}
                                    {isSummarizing ? uiText[language].summarizing : uiText[language].summarize}
                                </button>
                                <button onClick={handleCopy} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500">
                                    <ClipboardCopyIcon/> {uiText[language].copy}
                                </button>
                            </div>
                         </div>
                         <p className="p-3 bg-gray-900/50 rounded-md whitespace-pre-wrap">{transcribedText}</p>
                         {summary && (
                            <div className="mt-4 pt-3 border-t border-gray-600">
                                <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(summary) }}/>
                            </div>
                         )}
                     </div>
                 )}
            </main>
            {notification && <div className="absolute bottom-4 right-4"><Notification message={notification} type="success" onClose={() => setNotification(null)} /></div>}
        </div>
    );
};
