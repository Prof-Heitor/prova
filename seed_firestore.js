// seed_firestore.js
// Utilitário para popular o Firestore a partir de questions.json

import { db, isConfigured, collection, doc, setDoc } from "./firebase-config.js";

export async function seedQuestionsToFirestore(questionsData) {
  if (!isConfigured || !db) {
    throw new Error("Firebase ainda não configurado em firebase-config.js!");
  }

  const provaId = "simulado_1bim_3tec";

  // 1. Cadastrar metadados da prova
  await setDoc(doc(db, "provas", provaId), {
    titulo: "Prova - 3º Ano Técnico",
    disciplina: "Desenvolvimento Web & Banco de Dados",
    tempoLimiteMin: 60,
    totalQuestoes: questionsData.length,
    ativa: true,
    atualizadoEm: new Date()
  });

  // 2. Separar gabarito oficial seguro
  const gabaritoMap = {};

  // 3. Inserir questões públicas (sem a chave 'correct')
  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];
    const questaoId = `q${i + 1}`;
    
    // Armazena no mapa de gabarito
    gabaritoMap[questaoId] = q.correct;

    // Grava a questão pública
    await setDoc(doc(db, "provas", provaId, "questoes", questaoId), {
      ordem: i + 1,
      enunciado: q.question,
      opcoes: q.options
    });
  }

  // 4. Grava o documento de gabarito na coleção protegida
  await setDoc(doc(db, "gabaritos", provaId), {
    provaId: provaId,
    respostasCorretas: gabaritoMap,
    atualizadoEm: new Date()
  });

  console.log(`✅ ${questionsData.length} questões e gabarito salvos no Firestore com sucesso!`);
  return questionsData.length;
}
