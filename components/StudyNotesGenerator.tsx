
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Language, Flashcard, MindMapData } from '../types';
import { ClearIcon, XIcon, SitemapIcon, ExportIcon, TrashIcon, SpinnerIcon } from './icons';
import MindMap from './MindMap';
import { Notification } from './Notification';

type LoadingState = 'idle' | 'generatingNotes' | 'generatingFlashcards' | 'generatingMindMap';
type ActiveTab = 'flashcards' | 'mindmap';

declare const html2pdf: any;
declare const marked: any;

interface SavedStudyMaterial {
  id: string;
  inputText: string;
  notes: string[];
  flashcards: Flashcard[];
  mindMapData: MindMapData | null;
  createdAt: any;
}

interface StudyNotesGeneratorProps {
  language: Language;
  user: User;
}

export const StudyNotesGenerator: React.FC<StudyNotesGeneratorProps> = ({ language, user }) => {
  const [inputText, setInputText] = useState<string>('');
  const [savedMaterials, setSavedMaterials] = useState<SavedStudyMaterial[]>([]);
  const [activeMaterial, setActiveMaterial] = useState<SavedStudyMaterial | null>(null);

  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [revealedFlashcards, setRevealedFlashcards] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>('flashcards');

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

  const uiText = useMemo(() => ({
    [Language.EN]: {
      title: "AI Study Notes Generator",
      placeholder: "Enter a topic or paste text to create structured study notes...",
      generateNotes: "Generate & Save Notes",
      generateFlashcards: "Create Flashcards",
      generateMindMap: "Visualize as Mind Map",
      exportPdf: "Export as PDF",
      notesHeader: "Study Notes",
      flashcardsHeader: "Flashcards",
      mindMapHeader: "Mind Map",
      clearAll: "Clear All",
      generating: "Generating...",
      showAnswer: "Show Answer",
      hideAnswer: "Hide Answer",
      apiError: "An error occurred while communicating with the AI. Please try again.",
      inputError: "Please enter some text to generate notes.",
      notesPlaceholder: "Your generated notes will appear here.",
      flashcardsPlaceholder: "Generate notes first, then create flashcards from them here.",
      mindmapPlaceholder: "Generate notes first, then visualize them as a mind map here.",
      savedNotes: "Saved Notes",
    },
    [Language.UR]: {
      title: "AI اسٹڈی نوٹس جنریٹر",
      placeholder: "ساختہ مطالعاتی نوٹ بنانے کے لیے کوئی موضوع درج کریں یا متن پیسٹ کریں...",
      generateNotes: "نوٹس بنائیں اور محفوظ کریں",
      generateFlashcards: "فلیش کارڈز بنائیں",
      generateMindMap: "مائنڈ میپ کے طور پر دیکھیں",
      exportPdf: "پی ڈی ایف کے طور پر برآمد کریں",
      notesHeader: "اسٹڈی نوٹس",
      flashcardsHeader: "فلیش کارڈز",
      mindMapHeader: "مائنڈ میپ",
      clearAll: "سب صاف کریں",
      generating: "بنا رہا ہے...",
      showAnswer: "جواب دکھائیں",
      hideAnswer: "جواب چھپائیں",
      apiError: "AI کے ساتھ بات چیت کے دوران ایک خرابی پیش آئی۔ براہ مہربانی دوبارہ کوشش کریں۔",
      inputError: "نوٹس بنانے کے لیے براہ کرم کچھ متن درج کریں۔",
      notesPlaceholder: "آپ کے بنائے گئے نوٹس یہاں ظاہر ہوں گے۔",
      flashcardsPlaceholder: "پہلے نوٹس بنائیں، پھر ان سے یہاں فلیش کارڈز بنائیں۔",
      mindmapPlaceholder: "پہلے نوٹس بنائیں، پھر انہیں یہاں مائنڈ میپ کے طور پر دیکھیں۔",
      savedNotes: "محفوظ شدہ نوٹس",
    }
  }), [language]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'studyMaterials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const materials: SavedStudyMaterial[] = [];
        snapshot.forEach(doc => {
            materials.push({ id: doc.id, ...doc.data() } as SavedStudyMaterial);
        });
        setSavedMaterials(materials);
    });
    return () => unsubscribe();
  }, [user]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleGenerateNotes = async () => {
    if (!inputText.trim()) {
      setError(uiText[language].inputError);
      return;
    }
    setLoadingState('generatingNotes');
    setError(null);
    setActiveMaterial(null);
    setRevealedFlashcards(new Set());

    try {
      const notesResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Act as an expert educator. From the following text, create detailed, well-structured study notes.
        - The notes MUST be in ${language === Language.EN ? 'English' : 'Urdu'}.
        - Use Markdown for clear formatting (headings, bold text for key terms, nested bullet points).
        - Start with a brief summary of the main concept.
        - Identify and list key concepts and their definitions.
        - Break down complex topics into simple, digestible points.
        Text: "${inputText}"`,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: { notes: { type: Type.ARRAY, items: { type: Type.STRING } } },
                required: ['notes']
            }
        }
      });
      
      const parsedNotes = JSON.parse(notesResponse.text);
      const newMaterial: Omit<SavedStudyMaterial, 'id'> = {
          inputText,
          notes: parsedNotes.notes || [],
          flashcards: [],
          mindMapData: null,
          createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'users', user.uid, 'studyMaterials'), newMaterial);
      setActiveMaterial({ ...newMaterial, id: docRef.id, createdAt: new Date() });

    } catch (e) {
      console.error("Error generating notes:", e);
      setError(uiText[language].apiError);
    } finally {
      setLoadingState('idle');
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!activeMaterial || activeMaterial.notes.length === 0) return;
    setLoadingState('generatingFlashcards');
    setError(null);
    
    const notesText = activeMaterial.notes.join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Based on these study notes, create question and answer pairs for flashcards. The questions should test key concepts from the notes. Respond in ${language === Language.EN ? 'English' : 'Urdu'}. Notes: "${notesText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcards: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] }}
            },
            required: ['flashcards']
          }
        }
      });
      const parsed = JSON.parse(response.text);
      const newFlashcards = parsed.flashcards || [];
      const updatedMaterial = { ...activeMaterial, flashcards: newFlashcards };
      const materialDocRef = doc(db, 'users', user.uid, 'studyMaterials', activeMaterial.id);
      await updateDoc(materialDocRef, { flashcards: newFlashcards });
      setActiveMaterial(updatedMaterial);
      setActiveTab('flashcards');
    } catch (e) {
      console.error("Error generating flashcards:", e);
      setError(uiText[language].apiError);
    } finally {
      setLoadingState('idle');
    }
  };
  
  const handleGenerateMindMap = async () => {
    if (!activeMaterial || activeMaterial.notes.length === 0) return;
    setLoadingState('generatingMindMap');
    setError(null);

    const notesText = activeMaterial.notes.join('\n');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: `Analyze these study notes and convert them into a hierarchical mind map JSON structure. Create a central root node for the main topic, with main ideas as primary branches and details as sub-branches. The mind map must be in ${language === Language.EN ? 'English' : 'Urdu'}. Notes: "${notesText}"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, type: { type: Type.STRING }, data: { type: Type.OBJECT, properties: { label: { type: Type.STRING } }, required: ['label']}, position: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y']}}, required: ['id', 'data', 'position']}},
              edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, source: { type: Type.STRING }, target: { type: Type.STRING }}, required: ['id', 'source', 'target']}}
            },
            required: ['nodes', 'edges']
          },
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });
      const parsed = JSON.parse(response.text);
      const updatedMaterial = { ...activeMaterial, mindMapData: parsed };
      const materialDocRef = doc(db, 'users', user.uid, 'studyMaterials', activeMaterial.id);
      await updateDoc(materialDocRef, { mindMapData: parsed });
      setActiveMaterial(updatedMaterial);
      setActiveTab('mindmap');
    } catch (e) {
      console.error("Error generating mind map:", e);
      setError(uiText[language].apiError);
    } finally {
        setLoadingState('idle');
    }
  };

  const handleExportPdf = () => {
    if (!activeMaterial) return;
    // ... (PDF export logic to be implemented based on activeMaterial)
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'studyMaterials', id));
    if (activeMaterial?.id === id) {
        setActiveMaterial(null);
    }
  };

  const selectMaterial = (material: SavedStudyMaterial) => {
    setActiveMaterial(material);
    setInputText(material.inputText);
    setRevealedFlashcards(new Set());
    // Reset tabs to default view when selecting a new material
    if(material.flashcards.length > 0) setActiveTab('flashcards');
    else if(material.mindMapData) setActiveTab('mindmap');
  };

  const languageFontClass = language === Language.UR ? 'font-urdu' : 'font-sans';
  const isGenerating = loadingState !== 'idle';
  const notes = activeMaterial?.notes || [];
  const flashcards = activeMaterial?.flashcards || [];
  const mindMapData = activeMaterial?.mindMapData || null;

  return (
    <div className={`flex flex-col h-full ${languageFontClass} bg-gray-900/50`}>
      <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
        <h1 className="text-xl font-bold">{uiText[language].title}</h1>
      </header>
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-4">
            {/* Saved Notes Sidebar */}
            <aside className="lg:col-span-1 bg-gray-900/50 border-r border-gray-700 flex flex-col">
                <h2 className="text-lg font-bold p-4 border-b border-gray-700 shrink-0">{uiText[language].savedNotes} ({savedMaterials.length})</h2>
                <div className="overflow-y-auto p-2 space-y-2">
                    {savedMaterials.map(mat => (
                        <div key={mat.id} onClick={() => selectMaterial(mat)} className={`p-3 rounded-lg cursor-pointer transition-colors ${activeMaterial?.id === mat.id ? 'bg-blue-800/60' : 'bg-gray-800/40 hover:bg-gray-700/60'}`}>
                            <p className="font-semibold truncate">{mat.inputText}</p>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-xs text-gray-400">{mat.createdAt?.toDate()?.toLocaleDateString()}</p>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteMaterial(mat.id);}} className="p-1 text-gray-400 hover:text-red-400"><TrashIcon /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-3 flex flex-col h-full overflow-hidden">
                 <div className="p-4 md:p-6 space-y-2 border-b border-gray-700">
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={uiText[language].placeholder} className={`w-full h-24 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${language === Language.UR ? 'text-right' : ''}`} disabled={isGenerating} />
                    <button onClick={handleGenerateNotes} className="w-full px-4 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2" disabled={isGenerating}>
                        {loadingState === 'generatingNotes' ? <><SpinnerIcon /> {uiText[language].generating}</> : uiText[language].generateNotes}
                    </button>
                    {error && <Notification message={error} type="error" onClose={() => setError(null)} />}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-6 flex-1 min-h-0 overflow-y-auto">
                    {/* Notes Column */}
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col min-h-[40vh] lg:min-h-0">
                        <h2 className="text-lg font-bold mb-3">{uiText[language].notesHeader}</h2>
                        {loadingState === 'generatingNotes' && <div className="text-center p-4 flex-1 flex items-center justify-center"><SpinnerIcon className="w-8 h-8"/></div>}
                        {notes.length > 0 ? (
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="prose prose-sm prose-invert max-w-none flex-1 overflow-y-auto pr-2" dangerouslySetInnerHTML={{ __html: marked.parse(notes.join('\n\n')) }} />
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-700 mt-4 shrink-0">
                                    <button onClick={handleGenerateFlashcards} disabled={isGenerating || !activeMaterial} className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-teal-600 rounded-md hover:bg-teal-700 disabled:bg-gray-500 transition-colors w-36">
                                        {loadingState === 'generatingFlashcards' ? <><SpinnerIcon className="w-4 h-4" /> {uiText[language].generating}</> : uiText[language].generateFlashcards}
                                    </button>
                                    <button onClick={handleGenerateMindMap} disabled={isGenerating || !activeMaterial} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-purple-600 rounded-md hover:bg-purple-700 disabled:bg-gray-500 transition-colors w-44">
                                        {loadingState === 'generatingMindMap' ? <><SpinnerIcon className="w-4 h-4" /> {uiText[language].generating}</> : <><SitemapIcon className="w-4 h-4" /> {uiText[language].generateMindMap}</>}
                                    </button>
                                </div>
                            </div>
                        ) : ( loadingState !== 'generatingNotes' &&
                            <p className="text-gray-500 text-center flex-1 flex items-center justify-center">{uiText[language].notesPlaceholder}</p>
                        )}
                    </div>
                    {/* ... Rest of the component (Flashcards/MindMap tabs) remains the same */}
                </div>
            </main>
        </div>
    </div>
  );
};
