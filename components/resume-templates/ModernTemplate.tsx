import React from 'react';
import { ResumeData } from '../../types';

interface TemplateProps {
    data: ResumeData;
}

const Section: React.FC<{ title: string; children: React.ReactNode; show?: boolean }> = ({ title, children, show = true }) => {
    if (!show) return null;
    return (
        <section className="mb-4">
            <h2 className="text-[11pt] font-bold text-teal-600 uppercase tracking-widest mb-2">{title}</h2>
            {children}
        </section>
    );
};

export const ModernTemplate: React.FC<TemplateProps> = ({ data }) => {
    return (
        <div className="bg-white text-slate-800 p-10 font-lato text-[10pt] leading-normal">
            <header className="mb-6 pb-2 text-center">
                <h1 className="text-[28pt] font-light tracking-wider uppercase text-slate-800">{data.personalInfo.fullName || "Your Name"}</h1>
                <p className="text-[9pt] text-slate-600 mt-1 tracking-wider">
                    {data.personalInfo.address}
                    {data.personalInfo.phone && `  •  ${data.personalInfo.phone}`}
                    {data.personalInfo.email && `  •  ${data.personalInfo.email}`}
                </p>
            </header>

            <main>
                <Section title="Education" show={data.education.some(e => e.degree)}>
                    {data.education.map(edu => edu.degree && (
                        <div key={edu.id} className="mb-2">
                            <div className="flex justify-between items-baseline">
                                <p className="font-bold text-slate-900">{edu.degree}</p>
                                <p className="text-[9pt] font-semibold text-slate-600">{edu.years}</p>
                            </div>
                            <p className="text-slate-700">{edu.institute}</p>
                        </div>
                    ))}
                </Section>
                
                <Section title="Experience" show={data.experience.some(e => e.role)}>
                    {data.experience.map(exp => exp.role && (
                        <div key={exp.id} className="mb-3 break-inside-avoid">
                            <div className="flex justify-between items-baseline">
                                <p className="font-bold text-slate-900">{exp.role}</p>
                                <p className="text-[9pt] font-semibold text-slate-600">{exp.dates}</p>
                            </div>
                            <p className="font-semibold text-slate-700 mb-1">{exp.company}</p>
                            <ul className="list-disc list-outside ml-4 text-slate-700 space-y-1">
                                {exp.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </Section>

                <Section title="Projects" show={data.projects.some(p => p.title)}>
                    {data.projects.map(proj => proj.title && (
                        <div key={proj.id} className="mb-3 break-inside-avoid">
                            <p className="font-bold text-slate-900">{proj.title}</p>
                            <p className="text-[8pt] font-bold text-teal-700 my-1 uppercase">Technologies: {proj.technologies}</p>
                            <ul className="list-disc list-outside ml-4 text-slate-700 space-y-1">
                                {proj.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </Section>

                <Section title="Skills" show={!!data.skills}>
                    <div className="flex flex-wrap gap-2">
                        {data.skills.split(',').map(skill => skill.trim() && (
                            <span key={skill} className="bg-slate-200 text-slate-800 text-[9pt] font-semibold px-2.5 py-0.5 rounded-full">{skill.trim()}</span>
                        ))}
                    </div>
                </Section>

                <div className="grid grid-cols-2 gap-x-8">
                    <Section title="Achievements" show={!!data.achievements}>
                        <p className="text-sm">{data.achievements}</p>
                    </Section>
                    <Section title="Languages" show={!!data.languages}>
                        <p className="text-sm">{data.languages}</p>
                    </Section>
                </div>
                
                <Section title="Extracurricular Activities" show={!!data.extracurricular}>
                    <p className="text-sm">{data.extracurricular}</p>
                </Section>
            </main>
        </div>
    );
};