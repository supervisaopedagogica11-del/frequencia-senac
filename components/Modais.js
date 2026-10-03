"use client";
import { useMemo, useState } from "react";
import {
  User, Phone, Mail, MessageCircle, ClipboardCheck, Printer, Pencil, Settings, Flag, Trash2, RotateCcw, Send, AlertTriangle, CheckCircle2, Save,
} from "lucide-react";
import { useData } from "./DataProvider";
import { useUI } from "./Shell";
import { Modal, FaixaChip, StatusChip, FaltasBar } from "./ui";
import { FORMAS_CONTATO, RESULTADOS_CONTATO, STATUS_ALUNO, TIPOS_TURMA, TURNOS, FAIXA_COR } from "@/lib/constants";
import {
  fmtData, fmtDataHora, fmtDataCurta, addDias, statusAluno, isFinalizada, telLink, waLink, mailtoLink, emailValido, renderTemplate, variaveisEmail, fmtPct, fmtHoras, textoWhats,
} from "@/lib/engine";
import { exportarFichaPDF } from "@/lib/exportar";

function useTurmaAluno(turmaId, alunoId) {
  const { turmas, linhas } = useData();
  const turma = turmas.find((t) => t.id === turmaId);
  const aluno = turma?.alunos.find((a) => a.id === alunoId);
  const linha = linhas.find((l) => l.key === `${turmaId}|${alunoId}`);
  return { turma, aluno, linha };
}

// ---------------------------------------------------------------- FICHA DO ALUNO
export function FichaAluno({ turmaId, alunoId }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { contatos, alertas, historico, cfg, pode, acoes } = useData();
  const ui = useUI();
  const [obs, setObs] = useState(null);
  const contato = (turma && aluno && contatos[`${turma.id}|${aluno.id}`]) || { tentativas: [] };
  const linhaTempo = useMemo(() => {
    if (!turma || !aluno) return [];
    const ev = [];
    (contato.tentativas || []).forEach((t) => ev.push({ em: (t.data || "") + "T23:59", cor: "#8B5CF6", titulo: `${fmtDataCurta(t.data)} – ${t.forma || t.tipo || "Contato"}${t.resultado ? ` – ${t.resultado}` : ""}`, texto: [t.obs, t.justificativa && `Justificativa: ${t.justificativa}`, t.encaminhamento && `Encaminhamento: ${t.encaminhamento}`, t.proximaData && `Próximo contato: ${fmtData(t.proximaData)}`].filter(Boolean), quem: t.responsavel }));
    historico.filter((h) => h.alunoId === aluno.id && h.turmaId === turma.id && !["contato", "frequencia"].includes(h.tipo)).forEach((h) => ev.push({ em: h.em, cor: { alerta: "#F97316", email_enviado: "#10B981", email_erro: "#EF4444", status: "#3B82F6" }[h.tipo] || "#6B7280", titulo: h.descricao, quem: h.usuario, hora: true }));
    return ev.sort((a, b) => (b.em || "").localeCompare(a.em || ""));
  }, [contato, historico, aluno, turma]);
  if (!turma || !aluno || !linha) return <Modal titulo="Aluno não encontrado" onClose={ui.fechar}><p>Este aluno não existe mais.</p></Modal>;
  const r = linha.r;
  const status = statusAluno(aluno);
  const abertas = Object.values(alertas).filter((a) => a.turmaId === turma.id && a.alunoId === aluno.id && a.status === "aberto");
  const wa = waLink(aluno.telefone, textoWhats(aluno, turma, cfg));

  return (
    <Modal grande onClose={ui.fechar} icone={<User size={18} />} titulo={aluno.nome}
      subtitulo={`${turma.curso}${turma.codigo ? ` · ${turma.codigo}` : ""} · ${aluno.telefone || "sem telefone"} · ${aluno.email || "sem e-mail"}`}>
      <div className="row" style={{ marginBottom: 16 }}>
        {pode("contatos") && <button className="btn btn-primary btn-sm" onClick={() => ui.abrirContato(turma.id, aluno.id)}><ClipboardCheck size={13} /> Registrar contato</button>}
        {wa && <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>}
        {aluno.email && pode("emails") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirEmail(turma.id, aluno.id)}><Send size={13} /> E-mail</button>}
        {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, aluno.id)}><Pencil size={13} /> Editar cadastro</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => exportarFichaPDF({ turma, aluno, linha, contato, historico: linhaTempo, cfg })}><Printer size={13} /> PDF</button>
      </div>

      <div className="cards" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 12 }}>
        <div className="card kpi" style={{ borderLeftColor: FAIXA_COR[r.faixa] }}><div className="n" style={{ color: FAIXA_COR[r.faixa] }}>{fmtPct(r.pct)}</div><div className="l">Frequência</div></div>
        <div className="card kpi" style={{ borderLeftColor: FAIXA_COR[r.faixa] }}><div className="n">{fmtHoras(r.horasFalta)}</div><div className="l">Faltas de {fmtHoras(r.limiteHoras)} permitidas</div></div>
        <div className="card kpi" style={{ borderLeftColor: "#4F46E5" }}><div className="n">{r.faixa === "abaixo" ? "0h" : fmtHoras(r.horasRestantes)}</div><div className="l">Ainda pode faltar</div></div>
      </div>
      <div className={"aviso " + (r.faixa === "regular" ? "ok" : r.faixa === "abaixo" ? "erro" : "")} style={{ marginBottom: 14 }}>
        <FaixaChip faixa={r.faixa} />
        <span>{r.faixa === "regular" ? `Frequência dentro do esperado.${r.consecutivas ? ` ${r.consecutivas} falta(s) seguida(s) recente(s).` : ""}` : r.motivo}</span>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <label className="campo" style={{ minWidth: 220 }}><span>Acompanhamento</span>
          <select className="select" value={status} disabled={!pode("contatos")} onChange={(e) => acoes.mudarStatusAluno(turma, aluno, e.target.value)}>
            {STATUS_ALUNO.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        {abertas.length > 0 && pode("contatos") && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-end" }} onClick={() => abertas.forEach((a) => acoes.resolverAlerta(a, "Resolvido pela ficha do aluno"))}><CheckCircle2 size={13} /> Marcar pendência como resolvida</button>
        )}
      </div>

      {r.historico.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <h4 style={{ marginBottom: 6 }}>Últimas aulas</h4>
          <div className="calendario">
            {r.historico.slice(-30).map((h) => (
              <span key={h.data} className="cal-dia" title={`${fmtData(h.data)} — ${h.tipo === "P" ? "presente" : h.tipo === "F" ? `faltou (${h.h}h)` : `faltou ${h.h}h`}`}
                style={{ background: { P: "#10B981", F: "#EF4444", H: "#F59E0B" }[h.tipo], width: 26 }}>{h.tipo === "P" ? "" : `${String(h.h).replace(".", ",")}h`}</span>
            ))}
          </div>
          <p className="small soft" style={{ margin: "6px 0 0" }}>Verde = presente · Vermelho = faltou o dia · Amarelo = faltou alguns horários</p>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <h4 style={{ marginBottom: 6 }}>Observações da Supervisão</h4>
        <textarea className="input" disabled={!pode("contatos")} placeholder="Anotações sobre o aluno" value={obs ?? contato.observacoes ?? ""} onChange={(e) => setObs(e.target.value)} />
        {obs !== null && obs !== (contato.observacoes ?? "") && <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={async () => { await acoes.atualizarAcompanhamento(turma, aluno, { observacoes: obs }); setObs(null); }}><Save size={12} /> Salvar</button>}
      </div>

      <h4 style={{ marginBottom: 8 }}>Histórico ({linhaTempo.length})</h4>
      {!linhaTempo.length ? <p className="small soft">Nenhum contato registrado ainda.</p> : (
        <div className="timeline">
          {linhaTempo.slice(0, 50).map((e, i) => (
            <div key={i} className="tl-item" style={{ "--tl": e.cor }}>
              <div style={{ fontWeight: 600 }}>{e.titulo}</div>
              {e.texto?.map((t, j) => <div key={j} className="small">{t}</div>)}
              <div className="q">{e.hora ? fmtDataHora(e.em) : ""}{e.quem ? ` · ${e.quem}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- REGISTRAR CONTATO
const STATUS_POR_RESULTADO = {
  "Conversou com o aluno": "Em acompanhamento",
  "Aguardando retorno": "Aguardando retorno",
  "Não atendeu / sem resposta": "Aguardando retorno",
  "Aluno vai retornar às aulas": "Em acompanhamento",
  "Aluno informou desistência": "Evadido",
};

export function ContatoModal({ turmaId, alunoId }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { cfg, hoje, acoes } = useData();
  const ui = useUI();
  const [f, setF] = useState({ data: hoje, forma: "WhatsApp", resultado: "Conversou com o aluno", obs: "", proximaData: "", justificativa: "", encaminhamento: "" });
  const [salvando, setSalvando] = useState(false);
  if (!turma || !aluno) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const novoStatus = STATUS_POR_RESULTADO[f.resultado];
  const wa = waLink(aluno.telefone, textoWhats(aluno, turma, cfg));

  async function salvar() {
    setSalvando(true);
    await acoes.registrarContato(turma, aluno, { ...f, motivo: linha?.r.motivo || "", novoStatus, resolverPendencias: f.resultado !== "Não atendeu / sem resposta" });
    setSalvando(false);
    ui.fechar();
  }
  return (
    <Modal onClose={ui.fechar} icone={<ClipboardCheck size={18} />} titulo="Registrar contato" subtitulo={`${aluno.nome} · ${turma.curso}${linha ? ` · ${fmtPct(linha.r.pct)}` : ""}`}
      footer={<><button className="btn btn-ghost" onClick={ui.fechar}>Cancelar</button><button className="btn btn-primary" disabled={salvando} onClick={salvar}><Save size={14} /> Salvar</button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        {wa && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={wa} onClick={() => set("forma", "WhatsApp")}><MessageCircle size={12} /> Abrir WhatsApp</a>}
        {telLink(aluno.telefone) && <a className="btn btn-ghost btn-sm" href={telLink(aluno.telefone)} onClick={() => set("forma", "Ligação")}><Phone size={12} /> Ligar</a>}
        {!aluno.telefone && !aluno.email && <span className="aviso" style={{ padding: "6px 10px" }}><AlertTriangle size={13} /> Sem telefone e sem e-mail. <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, aluno.id)}>Cadastrar</button></span>}
      </div>
      <div className="campo" style={{ marginBottom: 12 }}><span>Como foi o contato</span>
        <div className="pills">{FORMAS_CONTATO.map((x) => <button key={x} type="button" className={"pill" + (f.forma === x ? " on" : "")} onClick={() => set("forma", x)}>{x}</button>)}</div>
      </div>
      <div className="grid-form">
        <label className="campo"><span>Resultado</span><select className="select" value={f.resultado} onChange={(e) => set("resultado", e.target.value)}>{RESULTADOS_CONTATO.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo"><span>Data</span><input type="date" className="input" value={f.data} max={hoje} onChange={(e) => set("data", e.target.value)} /></label>
      </div>
      <label className="campo" style={{ marginTop: 12 }}><span>O que o aluno disse / observação</span><textarea className="input" value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Ex.: dificuldade de conciliar trabalho e curso" /></label>
      <label className="campo" style={{ marginTop: 12 }}><span>Falar de novo em (opcional)</span>
        <span className="row" style={{ gap: 5 }}>
          <input type="date" className="input" value={f.proximaData} min={hoje} onChange={(e) => set("proximaData", e.target.value)} />
          {[2, 7].map((n) => <button type="button" key={n} className="pill" onClick={() => set("proximaData", addDias(hoje, n))}>+{n} dias</button>)}
        </span>
      </label>
      <details style={{ marginTop: 12 }}>
        <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Mais detalhes (justificativa e encaminhamento)</summary>
        <div className="grid-form" style={{ marginTop: 10 }}>
          <label className="campo"><span>Justificativa apresentada</span><input className="input" value={f.justificativa} onChange={(e) => set("justificativa", e.target.value)} /></label>
          <label className="campo"><span>Encaminhamento</span><input className="input" value={f.encaminhamento} onChange={(e) => set("encaminhamento", e.target.value)} /></label>
        </div>
      </details>
      <p className="small soft" style={{ marginBottom: 0 }}>Ao salvar, o acompanhamento do aluno muda para <strong>{novoStatus}</strong>{f.resultado !== "Não atendeu / sem resposta" ? " e a pendência sai da lista" : ""}.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- FORMULÁRIO DE TURMA
const ROTULOS = { curso: "Curso", codigo: "Código", tipo: "Tipo", turno: "Turno", instrutor: "Docente", horariosPorDia: "Horas/dia", cargaHoraria: "Carga horária", periodoInicio: "Início", periodoFim: "Previsão de término", periodoRealFim: "Encerramento real", horarioInicio: "Horário início", horarioFim: "Horário fim" };

function FormTurma({ f, set, disabled }) {
  return (
    <>
      <div className="grid-form">
        <label className="campo" style={{ gridColumn: "1 / -1" }}><span>Nome do curso / turma *</span><input className="input" disabled={disabled} value={f.curso || ""} onChange={(e) => set("curso", e.target.value)} /></label>
        <label className="campo"><span>Código da turma</span><input className="input" disabled={disabled} value={f.codigo || ""} onChange={(e) => set("codigo", e.target.value)} /></label>
        <label className="campo"><span>Tipo da turma</span>
          <select className="select" disabled={disabled} value={f.tipo || ""} onChange={(e) => set("tipo", e.target.value || null)}><option value="">Não definido</option>{TIPOS_TURMA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        </label>
        <label className="campo"><span>Turno</span><select className="select" disabled={disabled} value={f.turno || "Manhã"} onChange={(e) => set("turno", e.target.value)}>{TURNOS.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="campo"><span>Docente</span><input className="input" disabled={disabled} value={f.instrutor || ""} onChange={(e) => set("instrutor", e.target.value)} /></label>
      </div>
      <h4 style={{ margin: "18px 0 10px" }}>Carga horária</h4>
      <div className="grid-form">
        <label className="campo"><span>Horas de aula por dia (nº de horários) *</span><input type="number" min={1} max={12} className="input" disabled={disabled} value={f.horariosPorDia ?? ""} onChange={(e) => set("horariosPorDia", e.target.value ? Number(e.target.value) : null)} /></label>
        <label className="campo"><span>Carga horária total do curso (h) *</span><input type="number" min={1} className="input" disabled={disabled} value={f.cargaHoraria ?? ""} onChange={(e) => set("cargaHoraria", e.target.value ? Number(e.target.value) : null)} /></label>
        <label className="campo"><span>Horário de início</span><input type="time" className="input" disabled={disabled} value={f.horarioInicio || ""} onChange={(e) => set("horarioInicio", e.target.value || null)} /></label>
        <label className="campo"><span>Horário de término</span><input type="time" className="input" disabled={disabled} value={f.horarioFim || ""} onChange={(e) => set("horarioFim", e.target.value || null)} /></label>
      </div>
      <h4 style={{ margin: "18px 0 10px" }}>Datas</h4>
      <div className="grid-form">
        <label className="campo"><span>Início do curso</span><input type="date" className="input" disabled={disabled} value={f.periodoInicio || ""} onChange={(e) => set("periodoInicio", e.target.value || null)} /></label>
        <label className="campo"><span>Previsão de término</span><input type="date" className="input" disabled={disabled} value={f.periodoFim || ""} onChange={(e) => set("periodoFim", e.target.value || null)} /></label>
        <label className="campo"><span>Data real de encerramento</span><input type="date" className="input" disabled={disabled} value={f.periodoRealFim || ""} onChange={(e) => set("periodoRealFim", e.target.value || null)} /></label>
      </div>
      {f.cargaHoraria && f.horariosPorDia ? <p className="small soft" style={{ marginTop: 10 }}>≈ {Math.ceil(f.cargaHoraria / f.horariosPorDia)} aulas no total · limite de faltas: {String(f.cargaHoraria * 0.25).replace(".", ",")}h (25% da carga horária)</p> : null}
    </>
  );
}

const CAMPOS_TURMA = ["curso", "codigo", "tipo", "turno", "instrutor", "horariosPorDia", "cargaHoraria", "horarioInicio", "horarioFim", "periodoInicio", "periodoFim", "periodoRealFim"];

export function TurmaConfigModal({ turmaId }) {
  const { turmas, historico, pode, acoes } = useData();
  const ui = useUI();
  const turma = turmas.find((t) => t.id === turmaId);
  const [f, setF] = useState(() => (turma ? Object.fromEntries(CAMPOS_TURMA.map((k) => [k, turma[k] ?? null])) : {}));
  const [salvando, setSalvando] = useState(false);
  if (!turma) return null;
  const fin = isFinalizada(turma);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const podeEditar = pode("turmaConfig");
  const hist = historico.filter((h) => h.turmaId === turma.id && h.tipo === "turma").slice(0, 8);

  async function salvar() {
    if (!f.curso?.trim()) return;
    setSalvando(true);
    await acoes.atualizarTurma(turma, { ...f, curso: f.curso.trim() }, ROTULOS);
    setSalvando(false);
  }
  return (
    <Modal grande onClose={ui.fechar} icone={<Settings size={18} />} titulo="Configurações da turma" subtitulo={`${turma.curso} · ${turma.codigo || "sem código"}`}
      footer={podeEditar && <><button className="btn btn-ghost" onClick={ui.fechar}>Fechar</button><button className="btn btn-primary" disabled={salvando || !f.curso?.trim()} onClick={salvar}><Save size={14} /> Salvar alterações</button></>}>
      {fin && <div className="aviso info" style={{ marginBottom: 14 }}><Flag size={14} /> Turma finalizada em {fmtData(turma.periodoRealFim)} — está em Turmas Finalizadas, com todos os dados preservados.</div>}
      <FormTurma f={f} set={set} disabled={!podeEditar} />
      {podeEditar && (
        <div className="card" style={{ marginTop: 20, background: "#FAFAFC" }}>
          <h4 style={{ marginBottom: 10 }}>Situação da turma</h4>
          <div className="row">
            {!fin ? (
              <button className="btn btn-ghost" onClick={async () => { await acoes.finalizarTurma(turma, f.periodoRealFim); }}><Flag size={14} /> Marcar turma como finalizada</button>
            ) : (
              <button className="btn btn-ghost" onClick={() => acoes.reabrirTurma(turma)}><RotateCcw size={14} /> Reabrir turma</button>
            )}
            {pode("excluirTurma") && <button className="btn btn-perigo-ghost" style={{ marginLeft: "auto" }} onClick={async () => { const ok = await acoes.excluirTurma(turma); if (ok) { ui.fechar(); if (typeof window !== "undefined" && window.location.pathname.includes(turma.id)) window.location.href = "/painel"; } }}><Trash2 size={14} /> Excluir turma</button>}
          </div>
          <p className="small soft" style={{ margin: "10px 0 0" }}>Finalizar move a turma para “Turmas Finalizadas” mantendo dados e histórico. Excluir apaga tudo definitivamente.</p>
        </div>
      )}
      {hist.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ marginBottom: 6 }}>Histórico de alterações</h4>
          {hist.map((h) => <div key={h.id} className="small" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}><span className="soft">{fmtDataHora(h.em)} · {h.usuario}</span> — {h.descricao}</div>)}
        </div>
      )}
    </Modal>
  );
}

export function NovaTurmaModal({ turno, onCriada }) {
  const { acoes } = useData();
  const ui = useUI();
  const [f, setF] = useState({ curso: "", codigo: "", tipo: null, turno: turno || "Manhã", instrutor: "", horariosPorDia: 4, cargaHoraria: null, horarioInicio: null, horarioFim: null, periodoInicio: null, periodoFim: null, periodoRealFim: null });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.curso.trim() && f.cargaHoraria && f.horariosPorDia;
  return (
    <Modal grande onClose={ui.fechar} titulo="Nova turma" subtitulo="Depois de criar, inclua os alunos na aba Alunos (ou importe a planilha)."
      footer={<><button className="btn btn-ghost" onClick={ui.fechar}>Cancelar</button><button className="btn btn-primary" disabled={!ok} onClick={async () => { const t = await acoes.criarTurma({ ...f, curso: f.curso.trim() }); if (t) { ui.fechar(); onCriada?.(t); } }}>Criar turma</button></>}>
      <FormTurma f={f} set={set} />
    </Modal>
  );
}

// ---------------------------------------------------------------- CADASTRO DO ALUNO
export function AlunoModal({ turmaId, alunoId }) {
  const { turmas, acoes, pode } = useData();
  const ui = useUI();
  const turma = turmas.find((t) => t.id === turmaId);
  const aluno = turma?.alunos.find((a) => a.id === alunoId);
  const [f, setF] = useState({ nome: aluno?.nome || "", matricula: aluno?.matricula || "", telefone: aluno?.telefone || "", email: aluno?.email || "" });
  if (!turma) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const emailOk = !f.email || emailValido(f.email);
  return (
    <Modal onClose={ui.fechar} titulo={aluno ? "Editar cadastro do aluno" : "Incluir aluno"} subtitulo={turma.curso}
      footer={<>
        {aluno && pode("turmaConfig") && <button className="btn btn-perigo-ghost" style={{ marginRight: "auto" }} onClick={async () => { await acoes.removerAluno(turma, aluno); ui.fechar(); }}><Trash2 size={13} /> Remover</button>}
        <button className="btn btn-ghost" onClick={ui.fechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={!f.nome.trim() || !emailOk} onClick={async () => { await acoes.salvarAluno(turma, { ...(aluno ? { id: aluno.id } : {}), ...f, nome: f.nome.trim() }); ui.fechar(); }}><Save size={14} /> Salvar</button>
      </>}>
      <div className="grid-form">
        <label className="campo" style={{ gridColumn: "1 / -1" }}><span>Nome completo *</span><input className="input" value={f.nome} onChange={(e) => set("nome", e.target.value)} autoFocus /></label>
        <label className="campo"><span>Matrícula</span><input className="input" value={f.matricula} onChange={(e) => set("matricula", e.target.value)} /></label>
        <label className="campo"><span>Telefone / WhatsApp</span><input className="input" inputMode="tel" placeholder="(35) 99999-9999" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} /></label>
        <label className="campo" style={{ gridColumn: "1 / -1" }}><span>E-mail do aluno</span>
          <input className="input" type="email" placeholder="aluno@email.com" value={f.email} onChange={(e) => set("email", e.target.value)} style={{ borderColor: emailOk ? undefined : "var(--vermelho)" }} />
          <small>{emailOk ? "Usado automaticamente nos e-mails do sistema — não é preciso digitar de novo." : "E-mail inválido."}</small>
        </label>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- ENVIO DE E-MAIL
export function EmailModal({ turmaId, alunoId, motivo }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { cfg, envio, acoes, usuario } = useData();
  const ui = useUI();
  const vars = turma && aluno ? variaveisEmail({ turma, aluno, resumo: linha?.r, cfg, responsavel: cfg.email.responsavelContato }) : {};
  const [assunto, setAssunto] = useState(renderTemplate(cfg.email.assunto, vars));
  const [texto, setTexto] = useState(renderTemplate(cfg.email.corpo, vars));
  const [enviando, setEnviando] = useState(false);
  if (!turma || !aluno) return null;
  return (
    <Modal grande onClose={ui.fechar} icone={<Send size={18} />} titulo="Enviar e-mail ao aluno" subtitulo={`${aluno.nome} · ${turma.curso}`}
      footer={<><button className="btn btn-ghost" onClick={ui.fechar}>Cancelar</button>
        <button className="btn btn-primary" disabled={enviando || !aluno.email || !envio.configurado} onClick={async () => { setEnviando(true); const r = await acoes.enviarEmail({ turma, aluno, assunto, texto, motivo: motivo || "Contato da Supervisão", modelo: "Modelo padrão (envio manual)" }); setEnviando(false); if (r?.ok) ui.fechar(); }}>
          <Send size={14} /> {enviando ? "Enviando..." : "Enviar"}</button></>}>
      {!envio.configurado && <div className="aviso erro" style={{ marginBottom: 12 }}><AlertTriangle size={14} /> O envio de e-mails ainda não foi configurado no servidor. Veja Configurações → E-mail. Você ainda pode usar o botão “Abrir no meu e-mail”.</div>}
      <div className="campo" style={{ marginBottom: 12 }}><span>Para</span>
        {aluno.email ? <div className="input" style={{ background: "#F7F8FC" }}>{aluno.email}</div> : <div className="aviso">Aluno sem e-mail. <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, aluno.id)}>Cadastrar e-mail</button></div>}
      </div>
      <label className="campo" style={{ marginBottom: 12 }}><span>Assunto</span><input className="input" value={assunto} onChange={(e) => setAssunto(e.target.value)} /></label>
      <label className="campo"><span>Mensagem</span><textarea className="input" style={{ minHeight: 260 }} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
      <div className="row" style={{ marginTop: 10 }}>
        {aluno.email && <a className="btn btn-ghost btn-sm" href={mailtoLink(aluno.email, assunto, texto)}><Mail size={12} /> Abrir no meu e-mail</a>}
        <span className="small soft">Remetente: {envio.remetente || cfg.email.remetenteEmail || "não configurado"} · enviado por {usuario?.email}</span>
      </div>
    </Modal>
  );
}

