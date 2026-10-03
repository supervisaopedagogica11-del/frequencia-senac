"use client";
import { useMemo, useState } from "react";
import {
  User, Phone, Mail, MessageCircle, ClipboardCheck, Printer, Pencil, Settings, Flag, Trash2, RotateCcw, Send, AlertTriangle, CheckCircle2, Save,
} from "lucide-react";
import { useData } from "./DataProvider";
import { useUI } from "./Shell";
import { Modal, FaixaChip, StatusChip, Pct } from "./ui";
import {
  FORMAS_CONTATO, MOTIVOS_CONTATO, RESULTADOS_CONTATO, STATUS_ALUNO, TIPOS_TURMA, TURNOS, FAIXA_COR, VARIAVEIS_EMAIL,
} from "@/lib/constants";
import {
  fmtData, fmtDataHora, fmtDataCurta, addDias, statusAluno, isFinalizada, telLink, waLink, mailtoLink, emailValido, renderTemplate, variaveisEmail, fmtPct,
} from "@/lib/engine";
import { exportarFichaPDF } from "@/lib/exportar";

function useTurmaAluno(turmaId, alunoId) {
  const { turmas, linhas } = useData();
  const turma = turmas.find((t) => t.id === turmaId);
  const aluno = turma?.alunos.find((a) => a.id === alunoId);
  const linha = linhas.find((l) => l.key === `${turmaId}|${alunoId}`);
  return { turma, aluno, linha };
}

function textoWhats(aluno, turma, cfg) {
  const nome = (aluno.nome || "").split(" ")[0];
  return `Olá, ${nome}! Aqui é da Supervisão Pedagógica do ${cfg.instituicao}. Sentimos sua falta nas aulas de ${turma.curso} e queremos saber se está tudo bem. Podemos ajudar em algo? 🙂`;
}

// ---------------------------------------------------------------- FICHA DO ALUNO
export function FichaAluno({ turmaId, alunoId }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { contatos, alertas, historico, emails, linhas, cfg, pode, acoes } = useData();
  const ui = useUI();
  const [obs, setObs] = useState(null);
  const contato = (turma && aluno && contatos[`${turma.id}|${aluno.id}`]) || { tentativas: [] };
  const linhaTempo = useMemo(() => {
    if (!turma || !aluno) return [];
    const ev = [];
    (contato.tentativas || []).forEach((t) => ev.push({ em: (t.data || "") + "T23:59", cor: "#8B5CF6", titulo: `${fmtDataCurta(t.data)} – ${t.forma || t.tipo || "Contato"}${t.motivo ? ` – ${t.motivo}` : ""}`, texto: [t.resultado && `Resultado: ${t.resultado}`, t.retorno && `Retorno do aluno: ${t.retorno}`, t.justificativa && `Justificativa: ${t.justificativa}`, t.encaminhamento && `Encaminhamento: ${t.encaminhamento}`, t.proximaAcao && `Próxima ação: ${t.proximaAcao}`, t.proximaData && `Próximo contato: ${fmtData(t.proximaData)}`, t.obs].filter(Boolean), quem: t.responsavel }));
    historico.filter((h) => h.alunoId === aluno.id && h.turmaId === turma.id && h.tipo !== "contato").forEach((h) => ev.push({ em: h.em, cor: { alerta: "#F97316", email_enviado: "#10B981", email_erro: "#EF4444", status: "#3B82F6", frequencia: "#9CA3AF" }[h.tipo] || "#6B7280", titulo: h.descricao, quem: h.usuario, hora: true }));
    return ev.sort((a, b) => (b.em || "").localeCompare(a.em || ""));
  }, [contato, historico, aluno, turma]);
  if (!turma || !aluno || !linha) return <Modal titulo="Aluno não encontrado" onClose={ui.fechar}><p>Este aluno não existe mais.</p></Modal>;
  const r = linha.r;
  const status = statusAluno(aluno);
  const pend = Object.values(alertas).filter((a) => a.turmaId === turma.id && a.alunoId === aluno.id).sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
  const abertas = pend.filter((a) => a.status === "aberto");
  const outras = linhas.filter((l) => l.turma.id !== turma.id && (l.aluno.nome || "").toLowerCase() === (aluno.nome || "").toLowerCase());

  const emailsAluno = emails.filter((e) => e.alunoId === aluno.id && e.turmaId === turma.id);

  return (
    <Modal grande onClose={ui.fechar} icone={<User size={18} />} titulo={aluno.nome}
      subtitulo={`${turma.curso} · ${turma.codigo || "sem código"} · ${turma.turno}${aluno.matricula ? ` · Matrícula ${aluno.matricula}` : ""}`}>
      <div className="row" style={{ marginBottom: 14 }}>
        <span className="small"><Phone size={12} /> {aluno.telefone || <em className="soft">sem telefone</em>}</span>
        <span className="small"><Mail size={12} /> {aluno.email || <em className="soft">sem e-mail</em>}</span>
        {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, aluno.id)}><Pencil size={12} /> Editar cadastro</button>}
      </div>

      <div className="card" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", background: "#F7F8FC", marginBottom: 14 }}>
        <label className="campo" style={{ minWidth: 200 }}><span>Situação do aluno</span>
          <select className="select" value={status} disabled={!pode("contatos")} onChange={(e) => acoes.mudarStatusAluno(turma, aluno, e.target.value)}>
            {STATUS_ALUNO.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="row" style={{ marginLeft: "auto" }}>
          {pode("contatos") && <button className="btn btn-primary btn-sm" onClick={() => ui.abrirContato(turma.id, aluno.id)}><ClipboardCheck size={13} /> Registrar contato</button>}
          {pode("emails") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirEmail(turma.id, aluno.id)}><Send size={13} /> Enviar e-mail</button>}
          {waLink(aluno.telefone) && <a className="btn btn-ghost btn-sm" href={waLink(aluno.telefone, textoWhats(aluno, turma, cfg))} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>}
          <button className="btn btn-ghost btn-sm" onClick={() => exportarFichaPDF({ turma, aluno, linha, contato, historico: linhaTempo, cfg })}><Printer size={13} /> PDF</button>
        </div>
      </div>

      {status === "Evadido" || status === "Concluído" ? (
        <div className="aviso info" style={{ marginBottom: 14 }}>Aluno marcado como <strong>&nbsp;{status}&nbsp;</strong> — não aparece nas pendências, mas todo o histórico continua disponível.</div>
      ) : null}

      <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", marginBottom: 14 }}>
        <div className="card kpi" style={{ borderLeftColor: FAIXA_COR[r.faixa] }}><div className="n" style={{ color: FAIXA_COR[r.faixa] }}>{fmtPct(r.pct)}</div><div className="l">Frequência atual</div></div>
        <div className="card kpi" style={{ borderLeftColor: "#EF4444" }}><div className="n">{r.faltas}</div><div className="l">Faltas acumuladas</div><div className="d">{r.atrasos} atrasos · {r.justificadas} justificadas</div></div>
        <div className="card kpi" style={{ borderLeftColor: r.consecutivas >= cfg.consecutivasAlerta ? "#EF4444" : "#F59E0B" }}><div className="n">{r.consecutivas}</div><div className="l">Faltas consecutivas</div></div>
        <div className="card kpi" style={{ borderLeftColor: "#F97316" }}><div className="n">{r.faltasPermitidasRestantes ?? "—"}</div><div className="l">Pode faltar mais (dias)</div><div className="d">{r.horasPermitidasRestantes !== null ? `${Math.round(r.horasPermitidasRestantes * 10) / 10}h de folga` : ""}</div></div>
        <div className="card kpi" style={{ borderLeftColor: "#4F46E5" }}><div className="n">{r.aulasRestantes ?? "—"}</div><div className="l">Aulas restantes</div><div className="d">{r.horasRestantesCurso ?? "—"}h · {r.aulas} aulas dadas</div></div>
        <div className="card kpi" style={{ borderLeftColor: r.projecaoPct !== null && r.projecaoPct < cfg.limiteMinimo ? "#EF4444" : "#10B981" }}><div className="n" style={{ fontSize: 22 }}>{fmtPct(r.projecaoPct)}</div><div className="l">Projeção ao final</div><div className="d">se mantiver o ritmo atual</div></div>
      </div>

      <div className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${FAIXA_COR[r.faixa]}` }}>
        <div className="row" style={{ marginBottom: 6 }}><FaixaChip faixa={r.faixa} /><strong style={{ fontSize: 13 }}>Situação de risco</strong></div>
        {r.motivos.length > 0 && <ul style={{ margin: "4px 0 8px", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>{r.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>}
        {r.pctNecessarioRestante !== null && r.faixa !== "abaixo" && (
          <p className="small" style={{ margin: "0 0 6px" }}>Para terminar com pelo menos {cfg.limiteMinimo}%, precisa de <strong>{r.pctNecessarioRestante}% de presença</strong> nas {r.aulasRestantes} aulas restantes.</p>
        )}
        <p className="small" style={{ margin: 0 }}><strong>Ação recomendada:</strong> {r.acao}</p>
      </div>

      {r.historico.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 6 }}>Últimas aulas</h4>
          <div className="calendario">
            {r.historico.slice(-40).map((h) => (
              <span key={h.data} className="cal-dia" title={`${fmtData(h.data)} — ${{ P: "Presente", F: "Falta", A: "Atraso", J: "Justificada" }[h.status]}`}
                style={{ background: { P: "#10B981", F: "#EF4444", A: "#F59E0B", J: "#5B7FBF" }[h.status] }}>{h.status}</span>
            ))}
          </div>
        </div>
      )}

      {abertas.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 6 }}>Pendências abertas</h4>
          <div className="lista">
            {abertas.map((a) => (
              <div key={a.id} className="item" style={{ borderLeftColor: "#F97316" }}>
                <div className="grow"><div className="t">{a.titulo}</div><div className="s">Gerado automaticamente em {fmtDataHora(a.criadoEm)}{a.emailStatus === "enviado" ? " · e-mail enviado" : a.emailStatus === "erro" ? " · falha no e-mail — contato manual" : ""}</div></div>
                {pode("contatos") && <button className="btn btn-ghost btn-sm" onClick={() => acoes.resolverAlerta(a, "Resolvido pela ficha do aluno")}><CheckCircle2 size={12} /> Resolver</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 6 }}>Observações da Supervisão</h4>
        <textarea className="input" disabled={!pode("contatos")} placeholder="Anotações gerais sobre o aluno (ficam salvas no acompanhamento)" value={obs ?? contato.observacoes ?? ""} onChange={(e) => setObs(e.target.value)} />
        {obs !== null && obs !== (contato.observacoes ?? "") && <button className="btn btn-primary btn-sm" style={{ marginTop: 6 }} onClick={async () => { await acoes.atualizarAcompanhamento(turma, aluno, { observacoes: obs }); setObs(null); }}><Save size={12} /> Salvar observações</button>}
      </div>

      {outras.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 6 }}>Também matriculado em</h4>
          {outras.map((x) => (
            <div key={x.key} className="row small" style={{ justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--line)" }}>
              <button className="link-aluno" onClick={() => ui.abrirFicha(x.turma.id, x.aluno.id)}>{x.turma.curso} ({x.turma.codigo})</button><Pct r={x.r} limite={cfg.limiteMinimo} mostrarBarra={false} />
            </div>
          ))}
        </div>
      )}

      <h4 style={{ marginBottom: 8 }}>Histórico de acompanhamento ({linhaTempo.length})</h4>
      {!linhaTempo.length ? <p className="small soft">Nenhum registro ainda.</p> : (
        <div className="timeline">
          {linhaTempo.slice(0, 80).map((e, i) => (
            <div key={i} className="tl-item" style={{ "--tl": e.cor }}>
              <div style={{ fontWeight: 600 }}>{e.titulo}</div>
              {e.texto?.map((t, j) => <div key={j} className="small">{t}</div>)}
              <div className="q">{e.hora ? fmtDataHora(e.em) : ""}{e.quem ? ` · ${e.quem}` : ""}</div>
            </div>
          ))}
        </div>
      )}
      {emailsAluno.length > 0 && <p className="small soft" style={{ marginTop: 10 }}>{emailsAluno.length} e-mail(s) registrados para este aluno — veja em Relatórios → E-mails enviados.</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------- REGISTRAR CONTATO
export function ContatoModal({ turmaId, alunoId, motivo: motivoInicial }) {
  const { turma, aluno, linha } = useTurmaAluno(turmaId, alunoId);
  const { cfg, hoje, acoes, contatos } = useData();
  const ui = useUI();
  const sugMotivo = motivoInicial || (linha?.r.consecutivas >= cfg.consecutivasAlerta ? "Faltas consecutivas" : linha?.r.faixa === "abaixo" ? "Frequência abaixo de 75%" : ["risco", "critico", "atencao"].includes(linha?.r.faixa) ? "Frequência próxima de 75%" : "Acompanhamento de rotina");
  const [f, setF] = useState({
    data: hoje, forma: "WhatsApp", motivo: sugMotivo, resultado: "Contato realizado", retorno: "", justificativa: "", encaminhamento: "",
    proximaAcao: "", proximaData: "", obs: "", novoStatus: "", resolverPendencias: true,
  });
  const [salvando, setSalvando] = useState(false);
  if (!turma || !aluno) return null;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const statusSugerido = f.resultado === "Aguardando retorno" || f.resultado === "Sem resposta" ? "Aguardando retorno"
    : f.resultado === "Aluno informou desistência" ? "Risco de evasão"
    : f.resultado === "Aluno retornou às aulas" ? "Em acompanhamento" : "Contatado";
  const historicoAnterior = (contatos[`${turma.id}|${aluno.id}`]?.tentativas || []).slice(-3).reverse();

  async function salvar() {
    setSalvando(true);
    await acoes.registrarContato(turma, aluno, { ...f, novoStatus: f.novoStatus || statusSugerido });
    setSalvando(false);
    ui.fechar();
  }
  return (
    <Modal grande onClose={ui.fechar} icone={<ClipboardCheck size={18} />} titulo="Registrar contato" subtitulo={`${aluno.nome} · ${turma.curso}${linha ? ` · ${fmtPct(linha.r.pct)} · ${linha.r.consecutivas} faltas seguidas` : ""}`}
      footer={<><button className="btn btn-ghost" onClick={ui.fechar}>Cancelar</button><button className="btn btn-primary" disabled={salvando} onClick={salvar}><Save size={14} /> Salvar contato</button></>}>
      <div className="row" style={{ marginBottom: 14 }}>
        {telLink(aluno.telefone) && <a className="btn btn-ghost btn-sm" href={telLink(aluno.telefone)} onClick={() => set("forma", "Ligação")}><Phone size={12} /> Ligar {aluno.telefone}</a>}
        {waLink(aluno.telefone) && <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={waLink(aluno.telefone, textoWhats(aluno, turma, cfg))} onClick={() => set("forma", "WhatsApp")}><MessageCircle size={12} /> Abrir WhatsApp</a>}
        {aluno.email && <a className="btn btn-ghost btn-sm" href={mailtoLink(aluno.email, cfg.email.assunto, "")} onClick={() => set("forma", "E-mail")}><Mail size={12} /> {aluno.email}</a>}
        {!aluno.telefone && !aluno.email && <span className="aviso" style={{ padding: "6px 10px" }}><AlertTriangle size={13} /> Aluno sem telefone e sem e-mail. <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, aluno.id)}>Cadastrar</button></span>}
      </div>
      <div className="grid-form">
        <label className="campo"><span>Data do contato</span><input type="date" className="input" value={f.data} max={hoje} onChange={(e) => set("data", e.target.value)} /></label>
        <label className="campo"><span>Forma de contato</span><select className="select" value={f.forma} onChange={(e) => set("forma", e.target.value)}>{FORMAS_CONTATO.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo"><span>Motivo do contato</span><select className="select" value={f.motivo} onChange={(e) => set("motivo", e.target.value)}>{MOTIVOS_CONTATO.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo"><span>Resultado do contato</span><select className="select" value={f.resultado} onChange={(e) => set("resultado", e.target.value)}>{RESULTADOS_CONTATO.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="grid-form" style={{ marginTop: 14 }}>
        <label className="campo"><span>Retorno do aluno</span><input className="input" placeholder="O que o aluno disse" value={f.retorno} onChange={(e) => set("retorno", e.target.value)} /></label>
        <label className="campo"><span>Justificativa apresentada</span><input className="input" placeholder="Ex.: trabalho, saúde, transporte..." value={f.justificativa} onChange={(e) => set("justificativa", e.target.value)} /></label>
        <label className="campo"><span>Encaminhamento realizado</span><input className="input" placeholder="Ex.: orientação sobre reposição" value={f.encaminhamento} onChange={(e) => set("encaminhamento", e.target.value)} /></label>
        <label className="campo"><span>Próxima ação necessária</span><input className="input" placeholder="Ex.: confirmar presença na próxima aula" value={f.proximaAcao} onChange={(e) => set("proximaAcao", e.target.value)} /></label>
      </div>
      <div className="grid-form" style={{ marginTop: 14 }}>
        <label className="campo"><span>Próximo contato (retorno agendado)</span>
          <input type="date" className="input" value={f.proximaData} min={hoje} onChange={(e) => set("proximaData", e.target.value)} />
          <span className="row" style={{ gap: 5 }}>{[2, 3, 7].map((n) => <button type="button" key={n} className="pill" onClick={() => set("proximaData", addDias(hoje, n))}>+{n} dias</button>)}</span>
        </label>
        <label className="campo"><span>Nova situação do aluno</span>
          <select className="select" value={f.novoStatus || statusSugerido} onChange={(e) => set("novoStatus", e.target.value)}>{STATUS_ALUNO.map((x) => <option key={x}>{x}</option>)}</select>
          <small>Sugestão automática pelo resultado. Atual: {statusAluno(aluno)}</small>
        </label>
      </div>
      <label className="campo" style={{ marginTop: 14 }}><span>Observações da Supervisão</span><textarea className="input" value={f.obs} onChange={(e) => set("obs", e.target.value)} /></label>
      <label className="row small" style={{ marginTop: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={f.resolverPendencias} onChange={(e) => set("resolverPendencias", e.target.checked)} /> Marcar as pendências abertas deste aluno como resolvidas
      </label>
      {historicoAnterior.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 6 }}>Últimos contatos</h4>
          {historicoAnterior.map((t, i) => <div key={i} className="small" style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}><strong>{fmtDataCurta(t.data)}</strong> – {t.forma || t.tipo} {t.resultado ? `– ${t.resultado}` : ""} {t.obs ? `· ${t.obs}` : ""}</div>)}
        </div>
      )}
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
        <label className="campo"><span>Carga horária diária (h) *</span><input type="number" min={1} max={12} className="input" disabled={disabled} value={f.horariosPorDia ?? ""} onChange={(e) => set("horariosPorDia", e.target.value ? Number(e.target.value) : null)} /></label>
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
      {f.cargaHoraria && f.horariosPorDia ? <p className="small soft" style={{ marginTop: 10 }}>≈ {Math.ceil(f.cargaHoraria / f.horariosPorDia)} aulas no total · limite de faltas: {Math.floor((f.cargaHoraria * 0.25) / f.horariosPorDia)} dias (25% da carga horária)</p> : null}
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

export { VARIAVEIS_EMAIL };
