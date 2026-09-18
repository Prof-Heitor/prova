import { db, auth, isConfigured, collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, writeBatch, signInWithEmailAndPassword } from "./firebase-config.js";
import { requireRole, logoutUser, registerStudent } from "./auth.js";
import { showToast } from "./toast.js";
import { seedQuestionsToFirestore } from "./seed_firestore.js";
import { formatTime, formatDate, generateId, sanitizeHtml, debounce, getInitials, getAvatarColor } from "./helpers.js";

// DOM Elements
const sections = document.querySelectorAll('.section-content');
const navBtns = document.querySelectorAll('.nav-btn');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const sidebar = document.getElementById('sidebar');
const topbarTitle = document.getElementById('topbarTitle');
const btnLogout = document.getElementById('btnLogout');
const teacherEmail = document.getElementById('teacherEmail');
const fbStatusText = document.getElementById('fbStatusText');
const fbStatusDot = document.getElementById('fbStatusDot');

// State
let currentTeacher = null;
let provasMap = new Map();
let currentGerenciarProvaId = null;

// Initialize
async function init() {
    // UI Setup
    if (isConfigured) {
        fbStatusText.textContent = "Online";
        fbStatusDot.classList.replace('bg-gray-400', 'bg-green-500');
    } else {
        fbStatusText.textContent = "Modo Demonstração";
        fbStatusDot.classList.replace('bg-gray-400', 'bg-yellow-500');
    }

    try {
        const result = await requireRole('professor');
        currentTeacher = result.user;
        teacherEmail.textContent = result.profile.nome || result.user.email;
    } catch (e) {
        console.error("Auth erro:", e);
        return; // requireRole redirects to login
    }

    setupNavigation();
    setupListeners();
    
    // Load initial section
    loadDashboardData();
}

function setupNavigation() {
    toggleSidebarBtn.addEventListener('click', () => {
        const isExpanded = sidebar.classList.contains('sidebar-expanded');
        if (isExpanded) {
            sidebar.classList.remove('sidebar-expanded');
            sidebar.classList.add('sidebar-collapsed');
            document.querySelectorAll('.nav-label').forEach(el => el.classList.add('hide-text'));
        } else {
            sidebar.classList.add('sidebar-expanded');
            sidebar.classList.remove('sidebar-collapsed');
            document.querySelectorAll('.nav-label').forEach(el => el.classList.remove('hide-text'));
        }
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            
            // UI classes
            navBtns.forEach(b => b.classList.remove('bg-indigo-800', 'border-l-4', 'border-indigo-400'));
            btn.classList.add('bg-indigo-800', 'border-l-4', 'border-indigo-400');
            
            // Hide all sections
            sections.forEach(sec => sec.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
            
            // Update Title
            topbarTitle.textContent = btn.querySelector('.nav-label').textContent;

            // Load data based on section
            if (targetId === 'secDashboard') loadDashboardData();
            if (targetId === 'secMonitor') loadMonitorData();
            if (targetId === 'secProvas') loadProvasData();
            if (targetId === 'secAlunos') loadAlunosData();
            if (targetId === 'secRelatorios') loadRelatoriosData();
        });
    });

    btnLogout.addEventListener('click', async () => {
        await logoutUser();
    });
}

function setupListeners() {
    // Modals generic close
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.fixed');
            if (modal) modal.classList.add('hidden');
        });
    });
    
    // Provas
    document.getElementById('btnNovaProva').addEventListener('click', () => {
        document.getElementById('formProva').reset();
        document.getElementById('provaId').value = '';
        document.getElementById('modalProvaTitle').textContent = 'Nova Prova';
        document.getElementById('modalProva').classList.remove('hidden');
    });

    document.getElementById('formProva').addEventListener('submit', handleSaveProva);
    
    // Questoes
    document.querySelectorAll('.close-modal-questao').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('modalEditQuestao').classList.add('hidden');
        });
    });
    document.getElementById('btnNovaQuestao').addEventListener('click', () => {
        document.getElementById('formQuestao').reset();
        document.getElementById('qId').value = '';
        document.getElementById('modalQuestaoTitle').textContent = 'Nova Questão';
        document.getElementById('modalEditQuestao').classList.remove('hidden');
    });
    document.getElementById('formQuestao').addEventListener('submit', handleSaveQuestao);

    // Alunos
    document.getElementById('btnNovoAluno').addEventListener('click', () => {
        document.getElementById('formAluno').reset();
        document.getElementById('alSenha').value = Math.random().toString(36).slice(-8); // auto pass
        document.getElementById('modalAluno').classList.remove('hidden');
    });
    document.getElementById('formAluno').addEventListener('submit', handleSaveAluno);
}

// ---------------------------
// Dashboard
// ---------------------------
let unsubDashboard = null;
function loadDashboardData() {
    if (!isConfigured) return;
    if (unsubDashboard) unsubDashboard();

    const subsQuery = query(collection(db, "submissoes"), orderBy("criadoEm", "desc"));
    
    unsubDashboard = onSnapshot(subsQuery, (snapshot) => {
        let totalSubs = 0;
        let totalScore = 0;
        let totalTime = 0;
        let totalViols = 0;
        let scoreBands = { ex: 0, bom: 0, reg: 0, crit: 0 };
        const tableBody = document.getElementById('dashTableBody');
        tableBody.innerHTML = '';
        
        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-400">Nenhuma submissão encontrada</td></tr>';
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            totalSubs++;
            totalScore += data.score || 0;
            totalTime += data.tempoGastoSeg || 0;
            totalViols += data.violationsCount || 0;

            const perc = data.percentage || 0;
            if (perc >= 90) scoreBands.ex++;
            else if (perc >= 70) scoreBands.bom++;
            else if (perc >= 50) scoreBands.reg++;
            else scoreBands.crit++;

            // Render row
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-medium">${data.studentName}</td>
                <td>${data.studentClass || '-'}</td>
                <td>${data.score} / ${data.totalQuestions} (${data.percentage}%)</td>
                <td>${data.tempoFormatado || '-'}</td>
                <td>
                    ${data.violationsCount > 0 
                        ? `<span class="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-medium">${data.violationsCount} violações</span>` 
                        : `<span class="text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded text-xs font-medium">OK</span>`}
                </td>
                <td class="text-center">
                    <button class="text-indigo-600 hover:text-indigo-800 text-sm font-medium btn-raiox" data-id="${docSnap.id}">Raio-X</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.getElementById('dashMediaGeral').textContent = totalSubs ? (totalScore/totalSubs).toFixed(1) : '0.0';
        document.getElementById('dashTotalEntregas').textContent = totalSubs;
        document.getElementById('dashTempoMedio').textContent = totalSubs ? Math.floor((totalTime/totalSubs)/60) + 'm' : '0m';
        document.getElementById('dashAlertas').textContent = totalViols;
        
        // Attach Raio-X
        document.querySelectorAll('.btn-raiox').forEach(btn => {
            btn.addEventListener('click', (e) => openRaioX(e.target.dataset.id));
        });
    });
}

async function openRaioX(subId) {
    if(!isConfigured) return;
    const docSnap = await getDoc(doc(db, "submissoes", subId));
    if(!docSnap.exists()) return;
    const data = docSnap.data();

    document.getElementById('rxStudentName').textContent = data.studentName;
    document.getElementById('rxScore').textContent = `${data.percentage}%`;
    document.getElementById('rxTime').textContent = data.tempoFormatado || '-';
    document.getElementById('rxViolations').textContent = data.violationsCount || 0;

    // Load Violations
    const vList = document.getElementById('rxViolationsList');
    vList.innerHTML = '';
    if(data.violationsCount > 0) {
        const vQ = query(collection(db, "violacoes"), where("submissionId", "==", subId));
        const vSnap = await getDocs(vQ);
        vSnap.forEach(v => {
            const vd = v.data();
            const li = document.createElement('li');
            li.textContent = `[${new Date(vd.loggedAt).toLocaleTimeString()}] ${vd.action}`;
            vList.appendChild(li);
        });
    } else {
        vList.innerHTML = '<li>Nenhuma violação.</li>';
    }

    // Answers
    const aList = document.getElementById('rxAnswersList');
    aList.innerHTML = '';
    (data.detailedAnswers || []).forEach((ans, i) => {
        const div = document.createElement('div');
        div.className = `p-3 rounded border text-sm ${ans.acertou ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`;
        div.innerHTML = `
            <p class="font-medium mb-1">Q${i+1}. ${ans.enunciado}</p>
            <p class="text-slate-600">Sua resposta: <span class="font-bold">${ans.respostaAluno || '-'}</span></p>
            ${!ans.acertou ? `<p class="text-emerald-700 mt-1">Gabarito: <span class="font-bold">${ans.correta}</span></p>` : ''}
        `;
        aList.appendChild(div);
    });

    document.getElementById('modalRaioX').classList.remove('hidden');
}

// ---------------------------
// Monitor
// ---------------------------
let unsubMonitor = null;
function loadMonitorData() {
    if (!isConfigured) return;
    if (unsubMonitor) unsubMonitor();

    unsubMonitor = onSnapshot(collection(db, "alunos_online"), (snapshot) => {
        const grid = document.getElementById('monitorGrid');
        const empty = document.getElementById('monitorEmpty');
        const badge = document.getElementById('onlineBadge');
        const statusBadge = document.getElementById('monitorStatusBadge');
        
        let onlineCount = 0;
        grid.innerHTML = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if(data.status !== 'em_prova') return;
            onlineCount++;

            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-2';
            
            const now = Date.now();
            const diff = (now - data.ultimoHeartbeat) / 1000;
            let statusColor = 'bg-emerald-500';
            if (diff > 120) statusColor = 'bg-red-500';
            else if (diff > 60) statusColor = 'bg-amber-500';

            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-slate-800 text-sm truncate">${data.studentName}</h4>
                        <p class="text-xs text-slate-500">${data.provaId || 'Prova'}</p>
                    </div>
                    <div class="w-3 h-3 rounded-full ${statusColor} shadow"></div>
                </div>
                <div class="mt-2 bg-slate-50 p-2 rounded border border-slate-100 text-xs text-slate-600 space-y-1">
                    <p><i class="fas fa-tasks w-4"></i> Questão: ${data.questaoAtual}/${data.totalQuestoes}</p>
                </div>
            `;
            grid.appendChild(card);
        });

        if (onlineCount > 0) {
            grid.classList.remove('hidden');
            empty.classList.add('hidden');
            badge.textContent = onlineCount;
            badge.classList.remove('hidden');
            statusBadge.textContent = `${onlineCount} aluno(s) online agora`;
        } else {
            grid.classList.add('hidden');
            empty.classList.remove('hidden');
            badge.classList.add('hidden');
            statusBadge.textContent = `0 alunos online agora`;
        }
    });
}

// ---------------------------
// Provas
// ---------------------------
async function loadProvasData() {
    if (!isConfigured) return;
    const list = document.getElementById('provasList');
    list.innerHTML = '<p class="text-slate-500">Carregando...</p>';
    
    try {
        const snap = await getDocs(query(collection(db, "provas"), orderBy("criadoEm", "desc")));
        list.innerHTML = '';
        provasMap.clear();

        if (snap.empty) {
            list.innerHTML = '<p class="text-slate-500">Nenhuma prova cadastrada.</p>';
            return;
        }

        snap.forEach(docSnap => {
            const data = docSnap.data();
            provasMap.set(docSnap.id, data);
            
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col';
            card.innerHTML = `
                <div class="p-4 border-b border-slate-100">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-slate-800 text-lg line-clamp-1" title="${data.titulo}">${data.titulo}</h3>
                        <span class="${data.ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} text-xs px-2 py-1 rounded font-medium">${data.ativa ? 'Ativa' : 'Encerrada'}</span>
                    </div>
                    <p class="text-sm text-slate-500"><i class="fas fa-book mr-1"></i> ${data.disciplina} | <i class="fas fa-users mr-1"></i> ${data.turma}</p>
                    <p class="text-sm text-slate-500 mt-1"><i class="fas fa-clock mr-1"></i> ${data.tempoLimiteMin} min | <i class="fas fa-eye mr-1"></i> Res: ${data.resultadosLiberados ? 'Lib.' : 'Bloq.'}</p>
                </div>
                <div class="p-3 bg-slate-50 flex flex-wrap gap-2 mt-auto">
                    <button class="flex-1 min-w-[100px] text-xs bg-white border border-slate-200 text-slate-700 py-1.5 rounded hover:bg-slate-100 btn-edit-prova" data-id="${docSnap.id}">Editar</button>
                    <button class="flex-1 min-w-[100px] text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 py-1.5 rounded hover:bg-indigo-100 btn-questoes" data-id="${docSnap.id}">Questões</button>
                    <button class="flex-1 min-w-[100px] text-xs ${data.ativa ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'} py-1.5 rounded border btn-toggle-ativa" data-id="${docSnap.id}">${data.ativa ? 'Encerrar' : 'Ativar'}</button>
                    <button class="flex-1 min-w-[100px] text-xs ${data.resultadosLiberados ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'} py-1.5 rounded border btn-toggle-resultados" data-id="${docSnap.id}">${data.resultadosLiberados ? 'Ocultar Res.' : 'Liberar Res.'}</button>
                </div>
            `;
            list.appendChild(card);
        });

        document.querySelectorAll('.btn-edit-prova').forEach(b => b.addEventListener('click', e => editProva(e.target.dataset.id)));
        document.querySelectorAll('.btn-questoes').forEach(b => b.addEventListener('click', e => openGerenciarQuestoes(e.target.dataset.id)));
        document.querySelectorAll('.btn-toggle-ativa').forEach(b => b.addEventListener('click', e => toggleProvaAtiva(e.target.dataset.id)));
        document.querySelectorAll('.btn-toggle-resultados').forEach(b => b.addEventListener('click', e => toggleResultados(e.target.dataset.id)));
        
    } catch(e) {
        showToast("Erro ao carregar provas", "error");
        console.error(e);
    }
}

async function handleSaveProva(e) {
    e.preventDefault();
    if(!isConfigured) return;
    
    const id = document.getElementById('provaId').value;
    const data = {
        titulo: document.getElementById('provaTitulo').value,
        disciplina: document.getElementById('provaDisciplina').value,
        turma: document.getElementById('provaTurma').value,
        tempoLimiteMin: parseInt(document.getElementById('provaTempo').value, 10),
        embaralhar: document.getElementById('provaEmbaralhar').checked
    };

    try {
        if(id) {
            await updateDoc(doc(db, "provas", id), data);
            showToast("Prova atualizada!", "success");
        } else {
            data.ativa = false;
            data.resultadosLiberados = false;
            data.criadoEm = new Date().toISOString();
            data.criadoPor = auth.currentUser.uid;
            
            const newRef = doc(collection(db, "provas"));
            await setDoc(newRef, data);
            showToast("Prova criada!", "success");
        }
        document.getElementById('modalProva').classList.add('hidden');
        loadProvasData();
    } catch(err) {
        showToast("Erro ao salvar", "error");
        console.error(err);
    }
}

function editProva(id) {
    const data = provasMap.get(id);
    if(!data) return;
    document.getElementById('provaId').value = id;
    document.getElementById('provaTitulo').value = data.titulo;
    document.getElementById('provaDisciplina').value = data.disciplina;
    document.getElementById('provaTurma').value = data.turma;
    document.getElementById('provaTempo').value = data.tempoLimiteMin;
    document.getElementById('provaEmbaralhar').checked = data.embaralhar;
    
    document.getElementById('modalProvaTitle').textContent = 'Editar Prova';
    document.getElementById('modalProva').classList.remove('hidden');
}

async function toggleProvaAtiva(id) {
    const data = provasMap.get(id);
    if(!data) return;
    try {
        await updateDoc(doc(db, "provas", id), { ativa: !data.ativa });
        showToast(data.ativa ? "Prova encerrada" : "Prova ativada", "success");
        loadProvasData();
    } catch(e) {
        showToast("Erro ao alterar status", "error");
    }
}

async function toggleResultados(id) {
    const data = provasMap.get(id);
    if(!data) return;
    try {
        const novoStatus = !data.resultadosLiberados;
        await updateDoc(doc(db, "provas", id), { resultadosLiberados: novoStatus });
        await setDoc(doc(db, "resultados_liberados", id), {
            liberado: novoStatus,
            liberadoEm: new Date().toISOString(),
            liberadoPor: auth.currentUser.uid
        }, { merge: true });
        showToast(novoStatus ? "Resultados liberados" : "Resultados ocultados", "success");
        loadProvasData();
    } catch(e) {
        showToast("Erro ao alterar status", "error");
    }
}

// ---------------------------
// Questões
// ---------------------------
async function openGerenciarQuestoes(provaId) {
    currentGerenciarProvaId = provaId;
    const data = provasMap.get(provaId);
    document.getElementById('mqProvaTitle').textContent = data.titulo;
    document.getElementById('modalQuestoes').classList.remove('hidden');
    loadQuestoes(provaId);
}

async function loadQuestoes(provaId) {
    const list = document.getElementById('questoesList');
    list.innerHTML = '<p class="text-slate-500">Carregando...</p>';
    try {
        const snap = await getDocs(query(collection(db, "provas", provaId, "questoes"), orderBy("ordem")));
        list.innerHTML = '';
        if(snap.empty) {
            list.innerHTML = '<p class="text-slate-500">Nenhuma questão cadastrada.</p>';
            return;
        }

        snap.forEach(docSnap => {
            const q = docSnap.data();
            const card = document.createElement('div');
            card.className = 'bg-white p-4 rounded-lg shadow-sm border border-slate-200';
            let optsHtml = '';
            q.opcoes.forEach((opt, i) => {
                const isCorreta = (i == q.correta);
                optsHtml += `<p class="text-sm ${isCorreta ? 'text-emerald-700 font-bold bg-emerald-50 rounded px-1' : 'text-slate-600'}">- ${String.fromCharCode(65+i)}) ${opt}</p>`;
            });

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-700 text-sm">Q${q.ordem}. ${q.enunciado}</h4>
                    <button class="text-red-500 hover:text-red-700 btn-del-q" data-id="${docSnap.id}"><i class="fas fa-trash"></i></button>
                </div>
                <div class="space-y-1 mt-2 pl-2 border-l-2 border-slate-100">
                    ${optsHtml}
                </div>
            `;
            list.appendChild(card);
        });
        
        document.querySelectorAll('.btn-del-q').forEach(b => b.addEventListener('click', async (e) => {
            const qId = e.currentTarget.dataset.id;
            if(confirm('Excluir questão?')) {
                await deleteDoc(doc(db, "provas", provaId, "questoes", qId));
                loadQuestoes(provaId);
            }
        }));
    } catch(e) {
        list.innerHTML = '<p class="text-red-500">Erro ao carregar</p>';
    }
}

async function handleSaveQuestao(e) {
    e.preventDefault();
    const provaId = currentGerenciarProvaId;
    if(!provaId) return;

    const enunciado = document.getElementById('qEnunciado').value;
    const opcoes = [
        document.getElementById('qOpt0').value,
        document.getElementById('qOpt1').value,
        document.getElementById('qOpt2').value,
        document.getElementById('qOpt3').value,
        document.getElementById('qOpt4').value
    ];
    const correta = parseInt(document.querySelector('input[name="qCorreta"]:checked').value, 10);

    try {
        const qRef = doc(collection(db, "provas", provaId, "questoes"));
        // Get count for order
        const snap = await getDocs(collection(db, "provas", provaId, "questoes"));
        
        await setDoc(qRef, {
            ordem: snap.size + 1,
            enunciado,
            opcoes,
            correta
        });

        // Update Gabarito
        const gabRef = doc(db, "gabaritos", provaId);
        const gabSnap = await getDoc(gabRef);
        let resp = {};
        if(gabSnap.exists()) resp = gabSnap.data().respostasCorretas || {};
        resp[qRef.id] = correta;
        await setDoc(gabRef, { respostasCorretas: resp, atualizadoEm: new Date().toISOString() }, {merge: true});

        showToast("Questão adicionada!", "success");
        document.getElementById('modalEditQuestao').classList.add('hidden');
        loadQuestoes(provaId);
    } catch(e) {
        showToast("Erro ao salvar questão", "error");
        console.error(e);
    }
}


// ---------------------------
// Alunos
// ---------------------------
async function loadAlunosData() {
    if (!isConfigured) return;
    const tbody = document.getElementById('alunosTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Carregando...</td></tr>';
    try {
        const snap = await getDocs(query(collection(db, "users"), where("role", "==", "aluno")));
        tbody.innerHTML = '';
        if(snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Nenhum aluno</td></tr>';
            return;
        }

        snap.forEach(docSnap => {
            const a = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${a.nome}</td>
                <td class="text-slate-500 text-sm">${a.email}</td>
                <td>${a.matricula || '-'}</td>
                <td><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">${a.turma || '-'}</span></td>
                <td class="text-center">
                    <button class="text-red-500 hover:text-red-700 text-sm font-medium" title="Em breve">Excluir</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Erro</td></tr>';
    }
}

async function handleSaveAluno(e) {
    e.preventDefault();
    if(!isConfigured) return;

    const nome = document.getElementById('alNome').value;
    const email = document.getElementById('alEmail').value;
    const matricula = document.getElementById('alMatricula').value;
    const turma = document.getElementById('alTurma').value;
    const senha = document.getElementById('alSenha').value;

    const profSenha = prompt("Para criar o aluno, precisamos re-autenticar você. Digite sua senha de professor:");
    if(!profSenha) {
        showToast("Operação cancelada.", "warning");
        return;
    }

    try {
        const profEmail = auth.currentUser.email;
        
        // Use registerStudent
        const metadata = { nome, matricula, turma };
        const uid = await registerStudent(email, senha, metadata);
        
        showToast("Aluno cadastrado! Restaurando sua sessão...", "info");
        
        // Reauth prof
        await signInWithEmailAndPassword(auth, profEmail, profSenha);
        
        showToast("Sessão restaurada com sucesso.", "success");
        document.getElementById('modalAluno').classList.add('hidden');
        loadAlunosData();

    } catch(err) {
        console.error(err);
        showToast("Erro: " + err.message, "error");
        // Try rescue
        if(err.code !== 'auth/wrong-password') {
             alert("Tente fazer login novamente se sua sessão caiu.");
        }
    }
}

function loadRelatoriosData() {
    // Placeholder para os selects de relatório
    console.log("Load relatorios...");
}

// Start
document.addEventListener('DOMContentLoaded', init);
