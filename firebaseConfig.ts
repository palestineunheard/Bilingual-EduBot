import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCNq_U0pG7blzgF_myX9QVlCNqo7aRin-E",
  authDomain: "bilingual-edubot.firebaseapp.com",
  projectId: "bilingual-edubot",
  storageBucket: "bilingual-edubot.appspot.com",
  messagingSenderId: "572321670257",
  appId: "1:572321670257:web:0d58aeb2cfded5385367d0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);