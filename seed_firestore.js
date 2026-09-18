import { db, isConfigured, collection, doc, setDoc, writeBatch } from "./firebase-config.js";
import { showToast } from "./toast.js";

export async function seedQuestionsToFirestore(questionsData, provaId = 'simulado_1bim_3tec') {
    if (!isConfigured) {
        showToast("Firebase não configurado (modo offline).", "warning");
        return;
    }

    try {
        const batch = writeBatch(db);
        
        // Criar Prova
        const provaRef = doc(db, "provas", provaId);
        batch.set(provaRef, {
            titulo: "Simulado Padrão",
            disciplina: "Geral",
            turma: "Geral",
            tempoLimiteMin: 120,
            ativa: true,
            resultadosLiberados: false,
            embaralhar: true,
            criadoEm: new Date().toISOString(),
            criadoPor: "sistema"
        });

        const respostasCorretas = {};
        
        questionsData.forEach((q, index) => {
            const qId = `q${index + 1}`;
            const questaoRef = doc(db, "provas", provaId, "questoes", qId);
            
            batch.set(questaoRef, {
                ordem: index + 1,
                enunciado: q.enunciado,
                opcoes: q.opcoes,
                correta: q.correta
            });
            
            respostasCorretas[qId] = q.correta;
        });

        const gabaritoRef = doc(db, "gabaritos", provaId);
        batch.set(gabaritoRef, {
            respostasCorretas,
            atualizadoEm: new Date().toISOString()
        });

        await batch.commit();
        showToast("Dados iniciais carregados com sucesso!", "success");
    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        showToast("Erro ao carregar dados.", "error");
    }
}
