import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { Language, VocabularyWord } from '../types';
import { ClearIcon, TrashIcon, ListBulletIcon, CardStackIcon, QuestionMarkCircleIcon, ExportIcon } from './icons';

type ViewMode = 'list' | 'flashcards' | 'quiz';

interface QuizState {
    questions: VocabularyWord[];
    currentIndex: number;
    score: number;
    choices: string[];
    selectedAnswer: string | null;
    isCorrect: boolean | null;
}

declare const html2pdf: any;

interface VocabularyBuilderProps {
  language: Language;
  user: User;
}

export const VocabularyBuilder: React.FC<VocabularyBuilderProps> = ({ language, user }) => {
    const [words, setWords] = useState<VocabularyWord[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    // Flashcard State
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    // Quiz State
    const [quizState, setQuizState] = useState<QuizState | null>(null);

    const uiText = useMemo(() => ({
        [Language.EN]: {
            title: "My Vocabulary",
            wordList: "Word List",
            flashcards: "Flashcards",
            quiz: "Quiz",
            exportPdf: "Export as PDF",
            clearAll: "Clear Vocabulary",
            noWords: "Your vocabulary list is empty. Go to the Chatbot, select a word in a response, and save it to get started!",
            word: "Word",
            meaning: "Meaning",
            translation: "Urdu Translation",
            example: "Example Sentence",
            flip: "Flip",
            next: "Next",
            previous: "Previous",
            startQuiz: "Start Quiz",
            quizIntro: "You need at least 4 words to start a quiz.",
            quizTitle: "Vocabulary Quiz",
            question: "Question",
            of: "of",
            score: "Score",
            submit: "Submit",
            nextQuestion: "Next Question",
            quizComplete: "Quiz Complete!",
            finalScore: "Your final score is",
            playAgain: "Play Again",
        },
        [Language.UR]: {
            title: "میری ذخیرہ الفاظ",
            wordList: "الفاظ کی فہرست",
            flashcards: "فلیش کارڈز",
            quiz: "کوئز",
            exportPdf: "پی ڈی ایف کے طور پر برآمد کریں",
            clearAll: "ذخیرہ الفاظ صاف کریں",
            noWords: "آپ کی ذخیرہ الفاظ کی فہرست خالی ہے۔ چیٹ بوٹ پر جائیں، جواب میں ایک لفظ منتخب کریں، اور شروع کرنے کے لیے اسے محفوظ کریں!",
            word: "لفظ",
            meaning: "معنی",
            translation: "اردو ترجمہ",
            example: "مثالی جملہ",
            flip: "پلٹائیں",
            next: "اگلا",
            previous: "پچھلا",
            startQuiz: "کوئز شروع کریں",
            quizIntro: "کوئز شروع کرنے کے لیے آپ کو کم از کم 4 الفاظ کی ضرورت ہے۔",
            quizTitle: "ذخیرہ الفاظ کوئز",
            question: "سوال",
            of: "از",
            score: "سکور",
            submit: "جمع کرائیں",
            nextQuestion: "اگلا سوال",
            quizComplete: "کوئز مکمل!",
            finalScore: "آپ کا حتمی سکور ہے",
            playAgain: "دوبارہ کھیلیں",
        }
    }), [language]);

    useEffect(() => {
        if (!user) return;
        const q = collection(db, 'users', user.uid, 'vocabulary');
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const savedWords: VocabularyWord[] = [];
            snapshot.forEach(doc => {
                savedWords.push({ id: doc.id, ...doc.data() } as VocabularyWord);
            });
            setWords(savedWords);
        });

        return () => unsubscribe();
    }, [user]);
    
    useEffect(() => {
        // Reset state when words change
        setCurrentCardIndex(0);
        setIsCardFlipped(false);
        setQuizState(null);
    }, [words]);

    const handleDeleteWord = async (id: string) => {
        if (!user) return;
        await deleteDoc(doc(db, 'users', user.uid, 'vocabulary', id));
    };

    const handleClearAll = () => {
        if (window.confirm("Are you sure you want to delete your entire vocabulary? This cannot be undone.")) {
            // This would require a batch delete function to be implemented
            console.warn("Bulk delete not implemented yet. Please delete words individually.");
        }
    };
    
    const handleExportPdf = () => {
        if (words.length === 0) return;

        const content = `
          <div style="padding: 20px; color: #333; font-family: 'Inter', sans-serif;">
            <h1 style="text-align: center; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; font-family: 'Inter', sans-serif;">Vocabulary List</h1>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-family: 'Inter', sans-serif;">Word</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-family: 'Inter', sans-serif;">Meaning</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: right; font-family: 'Noto Nastaliq Urdu', serif;">Urdu Translation</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-family: 'Inter', sans-serif;">Example Sentence</th>
                    </tr>
                </thead>
                <tbody>
                    ${words.map(word => `
                        <tr style="page-break-inside: avoid;">
                            <td style="border: 1px solid #ddd; padding: 8px;">${word.word}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;">${word.meaning}</td>
                            <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-family: 'Noto Nastaliq Urdu', serif;">${word.translation_ur}</td>
                            <td style="border: 1px solid #ddd; padding: 8px;"><em>${word.example_en}</em></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
          </div>
        `;

        const element = document.createElement('div');
        const fontLink = '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">';
        element.innerHTML = fontLink + content;
        document.body.appendChild(element);

        const opt = {
          margin: 0.5,
          filename: 'EduBot-Vocabulary.pdf',
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().from(element).set(opt).save().then(() => {
            document.body.removeChild(element);
        });
    };
    
    // Flashcard Logic
    const handleNextCard = () => {
        setIsCardFlipped(false);
        setCurrentCardIndex(prev => (prev + 1) % words.length);
    };
    const handlePrevCard = () => {
        setIsCardFlipped(false);
        setCurrentCardIndex(prev => (prev - 1 + words.length) % words.length);
    };

    // Quiz Logic
    const generateChoices = (correctWord: VocabularyWord, allWords: VocabularyWord[]) => {
        const choices = new Set<string>([correctWord.meaning]);
        const distractors = allWords.filter(w => w.id !== correctWord.id);
        while (choices.size < 4 && distractors.length > 0) {
            const randomIndex = Math.floor(Math.random() * distractors.length);
            choices.add(distractors.splice(randomIndex, 1)[0].meaning);
        }
        return Array.from(choices).sort(() => Math.random() - 0.5);
    };

    const startQuiz = () => {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        const firstQuestion = shuffled[0];
        setQuizState({
            questions: shuffled,
            currentIndex: 0,
            score: 0,
            choices: generateChoices(firstQuestion, words),
            selectedAnswer: null,
            isCorrect: null,
        });
        setViewMode('quiz');
    };
    
    const handleAnswerSubmit = () => {
        if (!quizState || quizState.selectedAnswer === null) return;
        const currentQuestion = quizState.questions[quizState.currentIndex];
        const correct = quizState.selectedAnswer === currentQuestion.meaning;
        setQuizState(prev => ({
            ...prev!,
            isCorrect: correct,
            score: correct ? prev!.score + 1 : prev!.score,
        }));
    };

    const handleNextQuestion = () => {
        if (!quizState) return;
        const nextIndex = quizState.currentIndex + 1;
        if (nextIndex < quizState.questions.length) {
            const nextQuestion = quizState.questions[nextIndex];
            setQuizState(prev => ({
                ...prev!,
                currentIndex: nextIndex,
                choices: generateChoices(nextQuestion, words),
                selectedAnswer: null,
                isCorrect: null,
            }));
        } else {
             // Quiz finished
        }
    };

    const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';
    
    const ViewButton: React.FC<{ mode: ViewMode, label: string, children: React.ReactNode }> = ({mode, label, children}) => (
        <button
            onClick={() => { setViewMode(mode); if(quizState) setQuizState(null); }}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}
        >
            {children} {label}
        </button>
    );

    const renderContent = () => {
        if (words.length === 0) {
            return <div className="flex-1 flex items-center justify-center text-center text-gray-400 p-4">{uiText[language].noWords}</div>
        }

        if(viewMode === 'list') {
            return (
                <div className="overflow-y-auto p-4 space-y-3">
                    {words.map(word => (
                        <div key={word.id} className="bg-gray-700 rounded-lg p-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xl font-bold text-teal-300">{word.word}</h3>
                                    <p className={`text-lg text-gray-400 ${languageFontClass}`} dir="rtl">{word.translation_ur}</p>
                                </div>
                                <button onClick={() => handleDeleteWord(word.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors"><TrashIcon /></button>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-600 space-y-1 text-sm">
                                <p><strong className="font-semibold text-gray-300">{uiText[language].meaning}:</strong> {word.meaning}</p>
                                <p><strong className="font-semibold text-gray-300">{uiText[language].example}:</strong> <em>"{word.example_en}"</em></p>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }
        
        if (viewMode === 'flashcards') {
            const currentWord = words[currentCardIndex];
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                    <div 
                        className="w-full max-w-md h-64 bg-gray-700 rounded-lg shadow-lg flex items-center justify-center p-6 cursor-pointer relative [transform-style:preserve-3d] transition-transform duration-500"
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                        style={{ transform: isCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}
                    >
                        {/* Front */}
                        <div className="absolute inset-0 flex items-center justify-center p-6 [backface-visibility:hidden]">
                            <h2 className="text-4xl font-bold text-center text-teal-300">{currentWord.word}</h2>
                        </div>
                        {/* Back */}
                        <div className="absolute inset-0 p-6 overflow-y-auto [backface-visibility:hidden] [transform:rotateY(180deg)]">
                             <p className={`text-lg text-right text-gray-400 w-full mb-2 ${languageFontClass}`} dir="rtl">{currentWord.translation_ur}</p>
                             <p className="text-sm"><strong className="font-semibold text-gray-300">{uiText[language].meaning}:</strong> {currentWord.meaning}</p>
                             <p className="text-sm mt-2"><strong className="font-semibold text-gray-300">{uiText[language].example}:</strong> <em>"{currentWord.example_en}"</em></p>
                        </div>
                    </div>
                    <div className="text-center text-gray-400 text-sm">{currentCardIndex + 1} / {words.length}</div>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrevCard} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">{uiText[language].previous}</button>
                        <button onClick={() => setIsCardFlipped(!isCardFlipped)} className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">{uiText[language].flip}</button>
                        <button onClick={handleNextCard} className="px-4 py-2 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors">{uiText[language].next}</button>
                    </div>
                </div>
            );
        }
        
        if(viewMode === 'quiz') {
            if (!quizState) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                        {words.length < 4 ? (
                            <p className="text-gray-400">{uiText[language].quizIntro}</p>
                        ) : (
                            <button onClick={startQuiz} className="px-6 py-3 text-lg bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">{uiText[language].startQuiz}</button>
                        )}
                    </div>
                );
            }
            
            if (quizState.currentIndex >= quizState.questions.length) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4 text-center">
                        <h2 className="text-3xl font-bold text-teal-300">{uiText[language].quizComplete}</h2>
                        <p className="text-lg">{uiText[language].finalScore}: {quizState.score} / {quizState.questions.length}</p>
                        <button onClick={startQuiz} className="px-6 py-3 mt-4 text-lg bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">{uiText[language].playAgain}</button>
                    </div>
                )
            }
            
            const currentQuestion = quizState.questions[quizState.currentIndex];
            return (
                 <div className="flex-1 flex flex-col items-center p-4 gap-4">
                    <div className="w-full max-w-2xl">
                        <div className="flex justify-between items-center text-gray-400 text-sm mb-2">
                           <span>{uiText[language].question} {quizState.currentIndex + 1} {uiText[language].of} {quizState.questions.length}</span>
                           <span>{uiText[language].score}: {quizState.score}</span>
                        </div>
                        <div className="bg-gray-700 rounded-lg p-6 text-center">
                             <p className="text-gray-300 mb-2">What is the meaning of:</p>
                             <h2 className="text-3xl font-bold text-teal-300">{currentQuestion.word}</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                            {quizState.choices.map((choice, i) => {
                                let bgColor = "bg-gray-600 hover:bg-gray-500";
                                if (quizState.isCorrect !== null) {
                                    if (choice === currentQuestion.meaning) {
                                        bgColor = "bg-green-600";
                                    } else if (choice === quizState.selectedAnswer) {
                                        bgColor = "bg-red-600";
                                    } else {
                                        bgColor = "bg-gray-600 opacity-50";
                                    }
                                } else if (choice === quizState.selectedAnswer) {
                                    bgColor = "bg-blue-500";
                                }
                                return (
                                    <button 
                                        key={i}
                                        onClick={() => setQuizState(prev => ({...prev!, selectedAnswer: choice}))}
                                        disabled={quizState.isCorrect !== null}
                                        className={`p-4 rounded-lg text-left transition-colors ${bgColor}`}
                                    >
                                        {choice}
                                    </button>
                                );
                            })}
                        </div>
                         <div className="mt-4 text-center">
                             {quizState.isCorrect === null ? (
                                <button onClick={handleAnswerSubmit} disabled={!quizState.selectedAnswer} className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed">{uiText[language].submit}</button>
                             ) : (
                                <button onClick={handleNextQuestion} className="px-6 py-2 bg-teal-600 rounded-lg hover:bg-teal-700">{uiText[language].nextQuestion}</button>
                             )}
                         </div>
                    </div>
                 </div>
            );
        }
    };

    return (
        <div className={`flex flex-col h-full ${languageFontClass} bg-gray-900/50`}>
            <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
                <h1 className="text-xl font-bold">{uiText[language].title}</h1>
                <div className="flex items-center gap-2">
                    {words.length > 0 && (
                        <>
                         <button onClick={handleExportPdf} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title={uiText[language].exportPdf}>
                            <ExportIcon className="w-5 h-5"/>
                        </button>
                         {/* <button onClick={handleClearAll} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title={uiText[language].clearAll}>
                            <TrashIcon className="w-5 h-5"/>
                        </button> */}
                        </>
                    )}
                </div>
            </header>
            
            <div className="p-4 border-b border-gray-700 shrink-0">
                <div className="flex items-center justify-center gap-2 bg-gray-800/60 p-1 rounded-lg">
                    <ViewButton mode="list" label={uiText[language].wordList}><ListBulletIcon className="w-5 h-5"/></ViewButton>
                    <ViewButton mode="flashcards" label={uiText[language].flashcards}><CardStackIcon className="w-5 h-5"/></ViewButton>
                    <ViewButton mode="quiz" label={uiText[language].quiz}><QuestionMarkCircleIcon className="w-5 h-5"/></ViewButton>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
                {renderContent()}
            </div>
        </div>
    );
};