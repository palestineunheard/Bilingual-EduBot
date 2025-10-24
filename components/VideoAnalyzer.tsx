import React, { useState, useMemo, useRef } from 'react';
import { GenerateContentResponse, Part } from '@google/genai';
import { Language } from '../types';
import { Notification } from './Notification';
import { UploadIcon, SpinnerIcon } from './icons';

declare const marked: any;

interface VideoAnalyzerProps {
    language: Language;
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

const FRAME_CAPTURE_INTERVAL = 1000; // Capture a frame every 1 second
const MAX_FRAMES = 30; // Max frames to send to the API

export const VideoAnalyzer: React.FC<VideoAnalyzerProps> = ({ language }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [response, setResponse] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingStatus, setLoadingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "AI Video Analyzer",
            subtitle: "Upload a short video clip (under 1 minute), ask a question about its content, and the AI will provide an analysis.",
            dropzone: "Drag & drop a video file here, or click to select",
            supported: "Supports MP4, WebM, Ogg",
            questionPlaceholder: "Ask an educational question about the video...",
            analyze: "Analyze Video",
            preparing: "Preparing video for analysis...",
            analyzing: "Analyzing...",
            resultTitle: "AI Analysis",
            errorFile: "Invalid file type. Please upload a video.",
            errorNoFile: "Please upload a video file first.",
            errorNoPrompt: "Please enter a question about the video.",
            errorApi: "The AI failed to analyze the video. Please try again.",
        },
        [Language.UR]: {
            title: "AI ویڈیو تجزیہ کار",
            subtitle: "ایک مختصر ویڈیو کلپ (1 منٹ سے کم) اپ لوڈ کریں، اس کے مواد کے بارے میں ایک سوال پوچھیں، اور AI ایک تجزیہ فراہم کرے گا۔",
            dropzone: "یہاں ایک ویڈیو فائل گھسیٹیں اور چھوڑیں، یا منتخب کرنے کے لیے کلک کریں۔",
            supported: "MP4، WebM، Ogg کو سپورٹ کرتا ہے۔",
            questionPlaceholder: "ویڈیو کے بارے میں ایک تعلیمی سوال پوچھیں...",
            analyze: "ویڈیو کا تجزیہ کریں",
            preparing: "تجزیہ کے لیے ویڈیو تیار کی جا رہی ہے...",
            analyzing: "تجزیہ کیا جا رہا ہے...",
            resultTitle: "AI تجزیہ",
            errorFile: "غلط فائل کی قسم۔ براہ کرم ایک ویڈیو اپ لوڈ کریں۔",
            errorNoFile: "براہ کرم پہلے ایک ویڈیو فائل اپ لوڈ کریں۔",
            errorNoPrompt: "براہ کرم ویڈیو کے بارے میں ایک سوال درج کریں۔",
            errorApi: "AI ویڈیو کا تجزیہ کرنے میں ناکام رہا۔ براہ کرم دوبارہ کوشش کریں۔",
        }
    }), [language]);

    const handleFileChange = (file: File | null) => {
        if (file && file.type.startsWith('video/')) {
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            setResponse('');
            setError(null);
        } else {
            setError(uiText[language].errorFile);
        }
    };

    const captureFrames = (): Promise<Part[]> => {
        return new Promise((resolve, reject) => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (!video || !canvas) {
                return reject("Video or canvas element not found.");
            }

            const frames: Part[] = [];
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("Canvas context not available");

            const onSeeked = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                frames.push({
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: dataUrl.split(',')[1]
                    }
                });

                if (frames.length < MAX_FRAMES && video.currentTime < video.duration) {
                    video.currentTime += video.duration / MAX_FRAMES;
                } else {
                    video.removeEventListener('seeked', onSeeked);
                    resolve(frames);
                }
            };

            video.addEventListener('loadeddata', () => {
                 if (video.duration > 60) {
                    reject("Video is too long. Please use clips under 1 minute.");
                    return;
                }
                video.currentTime = 0;
            }, { once: true });
            
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', (e) => reject("Error loading video data."));
            video.load();
        });
    };
    
    const handleAnalyze = async () => {
        if (!videoFile) { setError(uiText[language].errorNoFile); return; }
        if (!prompt.trim()) { setError(uiText[language].errorNoPrompt); return; }

        setIsLoading(true);
        setLoadingStatus(uiText[language].preparing);
        setError(null);
        setResponse('');
        
        try {
            const frames = await captureFrames();
            
            if(frames.length === 0) {
                 throw new Error("Could not capture any frames from the video. It may be too short or in an unsupported format.");
            }

            setLoadingStatus(uiText[language].analyzing);

            const allParts: Part[] = [
                ...frames,
                { text: `Based on these video frames, answer the following educational question in ${language === Language.EN ? 'English' : 'Urdu'}: ${prompt}` }
            ];

            const result = await generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: allParts }
            });

            setResponse(result.text);
        } catch (e: any) {
            console.error("Analysis Error:", e);
            setError(e.message || uiText[language].errorApi);
        } finally {
            setIsLoading(false);
            setLoadingStatus('');
        }
    };

    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';

    return (
        <div className={`flex flex-col h-full ${languageFontClass}`}>
            <header className="p-4 bg-gray-900/50 border-b border-gray-700 shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <p className="text-sm text-gray-400">{uiText[language].subtitle}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Left Panel: Upload & Prompt */}
                <div className="flex flex-col gap-4">
                    <div 
                        className="flex-1 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-6 transition-all hover:border-blue-500 hover:bg-gray-700/50 cursor-pointer"
                        onClick={() => document.getElementById('video-upload')?.click()}
                    >
                        <input type="file" id="video-upload" className="hidden" accept="video/*" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
                        {videoUrl ? (
                            <video ref={videoRef} src={videoUrl} controls className="max-h-64 rounded-lg" />
                        ) : (
                            <>
                                <UploadIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                <p className="text-gray-400">{uiText[language].dropzone}</p>
                                <p className="text-xs text-gray-500 mt-2">{uiText[language].supported}</p>
                            </>
                        )}
                        <canvas ref={canvasRef} className="hidden"></canvas>
                    </div>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={uiText[language].questionPlaceholder}
                        className="w-full p-3 h-24 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                     <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !videoFile || !prompt}
                        className="w-full px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-lg flex items-center justify-center gap-2"
                    >
                        {isLoading ? <><SpinnerIcon /> {loadingStatus}</> : uiText[language].analyze}
                    </button>
                </div>
                {/* Right Panel: Result */}
                <div className="flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700 min-h-[40vh] lg:min-h-0">
                    <h2 className="text-lg font-bold mb-3">{uiText[language].resultTitle}</h2>
                    <div className="flex-1 overflow-y-auto bg-gray-900/50 p-3 rounded-md">
                        {isLoading && !response && (
                             <div className="flex items-center justify-center h-full">
                                <SpinnerIcon className="w-8 h-8"/>
                            </div>
                        )}
                        {response && (
                             <div
                                className="prose prose-sm prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: marked.parse(response) }}
                            />
                        )}
                    </div>
                </div>
            </div>
            {error && <div className="absolute bottom-4 right-4"><Notification message={error} type="error" onClose={() => setError(null)} /></div>}
        </div>
    );
};
