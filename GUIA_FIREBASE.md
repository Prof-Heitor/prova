# Guia Completo — Configuração do Firebase e Deploy

Bem-vindo ao guia definitivo de configuração, inicialização e publicação do **Sistema de Avaliações Online**. Este documento cobre todos os passos necessários para configurar os serviços do **Google Firebase** (Cloud Firestore, Authentication e Hosting), executar localmente e publicar a aplicação em produção de forma 100% gratuita.

---

## 📋 Sumário
1. [Criar Projeto no Firebase Console](#1-criar-projeto-no-firebase-console)
2. [Ativar Cloud Firestore](#2-ativar-cloud-firestore)
3. [Configurar Regras de Segurança](#3-configurar-regras-de-segurança)
4. [Ativar Firebase Authentication e Criar Conta de Professor](#4-ativar-firebase-authentication-e-criar-conta-de-professor)
5. [Obter Credenciais Web e Configurar o Código](#5-obter-credenciais-web-e-configurar-o-código)
6. [Executar Localmente](#6-executar-localmente)
7. [Cadastrar Alunos](#7-cadastrar-alunos)
8. [Criar e Configurar uma Prova](#8-criar-e-configurar-uma-prova)
9. [Deploy com Firebase Hosting (Produção)](#9-deploy-com-firebase-hosting)
10. [Fluxo Completo de Teste](#10-fluxo-completo-de-teste)
11. [Troubleshooting (Resolução de Problemas Comuns)](#11-troubleshooting)

---

## 1. Criar Projeto no Firebase Console

1. Acesse o [Firebase Console](https://console.firebase.google.com/) e faça login com sua conta Google.
2. Clique no botão **"Adicionar projeto"** (ou **"Criar um projeto"** se for seu primeiro acesso).
3. Insira o nome do seu projeto. Por exemplo: `avaliacao-tec` ou `simulado-escolar`.
4. Clique em **Continuar**.
5. Na etapa do **Google Analytics**, selecione **"Desativar o Google Analytics neste projeto"** (não é necessário para o funcionamento da plataforma de avaliação e simplifica o fluxo).
6. Clique em **"Criar projeto"** e aguarde alguns segundos até que o ambiente seja provisionado.
7. Quando terminar, clique em **"Continuar"** para entrar no painel principal do projeto.

---

## 2. Ativar Cloud Firestore

O Cloud Firestore é o banco de dados NoSQL em tempo real utilizado para armazenar os usuários, provas, questões, gabaritos, respostas e logs de monitoramento.

1. No menu lateral esquerdo do Firebase Console, expanda a seção **Criação** (Build) e clique em **Firestore Database**.
2. Clique no botão **"Criar banco de dados"** (*Create database*).
3. Escolha o local do banco de dados (*Location*):
   - Recomendado para o Brasil: **`southamerica-east1` (São Paulo)** para menor latência, ou o padrão **`nam5` (us-central)**.
4. Na etapa de **Regras de segurança**, selecione **"Iniciar no modo de teste"** (*Start in test mode*) temporariamente para permitir a criação inicial das tabelas.
5. Clique em **"Criar"** (*Create*) e aguarde a finalização.

---

## 3. Configurar Regras de Segurança

Para garantir a integridade dos dados e impedir que alunos vejam gabaritos, respostas de outros alunos ou modifiquem avaliações, aplicamos regras baseadas em funções de usuário (*Role-Based Access Control*).

1. Dentro da página do **Firestore Database**, clique na aba **"Regras"** (*Rules*).
2. Substitua todo o conteúdo existente pelo código do arquivo [`firestore.rules`](./firestore.rules):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Funções auxiliares para verificação de autenticação e papéis (roles)
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isProfessor() {
      return isAuthenticated() && getUserData().role == 'professor';
    }
    
    function isAluno() {
      return isAuthenticated() && getUserData().role == 'aluno';
    }

    // 1. Coleção de Usuários (/users)
    // Permite leitura para autenticados; criação/edição por professores ou o próprio usuário
    match /users/{uid} {
      allow read: if isAuthenticated();
      allow create, update: if isProfessor() || (isAuthenticated() && request.auth.uid == uid);
      allow delete: if isProfessor();
    }
    
    // 2. Provas e Subcoleção de Questões (/provas)
    // Leitura permitida para autenticados; modificação apenas para professores
    match /provas/{provaId} {
      allow read: if isAuthenticated();
      allow write: if isProfessor();

      match /questoes/{questaoId} {
        allow read: if isAuthenticated();
        allow write: if isProfessor();
      }
    }
    
    // 3. Gabarito Oficial (/gabaritos)
    // Acesso restrito exclusivamente para professores (alunos nunca leem este nó)
    match /gabaritos/{provaId} {
      allow read, write: if isProfessor();
    }
    
    // 4. Controle de Resultados Liberados (/resultados_liberados)
    // Leitura para alunos e professores; alteração exclusiva por professores
    match /resultados_liberados/{provaId} {
      allow read: if isAuthenticated();
      allow write: if isProfessor();
    }
    
    // 5. Submissões de Provas dos Alunos (/submissoes)
    // Aluno pode criar sua submissão e consultar apenas a sua própria; professor tem acesso total
    match /submissoes/{subId} {
      allow create: if isAuthenticated();
      allow read: if isProfessor() || (isAuthenticated() && resource.data.uid == request.auth.uid);
      allow update, delete: if isProfessor();
    }
    
    // 6. Logs de Violações Anti-Fraude (/violacoes)
    // Registro permitido para o aluno em prova; visualização e auditoria restritas a professores
    match /violacoes/{vioId} {
      allow create: if isAuthenticated();
      allow read, delete: if isProfessor();
      allow update: if false;
    }
    
    // 7. Alunos Online / Heartbeat (/alunos_online)
    // Monitoramento em tempo real do progresso da turma durante a aplicação
    match /alunos_online/{uid} {
      allow read: if isProfessor() || (isAuthenticated() && request.auth.uid == uid);
      allow create, update: if isAuthenticated() && request.auth.uid == uid;
      allow delete: if isProfessor() || (isAuthenticated() && request.auth.uid == uid);
    }
  }
}
```

3. Clique no botão **"Publicar"** (*Publish*). As regras passarão a vigorar imediatamente.

---

## 4. Ativar Firebase Authentication e Criar Conta de Professor

### 4.1. Habilitar Login por E-mail e Senha
1. No menu lateral do Firebase Console, vá em **Criação** (Build) > **Authentication**.
2. Clique em **"Começar"** (*Get Started*).
3. Na aba **"Sign-in method"** (Método de login), selecione o provedor **"E-mail/senha"** (*Email/Password*).
4. Ative a primeira opção: **"Permitir que os usuários se inscrevam usando e-mail e senha"**.
5. Clique em **"Salvar"**.

---

### 4.2. Criar a Conta de Usuário do Primeiro Professor
1. Na página do **Authentication**, clique na aba **"Users"** (Usuários).
2. Clique no botão **"Adicionar usuário"** (*Add user*).
3. Digite o e-mail do professor (ex.: `professor@escola.edu.br` ou seu e-mail institucional).
4. Defina uma senha segura (mínimo de 6 caracteres) e clique em **"Adicionar usuário"**.
5. Na tabela de usuários, localize o usuário criado e **copie o UID** (Identificador do Usuário, uma sequência alfanumérica como `a7X9fK12mQ...`). Você precisará dele no próximo passo!

---

### 4.3. ⚠️ PASSO CRÍTICO: Criar o Documento do Professor no Firestore
> **ATENÇÃO:** O sistema verifica se o usuário possui `role === 'professor'` dentro do documento no Firestore. Apenas criar o login no Authentication **NÃO É SUFICIENTE**. Se este passo for ignorado, o professor receberá erro de permissão ao tentar acessar a área de administração!

Siga este procedimento manual para vincular o perfil de professor:
1. No menu lateral, acesse **Criação** > **Firestore Database** > aba **"Dados"** (*Data*).
2. Se a coleção `users` ainda não existir, clique em **"Iniciar coleção"** (*Start collection*).
   - **ID da coleção:** `users`
   - Clique em **Avançar**.
3. Na janela do documento:
   - **ID do documento:** Cole exatamente o **UID** do professor copiado da aba Authentication.
4. Adicione os seguintes campos (atenção aos tipos de dados e nomes):

| Nome do Campo | Tipo de Dado | Valor de Exemplo | Observação |
|---|---|---|---|
| `email` | `string` | `professor@escola.edu.br` | O mesmo e-mail do Auth |
| `nome` | `string` | `Prof. Heitor Assis` | Nome exibido no painel |
| **`role`** | **`string`** | **`professor`** | **Obrigatório: exatamente `'professor'`** |
| `turma` | `string` | `""` (vazio) | Deixar string vazia |
| `matricula` | `string` | `""` (vazio) | Deixar string vazia |
| `avatarUrl` | `string` | `""` (vazio) | Deixar string vazia |
| `criadoEm` | `timestamp` | Selecione a data/hora atual | Data de cadastro |

5. Clique em **"Salvar"**. Pronto! O usuário agora possui papel de Administrador/Professor credenciado no sistema.

---

## 5. Obter Credenciais Web e Configurar o Código

1. No menu lateral, clique no ícone da **Engrenagem ⚙️** (ao lado de "Visão geral do projeto") e selecione **"Configurações do projeto"**.
2. Role até a seção **"Seus aplicativos"** e clique no ícone Web **`</>`**.
3. Em "Apelido do app", digite um nome como `avaliacoes-web` e clique em **"Registrar app"**.
4. O Firebase exibirá um trecho com o objeto `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "seu-projeto.firebaseapp.com",
     projectId: "seu-projeto",
     storageBucket: "seu-projeto.firebasestorage.app",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```
5. Abra o arquivo [`firebase-config.js`](./firebase-config.js) no seu editor e atualize o objeto `firebaseConfig` com as chaves correspondentes do seu projeto:
   ```javascript
   const firebaseConfig = {
     apiKey: "SUA_API_KEY_COPIADA",
     authDomain: "seu-projeto.firebaseapp.com",
     projectId: "seu-projeto",
     storageBucket: "seu-projeto.firebasestorage.app",
     messagingSenderId: "SEU_MESSAGING_SENDER_ID",
     appId: "SEU_APP_ID"
   };
   ```
6. Salve o arquivo.

---

## 6. Executar Localmente

Por usar módulos nativos JavaScript ES6 (`type="module"`), o navegador exige que as páginas sejam carregadas via protocolo HTTP/HTTPS (e não diretamente como arquivo local `file:///`).

### Opção A: Usando Python (Recomendado)
Abra o prompt de comando ou terminal na pasta raiz do projeto (`c:\Users\hbbas\Desktop\prova`):
```powershell
python -m http.server 8080
```
> Se o comando acima não funcionar, tente `python3 -m http.server 8080` ou `py -m http.server 8080`.

### Opção B: Usando a Extensão Live Server do VS Code
1. Abra a pasta do projeto no **VS Code**.
2. Instale a extensão **Live Server** (se ainda não possuir).
3. Clique com o botão direito sobre `login.html` ou `index.html` e escolha **"Open with Live Server"**.

### 🌐 URLs para Teste Local
Com o servidor rodando em `http://localhost:8080`:
- **Tela de Login Unificado**: [http://localhost:8080/login.html](http://localhost:8080/login.html)
- **Painel do Aluno**: [http://localhost:8080/aluno.html](http://localhost:8080/aluno.html)
- **Painel Administrativo do Professor**: [http://localhost:8080/admin.html](http://localhost:8080/admin.html)
- **Interface de Realização de Prova**: [http://localhost:8080/index.html](http://localhost:8080/index.html)

---

## 7. Cadastrar Alunos

1. Faça login em [http://localhost:8080/login.html](http://localhost:8080/login.html) com o e-mail e senha do professor criados no **Passo 4**.
2. O sistema redirecionará automaticamente para o painel de controle do professor (`admin.html`).
3. No menu superior ou lateral, clique na aba **"Gerenciar Alunos"**.
4. Você tem duas opções para cadastro:

### Cadastro Individual:
- Clique em **"Novo Aluno"**.
- Preencha:
  - **Nome Completo** (ex.: `Mariana Souza`);
  - **Turma** (ex.: `3º Técnico A`);
  - **Matrícula** (ex.: `2026-0042`);
  - **E-mail** (ex.: `mariana.souza@escola.edu.br`);
  - **Senha Inicial** (ex.: `aluno123456`).
- Clique em **"Cadastrar"**. O aluno é gravado simultaneamente no Firebase Authentication e na coleção `users` com o papel `role: 'aluno'`.

### Cadastro em Lote via Importação CSV:
- Clique em **"Importar CSV"**.
- O arquivo CSV deve seguir o formato padrão:
  ```csv
  nome,email,turma,matricula,senha
  Lucas Pereira,lucas@escola.edu.br,3º Técnico A,2026-0043,senha1234
  Beatriz Lima,beatriz@escola.edu.br,3º Técnico A,2026-0044,senha1234
  ```
- O sistema importará automaticamente todos os registros e criará as credenciais de acesso de cada estudante.

---

## 8. Criar e Configurar uma Prova

1. No painel do professor (`admin.html`), vá para a seção **"Gerenciar Provas"**.
2. Clique no botão **"+ Nova Prova"**.
3. Preencha os detalhes básicos da avaliação:
   - **Título da Prova** (ex.: *Avaliação Bimestral de Redes e Infraestrutura*);
   - **Disciplina** (ex.: *Redes de Computadores*);
   - **Turma Alvo** (ex.: *3º Técnico A*);
   - **Tempo Limite** (em minutos, ex.: `60`);
   - **Opções**: marque *Embaralhar Questões* e deixe a prova marcada como *Ativa*.
4. Clique em **"Salvar Prova"**.

### Adicionar Questões à Prova:
- Na linha da prova recém-criada, clique em **"Gerenciar Questões"**.
- Você pode:
  - **Adicionar manualmente**: digitar o enunciado, opções de múltipla escolha (A, B, C, D, E) e marcar a alternativa correta.
  - **Restaurar Questões Padrão**: clique em **"Restaurar Questões Padrão"** para semear o banco automaticamente a partir das questões pré-configuradas em [`questions.json`](./questions.json).
- Os enunciados e opções são disponibilizados para os alunos na subcoleção `provas/{provaId}/questoes`, enquanto o gabarito oficial com a resposta correta é armazenado com segurança em `gabaritos/{provaId}`.

---

## 9. Deploy com Firebase Hosting

O Firebase Hosting oferece hospedagem estática gratuita, rápida, com certificado SSL/HTTPS automático e CDN global.

### Passo a Passo Completo de Publicação:

#### a. Instalar o Node.js
Se você ainda não tiver o Node.js instalado:
- Acesse [https://nodejs.org/](https://nodejs.org/).
- Baixe e instale a versão **LTS** recomendada.

#### b. Instalar o Firebase CLI
Abra o seu terminal (Prompt de Comando ou PowerShell) e instale a ferramenta de linha de comando do Firebase globalmente:
```powershell
npm install -g firebase-tools
```

#### c. Fazer Login no Firebase
Conecte sua conta do Google:
```powershell
firebase login
```
> O comando abrirá uma janela no navegador para você autorizar o acesso à sua conta do Google vinculada ao projeto.

#### d. Inicializar o Projeto
No terminal, navegue até a pasta do projeto (`c:\Users\hbbas\Desktop\prova`):
```powershell
firebase init
```
Durante o assistente interativo, responda às perguntas exatamente como indicado abaixo:
1. **Which Firebase features do you want to set up?**
   - Use a barra de espaço para marcar **Hosting: Configure files for Firebase Hosting...**
   - Pressione **Enter**.
2. **Select a default Firebase project:**
   - Escolha **Use an existing project**.
   - Selecione o seu projeto na lista (ex.: `avaliacao-tec`).
3. **What do you want to use as your public directory?**
   - Digite `.` (ponto) e pressione Enter, pois todos os arquivos HTML e JS estão na raiz do projeto.
4. **Configure as a single-page app (rewrite all urls to /index.html)?**
   - Digite `N` (Não) e pressione Enter.
5. **Set up automatic builds and deploys with GitHub?**
   - Digite `N` (Não) e pressione Enter.
6. **File ./index.html already exists. Overwrite?**
   - Digite **`N` (Não)** e pressione Enter para **NÃO** sobrescrever o seu arquivo de prova existente!

O arquivo [`firebase.json`](./firebase.json) gerado terá a seguinte estrutura limpa e otimizada:
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "GUIA_FIREBASE.md",
      "TODO.md",
      "firestore.rules"
    ]
  }
}
```

#### e. Executar o Deploy
Para enviar os arquivos para a nuvem:
```powershell
firebase deploy
```

#### f. Acessar a URL Pública
Ao final da execução, o terminal exibirá:
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/avaliacao-tec/overview
Hosting URL: https://avaliacao-tec.web.app
```
Agora a sua escola pode acessar o sistema diretamente pelo endereço gerado (ex.: `https://avaliacao-tec.web.app/login.html`) a partir de qualquer computador, tablet ou celular!

#### g. Como Atualizar o Site Após Alterações
Sempre que você alterar qualquer arquivo HTML, CSS ou JavaScript no seu computador, basta executar novamente:
```powershell
firebase deploy
```
A atualização é instantânea e propagada para todos os servidores da CDN em poucos segundos.

#### h. Publicação das Regras de Segurança via Terminal (Opcional)
Você também pode implantar as regras de segurança diretamente pelo terminal sem abrir o navegador:
```powershell
firebase deploy --only firestore:rules
```

> 💡 **Gratuidade:** O plano gratuito *Spark* do Firebase Hosting inclui **10 GB de armazenamento** e **360 MB/dia de transferência de dados**, mais do que suficiente para centenas de aplicações de provas simultâneas com excelente velocidade.

---

## 10. Fluxo Completo de Teste

Para validar a aplicação do início ao fim com todas as camadas de segurança, siga este roteiro de teste prático:

```
[Professor]                      [Aluno]                      [Anti-Fraude & Firestore]
     |                              |                                     |
1. Login no admin.html              |                                     |
2. Cria prova e questões            |                                     |
3. Cadastra aluno                   |                                     |
     |                              |                                     |
     |                         4. Login em login.html                     |
     |                         5. Inicia prova no index.html              |
     |                              | ---------- Registra entrada ------> |
     |                              | ---------- Heartbeat a cada 30s --> | (alunos_online)
     |                              |                                     |
     |                         6. Aluno tenta Alt+Tab ou F12              |
     |                              | ---------- Alerta de violação ----> | (violacoes)
     | <--- Notificação de infração |                                     |
     |      em tempo real no painel |                                     |
     |                              |                                     |
     |                         7. Aluno responde e clica "Finalizar"      |
     |                              | ---------- Salva respostas -------> | (submissoes)
     |                              |                                     |
8. Professor libera notas           |                                     |
   em "Liberar Resultados" -------->|                                     | (resultados_liberados)
     |                              |                                     |
     |                         9. Aluno visualiza nota, gabarito          |
     |                            e feedback detalhado em aluno.html      |
```

1. **Acesso do Professor**: Abra o navegador e entre em `/login.html` com a conta de professor.
2. **Criação da Prova**: Crie uma avaliação de 3 questões com tempo limite de 15 minutos. Ative a prova.
3. **Cadastro do Aluno**: Crie um aluno de teste (`teste@escola.edu.br` / senha `aluno123`).
4. **Login do Aluno**: Em uma janela anônima (ou outro navegador), faça login com a conta do aluno.
5. **Realização da Prova**: O aluno verá a prova disponível em seu painel (`aluno.html`) e clicará em **"Iniciar Avaliação"**.
6. **Teste do Módulo Anti-Fraude**:
   - A prova entra em modo de tela cheia.
   - Pressione `Alt+Tab` ou clique fora do navegador: um alerta na tela avisa sobre a violação e a contagem de faltas é incrementada.
   - Pressione `F12` ou `Ctrl+Shift+C`: o atalho é interceptado e cancelado imediatamente.
7. **Monitoramento em Tempo Real**: Na tela do professor (`admin.html`), observe que o aluno aparece com status `"Em prova"`, indicando a questão atual e as violações detectadas ao vivo via Firestore onSnapshot.
8. **Finalização**: O aluno clica em **"Finalizar Prova"** e confirma a submissão.
9. **Liberação e Visualização do Gabarito**:
   - Inicialmente o aluno não vê o gabarito.
   - No painel do professor, clique em **"Liberar Resultados"**.
   - O painel do aluno atualiza e agora exibe a nota final, percentual de acerto, tempo gasto e a correção questão a questão.

---

## 11. Troubleshooting

Abaixo estão as dúvidas mais frequentes e suas respectivas soluções:

### ❌ 1. Erro "Missing or insufficient permissions" (Permissão negada)
- **Causa provável**: As regras de segurança do Firestore estão bloqueando a operação ou a conta do usuário logado não possui o perfil necessário.
- **Solução**:
  1. Vá até a aba **Firestore Database > Regras** no Firebase Console e certifique-se de que o conteúdo de `firestore.rules` foi publicado corretamente.
  2. Para o professor: confirme se existe o documento com o ID correspondente ao seu UID na coleção `users` contendo o campo `role: "professor"`.

---

### ❌ 2. Erro "auth/user-not-found" ou "auth/wrong-password"
- **Causa provável**: O e-mail ou a senha digitados estão incorretos ou o usuário ainda não foi cadastrado no Firebase Authentication.
- **Solução**:
  1. Verifique na aba **Authentication > Users** se o e-mail consta na lista.
  2. Se esqueceu a senha, o professor pode redefini-la diretamente no painel do Firebase Console clicando nos três pontinhos ao lado do usuário > **"Redefinir senha"**.

---

### ❌ 3. Tela em branco ou botões não respondem
- **Causa provável**: Erro de sintaxe no JavaScript ou falha no carregamento dos módulos.
- **Solução**:
  1. Pressione `F12` (no navegador do professor ou em modo de desenvolvimento) e abra a aba **Console**.
  2. Verifique se as credenciais do `firebase-config.js` estão corretas. Se estiverem com `AIzaSy...` inválido ou valores padrão `SUA_API_KEY_AQUI`, o Firebase não conseguirá inicializar.

---

### ❌ 4. Erros de CORS ao abrir páginas locais
- **Causa provável**: Você tentou abrir o arquivo clicando duas vezes nele (endereço `file:///C:/...`).
- **Solução**:
  1. Browsers modernos bloqueiam requisições de módulos e fetches em URLs `file://`.
  2. Execute a aplicação usando um servidor HTTP local:
     ```powershell
     python -m http.server 8080
     ```
     e acesse pelo endereço `http://localhost:8080/login.html`.

---

### ❌ 5. Ícones ou Fontes não carregam sem internet
- **Causa provável**: As bibliotecas (Tailwind CSS, Font Awesome e Firebase SDK) são carregadas via CDNs oficiais do Google e Cloudflare.
- **Solução**:
  1. Certifique-se de que a máquina possui conexão ativa com a internet para carregar os scripts na primeira execução.

---

<p align="center">
  <b>Sistema de Avaliações Online</b> • Desenvolvido para instituições de ensino modernas e seguras.
</p>
