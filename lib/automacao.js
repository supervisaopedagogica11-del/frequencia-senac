// Automação: a cada nova sequência de faltas seguidas (episódio) registra o alerta, reabre o
// acompanhamento do aluno em "Contato com alunos" e dispara o e-mail automático — uma única vez por episódio.
import { mergeConfig, isFinalizada, isAlunoAtivo, resumoAluno, episodioConsecutivas, todayISO } from "./engine.js";
import { criarAlertaSeNovo, atualizarAlerta, registrarHistorico, reabrirContato, agoraISO } from "./db";
import { montarEmail, enviarERegistrar } from "./email";

export async function processarAutomacoes({ turmas, freq, alertas, cfg: cfgIn, usuario }) {
  const cfg = mergeConfig(cfgIn);
  const au = cfg.automacoes;
  let novos = 0, emails = 0;
  try {
    const hoje = todayISO();
    for (const t of turmas) {
      if (isFinalizada(t)) continue;
      for (const a of t.alunos || []) {
        if (!isAlunoAtivo(a)) continue;
        const r = resumoAluno(t, a.id, freq, cfg, hoje);

        // 1) faltas seguidas
        if (au.alertaConsecutivas) {
          const ep = episodioConsecutivas(t, a, freq, cfg, hoje);
          if (ep && !alertas[ep.id]) {
            const emailStatus = !au.emailAutomatico ? "desativado" : a.email ? "pendente" : "sem_email";
            const criado = await criarAlertaSeNovo({
              ...ep, alunoNome: a.nome, turmaNome: t.curso, turmaCodigo: t.codigo || "", status: "aberto",
              titulo: `${ep.consecutivas} faltas seguidas`, pct: r.pct, criadoEm: agoraISO(), criadoPor: usuario?.email || "sistema", emailStatus,
            });
            if (criado) {
              novos++;
              await reabrirContato(t.id, a.id);
              await registrarHistorico({ tipo: "alerta", turmaId: t.id, alunoId: a.id, alunoNome: a.nome, turmaNome: t.curso, usuario: "sistema", alertaId: ep.id,
                descricao: `Alerta automático: ${ep.consecutivas} faltas seguidas (desde ${ep.inicio.split("-").reverse().join("/")}). Pendência de contato criada.` });
              if (emailStatus === "pendente") {
                const { assunto, texto } = montarEmail({ turma: t, aluno: a, resumo: r, cfg });
                const res = await enviarERegistrar({ turma: t, aluno: a, assunto, texto, cfg, motivo: `${ep.consecutivas} faltas seguidas`, modelo: "Alerta de faltas seguidas", automatico: true, alertaId: ep.id, usuario: { email: "sistema (automação)" } });
                emails++;
                await atualizarAlerta(ep.id, res.ok ? { emailStatus: "enviado", emailEnviadoEm: agoraISO(), emailLogId: res.logId } : { emailStatus: "erro", emailErro: res.erro, emailLogId: res.logId });
              }
            }
          }
        }

      }
    }
  } catch (e) {
    console.error("automação", e);
  }
  return { novos, emails };
}
