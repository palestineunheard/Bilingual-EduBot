import React from 'react';
import { ResumeData } from '../../types';

interface TemplateProps {
    data: ResumeData;
}

const LeftSection: React.FC<{ title: string; children: React.ReactNode; show?: boolean }> = ({ title, children, show = true }) => {
    if (!show) return null;
    return (
        <section className="mb-5">
            <h2 className="text-[10pt] font-bold uppercase text-teal-300 tracking-widest mb-2">{title}</h2>
            <div className="text-[9.5pt] text-gray-200 font-light space-y-1">{children}</div>
        </section>
    );
};

const RightSection: React.FC<{ title: string; children: React.ReactNode; show?: boolean }> = ({ title, children, show = true }) => {
    if (!show) return null;
    return (
        <section className="mb-5">
            <h2 className="text-base font-semibold uppercase text-slate-700 tracking-widest pb-1 mb-3 border-b-2 border-slate-300">{title}</h2>
            {children}
        </section>
    );
};

export const CreativeTemplate: React.FC<TemplateProps> = ({ data }) => {
    return (
        <div className="flex font-garamond text-[10.5pt] leading-normal h-full">
            {/* Left Column */}
            <div style={{ width: '70mm' }} className="bg-slate-700 text-white p-8 flex flex-col shrink-0">
                <header className="text-center mb-8">
                     <h1 className="text-3xl font-bold tracking-wide">{data.personalInfo.fullName || "Your Name"}</h1>
                </header>

                <main>
                    <LeftSection title="Contact">
                        <p>{data.personalInfo.address}</p>
                        <p>{data.personalInfo.phone}</p>
                        <p className="break-words">{data.personalInfo.email}</p>
                    </LeftSection>

                    <LeftSection title="Education" show={data.education.some(e => e.degree)}>
                        {data.education.map(edu => edu.degree && (
                            <div key={edu.id} className="mb-3">
                                <p className="font-bold">{edu.degree}</p>
                                <p className="text-[9pt]">{edu.institute}</p>
                                <p className="text-[9pt] text-gray-400">{edu.years}</p>
                            </div>
                        ))}
                    </LeftSection>
                    
                    <LeftSection title="Skills" show={!!data.skills}>
                        <div className="flex flex-wrap gap-1.5">
                            {data.skills.split(',').map(skill => skill.trim() && (
                                <span key={skill} className="bg-slate-600 text-slate-100 text-[9pt] px-2 py-1 rounded">{skill.trim()}</span>
                            ))}
                        </div>
                    </LeftSection>
                    
                    <LeftSection title="Languages" show={!!data.languages}>
                        <p>{data.languages}</p>
                    </LeftSection>
                </main>
            </div>
            {/* Right Column */}
            <div className="flex-1 bg-white text-gray-700 p-8">
                <RightSection title="Experience" show={data.experience.some(e => e.role)}>
                    {data.experience.map(exp => exp.role && (
                        <div key={exp.id} className="mb-4 break-inside-avoid">
                            <div className="flex justify-between items-baseline">
                                <p className="font-bold text-base text-gray-900">{exp.role}</p>
                                <p className="text-sm font-medium">{exp.dates}</p>
                            </div>
                            <p className="text-sm font-semibold italic text-gray-600 mb-1">{exp.company}</p>
                            <ul className="list-disc list-outside ml-4 text-sm space-y-1">
                                {exp.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </RightSection>
                
                 <RightSection title="Projects" show={data.projects.some(p => p.title)}>
                     {data.projects.map(proj => proj.title && (
                        <div key={proj.id} className="mb-4 break-inside-avoid">
                            <p className="font-bold text-base text-gray-900">{proj.title}</p>
                            <p className="text-[9pt] font-semibold text-slate-500 my-1 uppercase">Technologies: {proj.technologies}</p>
                            <ul className="list-disc list-outside ml-4 text-sm space-y-1">
                                {proj.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </RightSection>

                <RightSection title="Achievements" show={!!data.achievements}>
                     <p className="text-sm">{data.achievements}</p>
                </RightSection>

                <RightSection title="Extracurricular Activities" show={!!data.extracurricular}>
                     <p className="text-sm">{data.extracurricular}</p>
                </RightSection>
            </div>
        </div>
    );
};