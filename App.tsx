
import React, { useState, useMemo, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { StudyNotesGenerator } from './components/StudyNotesGenerator';
import { VocabularyBuilder } from './components/VocabularyBuilder';
import { GroupStudy } from './components/GroupStudy';
import { ExamPracticeMode } from './components/ExamPracticeMode';
import { Whiteboard } from './components/Whiteboard';
import { EssayFeedback } from './components/EssayFeedback';
import { RoadmapGenerator } from './components/RoadmapGenerator';
import { ImageToNotesConverter } from './components/ImageToNotesConverter';
import { StorytellingTeacher } from './components/StorytellingTeacher';
import { SmartQuizGenerator } from './components/SmartQuizGenerator';
import { TranslationMode } from './components/TranslationMode';
import { StudyFitnessCoach } from './components/StudyFitnessCoach';
import { CodeTutor } from './components/CodeTutor';
import { PastPaperAnalyzer } from './components/PastPaperAnalyzer';
import { VideoAnalyzer } from './components/VideoAnalyzer';
import { AudioTranscriber } from './components/AudioTranscriber';
import { ResumeBuilder } from './components/ResumeBuilder';
import { Language } from './types';
import { LogoutIcon, SpinnerIcon } from './components/icons';

type View = 'chat' | 'notes' | 'vocabulary' | 'group' | 'exam' | 'whiteboard' | 'feedback' | 'roadmap' | 'imageToNotes' | 'story' | 'quiz' | 'translation' | 'fitness' | 'codetutor' | 'paperAnalyzer' | 'video' | 'transcriber' | 'resume';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('chat');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('app_language') as Language) || Language.EN);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('app_language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === Language.UR ? 'rtl' : 'ltr';
  }, [language]);
  
  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const uiText = useMemo(() => ({
    [Language.EN]: {
      nav_chatbot: "Chatbot",
      nav_notes: "Study Notes",
      nav_vocab: "My Vocabulary",
      nav_group: "Group Study",
      nav_exam: "Exam Practice",
      nav_quiz: "Smart Quiz",
      nav_whiteboard: "Whiteboard",
      nav_feedback: "Essay Feedback",
      nav_roadmap: "Exam Roadmap",
      nav_image_notes: "Image-to-Notes",
      nav_story: "Story Teacher",
      nav_translation: "Translator",
      nav_fitness: "Fitness Coach",
      nav_codetutor: "Code Tutor",
      nav_paper_analyzer: "Paper Analyzer",
      nav_video: "Video Analyzer",
      nav_transcriber: "Audio Transcriber",
      nav_resume: "Resume Builder",
      footer: "Bilingual EduBot © 2024. All rights reserved.",
      signOut: "Sign Out",
    },
    [Language.UR]: {
      nav_chatbot: "چیٹ بوٹ",
      nav_notes: "اسٹڈی نوٹس",
      nav_vocab: "میری ذخیرہ الفاظ",
      nav_group: "گروپ اسٹڈی",
      nav_exam: "امتحان کی مشق",
      nav_quiz: "سمارٹ کوئز",
      nav_whiteboard: "وائٹ بورڈ",
      nav_feedback: "مضمون کی رائے",
      nav_roadmap: "امتحانی روڈ میپ",
      nav_image_notes: "تصویر سے نوٹس",
      nav_story: "کہانی گو استاد",
      nav_translation: "مترجم",
      nav_fitness: "فٹنس کوچ",
      nav_codetutor: "کوڈ ٹیوٹر",
      nav_paper_analyzer: "پرچہ تجزیہ کار",
      nav_video: "ویڈیو تجزیہ کار",
      nav_transcriber: "آڈیو ٹرانسکرائبر",
      nav_resume: "ریزیومے بلڈر",
      footer: "دو لسانی ایجو بوٹ © 2024۔ جملہ حقوق محفوظ ہیں۔",
      signOut: "سائن آؤٹ",
    }
  }), [language]);

  const handleSwitchLanguage = () => {
    setLanguage(prev => (prev === Language.EN ? Language.UR : Language.EN));
  };

  const NavButton: React.FC<{ view: View; label: string }> = ({ view, label }) => (
    <button
      onClick={() => setActiveView(view)}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${language === Language.UR ? 'font-urdu' : 'font-sans'} ${
        activeView === view
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
    >
      {label}
    </button>
  );
  
  const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';

  if (authLoading) {
    return (
      <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <SpinnerIcon className="w-12 h-12" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col items-center p-2 sm:p-4 gap-4 ${languageFontClass}`}>
      <header className="w-full max-w-7xl flex items-center justify-between p-2 bg-gray-800/50 border border-gray-700 rounded-full">
         <nav className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center overflow-x-auto">
            {/* Reordered for better UX flow */}
            <NavButton view="chat" label={uiText[language].nav_chatbot} />
            <NavButton view="notes" label={uiText[language].nav_notes} />
            <NavButton view="exam" label={uiText[language].nav_exam} />
            <NavButton view="paperAnalyzer" label={uiText[language].nav_paper_analyzer} />
            <NavButton view="feedback" label={uiText[language].nav_feedback} />
            <NavButton view="codetutor" label={uiText[language].nav_codetutor} />
            <NavButton view="video" label={uiText[language].nav_video} />
            <NavButton view="transcriber" label={uiText[language].nav_transcriber} />
            <NavButton view="imageToNotes" label={uiText[language].nav_image_notes} />
            <NavButton view="quiz" label={uiText[language].nav_quiz} />
            <NavButton view="roadmap" label={uiText[language].nav_roadmap} />
            <NavButton view="vocabulary" label={uiText[language].nav_vocab} />
            <NavButton view="resume" label={uiText[language].nav_resume} />
            <NavButton view="story" label={uiText[language].nav_story} />
            <NavButton view="translation" label={uiText[language].nav_translation} />
            <NavButton view="fitness" label={uiText[language].nav_fitness} />
            <NavButton view="whiteboard" label={uiText[language].nav_whiteboard} />
            <NavButton view="group" label={uiText[language].nav_group} />
          </nav>
          <div className="flex items-center shrink-0 mx-2 gap-2">
            <button onClick={handleSwitchLanguage} className="px-3 py-1.5 text-sm font-semibold border border-gray-600 rounded-full hover:bg-gray-700 transition-colors">
                {language === Language.EN ? 'اردو' : 'English'}
            </button>
            <button onClick={handleSignOut} title={uiText[language].signOut} className="p-2 text-gray-300 rounded-full hover:bg-red-800/50 hover:text-white transition-colors">
                <LogoutIcon className="w-5 h-5"/>
            </button>
          </div>
      </header>
      
      <main className="w-full max-w-7xl flex-1 flex flex-col bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 min-h-0">
        {activeView === 'chat' && <Chat language={language} user={user} />}
        {activeView === 'video' && <VideoAnalyzer language={language} />}
        {activeView === 'transcriber' && <AudioTranscriber language={language} />}
        {activeView === 'story' && <StorytellingTeacher language={language} />}
        {activeView === 'translation' && <TranslationMode language={language} />}
        {activeView === 'notes' && <StudyNotesGenerator language={language} user={user} />}
        {activeView === 'vocabulary' && <VocabularyBuilder language={language} user={user} />}
        {activeView === 'resume' && <ResumeBuilder language={language} />}
        {activeView === 'group' && <GroupStudy user={user}/>}
        {activeView === 'exam' && <ExamPracticeMode language={language} />}
        {activeView === 'quiz' && <SmartQuizGenerator language={language} />}
        {activeView === 'whiteboard' && <Whiteboard />}
        {activeView === 'feedback' && <EssayFeedback language={language} />}
        {activeView === 'roadmap' && <RoadmapGenerator language={language} />}
        {activeView === 'imageToNotes' && <ImageToNotesConverter language={language} />}
        {activeView === 'fitness' && <StudyFitnessCoach language={language} />}
        {activeView === 'codetutor' && <CodeTutor language={language} />}
        {activeView === 'paperAnalyzer' && <PastPaperAnalyzer language={language} />}
      </main>

      <footer className="text-center text-gray-500 text-xs">
        <p>{uiText[language].footer}</p>
      </footer>
    </div>
  );
};

export default App;
