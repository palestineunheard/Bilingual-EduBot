import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GenerateContentResponse, Type } from '@google/genai';
import { Language, ResumeData, ResumeEducation, ResumeExperience, ResumeProject } from '../types';
import { Notification } from './Notification';
import { BriefcaseIcon, UploadIcon, SpinnerIcon, SaveIcon, TrashIcon, SparklesIcon, XIcon, DownloadIcon } from './icons';
import { MinimalTemplate, ModernTemplate, CreativeTemplate } from './resume-templates';

// Declare Tesseract and html2pdf from CDN
declare const Tesseract: any;
declare const pdfjsLib: any;
declare const html2pdf: any;

interface ResumeBuilderProps {
    language: Language;
}

const initialResumeData: ResumeData = {
    personalInfo: { fullName: '', email: '', phone: '', address: '' },
    education: [{ id: crypto.randomUUID(), degree: '', institute: '', years: '' }],
    skills: '',
    experience: [],
    projects: [],
    achievements: '',
    languages: '',
    extracurricular: '',
};

type TemplateStyle = 'minimal' | 'modern' | 'creative';
type LoadingState = 'idle' | 'parsing' | 'improving' | 'feedback';

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

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ language }) => {
    const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
    const [template, setTemplate] = useState<TemplateStyle>('modern');
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [parsingStatus, setParsingStatus] = useState('');
    const [aiFeedback, setAiFeedback] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    const resumePreviewRef = useRef<HTMLDivElement>(null);
    
    const inputStyleClasses = "w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors placeholder-gray-400";
    const btnSecondaryClasses = "p-2 bg-gray-600 text-gray-200 rounded-md hover:bg-gray-500 transition-colors font-semibold";

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "AI Resume Builder",
            subtitle: "Fill in your details step-by-step, or upload a file, and let AI help you craft the perfect resume.",
            // ... (add more translations)
        },
        [Language.UR]: {
            title: "AI ریزیومے بلڈر",
            subtitle: "مرحلہ وار اپنی تفصیلات پر کریں، یا فائل اپ لوڈ کریں، اور AI کو بہترین ریزیومے بنانے میں آپ کی مدد کرنے دیں۔",
             // ... (add more translations)
        }
    }), [language]);

    // Handle all input changes
    const handleInputChange = (section: keyof ResumeData, value: any, index?: number, field?: string) => {
        setResumeData(prev => {
            if (Array.isArray(prev[section])) {
                const newArr = [...(prev[section] as any[])];
                newArr[index!] = { ...newArr[index!], [field!]: value };
                return { ...prev, [section]: newArr };
            } else if (typeof prev[section] === 'object') {
                return { ...prev, [section]: { ...(prev[section] as object), [field!]: value } };
            } else {
                return { ...prev, [section]: value };
            }
        });
    };

    // Add/remove items from lists (education, experience, etc.)
    const addListItem = (section: 'education' | 'experience' | 'projects') => {
        const newItem: ResumeEducation | ResumeExperience | ResumeProject =
            section === 'education' ? { id: crypto.randomUUID(), degree: '', institute: '', years: '' } :
            section === 'experience' ? { id: crypto.randomUUID(), role: '', company: '', dates: '', description: '' } :
            { id: crypto.randomUUID(), title: '', description: '', technologies: '' };
        
        setResumeData(prev => ({ ...prev, [section]: [...prev[section], newItem] }));
    };

    const removeListItem = (section: 'education' | 'experience' | 'projects', id: string) => {
        setResumeData(prev => ({
            ...prev,
            [section]: prev[section].filter(item => (item as any).id !== id)
        }));
    };
    
    // AI-powered text improvement for descriptions
    const improveDescription = async (text: string, section: 'experience' | 'projects', index: number) => {
        if (!text.trim()) return;
        setLoadingState('improving');
        try {
            const prompt = `Rewrite the following description for a student resume using strong action verbs. Convert sentences into concise, impactful bullet points. Focus on achievements and quantifiable results. Original text: "${text}"`;
            const response = await generateContent({ model: 'gemini-2.5-pro', contents: prompt });
            handleInputChange(section, response.text, index, 'description');
        } catch (e) {
            setError("AI could not improve the text. Please try again.");
        } finally {
            setLoadingState('idle');
        }
    };
    
    // Get overall AI feedback on the resume
    const getAiFeedback = async () => {
        setLoadingState('feedback');
        setAiFeedback(null);
        try {
            const prompt = `Analyze the following student resume data and provide 3-5 actionable recommendations for improvement. Focus on strengthening bullet points, adding measurable results, and tailoring content for student opportunities like internships. Respond with a list of suggestions. Resume data: ${JSON.stringify(resumeData)}`;
            const response = await generateContent({
                model: 'gemini-2.5-pro', contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: { suggestions: { type: Type.ARRAY, items: { type: Type.STRING } } },
                        required: ['suggestions']
                    }
                }
            });
            const result = JSON.parse(response.text);
            setAiFeedback(result.suggestions || []);
        } catch (e) {
            setError("Failed to get AI feedback. Please try again.");
        } finally {
            setLoadingState('idle');
        }
    };

    // Export to PDF
    const exportToPdf = () => {
        const element = resumePreviewRef.current;
        if (!element || isDownloading) return;

        setIsDownloading(true);
        setError(null);
        
        const originalShadow = element.style.boxShadow;
        element.style.boxShadow = 'none';

        const opt = {
            margin: 0,
            filename: `${(resumeData.personalInfo.fullName || 'student').replace(/\s+/g, '_')}-resume.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 3, // High scale for better font rendering and sharpness
                useCORS: true,
                letterRendering: true,
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().from(element).set(opt).save().then(() => {
            setIsDownloading(false);
            element.style.boxShadow = originalShadow;
        }).catch((err: any) => {
            console.error("PDF export failed:", err);
            setError("Sorry, there was an error exporting the PDF. Please try again.");
            setIsDownloading(false);
            element.style.boxShadow = originalShadow;
        });
    };

    const TemplateComponent = useMemo(() => {
        switch (template) {
            case 'minimal': return MinimalTemplate;
            case 'creative': return CreativeTemplate;
            case 'modern':
            default:
                return ModernTemplate;
        }
    }, [template]);

    const renderSectionHeader = (title: string) => (
        <h3 className="text-lg font-semibold text-teal-300 border-b border-gray