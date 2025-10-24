import React from 'react';
import { ResumeData } from '../../types';

interface TemplateProps {
    data: ResumeData;
}

const Section: React.FC<{ title: string; children: React.ReactNode; show?: boolean }> = ({ title, children, show = true }) => {
    if (!show) return null;
    return (
        <section className="mb-4">
            <h2 className="text-[11pt] font-bold uppercase tracking-widest border-b border-gray-400 pb-1 mb-3">{title}</h2>
            {children}
        </section>
    );
};

export const MinimalTemplate: React.FC<TemplateProps> = ({ data }) => {
    return (
        <div className="bg-white text-gray-800 p-12 font-merriweather text-[10pt] leading-relaxed">
            <header className="text-center mb-8">
                <h1 className="text-[26pt] font-bold tracking-normal">{data.personalInfo.fullName || "Your Name"}</h1>
                <p className="text-[9pt] mt-2 tracking-widest">
                    {data.personalInfo.address}
                    {data.personalInfo.phone && ` | ${data.personalInfo.phone}`}
                    {data.personalInfo.email && ` | ${data.personalInfo.email}`}
                </p>
            </header>

            <main>
                <Section title="Education" show={data.education.some(e => e.degree)}>
                    {data.education.map(edu => edu.degree && (
                        <div key={edu.id} className="mb-3">
                            <div className="flex justify-between">
                                <p className="font-bold text-gray-900">{edu.degree}</p>
                                <p className="font-bold text-gray-900">{edu.years}</p>
                            </div>
                            <p className="italic">{edu.institute}</p>
                        </div>
                    ))}
                </Section>

                <Section title="Skills" show={!!data.skills}>
                    <p>{data.skills}</p>
                </Section>

                <Section title="Experience" show={data.experience.some(e => e.role)}>
                    {data.experience.map(exp => exp.role && (
                        <div key={exp.id} className="mb-4">
                            <div className="flex justify-between">
                                <p className="font-bold text-gray-900">{exp.role}</p>
                                <p className="font-bold text-gray-900">{exp.dates}</p>
                            </div>
                            <p className="italic mb-1">{exp.company}</p>
                            <ul className="list-disc list-outside ml-4 text-gray-700 space-y-1">
                                {exp.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </Section>

                <Section title="Projects" show={data.projects.some(p => p.title)}>
                    {data.projects.map(proj => proj.title && (
                        <div key={proj.id} className="mb-4">
                            <p className="font-bold text-gray-900">{proj.title}</p>
                            <p className="text-[9pt] italic text-gray-600 mb-1">Technologies: {proj.technologies}</p>
                            <ul className="list-disc list-outside ml-4 text-gray-700 space-y-1">
                                {proj.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i}>{line.replace(/^- /, '')}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </Section>
                
                <div className="grid grid-cols-2 gap-x-12">
                    <Section title="Achievements" show={!!data.achievements}>
                        <p>{data.achievements}</p>
                    </Section>
                    <Section title="Languages" show={!!data.languages}>
                        <p>{data.languages}</p>
                    </Section>
                </div>

                <Section title="Extracurricular Activities" show={!!data.extracurricular}>
                    <p>{data.extracurricular}</p>
                </Section>
            </main>
        </div>
    );
};