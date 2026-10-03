// Automação preventiva: detecta episódios de faltas consecutivas e aproximação do limite,
// cria pendências, atualiza a situação do aluno e dispara o e-mail automático (sem duplicidade).
import { mergeConfig, isFinalizada, isAlunoAtivo, statusAluno, resumoAluno, episodioConsecutivas, episodioLimite, todayISO } from "./engine";
import { criarAlertaSeNovo, atualizarAlerta, alterarAlunos, registrarHistorico, agoraISO } from "./db";
import { montarEmail, enviarERegistrar } from "./email";
import { FAIXA_LABEL } from "./constants";

export async function processarAutomacoes({ turmas, freq, alertas, cfg: cfgIn, usuario, turmaIds }) {
  const cfg = mergeConfig(cfgIn);
  const au = cfg.automacoes;
  let novos = 0, emails = 0;
  try {
    const hoje = todayISO();
    for (const t of turmas) {
      if (isFinalizada(t)) continue;
      if (turmaIds && !turmaIds.includes(t.id)) continue;
      const atualizacoesAlunos = {};
      for (const a of t.alunos || []) {
        if (!isAlunoAtivo(a)) continue;
        const r = resumoAluno(t, a.id, freq, cfg, hoje);

        // 1) faltas consecutivas
        if (au.alertaConsecutivas) {
          const ep = episodioConsecutivas(t, a, freq, cfg, hoje);
          if (ep && !alertas[ep.id]) {
            const emailStatus = !au.emailAutomatico ? "desativado" : a.email ? "pendente" : "sem_email";
            const alerta = {
              ...ep, alunoNome: a.nome, turmaNome: t.curso, turmaCodigo: t.codigo || "", status: "aberto",
              titulo: `${ep.consecutivas} faltas consecutivas`, pct: r.pct, faixa: r.faixa,
              criadoEm: agoraISO(), criadoPor: usuario?.email || "sistema", emailStatus,
              contatoManual: emailStatus !== "pendente",
            };
            const criado = await criarAlertaSeNovo(alerta);
            if (criado) {
              novos++;
              await registrarHistorico({
                tipo: "alerta", turmaId: t.id, alunoId: a.id, alunoNome: a.nome, turmaNome: t.curso,
                descricao: `Alerta automático: ${ep.consecutivas} faltas consecutivas (desde ${ep.inicio.split("-").reverse().join("/")}). Pendência de contato criada.`,
                usuario: "sistema", alertaId: ep.id,
              });
              if (au.pendenciaAutomatica && ["Regular", "Em acompanhamento", "Contatado"].includes(statusAluno(a))) {
                atualizacoesAlunos[a.id] = "Necessita contato";
              }
              if (emailStatus === "pendente") {
                const { assunto, texto } = montarEmail({ turma: t, aluno: a, resumo: r, cfg });
                const res = await enviarERegistrar({
                  turma: t, aluno: a, assunto, texto, cfg, motivo: `${ep.consecutivas} faltas consecutivas`,
                  modelo: "Alerta de faltas consecutivas", automatico: true, alertaId: ep.id, usuario: { email: "sistema (automação)" },
                });
                emails++;
                await atualizarAlerta(ep.id, res.ok
                  ? { emailStatus: "enviado", emailEnviadoEm: agoraISO(), emailLogId: res.logId, contatoManual: false }
                  : { emailStatus: "erro", emailErro: res.erro, emailLogId: res.logId, contatoManual: true });
              }
            }
          }
        }

        // 2) aproximação do limite mínimo (um alerta por faixa atingida)
        if (au.alertaLimite) {
          const ep = episodioLimite(t, a, r);
          if (ep && !alertas[ep.id]) {
            const criado = await criarAlertaSeNovo({
              ...ep, alunoNome: a.nome, turmaNome: t.curso, turmaCodigo: t.codigo || "", status: "aberto",
              titulo: `${FAIXA_LABEL[ep.faixa]} — ${r.pct}% de frequência`, motivos: r.motivos,
              faltasPermitidasRestantes: r.faltasPermitidasRestantes, projecaoPct: r.projecaoPct,
              criadoEm: agoraISO(), criadoPor: usuario?.email || "sistema", emailStatus: "nao_aplicavel", contatoManual: true,
            });
            if (criado) {
              novos++;
              await registrarHistorico({
                tipo: "alerta", turmaId: t.id, alunoId: a.id, alunoNome: a.nome, turmaNome: t.curso,
                descricao: `Alerta preventivo: aluno entrou na faixa "${FAIXA_LABEL[ep.faixa]}" (${r.pct}%, pode faltar mais ${r.faltasPermitidasRestantes}).`,
                usuario: "sistema", alertaId: ep.id,
              });
              if (au.pendenciaAutomatica && ["critico", "abaixo"].includes(ep.faixa) && statusAluno(a) === "Regular" && !atualizacoesAlunos[a.id]) {
                atualizacoesAlunos[a.id] = "Necessita contato";
              }
            }
          }
        }
      }
      const ids = Object.keys(atualizacoesAlunos);
      if (ids.length) {
        await alterarAlunos(t.id, (lista) => lista.map((x) => (atualizacoesAlunos[x.id] ? { ...x, statusAcomp: atualizacoesAlunos[x.id], statusEm: agoraISO() } : x)));
        for (const id of ids) {
          const a = t.alunos.find((x) => x.id === id);
          await registrarHistorico({ tipo: "status", turmaId: t.id, alunoId: id, alunoNome: a?.nome, turmaNome: t.curso, descricao: `Situação alterada automaticamente: ${statusAluno(a)} → ${atualizacoesAlunos[id]}`, usuario: "sistema" });
        }
      }
    }
  } catch (e) {
    console.error("automação", e);
  }
  return { novos, emails };
}
