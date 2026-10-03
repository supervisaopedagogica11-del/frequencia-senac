// Automação preventiva: detecta faltas seguidas e alunos em risco / abaixo de 75%,
// cria a pendência de contato, muda a situação do aluno e dispara o e-mail automático (sem duplicidade).
import { mergeConfig, isFinalizada, isAlunoAtivo, statusAluno, resumoAluno, episodioConsecutivas, episodioLimite, todayISO, fmtHoras } from "./engine.js";
import { criarAlertaSeNovo, atualizarAlerta, alterarAlunos, registrarHistorico, agoraISO } from "./db";
import { montarEmail, enviarERegistrar } from "./email";
import { FAIXA_LABEL } from "./constants.js";

export async function processarAutomacoes({ turmas, freq, alertas, cfg: cfgIn, usuario }) {
  const cfg = mergeConfig(cfgIn);
  const au = cfg.automacoes;
  let novos = 0, emails = 0;
  try {
    const hoje = todayISO();
    for (const t of turmas) {
      if (isFinalizada(t)) continue;
      const mudarStatus = {};
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
              await registrarHistorico({ tipo: "alerta", turmaId: t.id, alunoId: a.id, alunoNome: a.nome, turmaNome: t.curso, usuario: "sistema", alertaId: ep.id,
                descricao: `Alerta automático: ${ep.consecutivas} faltas seguidas (desde ${ep.inicio.split("-").reverse().join("/")}). Pendência de contato criada.` });
              if (["Regular", "Em acompanhamento"].includes(statusAluno(a))) mudarStatus[a.id] = "Necessita contato";
              if (emailStatus === "pendente") {
                const { assunto, texto } = montarEmail({ turma: t, aluno: a, resumo: r, cfg });
                const res = await enviarERegistrar({ turma: t, aluno: a, assunto, texto, cfg, motivo: `${ep.consecutivas} faltas seguidas`, modelo: "Alerta de faltas seguidas", automatico: true, alertaId: ep.id, usuario: { email: "sistema (automação)" } });
                emails++;
                await atualizarAlerta(ep.id, res.ok ? { emailStatus: "enviado", emailEnviadoEm: agoraISO(), emailLogId: res.logId } : { emailStatus: "erro", emailErro: res.erro, emailLogId: res.logId });
              }
            }
          }
        }

        // 2) entrou em risco ou ficou abaixo de 75% (um alerta por nível)
        if (au.alertaRisco) {
          const ep = episodioLimite(t, a, r);
          if (ep && !alertas[ep.id]) {
            const criado = await criarAlertaSeNovo({
              ...ep, alunoNome: a.nome, turmaNome: t.curso, turmaCodigo: t.codigo || "", status: "aberto",
              titulo: `${FAIXA_LABEL[ep.faixa]} — ${String(r.pct).replace(".", ",")}%`, motivo: r.motivo,
              criadoEm: agoraISO(), criadoPor: usuario?.email || "sistema", emailStatus: "nao_aplicavel",
            });
            if (criado) {
              novos++;
              await registrarHistorico({ tipo: "alerta", turmaId: t.id, alunoId: a.id, alunoNome: a.nome, turmaNome: t.curso, usuario: "sistema", alertaId: ep.id,
                descricao: `Alerta: aluno ${ep.faixa === "abaixo" ? "ficou abaixo de 75%" : "entrou em risco"} (${String(r.pct).replace(".", ",")}%, ${fmtHoras(r.horasFalta)} de falta).` });
              if (statusAluno(a) === "Regular" && !mudarStatus[a.id]) mudarStatus[a.id] = "Necessita contato";
            }
          }
        }
      }
      const ids = Object.keys(mudarStatus);
      if (ids.length) {
        await alterarAlunos(t.id, (lista) => lista.map((x) => (mudarStatus[x.id] ? { ...x, statusAcomp: mudarStatus[x.id], statusEm: agoraISO() } : x)));
        for (const id of ids) {
          const a = t.alunos.find((x) => x.id === id);
          await registrarHistorico({ tipo: "status", turmaId: t.id, alunoId: id, alunoNome: a?.nome, turmaNome: t.curso, usuario: "sistema", descricao: `Situação alterada automaticamente: ${statusAluno(a)} → ${mudarStatus[id]}` });
        }
      }
    }
  } catch (e) {
    console.error("automação", e);
  }
  return { novos, emails };
}
