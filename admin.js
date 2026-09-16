// admin.js
// Lógica do Painel de Análise de Resultados e Gestão de Questões no Firebase

import { 
    db, 
    auth,
    isConfigured, 
    collection, 
    doc, 
    setDoc,
    getDocs, 
    getDoc, 
    deleteDoc,
    onSnapshot, 
    query, 
    orderBy,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "./firebase-config.js";

import { seedQuestionsToFirestore } from "./seed_firestore.js";

// Estado global do painel
let submissions = [];
let questionsList = []; // Array de { id, ordem, question/enunciado, options/opcoes, correct/correta }
let currentFilteredList = [];
let unsubscribeSubmissions = null;
let currentTab = "results";

// Senha mestra de demonstração/offline caso o Firebase Auth ainda não esteja configurado
const DEMO_MASTER_PASS = "abacate";

// Dados simulados para modo demonstração
const demoSubmissions = [
    {
        id: "demo_1",
        studentName: "Lucas Fernandes da Silva",
        studentClass: "3º Técnico",
        score: 9,
        totalQuestions: 10,
        percentage: 90,
        tempoFormatado: "18m 42s",
        tempoGastoSeg: 1122,
        violationsCount: 0,
        violations: [],
        detailedAnswers: [
            { qNum: 1, isWrong: false, suaText: "Validar permissões de acesso aos dados do usuário." },
            { qNum: 2, isWrong: false, suaText: "Adota um modelo de I/O não bloqueante, permitindo o processamento simultâneo de múltiplas requisições." },
            { qNum: 3, isWrong: false, suaText: "Minimizar a redundância e melhorar a integridade dos dados." },
            { qNum: 4, isWrong: false, suaText: "Protege os dados do cliente ao encriptar as informações durante a transmissão." },
            { qNum: 5, isWrong: true, suaText: "Alternativa incorreta assinalada", correctText: "Conceito de chave estrangeira e integridade referencial." }
        ]
    },
    {
        id: "demo_2",
        studentName: "Beatriz Ribeiro Santos",
        studentClass: "3º Técnico",
        score: 10,
        totalQuestions: 10,
        percentage: 100,
        tempoFormatado: "22m 10s",
        tempoGastoSeg: 1330,
        violationsCount: 0,
        violations: [],
        detailedAnswers: []
    },
    {
        id: "demo_3",
        studentName: "Gabriel Souza Oliveira",
        studentClass: "3º Técnico",
        score: 7,
        totalQuestions: 10,
        percentage: 70,
        tempoFormatado: "29m 04s",
        tempoGastoSeg: 1744,
        violationsCount: 2,
        violations: [
            "14:12:05 - Mudou de aba / alt+tab",
            "14:12:40 - Retornou à aba da prova"
        ],
        detailedAnswers: []
    },
    {
        id: "demo_4",
        studentName: "Matheus Henrique Lima",
        studentClass: "3º Técnico",
        score: 8,
        totalQuestions: 10,
        percentage: 80,
        tempoFormatado: "15m 19s",
        tempoGastoSeg: 919,
        violationsCount: 2,
        violations: [
            "14:05:12 - Tentou abrir DevTools (F12)",
            "14:05:15 - Tentou atalho Ctrl+Shift+C (inspecionar elemento)"
        ],
        detailedAnswers: []
    },
    {
        id: "demo_5",
        studentName: "Juliana Martins Costa",
        studentClass: "3º Técnico",
        score: 6,
        totalQuestions: 10,
        percentage: 60,
        tempoFormatado: "34m 50s",
        tempoGastoSeg: 2090,
        violationsCount: 0,
        violations: [],
        detailedAnswers: []
    },
    {
        id: "demo_6",
        studentName: "Rodrigo Almeida Pires",
        studentClass: "3º Técnico",
        score: 4,
        totalQuestions: 10,
        percentage: 40,
        tempoFormatado: "12m 02s",
        tempoGastoSeg: 722,
        violationsCount: 3,
        violations: [
            "14:02:10 - Perdeu foco da janela",
            "14:04:30 - Tentou copiar/colar/selecionar tudo",
            "14:04:32 - Mudou de aba / alt+tab"
        ],
        detailedAnswers: []
    }
];

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    setupAuthListeners();
    setupDashboardEventListeners();
    setupTabNavigation();
    setupQuestionCrudEvents();
});

// ============================================================
// 1. CAMADA DE AUTENTICAÇÃO E SEGURANÇA
// ============================================================
function setupAuthListeners() {
    const loginForm = document.getElementById('adminLoginForm');
    const logoutBtn = document.getElementById('btnLogout');
    const hintElem = document.getElementById('loginHint');

    if (isConfigured && auth) {
        hintElem.textContent = "🔒 Protegido via Firebase Authentication. Digite seu e-mail e senha cadastrados no console.";
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("Professor autenticado no Firebase:", user.email);
                showDashboard(user.email);
            } else {
                showLoginGate();
            }
        });
    } else {
        hintElem.innerHTML = `⚠️ Modo Demonstração / Offline: Use a senha <code class="px-1.5 py-0.5 bg-slate-100 font-bold text-indigo-700 rounded">${DEMO_MASTER_PASS}</code>`;
        
        const isLocalAuth = sessionStorage.getItem('admin_session_auth');
        const localEmail = sessionStorage.getItem('admin_session_email') || 'professor@escola.local';
        
        if (isLocalAuth === 'true') {
            showDashboard(localEmail);
        } else {
            showLoginGate();
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const errorAlert = document.getElementById('loginErrorAlert');
        const submitBtn = document.getElementById('btnSubmitLogin');

        errorAlert.classList.add('hidden');
        errorAlert.textContent = '';
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Autenticando...</span>`;

        try {
            if (isConfigured && auth) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                if (password === DEMO_MASTER_PASS || password === "admin123") {
                    sessionStorage.setItem('admin_session_auth', 'true');
                    sessionStorage.setItem('admin_session_email', email);
                    showDashboard(email);
                } else {
                    throw new Error(`Senha incorreta! No modo demonstração, use a senha "${DEMO_MASTER_PASS}".`);
                }
            }
        } catch (err) {
            console.error("Falha no login do professor:", err);
            errorAlert.textContent = getFriendlyErrorMessage(err);
            errorAlert.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Entrar no Painel</span><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>`;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (isConfigured && auth) {
            await signOut(auth);
        } else {
            sessionStorage.removeItem('admin_session_auth');
            sessionStorage.removeItem('admin_session_email');
            showLoginGate();
        }
    });
}

function showLoginGate() {
    if (unsubscribeSubmissions) {
        unsubscribeSubmissions();
        unsubscribeSubmissions = null;
    }
    document.getElementById('loginGate').classList.remove('hidden');
    document.getElementById('dashboardContainer').classList.add('hidden');
    document.getElementById('adminPassword').value = '';
}

async function showDashboard(teacherEmail) {
    document.getElementById('loginGate').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');
    document.getElementById('loggedTeacherEmail').textContent = teacherEmail;

    initFirebaseStatus();
    await loadQuestionsFromFirestoreOrFallback();

    if (isConfigured && db) {
        listenToSubmissionsRealtime();
    } else {
        submissions = demoSubmissions;
        updateDashboardMetrics();
        renderStudentsTable(submissions);
    }
}

function getFriendlyErrorMessage(err) {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        return "E-mail ou senha incorretos. Verifique suas credenciais de professor.";
    }
    if (err.code === 'auth/invalid-email') {
        return "Formato de e-mail inválido.";
    }
    if (err.code === 'auth/too-many-requests') {
        return "Muitas tentativas sem sucesso. Aguarde alguns instantes antes de tentar novamente.";
    }
    return err.message || "Erro ao efetuar autenticação.";
}

// ============================================================
// 2. NAVEGAÇÃO POR ABAS (RESULTADOS VS BANCO DE QUESTÕES)
// ============================================================
function setupTabNavigation() {
    const tabResults = document.getElementById('tabBtnResults');
    const tabQuestions = document.getElementById('tabBtnQuestions');
    const viewResults = document.getElementById('viewResults');
    const viewQuestions = document.getElementById('viewQuestions');

    tabResults.addEventListener('click', () => {
        currentTab = "results";
        tabResults.className = "pb-3 border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 transition";
        tabQuestions.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition";
        viewResults.classList.remove('hidden');
        viewQuestions.classList.add('hidden');
    });

    tabQuestions.addEventListener('click', () => {
        currentTab = "questions";
        tabQuestions.className = "pb-3 border-b-2 border-indigo-600 text-indigo-600 flex items-center gap-2 transition";
        tabResults.className = "pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center gap-2 transition";
        viewQuestions.classList.remove('hidden');
        viewResults.classList.add('hidden');
        renderQuestionsManager();
    });
}

// ============================================================
// 3. GESTÃO DE QUESTÕES NO FIREBASE (CRUD)
// ============================================================
async function loadQuestionsFromFirestoreOrFallback() {
    if (isConfigured && db) {
        try {
            console.log("Carregando questões do Firestore...");
            const qRef = collection(db, "provas", "simulado_1bim_3tec", "questoes");
            const qQuery = query(qRef, orderBy("ordem", "asc"));
            const snapshot = await getDocs(qQuery);

            if (!snapshot.empty) {
                questionsList = [];
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    questionsList.push({
                        id: docSnap.id,
                        ordem: data.ordem || 1,
                        question: data.enunciado || data.question,
                        enunciado: data.enunciado || data.question,
                        options: data.opcoes || data.options || [],
                        opcoes: data.opcoes || data.options || [],
                        correct: data.correta !== undefined ? data.correta : (data.correct !== undefined ? data.correct : 0),
                        correta: data.correta !== undefined ? data.correta : (data.correct !== undefined ? data.correct : 0)
                    });
                });
                console.log(`✅ ${questionsList.length} questões carregadas do Firestore!`);
                updateQuestionsBadges();
                renderQuestionsPerformance();
                renderQuestionsManager();
                return;
            }
        } catch (err) {
            console.warn("Erro ao buscar questões do Firestore, recorrendo a questions.json:", err);
        }
    }

    // Fallback: carregar de questions.json
    try {
        const response = await fetch('questions.json');
        const data = await response.json();
        questionsList = data.map((q, idx) => ({
            id: `q${idx + 1}`,
            ordem: idx + 1,
            question: q.question,
            enunciado: q.question,
            options: q.options,
            opcoes: q.options,
            correct: q.correct,
            correta: q.correct
        }));
        updateQuestionsBadges();
        renderQuestionsPerformance();
        renderQuestionsManager();
    } catch (e) {
        console.error("Erro ao carregar questions.json:", e);
    }
}

function updateQuestionsBadges() {
    const count = questionsList.length;
    document.getElementById('questionsCountBadge').textContent = `${count} Questões`;
    document.getElementById('tabQuestionsCountBadge').textContent = `${count}`;
}

function renderQuestionsManager() {
    const container = document.getElementById('questionsCardList');
    container.innerHTML = '';

    if (!questionsList || questionsList.length === 0) {
        container.innerHTML = `
            <div class="bg-white border border-slate-200 p-8 rounded-2xl text-center space-y-3">
                <p class="text-slate-500 text-sm">Nenhuma questão cadastrada no banco de dados.</p>
                <button id="btnSeedEmpty" class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow">
                    Importar 10 Questões Iniciais
                </button>
            </div>
        `;
        const btnEmpty = document.getElementById('btnSeedEmpty');
        if (btnEmpty) btnEmpty.addEventListener('click', seedDefaultQuestions);
        return;
    }

    questionsList.forEach((q, idx) => {
        const card = document.createElement('div');
        card.className = "bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 hover:border-slate-300 transition";
        
        let optionsHtml = '';
        const letras = ['A', 'B', 'C', 'D', 'E'];
        const options = q.opcoes || q.options || [];
        const correctIdx = q.correta !== undefined ? q.correta : q.correct;

        options.forEach((opt, optIdx) => {
            const isCorrect = (optIdx === correctIdx);
            optionsHtml += `
                <div class="flex items-start gap-3 p-2.5 rounded-xl text-xs ${isCorrect ? 'bg-emerald-50 border border-emerald-200 font-semibold text-emerald-800' : 'bg-slate-50 border border-slate-100 text-slate-700'}">
                    <span class="px-2 py-0.5 rounded-md font-bold ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}">
                        ${letras[optIdx] || optIdx + 1}
                    </span>
                    <span class="flex-1 mt-0.5">${opt}</span>
                    ${isCorrect ? `<span class="text-emerald-600 font-bold ml-2">✓ Resposta Correta</span>` : ''}
                </div>
            `;
        });

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div class="space-y-1 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">Questão ${q.ordem || idx + 1}</span>
                        <span class="text-[11px] text-slate-400 font-mono">ID: ${q.id}</span>
                    </div>
                    <h3 class="text-sm font-bold text-slate-900 leading-relaxed pt-1">${q.enunciado || q.question}</h3>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <button data-id="${q.id}" class="btn-edit-q px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        Editar
                    </button>
                    <button data-id="${q.id}" class="btn-del-q px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        Excluir
                    </button>
                </div>
            </div>

            <div class="space-y-1.5 pt-2">
                ${optionsHtml}
            </div>
        `;
        container.appendChild(card);
    });

    // Eventos dos botões Editar e Excluir
    document.querySelectorAll('.btn-edit-q').forEach(btn => {
        btn.addEventListener('click', () => {
            const qId = btn.getAttribute('data-id');
            openEditQuestionModal(qId);
        });
    });

    document.querySelectorAll('.btn-del-q').forEach(btn => {
        btn.addEventListener('click', async () => {
            const qId = btn.getAttribute('data-id');
            await deleteQuestion(qId);
        });
    });
}

function setupQuestionCrudEvents() {
    const btnNew = document.getElementById('btnOpenNewQuestionModal');
    const btnSeed = document.getElementById('btnSeedQuestions');
    const modal = document.getElementById('questionModal');
    const modalClose = document.getElementById('questionModalCloseBtn');
    const modalCancel = document.getElementById('questionModalCancelBtn');
    const qForm = document.getElementById('questionForm');

    btnNew.addEventListener('click', () => {
        openNewQuestionModal();
    });

    btnSeed.addEventListener('click', seedDefaultQuestions);

    modalClose.addEventListener('click', () => modal.classList.add('hidden'));
    modalCancel.addEventListener('click', () => modal.classList.add('hidden'));

    qForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveQuestionFromModal();
    });
}

function openNewQuestionModal() {
    document.getElementById('questionModalTitle').textContent = "Nova Questão no Firebase";
    document.getElementById('editQuestionId').value = "";
    document.getElementById('qOrdem').value = questionsList.length + 1;
    document.getElementById('qEnunciado').value = "";
    document.getElementById('opt0').value = "";
    document.getElementById('opt1').value = "";
    document.getElementById('opt2').value = "";
    document.getElementById('opt3').value = "";
    document.getElementById('opt4').value = "";

    const radios = document.getElementsByName('optCorreta');
    radios.forEach((r, idx) => r.checked = (idx === 0));

    document.getElementById('questionModal').classList.remove('hidden');
}

function openEditQuestionModal(qId) {
    const q = questionsList.find(item => item.id === qId);
    if (!q) return;

    document.getElementById('questionModalTitle').textContent = `Editar Questão ${q.ordem || ''}`;
    document.getElementById('editQuestionId').value = q.id;
    document.getElementById('qOrdem').value = q.ordem || 1;
    document.getElementById('qEnunciado').value = q.enunciado || q.question || "";

    const options = q.opcoes || q.options || [];
    document.getElementById('opt0').value = options[0] || "";
    document.getElementById('opt1').value = options[1] || "";
    document.getElementById('opt2').value = options[2] || "";
    document.getElementById('opt3').value = options[3] || "";
    document.getElementById('opt4').value = options[4] || "";

    const correctIdx = q.correta !== undefined ? q.correta : q.correct;
    const radios = document.getElementsByName('optCorreta');
    radios.forEach((r, idx) => {
        r.checked = (idx === Number(correctIdx));
    });

    document.getElementById('questionModal').classList.remove('hidden');
}

async function saveQuestionFromModal() {
    const editId = document.getElementById('editQuestionId').value;
    const ordem = parseInt(document.getElementById('qOrdem').value) || (questionsList.length + 1);
    const enunciado = document.getElementById('qEnunciado').value.trim();

    const options = [
        document.getElementById('opt0').value.trim(),
        document.getElementById('opt1').value.trim(),
        document.getElementById('opt2').value.trim(),
        document.getElementById('opt3').value.trim(),
        document.getElementById('opt4').value.trim()
    ].filter(opt => opt.length > 0);

    if (options.length < 2) {
        alert("A questão precisa de no mínimo 2 alternativas!");
        return;
    }

    let correta = 0;
    const radios = document.getElementsByName('optCorreta');
    radios.forEach((r, idx) => {
        if (r.checked) correta = idx;
    });

    if (correta >= options.length) {
        correta = 0;
    }

    const questionDocId = editId ? editId : `q${ordem}_${Date.now().toString().slice(-4)}`;
    const questionPayload = {
        ordem: ordem,
        enunciado: enunciado,
        opcoes: options,
        correta: correta
    };

    const saveBtn = document.getElementById('btnSaveQuestion');
    saveBtn.disabled = true;
    saveBtn.textContent = "Salvando...";

    try {
        if (isConfigured && db) {
            // Salvar no Firestore
            await setDoc(doc(db, "provas", "simulado_1bim_3tec", "questoes", questionDocId), questionPayload);
            console.log(`Questão ${questionDocId} gravada com sucesso no Firestore.`);
        }

        // Atualizar lista local na memória
        const existingIdx = questionsList.findIndex(q => q.id === questionDocId);
        const updatedItem = {
            id: questionDocId,
            ordem: ordem,
            enunciado: enunciado,
            question: enunciado,
            opcoes: options,
            options: options,
            correta: correta,
            correct: correta
        };

        if (existingIdx >= 0) {
            questionsList[existingIdx] = updatedItem;
        } else {
            questionsList.push(updatedItem);
        }

        questionsList.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

        updateQuestionsBadges();
        renderQuestionsPerformance();
        renderQuestionsManager();

        document.getElementById('questionModal').classList.add('hidden');
        alert("Questão salva com sucesso no banco de dados!");
    } catch (err) {
        console.error("Erro ao salvar questão:", err);
        alert(`Erro ao salvar questão: ${err.message}`);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Salvar no Firebase";
    }
}

async function deleteQuestion(qId) {
    if (!confirm(`Tem certeza que deseja excluir a questão ID "${qId}"?`)) {
        return;
    }

    try {
        if (isConfigured && db) {
            await deleteDoc(doc(db, "provas", "simulado_1bim_3tec", "questoes", qId));
        }

        questionsList = questionsList.filter(q => q.id !== qId);
        updateQuestionsBadges();
        renderQuestionsPerformance();
        renderQuestionsManager();
        alert("Questão excluída com sucesso.");
    } catch (err) {
        console.error("Erro ao excluir questão:", err);
        alert(`Erro ao excluir: ${err.message}`);
    }
}

async function seedDefaultQuestions() {
    if (!confirm("Isso irá importar as 10 questões padrão de 'questions.json' para o Firestore. Deseja continuar?")) {
        return;
    }

    try {
        const response = await fetch('questions.json');
        const defaultData = await response.json();

        if (isConfigured && db) {
            await seedQuestionsToFirestore(defaultData);
        }

        await loadQuestionsFromFirestoreOrFallback();
        alert("10 questões padrão sincronizadas com sucesso no Firestore!");
    } catch (err) {
        console.error("Erro ao restaurar questões padrão:", err);
        alert(`Erro: ${err.message}`);
    }
}

// ============================================================
// 4. PAINEL DE CONTROLE E MÉTRICAS EM TEMPO REAL
// ============================================================
function initFirebaseStatus() {
    const badge = document.getElementById('firebaseStatusBadge');
    if (isConfigured && db) {
        badge.className = "text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-medium";
        badge.textContent = "🟢 Conectado ao Cloud Firestore";
    } else {
        badge.className = "text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium";
        badge.textContent = "🟡 Modo Demonstração";
    }
}

function listenToSubmissionsRealtime() {
    try {
        const subRef = collection(db, "submissoes");
        unsubscribeSubmissions = onSnapshot(subRef, (snapshot) => {
            submissions = [];
            snapshot.forEach((docSnap) => {
                submissions.push({ id: docSnap.id, ...docSnap.data() });
            });
            console.log(`Submissões atualizadas via Firestore: ${submissions.length} registros`);
            updateDashboardMetrics();
            filterAndRender();
        }, (error) => {
            console.error("Erro ao escutar submissões do Firestore:", error);
            submissions = demoSubmissions;
            updateDashboardMetrics();
            filterAndRender();
        });
    } catch (e) {
        console.warn("Erro ao configurar listener do Firestore:", e);
    }
}

function updateDashboardMetrics() {
    if (submissions.length === 0) {
        document.getElementById('statAvgScore').innerHTML = `-- <span class="text-base text-slate-400 font-normal">/ 10</span>`;
        document.getElementById('statAvgPercent').textContent = "Aguardando submissões...";
        document.getElementById('statTotalSubmissions').textContent = "0";
        document.getElementById('statAvgTime').textContent = "--";
        document.getElementById('statViolationsCount').textContent = "0";
        return;
    }

    const total = submissions.length;
    let sumScore = 0;
    let sumSeconds = 0;
    let violationsTotal = 0;

    let cExec = 0; // 9 - 10
    let cBom = 0;  // 7 - 8.9
    let cReg = 0;  // 5 - 6.9
    let cCrit = 0; // < 5

    submissions.forEach(s => {
        const score = Number(s.score || 0);
        sumScore += score;
        sumSeconds += Number(s.tempoGastoSeg || 0);
        if (s.violationsCount > 0 || (s.violations && s.violations.length > 0)) {
            violationsTotal++;
        }

        const pct = (score / (s.totalQuestions || 10)) * 100;
        if (pct >= 90) cExec++;
        else if (pct >= 70) cBom++;
        else if (pct >= 50) cReg++;
        else cCrit++;
    });

    const avgScore = (sumScore / total).toFixed(1);
    const avgSec = Math.round(sumSeconds / total);
    const avgMin = Math.floor(avgSec / 60);
    const avgRemainingSec = avgSec % 60;

    document.getElementById('statAvgScore').innerHTML = `${avgScore} <span class="text-base text-slate-400 font-normal">/ 10</span>`;
    document.getElementById('statAvgPercent').textContent = `Taxa média: ${Math.round((avgScore / 10) * 100)}% de acertos`;
    document.getElementById('statTotalSubmissions').textContent = total;
    document.getElementById('statAvgTime').textContent = `${avgMin}m ${avgRemainingSec}s`;
    document.getElementById('statViolationsCount').textContent = `${violationsTotal} aluno(s)`;

    // Distribuição das Notas
    const pExec = Math.round((cExec / total) * 100);
    const pBom = Math.round((cBom / total) * 100);
    const pReg = Math.round((cReg / total) * 100);
    const pCrit = Math.round((cCrit / total) * 100);

    document.getElementById('distExecCount').textContent = `${cExec} alunos (${pExec}%)`;
    document.getElementById('distExecBar').style.width = `${pExec}%`;

    document.getElementById('distBomCount').textContent = `${cBom} alunos (${pBom}%)`;
    document.getElementById('distBomBar').style.width = `${pBom}%`;

    document.getElementById('distRegCount').textContent = `${cReg} alunos (${pReg}%)`;
    document.getElementById('distRegBar').style.width = `${pReg}%`;

    document.getElementById('distCritCount').textContent = `${cCrit} alunos (${pCrit}%)`;
    document.getElementById('distCritBar').style.width = `${pCrit}%`;

    renderQuestionsPerformance();
}

function renderQuestionsPerformance() {
    const container = document.getElementById('questionsPerformanceList');
    if (!questionsList || questionsList.length === 0) return;

    container.innerHTML = '';
    const totalSub = submissions.length;

    questionsList.forEach((q, idx) => {
        const qNum = q.ordem || (idx + 1);
        let acertos = 0;

        if (totalSub > 0) {
            submissions.forEach(s => {
                if (s.detailedAnswers && s.detailedAnswers.length > 0) {
                    const ans = s.detailedAnswers.find(a => a.qNum === qNum);
                    if (ans && !ans.isWrong) acertos++;
                } else if (s.answers && s.answers[`q${qNum}`] !== undefined) {
                    const expectedCorrect = q.correta !== undefined ? q.correta : q.correct;
                    if (expectedCorrect !== undefined && s.answers[`q${qNum}`] === expectedCorrect) {
                        acertos++;
                    }
                }
            });
        }

        const rate = totalSub > 0 ? Math.round((acertos / totalSub) * 100) : 75;
        
        let colorClass = "bg-emerald-500";
        let textClass = "text-emerald-600";
        let statusBadge = "";

        if (rate < 50) {
            colorClass = "bg-rose-500";
            textClass = "text-rose-600 font-bold";
            statusBadge = `<span class="ml-2 text-rose-500 text-[11px] font-semibold">⚠️ Ponto Crítico</span>`;
        } else if (rate < 70) {
            colorClass = "bg-amber-500";
            textClass = "text-amber-600 font-bold";
            statusBadge = `<span class="ml-2 text-amber-500 text-[11px] font-semibold">Atenção</span>`;
        }

        const div = document.createElement('div');
        div.className = "space-y-1";
        div.innerHTML = `
            <div class="flex justify-between text-xs font-medium">
                <span class="truncate max-w-[75%] text-slate-700" title="${q.enunciado || q.question}">
                    <strong>Q${qNum}.</strong> ${q.enunciado || q.question}
                </span>
                <span class="${textClass}">${rate}% acertos (${acertos}/${totalSub || 0}) ${statusBadge}</span>
            </div>
            <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div class="${colorClass} h-2 rounded-full transition-all duration-500" style="width: ${rate}%"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderStudentsTable(data) {
    const tbody = document.getElementById('studentsTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
              <td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm">
                Nenhum aluno encontrado para os filtros selecionados.
              </td>
            </tr>
        `;
        return;
    }

    data.forEach(s => {
        const violationsCount = s.violationsCount || (s.violations ? s.violations.length : 0);
        const hasViolations = violationsCount > 0;
        const totalQ = s.totalQuestions || questionsList.length || 10;
        const score = s.score !== undefined ? s.score : 0;
        const pct = Math.round((score / totalQ) * 100);

        let badgeScore = "bg-emerald-50 text-emerald-700 border-emerald-200";
        if (pct < 60) badgeScore = "bg-rose-50 text-rose-700 border-rose-200";
        else if (pct < 80) badgeScore = "bg-amber-50 text-amber-700 border-amber-200";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition";
        tr.innerHTML = `
            <td class="px-6 py-4 font-medium text-slate-900">${s.studentName || 'Não identificado'}</td>
            <td class="px-6 py-4 text-slate-500">${s.studentClass || '3º Técnico'}</td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeScore}">
                    ${score} / ${totalQ} (${pct}%)
                </span>
            </td>
            <td class="px-6 py-4 text-slate-500 font-mono text-xs">${s.tempoFormatado || (s.tempoGastoSeg ? `${Math.floor(s.tempoGastoSeg/60)}m` : '--')}</td>
            <td class="px-6 py-4">
                ${hasViolations
                    ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ${violationsCount} alerta(s)
                       </span>`
                    : `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Íntegro
                       </span>`
                }
            </td>
            <td class="px-6 py-4 text-right">
                <button data-id="${s.id}" class="btn-detail text-indigo-600 hover:text-indigo-800 font-semibold text-xs hover:underline">
                    Ver Raio-X
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-detail').forEach(btn => {
        btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-id');
            showStudentDetails(sid);
        });
    });
}

function filterAndRender() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    const status = document.getElementById('statusFilter').value;

    currentFilteredList = submissions.filter(s => {
        const matchesName = (s.studentName || '').toLowerCase().includes(q);
        const vCount = s.violationsCount || (s.violations ? s.violations.length : 0);
        
        let matchesStatus = true;
        if (status === 'alert') matchesStatus = vCount > 0;
        if (status === 'clean') matchesStatus = vCount === 0;

        return matchesName && matchesStatus;
    });

    renderStudentsTable(currentFilteredList);
}

function showStudentDetails(submissionId) {
    const student = submissions.find(s => s.id === submissionId);
    if (!student) return;

    document.getElementById('modalStudentName').textContent = student.studentName;
    document.getElementById('modalStudentInfo').textContent = `Turma: ${student.studentClass} | Pontuação: ${student.score}/${student.totalQuestions || questionsList.length || 10} | Duração: ${student.tempoFormatado || '--'}`;

    const vList = document.getElementById('modalViolationsList');
    vList.innerHTML = '';
    const violations = student.violations || [];
    if (violations.length === 0 && (!student.violationsCount || student.violationsCount === 0)) {
        vList.innerHTML = `<p class="text-emerald-700">Nenhum registro de troca de aba, tecla de DevTools ou inspeção de código.</p>`;
    } else {
        if (violations.length > 0) {
            violations.forEach(v => {
                const p = document.createElement('p');
                p.className = 'text-rose-600';
                p.textContent = `⚠️ ${v}`;
                vList.appendChild(p);
            });
        } else {
            vList.innerHTML = `<p class="text-rose-600">⚠️ ${student.violationsCount} violação(ões) registrada(s) no momento da prova.</p>`;
        }
    }

    const aList = document.getElementById('modalAnswersList');
    aList.innerHTML = '';
    if (student.detailedAnswers && student.detailedAnswers.length > 0) {
        student.detailedAnswers.forEach(ans => {
            const div = document.createElement('div');
            div.className = `p-2 rounded-lg border ${ans.isWrong ? 'bg-rose-50/50 border-rose-200' : 'bg-emerald-50/50 border-emerald-200'}`;
            div.innerHTML = `
                <div class="font-semibold text-slate-800">Questão ${ans.qNum}:</div>
                <div class="text-slate-600">Resposta: <span class="${ans.isWrong ? 'text-rose-600 line-through' : 'text-emerald-700 font-medium'}">${ans.suaText}</span></div>
                ${ans.isWrong && ans.correctText ? `<div class="text-emerald-700 mt-1">Gabarito: ${ans.correctText}</div>` : ''}
            `;
            aList.appendChild(div);
        });
    } else {
        aList.innerHTML = `<p class="text-slate-400">Respostas detalhadas não disponíveis nesta versão.</p>`;
    }

    document.getElementById('studentModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('studentModal').classList.add('hidden');
}

function exportCSV() {
    if (submissions.length === 0) {
        alert("Nenhuma submissão para exportar!");
        return;
    }

    let csvContent = "\uFEFF";
    csvContent += "ID,Aluno,Turma,Nota,Questoes,Percentual,Tempo,Alertas_Violacao\n";

    submissions.forEach(s => {
        const vCount = s.violationsCount || (s.violations ? s.violations.length : 0);
        const totalQ = s.totalQuestions || questionsList.length || 10;
        const line = [
            `"${s.id}"`,
            `"${s.studentName || ''}"`,
            `"${s.studentClass || ''}"`,
            s.score || 0,
            totalQ,
            `${s.percentage || 0}%`,
            `"${s.tempoFormatado || ''}"`,
            vCount
        ].join(",");
        csvContent += line + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `notas_prova_3tecnico_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function setupDashboardEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterAndRender);
    document.getElementById('statusFilter').addEventListener('change', filterAndRender);
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
    
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalCloseBtn2').addEventListener('click', closeModal);
}
