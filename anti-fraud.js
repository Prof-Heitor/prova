import { db, doc, setDoc, serverTimestamp } from "./firebase-config.js";

let heartbeatInterval = null;
let currentUid = null;
let currentProvaId = null;

// Armazenar referências das funções para poder remover depois
const listeners = {
    contextmenu: null,
    keydown: null,
    visibilitychange: null,
    blur: null
};

function showRedFlash() {
    let flash = document.getElementById('security-flash');
    if (!flash) {
        flash = document.createElement('div');
        flash.id = 'security-flash';
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.backgroundColor = 'rgba(255, 0, 0, 0.85)';
        flash.style.color = 'white';
        flash.style.display = 'flex';
        flash.style.alignItems = 'center';
        flash.style.justifyContent = 'center';
        flash.style.fontSize = '4rem';
        flash.style.fontWeight = 'bold';
        flash.style.zIndex = '999999';
        flash.style.pointerEvents = 'none';
        flash.textContent = '🚫 BLOQUEADO';
        document.body.appendChild(flash);
    }
    flash.style.display = 'flex';
    setTimeout(() => {
        flash.style.display = 'none';
    }, 1500);
}

export function enableFullscreenLock() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        return elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) { /* Safari */
        return elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE11 */
        return elem.msRequestFullscreen();
    }
    return Promise.resolve();
}

export function attachSecurityListeners(onViolationCallback) {
    // Previne múltiplos registros
    detachSecurityListeners();

    listeners.contextmenu = (e) => {
        e.preventDefault();
        showRedFlash();
        if(onViolationCallback) onViolationCallback('Tentativa de clique com botão direito');
    };

    listeners.keydown = (e) => {
        // Bloqueia F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            showRedFlash();
            if(onViolationCallback) onViolationCallback('Tentativa de uso do F12 (Inspecionar)');
        }
        // Bloqueia atalhos com Ctrl ou Cmd
        if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase();
            if (['c', 'v', 'x', 'a', 's', 'u', 'p', 'i', 'j', 'k'].includes(key) || e.shiftKey) {
                e.preventDefault();
                showRedFlash();
                if(onViolationCallback) onViolationCallback(`Tentativa de atalho de teclado: Ctrl+${e.shiftKey ? 'Shift+' : ''}${key.toUpperCase()}`);
            }
        }
    };

    listeners.visibilitychange = () => {
        if (document.visibilityState === 'hidden') {
            showRedFlash();
            if(onViolationCallback) onViolationCallback('Saiu da aba (Troca de guia ou minimizou)');
        }
    };

    listeners.blur = () => {
        showRedFlash();
        if(onViolationCallback) onViolationCallback('Perdeu o foco da janela principal');
    };

    document.addEventListener('contextmenu', listeners.contextmenu);
    document.addEventListener('keydown', listeners.keydown);
    document.addEventListener('visibilitychange', listeners.visibilitychange);
    window.addEventListener('blur', listeners.blur);
}

export function detachSecurityListeners() {
    if (listeners.contextmenu) document.removeEventListener('contextmenu', listeners.contextmenu);
    if (listeners.keydown) document.removeEventListener('keydown', listeners.keydown);
    if (listeners.visibilitychange) document.removeEventListener('visibilitychange', listeners.visibilitychange);
    if (listeners.blur) window.removeEventListener('blur', listeners.blur);
    
    // Zera referências
    listeners.contextmenu = null;
    listeners.keydown = null;
    listeners.visibilitychange = null;
    listeners.blur = null;
}

export function startHeartbeat(uid, provaId, studentName = 'Aluno', intervalMs = 30000) {
    if (heartbeatInterval) stopHeartbeat();
    currentUid = uid;
    currentProvaId = provaId;
    
    const sendHeartbeat = async () => {
        try {
            const ref = doc(db, 'alunos_online', uid);
            await setDoc(ref, {
                provaId: provaId,
                ultimoHeartbeat: serverTimestamp(),
                status: 'em_prova',
                studentName: studentName
            }, { merge: true });
        } catch (e) {
            console.error('Erro no heartbeat', e);
        }
    };

    sendHeartbeat(); // Executa a primeira vez imediatamente
    heartbeatInterval = setInterval(sendHeartbeat, intervalMs);
}

export async function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    if (currentUid) {
        try {
            const ref = doc(db, 'alunos_online', currentUid);
            await setDoc(ref, {
                status: 'finalizada',
                ultimoHeartbeat: serverTimestamp()
            }, { merge: true });
        } catch (e) {
            console.error('Erro ao finalizar heartbeat', e);
        }
    }
}
