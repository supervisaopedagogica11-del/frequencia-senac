"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, MessageCircle, Send, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, Pct, Empty } from "../ui";
import { HistoricoContatos, EmailsEnviados } from "./Contatos";
import { montarAgenda } from "@/lib/pendencias";
import { addDias, fmtData, waLink, textoWhats } from "@/lib/engine";

const EMAIL = { enviado: ["E-mail automático enviado", "#10B981"], erro: ["Falha no e-mail — fazer contato manual", "#EF4444"], sem_email: ["Aluno sem e-mail — fazer contato manual", "#F59E0B"] };

function Item({ linha, cor, motivo, alertas = [], extra }) {
  const ui = useUI();
  const { acoes, pode, hoje, cfg } = useData();
  const wa = waLink(linha.aluno.telefone, textoWhats(linha.aluno, linha.turma, cfg));
  const em = alertas.map((a) => EMAIL[a.emailStatus]).find(Boolean);
  return (
    <div className="item" style={{ borderLeftColor: cor }}>
      <div className="grow" style={{ minWidth: 200 }}>
        <div className="t"><button className="link-aluno" onClick={() => ui.abrirFicha(linha.turma.id, linha.aluno.id)}>{linha.aluno.nome}</button> <Pct r={linha.r} /></div>
        <div className="s">{linha.turma.curso} · {motivo}</div>
        {em && <div className="small" style={{ color: em[1], fontWeight: 600, marginTop: 2 }}>✉ {em[0]}</div>}
        {extra}
      </div>
      {pode("contatos") && (
        <div className="acoes">
          <button className="btn btn-primary btn-sm" onClick={() => ui.abrirContato(linha.turma.id, linha.aluno.id)}><ClipboardCheck size={12} /> Registrar contato</button>
          {wa && <a className="btn btn-ghost btn-sm btn-icon" href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={13} /></a>}
          {linha.aluno.email && pode("emails") && <button className="btn btn-ghost btn-sm btn-icon" title="Enviar e-mail" onClick={() => ui.abrirEmail(linha.turma.id, linha.aluno.id, { motivo })}><Send size={13} /></button>}
          {alertas.length > 0 && <button className="btn btn-ghost btn-sm btn-icon" title="Lembrar daqui a 2 dias" onClick={() => alertas.forEach((a) => acoes.adiarAlerta(a, addDias(hoje, 2)))}><Clock size={13} /></button>}
          {alertas.length > 0 && <button className="btn btn-ghost btn-sm btn-icon" title="Resolvido (sem registrar contato)" onClick={() => alertas.forEach((a) => acoes.resolverAlerta(a, "Resolvido pela lista de pendências"))}><CheckCircle2 size={13} /></button>}
        </div>
      )}
    </div>
  );
}

export function ListaPendencias({ turmaId }) {
  const { turmas, linhas, alertas, contatos, freq, hoje } = useData();
  const ui = useUI();
  const ag = useMemo(() => (turmaId ? montarAgenda({ turmas, linhas, alertas, contatos, freq, hoje, turmaId }) : ui.agenda), [turmaId, turmas, linhas, alertas, contatos, freq, hoje, ui.agenda]);
  if (!ag.total && !ag.chamadas.length && !ag.avisos.length) return <Empty>Nenhuma pendência. Tudo em dia! 🎉</Empty>;
  return (
    <>
      {ag.contatar.length > 0 && (
        <div className="secao">
          <div className="secao-head"><h3>Para contatar ({ag.contatar.length})</h3></div>
          <div className="lista">{ag.contatar.map((x) => <Item key={x.linha.key} linha={x.linha} cor={x.cor} motivo={x.motivo} alertas={x.alertas} />)}</div>
        </div>
      )}
      {ag.retornos.length > 0 && (
        <div className="secao">
          <div className="secao-head"><h3>Retornos agendados ({ag.retornos.length})</h3></div>
          <div className="lista">{ag.retornos.map((x) => <Item key={x.linha.key} linha={x.linha} cor="#4F46E5" motivo={`${x.atraso > 0 ? `retorno estava marcado para ${fmtData(x.contato.proximaData)}` : "retorno marcado para hoje"}${x.contato.proximaAcao ? ` · ${x.contato.proximaAcao}` : ""}`} />)}</div>
        </div>
      )}
      {!turmaId && ag.chamadas.length > 0 && (
        <div className="aviso info" style={{ marginBottom: 12 }}>Chamada de hoje ainda não feita: {ag.chamadas.map((t, i) => <span key={t.id}>{i ? ", " : " "}<Link href={`/turmas/${t.id}`}>{t.curso}</Link></span>)}</div>
      )}
      {ag.avisos.map((a, i) => (
        <div key={i} className="aviso" style={{ marginBottom: 8 }}><AlertTriangle size={14} /> <span className="grow">{a.texto}</span> <button className="link-aluno small" onClick={() => ui.abrirConfigTurma(a.turma.id)}>Ajustar</button></div>
      ))}
    </>
  );
}

export default function Agenda() {
  const [aba, setAba] = useState("pend");
  const ui = useUI();
  const d = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const dia = d.charAt(0).toUpperCase() + d.slice(1);
  return (
    <>
      <div className="page-header"><div><h2>Pendências</h2><p>{dia} · quem precisa de contato da Supervisão</p></div></div>
      <div className="tabs">
        <button className={aba === "pend" ? "active" : ""} onClick={() => setAba("pend")}>Para fazer ({ui.agenda.total})</button>
        <button className={aba === "hist" ? "active" : ""} onClick={() => setAba("hist")}>Contatos feitos</button>
        <button className={aba === "emails" ? "active" : ""} onClick={() => setAba("emails")}>E-mails enviados</button>
      </div>
      {aba === "pend" && <ListaPendencias />}
      {aba === "hist" && <HistoricoContatos />}
      {aba === "emails" && <EmailsEnviados />}
    </>
  );
}
