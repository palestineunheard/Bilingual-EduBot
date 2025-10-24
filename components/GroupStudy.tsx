import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, updateDoc, arrayUnion, getDoc, writeBatch, deleteField } from 'firebase/firestore';
import { Participant, GroupChatMessage, Flashcard, GroupQuizState, SharedNoteBlock, Permissions } from '../types';
import { UsersIcon, ClipboardCopyIcon, LoginIcon, LogoutIcon, SendIcon } from './icons';
import { Notification } from './Notification';

const word1 = ["HAPPY", "LAZY", "BRIGHT", "QUICK", "SILENT", "SPARK"];
const word2 = ["FOX", "CUP", "TREE", "RIVER", "STONE", "CLOUD"];
const generateRoomCode = () => `${word1[Math.floor(Math.random()*word1.length)]}-${word2[Math.floor(Math.random()*word2.length)]}-${Math.floor(Math.random()*90)+10}`;

interface GroupStudyProps {
    user: User;
}

export const GroupStudy: React.FC<GroupStudyProps> = ({ user }) => {
    const [roomCode, setRoomCode] = useState('');
    const [inputRoomCode, setInputRoomCode] = useState('');
    
    const [sessionData, setSessionData] = useState<any>(null);
    const [myQuizAnswer, setMyQuizAnswer] = useState<string | null>(null);
    
    const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'quiz'>('chat');
    const [chatInput, setChatInput] = useState('');
    const [notesInput, setNotesInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    
    const chatBottomRef = useRef<HTMLDivElement>(null);
    const unsubscribeRef = useRef<() => void | null>(null);
    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY! }), []);

    const { participants = [], chatMessages = [], sharedNotes = [], sharedFlashcards = [], quizState = null, permissions = {}, hostId = '' } = sessionData || {};
    const isHost = user.uid === hostId;
    const myPermissions = permissions[user.uid] || { canShare: false };

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);
    
    useEffect(() => {
        // Cleanup listener on component unmount
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const handleCreateRoom = async () => {
        const code = generateRoomCode();
        const sessionDocRef = doc(db, 'group_sessions', code);

        const newParticipant: Participant = {
            uid: user.uid,
            name: user.displayName || 'Anonymous',
            photoURL: user.photoURL || '',
        };

        const initialSessionData = {
            hostId: user.uid,
            participants: [newParticipant],
            chatMessages: [],
            sharedNotes: [],
            sharedFlashcards: [],
            quizState: null,
            permissions: { [user.uid]: { canShare: true } },
            createdAt: new Date(),
        };

        try {
            await setDoc(sessionDocRef, initialSessionData);
            setRoomCode(code);
            subscribeToSession(code);
        } catch (e) {
            console.error(e);
            setError("Failed to create room.");
        }
    };
    
    const handleJoinRoom = async () => {
        const code = inputRoomCode.trim().toUpperCase();
        if (!code) {
            setError("Please enter a room code.");
            return;
        }

        const sessionDocRef = doc(db, 'group_sessions', code);
        const docSnap = await getDoc(sessionDocRef);

        if (docSnap.exists()) {
            const newParticipant: Participant = {
                uid: user.uid,
                name: user.displayName || 'Anonymous',
                photoURL: user.photoURL || '',
            };
            try {
                await updateDoc(sessionDocRef, {
                    participants: arrayUnion(newParticipant),
                    permissions: { ...docSnap.data().permissions, [user.uid]: { canShare: false } }
                });
                setRoomCode(code);
                subscribeToSession(code);
            } catch (e) {
                 console.error(e);
                 setError("Failed to join room.");
            }
        } else {
            setError("Room not found.");
        }
    };
    
    const subscribeToSession = (code: string) => {
        const sessionDocRef = doc(db, 'group_sessions', code);
        unsubscribeRef.current = onSnapshot(sessionDocRef, (doc) => {
            if (doc.exists()) {
                setSessionData(doc.data());
            } else {
                setError("The session has ended.");
                handleLeaveRoom();
            }
        });
    };

    const handleLeaveRoom = async () => {
        if (!roomCode || !sessionData) return;
        
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
        }

        const sessionDocRef = doc(db, 'group_sessions', roomCode);
        const newParticipants = participants.filter((p: Participant) => p.uid !== user.uid);
        
        try {
            if (isHost && newParticipants.length > 0) {
                 // Transfer host role
                const newHostId = newParticipants[0].uid;
                await updateDoc(sessionDocRef, {
                    hostId: newHostId,
                    participants: newParticipants,
                    [`permissions.${newHostId}.canShare`]: true
                });
            } else if (newParticipants.length === 0) {
                // Last person leaving, delete the doc
                const batch = writeBatch(db);
                batch.delete(sessionDocRef);
                await batch.commit();
            } else {
                await updateDoc(sessionDocRef, {
                    participants: newParticipants,
                    [`permissions.${user.uid}`]: deleteField()
                });
            }
        } catch(e) {
            console.error("Error leaving room:", e);
        }

        setRoomCode('');
        setInputRoomCode('');
        setSessionData(null);
    };

    const handleSendChatMessage = async () => {
        if (!chatInput.trim() || !roomCode) return;
        const message: GroupChatMessage = {
            id: crypto.randomUUID(),
            senderId: user.uid,
            senderName: user.displayName || 'Anonymous',
            text: chatInput,
            timestamp: Date.now(),
        };
        const sessionDocRef = doc(db, 'group_sessions', roomCode);
        await updateDoc(sessionDocRef, {
            chatMessages: arrayUnion(message)
        });
        setChatInput('');
    };
    
    const handleGenerateNotes = async () => {
        if (!notesInput.trim()) return;
        setIsLoading(true);
        setError(null);
        try {
            const notesResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `From the following text, create detailed, well-structured study notes. Use Markdown for clear formatting (headings, lists, bold text). The notes should be easy for a group to study from. Text: "${notesInput}"`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            notes: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            }
                        },
                        required: ['notes']
                    }
                }
            });
            const parsedNotes = JSON.parse(notesResponse.text);

            const newNoteBlock: SharedNoteBlock = {
                id: crypto.randomUUID(),
                authorId: user.uid,
                authorName: user.displayName || 'Anonymous',
                notes: parsedNotes.notes || []
            };
            const sessionDocRef = doc(db, 'group_sessions', roomCode);
            await updateDoc(sessionDocRef, {
                sharedNotes: arrayUnion(newNoteBlock)
            });
            setNotesInput('');
        } catch (e) {
            console.error("Error generating notes:", e);
            setError("Failed to generate notes from AI.");
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!roomCode) {
         return (
            <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 text-center bg-gray-900/50">
                 <h1 className="text-3xl font-bold mb-2">Group Study Lobby</h1>
                 <p className="text-gray-400 mb-8 max-w-md">Create a private room to chat, share notes, and quiz each other in real-time. Or join an existing room using a code.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4">
                        <h2 className="text-xl font-semibold">Create a New Study Room</h2>
                        <p className="text-gray-400 text-sm flex-1">Start a new session as the host and invite others to join.</p>
                        <button onClick={handleCreateRoom} className="w-full px-4 py-2.5 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Create Room
                        </button>
                    </div>
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4">
                        <h2 className="text-xl font-semibold">Join an Existing Room</h2>
                        <form onSubmit={(e) => { e.preventDefault(); handleJoinRoom(); }} className="w-full flex flex-col gap-3 flex-1 justify-center">
                            <input
                                type="text"
                                value={inputRoomCode}
                                onChange={e => setInputRoomCode(e.target.value.toUpperCase())}
                                placeholder="Enter Room Code..."
                                className="w-full p-3 text-center bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button type="submit" className="w-full px-4 py-2.5 bg-teal-600 font-semibold rounded-lg hover:bg-teal-700 transition-colors">
                                Join Room
                            </button>
                        </form>
                    </div>
                </div>
                 {error && <div className="mt-6"><Notification message={error} type="error" onClose={() => setError(null)} /></div>}
            </div>
        );
    }

    // The rest of the component renders the UI based on `sessionData` state
    // Event handlers are updated to use `updateDoc` to modify the Firestore document.
    return (
        <div className="flex flex-col h-full bg-gray-900/50">
            {/* Header with room code */}
            <header className="flex items-center justify-between p-3 bg-gray-900/50 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-bold">Group Study</h1>
                    <div className="flex items-center gap-2 p-1.5 pl-3 bg-gray-700 rounded-full">
                        <span className="text-sm font-mono text-teal-300">{roomCode}</span>
                        <button onClick={() => { navigator.clipboard.writeText(roomCode); setNotification("Room code copied!"); }} className="p-1.5 bg-gray-600 rounded-full hover:bg-gray-500"><ClipboardCopyIcon className="w-4 h-4"/></button>
                    </div>
                </div>
                <button onClick={handleLeaveRoom} className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold bg-red-600 rounded-full hover:bg-red-700 transition-colors">
                    <LogoutIcon/> Leave Room
                </button>
            </header>

            <div className="flex flex-1 min-h-0">
                {/* Main Content (Chat, Notes, Quiz) */}
                <main className="flex-1 flex flex-col">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-700 shrink-0">
                        <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 font-semibold ${activeTab==='chat' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>Chat</button>
                        <button onClick={() => setActiveTab('notes')} className={`px-4 py-2 font-semibold ${activeTab==='notes' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>Notes & Flashcards</button>
                        <button onClick={() => setActiveTab('quiz')} className={`px-4 py-2 font-semibold ${activeTab==='quiz' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-700/50'}`}>Quiz</button>
                    </div>

                    {/* Content based on active tab */}
                </main>

                 {/* Sidebar with participants */}
                <aside className="w-64 border-l border-gray-700 flex flex-col shrink-0">
                    <h2 className="text-lg font-bold p-4 border-b border-gray-700 flex items-center gap-2"><UsersIcon /> Participants ({participants.length})</h2>
                    <ul className="overflow-y-auto p-4 space-y-2">
                        {participants.map((p: Participant) => (
                            <li key={p.uid} className={`p-2 rounded-md ${p.uid === user.uid ? 'bg-blue-800/50' : 'bg-gray-700/50'}`}>
                                <p>{p.name}{p.uid === user.uid && ' (You)'}{p.uid === hostId && ' (Host)'}</p>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>
        </div>
    );
};
