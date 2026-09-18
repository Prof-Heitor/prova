import { db, auth, collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, orderBy } from "./firebase-config.js";
import { requireRole, logoutUser } from "./auth.js";
import { showToast } from "./toast.js";
import { enableFullscreenLock, attachSecurityListeners, detachSecurityListeners, startHeartbeat, stopHeartbeat } from "./anti-fraud.js";
import { formatTime, formatDate, generateId, sanitizeHtml, debounce, getInitials, getAvatarColor } from "./helpers.js";

// Elementos do DOM (Seções)
const sections = {
    dashboard: document.getElementById('secDashboard'),
    exam: document.getElementById('secExam'),
    results: document.getElementById('secResults'),
    perfil: document.getElementById('secPerfil')
};

// Estado Global
let currentUser = null;
let profileData = null;
let allExams = [];
let userSubmissions = [];
let violationsCount = 0;

// Estado da Prova Ativa
let activeExam = null;
let examQuestions = [];
let currentQIndex = 0;
let userAnswers = {}; // ex: { "qId1": "A", "qId2": "C" }
let timerInterval = null;
let timeRemainingSeg = 0;

async function init() {
    try {
        // Exige login e role de aluno
        const userObj = await requireRole('aluno', '/login.html');
        currentUser = userObj.user;
        profileData = userObj;
        
        setupUI();
        await loadDashboard();
        
        // Eventos de Navegação
        document.getElementById('menuDashboard').addEventListener('click', (e) => { e.preventDefault(); showSection('dashboard'); loadDashboard(); });
        document.getElementById('menuPerfil').addEventListener('click', (e) => { e.preventDefault(); showSection('perfil'); loadProfile(); });
        document.getElementById('navLogo').addEventListener('click', () => { showSection('dashboard'); loadDashboard(); });
        document.getElementById('menuSair').addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
            window.location.href = 'login.html';
        });
        
        // Toggle do Menu do Usuário
        const btnUserMenu = document.getElementById('btnUserMenu');
        const dropdown = document.getElementById('userMenuDropdown');
        btnUserMenu.addEventListener('click', () => dropdown.classList.toggle('hidden'));
        document.addEventListener('click', (e) => {
            if(!btnUserMenu.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden');
        });
        
        // Eventos da Prova
        document.getElementById('btnNextQuestion').addEventListener('click', () => navigateQuestion(currentQIndex + 1));
        document.getElementById('btnPrevQuestion').addEventListener('click', () => navigateQuestion(currentQIndex - 1));
        document.getElementById('btnFinishExamTop').addEventListener('click', confirmSubmitExam);
        document.getElementById('btnFinishExamBottom').addEventListener('click', confirmSubmitExam);
        
        // Voltar ao Dashboard
        document.getElementById('btnBackToDashboard').addEventListener('click', () => { showSection('dashboard'); loadDashboard(); });
        
        // Form de Perfil
        document.getElementById('formProfile').addEventListener('submit', handleProfileUpdate);

    } catch (e) {
        console.error("Erro na inicialização:", e);
    }
}

function setupUI() {
    const nomeExibicao = profileData.nome || currentUser.email.split('@')[0];
    document.getElementById('navUserName').textContent = nomeExibicao;
    
    const iniciais = nomeExibicao.substring(0,2).toUpperCase();
    document.getElementById('navAvatar').textContent = iniciais;
    document.getElementById('profileAvatarBig').textContent = iniciais;
    
    // Saudação com base na hora
    const hora = new Date().getHours();
    let saudacao = 'Bom dia';
    if (hora >= 12 && hora < 18) saudacao = 'Boa tarde';
    else if (hora >= 18) saudacao = 'Boa noite';
    
    document.getElementById('welcomeMessage').textContent = `${saudacao}, ${nomeExibicao.split(' ')[0]}!`;
}

function showSection(secName) {
    if (activeExam && secName !== 'exam') {
        showToast('Você está realizando uma prova. Finalize-a antes de sair desta página!', 'warning');
        return;
    }
    for (let key in sections) sections[key].classList.add('hidden');
    sections[secName].classList.remove('hidden');
    document.getElementById('userMenuDropdown').classList.add('hidden'); // fecha menu ao navegar
}

async function loadDashboard() {
    try {
        // Busca submissões do usuário
        const subQ = query(collection(db, 'submissoes'), where('uid', '==', currentUser.uid));
        const subSnap = await getDocs(subQ);
        userSubmissions = [];
        subSnap.forEach(d => userSubmissions.push({ id: d.id, ...d.data() }));
        
        // Busca provas ativas
        const provasQ = query(collection(db, 'provas'), where('ativa', '==', true));
        const provasSnap = await getDocs(provasQ);
        allExams = [];
        provasSnap.forEach(d => {
            const p = d.data();
            // Filtra por turma, se aplicável
            if (!p.turma || p.turma === profileData.turma || p.turma === 'Todas') {
                allExams.push({ id: d.id, ...p });
            }
        });
        
        renderDashboard();
    } catch(e) {
        console.error(e);
        showToast('Erro ao carregar dados do painel.', 'error');
    }
}

function renderDashboard() {
    let pendentes = 0;
    let scores = [];
    const provasGrid = document.getElementById('provasGrid');
    provasGrid.innerHTML = '';
    
    // Mapeia submissões para busca rápida
    const subMap = {};
    userSubmissions.forEach(s => {
        subMap[s.provaId] = s;
        if (s.score !== undefined && s.totalQuestions) {
            scores.push((s.score / s.totalQuestions) * 10);
        }
    });
    
    // Métricas
    if (scores.length > 0) {
        document.getElementById('metricUltima').textContent = scores[scores.length - 1].toFixed(1);
        const media = scores.reduce((a, b) => a + b, 0) / scores.length;
        document.getElementById('metricMedia').textContent = media.toFixed(1);
    } else {
        document.getElementById('metricUltima').textContent = '-';
        document.getElementById('metricMedia').textContent = '-';
    }
    
    // Renderiza Cards
    if (allExams.length === 0) {
        provasGrid.innerHTML = '<p class="text-gray-500 text-sm col-span-full">Nenhuma prova disponível no momento.</p>';
    }
    
    allExams.forEach(prova => {
        const sub = subMap[prova.id];
        const isDone = !!sub;
        if (!isDone) pendentes++;
        
        const card = document.createElement('div');
        card.className = 'border rounded-lg p-4 bg-gray-50 flex flex-col justify-between h-full';
        
        const statusBadge = isDone 
            ? '<span class="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] uppercase font-bold rounded">Finalizada</span>'
            : '<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] uppercase font-bold rounded">Disponível</span>';
            
        card.innerHTML = `
            <div class="mb-4">
                <div class="flex justify-between items-start mb-2 gap-2">
                    <h3 class="font-bold text-gray-800 text-base leading-tight">${prova.titulo}</h3>
                    ${statusBadge}
                </div>
                <p class="text-xs text-gray-600 mb-3">${prova.disciplina}</p>
                <div class="text-xs text-gray-500 font-medium">
                    <p>⏳ Tempo: ${prova.tempoLimiteMin} min</p>
                </div>
            </div>
            <div class="mt-auto">
                ${!isDone 
                    ? `<button onclick="openConfirmModal('${prova.id}')" class="w-full bg-indigo-600 text-white py-1.5 text-sm rounded hover:bg-indigo-700 transition">Iniciar Prova</button>`
                    : `<button onclick="viewResults('${prova.id}')" class="w-full bg-white border border-gray-300 text-gray-700 py-1.5 text-sm rounded hover:bg-gray-50 transition">Ver Resultado</button>`
                }
            </div>
        `;
        provasGrid.appendChild(card);
    });
    
    document.getElementById('metricPendentes').textContent = pendentes;
}

// Global para chamada no HTML gerado
window.openConfirmModal = function(provaId) {
    const prova = allExams.find(p => p.id === provaId);
    if (!prova) return;
    
    document.getElementById('modalConfirmTitle').textContent = prova.titulo;
    document.getElementById('modalConfirmSubject').textContent = prova.disciplina;
    document.getElementById('modalConfirmTime').textContent = prova.tempoLimiteMin;
    document.getElementById('modalConfirmQtd').textContent = 'Consultando...';
    
    // Busca número de questões
    getDocs(collection(db, `provas/${provaId}/questoes`)).then(snap => {
        document.getElementById('modalConfirmQtd').textContent = snap.size;
    });
    
    const modal = document.getElementById('modalConfirmExam');
    modal.classList.remove('hidden');
    
    const btnStart = document.getElementById('btnModalStart');
    const btnCancel = document.getElementById('btnModalCancel');
    const bgModal = document.getElementById('bgModalConfirm');
    
    const startHandler = () => {
        closeModal();
        startExam(provaId);
    };
    
    btnStart.onclick = startHandler;
    btnCancel.onclick = closeModal;
    bgModal.onclick = closeModal;
};

function closeModal() {
    document.getElementById('modalConfirmExam').classList.add('hidden');
}

// ---------------- LÓGICA DA PROVA ----------------
async function startExam(provaId) {
    try {
        activeExam = allExams.find(p => p.id === provaId);
        if (!activeExam) return;
        
        showToast('Preparando ambiente da prova...', 'info');
        
        // Busca questões
        const qSnap = await getDocs(query(collection(db, `provas/${provaId}/questoes`), orderBy('ordem')));
        examQuestions = [];
        qSnap.forEach(d => examQuestions.push({ id: d.id, ...d.data() }));
        
        if (examQuestions.length === 0) {
            showToast('Esta prova ainda não possui questões cadastradas.', 'error');
            return;
        }
        
        // Embaralha se configurado
        if (activeExam.embaralhar) {
            examQuestions = examQuestions.sort(() => Math.random() - 0.5);
            examQuestions.forEach(q => {
                if (q.opcoes) q.opcoes = q.opcoes.sort(() => Math.random() - 0.5);
            });
        }
        
        // Zera estado
        currentQIndex = 0;
        userAnswers = {};
        violationsCount = 0;
        
        // Segurança: Fullscreen e Listeners
        try {
            await enableFullscreenLock();
        } catch(e) {
            console.warn('O modo tela cheia falhou ou foi negado.', e);
        }
        
        attachSecurityListeners((action) => {
            violationsCount++;
            logViolation(action);
            const banner = document.getElementById('examWarningBanner');
            banner.classList.remove('hidden');
            setTimeout(() => banner.classList.add('hidden'), 5000);
        });
        
        // Inicia Heartbeat (Monitoramento)
        startHeartbeat(currentUser.uid, provaId, profileData.nome);
        
        // Configura Temporizador
        timeRemainingSeg = activeExam.tempoLimiteMin * 60;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            timeRemainingSeg--;
            updateTimerDisplay();
            if (timeRemainingSeg <= 0) {
                clearInterval(timerInterval);
                showToast('Tempo esgotado! A prova será enviada automaticamente.', 'warning');
                submitExam();
            }
        }, 1000);
        
        // Interface
        document.getElementById('examTitle').textContent = activeExam.titulo;
        showSection('exam');
        renderQuestionDots();
        navigateQuestion(0);
        
    } catch(e) {
        console.error("Erro ao iniciar prova:", e);
        showToast('Erro ao iniciar a prova.', 'error');
    }
}

function updateTimerDisplay() {
    const min = Math.floor(timeRemainingSeg / 60).toString().padStart(2, '0');
    const seg = (timeRemainingSeg % 60).toString().padStart(2, '0');
    const timerElem = document.getElementById('examTimer');
    
    timerElem.textContent = `${min}:${seg}`;
    
    if (timeRemainingSeg < 300) { // Menos de 5 minutos
        timerElem.parentElement.classList.add('bg-red-50', 'animate-pulse');
    } else {
        timerElem.parentElement.classList.remove('bg-red-50', 'animate-pulse');
    }
}

function renderQuestionDots() {
    const container = document.getElementById('examProgressDots');
    container.innerHTML = '';
    examQuestions.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = `w-7 h-7 flex-shrink-0 rounded-full text-[10px] font-bold transition flex items-center justify-center border-2 ${i===0 ? 'border-indigo-600 bg-indigo-100 text-indigo-800' : 'border-gray-200 bg-white text-gray-500'}`;
        dot.textContent = i + 1;
        dot.id = `qdot-${i}`;
        dot.onclick = () => navigateQuestion(i);
        container.appendChild(dot);
    });
}

function navigateQuestion(index) {
    if (index < 0 || index >= examQuestions.length) return;
    
    // Salva a resposta da questão atual antes de trocar
    saveCurrentAnswer();
    
    currentQIndex = index;
    const q = examQuestions[index];
    
    // Atualiza Textos
    document.getElementById('examProgressText').textContent = `Questão ${index + 1} de ${examQuestions.length}`;
    document.getElementById('questionEnunciado').textContent = q.enunciado;
    
    const optsContainer = document.getElementById('questionOptions');
    optsContainer.innerHTML = '';
    
    if (q.opcoes && q.opcoes.length > 0) {
        const letras = ['A', 'B', 'C', 'D', 'E'];
        q.opcoes.forEach((optText, i) => {
            const isChecked = userAnswers[q.id] === i;
            const optDiv = document.createElement('label');
            optDiv.className = `flex items-center p-3 border rounded-lg cursor-pointer transition text-sm hover:bg-indigo-50 ${isChecked ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 bg-white'}`;
            
            // Escape de aspas para o valor
            const safeVal = optText.replace(/"/g, '&quot;');
            
            optDiv.innerHTML = `
                <input type="radio" name="currentQ" value="${i}" class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" ${isChecked ? 'checked' : ''}>
                <span class="ml-3 font-bold text-gray-700 w-5">${letras[i] || ''})</span>
                <span class="text-gray-700 flex-1">${optText}</span>
            `;
            
            // Lógica de destaque ao selecionar
            optDiv.querySelector('input').addEventListener('change', () => {
                document.querySelectorAll('#questionOptions label').forEach(l => {
                    l.classList.remove('bg-indigo-50', 'border-indigo-500', 'ring-1', 'ring-indigo-500');
                    l.classList.add('border-gray-200', 'bg-white');
                });
                optDiv.classList.add('bg-indigo-50', 'border-indigo-500', 'ring-1', 'ring-indigo-500');
                optDiv.classList.remove('border-gray-200', 'bg-white');
                
                // Auto-save no estado
                userAnswers[q.id] = i;
                updateDotStatus();
            });
            optsContainer.appendChild(optDiv);
        });
    } else {
        optsContainer.innerHTML = `
            <p class="text-gray-500 italic text-sm">Nenhuma opção disponível.</p>
        `;
    }
    
    // Atualiza botões de navegação
    document.getElementById('btnPrevQuestion').disabled = index === 0;
    
    if (index === examQuestions.length - 1) {
        document.getElementById('btnNextQuestion').classList.add('hidden');
        document.getElementById('btnFinishExamBottom').classList.remove('hidden');
    } else {
        document.getElementById('btnNextQuestion').classList.remove('hidden');
        document.getElementById('btnFinishExamBottom').classList.add('hidden');
    }
    
    updateDotStatus();
}

function saveCurrentAnswer() {
    const q = examQuestions[currentQIndex];
    if (!q) return;
    const checked = document.querySelector('input[name="currentQ"]:checked');
    if (checked) {
        userAnswers[q.id] = parseInt(checked.value, 10);
    }
}

function updateDotStatus() {
    examQuestions.forEach((q, i) => {
        const dot = document.getElementById(`qdot-${i}`);
        if (!dot) return;
        
        dot.className = `w-7 h-7 flex-shrink-0 rounded-full text-[10px] font-bold transition flex items-center justify-center border-2 `;
        if (i === currentQIndex) {
            dot.classList.add('border-indigo-600', 'bg-indigo-100', 'text-indigo-800');
        } else if (userAnswers[q.id] !== undefined) {
            dot.classList.add('border-green-500', 'bg-green-50', 'text-green-700');
        } else {
            dot.classList.add('border-gray-200', 'bg-white', 'text-gray-500');
        }
    });
}

function confirmSubmitExam() {
    saveCurrentAnswer();
    const countRespostas = Object.keys(userAnswers).length;
    
    if (countRespostas < examQuestions.length) {
        if (!confirm(`Atenção: Você respondeu apenas ${countRespostas} de ${examQuestions.length} questões. Tem certeza que deseja finalizar a prova agora?`)) {
            return;
        }
    } else {
        if (!confirm("Deseja realmente finalizar a prova e enviar suas respostas?")) return;
    }
    submitExam();
}

async function submitExam() {
    saveCurrentAnswer();
    if (timerInterval) clearInterval(timerInterval);
    
    // Limpeza de segurança
    stopHeartbeat();
    detachSecurityListeners();
    if (document.exitFullscreen && document.fullscreenElement) {
        try { document.exitFullscreen(); } catch(e){}
    }
    
    showToast('Processando e enviando prova...', 'info');
    
    try {
        let score = 0;
        let detailedAnswers = [];
        
        // Avaliação (considerando que o client tem acesso à 'correta')
        for (let q of examQuestions) {
            const respAluno = userAnswers[q.id] !== undefined ? userAnswers[q.id] : null;
            const isCorrect = respAluno === q.correta;
            if (isCorrect) score++;
            
            detailedAnswers.push({
                questaoId: q.id,
                enunciado: q.enunciado,
                respostaAluno: respAluno !== null ? q.opcoes[respAluno] : null,
                correta: q.opcoes[q.correta],
                acertou: isCorrect
            });
        }
        
        const totalTempoSeg = (activeExam.tempoLimiteMin * 60) - timeRemainingSeg;
        const subData = {
            uid: currentUser.uid,
            studentName: profileData.nome || currentUser.email,
            studentClass: profileData.turma || '',
            provaId: activeExam.id,
            answers: userAnswers,
            score: score,
            totalQuestions: examQuestions.length,
            percentage: (score / examQuestions.length) * 100,
            tempoGastoSeg: totalTempoSeg,
            tempoFormatado: `${Math.floor(totalTempoSeg/60)}m ${totalTempoSeg%60}s`,
            violationsCount: violationsCount,
            detailedAnswers: detailedAnswers,
            status: 'concluida',
            criadoEm: serverTimestamp()
        };
        
        await addDoc(collection(db, 'submissoes'), subData);
        
        showToast('Prova enviada com sucesso!', 'success');
        activeExam = null;
        await loadDashboard();
        showSection('dashboard');
        
    } catch(e) {
        console.error("Erro no envio:", e);
        showToast('Erro ao enviar prova. Tente novamente ou contate o professor.', 'error');
    }
}

async function logViolation(actionDesc) {
    if (!activeExam) return;
    try {
        await addDoc(collection(db, 'violacoes'), {
            uid: currentUser.uid,
            studentName: profileData.nome,
            provaId: activeExam.id,
            action: actionDesc,
            loggedAt: serverTimestamp()
        });
    } catch(e) { console.warn("Erro ao salvar log de violação", e); }
}

// ---------------- RESULTADOS ----------------
window.viewResults = async function(provaId) {
    showSection('results');
    const container = document.getElementById('resultsContent');
    container.innerHTML = '<p class="text-center text-gray-500 py-10 text-sm">Carregando resultados...</p>';
    
    try {
        const resDoc = await getDoc(doc(db, 'resultados_liberados', provaId));
        const liberado = resDoc.exists() && resDoc.data().liberado === true;
        
        const sub = userSubmissions.find(s => s.provaId === provaId);
        if (!sub) {
            container.innerHTML = '<p class="text-center text-red-500 text-sm">Submissão não encontrada.</p>';
            return;
        }
        
        if (!liberado) {
            container.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-5xl mb-4">🔒</div>
                    <h3 class="text-lg font-bold text-gray-800">Resultado Pendente</h3>
                    <p class="text-gray-500 text-sm mt-2">O professor ainda não liberou o gabarito para esta prova.</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="border-b border-gray-100 pb-5 mb-5">
                <h3 class="text-xl font-bold text-gray-800">Seu Resultado Oficial</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                    <div class="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                        <span class="block text-xs uppercase tracking-wide text-gray-500 mb-1">Nota</span>
                        <span class="block text-2xl font-bold text-gray-800">${sub.score} / ${sub.totalQuestions}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                        <span class="block text-xs uppercase tracking-wide text-gray-500 mb-1">Aproveitamento</span>
                        <span class="block text-2xl font-bold ${sub.percentage >= 60 ? 'text-green-600' : 'text-red-600'}">${sub.percentage.toFixed(1)}%</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                        <span class="block text-xs uppercase tracking-wide text-gray-500 mb-1">Tempo Gasto</span>
                        <span class="block text-lg font-bold text-gray-800 mt-1">${sub.tempoFormatado}</span>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg text-center border border-gray-100">
                        <span class="block text-xs uppercase tracking-wide text-gray-500 mb-1">Violações</span>
                        <span class="block text-lg font-bold ${sub.violationsCount > 0 ? 'text-red-600' : 'text-green-600'} mt-1">${sub.violationsCount}</span>
                    </div>
                </div>
            </div>
            <div class="space-y-4">
        `;
        
        if (sub.detailedAnswers && sub.detailedAnswers.length > 0) {
            sub.detailedAnswers.forEach((ans, i) => {
                const isCorrect = ans.acertou;
                html += `
                    <div class="p-4 rounded-lg border text-sm ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                        <p class="font-bold text-gray-800 mb-2">Questão ${i+1}</p>
                        <p class="text-gray-700 mb-3 whitespace-pre-wrap">${ans.enunciado}</p>
                        <div class="space-y-1 bg-white bg-opacity-60 p-2 rounded">
                            <p class="${isCorrect ? 'text-green-800' : 'text-red-800'}">
                                <strong>Sua resposta:</strong> ${ans.respostaAluno || '(Em branco)'}
                            </p>
                            ${!isCorrect ? `<p class="text-green-800"><strong>Correta:</strong> ${ans.correta}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p class="text-gray-500 text-sm italic">Detalhes não disponíveis.</p>';
        }
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch(e) {
        console.error("Erro na exibição:", e);
        container.innerHTML = '<p class="text-center text-red-500 py-10 text-sm">Erro ao carregar o resultado.</p>';
    }
};

// ---------------- PERFIL ----------------
function loadProfile() {
    document.getElementById('profileName').value = profileData.nome || '';
    document.getElementById('profileEmail').value = currentUser.email || '';
    document.getElementById('profileMatricula').value = profileData.matricula || '';
    document.getElementById('profileTurma').value = profileData.turma || '';
    
    const tbody = document.getElementById('tableHistory');
    tbody.innerHTML = '';
    
    if (userSubmissions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-6 text-center text-gray-500 text-sm">Você ainda não realizou nenhuma prova.</td></tr>';
        return;
    }
    
    userSubmissions.forEach(sub => {
        const examName = allExams.find(e => e.id === sub.provaId)?.titulo || 'Prova Realizada';
        const dateStr = sub.criadoEm ? new Date(sub.criadoEm.seconds * 1000).toLocaleDateString('pt-BR') : '-';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap font-medium text-gray-900">${examName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-gray-500">${dateStr}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center font-bold text-gray-800">${sub.score !== undefined ? `${sub.score}/${sub.totalQuestions}` : '-'}</td>
            <td class="px-4 py-3 whitespace-nowrap text-center">
                <span class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 uppercase">Concluída</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const newName = document.getElementById('profileName').value.trim();
    if (!newName) return;
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { nome: newName });
        profileData.nome = newName;
        setupUI();
        showToast('Perfil atualizado com sucesso!', 'success');
    } catch(err) {
        console.error(err);
        showToast('Erro ao atualizar perfil.', 'error');
    }
}

// Inicia aplicação
window.addEventListener('DOMContentLoaded', init);
