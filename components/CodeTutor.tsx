
import React, { useState, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Language } from '../types';
import { CodeBracketIcon, BugAntIcon, LightbulbIcon, SparklesIcon, SpinnerIcon } from './icons';
import { Notification } from './Notification';

declare global {
    interface Window {
        marked: any;
    }
}

interface CodeTutorProps {
    language: Language; // UI language
}

type CodeLanguage = 'python' | 'cpp' | 'java';
type AiAction = 'explain' | 'debug' | 'optimize' | 'exercise' | 'feedback';

export const CodeTutor: React.FC<CodeTutorProps> = ({ language }) => {
    const [code, setCode] = useState('');
    const [selectedLang, setSelectedLang] = useState<CodeLanguage>('python');
    const [aiResponse, setAiResponse] = useState('');
    const [loadingAction, setLoadingAction] = useState<AiAction | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Mini-exercise state
    const [exercise, setExercise] = useState<{ prompt: string, starterCode: string } | null>(null);
    const [solution, setSolution] = useState('');

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Code Tutor & Debugger",
            subtitle: "Paste your code, select the language, and let the AI assist you.",
            languageLabel: "Language",
            codePlaceholder: "Paste your code here...",
            explain: "Explain Errors",
            debug: "Debug & Fix",
            optimize: "Optimize Code",
            aiOutput: "AI Analysis",
            inputError: "Please enter some code to analyze.",
            apiError: "The AI failed to process your request. Please try again.",
            miniExercise: "Mini Coding Exercise",
            getExercise: "Get a New Exercise",
            exercisePrompt: "Your challenge:",
            solutionPlaceholder: "Write your solution here...",
            submitSolution: "Submit for Feedback",
            feedback: "AI Feedback",
        },
        [Language.UR]: {
            title: "کوڈ ٹیوٹر اور ڈیبگر",
            subtitle: "اپنا کوڈ پیسٹ کریں، زبان منتخب کریں، اور AI کو اپنی مدد کرنے دیں۔",
            languageLabel: "زبان",
            codePlaceholder: "اپنا کوڈ یہاں پیسٹ کریں...",
            explain: "غلطیاں سمجھائیں",
            debug: "ڈیبگ اور درست کریں",
            optimize: "کوڈ کو بہتر بنائیں",
            aiOutput: "AI تجزیہ",
            inputError: "تجزیہ کے لیے براہ کرم کچھ کوڈ درج کریں۔",
            apiError: "AI آپ کی درخواست پر کارروائی کرنے میں ناکام رہا۔ براہ کرم دوبارہ کوشش کریں۔",
            miniExercise: "چھوٹی کوڈنگ مشق",
            getExercise: "نئی مشق حاصل کریں",
            exercisePrompt: "آپ کا چیلنج:",
            solutionPlaceholder: "اپنا حل یہاں لکھیں...",
            submitSolution: "فیڈ بیک کے لیے جمع کروائیں",
            feedback: "AI فیڈ بیک",
        }
    }), [language]);
    
    const handleAiAction = async (action: AiAction) => {
        const textToProcess = action === 'feedback' ? solution : code;
        if (!textToProcess.trim()) {
            setError(uiText[language].inputError);
            return;
        }

        setLoadingAction(action);
        setError(null);
        setAiResponse('');

        let prompt = '';
        const langName = { python: 'Python', cpp: 'C++', java: 'Java' }[selectedLang];
        const uiLangName = language === 'en' ? 'English' : 'Urdu';

        switch(action) {
            case 'explain':
                prompt = `You are a helpful programming tutor. Explain the errors in the following ${langName} code in simple, easy-to-understand ${uiLangName}. Provide a corrected version of the code with comments explaining the fix. Format your response using Markdown. Code:\n\`\`\`${langName}\n${code}\n\`\`\``;
                break;
            case 'debug':
                prompt = `You are an expert programmer teaching a student. Debug the following ${langName} code. Identify the bug's root cause, explain in ${uiLangName} how to fix it step-by-step, and provide the fully corrected code with explanatory comments. Format your response using Markdown. Code:\n\`\`\`${langName}\n${code}\n\`\`\``;
                break;
            case 'optimize':
                prompt = `You are a senior software engineer mentoring a junior developer. Analyze the following ${langName} code for optimization. In ${uiLangName}, suggest improvements for performance, readability, and best practices. Provide an optimized version of the code with comments explaining the key changes. Format your response using Markdown. Code:\n\`\`\`${langName}\n${code}\n\`\`\``;
                break;
            case 'feedback':
                 prompt = `You are a coding instructor providing feedback in ${uiLangName} on a student's solution to an exercise.
                 Exercise Prompt: "${exercise?.prompt}"
                 Student's ${langName} Solution:
                 \`\`\`${langName}
                 ${solution}
                 \`\`\`
                 Provide constructive feedback. Point out what's good, what could be improved, and explain why. If the solution is incorrect, guide them toward the correct logic without giving the full answer away immediately. Format your response using Markdown.`;
                 break;
        }

        const isComplexAction = ['debug', 'optimize', 'feedback'].includes(action);
        const model = isComplexAction ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        const config: any = {};

        if (isComplexAction) {
            config.thinkingConfig = { thinkingBudget: 32768 };
        }

        try {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: config
            });
            setAiResponse(response.text);
        } catch (e) {
            console.error("AI Action Error:", e);
            setError(uiText[language].apiError);
        } finally {
            setLoadingAction(null);
        }
    };
    
    const handleGetExercise = async () => {
        setLoadingAction('exercise');
        setError(null);
        setAiResponse('');
        setExercise(null);
        setSolution('');

        const langName = { python: 'Python', cpp: 'C++', java: 'Java' }[selectedLang];
        const uiLangName = language === 'en' ? 'English' : 'Urdu';
        const prompt = `Generate a simple, beginner-friendly coding exercise in ${langName}. The exercise should cover a fundamental concept (like loops, arrays, or basic functions). Provide a short 'prompt' in ${uiLangName} and some 'starterCode' in ${langName}.`;
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            prompt: { type: Type.STRING },
                            starterCode: { type: Type.STRING },
                        },
                        required: ['prompt', 'starterCode']
                    }
                }
            });
            const exerciseData = JSON.parse(response.text);
            setExercise(exerciseData);
            setSolution(exerciseData.starterCode || '');
        } catch (e) {
            console.error("Exercise Generation Error:", e);
            setError(uiText[language].apiError);
        } finally {
            setLoadingAction(null);
        }
    };


    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';
    
    const ActionButton: React.FC<{ action: AiAction, icon: React.ReactNode, label: string, onClick: () => void, primary?: boolean }> = ({ action, icon, label, onClick, primary = false }) => (
        <button
            onClick={onClick}
            disabled={!!loadingAction}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-semibold rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed ${primary ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
            {loadingAction === action ? <SpinnerIcon /> : icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className={`flex flex-col h-full ${languageFontClass}`}>
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Left Panel */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold">{uiText[language].subtitle}</h2>
                        <div className="flex items-center gap-2">
                            <label htmlFor="lang-select" className="text-sm font-medium text-gray-400">{uiText[language].languageLabel}:</label>
                            <select
                                id="lang-select"
                                value={selectedLang}
                                onChange={e => setSelectedLang(e.target.value as CodeLanguage)}
                                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="python">Python</option>
                                <option value="cpp">C++</option>
                                <option value="java">Java</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <textarea
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder={uiText[language].codePlaceholder}
                            className="w-full flex-1 p-3 bg-gray-900/50 font-mono text-sm border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                        />
                        <div className="flex flex-wrap gap-3 mt-4">
                            <ActionButton action="explain" icon={<CodeBracketIcon />} label={uiText[language].explain} onClick={() => handleAiAction('explain')} />
                            <ActionButton action="debug" icon={<BugAntIcon />} label={uiText[language].debug} onClick={() => handleAiAction('debug')} />
                            <ActionButton action="optimize" icon={<LightbulbIcon />} label={uiText[language].optimize} onClick={() => handleAiAction('optimize')} />
                        </div>
                    </div>
                    
                    {/* Mini Exercise Section */}
                    <div className="flex flex-col gap-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                        <div className="flex justify-between items-center">
                             <h2 className="text-lg font-semibold">{uiText[language].miniExercise}</h2>
                             <ActionButton action="exercise" icon={<SparklesIcon />} label={uiText[language].getExercise} onClick={handleGetExercise} />
                        </div>
                       {exercise && (
                            <div className="flex flex-col gap-3 animate-fade-in">
                                 <p className="text-gray-300"><strong className="text-teal-400">{uiText[language].exercisePrompt}</strong> {exercise.prompt}</p>
                                 <textarea
                                    value={solution}
                                    onChange={e => setSolution(e.target.value)}
                                    placeholder={uiText[language].solutionPlaceholder}
                                    className="w-full h-32 p-3 bg-gray-900/50 font-mono text-sm border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none resize-y"
                                 />
                                 <ActionButton action="feedback" icon={<SparklesIcon />} label={uiText[language].submitSolution} onClick={() => handleAiAction('feedback')} primary />
                            </div>
                       )}
                    </div>

                </div>

                {/* Right Panel */}
                <div className="flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700 min-h-[50vh] lg:min-h-0">
                    <h2 className="text-lg font-bold mb-3">{loadingAction === 'feedback' ? uiText[language].feedback : uiText[language].aiOutput}</h2>
                    <div className="flex-1 overflow-y-auto bg-gray-900/50 p-3 rounded-md">
                        {loadingAction && loadingAction !== 'exercise' ? (
                            <div className="flex items-center justify-center h-full">
                                <SpinnerIcon className="w-8 h-8"/>
                            </div>
                        ) : aiResponse ? (
                            <div
                                className="prose prose-sm prose-invert max-w-none prose-pre:bg-gray-800"
                                dangerouslySetInnerHTML={{ __html: window.marked.parse(aiResponse) }}
                            />
                        ) : (
                            !error && <p className="text-gray-500">{uiText[language].inputError}</p>
                        )}
                        {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                    </div>
                </div>

            </div>
        </div>
    );
};
