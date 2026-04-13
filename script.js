// Security violations log
let violations = [];
let startTime = null;
let isExamStarted = false;
let studentName = '';
let studentClass = '';
let questionsData = [{"question":"Nas aplicações web, existem diversas responsabilidades distribuídas entre o front-end e o back-end. Cada uma dessas áreas executa tarefas específicas para garantir o funcionamento e a experiência do usuário. A correta divisão de tarefas entre o front-end e o back-end é essencial para que a aplicação funcione de forma segura e eficiente, atendendo às necessidades tanto dos usuários quanto dos desenvolvedores. Qual das funções abaixo é típica do back-end em uma aplicação de rede social?","options":["Exibir o perfil do usuário na tela principal.","Estabelecer o layout e a estrutura das páginas do site","Validar permissões de acesso aos dados do usuário.","Aplicar efeitos visuais nas fotos postadas.","Ajustar a navegação do usuário entre diferentes páginas."],"correct":2},{"question":"Uma equipe de desenvolvedores está encarregada de construir uma API para um sistema de mensagens que será usado por uma empresa para comunicação em tempo real entre seus colaboradores. Esse sistema precisa ser rápido e eficiente para lidar com milhares de mensagens simultâneas sem comprometer a performance. Após considerar diferentes opções, a equipe decidiu implementar a API utilizando Node.js. Qual dos seguintes fatores explica por que Node.js é uma escolha apropriada para o desenvolvimento de APIs em sistemas de comunicação em tempo real? ?","options":["Utiliza uma estrutura baseada em threads, que processa requisições de forma síncrona","Adota um modelo de I/O não bloqueante, permitindo o processamento simultâneo de múltiplas requisições.","Exige menos memória, pois executa cada requisição em um ambiente isolado.","Implementa mecanismos de caching automático para armazenar todas as requisições recebidas.","Limita o uso de pacotes externos, proporcionando um ambiente de desenvolvimento mais controlado."],"correct":1},{"question":"Qual das alternativas representa uma das principais vantagens da normalização em um banco de dados relacional? ?","options":["Aumentar a velocidade de processamento de consultas complexas.","Reduzir a quantidade de dados armazenados no sistema.","Minimizar a redundância e melhorar a integridade dos dados.","Permitir a criação de backups automáticos e mais frequentes.","Eliminar a necessidade de índices e chaves no banco de dados."],"correct":2},{"question":"Uma loja on-line oferece a seus clientes a opção de criar contas para armazenar informações pessoais e histórico de compras, além de efetuar pagamentos. Recentemente, a empresa recebeu feedback dos usuários sobre preocupações quanto à privacidade e proteção dos dados. Para resolver a questão, o desenvolvedor responsável decidiu implementar o protocolo HTTPS, garantindo que a comunicação entre o site e os clientes seja protegida contra interceptações. Para assegurar a segurança das informações pessoais dos clientes durante o uso da loja on-line, o protocolo HTTPS é ideal, porque:","options":["Permite que a comunicação entre cliente e servidor ocorra de forma segura em uma conexão dedicada, limitando o acesso não autorizado.","Utiliza o padrão SSL para encriptar dados durante o login, mantendo o restante da comunicação em um protocolo HTTP seguro.","Protege os dados do cliente ao bloquear o acesso de terceiros às informações durante a transmissão, sem comprometer a velocidade de carregamento.","Criptografa toda a comunicação entre cliente e servidor com o uso de SSL/TLS, protegendo os dados durante a transmissão.","Oferece segurança adicional em transações, ao permitir a encriptação de partes sensíveis dos dados transmitidos."],"correct":3}];
let testAnswers = [];
let testScore = 0;
let numQuestions = 0;

function loadQuestions() {
  questionsData = [{"question":"Nas aplicações web, existem diversas responsabilidades distribuídas entre o front-end e o back-end. Cada uma dessas áreas executa tarefas específicas para garantir o funcionamento e a experiência do usuário. A correta divisão de tarefas entre o front-end e o back-end é essencial para que a aplicação funcione de forma segura e eficiente, atendendo às necessidades tanto dos usuários quanto dos desenvolvedores. Qual das funções abaixo é típica do back-end em uma aplicação de rede social?","options":["Exibir o perfil do usuário na tela principal.","Estabelecer o layout e a estrutura das páginas do site","Validar permissões de acesso aos dados do usuário.","Aplicar efeitos visuais nas fotos postadas.","Ajustar a navegação do usuário entre diferentes páginas."],"correct":2},{"question":"Uma equipe de desenvolvedores está encarregada de construir uma API para um sistema de mensagens que será usado por uma empresa para comunicação em tempo real entre seus colaboradores. Esse sistema precisa ser rápido e eficiente para lidar com milhares de mensagens simultâneas sem comprometer a performance. Após considerar diferentes opções, a equipe decidiu implementar a API utilizando Node.js. Qual dos seguintes fatores explica por que Node.js é uma escolha apropriada para o desenvolvimento de APIs em sistemas de comunicação em tempo real? ?","options":["Utiliza uma estrutura baseada em threads, que processa requisições de forma síncrona","Adota um modelo de I/O não bloqueante, permitindo o processamento simultâneo de múltiplas requisições.","Exige menos memória, pois executa cada requisição em um ambiente isolado.","Implementa mecanismos de caching automático para armazenar todas as requisições recebidas.","Limita o uso de pacotes externos, proporcionando um ambiente de desenvolvimento mais controlado."],"correct":1},{"question":"Qual das alternativas representa uma das principais vantagens da normalização em um banco de dados relacional? ?","options":["Aumentar a velocidade de processamento de consultas complexas.","Reduzir a quantidade de dados armazenados no sistema.","Minimizar a redundância e melhorar a integridade dos dados.","Permitir a criação de backups automáticos e mais frequentes.","Eliminar a necessidade de índices e chaves no banco de dados."],"correct":2},{"question":"Uma loja on-line oferece a seus clientes a opção de criar contas para armazenar informações pessoais e histórico de compras, além de efetuar pagamentos. Recentemente, a empresa recebeu feedback dos usuários sobre preocupações quanto à privacidade e proteção dos dados. Para resolver a questão, o desenvolvedor responsável decidiu implementar o protocolo HTTPS, garantindo que a comunicação entre o site e os clientes seja protegida contra interceptações. Para assegurar a segurança das informações pessoais dos clientes durante o uso da loja on-line, o protocolo HTTPS é ideal, porque:","options":["Permite que a comunicação entre cliente e servidor ocorra de forma segura em uma conexão dedicada, limitando o acesso não autorizado.","Utiliza o padrão SSL para encriptar dados durante o login, mantendo o restante da comunicação em um protocolo HTTP seguro.","Protege os dados do cliente ao bloquear o acesso de terceiros às informações durante a transmissão, sem comprometer a velocidade de carregamento.","Criptografa toda a comunicação entre cliente e servidor com o uso de SSL/TLS, protegendo os dados durante a transmissão.","Oferece segurança adicional em transações, ao permitir a encriptação de partes sensíveis dos dados transmitidos."],"correct":3}];
  numQuestions = questionsData.length;
  console.log(`Loaded ${numQuestions} questions from embedded JSON`);
}

function attachSecurityListeners() {
  // Prevent DevTools and right-click
  document.addEventListener('contextmenu', e => {
      e.preventDefault();
      logViolation('Tentou clique direito (possível inspect)');
  });

  document.addEventListener('keydown', e => {
      // F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && e.key === 'I') ||
          (e.ctrlKey && e.key === 'u') ||
          (e.ctrlKey && e.key === 's')) {
          e.preventDefault();
          logViolation(`Tentou abrir DevTools (${e.key})`);
      }
      // Prevent copy/paste
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'a')) {
          e.preventDefault();
          logViolation('Tentou copiar/colar');
      }
  }, true);

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
document.getElementById('login-form').addEventListener('submit', (e) => {
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
    document.documentElement.requestFullscreen().catch(() => {
        logViolation('Falha ao entrar em fullscreen (permita no browser)');
    }).finally(() => {
        document.getElementById('fullscreen-prompt').style.display = 'none';
        document.getElementById('test-form').style.display = 'block';
        loadQuestions();
        generateQuestions(questionsData);
        isExamStarted = true;
        attachSecurityListeners();
    });

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

// Removed early generateQuestions as data loads after login
document.addEventListener('DOMContentLoaded', () => {});

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
    doc.text('RELATÓRIO DO SIMULADO - 3º Ano Técnico', 20, y);
    y += 15;
    
    doc.setFontSize(12);
    doc.text(`Aluno: ${studentName}`, 20, y); y += 8;
    doc.text(`Sala: ${studentClass}`, 20, y); y += 10;
    
    doc.text('Respostas:', 20, y); y += 8;
    testAnswers.forEach((item) => {
        let line1 = `Questão ${item.qNum}: sua resposta: ${item.suaText}`;
        doc.text(line1, 20, y);
        y += 6;
        if (item.isWrong) {
            let line2 = `resposta correta: ${item.correctText}`;
            doc.text(line2, 20, y);
            y += 6;
        }
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
