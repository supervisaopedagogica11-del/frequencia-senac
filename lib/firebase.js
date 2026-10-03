import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// As chaves web do Firebase são públicas por natureza (a proteção é feita pelas regras do Firestore).
// Se existirem variáveis NEXT_PUBLIC_FIREBASE_* na Vercel, elas têm prioridade.
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDtOnD9ZW-1MEszG0lqIqCQsKYLAgB3MSc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "frequencia-senac.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "frequencia-senac",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "frequencia-senac.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "945575736832",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:945575736832:web:dfd978e2c28d3274ec8ae5",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
