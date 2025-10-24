import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { ExamQuestion, UserAnswer, Language } from '../types';
import { Notification } from './Notification';
import { UploadIcon, TimerIcon, CheckCircleIcon, XCircleIcon } from './icons';

declare const pdfjsLib: any;
declare const Tesseract: any;

type ExamStage = 'upload' | 'parsing' | 'configuring' | 'generating' | 'active' | 'feedback' | 'results';
type ExamType = 'mcq' | 'mixed';
const EXAM_TIME_LIMIT = 30; // seconds per question

interface ExamPracticeModeProps {
    language: Language;
}

export const ExamPracticeMode: React.FC<ExamPracticeModeProps> = ({ language }) => {
    const [stage, setStage] = useState<ExamStage>('upload');
    const [studyContent, setStudyContent] = useState<string>('');
    const [parsingStatus, setParsingStatus] = useState<string>('');
    
    const [examType, setExamType] = useState<ExamType>('mixed');
    const [numQuestions, setNumQuestions] = useState<number>(10);
    const [questions, setQuestions] = useState<ExamQuestion[]>([]);
    
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
    const [currentAnswer, setCurrentAnswer] = useState<string | null>(null);
    const [timer, setTimer] = useState<number>(EXAM_TIME_LIMIT);
    
    const [error, setError] = useState<string | null>(null);
    // FIX: Use ReturnType<typeof setInterval> for the timer ref type, which is browser-compatible.
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "AI Exam Practice Mode",
            subtitle: "Upload your study material or paste it below. The AI will generate a practice exam to test your knowledge.",
            uploadFile: "Upload File",
            supportedFiles: "Supports: .txt, .pdf, .png, .jpg",
            pastePlaceholder: "Or paste your text here...",
            usePastedText: "Use Pasted Text",
            pasteError: "Please paste some content first.",
            readingText: "Reading text file...",
            parsingPDF: "Parsing PDF document...",
            readingPDFPage: "Reading PDF page {current} of {total}...",
            initOCR: "Initializing OCR engine...",
            recognizingText: "Recognizing text... {progress}%",
            unsupportedFile: "Unsupported file type. Please use .txt, .pdf, or image files.",
            fileProcessError: "Failed to process the file.",
            examSetupTitle: "Exam Setup",
            examSetupSubtitle: "Your material is ready. Configure your practice exam below.",
            questionTypes: "Question Types",
            mixed: "Mixed",
            mcqsOnly: "MCQs Only",
            numQuestions: "Number of Questions: {num}",
            generateExam: "Generate Exam",
            useDifferentMaterial: "Use different material",
            emptyMaterialError: "Study material is empty. Please provide content.",
            generatingExam: "Generating your exam...",
            generationError: "The AI could not generate questions from the provided material. Please try with more detailed content.",
            generationFail: "Failed to generate exam questions. The AI might be busy or the content was unsuitable. Please try again.",
            questionOf: "Question {current} of {total}",
            shortAnswerPlaceholder: "Type your answer...",
            submitAnswer: "Submit Answer",
            correct: "Correct!",
            incorrect: "Incorrect",
            timesUp: "Time's Up!",
            yourAnswer: "Your Answer:",
            noAnswer: "No answer submitted",
            correctAnswer: "Correct Answer:",
            explanation: "Explanation:",
            finishExam: "Finish Exam",
            nextQuestion: "Next Question",
            resultsTitle: "Exam Results",
            totalScore: "Total Score",
            accuracy: "Accuracy",
            avgTime: "Average Time",
            tryAgain: "Try Again",
            newExam: "New Exam",
            reviewAnswers: "Review Your Answers",
            skipped: "Skipped",
        },
        [Language.UR]: {
            title: "AI امتحان پریکٹس موڈ",
            subtitle: "اپنا مطالعاتی مواد اپ لوڈ کریں یا نیچے پیسٹ کریں۔ AI آپ کے علم کو جانچنے کے لیے ایک پریکٹس امتحان تیار کرے گا۔",
            uploadFile: "فائل اپ لوڈ کریں",
            supportedFiles: "سپورٹ کرتا ہے: .txt, .pdf, .png, .jpg",
            pastePlaceholder: "یا اپنا متن یہاں پیسٹ کریں...",
            usePastedText: "پیسٹ شدہ متن استعمال کریں",
            pasteError: "براہ کرم پہلے کچھ مواد پیسٹ کریں۔",
            readingText: "ٹیکسٹ فائل پڑھ رہا ہے...",
            parsingPDF: "پی ڈی ایف دستاویز کو پارس کر رہا ہے...",
            readingPDFPage: "پی ڈی ایف صفحہ {current} از {total} پڑھ رہا ہے...",
            initOCR: "OCR انجن شروع کر رہا ہے...",
            recognizingText: "متن کی شناخت... {progress}%",
            unsupportedFile: "غیر تعاون یافتہ فائل کی قسم۔ براہ کرم .txt، .pdf، یا تصویری فائلیں استعمال کریں۔",
            fileProcessError: "فائل پر کارروائی کرنے میں ناکام۔",
            examSetupTitle: "امتحان کا سیٹ اپ",
            examSetupSubtitle: "آپ کا مواد تیار ہے۔ ذیل میں اپنے پریکٹس امتحان کو کنفیگر کریں۔",
            questionTypes: "سوالات کی اقسام",
            mixed: "مخلوط",
            mcqsOnly: "صرف MCQs",
            numQuestions: "سوالات کی تعداد: {num}",
            generateExam: "امتحان بنائیں",
            useDifferentMaterial: "مختلف مواد استعمال کریں",
            emptyMaterialError: "مطالعاتی مواد خالی ہے۔ براہ کرم مواد فراہم کریں۔",
            generatingExam: "آپ کا امتحان تیار کیا جا رہا ہے...",
            generationError: "AI فراہم کردہ مواد سے سوالات پیدا نہیں کر سکا۔ براہ کرم مزید تفصیلی مواد کے ساتھ کوشش کریں۔",
            generationFail: "امتحانی سوالات پیدا کرنے میں ناکام۔ AI مصروف ہو سکتا ہے یا مواد غیر موزوں تھا۔ براہ کرم دوبارہ کوشش کریں۔",
            questionOf: "سوال {current} از {total}",
            shortAnswerPlaceholder: "اپنا جواب ٹائپ کریں...",
            submitAnswer: "جواب جمع کروائیں",
            correct: "درست!",
            incorrect: "غلط",
            timesUp: "وقت ختم!",
            yourAnswer: "آپ کا جواب:",
            noAnswer: "کوئی جواب جمع نہیں کرایا گیا",
            correctAnswer: "صحیح جواب:",
            explanation: "وضاحت:",
            finishExam: "امتحان ختم کریں",
            nextQuestion: "اگلا سوال",
            resultsTitle: "امتحان کے نتائج",
            totalScore: "کل سکور",
            accuracy: "درستگی",
            avgTime: "اوسط وقت",
            tryAgain: "دوبارہ کوشش کریں",
            newExam: "نیا امتحان",
            reviewAnswers: "اپنے جوابات کا جائزہ لیں",
            skipped: "چھوڑ دیا گیا",
        }
    }), [language]);


    const resetTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimer(EXAM_TIME_LIMIT);
        timerRef.current = setInterval(() => {
            setTimer(prev => prev - 1);
        }, 1000);
    }, []);

    useEffect(() => {
        if (timer === 0 && stage === 'active') {
            handleTimeUp();
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timer, stage]);

    useEffect(() => {
        if (error) {
            const timeout = setTimeout(() => setError(null), 7000);
            return () => clearTimeout(timeout);
        }
    }, [error]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStage('parsing');
        setError(null);

        try {
            if (file.type === 'text/plain') {
                setParsingStatus(uiText[language].readingText);
                const text = await file.text();
                setStudyContent(text);
            } else if (file.type === 'application/pdf') {
                setParsingStatus(uiText[language].parsingPDF);
                const data = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(data).promise;
                let textContent = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    setParsingStatus(uiText[language].readingPDFPage.replace('{current}', i.toString()).replace('{total}', pdf.numPages.toString()));
                    const page = await pdf.getPage(i);
                    const text = await page.getTextContent();
                    textContent += text.items.map((item: any) => item.str).join(' ');
                }
                setStudyContent(textContent);
            } else if (file.type.startsWith('image/')) {
                setParsingStatus(uiText[language].initOCR);
                const worker = await Tesseract.createWorker({
                    logger: (m: any) => {
                        if (m.status === 'recognizing text') {
                           setParsingStatus(uiText[language].recognizingText.replace('{progress}', Math.round(m.progress * 100).toString()));
                        }
                    },
                });
                await worker.loadLanguage('eng');
                await worker.initialize('eng');
                const { data: { text } } = await worker.recognize(file);
                await worker.terminate();
                setStudyContent(text);
            } else {
                throw new Error(uiText[language].unsupportedFile);
            }
            setStage('configuring');
        } catch (err: any) {
            console.error('File parsing error:', err);
            setError(err.message || uiText[language].fileProcessError);
            setStage('upload');
        } finally {
            setParsingStatus('');
        }
    };
    
    const handleGenerateExam = async () => {
        if (!studyContent.trim()) {
            setError(uiText[language].emptyMaterialError);
            return;
        }
        setStage('generating');
        setError(null);
        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    questions: {
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
                required: ['questions']
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Based on the provided study material, generate an exam with exactly ${numQuestions} questions.
- Question types should be ${examType === 'mixed' ? 'a mix of Multiple Choice (mcq), True/False (true_false), and Short Answer (short_answer)' : 'Multiple Choice (mcq) only'}.
- For MCQs, provide 4 distinct options. One must be correct.
- For True/False, the answer must be exactly "True" or "False".
- For every question, provide a brief 'explanation' that justifies the answer based on the study material.
- The language for questions and answers must be the same as the study material.

STUDY MATERIAL:
"""
${studyContent}
"""`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const examData = JSON.parse(response.text);
            const generatedQuestions = examData.questions || [];
            if (generatedQuestions.length === 0) throw new Error(uiText[language].generationError);

            setQuestions(generatedQuestions.sort(() => Math.random() - 0.5));
            setCurrentQuestionIndex(0);
            setUserAnswers([]);
            setStage('active');
            resetTimer();

        } catch (err: any) {
            console.error('Exam generation error:', err);
            setError(uiText[language].generationFail);
            setStage('configuring');
        }
    };

    const handleSubmitAnswer = () => {
        if (stage !== 'active' || currentAnswer === null) return;
        if (timerRef.current) clearInterval(timerRef.current);

        const currentQ = questions[currentQuestionIndex];
        const isCorrect = currentQ.answer.trim().toLowerCase() === currentAnswer.trim().toLowerCase();
        
        const answerRecord: UserAnswer = {
            question: currentQ,
            userAnswer: currentAnswer,
            isCorrect,
            timeTaken: EXAM_TIME_LIMIT - timer
        };
        setUserAnswers(prev => [...prev, answerRecord]);
        setStage('feedback');
    };

    const handleTimeUp = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const currentQ = questions[currentQuestionIndex];
        const answerRecord: UserAnswer = {
            question: currentQ,
            userAnswer: null, // Skipped
            isCorrect: false,
            timeTaken: EXAM_TIME_LIMIT
        };
        setUserAnswers(prev => [...prev, answerRecord]);
        setStage('feedback');
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setCurrentAnswer(null);
            setStage('active');
            resetTimer();
        } else {
            setStage('results');
        }
    };

    const handleRestart = (fullReset = false) => {
        if (fullReset) {
            setStudyContent('');
            setQuestions([]);
            setStage('upload');
        } else {
            setQuestions(prev => [...prev].sort(() => Math.random() - 0.5)); // Re-shuffle
            setStage('active');
        }
        setCurrentQuestionIndex(0);
        setUserAnswers([]);
        setCurrentAnswer(null);
        resetTimer();
    };

    const renderUploadStage = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{uiText[language].title}</h1>
            <p className="text-gray-400 mb-8 max-w-xl">{uiText[language].subtitle}</p>
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center">
                    <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
                    <label htmlFor="file-upload" className="w-full cursor-pointer px-4 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors text-center">
                        {uiText[language].uploadFile}
                    </label>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".txt,.pdf,.png,.jpg,.jpeg" />
                    <p className="text-xs text-gray-500 mt-3">{uiText[language].supportedFiles}</p>
                </div>
                <div className="flex flex-col">
                    <textarea 
                        className="w-full flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder={uiText[language].pastePlaceholder}
                        onChange={(e) => setStudyContent(e.target.value)}
                    />
                    <button 
                        onClick={() => { if (studyContent.trim()) setStage('configuring'); else setError(uiText[language].pasteError); }}
                        className="w-full mt-2 px-4 py-2.5 bg-teal-600 font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-500"
                        disabled={!studyContent.trim()}
                    >
                        {uiText[language].usePastedText}
                    </button>
                </div>
            </div>
        </div>
    );
    
    const renderLoadingStage = (message: string) => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
            <h2 className="text-2xl font-semibold">{message}</h2>
        </div>
    );

    const renderConfiguringStage = () => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <h1 className="text-3xl font-bold mb-2">{uiText[language].examSetupTitle}</h1>
            <p className="text-gray-400 mb-8 max-w-xl">{uiText[language].examSetupSubtitle}</p>
            <div className="w-full max-w-md bg-gray-800/50 p-6 rounded-lg border border-gray-700 space-y-6">
                <div>
                    <label className="block text-lg font-semibold mb-2">{uiText[language].questionTypes}</label>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setExamType('mixed')} className={`px-4 py-2 rounded-lg ${examType === 'mixed' ? 'bg-blue-600' : 'bg-gray-700'}`}>{uiText[language].mixed}</button>
                        <button onClick={() => setExamType('mcq')} className={`px-4 py-2 rounded-lg ${examType === 'mcq' ? 'bg-blue-600' : 'bg-gray-700'}`}>{uiText[language].mcqsOnly}</button>
                    </div>
                </div>
                <div>
                    <label htmlFor="num-questions" className="block text-lg font-semibold mb-2">{uiText[language].numQuestions.replace('{num}', numQuestions.toString())}</label>
                    <input 
                        type="range" id="num-questions" min="5" max="20" step="1" value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                <button onClick={handleGenerateExam} className="w-full px-4 py-3 text-lg bg-green-600 font-semibold rounded-lg hover:bg-green-700 transition-colors">
                    {uiText[language].generateExam}
                </button>
            </div>
             <button onClick={() => setStage('upload')} className="mt-4 text-gray-400 hover:text-white">{uiText[language].useDifferentMaterial}</button>
        </div>
    );

    const renderActiveStage = () => {
        const question = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
        return (
            <div className="flex flex-col h-full p-4 md:p-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <TimerIcon className="w-6 h-6 text-yellow-400" />
                        <span className="text-lg font-mono font-bold text-yellow-400">{timer}s</span>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-full max-w-3xl">
                        <p className="text-sm text-gray-400 mb-2">{uiText[language].questionOf.replace('{current}', (currentQuestionIndex + 1).toString()).replace('{total}', questions.length.toString())}</p>
                        <h2 className="text-2xl font-semibold mb-6">{question.question}</h2>
                        {question.type === 'mcq' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {question.options?.map((opt, i) => (
                                    <button key={i} onClick={() => setCurrentAnswer(opt)} className={`p-4 rounded-lg text-left transition-colors text-lg ${currentAnswer === opt ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                        {question.type === 'true_false' && (
                             <div className="flex justify-center gap-4">
                                <button onClick={() => setCurrentAnswer("True")} className={`px-12 py-4 rounded-lg text-lg ${currentAnswer === 'True' ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-700 hover:bg-gray-600'}`}>True</button>
                                <button onClick={() => setCurrentAnswer("False")} className={`px-12 py-4 rounded-lg text-lg ${currentAnswer === 'False' ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-gray-700 hover:bg-gray-600'}`}>False</button>
                            </div>
                        )}
                        {question.type === 'short_answer' && (
                            <input 
                                type="text"
                                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder={uiText[language].shortAnswerPlaceholder}
                                onChange={(e) => setCurrentAnswer(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmitAnswer()}
                            />
                        )}
                        <div className="text-center mt-8">
                            <button onClick={handleSubmitAnswer} disabled={!currentAnswer} className="px-8 py-3 bg-teal-600 font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-500">{uiText[language].submitAnswer}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderFeedbackStage = () => {
        const lastAnswer = userAnswers[userAnswers.length - 1];
        const isLastQuestion = currentQuestionIndex === questions.length - 1;
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className={`flex items-center gap-4 mb-4 ${lastAnswer.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                    {lastAnswer.isCorrect ? <CheckCircleIcon className="w-12 h-12" /> : <XCircleIcon className="w-12 h-12" />}
                    <h1 className="text-4xl font-bold">
                        {timer === 0 && lastAnswer.userAnswer === null ? uiText[language].timesUp : (lastAnswer.isCorrect ? uiText[language].correct : uiText[language].incorrect)}
                    </h1>
                </div>

                <div className="w-full max-w-2xl bg-gray-800/50 p-6 rounded-lg border border-gray-700 text-left space-y-4">
                    <p><strong className="text-gray-400">{uiText[language].yourAnswer}</strong> <span className={lastAnswer.isCorrect ? 'text-green-300' : 'text-red-300'}>{lastAnswer.userAnswer || uiText[language].noAnswer}</span></p>
                    {!lastAnswer.isCorrect && <p><strong className="text-gray-400">{uiText[language].correctAnswer}</strong> <span className="text-green-300">{lastAnswer.question.answer}</span></p>}
                    <div>
                        <h3 className="font-semibold text-gray-300 mb-1">{uiText[language].explanation}</h3>
                        <p className="text-gray-400">{lastAnswer.question.explanation}</p>
                    </div>
                </div>

                <button onClick={handleNextQuestion} className="mt-8 px-8 py-3 text-lg bg-blue-600 font-semibold rounded-lg hover:bg-blue-700">
                    {isLastQuestion ? uiText[language].finishExam : uiText[language].nextQuestion}
                </button>
            </div>
        );
    };

    const renderResultsStage = () => {
        const totalCorrect = userAnswers.filter(a => a.isCorrect).length;
        const totalQuestions = questions.length;
        const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const avgTime = userAnswers.length > 0 ? (userAnswers.reduce((sum, a) => sum + a.timeTaken, 0) / userAnswers.length).toFixed(1) : 0;
        
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <h1 className="text-3xl font-bold mb-4">{uiText[language].resultsTitle}</h1>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-8">
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">{uiText[language].totalScore}</p>
                        <p className="text-3xl font-bold">{totalCorrect} / {totalQuestions}</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">{uiText[language].accuracy}</p>
                        <p className="text-3xl font-bold">{accuracy}%</p>
                    </div>
                    <div className="bg-gray-800/50 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">{uiText[language].avgTime}</p>
                        <p className="text-3xl font-bold">{avgTime}s</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => handleRestart(false)} className="px-6 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700">{uiText[language].tryAgain}</button>
                    <button onClick={() => handleRestart(true)} className="px-6 py-3 bg-teal-600 font-semibold rounded-lg hover:bg-teal-700">{uiText[language].newExam}</button>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (stage) {
            case 'upload':
                return renderUploadStage();
            case 'parsing':
                return renderLoadingStage(parsingStatus);
            case 'configuring':
                return renderConfiguringStage();
            case 'generating':
                return renderLoadingStage(uiText[language].generatingExam);
            case 'active':
                return renderActiveStage();
            case 'feedback':
                return renderFeedbackStage();
            case 'results':
                return renderResultsStage();
            default:
                return renderUploadStage();
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-900/50 relative">
            {error && (
                <div className="absolute top-4 right-4 z-10 w-full max-w-sm">
                    <Notification message={error} type="error" onClose={() => setError(null)} />
                </div>
            )}
            {renderContent()}
        </div>
    );
};