import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
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

export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({ language }) => {
    const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
    const [template, setTemplate] = useState<TemplateStyle>('modern');
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [parsingStatus, setParsingStatus] = useState('');
    const [aiFeedback, setAiFeedback] = useState<string[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);
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
            const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
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
            const response = await ai.models.generateContent({
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
        <h3 className="text-lg font-semibold text-teal-300 border-b border-gray-700 pb-2 mb-4">{title}</h3>
    );

    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            <header className="flex items-center justify-between p-3 bg-gray-900/50 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-3">
                    <BriefcaseIcon className="w-6 h-6 text-teal-400" />
                    <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                </div>
                <button onClick={exportToPdf} disabled={isDownloading} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed min-w-[160px]">
                    {isDownloading ? (
                        <>
                            <SpinnerIcon className="w-5 h-5" />
                            <span>Generating...</span>
                        </>
                    ) : (
                        <>
                            <DownloadIcon className="w-5 h-5" />
                            <span>Download PDF</span>
                        </>
                    )}
                </button>
            </header>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 p-4 min-h-0">
                {/* Form Panel */}
                <div className="overflow-y-auto pr-2 flex flex-col gap-6 bg-gray-800/50 p-4 rounded-lg border border-gray-700 lg:col-span-3">
                    {/* Personal Info */}
                    <div>
                        {renderSectionHeader("Personal Information")}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <input type="text" placeholder="Full Name" value={resumeData.personalInfo.fullName} onChange={e => handleInputChange('personalInfo', e.target.value, undefined, 'fullName')} className={inputStyleClasses} />
                            <input type="email" placeholder="Email Address" value={resumeData.personalInfo.email} onChange={e => handleInputChange('personalInfo', e.target.value, undefined, 'email')} className={inputStyleClasses} />
                            <input type="tel" placeholder="Phone Number" value={resumeData.personalInfo.phone} onChange={e => handleInputChange('personalInfo', e.target.value, undefined, 'phone')} className={inputStyleClasses} />
                            <input type="text" placeholder="City, Country" value={resumeData.personalInfo.address} onChange={e => handleInputChange('personalInfo', e.target.value, undefined, 'address')} className={inputStyleClasses} />
                        </div>
                    </div>

                    {/* Education */}
                    <div>
                        {renderSectionHeader("Education")}
                        {resumeData.education.map((edu, index) => (
                            <div key={edu.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 border border-gray-700 rounded-md relative">
                                <input type="text" placeholder="Degree (e.g., B.S. in Computer Science)" value={edu.degree} onChange={e => handleInputChange('education', e.target.value, index, 'degree')} className={`${inputStyleClasses} col-span-2`} />
                                <input type="text" placeholder="University/Institute Name" value={edu.institute} onChange={e => handleInputChange('education', e.target.value, index, 'institute')} className={inputStyleClasses} />
                                <input type="text" placeholder="Graduation Year (or Expected)" value={edu.years} onChange={e => handleInputChange('education', e.target.value, index, 'years')} className={inputStyleClasses} />
                                <button onClick={() => removeListItem('education', edu.id)} className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full text-white hover:bg-red-700"><XIcon /></button>
                            </div>
                        ))}
                        <button onClick={() => addListItem('education')} className={`${btnSecondaryClasses} text-sm w-full`}>+ Add Education</button>
                    </div>

                    {/* Experience */}
                    <div>
                        {renderSectionHeader("Work Experience / Internships")}
                        {resumeData.experience.map((exp, index) => (
                             <div key={exp.id} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 p-3 border border-gray-700 rounded-md relative">
                                <input type="text" placeholder="Job Title / Role" value={exp.role} onChange={e => handleInputChange('experience', e.target.value, index, 'role')} className={inputStyleClasses} />
                                <input type="text" placeholder="Company Name" value={exp.company} onChange={e => handleInputChange('experience', e.target.value, index, 'company')} className={inputStyleClasses} />
                                <input type="text" placeholder="Dates (e.g., Jun 2023 - Aug 2023)" value={exp.dates} onChange={e => handleInputChange('experience', e.target.value, index, 'dates')} className={`${inputStyleClasses} col-span-2`} />
                                <textarea placeholder="Describe your responsibilities and achievements..." value={exp.description} onChange={e => handleInputChange('experience', e.target.value, index, 'description')} className={`${inputStyleClasses} col-span-2 h-24`}></textarea>
                                <button onClick={() => improveDescription(exp.description, 'experience', index)} className={`${btnSecondaryClasses} text-sm flex items-center justify-center gap-2 col-span-2`}><SparklesIcon className="w-4 h-4" /> Improve with AI</button>
                                <button onClick={() => removeListItem('experience', exp.id)} className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full text-white hover:bg-red-700"><XIcon /></button>
                            </div>
                        ))}
                        <button onClick={() => addListItem('experience')} className={`${btnSecondaryClasses} text-sm w-full`}>+ Add Experience</button>
                    </div>
                    
                    {/* Projects */}
                    <div>
                        {renderSectionHeader("Projects")}
                        {resumeData.projects.map((proj, index) => (
                             <div key={proj.id} className="grid grid-cols-1 gap-4 mb-4 p-3 border border-gray-700 rounded-md relative">
                                <input type="text" placeholder="Project Title" value={proj.title} onChange={e => handleInputChange('projects', e.target.value, index, 'title')} className={inputStyleClasses} />
                                <input type="text" placeholder="Technologies Used (e.g., React, Python, Firebase)" value={proj.technologies} onChange={e => handleInputChange('projects', e.target.value, index, 'technologies')} className={inputStyleClasses} />
                                <textarea placeholder="Describe the project, your role, and what you achieved..." value={proj.description} onChange={e => handleInputChange('projects', e.target.value, index, 'description')} className={`${inputStyleClasses} h-24`}></textarea>
                                <button onClick={() => improveDescription(proj.description, 'projects', index)} className={`${btnSecondaryClasses} text-sm flex items-center justify-center gap-2`}><SparklesIcon className="w-4 h-4" /> Improve with AI</button>
                                <button onClick={() => removeListItem('projects', proj.id)} className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full text-white hover:bg-red-700"><XIcon /></button>
                            </div>
                        ))}
                        <button onClick={() => addListItem('projects')} className={`${btnSecondaryClasses} text-sm w-full`}>+ Add Project</button>
                    </div>
                    
                    {/* Skills */}
                    <div>
                        {renderSectionHeader("Skills")}
                        <textarea placeholder="List your technical and soft skills, separated by commas..." value={resumeData.skills} onChange={e => handleInputChange('skills', e.target.value)} className={`${inputStyleClasses} h-20`}></textarea>
                    </div>
                    
                    {/* Other Sections */}
                     <div>
                        {renderSectionHeader("Achievements, Languages & Activities")}
                         <div className="grid grid-cols-1 gap-4">
                             <textarea placeholder="List any awards, scholarships, or achievements..." value={resumeData.achievements} onChange={e => handleInputChange('achievements', e.target.value)} className={`${inputStyleClasses} h-16`}></textarea>
                             <input type="text" placeholder="Languages Spoken (e.g., English, Urdu)" value={resumeData.languages} onChange={e => handleInputChange('languages', e.target.value)} className={inputStyleClasses} />
                             <textarea placeholder="List any extracurricular activities or volunteer work..." value={resumeData.extracurricular} onChange={e => handleInputChange('extracurricular', e.target.value)} className={`${inputStyleClasses} h-16`}></textarea>
                         </div>
                    </div>

                </div>
                {/* Preview Panel */}
                <div className="flex flex-col gap-4 lg:col-span-1 min-h-0">
                    <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg border border-gray-700">
                         <div className="flex items-center gap-1 p-1 bg-gray-700 rounded-full">
                            <button onClick={() => setTemplate('modern')} className={`px-3 py-1 text-sm rounded-full ${template==='modern' ? 'bg-blue-600' : ''}`}>Modern</button>
                            <button onClick={() => setTemplate('minimal')} className={`px-3 py-1 text-sm rounded-full ${template==='minimal' ? 'bg-blue-600' : ''}`}>Minimal</button>
                            <button onClick={() => setTemplate('creative')} className={`px-3 py-1 text-sm rounded-full ${template==='creative' ? 'bg-blue-600' : ''}`}>Creative</button>
                        </div>
                        <button onClick={getAiFeedback} disabled={loadingState === 'feedback'} className={`${btnSecondaryClasses} flex items-center gap-2`}>
                             {loadingState === 'feedback' ? <SpinnerIcon className="w-4 h-4"/> : <SparklesIcon className="w-4 h-4" />}
                             Get AI Feedback
                        </button>
                    </div>
                    
                    {aiFeedback && (
                        <div className="bg-teal-900/50 border border-teal-700 p-4 rounded-lg animate-fade-in">
                            <h4 className="font-semibold mb-2 text-teal-300">AI Recommendations</h4>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                                {aiFeedback.map((item, i) => <li key={i}>{item}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="flex-1 bg-gray-500 p-4 rounded-lg overflow-auto min-h-0">
                        <div ref={resumePreviewRef} className="mx-auto shadow-lg" style={{ width: '210mm', minHeight: '297mm' }}>
                            <TemplateComponent data={resumeData} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};