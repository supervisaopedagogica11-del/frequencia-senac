"use client";
import { useMemo, useState } from "react";
import {
  User, Phone, Mail, MessageCircle, ClipboardCheck, Printer, Pencil, Settings, Flag, Trash2, RotateCcw, Send, AlertTriangle, CheckCircle2, Save,
} from "lucide-react";
import { useData } from "./DataProvider";
import { useUI } from "./Shell";
import { Modal, FaixaChip, StatusChip, FaltasBar } from "./ui";
import { TIPOS_TURMA, TURNOS, TIER_COR, RISCO_LABEL, RISCO_COR, SITUACOES_ALUNO } from "@/lib/constants";
import {
  fmtData, fmtDataHora, isFinalizada, waLink, mailtoLink, emailValido, renderTemplate, variaveisEmail, fmtPct, fmtHoras, textoWhats, situacaoAluno,
} from "@/lib/engine";
import { exportarFichaPDF } from "@/lib/exportar";

function useTurmaAluno(turmaId, alunoId) {
  const { turmas, linhas } = useData();
  const turma = turmas.find((t) => t.id === turmaId);
  const aluno = turma?.alunos.find((a) => a.id === alunoId);
  const linha = linhas.find((l) => l.key === `${turmaId}|${alunoId}`);
  return { turma, aluno, linha };
}

// ---------------------------------------------------------------- FICHA DO ALUNO (igual ao protótipo + melhorias)
export function FichaAluno({ turmaId, alunoId }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { linhas, cfg, pode, acoes } = useData();
  const ui = useUI();
  if (!turma || !aluno || !linha) return <Modal titulo="Aluno não encontrado" onClose={ui.fechar}><p>Este aluno não existe mais.</p></Modal>;
  const r = linha.r;
  const contato = acoes.contatoDe(turma.id, aluno.id);
  const situacao = situacaoAluno(aluno);
  const outras = linhas.filter((x) => x.aluno.nome === aluno.nome && x.turma.id !== turma.id);
  const wa = waLink(aluno.telefone, textoWhats(aluno, turma, cfg));
  const diasRestantes = r.horasRestantes !== null ? Math.floor(r.horasRestantes / (r.horasDia || 1)) : null;
  const historicoPdf = (contato.tentativas || []).map((t) => ({ em: t.data, titulo: `${t.tipo || t.forma || "Contato"}${t.obs ? ` · ${t.obs}` : ""}`, texto: t.resultado ? [`Resultado: ${t.resultado}`] : [], quem: t.responsavel }));

  return (
    <Modal grande onClose={ui.fechar} icone={<User size={16} />} titulo={aluno.nome}
      subtitulo={`${turma.curso} · ${turma.codigo || "sem código"} · ${aluno.telefone || "sem telefone"} · ${aluno.email || "sem e-mail"}`}>
      {situacao !== "Ativo" && (
        <div className="aviso info" style={{ marginBottom: 14 }}>Este aluno está marcado como <strong>&nbsp;{situacao}&nbsp;</strong> — por isso não aparece mais na Agenda, no Painel de atenção nem na Gestão de Permanência.</div>
      )}
      <div className="ficha-acoes">
        <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>Situação do aluno:
          <select className="select" value={situacao} disabled={!pode("contatos")} onChange={(e) => acoes.updateAlunoSituacao(turma, aluno, e.target.value)}>
            {SITUACOES_ALUNO.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={!!contato.concluido} disabled={!pode("contatos")} onChange={(e) => acoes.atualizarContato(turma, aluno, { concluido: e.target.checked }, e.target.checked ? "Acompanhamento concluído" : "Acompanhamento reaberto")} />
          Acompanhamento concluído (sai da Agenda)
        </label>
      </div>
      <div className="row" style={{ marginBottom: 14, gap: 6 }}>
        {wa && <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={12} /> WhatsApp</a>}
        {aluno.email && pode("emails") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirEmail(turma.id, aluno.id)}><Send size={12} /> Enviar e-mail</button>}
        {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, aluno.id)}><Pencil size={12} /> Editar cadastro (e-mail/telefone)</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => exportarFichaPDF({ turma, aluno, linha, contato, historico: historicoPdf, cfg })}><Printer size={12} /> Relatório PDF</button>
      </div>

      <div className="cards" style={{ marginBottom: 16 }}>
        <div className="card kpi cc-total"><div className="n" style={{ color: TIER_COR[linha.st.tier] }}>{fmtPct(r.pct)}</div><div className="l">Frequência atual</div></div>
        <div className="card kpi cc-vermelho"><div className="n">{fmtHoras(r.horasFalta)}</div><div className="l">Horas de falta (limite {fmtHoras(r.limiteHoras)})</div></div>
        <div className="card kpi cc-amarelo"><div className="n">{r.consecutivas}</div><div className="l">Faltas consecutivas</div></div>
        <div className="card kpi" style={{ borderLeftColor: RISCO_COR[linha.risco.nivel] }}><div className="n" style={{ fontSize: 15 }}>{RISCO_LABEL[linha.risco.nivel]}</div><div className="l">Classificação de risco</div></div>
      </div>

      {r.limiteHoras !== null && (
        <div style={{ background: "#F5F7FF", border: "1px solid #E3DEFB", borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 12.5 }}>
          <strong>Cálculo inteligente</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
            {r.faixa === "abaixo" ? (
              <li>Frequência já abaixo de 75% ({fmtHoras(r.horasFalta)} de falta para um limite de {fmtHoras(r.limiteHoras)}) — <strong>não há recuperação matemática possível</strong> neste curso.</li>
            ) : (
              <>
                <li>Ainda pode faltar até <strong>{fmtHoras(r.horasRestantes)}</strong> ({diasRestantes >= 1 ? `~${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"} de aula` : "menos de 1 dia de aula"}) sem cair abaixo de 75%.</li>
                {r.projecaoPct !== null && <li>Mantendo o ritmo atual de faltas, a frequência projetada ao final do curso é de <strong>{fmtPct(r.projecaoPct)}</strong>{r.projecaoPct < 75 ? " ⚠ (projeção abaixo do mínimo)" : ""}.</li>}
              </>
            )}
            <li>{r.aulas} aulas registradas · {r.diasFalta} dia(s) de falta inteira · {r.diasParcial} dia(s) com falta em alguns horários.</li>
          </ul>
        </div>
      )}

      {r.historico.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 12.5 }}>Últimas aulas</strong>
          <div className="calendario" style={{ marginTop: 6 }}>
            {r.historico.slice(-30).map((h) => (
              <span key={h.data} className="cal-dia" title={`${fmtData(h.data)} — ${h.tipo === "P" ? "presente" : `${h.h}h de falta`}`} style={{ background: { P: "#10B981", F: "#EF4444", H: "#F59E0B" }[h.tipo], width: 26 }}>{h.tipo === "P" ? "" : `${h.h}h`}</span>
            ))}
          </div>
        </div>
      )}

      {outras.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <strong style={{ fontSize: 12.5 }}>Também matriculado em</strong>
          {outras.map((x) => (
            <div key={x.key} className="row small" style={{ justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{x.turma.curso} ({x.turma.codigo})</span><strong style={{ color: TIER_COR[x.st.tier] }}>{fmtPct(x.r.pct)}</strong>
            </div>
          ))}
        </div>
      )}

      <strong style={{ fontSize: 12.5 }}>Histórico de intervenções ({(contato.tentativas || []).length})</strong>
      {!(contato.tentativas || []).length ? <div className="small soft" style={{ margin: "8px 0 0" }}>Nenhuma intervenção registrada ainda.</div> : (
        <div style={{ marginTop: 8 }}>
          {contato.tentativas.map((t, i) => (
            <div key={i} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <strong>{fmtData(t.data)}</strong> — {t.tipo || t.forma || "Contato"} {t.obs ? `· ${t.obs}` : ""} {t.resultado ? <em className="soft"> (resultado: {t.resultado})</em> : ""}
            </div>
          ))}
        </div>
      )}
      {pode("contatos") && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => ui.abrirContato(turma.id, aluno.id)}><ClipboardCheck size={12} /> Registrar novo acompanhamento</button>}
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

