"use client";
import { useEffect, useState } from "react";
import { Phone, Mail, MessageCircle, Copy, AlertTriangle, Printer, Send, Download, Eye } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { fmtData, fmtDataHora, fmtPct, normalizar, telLink, waLink, mailtoLink, textoWhats, renderTemplate, variaveisEmail } from "@/lib/engine";
import { TENTATIVA_COR, TIPOS_INTERVENCAO, STATUS_CONTATO, STATUS_CONTATO_COR } from "@/lib/constants";
import { exportarExcel } from "@/lib/exportar";
import { exportarPDFTurma } from "./Painel";

// texto que salva ao sair do campo (não grava a cada tecla)
function Texto({ valor, onSalvar, area, placeholder, style, disabled }) {
  const [v, setV] = useState(valor || "");
  useEffect(() => { setV(valor || ""); }, [valor]);
  const p = { className: "input", value: v, placeholder, disabled, onChange: (e) => setV(e.target.value), onBlur: () => { if ((valor || "") !== v) onSalvar(v); }, style };
  return area ? <textarea {...p} /> : <input {...p} />;
}

function CartaoContato({ l }) {
  const { acoes, cfg, pode, alertas } = useData();
  const ui = useUI();
  const t = l.turma, a = l.aluno;
  const c = acoes.contatoDe(t.id, a.id);
  const tentativas = c.tentativas || [];
  const vars = variaveisEmail({ turma: t, aluno: a, resumo: l.r, cfg });
  const assunto = renderTemplate(cfg.email.assunto, vars);
  const corpo = renderTemplate(cfg.email.corpo, vars);
  const zap = textoWhats(a, t, cfg);
  const tel = telLink(a.telefone), wa = waLink(a.telefone, zap), mail = mailtoLink(a.email, assunto, corpo);
  const ed = pode("contatos");
  const alerta = Object.values(alertas).find((x) => x.turmaId === t.id && x.alunoId === a.id && x.tipo === "consecutivas" && x.status === "aberto");
  const canal = async (idx, k) => acoes.atualizarTentativa(t, a, idx, { [k]: !tentativas[idx][k] });
  const copiar = async () => { try { await navigator.clipboard.writeText(zap); } catch {} };

  return (
    <div className="contato-card" id={`c-${t.id}-${a.id}`}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div>
          <button className="link-aluno" style={{ fontSize: 14 }} onClick={() => ui.abrirFicha(t.id, a.id)}>{a.nome}</button>
          <div className="small soft">{a.telefone || "sem telefone"} · {a.email || "sem e-mail"} · {l.r.consecutivas > 0 ? <span style={{ color: "var(--vermelho)", fontWeight: 700 }}>{l.r.consecutivas} faltas seguidas · </span> : alerta ? <span style={{ color: "var(--vermelho)", fontWeight: 700 }}>teve {alerta.consecutivas} faltas seguidas (desde {fmtData(alerta.inicio)}) · </span> : null}{fmtPct(l.r.pct)} de frequência</div>
          {alerta && <div className="small" style={{ marginTop: 2, color: { enviado: "#047857", erro: "#B91C1C", sem_email: "#B45309" }[alerta.emailStatus] || "var(--ink-soft)" }}>{{ enviado: `✉ E-mail automático enviado em ${fmtDataHora(alerta.emailEnviadoEm)}`, erro: `✉ Falha no e-mail automático (${alerta.emailErro || "erro"}) — faça o contato manual`, sem_email: "✉ Aluno sem e-mail — e-mail automático não enviado", desativado: null }[alerta.emailStatus]}</div>}
        </div>
        {c.status && <span className="chip" style={{ background: STATUS_CONTATO_COR[c.status] || "#9CA3AF" }}>{c.status}</span>}
      </div>

      {tentativas.map((tt, idx) => (
        <div key={tt.id || idx} className="tentativa">
          <span className="tent-dot" style={{ background: TENTATIVA_COR[idx] || "#8A93A8" }} />
          <div className="grow">
            <div className="row" style={{ gap: 8 }}>
              <strong className="small">{idx + 1}ª tentativa</strong>
              <input type="date" className="input" style={{ padding: "4px 8px", fontSize: 12, minHeight: 30 }} value={tt.data || ""} disabled={!ed} onChange={(e) => acoes.atualizarTentativa(t, a, idx, { data: e.target.value })} />
              <select className="select" style={{ padding: "4px 8px", fontSize: 12, minHeight: 30 }} value={tt.tipo || tt.forma || "Ligação"} disabled={!ed} onChange={(e) => acoes.atualizarTentativa(t, a, idx, { tipo: e.target.value })}>
                {TIPOS_INTERVENCAO.map((x) => <option key={x}>{x}</option>)}
              </select>
              <Texto valor={tt.responsavel} placeholder="Responsável" disabled={!ed} style={{ padding: "4px 8px", fontSize: 12, width: 150, minHeight: 30 }} onSalvar={(v) => acoes.atualizarTentativa(t, a, idx, { responsavel: v })} />
            </div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button className={"canal-btn" + (tt.ligacao ? " on" : "")} disabled={!ed} onClick={() => canal(idx, "ligacao")}><Phone size={11} /> Ligação</button>
              {tel && <a className="canal-btn" href={tel} onClick={() => !tt.ligacao && ed && canal(idx, "ligacao")}>📞 Ligar</a>}
              <button className={"canal-btn" + (tt.email ? " on" : "")} disabled={!ed} onClick={() => canal(idx, "email")}><Mail size={11} /> E-mail</button>
              {a.email && pode("emails") && <button className="canal-btn" onClick={() => ui.abrirEmail(t.id, a.id, { motivo: `${l.r.consecutivas} faltas seguidas` })}><Send size={11} /> Enviar pelo sistema</button>}
              {mail && <a className="canal-btn" href={mail} onClick={() => !tt.email && ed && canal(idx, "email")}>✉ Abrir e-mail</a>}
              <button className={"canal-btn" + (tt.whatsapp ? " on" : "")} disabled={!ed} onClick={() => canal(idx, "whatsapp")}><MessageCircle size={11} /> WhatsApp</button>
              {wa && <a className="canal-btn" href={wa} target="_blank" rel="noreferrer" onClick={() => !tt.whatsapp && ed && canal(idx, "whatsapp")}>💬 Abrir WhatsApp</a>}
              <button className="canal-btn" onClick={copiar}><Copy size={11} /> Copiar texto</button>
            </div>
            <Texto area valor={tt.obs} disabled={!ed} placeholder="Descrição da intervenção / bilhete..." style={{ width: "100%", marginTop: 6, minHeight: 44, fontSize: 12.5 }} onSalvar={(v) => acoes.atualizarTentativa(t, a, idx, { obs: v })} />
            <Texto valor={tt.resultado} disabled={!ed} placeholder="Resultado obtido (ex.: aluno confirmou retorno na próxima aula)" style={{ width: "100%", marginTop: 6, fontSize: 12.5 }} onSalvar={(v) => acoes.atualizarTentativa(t, a, idx, { resultado: v })} />
          </div>
        </div>
      ))}

      {ed && <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => acoes.adicionarTentativa(t, a)}>+ {tentativas.length === 0 ? "Registrar acompanhamento" : "Nova tentativa"}</button>}

      <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="campo"><span>Status do acompanhamento</span>
            <select className="select" value={c.status || ""} disabled={!ed} onChange={(e) => (e.target.value === "Evadido" ? acoes.marcarEvadido(t, a) : acoes.atualizarContato(t, a, { status: e.target.value }, `Status do acompanhamento: ${e.target.value || "Não iniciado"}`))}>
              <option value="">Não iniciado</option>
              {STATUS_CONTATO.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="campo grow" style={{ minWidth: 180 }}><span>Encaminhamento</span>
            <Texto valor={c.encaminhamento} disabled={!ed} style={{ width: "100%" }} onSalvar={(v) => acoes.atualizarContato(t, a, { encaminhamento: v }, `Encaminhamento: ${v}`)} />
          </label>
          {ed && <button className="btn btn-ghost btn-sm" onClick={() => acoes.atualizarContato(t, a, { concluido: !c.concluido }, c.concluido ? "Acompanhamento reaberto" : "Acompanhamento finalizado")}>{c.concluido ? "Reabrir" : "Finalizar acompanhamento"}</button>}
          {ed && <button className="btn btn-perigo-ghost btn-sm" onClick={() => acoes.marcarEvadido(t, a)}>Marcar como Evadido</button>}
        </div>
        {c.status === "Retornou" && (
          <div className="grid3" style={{ marginTop: 10, gap: 10 }}>
            <label className="campo"><span>Justificativa</span><Texto valor={c.justificativa} disabled={!ed} onSalvar={(v) => acoes.atualizarContato(t, a, { justificativa: v }, `Justificativa: ${v}`)} /></label>
            <label className="campo"><span>Motivo da ausência</span><Texto valor={c.motivoFalta} disabled={!ed} onSalvar={(v) => acoes.atualizarContato(t, a, { motivoFalta: v }, `Motivo da ausência: ${v}`)} /></label>
            <label className="campo"><span>Orientações dadas</span><Texto valor={c.orientacoes} disabled={!ed} onSalvar={(v) => acoes.atualizarContato(t, a, { orientacoes: v }, `Orientações: ${v}`)} /></label>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Contatos() {
  const { turmas, contatos, linhas, cfg } = useData();
  const ui = useUI();
  const [historico, setHistorico] = useState(false);
  const [emails, setEmails] = useState(false);
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (h) setTimeout(() => document.getElementById(h)?.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
  }, []);
  const lista = ui.agenda.paraContato;
  const grupos = [];
  lista.forEach((l) => { let g = grupos.find((x) => x.turma.id === l.turma.id); if (!g) grupos.push((g = { turma: l.turma, itens: [] })); g.itens.push(l); });
  grupos.sort((a, b) => a.turma.curso.localeCompare(b.turma.curso));

  const linhasHist = [];
  if (historico) {
    linhas.forEach((l) => {
      const c = contatos[l.key];
      if (!c || !(c.tentativas || []).length) return;
      if (busca && !normalizar(l.aluno.nome).includes(normalizar(busca))) return;
      linhasHist.push({ l, c });
    });
  }

  return (
    <>
      <div className="page-header"><div><h2>Contato com alunos</h2><p>Alunos com faltas seguidas ou em acompanhamento — ligação, e-mail e WhatsApp</p></div></div>
      <div className="row" style={{ marginBottom: 16 }}>
        <label className="row small" style={{ cursor: "pointer" }}><input type="checkbox" checked={historico} onChange={(e) => { setHistorico(e.target.checked); setEmails(false); }} /> Mostrar histórico completo (inclui evadidos e finalizados)</label>
        {historico && <input className="input" placeholder="Buscar por nome do aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} style={{ minWidth: 220 }} />}
        <label className="row small" style={{ cursor: "pointer" }}><input type="checkbox" checked={emails} onChange={(e) => { setEmails(e.target.checked); setHistorico(false); }} /> Ver e-mails enviados</label>
      </div>

      {emails ? <EmailsEnviados /> : historico ? (
        !linhasHist.length ? <Empty>Nenhum contato registrado ainda.</Empty> : (
          <div className="tabela-wrap">
            <table className="tabela responsiva">
              <thead><tr><th>Aluno</th><th>Turma</th><th>Situação</th><th>Status do contato</th><th className="center">Tentativas</th><th>Última tentativa</th></tr></thead>
              <tbody>
                {linhasHist.map(({ l, c }) => (
                  <tr key={l.key}>
                    <td className="principal"><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button></td>
                    <td className="small soft" data-label="Turma">{l.turma.curso}</td>
                    <td data-label="Situação">{l.situacao !== "Ativo" ? <span className="chip" style={{ background: "#6B7280" }}>{l.situacao}</span> : <span className="small soft">Ativo</span>}</td>
                    <td data-label="Status">{c.status ? <span className="chip" style={{ background: STATUS_CONTATO_COR[c.status] || "#9CA3AF" }}>{c.status}</span> : "—"}{c.concluido ? <span className="small soft"> · concluído</span> : ""}</td>
                    <td className="center mono" data-label="Tentativas">{c.tentativas.length}</td>
                    <td className="small" data-label="Última">{fmtData(c.tentativas.at(-1)?.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : !grupos.length ? <Empty>Nenhum aluno precisando de contato no momento. 🎉</Empty> : grupos.map((g) => (
        <div key={g.turma.id} style={{ marginBottom: 24 }}>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <div><strong style={{ fontSize: 13.5 }}>{g.turma.curso}</strong> <span className="small soft" style={{ marginLeft: 6 }}>{g.turma.codigo || "sem código"} · {g.turma.turno}</span></div>
            <button className="btn btn-ghost btn-sm" onClick={() => exportarPDFTurma(g.turma, linhas, cfg)}><Printer size={12} /> Exportar PDF</button>
          </div>
          {g.itens.map((l) => <CartaoContato key={l.key} l={l} />)}
        </div>
      ))}

      {!historico && !emails && (
        <div className="aviso" style={{ marginTop: 6 }}>
          <AlertTriangle size={14} />
          <span>Os botões abrem a ligação, o e-mail e o WhatsApp no seu aparelho. O <strong>e-mail automático</strong> (após {cfg.consecutivasAlerta} faltas seguidas) e o botão “Enviar pelo sistema” usam o e-mail cadastrado do aluno — configure em Configurações → E-mail automático.</span>
        </div>
      )}
    </>
  );
}

export function EmailsEnviados({ turmaId }) {
  const { emails } = useData();
  const ui = useUI();
  const [aberto, setAberto] = useState(null);
  const lista = emails.filter((e) => !turmaId || e.turmaId === turmaId);
  const colunas = [
    { titulo: "Data/hora", valor: (e) => fmtDataHora(e.enviadoEm) }, { titulo: "Aluno", valor: (e) => e.alunoNome }, { titulo: "E-mail", valor: (e) => e.para },
    { titulo: "Turma", valor: (e) => e.turmaNome }, { titulo: "Motivo", valor: (e) => e.motivo }, { titulo: "Tipo", valor: (e) => (e.automatico ? "Automático" : "Manual") },
    { titulo: "Status", valor: (e) => (e.status === "enviado" ? "Enviado" : "Erro: " + (e.erro || "")) }, { titulo: "Responsável", valor: (e) => e.usuario }, { titulo: "Modelo", valor: (e) => e.modelo }, { titulo: "Assunto", valor: (e) => e.assunto },
  ];
  return (
    <>
      <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
        <span className="small soft">{lista.length} disparo(s) · {lista.filter((e) => e.status === "erro").length} com erro</span>
        <button className="btn btn-ghost btn-sm" onClick={() => exportarExcel({ colunas, linhas: lista, nome: "emails_enviados", aba: "E-mails" })}><Download size={13} /> Excel</button>
      </div>
      {!lista.length ? <Empty>Nenhum e-mail disparado ainda.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Data/hora</th><th>Aluno</th><th>E-mail usado</th><th>Motivo</th><th>Tipo</th><th>Status</th><th>Responsável</th><th></th></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((e) => (
                <tr key={e.id}>
                  <td className="principal small">{fmtDataHora(e.enviadoEm)}</td>
                  <td data-label="Aluno"><button className="link-aluno" onClick={() => ui.abrirFicha(e.turmaId, e.alunoId)}>{e.alunoNome}</button></td>
                  <td data-label="E-mail" className="small">{e.para || "—"}</td>
                  <td data-label="Motivo" className="small">{e.motivo}</td>
                  <td data-label="Tipo"><span className="chip-out" style={{ color: e.automatico ? "#4F46E5" : "#6B7280", borderColor: e.automatico ? "#4F46E5" : "#9CA3AF" }}>{e.automatico ? "Automático" : "Manual"}</span></td>
                  <td data-label="Status">{e.status === "enviado" ? <span className="chip" style={{ background: "var(--verde)" }}>Enviado</span> : <span className="chip" style={{ background: "var(--vermelho)" }} title={e.erro}>Erro</span>}</td>
                  <td data-label="Responsável" className="small">{e.usuario}</td>
                  <td className="num"><button className="btn btn-ghost btn-sm" onClick={() => setAberto(aberto === e.id ? null : e.id)}><Eye size={12} /> {aberto === e.id ? "Fechar" : "Ver"}</button></td>
                </tr>
              )).flatMap((tr, i) => {
                const e = lista[i];
                return aberto === e.id ? [tr, (
                  <tr key={e.id + "x"}><td colSpan={8} style={{ background: "#F7F8FC" }}>
                    <div className="small"><strong>Modelo:</strong> {e.modelo} · <strong>Remetente:</strong> {e.remetente || "—"} {e.erro && <span style={{ color: "var(--vermelho)" }}>· <strong>Erro:</strong> {e.erro}</span>}</div>
                    <div className="small" style={{ marginTop: 6 }}><strong>Assunto:</strong> {e.assunto}</div>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, margin: "8px 0 0" }}>{e.corpo}</pre>
                  </td></tr>
                )] : [tr];
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

