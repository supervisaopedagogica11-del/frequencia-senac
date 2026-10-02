"use client";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// O Next.js executa este arquivo uma vez no servidor (Node, sem navegador) durante a build,
// para gerar as páginas. O Firebase Auth não deve inicializar nesse momento — só inicializamos
// de verdade quando o código está rodando no navegador de quem está usando o sistema.
function criarApp() {
  if (typeof window === "undefined") return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

const app = criarApp();

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export default app;
