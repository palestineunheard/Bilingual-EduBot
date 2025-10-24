import React, { useState, useMemo, useEffect } from 'react';
import { GenerateContentResponse, Type } from '@google/genai';
import { Language, Roadmap } from '../types';
import { Notification } from './Notification';
import { UploadIcon, ExportIcon, SpinnerIcon } from './icons';

declare const pdfjsLib: any;
declare const Tesseract: any;
declare const html2pdf: any;

type Stage = 'input' | 'parsing' | 'generating' | 'results';

interface RoadmapGeneratorProps {
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

export const RoadmapGenerator: React.FC<RoadmapGeneratorProps> = ({ language }) => {
    const [stage, setStage] = useState<Stage>('input');
    const [syllabusText, setSyllabusText] = useState<string>('');
    const [parsingStatus, setParsingStatus] = useState<string>('');
    
    const [numDays, setNumDays] = useState<number>(14);
    const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
    
    const [error, setError] = useState<string | null>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Exam Prep Roadmap Generator",
            subtitle: "Provide your syllabus by uploading a file or pasting text. The AI will generate a custom daily study plan.",
            uploadFile: "Upload Syllabus",
            supportedFiles: "Supports: .txt, .pdf, .png, .jpg",
            pastePlaceholder: "Or paste your syllabus here...",
            usePastedText: "Use Pasted Text",
            pasteError: "Please paste some content first.",
            numDays: "Study duration (days): {days}",
            generateRoadmap: "Generate Roadmap",
            startOver: "Start Over",
            exportPdf: "Export as PDF",
            generating: "Generating your roadmap...",
            readingText: "Reading text file...",
            parsingPDF: "Parsing PDF document...",
            readingPDFPage: "Reading PDF page {current} of {total}...",
            initOCR: "Initializing OCR engine...",
            recognizingText: "Recognizing text... {progress}%",
            unsupportedFile: "Unsupported file type. Please use .txt, .pdf, or image files.",
            fileProcessError: "Failed to process the file.",
            emptySyllabusError: "Syllabus is empty. Please provide content.",
            generationFail: "Failed to generate roadmap. The AI might be busy or the syllabus was unsuitable. Please try again with more detailed content.",
            day: "Day",
            learningGoals: "Learning Goals",
            motivationalTip: "Motivational Tip",
        },
        [Language.UR]: {
            title: "امتحانی تیاری کا روڈ میپ جنریٹر",
            subtitle: "فائل اپ لوڈ کرکے یا متن پیسٹ کرکے اپنا نصاب فراہم کریں۔ AI ایک حسب ضرورت روزانہ مطالعہ کا منصوبہ تیار کرے گا۔",
            uploadFile: "نصاب اپ لوڈ کریں",
            supportedFiles: "سپورٹ کرتا ہے: .txt, .pdf, .png, .jpg",
            pastePlaceholder: "یا اپنا نصاب یہاں پیسٹ کریں...",
            usePastedText: "پیسٹ شدہ متن استعمال کریں",
            pasteError: "براہ کرم پہلے کچھ مواد پیسٹ کریں۔",
            numDays: "مطالعہ کی مدت (دن): {days}",
            generateRoadmap: "روڈ میپ بنائیں",
            startOver: "دوبارہ شروع کریں",
            exportPdf: "پی ڈی ایف کے طور پر برآمد کریں",
            generating: "آپ کا روڈ میپ تیار کیا جا رہا ہے...",
            readingText: "ٹیکسٹ فائل پڑھ رہا ہے...",
            parsingPDF: "پی ڈی ایف دستاویز کو پارس کر رہا ہے...",
            readingPDFPage: "پی ڈی ایف صفحہ {current} از {total} پڑھ رہا ہے...",
            initOCR: "OCR انجن شروع کر رہا ہے...",
            recognizingText: "متن کی شناخت... {progress}%",
            unsupportedFile: "غیر تعاون یافتہ فائل کی قسم۔ براہ کرم .txt، .pdf، یا تصویری فائلیں استعمال کریں۔",
            fileProcessError: "فائل پر کارروائی کرنے میں ناکام۔",
            emptySyllabusError: "نصاب خالی ہے۔ براہ کرم مواد فراہم کریں۔",
            generationFail: "روڈ میپ بنانے میں ناکام۔ AI مصروف ہو سکتا ہے یا نصاب غیر موزوں تھا۔ براہ کرم مزید تفصیلی مواد کے ساتھ دوبارہ کوشش کریں۔",
            day: "دن",
            learningGoals: "سیکھنے کے اہداف",
            motivationalTip: "حوصلہ افزا ٹپ",
        }
    }), [language]);

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
                setSyllabusText(text);
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
                setSyllabusText(textContent);
            } else if (file.type.startsWith('image/')) {
                setParsingStatus(uiText[language].initOCR);
                const worker = await Tesseract.createWorker({
                    logger: (m: any) => {
                        if (m.status === 'recognizing text') {
                           setParsingStatus(uiText[language].recognizingText.replace('{progress}', Math.round(m.progress * 100).toString()));
                        }
                    },
                });
                const selectedLang = language === 'en' ? 'eng' : 'urd';
                await worker.loadLanguage(selectedLang);
                await worker.initialize(selectedLang);
                const { data: { text } } = await worker.recognize(file);
                await worker.terminate();
                setSyllabusText(text);
            } else {
                throw new Error(uiText[language].unsupportedFile);
            }
            setStage('input');
        } catch (err: any) {
            console.error('File parsing error:', err);
            setError(err.message || uiText[language].fileProcessError);
            setStage('input');
        } finally {
            setParsingStatus('');
            if (e.target) e.target.value = '';
        }
    };

    const handleGenerateRoadmap = async () => {
        if (!syllabusText.trim()) {
            setError(uiText[language].emptySyllabusError);
            return;
        }
        setStage('generating');
        setError(null);
        setRoadmap(null);
        
        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: `A suitable title for the study plan in ${language === 'en' ? 'English' : 'Urdu'}.` },
                    days: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                day: { type: Type.NUMBER },
                                goals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of topics or chapters to cover for the day." },
                                motivation: { type: Type.STRING, description: `A short, encouraging message in ${language === 'en' ? 'English' : 'Urdu'}.` }
                            },
                            required: ['day', 'goals', 'motivation']
                        }
                    }
                },
                required: ['title', 'days']
            };

            const response = await generateContent({
                model: 'gemini-2.5-pro',
                contents: `Analyze the provided syllabus and create a structured, realistic study plan for ${numDays} days.
- The plan should logically divide all topics from the syllabus across the ${numDays} days.
- Include periodic review days (e.g., every 5-7 days) to reinforce learning.
- For each day, provide a list of specific learning 'goals' (topics to study).
- For each day, provide a unique, short, and encouraging 'motivation' tip that also includes a practical study tip (e.g., 'Use the Pomodoro Technique today to stay focused!').
- The entire plan, including title, goals, and motivation, must be in ${language === 'en' ? 'English' : 'Urdu'}.
- Your entire response must be a single, valid JSON object conforming to the schema.

SYLLABUS:
"""
${syllabusText}
"""`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });

            const roadmapData: Roadmap = JSON.parse(response.text);
            if (!roadmapData.days || roadmapData.days.length === 0) {
                throw new Error("AI did not return a valid plan.");
            }
            setRoadmap(roadmapData);
            setStage('results');

        } catch (err: any) {
            console.error('Roadmap generation error:', err);
            setError(uiText[language].generationFail);
            setStage('input');
        }
    };
    
    const handleExportPdf = () => {
        if (!roadmap) return;
        const isUrdu = language === Language.UR;

        const pdfStyles = `
          .pdf-container { padding: 25px; font-family: 'Inter', sans-serif; color: #111827; line-height: 1.6; background-color: white; }
          h1 { text-align: center; font-family: 'Inter', sans-serif; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 25px; }
          .day-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; background-color: #f9fafb; }
          .day-header { font-family: 'Inter', sans-serif; font-size: 1.5rem; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
          h3 { font-family: 'Inter', sans-serif; font-size: 1.1rem; font-weight: bold; color: #111827; margin-top: 10px; margin-bottom: 5px; }
          ul { list-style-position: inside; padding-left: 5px; }
          li { margin-bottom: 4px; }
          .motivation { margin-top: 15px; padding-top: 10px; border-top: 1px dashed #d1d5db; font-style: italic; color: #059669; }
          .urdu-text, .urdu-text h1, .urdu-text h2, .urdu-text h3, .urdu-text li, .urdu-text p { font-family: 'Noto Nastaliq Urdu', serif !important; direction: rtl; text-align: right; }
          .urdu-text ul { padding-left: 0; padding-right: 20px; }
        `;

        const daysHtml = roadmap.days.map(day => `
            <div class="day-card">
                <h2 class="day-header">${uiText[language].day} ${day.day}</h2>
                <h3>${uiText[language].learningGoals}</h3>
                <ul>${day.goals.map(goal => `<li>${goal}</li>`).join('')}</ul>
                <div class="motivation">
                    <h3>${uiText[language].motivationalTip}</h3>
                    <p>${day.motivation}</p>
                </div>
            </div>
        `).join('');

        const fullHtml = `
          <html>
            <head>
              <meta charset="UTF-8">
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
              <style>${pdfStyles}</style>
            </head>
            <body>
              <div class="pdf-container ${isUrdu ? 'urdu-text' : ''}">
                <h1>${roadmap.title}</h1>
                ${daysHtml}
              </div>
            </body>
          </html>
        `;

        const element = document.createElement('div');
        element.innerHTML = fullHtml;
        document.body.appendChild(element);

        const opt = {
          margin: 0.5,
          filename: 'Exam-Roadmap.pdf',
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
        setSyllabusText('');
        setRoadmap(null);
        setError(null);
    };

    const renderInputStage = () => (
        <div className="flex flex-col h-full">
             <header className="p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <p className="text-sm text-gray-400">{uiText[language].subtitle}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center text-center">
                        <UploadIcon className="w-10 h-10 text-gray-500 mb-4" />
                        <label htmlFor="file-upload" className="w-full max-w-xs cursor-pointer px-4 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            {uiText[language].uploadFile}
                        </label>
                        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".txt,.pdf,.png,.jpg,.jpeg" />
                        <p className="text-xs text-gray-500 mt-3">{uiText[language].supportedFiles}</p>
                    </div>
                    <textarea 
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[180px] lg:min-h-full"
                        placeholder={uiText[language].pastePlaceholder}
                        value={syllabusText}
                        onChange={(e) => setSyllabusText(e.target.value)}
                    />
                </div>
                 <div>
                    <label htmlFor="num-days" className="block text-lg font-semibold mb-2">{uiText[language].numDays.replace('{days}', numDays.toString())}</label>
                    <input 
                        type="range" id="num-days" min="3" max="30" step="1" value={numDays}
                        onChange={(e) => setNumDays(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
                <button
                    onClick={handleGenerateRoadmap}
                    className="w-full px-4 py-3 text-lg bg-green-600 font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-500 flex items-center justify-center gap-2"
                    disabled={!syllabusText.trim()}
                >
                    {stage === 'generating' ? <><SpinnerIcon /> {uiText[language].generating}</> : uiText[language].generateRoadmap}
                </button>
            </div>
        </div>
    );

    const renderLoadingStage = (message: string) => (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <SpinnerIcon className="w-12 h-12 mb-4" />
            <h2 className="text-xl font-semibold">{message}</h2>
        </div>
    );
    
    const renderResultsStage = () => (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{roadmap?.title || uiText[language].title}</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handleStartOver} className="px-4 py-2 text-sm bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">{uiText[language].startOver}</button>
                    <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                        <ExportIcon className="w-4 h-4" />
                        {uiText[language].exportPdf}
                    </button>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-4">
                {roadmap?.days.map(day => (
                    <div key={day.day} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 animate-fade-in">
                        <h2 className="text-2xl font-bold text-teal-300 mb-3">{uiText[language].day} {day.day}</h2>
                        <h3 className="text-lg font-semibold mb-2">{uiText[language].learningGoals}</h3>
                        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-300">
                            {day.goals.map((goal, i) => <li key={i}>{goal}</li>)}
                        </ul>
                        <div className="mt-4 pt-3 border-t border-gray-700/50">
                             <h3 className="text-lg font-semibold mb-1 text-amber-300">{uiText[language].motivationalTip}</h3>
                             <p className="text-gray-400 italic">"{day.motivation}"</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderContent = () => {
        switch (stage) {
            case 'input':
                return renderInputStage();
            case 'parsing':
                return renderLoadingStage(parsingStatus);
            case 'generating':
                return renderLoadingStage(uiText[language].generating);
            case 'results':
                return renderResultsStage();
            default:
                return renderInputStage();
        }
    };
    
    return (
        <div className={`flex flex-col h-full bg-gray-900/50 relative ${language === Language.UR ? 'font-urdu' : 'font-sans'}`} dir={language === Language.UR ? 'rtl' : 'ltr'}>
             {error && (
                <div className="absolute top-4 right-4 z-10 w-full max-w-sm">
                    <Notification message={error} type="error" onClose={() => setError(null)} />
                </div>
            )}
            {renderContent()}
        </div>
    );
};
