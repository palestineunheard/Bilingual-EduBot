import React, { useState, useMemo, useCallback, useRef } from 'react';
import { GenerateContentResponse, Type } from '@google/genai';
import { Language, AnalysisResult } from '../types';
import { Notification } from './Notification';
import { UploadIcon, ArrowPathIcon, SpinnerIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, ExportIcon, XIcon } from './icons';

// Declare external libraries from CDN
declare const pdfjsLib: any;
declare const html2pdf: any;

interface PastPaperAnalyzerProps {
    language: Language;
}

type Stage = 'idle' | 'parsing' | 'analyzing' | 'results';
interface ParsingProgress {
    file: string;
    status: string;
    progress?: number;
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

export const PastPaperAnalyzer: React.FC<PastPaperAnalyzerProps> = ({ language }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [stage, setStage] = useState<Stage>('idle');
    const [parsingProgress, setParsingProgress] = useState<ParsingProgress | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const dropzoneRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "AI Past Paper Analyzer",
            subtitle: "Upload multiple past exam papers. The AI will identify key topics, recurring patterns, and suggest a focused revision strategy.",
            dropzone: "Drag & drop files here, or click to select",
            supportedFiles: "Supports: PDF, PNG, JPG, TXT",
            analyze: "Analyze Papers",
            analyzing: "Analyzing...",
            parsing: "Processing Files...",
            startOver: "Analyze New Papers",
            exportPdf: "Export Analysis",
            analysisReport: "Analysis Report",
            keyTopics: "Key Topics & Weightage",
            commonPatterns: "Common Question Patterns",
            repeatedQuestions: "Frequently Repeated Questions",
            revisionStrategy: "Suggested Revision Strategy",
            errorNoFiles: "Please upload at least one file.",
            errorFileProcess: "An error occurred while processing a file.",
            errorAnalysis: "The AI could not analyze the provided documents. They might be unclear or too short.",
        },
        [Language.UR]: {
            title: "AI ماضی کے پرچوں کا تجزیہ کار",
            subtitle: "ماضی کے متعدد امتحانی پرچے اپ لوڈ کریں۔ AI کلیدی موضوعات، بار بار آنے والے نمونوں کی نشاندہی کرے گا، اور ایک مرکوز نظرثانی کی حکمت عملی تجویز کرے گا۔",
            dropzone: "فائلیں یہاں گھسیٹیں اور چھوڑیں، یا منتخب کرنے کے لیے کلک کریں",
            supportedFiles: "سپورٹ کرتا ہے: PDF, PNG, JPG, TXT",
            analyze: "پرچوں کا تجزیہ کریں",
            analyzing: "تجزیہ کیا جا رہا ہے...",
            parsing: "فائلوں پر کارروائی ہو رہی ہے...",
            startOver: "نئے پرچوں کا تجزیہ کریں",
            exportPdf: "تجزیہ برآمد کریں",
            analysisReport: "تجزیاتی رپورٹ",
            keyTopics: "کلیدی موضوعات اور وزن",
            commonPatterns: "عام سوالات کے نمونے",
            repeatedQuestions: "اکثر دہرائے جانے والے سوالات",
            revisionStrategy: "تجویز کردہ نظرثانی کی حکمت عملی",
            errorNoFiles: "براہ کرم کم از کم ایک فائل اپ لوڈ کریں۔",
            errorFileProcess: "فائل پر کارروائی کے دوران ایک خرابی پیش آئی۔",
            errorAnalysis: "AI فراہم کردہ دستاویزات کا تجزیہ نہیں کر سکا۔ وہ غیر واضح یا بہت مختصر ہو سکتی ہیں۔",
        }
    }), [language]);

    const handleFileChange = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;
        const validFiles = Array.from(selectedFiles).filter(file => 
            ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'].includes(file.type)
        );
        setFiles(prev => [...prev, ...validFiles]);
    };

    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropzoneRef.current?.classList.add('border-blue-500', 'bg-gray-700/50'); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropzoneRef.current?.classList.remove('border-blue-500', 'bg-gray-700/50'); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); dropzoneRef.current?.classList.remove('border-blue-500', 'bg-gray-700/50'); handleFileChange(e.dataTransfer.files); }, []);

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
    };

    const handleReset = () => {
        setFiles([]);
        setStage('idle');
        setAnalysisResult(null);
        setError(null);
    };

    const extractTextFromFile = async (file: File): Promise<string> => {
        setParsingProgress({ file: file.name, status: `Starting...` });
        if (file.type === 'text/plain') {
            setParsingProgress({ file: file.name, status: `Reading text file...` });
            return await file.text();
        } else if (file.type === 'application/pdf') {
            const data = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(data).promise;
            let textContent = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                setParsingProgress({ file: file.name, status: `Reading PDF page ${i}/${pdf.numPages}` });
                const page = await pdf.getPage(i);
                const text = await page.getTextContent();
                textContent += text.items.map((item: any) => item.str).join(' ');
            }
            return textContent;
        } else if (file.type.startsWith('image/')) {
            setParsingProgress({ file: file.name, status: `Extracting text from image...` });
            const base64Data = await blobToBase64(file);
            const response = await generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: file.type, data: base64Data } },
                        { text: "Extract all text from this image of an exam paper." }
                    ]
                }
            });
            return response.text;
        }
        return '';
    };

    const handleAnalyze = async () => {
        if (files.length === 0) {
            setError(uiText[language].errorNoFiles);
            return;
        }
        setStage('parsing');
        setError(null);
        let allText = '';
        try {
            for (const file of files) {
                const text = await extractTextFromFile(file);
                allText += text + '\n\n--- END OF DOCUMENT ---\n\n';
            }
        } catch (e) {
            console.error(e);
            setError(uiText[language].errorFileProcess);
            setStage('idle');
            return;
        }
        setParsingProgress(null);
        setStage('analyzing');
        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    keyTopics: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { topic: { type: Type.STRING }, weightage: { type: Type.NUMBER }, summary: { type: Type.STRING } },
                            required: ['topic', 'weightage', 'summary']
                        }
                    },
                    commonPatterns: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: { pattern: { type: Type.STRING }, description: { type: Type.STRING }, examples: { type: Type.ARRAY, items: { type: Type.STRING } } },
                            required: ['pattern', 'description', 'examples']
                        }
                    },
                    repeatedQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    revisionStrategy: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['keyTopics', 'commonPatterns', 'repeatedQuestions', 'revisionStrategy']
            };
            const langName = language === Language.EN ? 'English' : 'Urdu';
            const prompt = `You are an expert exam analyst. Analyze the combined text from multiple past exam papers provided below. The analysis must be in ${langName}.
Your tasks are:
1.  **Identify Key Topics**: Determine the main topics covered. For each topic, provide a percentage 'weightage' representing its frequency/importance, and a brief 'summary'.
2.  **Find Common Question Patterns**: Identify recurring types of questions (e.g., "Define the term...", "Compare and contrast...", "Solve the following problem..."). For each pattern, provide a 'description' and a few 'examples' from the text.
3.  **List Repeated Questions**: Extract specific questions that appear frequently, possibly with minor variations.
4.  **Suggest a Revision Strategy**: Based on your analysis, provide a prioritized, actionable, step-by-step list of recommendations for a student preparing for this exam. The strategy should be a numbered list, starting with the highest-priority topics.

Your entire response must be a single, valid JSON object conforming to the schema.

Combined Text from Papers:
"""
${allText}
"""`;

            const response = await generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema,
                    thinkingConfig: { thinkingBudget: 32768 }
                }
            });
            const result: AnalysisResult = JSON.parse(response.text);
            setAnalysisResult(result);
            setStage('results');
        } catch (e) {
            console.error(e);
            setError(uiText[language].errorAnalysis);
            setStage('idle');
        }
    };

    const handleExport = () => {
        if (!analysisResult) return;

        const reportElement = document.getElementById('analysis-report-content');
        if (!reportElement) return;

        const isUrdu = language === Language.UR;
        
        const opt = {
          margin: 0.5,
          filename: 'Past_Paper_Analysis.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
              scale: 2,
              useCORS: true,
              letterRendering: true,
              onclone: (document: Document) => {
                  const content = document.getElementById('analysis-report-content');
                  if (content) {
                      content.classList.add('pdf-export');
                      if (isUrdu) content.classList.add('urdu-text');
                  }
              }
          },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        const tempStyle = document.createElement('style');
        tempStyle.innerHTML = `
        .pdf-export { color: #111827; background-color: white; font-family: 'Inter', sans-serif; }
        .pdf-export h1, .pdf-export h2, .pdf-export h3 { font-family: 'Inter', sans-serif; color: #111827; }
        .pdf-export .urdu-text, .pdf-export .urdu-text h1, .pdf-export .urdu-text h2, .pdf-export .urdu-text h3, .pdf-export .urdu-text li, .pdf-export .urdu-text p { font-family: 'Noto Nastaliq Urdu', serif !important; direction: rtl; text-align: right; }
        .pdf-export .urdu-text ul { padding-left: 0; padding-right: 20px; }
        `;
        document.head.appendChild(tempStyle);

        html2pdf().from(reportElement).set(opt).save().then(() => {
            document.head.removeChild(tempStyle);
        });
    };
    
    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';

    const renderIdleStage = () => (
        <div className="flex flex-col h-full">
             <header className="p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <p className="text-sm text-gray-400">{uiText[language].subtitle}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
                <div
                    ref={dropzoneRef}
                    className="flex-1 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-6 transition-all min-h-[200px]"
                    onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFileChange(e.target.files)} accept=".pdf,.png,.jpg,.jpeg,.txt" />
                    <UploadIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">{uiText[language].dropzone}</p>
                    <p className="text-xs text-gray-500 mt-2">{uiText[language].supportedFiles}</p>
                </div>
                {files.length > 0 && (
                    <div className="space-y-2">
                        {files.map(file => (
                            <div key={file.name} className="flex items-center justify-between bg-gray-700 p-2 rounded-md text-sm">
                                <span>{file.name}</span>
                                <button onClick={() => removeFile(file.name)} className="p-1 text-gray-400 hover:text-red-400"><XIcon className="w-4 h-4"/></button>
                            </div>
                        ))}
                    </div>
                )}
                <button
                    onClick={handleAnalyze}
                    disabled={files.length === 0}
                    className="w-full px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-lg"
                >
                    {uiText[language].analyze}
                </button>
            </div>
        </div>
    );
    
    const renderLoadingStage = (message: string, progress?: ParsingProgress) => (
         <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <SpinnerIcon className="w-12 h-12 mb-4" />
            <h2 className="text-xl font-semibold">{message}</h2>
            {progress && (
                <div className="mt-4 w-full max-w-md text-left">
                    <p className="text-sm text-gray-400">{progress.file}</p>
                    <p className="text-sm text-gray-300">{progress.status} {progress.progress && `${progress.progress}%`}</p>
                </div>
            )}
        </div>
    );
    
    const renderResultsStage = () => (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].analysisReport}</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">
                       <ArrowPathIcon/> {uiText[language].startOver}
                    </button>
                    <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
                       <ExportIcon/> {uiText[language].exportPdf}
                    </button>
                </div>
            </header>
            <main id="analysis-report-content" className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                <section>
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-teal-300 mb-3"><ChartBarIcon/> {uiText[language].keyTopics}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {analysisResult?.keyTopics.map(topic => (
                            <div key={topic.topic} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-baseline mb-2">
                                    <h3 className="font-bold text-lg">{topic.topic}</h3>
                                    <span className="font-mono text-xl text-teal-400">{topic.weightage}%</span>
                                </div>
                                <p className="text-sm text-gray-400">{topic.summary}</p>
                            </div>
                        ))}
                    </div>
                </section>
                <section>
                    <h2 className="text-2xl font-bold text-teal-300 mb-3">{uiText[language].commonPatterns}</h2>
                    <div className="space-y-3">
                         {analysisResult?.commonPatterns.map(pattern => (
                             <details key={pattern.pattern} className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                 <summary className="font-semibold cursor-pointer">{pattern.pattern}</summary>
                                 <div className="pt-2 mt-2 border-t border-gray-700 text-sm">
                                     <p className="text-gray-400 mb-2">{pattern.description}</p>
                                     <ul className="list-disc list-inside text-gray-500 italic space-y-1">
                                         {pattern.examples.map((ex, i) => <li key={i}>"{ex}"</li>)}
                                     </ul>
                                 </div>
                             </details>
                         ))}
                    </div>
                </section>
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div>
                        <h2 className="text-2xl font-bold text-teal-300 mb-3">{uiText[language].repeatedQuestions}</h2>
                        <ul className="list-decimal list-inside space-y-2 text-gray-300 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            {analysisResult?.repeatedQuestions.map((q, i) => <li key={i}>{q}</li>)}
                        </ul>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-teal-300 mb-3">{uiText[language].revisionStrategy}</h2>
                        <ul className="list-decimal list-inside space-y-2 text-gray-300 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            {analysisResult?.revisionStrategy.map((step, i) => <li key={i}>{step}</li>)}
                        </ul>
                    </div>
                </section>
            </main>
        </div>
    );
    
    return (
        <div className={`flex flex-col h-full relative ${languageFontClass}`} dir={language === Language.UR ? 'rtl' : 'ltr'}>
            {error && <div className="absolute top-4 right-4 z-50"><Notification message={error} type="error" onClose={() => setError(null)} /></div>}
            {stage === 'idle' && renderIdleStage()}
            {stage === 'parsing' && renderLoadingStage(uiText[language].parsing, parsingProgress)}
            {stage === 'analyzing' && renderLoadingStage(uiText[language].analyzing)}
            {stage === 'results' && renderResultsStage()}
        </div>
    );
};
