
import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Language } from '../types';
import { Notification } from './Notification';
import { ArrowPathIcon, ClipboardCopyIcon, ExportIcon, SpinnerIcon } from './icons';

// Declare html2pdf from CDN
declare const html2pdf: any;

interface TranslationModeProps {
    language: Language; // UI language
}

type TranslationStyle = 'academic' | 'casual';

export const TranslationMode: React.FC<TranslationModeProps> = ({ language: uiLanguage }) => {
    const [sourceText, setSourceText] = useState<string>('');
    const [translatedText, setTranslatedText] = useState<string>('');
    const [sourceLang, setSourceLang] = useState<Language>(Language.EN);
    const [targetLang, setTargetLang] = useState<Language>(Language.UR);
    const [style, setStyle] = useState<TranslationStyle>('academic');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "Translator",
            academic: "Academic",
            casual: "Casual",
            translate: "Translate",
            translating: "Translating...",
            sourcePlaceholder: "Enter text to translate...",
            targetPlaceholder: "Translation will appear here.",
            swap: "Swap Languages",
            copy: "Copy Translation",
            copied: "Translation copied to clipboard!",
            exportPdf: "Export as PDF",
            inputError: "Please enter some text to translate.",
            apiError: "The AI failed to translate the text. Please try again.",
            originalText: "Original Text",
            translatedText: "Translated Text",
        },
        [Language.UR]: {
            title: "مترجم",
            academic: "تعلیمی",
            casual: "عام",
            translate: "ترجمہ کریں",
            translating: "ترجمہ کیا جا رہا ہے...",
            sourcePlaceholder: "ترجمہ کے لیے متن درج کریں...",
            targetPlaceholder: "ترجمہ یہاں ظاہر ہوگا",
            swap: "زبانیں تبدیل کریں",
            copy: "ترجمہ کاپی کریں",
            copied: "ترجمہ کلپ بورڈ پر کاپی ہو گیا!",
            exportPdf: "پی ڈی ایف کے طور پر برآمد کریں",
            inputError: "براہ کرم ترجمہ کرنے کے لیے کچھ متن درج کریں۔",
            apiError: "AI متن کا ترجمہ کرنے میں ناکام رہا۔ براہ کرم دوبارہ کوشش کریں۔",
            originalText: "اصل متن",
            translatedText: "ترجمہ شدہ متن",
        }
    }), []);
    
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 7000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const handleTranslate = async () => {
        if (!sourceText.trim()) {
            setError(uiText[uiLanguage].inputError);
            return;
        }
        setIsLoading(true);
        setError(null);
        setTranslatedText('');

        try {
            const sourceLangName = sourceLang === Language.EN ? 'English' : 'Urdu';
            const targetLangName = targetLang === Language.EN ? 'English' : 'Urdu';
            
            const styleInstruction = style === 'academic' 
                ? "The tone of the translation must be strictly academic. Use formal language, precise terminology, and maintain a neutral, objective tone suitable for scholarly or educational contexts."
                : "The tone of the translation must be casual and informal. Use everyday language, common expressions, and a friendly, conversational tone.";

            const prompt = `You are an expert translator. Your task is to translate the following text from ${sourceLangName} to ${targetLangName}.
- ${styleInstruction}
- Provide ONLY the translated text, with no additional commentary, explanations, or introductory phrases.
- Preserve the original meaning and context accurately.

Text to translate:
"""
${sourceText}
"""`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            setTranslatedText(response.text);
        } catch (e) {
            console.error("Translation error:", e);
            setError(uiText[uiLanguage].apiError);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSwapLanguages = () => {
        setSourceLang(targetLang);
        setTargetLang(sourceLang);
        setSourceText(translatedText);
        setTranslatedText(sourceText);
    };

    const handleCopy = () => {
        if (!translatedText) return;
        navigator.clipboard.writeText(translatedText);
        setNotification(uiText[uiLanguage].copied);
    };

    const handleExportPdf = () => {
        if (!sourceText || !translatedText) return;

        const isSourceUrdu = sourceLang === Language.UR;
        const isTargetUrdu = targetLang === Language.UR;
        const isUiUrdu = uiLanguage === Language.UR;

        const pdfStyles = `
          .pdf-container { padding: 25px; font-family: 'Inter', sans-serif; color: #111827; line-height: 1.6; background-color: white; }
          h1, h2 { font-family: 'Inter', sans-serif; color: #111827; }
          h1 { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 25px; }
          h2 { font-size: 1.25rem; margin-top: 20px; border-bottom: 1px solid #d1d5db; padding-bottom: 5px; }
          p { margin-bottom: 1rem; text-align: justify; white-space: pre-wrap; }
          .urdu-text, .urdu-text h1, .urdu-text h2, .urdu-text p { font-family: 'Noto Nastaliq Urdu', serif !important; direction: rtl; text-align: right; }
        `;

        const contentHtml = `
          <div class="${isUiUrdu ? 'urdu-text' : ''}">
            <h1>${uiText[uiLanguage].title}</h1>
            <h2>${uiText[uiLanguage].originalText} (${sourceLang.toUpperCase()})</h2>
            <p class="${isSourceUrdu ? 'urdu-text' : ''}">${sourceText.replace(/\n/g, '<br/>')}</p>
            <h2>${uiText[uiLanguage].translatedText} (${targetLang.toUpperCase()})</h2>
            <p class="${isTargetUrdu ? 'urdu-text' : ''}">${translatedText.replace(/\n/g, '<br/>')}</p>
          </div>
        `;

        const fullHtml = `
          <html>
            <head>
              <meta charset="UTF-8">
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
              <style>${pdfStyles}</style>
            </head>
            <body>
              <div class="pdf-container">${contentHtml}</div>
            </body>
          </html>
        `;

        const element = document.createElement('div');
        element.innerHTML = fullHtml;
        document.body.appendChild(element);

        const opt = {
          margin: 0.5,
          filename: 'translation.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(element);
        });
    };

    const languageFontClass = uiLanguage === Language.UR ? 'font-urdu' : 'font-sans';

    return (
        <div className={`flex flex-col h-full ${languageFontClass}`}>
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[uiLanguage].title}</h1>
            </header>
            
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 p-1 bg-gray-800 rounded-full">
                        <button 
                            onClick={() => setStyle('academic')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${style === 'academic' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                        >
                            {uiText[uiLanguage].academic}
                        </button>
                        <button 
                            onClick={() => setStyle('casual')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${style === 'casual' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                        >
                            {uiText[uiLanguage].casual}
                        </button>
                    </div>
                </div>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 min-h-[300px]">
                    <div className="flex flex-col">
                        <label className="mb-1 text-sm font-semibold text-gray-400">{sourceLang === 'en' ? 'English' : 'اردو'}</label>
                        <textarea 
                            value={sourceText}
                            onChange={e => setSourceText(e.target.value)}
                            placeholder={uiText[uiLanguage].sourcePlaceholder}
                            className={`w-full flex-1 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${sourceLang === 'ur' ? 'font-urdu text-right' : 'font-sans'}`}
                            dir={sourceLang === 'ur' ? 'rtl' : 'ltr'}
                        />
                    </div>
                    
                    <div className="flex items-center justify-center">
                         <button 
                            onClick={handleSwapLanguages} 
                            title={uiText[uiLanguage].swap}
                            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col">
                         <label className="mb-1 text-sm font-semibold text-gray-400">{targetLang === 'en' ? 'English' : 'اردو'}</label>
                        <textarea 
                            value={translatedText}
                            readOnly
                            placeholder={uiText[uiLanguage].targetPlaceholder}
                            className={`w-full flex-1 p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none ${targetLang === 'ur' ? 'font-urdu text-right' : 'font-sans'}`}
                            dir={targetLang === 'ur' ? 'rtl' : 'ltr'}
                        />
                    </div>
                </div>
                
                 {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                 {notification && <Notification message={notification} type="success" onClose={() => setNotification(null)} />}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div className="flex items-center justify-end gap-2 order-1 sm:order-2">
                        <button onClick={handleCopy} disabled={!translatedText} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50 transition-colors">
                           <ClipboardCopyIcon/> {uiText[uiLanguage].copy}
                        </button>
                        <button onClick={handleExportPdf} disabled={!translatedText} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors">
                           <ExportIcon/> {uiText[uiLanguage].exportPdf}
                        </button>
                    </div>
                    <button 
                        onClick={handleTranslate} 
                        disabled={isLoading || !sourceText.trim()}
                        className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 transition-colors flex items-center justify-center gap-2 order-2 sm:order-1"
                    >
                        {isLoading && <SpinnerIcon />}
                        {isLoading ? uiText[uiLanguage].translating : uiText[uiLanguage].translate}
                    </button>
                </div>
            </div>
        </div>
    );
};
