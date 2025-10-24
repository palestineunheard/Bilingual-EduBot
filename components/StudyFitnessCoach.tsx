import React, { useState, useMemo } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { Language } from '../types';
import { Notification } from './Notification';
import { BodyIcon, EyeIcon, SparklesIcon, SpinnerIcon } from './icons';

// Declare marked from CDN
declare const marked: any;

interface StudyFitnessCoachProps {
    language: Language;
}

type RoutineType = 'stretch' | 'eye';

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

export const StudyFitnessCoach: React.FC<StudyFitnessCoachProps> = ({ language }) => {
    const [routine, setRoutine] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Study Fitness Coach",
            subtitle: "Take a short, science-backed break to refresh your body and mind. Choose a routine below.",
            stretchTitle: "2-Min Stretch Routine",
            stretchDesc: "Relieve tension in your neck, back, and shoulders from sitting.",
            eyeTitle: "2-Min Eye Relaxation",
            eyeDesc: "Reduce eye strain from looking at screens for too long.",
            generating: "Generating your routine...",
            apiError: "The AI couldn't generate a routine. Please try again in a moment.",
            resultTitle: "Your 2-Minute Routine",
        },
        [Language.UR]: {
            title: "اسٹڈی فٹنس کوچ",
            subtitle: "اپنے جسم اور دماغ کو تروتازہ کرنے کے لیے ایک مختصر، سائنس پر مبنی وقفہ لیں۔ نیچے ایک روٹین کا انتخاب کریں۔",
            stretchTitle: "2 منٹ کی اسٹریچ روٹین",
            stretchDesc: "بیٹھنے سے اپنی گردن، کمر اور کندھوں میں تناؤ کو دور کریں۔",
            eyeTitle: "2 منٹ آنکھوں کو آرام",
            eyeDesc: "زیادہ دیر تک اسکرین دیکھنے سے آنکھوں کے دباؤ کو کم کریں۔",
            generating: "آپ کا روٹین تیار کیا جا رہا ہے۔..",
            apiError: "AI روٹین تیار نہیں کر سکا۔ براہ کرم ایک لمحے میں دوبارہ کوشش کریں۔",
            resultTitle: "آپ کی 2 منٹ کی روٹین",
        }
    }), [language]);

    const handleGetRoutine = async (type: RoutineType) => {
        setIsLoading(true);
        setError(null);
        setRoutine(null);
        
        const langName = language === Language.EN ? 'English' : 'Urdu';
        let prompt = '';

        if (type === 'stretch') {
            prompt = `You are a fitness and wellness coach. Generate a simple, safe, science-based 2-minute stretching routine for a student on a study break. 
- The routine must focus on the neck, shoulders, and back.
- All exercises must be performable while sitting or standing in a small space, without any special equipment.
- Provide clear, step-by-step instructions using Markdown for formatting (like lists and bolding). The response must be entirely in ${langName}.`;
        } else { // eye
            prompt = `You are a wellness coach. Generate a simple, safe, science-based 2-minute eye relaxation routine for a student who has been staring at a screen. 
- Include established techniques like the 20-20-20 rule, palming, or gentle eye movements.
- Do not suggest anything that involves touching the eyes directly.
- Provide clear, step-by-step instructions using Markdown for formatting (like lists and bolding). The response must be entirely in ${langName}.`;
        }

        try {
            const response = await generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            
            setRoutine(response.text);
        } catch (e) {
            console.error("Error generating routine:", e);
            setError(uiText[language].apiError);
        } finally {
            setIsLoading(false);
        }
    };
    
    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';

    return (
        <div className={`flex flex-col h-full ${languageFontClass} bg-gray-900/50`}>
            <header className="flex items-center gap-3 p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <SparklesIcon className="w-6 h-6 text-yellow-300" />
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <p className="text-gray-400">{uiText[language].subtitle}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <button 
                            onClick={() => handleGetRoutine('stretch')}
                            disabled={isLoading}
                            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center hover:bg-gray-700/50 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            <BodyIcon className="w-12 h-12 mx-auto text-teal-400 mb-3 transition-transform group-hover:scale-110" />
                            <h2 className="text-lg font-semibold">{uiText[language].stretchTitle}</h2>
                            <p className="text-sm text-gray-400 mt-1">{uiText[language].stretchDesc}</p>
                        </button>
                        <button 
                            onClick={() => handleGetRoutine('eye')}
                            disabled={isLoading}
                            className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 text-center hover:bg-gray-700/50 hover:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                             <EyeIcon className="w-12 h-12 mx-auto text-purple-400 mb-3 transition-transform group-hover:scale-110" />
                            <h2 className="text-lg font-semibold">{uiText[language].eyeTitle}</h2>
                            <p className="text-sm text-gray-400 mt-1">{uiText[language].eyeDesc}</p>
                        </button>
                    </div>

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8">
                            <SpinnerIcon className="w-10 h-10 mb-4" />
                            <p className="text-lg font-semibold">{uiText[language].generating}</p>
                        </div>
                    )}
                    
                    {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                    
                    {routine && (
                        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 animate-fade-in">
                            <h2 className="text-xl font-bold mb-4 text-center">{uiText[language].resultTitle}</h2>
                            <div 
                                className="prose prose-invert max-w-none prose-p:text-gray-300 prose-li:text-gray-300"
                                dangerouslySetInnerHTML={{ __html: marked.parse(routine) }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
