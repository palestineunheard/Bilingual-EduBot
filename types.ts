
export enum Language {
  EN = 'en',
  UR = 'ur',
}

export enum Sender {
  User = 'user',
  Bot = 'bot',
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  image?: string; // base64 data URI for rendering
  sources?: { uri: string; title: string }[];
  eli5Text?: string;
  isEli5Loading?: boolean;
  realWorldExample?: string;
  isRealWorldExampleLoading?: boolean;
}

export interface FaqItem {
  id: number;
  question_en: string;
  question_ur: string;
  answer_en: string;
  answer_ur: string;
  keywords_en: string[];
  keywords_ur: string[];
}

export interface Flashcard {
  question: string;
  answer: string;
}

// Types for Mind Map Feature
// Using 'any' for Node and Edge data as reactflow types can be complex to import without a build system
export interface MindMapData {
    nodes: any[];
    edges: any[];
}

export interface VocabularyWord {
  id: string;
  word: string;
  meaning: string;
  translation_ur: string;
  example_en: string;
}

// Types for Group Study Mode
export interface GroupChatMessage {
  id: string;
  senderId: string; // User UID
  senderName: string;
  text: string;
  timestamp: number;
}

export interface Participant {
  uid: string;
  name: string;
  photoURL: string;
}

export interface SharedNoteBlock {
    id: string;
    authorId: string;
    authorName: string;
    notes: string[];
}

export interface GroupQuizScore {
  [participantId: string]: number;
}

export interface GroupQuizState {
    flashcards: Flashcard[];
    currentQuestionIndex: number;
    scores: GroupQuizScore;
    isComplete: boolean;
    quizMasterId: string;
    // Tracks who has answered the current question to prevent multiple submissions
    answered: { [participantId: string]: boolean };
    isRevealed: boolean;
}

export interface Permissions {
    [participantId: string]: {
        canShare: boolean;
    };
}

// Types for Exam Practice Mode
export interface ExamQuestion {
  type: 'mcq' | 'true_false' | 'short_answer';
  question: string;
  options?: string[]; // Only for MCQ
  answer: string;
  explanation: string;
}

export interface UserAnswer {
  question: ExamQuestion;
  userAnswer: string | null; // null if skipped
  isCorrect: boolean;
  timeTaken: number; // in seconds
}

// Types for Exam Prep Roadmap Generator
export interface DayPlan {
  day: number;
  goals: string[];
  motivation: string;
}

export interface Roadmap {
  title: string;
  days: DayPlan[];
}

// Types for AI Past Paper Analyzer
export interface AnalysisTopic {
    topic: string;
    weightage: number; // Percentage
    summary: string;
}

export interface AnalysisPattern {
    pattern: string;
    description: string;
    examples: string[];
}

export interface AnalysisResult {
    keyTopics: AnalysisTopic[];
    commonPatterns: AnalysisPattern[];
    repeatedQuestions: string[];
    revisionStrategy: string[];
}
