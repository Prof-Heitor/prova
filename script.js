// Security violations log
let violations = [];
let startTime = null;
let isExamStarted = false;
let studentName = '';
let studentClass = '';
let questionsData = [];
let testAnswers = [];
let testScore = 0;
let numQuestions = 0;

async function loadQuestions() {
  try {
    const response = await fetch('questions.json');
    const data = await response.json();
    questionsData = data;
    numQuestions = questionsData.length;
    console.log(`Loaded ${numQuestions} questions from questions.json`);
  } catch (error) {
    console.error('Erro ao carregar questions.json:', error);
    // Fallback para embedded se falhar
    questionsData = [{"question":"Erro: não foi possível carregar questões","options":["Tente novamente"],"correct":0}];
    numQuestions = 1;
  }
}

function attachSecurityListeners() {
  // Prevent DevTools and right-click
  document.addEventListener('contextmenu', e => {
      e.preventDefault();
      logViolation('Tentou clique direito (possível inspect)');
  });

  document.addEventListener('keydown', e => {
      // Early prevention: block before exam but log only after
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'j'))) {
        e.preventDefault();
      }
      const key = e.key.toLowerCase();
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // Bloquear atalhos de DevTools / inspecionar elemento / ver código-fonte
      if (
          e.key === 'F12' ||
(isCtrl && isShift && (key === 'c' || key === 'j' || key === 'i' || key === 'k')) ||  // Explicit Ctrl+Shift+C (inspect), J (console), I/K (devtools)
          (isCtrl && ['u', 's'].includes(key)) ||
          (e.metaKey && isAlt && ['i', 'j', 'u'].includes(key))
      ) {
          e.preventDefault();
          showBlockFlash();
          let detail = `DevTools (${e.key})`;
          if (isCtrl && isShift) {
            if (key === 'c') detail = 'Ctrl+Shift+C (inspecionar elemento)';
            else if (key === 'j') detail = 'Ctrl+Shift+J (console)';
            else if (key === 'i') detail = 'Ctrl+Shift+I (devtools)';
            else if (key === 'k') detail = 'Ctrl+Shift+K (console)';
          }
          logViolation(`Tentou ${detail}`);
      }

      // Prevent copy/paste/select all
      if (isCtrl && ['c', 'v', 'a'].includes(key)) {
          e.preventDefault();
          logViolation('Tentou copiar/colar/selecionar tudo');
      }
  }, true);

function showBlockFlash() {
  if (!isExamStarted) return;
  const flash = document.createElement('div');
  flash.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(255, 0, 0, 0.3); z-index: 99999; display: flex;
    align-items: center; justify-content: center; font-size: 48px;
    color: white; font-weight: bold; pointer-events: none;
  `;
  flash.textContent = '🚫 BLOQUEADO - DEVTOOLS';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 800);
}

  // Monitor tab switches and focus
  document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
          logViolation('Retornou à aba');
      } else {
          logViolation('Mudou de aba/alt+tab');
      }
  });

  window.addEventListener('blur', () => {
      logViolation('Perdeu foco da janela');
  });

  window.addEventListener('pagehide', () => {
      logViolation('Tentou sair da página');
  });
}

// Log function
function logViolation(action) {
    if (!isExamStarted) return;
    const now = new Date().toLocaleString('pt-BR');
    violations.push(`${now}: ${action}`);
}

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    studentName = document.getElementById('student-name').value.trim();
    studentClass = document.getElementById('class-select').value;
    
    if (!studentName || !studentClass) return alert('Preencha todos os campos!');
    
    startTime = new Date();
    document.getElementById('student-info').textContent = `Aluno: ${studentName} | Sala: ${studentClass}`;
    
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('test-section').classList.add('active');
    
    // Auto fullscreen
    document.getElementById('fullscreen-prompt').style.display = 'block';
    try {
        await document.documentElement.requestFullscreen();
    } catch {
        logViolation('Falha ao entrar em fullscreen (permita no browser)');
    } finally {
        document.getElementById('fullscreen-prompt').style.display = 'none';
        document.getElementById('test-form').style.display = 'block';
        await loadQuestions();
        generateQuestions(questionsData);
        if (questionsData.length === 0) {
            console.error('Nenhuma questão disponível após carregar questions.json');
        }
        isExamStarted = true;
        attachSecurityListeners();
    }

});

function generateQuestions(data) {
    const container = document.getElementById('questions-container');
    if (!container) {
        console.error('Container not found');
        return;
    }
    container.innerHTML = '';
    data.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question';
        div.innerHTML = `
            <h3>${index + 1}. ${q.question}</h3>
            ${q.options.map((option, optIndex) => 
                `<label><input type="radio" name="q${index + 1}" value="${optIndex}"> ${option}</label>`
            ).join('')}
        `;
        container.appendChild(div);
    });
    console.log('Questões geradas:', data.length);
}

// Security listeners attached early for DevTools prevention
document.addEventListener('DOMContentLoaded', () => {
  attachSecurityListeners();
});

// Test submit
document.getElementById('test-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    testScore = 0;
    testAnswers = [];
    
    for (let i = 0; i < numQuestions; i++) {
        const selected = document.querySelector(`input[name="q${i+1}"]:checked`);
        const suaIndex = selected ? parseInt(selected.value) : -1;
        const suaText = suaIndex >= 0 ? questionsData[i].options[suaIndex] : 'não respondida';
        const correctIndex = questionsData[i].correct;
        const correctText = questionsData[i].options[correctIndex];
        const isWrong = suaIndex !== correctIndex;
        
        testAnswers.push({
            qNum: i+1,
            suaText,
            correctText,
            isWrong
        });
        
        if (!isWrong) testScore++;
    }
    
    const totalTime = new Date() - startTime;
    const percentage = Math.round((testScore / numQuestions) * 100);
    
    document.getElementById('score').innerHTML = `
        <strong>${testScore}/${numQuestions} (${percentage}%)</strong><br>
        Tempo: ${Math.floor(totalTime / 60000)}min ${Math.floor((totalTime % 60000) / 1000)}s
    `;
    
    document.getElementById('test-section').classList.remove('active');
    document.getElementById('results-section').classList.add('active');
});

// PDF Download
document.getElementById('download-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      encryption: {
        userPassword: 'abacate',
        ownerPassword: '',
        encryptionType: 'aes256'
      }
    });
    
    let y = 20;

    doc.setFontSize(16);
    doc.text('RELATÓRIO DO SIMULADO - 1º BIMESTRE', 20, y);
    y += 15;
    
    doc.setFontSize(12);
    doc.text(`Aluno: ${studentName}`, 20, y); y += 8;
    doc.text(`Sala: ${studentClass}`, 20, y); y += 10;
    
    doc.text('Respostas:', 20, y); y += 8;
    testAnswers.forEach((item) => {
        let line1 = `Q${item.qNum}: Sua: ${item.suaText.substring(0, 80)}...`;
        if (line1.length > 80) line1 = line1.substring(0, 80) + '...';
        doc.text(line1, 20, y);
        y += 6;
        if (item.isWrong) {
            let line2 = `Correta: ${item.correctText.substring(0, 80)}...`;
            if (line2.length > 80) line2 = line2.substring(0, 80) + '...';
            doc.text(line2, 20, y);
            y += 6;
        }
        if (y > 270) { doc.addPage(); y = 20; }
    });
    y += 5;
    
    doc.text(`Pontuação: ${testScore}/${numQuestions} (${Math.round((testScore / numQuestions) * 100)}%)`, 20, y); y += 10;
    
    if (violations.length > 0) {
        y += 5;
        doc.setTextColor(220, 20, 60);
        doc.text('VIOLAÇÕES DE SEGURANÇA:', 20, y); y += 8;
        doc.setTextColor(0, 0, 0);
        violations.forEach(vio => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(vio, 20, y);
            y += 6;
        });
        doc.setTextColor(0, 0, 0);
    }
    
    
    // Password protect (user password 'abacate', owner empty for simplicity)
    doc.save(`prova_${studentName.replace(/[^a-zA-Z0-9]/g, '')}_${new Date().toISOString().slice(0,10)}.pdf`);
});
