import React, { useState, useMemo, useEffect } from 'react';
import { GenerateContentResponse, Type } from '@google/genai';
import { Language, ExamQuestion } from '../types';
import { Notification } from './Notification';
import { SpinnerIcon, ArrowPathIcon, QuestionMarkCircleIcon } from './icons';

interface SmartQuizGeneratorProps {
    language: Language;
}

interface QuizData {
    quiz: ExamQuestion[];
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

export const SmartQuizGenerator: React.FC<SmartQuizGeneratorProps> = ({ language }) => {
    const [notesText, setNotesText] = useState<string>('');
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [stage, setStage] = useState<'input' | 'generating' | 'results'>('input');
    const [error, setError] = useState<string | null>(null);
    const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Smart Quiz Generator",
            subtitle: "Paste your notes or any text below, and the AI will create a quiz to test your knowledge.",
            placeholder: "Paste your notes here...",
            generate: "Generate Quiz",
            generating: "Generating your quiz...",
            startOver: "Create Another Quiz",
            resultsTitle: "Your Smart Quiz",
            mcqTitle: "Multiple Choice Questions",
            tfTitle: "True/False Questions",
            saTitle: "Short Answer Questions",
            showAnswer: "Show Answer",
            hideAnswer: "Hide Answer",
            correctAnswer: "Correct Answer",
            explanation: "Explanation",
            inputError: "Please paste some notes to generate a quiz.",
            generationError: "The AI couldn't generate a quiz from this text. Please try with more detailed content.",
        },
        [Language.UR]: {
            title: "سمارٹ کوئز جنریٹر",
            subtitle: "اپنے نوٹس یا کوئی بھی متن نیچے پیسٹ کریں، اور AI آپ کے علم کو جانچنے کے لیے ایک کوئز بنائے گا۔",
            placeholder: "اپنے نوٹس یہاں پیسٹ کریں...",
            generate: "کوئز بنائیں",
            generating: "آپ کا کوئز تیار کیا جا رہا ہے...",
            startOver: "ایک اور کوئز بنائیں",
            resultsTitle: "آپ کا سمارٹ کوئز",
            mcqTitle: "متعدد انتخابی سوالات",
            tfTitle: "صحیح/غلط سوالات",
            saTitle: "مختصر جوابی سوالات",
            showAnswer: "جواب دکھائیں",
            hideAnswer: "جواب چھپائیں",
            correctAnswer: "صحیح جواب",
            explanation: "وضاحت",
            inputError: "کوئز بنانے کے لیے براہ کرم کچھ نوٹس پیسٹ کریں۔",
            generationError: "AI اس متن سے کوئز نہیں بنا سکا۔ براہ کرم مزید تفصیلی مواد کے ساتھ کوشش کریں۔",
        }
    }), [language]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 7000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleGenerateQuiz = async () => {
        if (!notesText.trim()) {
            setError(uiText[language].inputError);
            return;
        }
        setStage('generating');
        setError(null);
        setQuiz(null);
        setRevealedAnswers(new Set());

        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    quiz: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                type: { type: Type.STRING, enum: ['mcq', 'true_false', 'short_answer'] },
                                question: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                answer: { type: Type.STRING },
                                explanation: { type: Type.STRING }
                            },
                            required: ['type', 'question', 'answer', 'explanation']
                        }
                    }
                },
                required: ['quiz']
            };

            const langName = language === Language.EN ? 'English' : 'Urdu';
            const prompt = `Based on the following notes, generate a quiz in ${langName} to test a student's understanding. The quiz must contain exactly:
1.  5 Multiple Choice Questions (type: 'mcq'). Each must have 4 'options'.
2.  3 True/False Questions (type: 'true_false'). The 'answer' must be "True" or "False".
3.  2 Short Answer Questions (type: 'short_answer').

The questions should test the application and understanding of the concepts in the notes, not just simple factual recall.
For every question, you MUST provide the correct 'answer' and a brief 'explanation' that clarifies the concept.
Your entire response must be a single, valid JSON object conforming to the provided schema.

Notes:
"""
${notesText}
"""`;

            const response = await generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const quizData: QuizData = JSON.parse(response.text);
            if (!quizData.quiz || quizData.quiz.length === 0) {
                throw new Error(uiText[language].generationError);
            }
            setQuiz(quizData);
            setStage('results');

        } catch (e) {
            console.error("Error generating quiz:", e);
            setError(uiText[language].generationError);
            setStage('input');
        }
    };

    const toggleAnswer = (index: number) => {
        setRevealedAnswers(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleStartOver = () => {
        setStage('input');
        setQuiz(null);
        setNotesText('');
        setError(null);
    };

    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';
    
    const renderInputStage = () => (
        <div className="max-w-2xl mx-auto text-center flex flex-col h-full">
            <QuestionMarkCircleIcon className="w-16 h-16 mx-auto text-gray-500 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{uiText[language].title}</h2>
            <p className="text-gray-400 mb-6">{uiText[language].subtitle}</p>
            <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder={uiText[language].placeholder}
                className={`w-full flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all text-base min-h-[200px] ${language === Language.UR ? 'text-right' : ''}`}
            />
            <button
                onClick={handleGenerateQuiz}
                className="w-full mt-4 px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-lg"
                disabled={!notesText.trim()}
            >
                {uiText[language].generate}
            </button>
        </div>
    );
    
    const renderGeneratingStage = () => (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <SpinnerIcon className="w-12 h-12 mb-4" />
            <h2 className="text-2xl font-semibold">{uiText[language].generating}</h2>
        </div>
    );

    const renderResultsStage = () => {
        if (!quiz) return null;
        
        const mcqs = quiz.quiz.filter(q => q.type === 'mcq');
        const trueFalse = quiz.quiz.filter(q => q.type === 'true_false');
        const shortAnswer = quiz.quiz.filter(q => q.type === 'short_answer');

        const QuestionCard: React.FC<{ q: ExamQuestion, index: number }> = ({ q, index }) => {
            const isRevealed = revealedAnswers.has(index);
            return (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <p className="font-semibold mb-3">{index + 1}. {q.question}</p>
                    {q.type === 'mcq' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                            {q.options.map((opt, i) => (
                                <div key={i} className={`p-2 rounded text-sm transition-all ${isRevealed && opt === q.answer ? 'bg-green-800/60 ring-1 ring-green-500' : 'bg-gray-700'}`}>
                                    {opt}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="text-right">
                        <button onClick={() => toggleAnswer(index)} className="text-sm text-blue-400 hover:text-blue-300 font-semibold">
                            {isRevealed ? uiText[language].hideAnswer : uiText[language].showAnswer}
                        </button>
                    </div>
                    <div className={`transition-all duration-300 ease-in-out grid ${isRevealed ? 'grid-rows-[1fr] opacity-100 mt-3 pt-3 border-t border-gray-600' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                             <div className="space-y-2 text-sm">
                                <p><strong className="text-green-400">{uiText[language].correctAnswer}:</strong> {q.answer}</p>
                                <p><strong className="text-gray-400">{uiText[language].explanation}:</strong> {q.explanation}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )
        };
        
        return (
             <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl font-bold">{uiText[language].resultsTitle}</h2>
                </div>
                {mcqs.length > 0 && (
                    <section>
                        <h3 className="text-xl font-bold mb-4 text-teal-300">{uiText[language].mcqTitle}</h3>
                        <div className="space-y-4">
                            {mcqs.map((q, i) => <QuestionCard key={`mcq-${i}`} q={q} index={i} />)}
                        </div>
                    </section>
                )}
                 {trueFalse.length > 0 && (
                    <section>
                        <h3 className="text-xl font-bold mb-4 text-teal-300">{uiText[language].tfTitle}</h3>
                        <div className="space-y-4">
                            {trueFalse.map((q, i) => <QuestionCard key={`tf-${i}`} q={q} index={i + mcqs.length} />)}
                        </div>
                    </section>
                )}
                 {shortAnswer.length > 0 && (
                    <section>
                        <h3 className="text-xl font-bold mb-4 text-teal-300">{uiText[language].saTitle}</h3>
                        <div className="space-y-4">
                            {shortAnswer.map((q, i) => <QuestionCard key={`sa-${i}`} q={q} index={i + mcqs.length + trueFalse.length} />)}
                        </div>
                    </section>
                )}
             </div>
        );
    };


    return (
        <div className={`flex flex-col h-full ${languageFontClass} bg-gray-900/50`}>
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                 {stage === 'results' && (
                    <button onClick={handleStartOver} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">
                       <ArrowPathIcon/> {uiText[language].startOver}
                    </button>
                )}
            </header>

            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                {stage === 'input' && renderInputStage()}
                {stage === 'generating' && renderGeneratingStage()}
                {stage === 'results' && renderResultsStage()}

                {error && (
                    <div className="mt-6 max-w-xl mx-auto">
                        <Notification message={error} type="error" onClose={() => setError(null)} />
                    </div>
                )}
            </main>
        </div>
    );
};
