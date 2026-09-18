// firebase-config.js
// Configuração do Google Firebase SDK (v10 Modular) com Firestore e Authentication

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    addDoc, 
    getDoc, 
    getDocs, 
    deleteDoc,
    updateDoc,
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    where,
    limit,
    deleteField,
    Timestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDc2vNTgI7kPIGQiLEDn-SybcF5BT6q8vM",
  authDomain: "projeto-provas.firebaseapp.com",
  projectId: "projeto-provas",
  storageBucket: "projeto-provas.firebasestorage.app",
  messagingSenderId: "283165220069",
  appId: "1:283165220069:web:8ed1a4fcf81c3a0e04880c"
};

// Verifica se as credenciais foram preenchidas
const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_AQUI";

let app = null;
let db = null;
let auth = null;

if (isConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("✅ Firebase (Firestore & Auth) inicializado com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao inicializar o Firebase:", err);
    }
} else {
    console.warn("⚠️ Firebase ainda não configurado com credenciais válidas. Usando modo de simulação/fallback local.");
}

export { 
    app, 
    db, 
    auth,
    isConfigured, 
    collection, 
    doc, 
    setDoc, 
    addDoc, 
    getDoc, 
    getDocs, 
    deleteDoc,
    updateDoc,
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    where,
    limit,
    deleteField,
    Timestamp,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    writeBatch
};
