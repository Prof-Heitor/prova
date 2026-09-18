import { 
    auth, 
    db, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "./firebase-config.js";

export async function loginUser(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const profile = await getUserProfile(user.uid);
    if (!profile) {
        throw new Error("Perfil de usuário não encontrado no sistema.");
    }
    return { user, role: profile.role };
}

export async function logoutUser() {
    return signOut(auth);
}

export function getCurrentUser() {
    return auth.currentUser;
}

export async function getUserProfile(uid) {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return null;
}

export function onAuthReady(callback) {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        callback(user);
    });
}

export function requireAuth(redirectUrl = 'login.html') {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                window.location.href = redirectUrl;
            }
        });
    });
}

export async function requireRole(role, redirectUrl = 'login.html') {
    const user = await requireAuth(redirectUrl);
    const profile = await getUserProfile(user.uid);
    
    if (!profile || profile.role !== role) {
        window.location.href = redirectUrl;
        return null;
    }
    
    return user;
}

export async function registerStudent(email, password, metadata) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const userData = {
        email: email,
        nome: metadata.nome,
        role: 'aluno',
        turma: metadata.turma || '',
        matricula: metadata.matricula || '',
        avatarUrl: '',
        criadoEm: serverTimestamp()
    };
    
    await setDoc(doc(db, "users", user.uid), userData);
    
    await updateProfile(user, {
        displayName: metadata.nome
    });
    
    return user.uid;
}

export async function resetStudentPassword(email) {
    return sendPasswordResetEmail(auth, email);
}

export async function updateUserProfile(uid, data) {
    const docRef = doc(db, "users", uid);
    return updateDoc(docRef, data);
}
