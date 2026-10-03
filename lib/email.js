import { auth } from "./firebase";
import { mergeConfig, renderTemplate, variaveisEmail } from "./engine";
import { registrarEmail, registrarHistorico, agoraISO } from "./db";

export async function statusEnvio() {
  try { const r = await fetch("/api/email", { cache: "no-store" }); return await r.json(); } catch { return { configurado: false }; }
}

export function montarEmail({ turma, aluno, resumo, cfg, responsavel, assunto, corpo }) {
  const c = mergeConfig(cfg);
  const vars = variaveisEmail({ turma, aluno, resumo, cfg: c, responsavel });
  return {
    assunto: renderTemplate(assunto ?? c.email.assunto, vars),
    texto: renderTemplate(corpo ?? c.email.corpo, vars),
  };
}

// envia e registra no histórico de disparos (sempre registra, inclusive falhas)
export async function enviarERegistrar({ turma, aluno, assunto, texto, cfg, motivo, modelo, automatico, alertaId, usuario }) {
  const c = mergeConfig(cfg);
  const base = {
    turmaId: turma.id, turmaNome: turma.curso, turmaCodigo: turma.codigo || "",
    alunoId: aluno.id, alunoNome: aluno.nome, para: aluno.email || "",
    assunto, corpo: texto, motivo: motivo || "", modelo: modelo || "Manual",
    automatico: !!automatico, alertaId: alertaId || null,
    usuario: usuario?.email || "sistema", usuarioNome: usuario?.nome || "",
    enviadoEm: agoraISO(),
  };
  let res;
  if (!aluno.email) res = { ok: false, erro: "Aluno sem e-mail cadastrado." };
  else {
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ para: aluno.email, assunto, texto, nomeRemetente: c.email.remetenteNome, replyTo: c.email.remetenteEmail || undefined, instituicao: c.instituicao }),
      });
      res = await r.json().catch(() => ({ ok: false, erro: `Erro ${r.status}` }));
    } catch (e) { res = { ok: false, erro: e.message || "Falha de rede." }; }
  }
  const log = { ...base, status: res.ok ? "enviado" : "erro", erro: res.ok ? null : res.erro, provedor: res.provedor || null, remetente: res.remetente || null };
  const id = await registrarEmail(log);
  await registrarHistorico({
    tipo: res.ok ? "email_enviado" : "email_erro", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso,
    descricao: res.ok ? `E-mail ${automatico ? "automático " : ""}enviado para ${aluno.email} — "${assunto}"` : `Falha no envio de e-mail${automatico ? " automático" : ""}: ${res.erro}`,
    usuario: usuario?.email || "sistema", emailId: id,
  });
  return { ...res, logId: id };
}
