"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import * as DB from "@/lib/db";
import { consolidar, mergeConfig, todayISO, statusAluno, isFinalizada, fmtData } from "@/lib/engine";
import { pode as podeFn } from "@/lib/permissoes";
import { processarAutomacoes } from "@/lib/automacao";
import { statusEnvio, enviarERegistrar } from "@/lib/email";
import { novoId, mesclarImportacao } from "@/lib/importar";

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

function chaveDeContato(d) {
  if (d.turmaId && d.alunoId) return `${d.turmaId}|${d.alunoId}`;
  if (d.chave) return d.chave;
  return null;
}

export default function DataProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = carregando
  const [usuario, setUsuario] = useState(undefined);
  const [turmas, setTurmas] = useState([]);
  const [freq, setFreq] = useState({});
  const [contatos, setContatos] = useState({});
  const [alertas, setAlertas] = useState({});
  const [emails, setEmails] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cfgRaw, setCfgRaw] = useState(null);
  const [carregado, setCarregado] = useState({});
  const [envio, setEnvio] = useState({ configurado: false });
  const [toastState, setToastState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const toastTimer = useRef(null);

  const cfg = useMemo(() => mergeConfig(cfgRaw), [cfgRaw]);
  const perfil = usuario?.perfil || null;
  const pode = useCallback((acao) => !!usuario && usuario.ativo !== false && podeFn(perfil, acao), [usuario, perfil]);

  const toast = useCallback((msg, type = "ok") => {
    setToastState({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 3600);
  }, []);
  const confirmar = useCallback((opts) => new Promise((resolve) => setConfirmState({ ...opts, resolve })), []);

  // ---------- autenticação + perfil ----------
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    if (!u) { setUsuario(null); return; }
    try {
      let reg = await DB.lerUsuario(u.email);
      if (!reg) reg = await DB.bootstrapAdmin(u);
      if (reg && !reg.uid) {
        await DB.salvarUsuario({ email: reg.email, uid: u.uid, vinculadoEm: DB.agoraISO() });
        await DB.registrarHistorico({ tipo: "usuario", descricao: `${reg.email} vinculou o e-mail ao sistema (primeiro acesso).`, usuario: reg.email });
        reg = { ...reg, uid: u.uid };
      }
      setUsuario(reg || { email: u.email, naoCadastrado: true });
    } catch (e) {
      console.error(e);
      setUsuario({ email: u.email, erro: e.message });
    }
  }), []);

  const autorizado = !!usuario && !usuario.naoCadastrado && !usuario.erro && usuario.ativo !== false;

  // ---------- dados em tempo real ----------
  useEffect(() => {
    if (!autorizado) return;
    const marca = (k) => setCarregado((c) => (c[k] ? c : { ...c, [k]: true }));
    const subs = [];
    const erro = (k) => (e) => { console.error(k, e); marca(k); };
    subs.push(onSnapshot(collection(db, "turmas"), (s) => { setTurmas(s.docs.map((d) => ({ id: d.id, ...d.data(), alunos: d.data().alunos || [] })).sort((a, b) => (a.curso || "").localeCompare(b.curso || ""))); marca("turmas"); }, erro("turmas")));
    subs.push(onSnapshot(collection(db, "frequencias"), (s) => {
      const m = {};
      s.docs.forEach((d) => { const x = d.data(); if (x.turmaId && x.data) m[`${x.turmaId}|${x.data}`] = x.registros || {}; });
      setFreq(m); marca("freq");
    }, erro("freq")));
    subs.push(onSnapshot(collection(db, "contatos"), (s) => {
      const m = {};
      s.docs.forEach((d) => { const x = d.data(); const k = chaveDeContato(x); if (k) m[k] = { ...x, _id: d.id }; });
      setContatos(m); marca("contatos");
    }, erro("contatos")));
    subs.push(onSnapshot(collection(db, "alertas"), (s) => { const m = {}; s.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; }); setAlertas(m); marca("alertas"); }, erro("alertas")));
    subs.push(onSnapshot(query(collection(db, "emails"), orderBy("enviadoEm", "desc"), limit(1000)), (s) => setEmails(s.docs.map((d) => ({ id: d.id, ...d.data() }))), erro("emails")));
    subs.push(onSnapshot(query(collection(db, "historico"), orderBy("em", "desc"), limit(1500)), (s) => setHistorico(s.docs.map((d) => ({ id: d.id, ...d.data() }))), erro("historico")));
    subs.push(onSnapshot(collection(db, "usuarios"), (s) => setUsuarios(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))), erro("usuarios")));
    subs.push(onSnapshot(doc(db, "config", "geral"), (s) => { setCfgRaw(s.exists() ? s.data() : null); marca("cfg"); }, erro("cfg")));
    statusEnvio().then(setEnvio);
    return () => subs.forEach((u) => u());
  }, [autorizado]);

  const pronto = autorizado && carregado.turmas && carregado.freq && carregado.contatos && carregado.alertas && carregado.cfg;

  // perfil sempre atualizado com o documento em tempo real
  useEffect(() => {
    if (!usuario?.email || !usuarios.length) return;
    const atual = usuarios.find((u) => u.id === DB.idUsuario(usuario.email));
    if (atual && (atual.perfil !== usuario.perfil || atual.ativo !== usuario.ativo || atual.nome !== usuario.nome)) setUsuario((u) => ({ ...u, ...atual }));
  }, [usuarios]); // eslint-disable-line

  // ---------- visão consolidada ----------
  const hoje = todayISO();
  const linhas = useMemo(() => (pronto ? consolidar(turmas, freq, contatos, cfg, hoje) : []), [pronto, turmas, freq, contatos, cfg, hoje]);

  // ---------- automações (roda ao carregar e sempre que a frequência muda) ----------
  // usa sempre o estado mais recente; se uma execução estiver em andamento, agenda outra ao final
  const estadoRef = useRef({});
  estadoRef.current = { turmas, freq, alertas, cfg, usuario };
  const autoCtl = useRef({ rodando: false, de_novo: false });
  const autoTimer = useRef(null);
  const rodarAutomacao = useCallback(async () => {
    const c = autoCtl.current;
    if (c.rodando) { c.de_novo = true; return; }
    c.rodando = true;
    try {
      let total = { novos: 0, emails: 0 };
      do {
        c.de_novo = false;
        const res = await processarAutomacoes(estadoRef.current);
        total.novos += res.novos; total.emails += res.emails;
        if (c.de_novo) await new Promise((r) => setTimeout(r, 1200)); // aguarda os dados recém-gravados chegarem
      } while (c.de_novo);
      if (total.novos) toast(`${total.novos} novo(s) alerta(s) preventivo(s) gerado(s)${total.emails ? ` · ${total.emails} e-mail(s) automático(s) processado(s)` : ""}.`);
    } finally { c.rodando = false; }
  }, [toast]);
  useEffect(() => {
    if (!pronto || !pode("chamada")) return;
    clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(rodarAutomacao, 1500);
    return () => clearTimeout(autoTimer.current);
  }, [pronto, freq, cfg]); // eslint-disable-line

  // ---------- ações ----------
  const quem = usuario?.email || "—";
  const log = (ev) => DB.registrarHistorico({ usuario: quem, ...ev });
  const exigir = (acao) => { if (!pode(acao)) { toast("Seu perfil não tem permissão para esta ação.", "erro"); return false; } return true; };
  const seguro = (fn, msgErro = "Não foi possível salvar") => async (...args) => {
    try { return await fn(...args); } catch (e) { console.error(e); toast(`${msgErro}: ${e.message || e}`, "erro"); return null; }
  };

  const acoes = {
    sair: () => signOut(auth),

    // chamada
    marcar: seguro(async (turma, data, aluno, status) => {
      if (!exigir("chamada")) return;
      const atual = (freq[`${turma.id}|${data}`] || {})[aluno.id];
      const limpou = atual && atual.status === status;
      await DB.marcarRegistro(turma.id, data, aluno.id, limpou ? null : { status, ...(atual?.horarioAtraso ? { horarioAtraso: atual.horarioAtraso } : {}), por: quem, em: DB.agoraISO() }, usuario);
      const nomes = { F: "falta", A: "atraso", J: "falta justificada" };
      await log({ tipo: "frequencia", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso,
        descricao: limpou ? `${nomes[status][0].toUpperCase() + nomes[status].slice(1)} de ${fmtData(data)} removida (presente)` : `${nomes[status][0].toUpperCase() + nomes[status].slice(1)} registrada em ${fmtData(data)}${atual ? ` (antes: ${nomes[atual.status]})` : ""}` });
    }),
    setHorarioAtraso: seguro(async (turma, data, aluno, valor) => {
      if (!exigir("chamada")) return;
      const atual = (freq[`${turma.id}|${data}`] || {})[aluno.id] || { status: "A" };
      await DB.marcarRegistro(turma.id, data, aluno.id, { ...atual, horarioAtraso: valor ? parseInt(valor, 10) : null }, usuario);
    }),
    confirmarChamada: seguro(async (turma, data) => {
      if (!exigir("chamada")) return;
      const chave = `${turma.id}|${data}`;
      await DB.confirmarDia(turma.id, data, usuario);
      await log({ tipo: "frequencia", turmaId: turma.id, turmaNome: turma.curso, descricao: `Chamada de ${fmtData(data)} confirmada` });
      toast("Chamada confirmada.");
    }),
    excluirChamada: seguro(async (turma, data) => {
      if (!exigir("chamada")) return;
      const ok = await confirmar({ titulo: "Excluir a chamada deste dia?", texto: `Isso remove o registro da aula de ${fmtData(data)} (o dia deixa de contar como aula dada). Use apenas se a aula não aconteceu.`, botao: "Excluir chamada", perigo: true });
      if (!ok) return;
      await DB.excluirDia(turma.id, data);
      await log({ tipo: "frequencia", turmaId: turma.id, turmaNome: turma.curso, descricao: `Chamada de ${fmtData(data)} excluída` });
      toast("Chamada excluída.");
    }),

    // turmas
    criarTurma: seguro(async (dados) => {
      if (!exigir("turmaConfig")) return;
      const t = { id: novoId(), alunos: [], finalizada: false, periodoRealFim: null, criadoEm: DB.agoraISO(), criadoPor: quem, ...dados };
      await DB.salvarTurma(t);
      await log({ tipo: "turma", turmaId: t.id, turmaNome: t.curso, descricao: `Turma criada: ${t.curso} (${t.codigo || "sem código"})` });
      toast("Turma criada.");
      return t;
    }),
    atualizarTurma: seguro(async (turma, patch, rotulos) => {
      if (!exigir("turmaConfig")) return;
      const mudancas = Object.keys(patch).filter((k) => JSON.stringify(turma[k] ?? null) !== JSON.stringify(patch[k] ?? null));
      if (!mudancas.length) return;
      await DB.atualizarTurma(turma.id, patch);
      const desc = mudancas.map((k) => `${rotulos?.[k] || k}: ${turma[k] ?? "—"} → ${patch[k] ?? "—"}`).join("; ");
      await log({ tipo: "turma", turmaId: turma.id, turmaNome: turma.curso, descricao: `Turma alterada — ${desc}` });
      toast("Alterações salvas.");
    }),
    finalizarTurma: seguro(async (turma, data) => {
      if (!exigir("turmaConfig")) return;
      const ok = await confirmar({ titulo: "Finalizar turma?", texto: `A turma "${turma.curso}" sairá da lista de turmas ativas e irá para Turmas Finalizadas. Todos os dados e o histórico continuam disponíveis para consulta.`, botao: "Finalizar turma" });
      if (!ok) return;
      await DB.atualizarTurma(turma.id, { finalizada: true, periodoRealFim: data || turma.periodoRealFim || todayISO(), finalizadaEm: DB.agoraISO(), finalizadaPor: quem });
      await log({ tipo: "turma", turmaId: turma.id, turmaNome: turma.curso, descricao: `Turma finalizada (encerramento em ${fmtData(data || turma.periodoRealFim || todayISO())})` });
      toast("Turma movida para Turmas Finalizadas.");
    }),
    reabrirTurma: seguro(async (turma) => {
      if (!exigir("turmaConfig")) return;
      await DB.atualizarTurma(turma.id, { finalizada: false });
      await log({ tipo: "turma", turmaId: turma.id, turmaNome: turma.curso, descricao: "Turma reaberta" });
      toast("Turma reaberta.");
    }),
    excluirTurma: seguro(async (turma) => {
      if (!exigir("excluirTurma")) return false;
      const ok = await confirmar({
        titulo: "Excluir turma definitivamente?",
        texto: `Isso apaga a turma "${turma.curso}" (${turma.codigo || "sem código"}), seus ${turma.alunos.length} alunos, todas as chamadas, contatos e alertas. Essa ação NÃO pode ser desfeita. Se a turma apenas terminou, prefira "Finalizar turma".`,
        botao: "Sim, excluir definitivamente", perigo: true, digitar: turma.codigo || "EXCLUIR",
      });
      if (!ok) return false;
      await DB.excluirTurmaCompleta(turma.id);
      await log({ tipo: "turma", turmaId: turma.id, turmaNome: turma.curso, descricao: `Turma excluída definitivamente (${turma.alunos.length} alunos)` });
      toast("Turma excluída.");
      return true;
    }),

    // alunos
    salvarAluno: seguro(async (turma, aluno) => {
      if (!exigir("editar")) return;
      const existe = turma.alunos.find((a) => a.id === aluno.id);
      const novo = existe ? { ...existe, ...aluno } : { id: novoId(), statusAcomp: "Regular", ...aluno };
      novo.email = (novo.email || "").trim().toLowerCase();
      await DB.alterarAlunos(turma.id, (lista) => (lista.some((a) => a.id === novo.id) ? lista.map((a) => (a.id === novo.id ? { ...a, ...aluno, email: novo.email } : a)) : [...lista, novo]));
      const det = [];
      if (existe) {
        ["nome", "email", "telefone", "matricula"].forEach((k) => { if ((existe[k] || "") !== (novo[k] || "")) det.push(`${k === "email" ? "e-mail" : k}: ${existe[k] || "—"} → ${novo[k] || "—"}`); });
      }
      await log({ tipo: "aluno", turmaId: turma.id, alunoId: novo.id, alunoNome: novo.nome, turmaNome: turma.curso, descricao: existe ? `Cadastro atualizado — ${det.join("; ") || "sem alterações"}` : "Aluno incluído na turma" });
      toast(existe ? "Cadastro do aluno atualizado." : "Aluno incluído.");
      return novo;
    }),
    removerAluno: seguro(async (turma, aluno) => {
      if (!exigir("turmaConfig")) return;
      const ok = await confirmar({ titulo: "Remover aluno da turma?", texto: `"${aluno.nome}" será removido da lista. Se o aluno desistiu, prefira alterar a situação para "Evadido" — assim o histórico é preservado.`, botao: "Remover", perigo: true });
      if (!ok) return;
      await DB.alterarAlunos(turma.id, (lista) => lista.filter((a) => a.id !== aluno.id));
      await log({ tipo: "aluno", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso, descricao: "Aluno removido da turma" });
      toast("Aluno removido.");
    }),
    mudarStatusAluno: seguro(async (turma, aluno, status, obs) => {
      if (!exigir("contatos")) return;
      const anterior = statusAluno(aluno);
      if (anterior === status) return;
      await DB.alterarAlunos(turma.id, (lista) => lista.map((a) => (a.id === aluno.id ? { ...a, statusAcomp: status, situacao: status === "Evadido" ? "Evadiu" : status === "Concluído" ? "Concluiu" : "Ativo", statusEm: DB.agoraISO() } : a)));
      await log({ tipo: "status", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso, descricao: `Situação alterada: ${anterior} → ${status}${obs ? ` (${obs})` : ""}` });
      if (status === "Evadido" || status === "Concluído") {
        // encerra pendências abertas do aluno — o histórico permanece
        const abertos = Object.values(alertas).filter((al) => al.turmaId === turma.id && al.alunoId === aluno.id && al.status === "aberto");
        for (const al of abertos) await DB.atualizarAlerta(al.id, { status: "resolvido", resolvidoEm: DB.agoraISO(), resolvidoPor: quem, resolucao: `Aluno marcado como ${status}` });
      }
      toast(`Situação alterada para "${status}".`);
    }),

    // contatos / acompanhamento
    registrarContato: seguro(async (turma, aluno, t) => {
      if (!exigir("contatos")) return;
      const k = `${turma.id}|${aluno.id}`;
      const atual = contatos[k] || { tentativas: [] };
      const tentativa = { id: novoId(), criadoEm: DB.agoraISO(), responsavel: usuario?.nome || quem, criadoPor: quem, ...t };
      const tentativas = [...(atual.tentativas || []), tentativa];
      const { _id, ...resto } = atual;
      await DB.salvarContato(turma.id, aluno.id, { ...resto, tentativas, ultimoContato: tentativa.data, proximaData: t.proximaData || null, proximaAcao: t.proximaAcao || "", concluido: false });
      await log({
        tipo: "contato", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso,
        descricao: `${fmtData(t.data)} – ${t.forma}${t.motivo ? ` – ${t.motivo}` : ""}${t.resultado ? ` – ${t.resultado}` : ""}${t.retorno ? `. Retorno: ${t.retorno}` : ""}${t.encaminhamento ? `. Encaminhamento: ${t.encaminhamento}` : ""}${t.proximaData ? `. Próximo contato: ${fmtData(t.proximaData)}` : ""}`,
      });
      if (t.novoStatus && t.novoStatus !== statusAluno(aluno)) await acoes.mudarStatusAluno(turma, aluno, t.novoStatus);
      if (t.resolverPendencias) {
        const abertos = Object.values(alertas).filter((al) => al.turmaId === turma.id && al.alunoId === aluno.id && al.status === "aberto");
        for (const al of abertos) await DB.atualizarAlerta(al.id, { status: "resolvido", resolvidoEm: DB.agoraISO(), resolvidoPor: quem, resolucao: `Contato registrado (${t.forma})` });
      }
      toast("Contato registrado.");
    }),
    atualizarAcompanhamento: seguro(async (turma, aluno, patch) => {
      if (!exigir("contatos")) return;
      const k = `${turma.id}|${aluno.id}`;
      const { _id, ...atual } = contatos[k] || { tentativas: [] };
      await DB.salvarContato(turma.id, aluno.id, { ...atual, tentativas: atual.tentativas || [], ...patch });
      if (patch.observacoes !== undefined && patch.observacoes !== atual.observacoes) {
        await log({ tipo: "contato", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso, descricao: "Observações da Supervisão atualizadas" });
      }
      if (patch.concluido !== undefined && patch.concluido !== !!atual.concluido) {
        await log({ tipo: "contato", turmaId: turma.id, alunoId: aluno.id, alunoNome: aluno.nome, turmaNome: turma.curso, descricao: patch.concluido ? "Acompanhamento concluído" : "Acompanhamento reaberto" });
      }
    }),
    resolverAlerta: seguro(async (alerta, resolucao) => {
      if (!exigir("contatos")) return;
      await DB.atualizarAlerta(alerta.id, { status: "resolvido", resolvidoEm: DB.agoraISO(), resolvidoPor: quem, resolucao: resolucao || "Resolvido manualmente" });
      await log({ tipo: "alerta", turmaId: alerta.turmaId, alunoId: alerta.alunoId, alunoNome: alerta.alunoNome, turmaNome: alerta.turmaNome, descricao: `Pendência "${alerta.titulo}" resolvida — ${resolucao || "manualmente"}` });
      toast("Pendência resolvida.");
    }),
    adiarAlerta: seguro(async (alerta, data) => {
      if (!exigir("contatos")) return;
      await DB.atualizarAlerta(alerta.id, { adiadoAte: data });
      await log({ tipo: "alerta", turmaId: alerta.turmaId, alunoId: alerta.alunoId, alunoNome: alerta.alunoNome, turmaNome: alerta.turmaNome, descricao: `Pendência adiada para ${fmtData(data)}` });
      toast(`Pendência adiada para ${fmtData(data)}.`);
    }),
    enviarEmail: seguro(async ({ turma, aluno, assunto, texto, motivo, modelo }) => {
      if (!exigir("emails")) return null;
      const res = await enviarERegistrar({ turma, aluno, assunto, texto, cfg, motivo, modelo, automatico: false, usuario });
      if (res.ok) {
        toast(`E-mail enviado para ${aluno.email}.`);
        const k = `${turma.id}|${aluno.id}`;
        const { _id, ...atual } = contatos[k] || { tentativas: [] };
        const tentativa = { id: novoId(), data: todayISO(), forma: "E-mail", motivo: motivo || "", resultado: "Aguardando retorno", obs: `E-mail enviado pelo sistema: "${assunto}"`, criadoEm: DB.agoraISO(), criadoPor: quem, responsavel: usuario?.nome || quem };
        await DB.salvarContato(turma.id, aluno.id, { ...atual, tentativas: [...(atual.tentativas || []), tentativa], ultimoContato: tentativa.data, concluido: false });
      } else toast(`Falha no envio: ${res.erro}`, "erro");
      return res;
    }),
    reenviarAlerta: seguro(async (alerta) => {
      if (!exigir("emails")) return;
      const turma = turmas.find((t) => t.id === alerta.turmaId);
      const aluno = turma?.alunos.find((a) => a.id === alerta.alunoId);
      if (!turma || !aluno) return;
      const { montarEmail } = await import("@/lib/email");
      const r = linhas.find((l) => l.key === `${turma.id}|${aluno.id}`)?.r;
      const { assunto, texto } = montarEmail({ turma, aluno, resumo: r, cfg });
      const res = await enviarERegistrar({ turma, aluno, assunto, texto, cfg, motivo: alerta.titulo, modelo: "Alerta de faltas consecutivas (reenvio manual)", automatico: false, alertaId: alerta.id, usuario });
      await DB.atualizarAlerta(alerta.id, res.ok ? { emailStatus: "enviado", emailEnviadoEm: DB.agoraISO(), emailLogId: res.logId, contatoManual: false } : { emailStatus: "erro", emailErro: res.erro, emailLogId: res.logId });
      toast(res.ok ? "E-mail enviado." : `Falha: ${res.erro}`, res.ok ? "ok" : "erro");
    }),

    // importação
    importar: seguro(async (blocks) => {
      if (!exigir("importar")) return null;
      const r = mesclarImportacao(turmas, blocks);
      for (const t of r.novas) await DB.salvarTurma({ ...t, criadoEm: DB.agoraISO(), criadoPor: quem });
      for (const t of r.alteradas) await DB.atualizarTurma(t.id, { alunos: t.alunos, cargaHoraria: t.cargaHoraria ?? null });
      await log({ tipo: "importacao", descricao: `Importação: ${r.novas.length} turma(s) nova(s), ${r.alteradas.length} atualizada(s), ${r.novosAlunos} aluno(s) novo(s), ${r.emailsAtualizados} e-mail(s) preenchido(s)` });
      return r;
    }, "Falha na importação"),

    // configurações / usuários
    salvarConfig: seguro(async (novo, descricao) => {
      if (!exigir("configuracoes")) return;
      await DB.salvarConfig(novo);
      await log({ tipo: "config", descricao: descricao || "Configurações do sistema alteradas" });
      toast("Configurações salvas.");
    }),
    salvarUsuario: seguro(async (u, novo) => {
      if (!exigir("usuarios")) return;
      await DB.salvarUsuario({ ...u, ...(novo ? { criadoEm: DB.agoraISO(), criadoPor: quem } : {}) });
      await log({ tipo: "usuario", descricao: novo ? `Usuário cadastrado: ${u.nome} <${u.email}> (${u.perfil})` : `Usuário atualizado: ${u.email} — ${u.perfil}, ${u.ativo ? "ativo" : "inativo"}` });
      toast(novo ? "Usuário cadastrado. Ele já pode fazer o primeiro acesso." : "Usuário atualizado.");
    }),
    excluirUsuario: seguro(async (u) => {
      if (!exigir("usuarios")) return;
      if (DB.idUsuario(u.email) === DB.idUsuario(quem)) { toast("Você não pode excluir o seu próprio usuário.", "erro"); return; }
      const ok = await confirmar({ titulo: "Remover usuário?", texto: `${u.nome} <${u.email}> perderá o acesso ao sistema. Para bloquear temporariamente, prefira marcar como inativo.`, botao: "Remover", perigo: true });
      if (!ok) return;
      await DB.excluirUsuario(u.email);
      await log({ tipo: "usuario", descricao: `Usuário removido: ${u.email}` });
      toast("Usuário removido.");
    }),
  };

  const value = {
    user, usuario, autorizado, pronto, perfil, pode, cfg, cfgRaw, envio, setEnvio,
    turmas, freq, contatos, alertas, emails, historico, usuarios, linhas, hoje,
    toast, confirmar, acoes,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastState && <div className={"toast " + (toastState.type === "erro" ? "erro" : "")} role="status">{toastState.msg}</div>}
      {confirmState && <ConfirmDialog st={confirmState} fechar={(v) => { confirmState.resolve(v); setConfirmState(null); }} />}
    </Ctx.Provider>
  );
}

function ConfirmDialog({ st, fechar }) {
  const [txt, setTxt] = useState("");
  const bloqueado = st.digitar && txt.trim().toUpperCase() !== String(st.digitar).toUpperCase();
  return (
    <div className="modal-backdrop" onClick={() => fechar(false)}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header"><h2 style={{ fontSize: 17 }}>{st.titulo}</h2></div>
        <div className="modal-body">
          <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>{st.texto}</p>
          {st.digitar && (
            <label className="campo">
              <span>Para confirmar, digite <strong>{st.digitar}</strong></span>
              <input className="input" value={txt} onChange={(e) => setTxt(e.target.value)} autoFocus />
            </label>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => fechar(false)}>Cancelar</button>
            <button className={"btn " + (st.perigo ? "btn-perigo" : "btn-primary")} disabled={bloqueado} onClick={() => fechar(true)}>{st.botao || "Confirmar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
