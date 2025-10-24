import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { GenerateContentResponse } from '@google/genai';
import { Language } from '../types';
import { UploadIcon, ArrowPathIcon, DocumentTextIcon, SpinnerIcon, BoldIcon, ItalicIcon, UnderlineIcon } from './icons';
import { Notification } from './Notification';

// Declare html2pdf and marked from CDN
declare const html2pdf: any;
declare const marked: any;

type Stage = 'idle' | 'analyzing' | 'done';

interface ImageToNotesConverterProps {
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

export const ImageToNotesConverter: React.FC<ImageToNotesConverterProps> = ({ language }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [generatedNotes, setGeneratedNotes] = useState<string>('');
    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);
    const dropzoneRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Image-to-Notes Converter",
            subtitle: "Upload a photo of whiteboard or handwritten notes, and the AI will convert it into clean, typed notes.",
            dropzone: "Drag & drop an image here, or click to select a file",
            changeImage: "Change Image",
            analyzing: "Analyzing Image & Generating Notes...",
            process: "Convert to Notes",
            exportPdf: "Export as PDF",
            exportDocx: "Export as DOCX",
            notesHeader: "Generated Notes",
            notesPlaceholder: "Your converted notes will appear here.",
            errorFile: "Invalid file type. Please upload an image.",
            errorAi: "AI failed to process the image. Please try again with a clearer image.",
        },
        [Language.UR]: {
            title: "تصویر سے نوٹس کنورٹر",
            subtitle: "وائٹ بورڈ یا ہاتھ سے لکھے ہوئے نوٹس کی تصویر اپ لوڈ کریں، اور AI اسے صاف، ٹائپ شدہ نوٹس میں تبدیل کر دے گا۔",
            dropzone: "یہاں ایک تصویر گھسیٹیں اور چھوڑیں، یا فائل منتخب کرنے کے لیے کلک کریں۔",
            changeImage: "تصویر تبدیل کریں",
            analyzing: "تصویر کا تجزیہ اور نوٹس تیار کرنا...",
            process: "نوٹس میں تبدیل کریں",
            exportPdf: "پی ڈی ایف کے طور پر برآمد کریں",
            exportDocx: "ڈاکس کے طور پر برآمد کریں",
            notesHeader: "تیار شدہ نوٹس",
            notesPlaceholder: "آپ کے تبدیل شدہ نوٹس یہاں ظاہر ہوں گے۔",
            errorFile: "غلط فائل کی قسم۔ براہ کرم ایک تصویر اپ لوڈ کریں۔",
            errorAi: "AI تصویر پر کارروائی کرنے میں ناکام رہا۔ براہ کرم ایک صاف تصویر کے ساتھ دوبارہ کوشش کریں۔",
        }
    }), [language]);

    useEffect(() => {
        const editor = editorRef.current;
        if (stage === 'idle' && !imageFile && editor) {
            editor.innerHTML = `<p class="text-gray-500 pointer-events-none">${uiText[language].notesPlaceholder}</p>`;
        }
    }, [stage, imageFile, language, uiText]);

    const handleFileChange = (files: FileList | null) => {
        const file = files?.[0];
        if (file && file.type.startsWith('image/')) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setStage('idle');
            setGeneratedNotes('');
            setError(null);
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        } else {
            setError(uiText[language].errorFile);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneRef.current?.classList.add('border-blue-500', 'bg-gray-700/50');
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneRef.current?.classList.remove('border-blue-500', 'bg-gray-700/50');
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneRef.current?.classList.remove('border-blue-500', 'bg-gray-700/50');
        handleFileChange(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReset = () => {
        setImageFile(null);
        setImagePreview(null);
        setGeneratedNotes('');
        if(editorRef.current) {
             editorRef.current.innerHTML = `<p class="text-gray-500 pointer-events-none">${uiText[language].notesPlaceholder}</p>`;
        }
        setStage('idle');
        setError(null);
    };

    const processImage = async () => {
        if (!imageFile) return;

        setStage('analyzing');
        setError(null);
        setGeneratedNotes('');
        if (editorRef.current) editorRef.current.innerHTML = '';

        try {
            const base64Data = await blobToBase64(imageFile);
            
            const prompt = `Transcribe the text from this image of handwritten or whiteboard notes. 
- Correct any spelling mistakes.
- Organize the content logically with clear headings (using Markdown #), subheadings (##), and bullet points (- or *). 
- Format it as clean, easy-to-read study notes.
- After the notes, add a section called "Potential Questions" (### Potential Questions) and list 3-4 insightful questions a student might ask about this material to deepen their understanding.
- If the text is in Urdu, ensure the entire response is also in Urdu with correct formatting.`;
            
            const response = await generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType: imageFile.type, data: base64Data } },
                        { text: prompt }
                    ]
                }
            });
            
            const cleanedNotes = response.text;
            if (!cleanedNotes) {
                throw new Error("The AI returned an empty response.");
            }
            
            setGeneratedNotes(cleanedNotes);
            if (editorRef.current) {
                editorRef.current.innerHTML = marked.parse(cleanedNotes);
            }
            setStage('done');
        } catch (e: any) {
            console.error("AI Error:", e);
            setError(e.message || uiText[language].errorAi);
            setStage('idle');
        }
    };
    
    const applyFormat = (command: string) => {
        if (stage === 'done') {
            document.execCommand(command, false);
            editorRef.current?.focus();
        }
    };
    
    const handleExportPdf = () => {
        if (!editorRef.current?.innerHTML) return;
        const element = document.createElement('div');
        const isUrdu = /[\u0600-\u06FF]/.test(editorRef.current.innerText);
        const contentHtml = editorRef.current.innerHTML;
        element.innerHTML = `<div style="padding: 20px; font-family: 'Inter', sans-serif; ${isUrdu ? "font-family: 'Noto Nastaliq Urdu', serif; direction: rtl;" : ""}" id="pdf-content">${contentHtml}</div>`;
        document.body.appendChild(element);
        const opt = {
          margin: 1,
          filename: 'image-notes.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(element);
        });
    };
    
    const handleExportDocx = () => {
        if (!editorRef.current?.innerHTML) return;
        const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Image Notes</title></head><body>`;
        const footer = "</body></html>";
        const htmlContent = editorRef.current.innerHTML;
        const sourceHTML = header + htmlContent + footer;
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'image-notes.docx';
        fileDownload.click();
        document.body.removeChild(fileDownload);
    };

    const isProcessing = stage === 'analyzing';
    
    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            <header className="p-4 bg-gray-900/50 border-b border-gray-700 shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <p className="text-sm text-gray-400">{uiText[language].subtitle}</p>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                <div className="flex flex-col gap-4">
                    {!imagePreview ? (
                        <div 
                            ref={dropzoneRef}
                            className="flex-1 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-center p-6 transition-all"
                            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        >
                            <input type="file" id="imageUpload" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e.target.files)} />
                            <label htmlFor="imageUpload" className="cursor-pointer">
                                <UploadIcon className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                                <p className="text-gray-400">{uiText[language].dropzone}</p>
                            </label>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                             <div className="flex-1 relative mb-4 rounded-md overflow-hidden">
                                <img src={imagePreview} alt="Notes preview" className="w-full h-full object-contain" />
                            </div>
                            <button onClick={handleReset} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-600 font-semibold rounded-lg hover:bg-gray-500 transition-colors">
                                <ArrowPathIcon className="w-5 h-5" /> {uiText[language].changeImage}
                            </button>
                        </div>
                    )}
                     <button
                        onClick={processImage}
                        disabled={!imageFile || isProcessing}
                        className="w-full px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors text-lg flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (<><SpinnerIcon /> {uiText[language].analyzing}</>) : (uiText[language].process)}
                    </button>
                    {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                </div>

                 <div className="flex flex-col bg-gray-800/50 p-4 rounded-lg border border-gray-700 min-h-[40vh] lg:min-h-0">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-lg font-bold">{uiText[language].notesHeader}</h2>
                        <div className={`flex items-center gap-1 p-1 bg-gray-700/60 border border-gray-600/50 rounded-md ${stage !== 'done' ? 'opacity-50' : ''}`}>
                            <button onClick={() => applyFormat('bold')} disabled={stage !== 'done'} title="Bold" className="p-2 rounded hover:bg-gray-600 disabled:cursor-not-allowed"><BoldIcon className="w-5 h-5" /></button>
                            <button onClick={() => applyFormat('italic')} disabled={stage !== 'done'} title="Italic" className="p-2 rounded hover:bg-gray-600 disabled:cursor-not-allowed"><ItalicIcon className="w-5 h-5" /></button>
                            <button onClick={() => applyFormat('underline')} disabled={stage !== 'done'} title="Underline" className="p-2 rounded hover:bg-gray-600 disabled:cursor-not-allowed"><UnderlineIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                     <div
                        ref={editorRef}
                        contentEditable={stage === 'done'}
                        suppressContentEditableWarning={true}
                        className={`prose prose-sm prose-invert max-w-none w-full flex-1 p-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y overflow-y-auto ${language === Language.UR ? 'font-urdu text-right' : 'font-sans'} ${stage !== 'done' ? 'cursor-not-allowed' : ''}`}
                        dir={language === Language.UR ? 'rtl' : 'ltr'}
                        role="textbox"
                        aria-multiline="true"
                    >
                    </div>
                     <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700 mt-4 shrink-0">
                        <button onClick={handleExportPdf} disabled={!generatedNotes} className="flex items-center gap-2 px-4 py-2 bg-red-700 font-semibold rounded-lg hover:bg-red-800 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                            <DocumentTextIcon /> PDF
                        </button>
                        <button onClick={handleExportDocx} disabled={!generatedNotes} className="flex items-center gap-2 px-4 py-2 bg-sky-700 font-semibold rounded-lg hover:bg-sky-800 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">
                             <DocumentTextIcon /> DOCX
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
};
