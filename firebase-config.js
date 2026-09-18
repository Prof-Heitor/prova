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
  apiKey: "AIzaSyC5I_llll35twKYOltknUVTtyltlGdUOdQ",
  authDomain: "avaliacao-tec.firebaseapp.com",
  projectId: "avaliacao-tec",
  storageBucket: "avaliacao-tec.firebasestorage.app",
  messagingSenderId: "420069035199",
  appId: "1:420069035199:web:2f6d4b8ac3989d979d8a0a"
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
