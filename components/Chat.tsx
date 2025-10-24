
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Part, Content, GenerateContentResponse } from '@google/genai';
import { User } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import Fuse from 'fuse.js';
import { Language, Sender } from '../types';
import type { Message, FaqItem, MindMapData, VocabularyWord } from '../types';
import { SendIcon, MicIcon, SpeakerIcon, ClearIcon, BotIcon, UserIcon, PaperclipIcon, XIcon, GlobeIcon, SitemapIcon, SaveIcon, ChildIcon, ExportIcon, BuildingLibraryIcon, SpinnerIcon } from './icons';
import { Modal } from './Modal';
import MindMap from './MindMap';
import { Notification } from './Notification';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    marked: any;
    html2pdf: any;
    webkitAudioContext: typeof AudioContext;
  }
}

// Audio utility functions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


interface ChatProps {
    language: Language;
    user: User;
}

// Helper for non-streaming API calls
async function generateContent(body: object): Promise<GenerateContentResponse> {
    const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error('API request failed');
    }
    return response.json();
}

const Chat: React.FC<ChatProps> = ({ language, user }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isBotTyping, setIsBotTyping] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [chatId, setChatId] = useState(Date.now().toString());

  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
  const [error, setError] = useState<{ message: string, onRetry?: () => void } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [faqKnowledgeBase, setFaqKnowledgeBase] = useState<FaqItem[]>([]);

  // Mind Map State
  const [isMindMapModalOpen, setIsMindMapModalOpen] = useState<boolean>(false);
  const [activeMindMapData, setActiveMindMapData] = useState<MindMapData | null>(null);
  const [isMindMapLoading, setIsMindMapLoading] = useState<boolean>(false);

  // Vocabulary State
  const [selectionPopup, setSelectionPopup] = useState<{ text: string; top: number; left: number } | null>(null);
  const [isSavingWord, setIsSavingWord] = useState(false);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const fuseEN = useMemo(() => {
    if (faqKnowledgeBase.length === 0) return null;
    return new Fuse(faqKnowledgeBase, {
        keys: ['question_en', 'keywords_en'],
        includeScore: true,
        threshold: 0.4,
    });
  }, [faqKnowledgeBase]);

  const fuseUR = useMemo(() => {
    if (faqKnowledgeBase.length === 0) return null;
    return new Fuse(faqKnowledgeBase, {
        keys: ['question_ur', 'keywords_ur'],
        includeScore: true,
        threshold: 0.4,
    });
  }, [faqKnowledgeBase]);

  const uiText = useMemo(() => ({
    [Language.EN]: {
      placeholder: 'Ask an educational question or attach an image...',
      title: 'Bilingual EduBot',
      clear: 'Clear Chat',
      export: 'Export as PDF',
      listening: "Listening...",
      welcome: "Hello! I'm your bilingual educational assistant, powered by Gemini. How can I help you with your studies today?",
      searchWeb: 'Search the web for grounded, up-to-date answers.',
      sources: 'Sources',
      apiError: "Sorry, I couldn't process that. The API might be busy. Please try again.",
      networkError: "Network error. Please check your internet connection.",
      imageSizeError: "Image is too large. Please select a file under 4MB.",
      imageLoadError: "Failed to load image. Please try a different file.",
      speechError: "Speech recognition failed. Please check microphone permissions and try again.",
      visualize: "Visualize as Mind Map",
      mindMapModalTitle: "Mind Map Visualization",
      mindMapLoading: "Generating Mind Map...",
      saveWord: "Save Word",
      wordSaved: "Word saved to your vocabulary!",
      eli5Mode: "Explain Like I'm 5",
      eli5Loading: "Simplifying...",
      retry: "Retry",
      realWorldExample: "Real-World Example",
      generatingExample: "Generating example...",
    },
    [Language.UR]: {
      placeholder: 'کوئی تعلیمی سوال پوچھیں یا تصویر منسلک کریں...',
      title: 'دو لسانی تعمیلی بوٹ',
      clear: 'چیٹ صاف کریں',
      export: 'پی ڈی ایف کے طور پر برآمد کریں',
      listening: "سن رہا ہوں...",
      welcome: "خوش آمدید! میں جیمنی سے چلنے والا آپ کا دو لسانی تعلیمی اسسٹنٹ ہوں۔ میں آج آپ کی پڑھائی میں کیا مدد کر سکتا ہوں؟",
      searchWeb: 'مصدقہ، تازہ ترین جوابات کے لیے ویب پر تلاش کریں۔',
      sources: 'ذرائع',
      apiError: "معذرت، میں اس پر کارروائی نہیں کر سکا۔ API مصروف ہو سکتی ہے۔ براہ مہربانی دوبارہ کوشش کریں۔",
      networkError: "نیٹ ورک میں خرابی۔ براہ کرم اپنا انٹرنیٹ کنکشن چیک کریں۔",
      imageSizeError: "تصویر بہت بڑی ہے۔ براہ کرم 4MB سے کم کی فائل منتخب کریں۔",
      imageLoadError: "تصویر لوڈ کرنے میں ناکام۔ براہ کرم ایک مختلف فائل آزمائیں۔",
      speechError: "تقریر کی شناخت ناکام ہوگئی۔ براہ کرم مائیکروفون کی اجازت چیک کریں اور دوبارہ کوشش کریں۔",
      visualize: "مائنڈ میپ کے طور پر دیکھیں",
      mindMapModalTitle: "مائنڈ میپ ویژولائزیشن",
      mindMapLoading: "مائنڈ میپ بنا رہا ہے...",
      saveWord: "لفظ محفوظ کریں",
      wordSaved: "لفظ آپ کی ذخیرہ الفاظ میں محفوظ ہو گیا!",
      eli5Mode: "5 سال کے بچے کی طرح سمجھائیں",
      eli5Loading: "آسان بنا رہا ہے...",
      retry: "دوبارہ کوشش کریں",
      realWorldExample: "حقیقی دنیا کی مثال",
      generatingExample: "مثال تیار کی جا رہی ہے...",
    }
  }), [language]);

  const conversationStarters = useMemo(() => ({
    [Language.EN]: [
        "Explain photosynthesis with a simple diagram.",
        "What are the main causes of climate change?",
        "Who was Albert Einstein and what is he famous for?",
        "Give me a fun fact about the human brain.",
    ],
    [Language.UR]: [
        "ایک سادہ ڈایاگرام کے ساتھ فوٹو سنتھیسس کی وضاحت کریں۔",
        "موسمیاتی تبدیلی کی بنیادی وجوہات کیا ہیں؟",
        "البرٹ آئن سٹائن کون تھا اور وہ کس لیے مشہور ہے؟",
        "مجھے انسانی دماغ کے بارے میں ایک دلچسپ حقیقت بتائیں۔",
    ]
  }), [language]);

  // Firestore integration for chat history
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const msgs: Message[] = [];
      querySnapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      // Add welcome message if chat is new
      if (msgs.length === 0) {
        msgs.push({
            id: crypto.randomUUID(),
            text: uiText[language].welcome,
            sender: Sender.Bot,
        });
      }
      setMessages(msgs);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatId, language]);


  useEffect(() => {
    // Reset chat when global language changes
    setMessages([]);
    setChatId(Date.now().toString());
  }, [language]);

  useEffect(() => {
    const fetchFaqData = async () => {
      try {
        const response = await fetch('/data/faq.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setFaqKnowledgeBase(data);
      } catch (e) {
        console.error("Failed to fetch FAQ data:", e);
        setError({ message: "Failed to load knowledge base. Some features may not work." });
      }
    };
    fetchFaqData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (error) {
        const timer = setTimeout(() => setError(null), 10000);
        return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [notification]);
  
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = language === Language.EN ? 'en-US' : 'ur-PK';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
        handleSendMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setError({ message: uiText[language].speechError });
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [language, uiText]);
  
  useEffect(() => {
    const handleGlobalMouseDown = () => setSelectionPopup(null);
    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setError({ message: uiText[language].imageSizeError });
        return;
      }
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedImage({
            data: (reader.result as string).split(',')[1],
            mimeType: file.type,
          });
        };
        reader.onerror = () => {
          setError({ message: uiText[language].imageLoadError });
        };
        reader.readAsDataURL(file);
      }
    }
  };
  
  const handleRemoveImage = () => {
    setSelectedImage(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchRealWorldExample = async (mainAnswer: string, messageId: string) => {
    if (mainAnswer === uiText[language].welcome || mainAnswer.split(' ').length < 15) {
        return;
    }

    setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isRealWorldExampleLoading: true } : msg
    ));

    try {
        const prompt = language === Language.EN
            ? `Based on the following academic text, provide a single, concise real-world example relevant to Pakistan. The example should be easy for a student to understand and connect the concept to a practical, everyday scenario in Pakistan. If no relevant Pakistani example can be found, return a generic real-world example instead. Text: "${mainAnswer}"`
            : `درج ذیل تعلیمی متن کی بنیاد پر، پاکستان سے متعلق ایک واحد، جامع حقیقی دنیا کی مثال فراہم کریں۔ مثال ایک طالب علم کے لیے سمجھنے میں آسان ہونی چاہیے اور تصور کو پاکستان کے عملی، روزمرہ کے منظر نامے سے جوڑنا چاہیے۔ اگر کوئی متعلقہ پاکستانی مثال نہ ملے تو اس کے بجائے ایک عمومی حقیقی دنیا کی مثال دیں۔ متن: "${mainAnswer}"`;
        
        const response = await generateContent({
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        example: { type: 'STRING', description: "The real-world example." }
                    },
                    required: ['example']
                }
            }
        });

        const result = JSON.parse(response.text);
        if (result.example) {
            setMessages(prev => prev.map(msg => 
                msg.id === messageId 
                    ? { ...msg, isRealWorldExampleLoading: false, realWorldExample: result.example } 
                    : msg
            ));
        } else {
             setMessages(prev => prev.map(msg => 
                msg.id === messageId ? { ...msg, isRealWorldExampleLoading: false, realWorldExample: undefined } : msg
            ));
        }
    } catch (e) {
        console.error("Error fetching real-world example:", e);
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, isRealWorldExampleLoading: false } : msg
        ));
    }
  };

  const processStreamedMessage = async (messageParts: Part[], userMessage: Message) => {
    setIsBotTyping(true);

    try {
        const history = messages
            .filter(msg => msg.text !== uiText[Language.EN].welcome && msg.text !== uiText[Language.UR].welcome)
            .map((msg): Content => ({
                role: msg.sender === Sender.User ? 'user' : 'model',
                parts: [{ text: msg.text }],
            }));
        
        const config: any = {
             systemInstruction: language === Language.EN
                ? "You are a friendly bilingual educational assistant named EduBot. Your primary language for this conversation is English. You MUST respond exclusively in English. Your role is to help with learning, academics, and general knowledge. You MUST politely decline any requests that are not related to these topics (e.g., personal advice, inappropriate content). Use Markdown for formatting. When explaining a word, bold it."
                : "آپ ایک دوستانہ دو لسانی تعلیمی اسسٹنٹ ہیں جن کا نام ایجو بوٹ ہے۔ اس گفتگو کے لیے آپ کی بنیادی زبان اردو ہے۔ آپ کو لازمی طور پر صرف اردو میں جواب دینا ہے۔ آپ کا کردار سیکھنے، تعلیم اور عمومی علم میں مدد کرنا ہے۔ آپ کو لازمی طور پر ان موضوعات سے غیر متعلقہ کسی بھی درخواست کو شائستگی سے مسترد کرنا ہوگا (مثلاً ذاتی مشورہ، نامناسب مواد)۔ فارمیٹنگ کے لیے مارک ڈاؤن استعمال کریں۔ کسی لفظ کی وضاحت کرتے وقت اسے بولڈ کریں۔",
        };
        if (useGoogleSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history, newMessage: { parts: messageParts }, config })
        });

        if (!response.ok || !response.body) {
            throw new Error("Streaming API call failed.");
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botResponse = '';
        const messageId = crypto.randomUUID();
        let firstChunk = true;

        while(true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value);
            botResponse += chunkText;

            if (firstChunk) {
                setMessages(prev => [...prev, { id: messageId, text: botResponse, sender: Sender.Bot }]);
                firstChunk = false;
            } else {
                setMessages(prev => prev.map(msg => 
                    msg.id === messageId ? { ...msg, text: botResponse } : msg
                ));
            }
        }
        
        const finalBotMessage: Omit<Message, 'id'> = {
            text: botResponse,
            sender: Sender.Bot,
            // Grounding metadata must be handled differently with serverless functions.
            // This simplification removes the sources for now.
        };
        
        await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), {
            ...finalBotMessage,
            timestamp: serverTimestamp()
        });
        
        fetchRealWorldExample(botResponse, messageId);

    } catch (error: any) {
        console.error("Gemini API error:", error);
        setInputValue(userMessage.text);
        if (userMessage.image) {
            const mimeType = userMessage.image.match(/data:(.*);base64,/)?.[1];
            const data = userMessage.image.split(',')[1];
            if (mimeType && data) {
                setSelectedImage({ data, mimeType });
            }
        }
        const retryAction = () => {
            setError(null);
            handleSendMessage(userMessage.text);
        };
        let errorMessage = uiText[language].apiError;
        if (error.toString().toLowerCase().includes('network') || error.toString().toLowerCase().includes('failed to fetch')) {
            errorMessage = uiText[language].networkError;
        }
        setError({ message: errorMessage, onRetry: retryAction });
    } finally {
        setIsBotTyping(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!user) return;
    const trimmedText = text.trim();
    if (!trimmedText && !selectedImage) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: trimmedText,
      sender: Sender.User,
      image: selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.data}` : undefined,
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    const messageForDb: { text: string; sender: Sender; image?: string; timestamp: any; } = {
        text: userMessage.text,
        sender: userMessage.sender,
        timestamp: serverTimestamp()
    };

    if (userMessage.image) {
        messageForDb.image = userMessage.image;
    }
    
    await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), messageForDb);

    setInputValue('');
    handleRemoveImage();

    if (!selectedImage && trimmedText && !useGoogleSearch) {
        const fuse = language === Language.EN ? fuseEN : fuseUR;
        if (fuse) {
            const results = fuse.search(trimmedText);

            if (results.length > 0 && results[0].score! < 0.35) {
                const matchedFaq = results[0].item;
                const botAnswer = language === Language.EN ? matchedFaq.answer_en : matchedFaq.answer_ur;
                
                setIsBotTyping(true);
                setTimeout(async () => {
                    await addDoc(collection(db, 'users', user.uid, 'chats', chatId, 'messages'), {
                        text: botAnswer,
                        sender: Sender.Bot,
                        timestamp: serverTimestamp()
                    });
                    setIsBotTyping(false);
                }, 800);
                
                return;
            }
        }
    }

    const messageParts: Part[] = [];
    if (selectedImage) {
        messageParts.push({ inlineData: { data: selectedImage.data, mimeType: selectedImage.mimeType } });
    }
    if (trimmedText) {
        messageParts.push({ text: trimmedText });
    }
    
    processStreamedMessage(messageParts, userMessage);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const handleClearChat = () => {
    setMessages([]);
    setChatId(Date.now().toString());
  };

  const handleExportPdf = () => {
    const pdfStyles = `
      .pdf-container { padding: 25px; font-family: 'Inter', sans-serif; color: #1f2937; line-height: 1.6; background-color: white; }
      h1 { text-align: center; font-family: 'Inter', sans-serif; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 25px; }
      .message-wrapper { margin-bottom: 16px; padding: 12px; border-radius: 12px; border: 1px solid #d1d5db; page-break-inside: avoid; overflow: hidden; }
      .message-wrapper.user { background-color: #e0f2fe; }
      .message-wrapper.bot { background-color: #f3f4f6; }
      .sender-name { font-weight: bold; margin-bottom: 5px; font-family: 'Inter', sans-serif; }
      .sender-name.user { color: #0369a1; }
      .sender-name.bot { color: #15803d; }
      .message-content { margin-top: 5px; }
      .message-content p, .message-content ul, .message-content ol, .message-content strong, .message-content em, .message-content li { margin: 0; color: #1f2937; }
      .message-content ul, .message-content ol { padding-left: 20px; margin-top: 8px; margin-bottom: 8px; }
      .message-content img { max-width: 300px; border-radius: 8px; margin-top: 10px; }
      .urdu-text { font-family: 'Noto Nastaliq Urdu', serif !important; direction: rtl; text-align: right; }
      .urdu-text p, .urdu-text li { text-align: right; }
      .eli5-block { margin-top: 12px; padding: 10px; border-radius: 8px; background-color: #fefce8; border: 1px solid #fde047; }
      .eli5-block strong { font-family: 'Inter', sans-serif; }
      .eli5-block p, .eli5-block div { color: #1f2937; }
    `;

    const isUrdu = (str: string) => /[\u0600-\u06FF]/.test(str);

    const messagesHtml = messages
      .filter(msg => msg.text !== uiText[Language.EN].welcome && msg.text !== uiText[Language.UR].welcome)
      .map(msg => {
        const senderClass = msg.sender === Sender.User ? 'user' : 'bot';
        const textUrduClass = isUrdu(msg.text) ? 'urdu-text' : '';
        const eli5UrduClass = msg.eli5Text && isUrdu(msg.eli5Text) ? 'urdu-text' : '';

        const imageHtml = msg.image ? `<img src="${msg.image}" alt="User upload">` : '';

        const eli5Html = msg.eli5Text ? `
          <div class="eli5-block">
            <strong>Explain Like I'm 5:</strong>
            <div class="${eli5UrduClass}">${window.marked.parse(msg.eli5Text)}</div>
          </div>
        ` : '';

        return `
          <div class="message-wrapper ${senderClass}">
            <strong class="sender-name ${senderClass}">${msg.sender === Sender.User ? 'You' : 'EduBot'}</strong>
            ${imageHtml}
            <div class="message-content ${textUrduClass}">
              ${window.marked.parse(msg.text)}
            </div>
            ${eli5Html}
          </div>
        `;
      }).join('');

    const fullHtml = `
      <html>
        <head>
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">
          <style>${pdfStyles}</style>
        </head>
        <body>
          <div class="pdf-container">
            <h1>Chat History</h1>
            ${messagesHtml}
          </div>
        </body>
      </html>
    `;
    
    const element = document.createElement('div');
    element.innerHTML = fullHtml;
    document.body.appendChild(element);

    const opt = {
      margin: 0.5,
      filename: 'EduBot-Chat-History.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    window.html2pdf().from(element).set(opt).save().then(() => {
      document.body.removeChild(element);
    });
  };

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else if (recognitionRef.current) {
        setInputValue('');
        recognitionRef.current.start();
        setIsListening(true);
    } else {
        alert("Sorry, your browser doesn't support speech recognition.");
    }
  };

  const speakText = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
        const response = await generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: language === Language.EN ? 'Kore' : 'Puck' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.start();
            source.onended = () => {
                outputAudioContext.close();
                setIsSpeaking(false);
            };
        } else {
            setIsSpeaking(false);
        }
    } catch (e) {
        console.error("TTS Error:", e);
        setError({ message: "Failed to generate audio." });
        setIsSpeaking(false);
    }
  };

  const handleVisualizeMessage = async (messageText: string) => {
    setIsMindMapLoading(true);
    setActiveMindMapData(null);
    setIsMindMapModalOpen(true);
    setError(null);

    try {
        const response = await generateContent({
            model: 'gemini-2.5-pro',
            contents: `Analyze the following educational text and convert it into a hierarchical mind map structure. The output must be a valid JSON object.
- Identify a single central topic as the root node.
- Identify main ideas branching off the central topic.
- Identify sub-points branching off the main ideas.
- Arrange the nodes in a logical tree-like layout starting from x: 0, y: 0.

The JSON output must conform to the specified schema.

Text to analyze:
"${messageText}"`,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        nodes: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    id: { type: 'STRING' },
                                    type: { type: 'STRING' },
                                    data: {
                                        type: 'OBJECT',
                                        properties: { label: { type: 'STRING' } },
                                        required: ['label']
                                    },
                                    position: {
                                        type: 'OBJECT',
                                        properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } },
                                        required: ['x', 'y']
                                    }
                                },
                                required: ['id', 'data', 'position']
                            }
                        },
                        edges: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    id: { type: 'STRING' },
                                    source: { type: 'STRING' },
                                    target: { type: 'STRING' }
                                },
                                required: ['id', 'source', 'target']
                            }
                        }
                    },
                    required: ['nodes', 'edges']
                },
                thinkingConfig: { thinkingBudget: 32768 }
            }
        });
        const parsed = JSON.parse(response.text);
        setActiveMindMapData(parsed);
    } catch (e) {
        console.error("Error generating mind map:", e);
        setError({ message: uiText[language].apiError });
        setIsMindMapModalOpen(false);
    } finally {
        setIsMindMapLoading(false);
    }
  };
  
  const handleEli5Request = async (messageId: string) => {
    const originalMessage = messages.find(m => m.id === messageId);
    if (!originalMessage || !originalMessage.text) return;

    setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, isEli5Loading: true } : msg
    ));
    setError(null);

    try {
        let eli5Prompt = '';
        if (language === Language.EN) {
            eli5Prompt = `Explain the following text as if you were talking to a 5-year-old child. Use very simple English words, short sentences, and relatable analogies (like comparing a computer's brain to a human brain). Break down complex terms into everyday examples. Text to simplify: "${originalMessage.text}"`;
        } else { // Language.UR
            eli5Prompt = `Explain the following text in extremely simple Urdu, as if for a 5-year-old child. Use everyday language and common analogies (for example, use 'gari' for car, not complex words). Break down difficult concepts using examples from daily life. Avoid formal or literary Urdu. The goal is maximum simplicity and clarity. Text to simplify: "${originalMessage.text}"`;
        }
        
        const response = await generateContent({
            contents: eli5Prompt,
        });
        
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, isEli5Loading: false, eli5Text: response.text } : msg
        ));

    } catch (e) {
        console.error("Error generating ELI5 explanation:", e);
        setError({ message: uiText[language].apiError });
        setMessages(prev => prev.map(msg => 
            msg.id === messageId ? { ...msg, isEli5Loading: false } : msg
        ));
    }
  };

  const handleTextSelection = () => {
    if (isSavingWord) return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 1) {
        const selectedText = selection.toString().trim();
        if (selectedText.split(' ').length > 4 || selectedText.length > 50) {
            setSelectionPopup(null);
            return;
        }

        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== Node.ELEMENT_NODE) {
            parent = parent.parentNode!;
        }

        if ((parent as HTMLElement).closest('.bot-message-content')) {
            const rect = range.getBoundingClientRect();
            const containerRect = (parent as HTMLElement).closest('.flex-1.overflow-y-auto')?.getBoundingClientRect();
            if(containerRect) {
                setSelectionPopup({
                    text: selectedText,
                    top: rect.bottom - containerRect.top,
                    left: rect.left - containerRect.left + rect.width / 2,
                });
                return;
            }
        }
    }
    setSelectionPopup(null);
  };
  
  const handleSaveWord = async (word: string) => {
    if (!user) return;
    setIsSavingWord(true);
    setSelectionPopup(null);
    try {
        const response = await generateContent({
            contents: `For the English word/phrase "${word}", provide its simple English meaning, its Urdu translation, and a simple English example sentence.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        meaning: { type: 'STRING', description: "A simple English definition." },
                        translation_ur: { type: 'STRING', description: "The translation in Urdu." },
                        example_en: { type: 'STRING', description: "An English sentence using the word." }
                    },
                    required: ["meaning", "translation_ur", "example_en"]
                }
            }
        });

        const vocabData = JSON.parse(response.text);
        const newWord: Omit<VocabularyWord, 'id'> = {
            word: word,
            ...vocabData
        };
        
        await addDoc(collection(db, 'users', user.uid, 'vocabulary'), newWord);
        setNotification(uiText[language].wordSaved);

    } catch (e) {
        console.error("Error saving word:", e);
        setError({ message: uiText[language].apiError });
    } finally {
        setIsSavingWord(false);
    }
  };

  return (
    <>
    {selectionPopup && (
        <div 
            className="absolute z-20"
            style={{ 
                top: `${selectionPopup.top}px`, 
                left: `${selectionPopup.left}px`,
                transform: 'translate(-50%, 8px)'
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <button 
                onClick={() => handleSaveWord(selectionPopup.text)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-indigo-700 transition-all"
            >
                <SaveIcon className="w-4 h-4" />
                {uiText[language].saveWord}
            </button>
        </div>
    )}
    <Modal isOpen={isMindMapModalOpen} onClose={() => setIsMindMapModalOpen(false)} title={uiText[language].mindMapModalTitle}>
        {isMindMapLoading && <div className="flex items-center justify-center h-full text-lg">{uiText[language].mindMapLoading}</div>}
        {activeMindMapData && <MindMap data={activeMindMapData} />}
    </Modal>
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between p-4 bg-gray-900/50 border-b border-gray-700 backdrop-blur-sm shrink-0">
        <h1 className="text-xl font-bold">{uiText[language].title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPdf} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title={uiText[language].export} disabled={messages.length <= 1}>
            <ExportIcon className="w-5 h-5"/>
          </button>
          <button onClick={handleClearChat} className="p-2 rounded-full hover:bg-gray-700 transition-colors" title={uiText[language].clear}>
            <ClearIcon className="w-5 h-5"/>
          </button>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative" onMouseUp={handleTextSelection} onScroll={() => setSelectionPopup(null)}>
        {messages.length <= 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 animate-fade-in">
                {conversationStarters[language].map((prompt, i) => (
                    <button 
                        key={i} 
                        onClick={() => handleSendMessage(prompt)}
                        className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-left hover:bg-gray-700/80 transition-all duration-200 text-sm text-gray-300"
                    >
                        {prompt}
                    </button>
                ))}
            </div>
        )}
        {messages.map((msg) => {
            const hasRealWorldExample = msg.sender === Sender.Bot && (msg.realWorldExample || msg.isRealWorldExampleLoading);
            return (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === Sender.User ? 'justify-end' : 'justify-start'}`}>
                {msg.sender === Sender.Bot && <div className="shrink-0 self-start text-teal-400"><BotIcon/></div>}
                <div className={`flex flex-col items-start ${hasRealWorldExample ? 'w-full max-w-4xl' : ''}`}>
                  <div className={`${hasRealWorldExample ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}`}>
                    <div className="flex flex-col items-start">
                      <div className={`w-full ${hasRealWorldExample ? '' : 'max-w-xs md:max-w-md lg:max-w-lg'} px-4 py-3 rounded-xl relative group ${msg.sender === Sender.User ? 'bg-sky-700 rounded-br-sm' : 'bg-slate-700 rounded-bl-sm'}`}>
                        {msg.image && <img src={msg.image} alt="User upload" className="rounded-lg mb-2 max-h-60 w-auto" />}
                        <div 
                          className={`prose prose-sm prose-invert prose-p:text-white prose-ul:text-white prose-ol:text-white prose-strong:text-white whitespace-pre-wrap break-words ${msg.sender === Sender.Bot ? 'bot-message-content' : ''}`}
                          dangerouslySetInnerHTML={{ __html: window.marked.parse(msg.text) }}
                        />
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-600">
                              <h4 className="text-xs font-semibold text-gray-400 mb-1">{uiText[language].sources}</h4>
                              <ul className="text-xs space-y-1">
                                  {msg.sources.map((source, index) => (
                                      <li key={index} className="truncate">
                                          <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center gap-1">
                                              <span>{source.title || new URL(source.uri).hostname}</span>
                                          </a>
                                      </li>
                                  ))}
                              </ul>
                          </div>
                        )}
                        {msg.sender === Sender.Bot && msg.text && !msg.text.includes(uiText[language].welcome) && !msg.eli5Text && (
                          <div className="mt-2 pt-2 border-t border-slate-600/50">
                            {msg.isEli5Loading ? (
                              <div className="flex items-center gap-2 text-xs text-amber-400">
                                <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                <span>{uiText[language].eli5Loading}</span>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleEli5Request(msg.id)}
                                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-semibold transition-colors"
                                title={uiText[language].eli5Mode}
                              >
                                <ChildIcon className="w-4 h-4" />
                                <span>ELI5 Mode</span>
                              </button>
                            )}
                          </div>
                        )}
                         {msg.sender === Sender.Bot && msg.text && (
                          <div className="absolute bottom-1 -right-8 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => speakText(msg.text)} className=" text-gray-400 hover:text-white disabled:opacity-50" aria-label="Speak text" title="Speak text" disabled={isSpeaking}>
                                  <SpeakerIcon/>
                              </button>
                              <button onClick={() => handleVisualizeMessage(msg.text)} className="text-gray-400 hover:text-white" aria-label={uiText[language].visualize} title={uiText[language].visualize}>
                                  <SitemapIcon />
                              </button>
                          </div>
                        )}
                      </div>
                      {msg.eli5Text && (
                        <div className="w-full max-w-xs md:max-w-md lg:max-w-lg px-3 py-2 rounded-xl bg-amber-900/70 border border-amber-700/50 rounded-bl-sm mt-2 animate-fade-in">
                            <div 
                                className={`prose prose-xs prose-invert prose-p:text-amber-100 whitespace-pre-wrap break-words`}
                                dangerouslySetInnerHTML={{ __html: window.marked.parse(msg.eli5Text) }}
                            />
                        </div>
                      )}
                    </div>

                    {hasRealWorldExample && (
                        <div className="bg-gray-800 border border-teal-500/30 rounded-xl p-4 flex flex-col self-start h-full">
                            <div className="flex items-center gap-2 mb-2 text-teal-300">
                                <BuildingLibraryIcon className="w-5 h-5" />
                                <h3 className="font-semibold">{uiText[language].realWorldExample}</h3>
                            </div>
                            {msg.isRealWorldExampleLoading ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <SpinnerIcon />
                                        <span>{uiText[language].generatingExample}</span>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="prose prose-sm prose-invert prose-p:text-gray-300 whitespace-pre-wrap break-words"
                                    dangerouslySetInnerHTML={{ __html: window.marked.parse(msg.realWorldExample || '') }}
                                />
                            )}
                        </div>
                    )}
                  </div>
                </div>
                 {msg.sender === Sender.User && <div className="shrink-0 self-start text-gray-400"><UserIcon/></div>}
              </div>
            )
        })}
        {isBotTyping && (
          <div className="flex items-end gap-2 justify-start">
             <div className="shrink-0 self-start text-teal-400"><BotIcon/></div>
            <div className="bg-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:--0.15s]"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <footer className="p-3 bg-gray-800 border-t border-gray-700 shrink-0">
        {notification && (
            <Notification
                message={notification}
                type="success"
                onClose={() => setNotification(null)}
            />
        )}
        {error && (
            <Notification
                message={error.message}
                type="error"
                onClose={() => setError(null)}
                onAction={error.onRetry}
                actionText={uiText[language].retry}
            />
        )}
         {selectedImage && (
            <div className="relative inline-block mb-2 ml-12 p-1 bg-gray-700 rounded-lg">
                <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} alt="Selected preview" className="h-20 w-auto rounded" />
                <button onClick={handleRemoveImage} className="absolute -top-2 -right-2 bg-gray-900 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors">
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
        )}
        <div className="flex items-center gap-2">
            <label className="relative cursor-pointer p-2 rounded-full hover:bg-gray-600 transition-colors" title={uiText[language].searchWeb}>
                <input type="checkbox" checked={useGoogleSearch} onChange={e => setUseGoogleSearch(e.target.checked)} className="absolute opacity-0 w-full h-full" />
                <GlobeIcon className={`${useGoogleSearch ? 'text-blue-400' : 'text-gray-400'}`} />
            </label>
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 bg-gray-700 rounded-full p-1">
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-gray-600 transition-colors text-gray-400" aria-label="Attach image">
                <PaperclipIcon />
              </button>
              <button type="button" onClick={handleMicClick} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-600 text-gray-400'}`} aria-label="Use microphone">
                <MicIcon />
              </button>
              <input
                type="text"
                value={isListening ? uiText[language].listening : inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isListening || isBotTyping}
                placeholder={uiText[language].placeholder}
                className={`w-full bg-transparent focus:outline-none px-2 ${language === Language.UR ? 'text-right' : 'text-left'}`}
                aria-label="Chat input"
              />
              <button type="submit" className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={(!inputValue.trim() && !selectedImage) || isBotTyping} aria-label="Send message">
                <SendIcon />
              </button>
            </form>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Chat;
