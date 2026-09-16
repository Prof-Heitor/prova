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
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/*
  INSTRUÇÕES PARA CONFIGURAR SEU PROJETO NO FIREBASE:
  1. Acesse https://console.firebase.google.com/ e faça login com sua conta Google.
  2. No menu lateral "Criação":
     - Firestore Database: criar banco de dados.
     - Authentication: ativar o provedor "E-mail/senha" na aba "Sign-in method" e cadastrar o e-mail/senha do professor na aba "Users".
  3. Vá nas configurações do projeto (ícone de engrenagem) -> "Geral" -> "Seus aplicativos" (Web </>)
  4. Cole o objeto 'firebaseConfig' abaixo:
*/

const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
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
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};
