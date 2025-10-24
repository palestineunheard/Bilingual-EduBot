
import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Notification } from './Notification';
import { UploadIcon, SpinnerIcon } from './icons';
import { Language } from '../types';

declare const pdfjsLib: any;
declare const Tesseract: any;

interface FeedbackPoint {
    point: string;
    correction: string;
    example?: string;
}

interface FeedbackDetails {
    grammar: FeedbackPoint[];
    clarity: FeedbackPoint[];
    structure: FeedbackPoint[];
    coherence: FeedbackPoint[];
}

interface FeedbackResponse {
    grade: string;
    explanation: string;
    feedback: FeedbackDetails;
}

type Stage = 'input' | 'parsing' | 'loading' | 'results';

interface EssayFeedbackProps {
    language: Language; // UI Language
}

export const EssayFeedback: React.FC<EssayFeedbackProps> = ({ language }) => {
    const [essayText, setEssayText] = useState<string>('');
    const [feedback, setFeedback] = useState<FeedbackResponse | null>(null);
    const [essayLanguage, setEssayLanguage] = useState<'en' | 'ur'>('en');
    const [stage, setStage] = useState<Stage>('input');
    const [parsingStatus, setParsingStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);
    
    const wordCount = useMemo(() => {
        return essayText.trim().split(/\s+/).filter(Boolean).length;
    }, [essayText]);
    
    const isWordCountValid = useMemo(() => {
        return wordCount >= 100 && wordCount <= 3000;
    }, [wordCount]);

    const uiText = useMemo(() => ({
        en: {
            title: "AI Essay & Assignment Feedback",
            submitEssay: "Submit Your Essay",
            pastePlaceholder: "Paste or type your essay here...",
            uploadTitle: "Upload File",
            uploadHint: "Supports: .txt, .pdf, .png, .jpg",
            usePastedText: "Use Pasted Text",
            wordCount: "Word Count",
            getFeedback: "Get Feedback",
            analyzing: "Analyzing...",
            feedbackWillAppear: "Your Feedback Will Appear Here",
            getStarted: "Submit an essay to get started.",
            overallGrade: "Overall Grade",
            grammar: "Grammar",
            clarity: "Clarity",
            structure: "Structure",
            coherence: "Coherence & Originality",
            wordCountError: "Essay must be between 100 and 3000 words.",
            pasteError: "Please paste some content first.",
            issue: "Issue",
            suggestion: "Suggestion",
            essayLanguage: "Essay Language:",
        },
        ur: {
            title: "AI مضمون اور اسائنمنٹ فیڈ بیک",
            submitEssay: "اپنا مضمون جمع کروائیں",
            pastePlaceholder: "اپنا مضمون یہاں پیسٹ کریں یا ٹائپ کریں...",
            uploadTitle: "فائل اپ لوڈ کریں",
            uploadHint: "سپورٹ کرتا ہے: .txt, .pdf, .png, .jpg",
            usePastedText: "پیسٹ شدہ متن استعمال کریں",
            wordCount: "الفاظ کی گنتی",
            getFeedback: "فیڈ بیک حاصل کریں",
            analyzing: "تجزیہ کیا جا رہا ہے...",
            feedbackWillAppear: "آپ کی رائے یہاں ظاہر ہوگی",
            getStarted: "شروع کرنے کے لیے ایک مضمون جمع کروائیں۔",
            overallGrade: "مجموعی گریڈ",
            grammar: "گرامر",
            clarity: "وضاحت",
            structure: "ساخت",
            coherence: "ہم آہنگی اور اصلیت",
            wordCountError: "مضمون 100 سے 3000 الفاظ کے درمیان ہونا چاہیے۔",
            pasteError: "براہ کرم پہلے کچھ مواد پیسٹ کریں۔",
            issue: "مسئلہ",
            suggestion: "تجویز",
            essayLanguage: "مضمون کی زبان:",
        }
    }), []);


    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 7000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStage('parsing');
        setError(null);

        try {
            if (file.type === 'text/plain') {
                setParsingStatus('Reading text file...');
                const text = await file.text();
                setEssayText(text);
            } else if (file.type === 'application/pdf') {
                setParsingStatus('Parsing PDF document...');
                const data = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(data).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    setParsingStatus(`Reading PDF page ${i} of ${pdf.numPages}...`);
                    const page = await pdf.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map((item: any) => item.str).join(' ');
                }
                setEssayText(textContent);
            } else if (file.type.startsWith('image/')) {
                setParsingStatus('Initializing OCR engine...');
                const selectedLang = essayLanguage === 'en' ? 'eng' : 'urd';
                const worker = await Tesseract.createWorker({
                    logger: (m: any) => {
                        if (m.status === 'recognizing text') {
                           setParsingStatus(`Recognizing text... ${Math.round(m.progress * 100)}%`);
                        }
                    },
                });
                await worker.loadLanguage(selectedLang);
                await worker.initialize(selectedLang);
                const { data: { text } } = await worker.recognize(file);
                await worker.terminate();
                setEssayText(text);
            } else {
                throw new Error('Unsupported file type. Please use .txt, .pdf, or image files.');
            }
            setStage('input');
        } catch (err: any) {
            console.error('File parsing error:', err);
            setError(err.message || 'Failed to process the file.');
            setStage('input');
        } finally {
            setParsingStatus('');
            e.target.value = '';
        }
    };

    const handleGetFeedback = async () => {
        if (!isWordCountValid) {
            setError(uiText[language].wordCountError);
            return;
        }
        setStage('loading');
        setError(null);
        setFeedback(null);

        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    grade: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    feedback: {
                        type: Type.OBJECT,
                        properties: {
                            grammar: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, correction: { type: Type.STRING }, example: { type: Type.STRING } }, required: ['point', 'correction'] } },
                            clarity: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, correction: { type: Type.STRING }, example: { type: Type.STRING } }, required: ['point', 'correction'] } },
                            structure: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, correction: { type: Type.STRING }, example: { type: Type.STRING } }, required: ['point', 'correction'] } },
                            coherence: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { point: { type: Type.STRING }, correction: { type: Type.STRING }, example: { type: Type.STRING } }, required: ['point', 'correction'] } },
                        },
                        required: ['grammar', 'clarity', 'structure', 'coherence']
                    }
                },
                required: ['grade', 'explanation', 'feedback']
            };
            
            const langName = essayLanguage === 'en' ? 'English' : 'Urdu';
            const prompt = `You are an expert university tutor. Your task is to analyze the provided essay and give constructive feedback in ${langName}. The essay is written in ${langName}.

**Crucially, do not rewrite the essay for the user. Your role is to provide feedback for improvement, not to do the work for them.**

Analyze the essay based on academic writing standards for:
- Grammar: Spelling, punctuation, sentence structure.
- Clarity: How easy the arguments are to understand.
- Structure: Logical flow, introduction, body, conclusion.
- Coherence & Originality: Development and support of ideas, and original thought.

For each of the four criteria, provide a list of feedback points. Each feedback point MUST include:
1. 'point': A concise description of the issue in ${langName}.
2. 'correction': A clear explanation in ${langName} of HOW to fix the issue, with examples.
3. 'example' (optional): The specific phrase from the essay that has the issue.

After the detailed feedback, assign an overall letter grade (e.g., A, B+, C) and a concise explanation for the grade in ${langName}.

Your entire response MUST be a single, valid JSON object conforming to the provided schema. Do not include any text outside the JSON object.

Essay to analyze:
"""
${essayText}
"""`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });

            const parsedFeedback: FeedbackResponse = JSON.parse(response.text);
            setFeedback(parsedFeedback);
            setStage('results');

        } catch (e) {
            console.error("Error getting feedback:", e);
            setError("Failed to get feedback from the AI. It might be busy, or the content was unsuitable. Please try again.");
            setStage('input');
        }
    };
    
    const FeedbackSection: React.FC<{ title: string; points: FeedbackPoint[] }> = ({ title, points }) => (
        <details className="mb-4" open>
            <summary className="text-md font-semibold text-teal-300 mb-2 cursor-pointer">{title}</summary>
            {points.length > 0 ? (
                <ul className="space-y-3 pl-2">
                    {points.map((p, i) => (
                        <li key={i} className="text-sm bg-gray-800 p-3 rounded-md border border-gray-700/50">
                            {p.example && <p className="text-xs text-red-300 italic border-l-2 border-red-400 pl-2 mb-2">"{p.example}"</p>}
                            <p className="text-gray-300"><strong className="text-teal-400">{uiText[language].issue}:</strong> {p.point}</p>
                            <p className="text-gray-300 mt-1"><strong className="text-green-400">{uiText[language].suggestion}:</strong> {p.correction}</p>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-gray-400 pl-2">No specific points noted for this section.</p>}
        </details>
    );
    
    const renderLoadingStage = (message: string) => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <SpinnerIcon className="w-12 h-12 mb-4" />
            <h2 className="text-xl font-semibold">{message}</h2>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{uiText[language].essayLanguage}</span>
                    <div className="flex items-center gap-1 p-1 bg-gray-700 rounded-full">
                        <button onClick={() => setEssayLanguage('en')} className={`px-3 py-1 text-sm font-sans rounded-full transition-colors ${essayLanguage === 'en' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>English</button>
                        <button onClick={() => setEssayLanguage('ur')} className={`px-3 py-1 text-sm font-urdu rounded-full transition-colors ${essayLanguage === 'ur' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}>اردو</button>
                    </div>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Input Column */}
                <div className="flex flex-col gap-4">
                    <h2 className="text-lg font-semibold">{uiText[language].submitEssay}</h2>
                    <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-4 flex flex-col items-center justify-center text-center">
                        <UploadIcon className="w-10 h-10 text-gray-500 mb-2" />
                        <label htmlFor="file-upload" className="w-full max-w-xs cursor-pointer px-4 py-2 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            {uiText[language].uploadTitle}
                        </label>
                        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".txt,.pdf,.png,.jpg,.jpeg" disabled={stage === 'parsing'} />
                        <p className="text-xs text-gray-500 mt-2">{uiText[language].uploadHint}</p>
                    </div>
                    <textarea
                        value={essayText}
                        onChange={(e) => setEssayText(e.target.value)}
                        placeholder={uiText[language].pastePlaceholder}
                        className={`w-full flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all min-h-[250px] lg:min-h-0 ${essayLanguage === 'ur' ? 'font-urdu text-right' : 'font-sans text-left'}`}
                        dir={essayLanguage === 'ur' ? 'rtl' : 'ltr'}
                        disabled={stage !== 'input'}
                    />
                    <div className="flex items-center justify-between gap-4">
                         <p className={`text-sm font-semibold font-sans ${!isWordCountValid && essayText.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {uiText[language].wordCount}: {wordCount}
                        </p>
                        <button
                            onClick={handleGetFeedback}
                            className="px-6 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            disabled={stage !== 'input' || !isWordCountValid}
                        >
                            {stage === 'loading' ? <SpinnerIcon /> : null}
                            {stage === 'loading' ? uiText[language].analyzing : uiText[language].getFeedback}
                        </button>
                    </div>
                     {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                </div>

                {/* Feedback Column */}
                <div className="flex flex-col bg-gray-800/50 border border-gray-700 rounded-lg">
                    {stage === 'input' && !feedback && (
                        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                            <h2 className="text-xl font-semibold text-gray-400">{uiText[language].feedbackWillAppear}</h2>
                            <p className="text-gray-500">{uiText[language].getStarted}</p>
                        </div>
                    )}
                    {stage === 'parsing' && renderLoadingStage(parsingStatus)}
                    {stage === 'loading' && renderLoadingStage(uiText[language].analyzing)}
                    {(stage === 'results' || (stage === 'input' && feedback)) && feedback && (
                        <div className={`flex flex-col h-full ${essayLanguage === 'ur' ? 'font-urdu' : 'font-sans'}`} dir={essayLanguage === 'ur' ? 'rtl' : 'ltr'}>
                            <div className="p-4 border-b border-gray-700">
                                <h3 className="text-lg font-bold text-center mb-2">{uiText[language].overallGrade}</h3>
                                <div className="flex items-baseline justify-center gap-2">
                                    <p className="text-6xl font-bold text-teal-300 font-sans">{feedback.grade}</p>
                                </div>
                                <p className="text-center text-gray-400 text-sm mt-2">{feedback.explanation}</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                <FeedbackSection title={uiText[language].grammar} points={feedback.feedback.grammar} />
                                <FeedbackSection title={uiText[language].clarity} points={feedback.feedback.clarity} />
                                <FeedbackSection title={uiText[language].structure} points={feedback.feedback.structure} />
                                <FeedbackSection title={uiText[language].coherence} points={feedback.feedback.coherence} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
