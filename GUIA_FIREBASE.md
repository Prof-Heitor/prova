# Guia Passo a Passo: Configuração do Firebase e Execução do Sistema

Este guia ensina como conectar o sistema de prova online ao **Google Firebase (Cloud Firestore)** gratuitamente e como testar o fluxo completo do aluno e do professor.

---

## Passo 1: Criar o Projeto Gratuito no Firebase Console

1. Acesse [Firebase Console](https://console.firebase.google.com/) e faça login com sua conta Google.
2. Clique em **"Adicionar projeto"** (ou "Criar um projeto").
3. Digite um nome para o projeto (ex.: `simulado-3tecnico`).
4. Desative o Google Analytics (opcional para testes) e clique em **"Criar projeto"**.

---

## Passo 2: Criar o Banco de Dados Cloud Firestore

1. No menu lateral esquerdo do Firebase Console, clique em **Criação** -> **Firestore Database**.
2. Clique no botão **"Criar banco de dados"**.
3. Selecione a localização (pode deixar o padrão, ex.: `nam5 (us-central)` ou `southamerica-east1`).
4. Na tela de regras de segurança, escolha **"Iniciar no modo de teste"** (ou configure as regras após criar).
5. Clique em **"Criar"**.

### (Recomendado) Configurar as Regras de Segurança
1. No Firestore, clique na aba **"Regras"** (*Rules*).
2. Substitua o conteúdo pelo que está no arquivo [`firestore.rules`](./firestore.rules) deste projeto.
3. Clique em **"Publicar"**.

---

## Passo 3: Ativar o Firebase Authentication (Acesso do Professor)

Para que somente o professor acesse o painel de resultados:
1. No menu lateral do Firebase Console, clique em **Criação** -> **Authentication**.
2. Clique no botão **"Começar"** (*Get Started*).
3. Na aba **"Sign-in method"** (Métodos de login), selecione **"E-mail/senha"**.
4. Ative a primeira chave ("Permitir que os usuários se inscrevam usando e-mail e senha") e clique em **"Salvar"**.
5. Em seguida, vá na aba **"Users"** (Usuários) e clique em **"Adicionar usuário"**.
6. Digite o e-mail do professor (ex.: `professor@escola.edu.br`) e defina uma senha forte.
7. Pronto! Essa será a conta que terá acesso exclusivo ao painel `admin.html`.

---

## Passo 4: Obter as Credenciais da Web

1. No menu lateral, clique na **engrenagem** (ao lado de "Visão geral do projeto") -> **Configurações do projeto**.
2. Role até a seção **"Seus aplicativos"** e clique no ícone **Web** (`</>`).
3. Dê um apelido ao app (ex.: `prova-web`) e clique em **"Registrar app"**.
4. O Firebase exibirá um bloco de código com o objeto `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "seu-projeto.firebaseapp.com",
     projectId: "seu-projeto-id",
     storageBucket: "seu-projeto.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
5. Abra o arquivo [`firebase-config.js`](./firebase-config.js) no seu editor e substitua os valores de `SUA_API_KEY_AQUI`, etc., pelas suas chaves reais.

---

## Passo 5: Executar o Projeto Localmente

Como a aplicação utiliza módulos modernos do JavaScript (`type="module"`), ela deve ser servida via protocolo HTTP local (e não abrindo diretamente o arquivo `file:///`).

Você pode rodar facilmente usando o Python já instalado no seu computador:

```powershell
# Abra o terminal na pasta do projeto e execute:
python -m http.server 8000
```

Em seguida, abra no navegador:
- **Área do Aluno (Prova)**: [http://localhost:8000/index.html](http://localhost:8000/index.html)
- **Painel do Professor (Resultados)**: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)

*(Se você usa o Visual Studio Code, também pode usar a extensão **Live Server** clicando em "Go Live").*

---

## Passo 6: Inicializar as Questões no Firestore

1. Acesse o **Painel do Professor** em [http://localhost:8000/admin.html](http://localhost:8000/admin.html).
2. O indicador no topo mostrará: `🟢 Conectado ao Cloud Firestore`.
3. Clique no botão verde **"Sincronizar Questões no Banco"**.
4. O sistema lerá as questões de `questions.json`, salvará os enunciados e opções na coleção pública e guardará o gabarito oficial na coleção protegida `gabaritos`.

---

## Passo 7: Testar o Fluxo e Auditoria Anti-Fraude

1. Abra [http://localhost:8000/index.html](http://localhost:8000/index.html) em uma janela anônima ou outro navegador.
2. Faça o login com o nome de um aluno e sala.
3. Durante a prova:
   - Tente alternar de aba (`Alt+Tab`).
   - Tente pressionar `F12` ou `Ctrl+Shift+C`.
   - Observe o flash vermelho de bloqueio na tela.
4. Conclua a prova clicando em **"Finalizar Prova"**.
5. Volte para a aba do **Painel do Professor** (`admin.html`):
   - Os gráficos, a média e a lista de alunos atualizarão **instantaneamente em tempo real**, sem precisar recarregar a página!
   - Clique em **"Ver Raio-X"** para inspecionar as respostas do aluno e o registro com hora e minuto de cada tentativa de infração.
   - Clique em **"Exportar Planilha (CSV)"** para baixar as notas formatadas para o diário de classe.
