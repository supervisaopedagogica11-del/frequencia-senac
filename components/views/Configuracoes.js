"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Save, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { useData } from "../DataProvider";
import { Switch } from "../ui";
import Usuarios from "./Usuarios";
import Importar from "./Importar";
import { VARIAVEIS_EMAIL } from "@/lib/constants";
import { mergeConfig, renderTemplate, variaveisEmail, emailValido } from "@/lib/engine";
import { auth } from "@/lib/firebase";
import { statusEnvio } from "@/lib/email";

const ABAS = [["geral", "Alertas"], ["email", "E-mail automático"], ["equipe", "Usuários/Equipe"], ["importar", "Importar planilha"]];

function Linha({ titulo, desc, children }) {
  return (
    <div className="row" style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap", alignItems: "center" }}>
      <div className="grow"><div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>{desc && <div className="small soft">{desc}</div>}</div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export default function Configuracoes() {
  const { cfg, cfgRaw, pode, acoes, envio, setEnvio, usuario, toast } = useData();
  const sp = useSearchParams();
  const [aba, setAba] = useState(sp?.get("aba") || "geral");
  const [f, setF] = useState(cfg);
  const [testando, setTestando] = useState(false);
  const corpoRef = useRef(null);
  useEffect(() => { setF(cfg); }, [cfgRaw]); // eslint-disable-line
  const admin = pode("configuracoes");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setIn = (g, k, v) => setF((x) => ({ ...x, [g]: { ...x[g], [k]: v } }));
  const mudou = JSON.stringify(mergeConfig(f)) !== JSON.stringify(cfg);
  const exemplo = variaveisEmail({ turma: { curso: "Assistente Administrativo", codigo: "ASA-07", instrutor: "Prof. Ana" }, aluno: { nome: "João da Silva" }, resumo: { consecutivas: 3, pct: 84.3, horasFalta: 25, datasConsecutivas: ["2026-09-29", "2026-09-30", "2026-10-01"] }, cfg: f });

  function inserir(chave) {
    const el = corpoRef.current, tag = `{{${chave}}}`;
    const i = el?.selectionStart ?? f.email.corpo.length;
    setIn("email", "corpo", f.email.corpo.slice(0, i) + tag + f.email.corpo.slice(el?.selectionEnd ?? i));
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = i + tag.length; } }, 0);
  }
  async function teste() {
    setTestando(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ para: usuario.email, assunto: "[TESTE] " + renderTemplate(f.email.assunto, exemplo), texto: renderTemplate(f.email.corpo, exemplo), nomeRemetente: f.email.remetenteNome, replyTo: emailValido(f.email.remetenteEmail) ? f.email.remetenteEmail : undefined, instituicao: f.instituicao }) });
      const j = await r.json();
      toast(j.ok ? `E-mail de teste enviado para ${usuario.email}.` : `Falha: ${j.erro}`, j.ok ? "ok" : "erro");
    } catch (e) { toast(`Falha: ${e.message}`, "erro"); }
    setTestando(false);
    statusEnvio().then(setEnvio);
  }
  const salvar = admin && (aba === "geral" || aba === "email") && (
    <button className="btn btn-primary" disabled={!mudou} onClick={() => acoes.salvarConfig(mergeConfig(f))}><Save size={14} /> Salvar</button>
  );

  return (
    <>
      <div className="page-header"><div><h2>Configurações</h2></div>{salvar}</div>
      <div className="tabs">{ABAS.map(([k, l]) => <button key={k} className={aba === k ? "active" : ""} onClick={() => setAba(k)}>{l}</button>)}</div>
      {!admin && (aba === "geral" || aba === "email") && <div className="aviso info" style={{ marginBottom: 12 }}>Somente administradores podem alterar estas configurações.</div>}

      {aba === "geral" && (
        <div className="card">
          <div className="aviso info" style={{ marginBottom: 6 }}>Regra de aprovação: mínimo de <strong>&nbsp;75% de frequência&nbsp;</strong> na carga horária total do curso. As faltas são contadas em horas.</div>
          <Linha titulo="Avisar “Em risco” quando o aluno já usou" desc="das horas de falta permitidas (25% da carga horária). Ex.: curso de 160h permite 40h; com 60% o aviso aparece a partir de 24h de falta.">
            <span className="row" style={{ flexWrap: "nowrap" }}><input type="number" className="input" style={{ width: 70 }} min={10} max={95} disabled={!admin} value={f.usoAlerta} onChange={(e) => set("usoAlerta", Number(e.target.value) || 60)} /> %</span>
          </Linha>
          <Linha titulo="Alerta de faltas seguidas" desc="Quantos dias seguidos de falta geram uma pendência de contato.">
            <span className="row" style={{ flexWrap: "nowrap" }}><input type="number" className="input" style={{ width: 70 }} min={2} max={10} disabled={!admin} value={f.consecutivasAlerta} onChange={(e) => set("consecutivasAlerta", Number(e.target.value) || 3)} /> dias</span>
          </Linha>
          <Linha titulo="Criar pendência por faltas seguidas" desc="O aluno entra em Pendências com a situação “Necessita contato”.">
            <Switch checked={f.automacoes.alertaConsecutivas} disabled={!admin} onChange={(v) => setIn("automacoes", "alertaConsecutivas", v)} />
          </Linha>
          <Linha titulo="Criar pendência quando entrar em risco ou ficar abaixo de 75%" desc="Uma vez para cada nível — não fica repetindo.">
            <Switch checked={f.automacoes.alertaRisco} disabled={!admin} onChange={(v) => setIn("automacoes", "alertaRisco", v)} />
          </Linha>
          <Linha titulo="Nome da instituição">
            <input className="input" style={{ width: 240 }} disabled={!admin} value={f.instituicao} onChange={(e) => set("instituicao", e.target.value)} />
          </Linha>
        </div>
      )}

      {aba === "email" && (
        <div className="card">
          <div className={"aviso " + (envio.configurado ? "ok" : "erro")} style={{ marginBottom: 12 }}>
            {envio.configurado ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
            <span>{envio.configurado ? <>Envio configurado. Remetente: <strong>{envio.remetente}</strong></> : "O envio ainda não está configurado na Vercel (veja o LEIA-ME). Enquanto isso, o contato fica como pendência manual."}</span>
          </div>
          <Linha titulo="Enviar e-mail automático ao aluno" desc={`Quando ele atingir ${f.consecutivasAlerta} faltas seguidas. Uma vez por sequência de faltas.`}>
            <Switch checked={f.automacoes.emailAutomatico} disabled={!admin} onChange={(v) => setIn("automacoes", "emailAutomatico", v)} />
          </Linha>
          <div className="grid-form" style={{ marginTop: 14 }}>
            <label className="campo"><span>Nome do remetente</span><input className="input" disabled={!admin} value={f.email.remetenteNome} onChange={(e) => setIn("email", "remetenteNome", e.target.value)} /></label>
            <label className="campo"><span>Respostas vão para (e-mail)</span><input className="input" type="email" disabled={!admin} placeholder={envio.remetente || "supervisao@..."} value={f.email.remetenteEmail} onChange={(e) => setIn("email", "remetenteEmail", e.target.value)} /></label>
            <label className="campo"><span>Assinatura / responsável</span><input className="input" disabled={!admin} value={f.email.responsavelContato} onChange={(e) => setIn("email", "responsavelContato", e.target.value)} /></label>
          </div>
          <label className="campo" style={{ marginTop: 12 }}><span>Assunto</span><input className="input" disabled={!admin} value={f.email.assunto} onChange={(e) => setIn("email", "assunto", e.target.value)} /></label>
          <label className="campo" style={{ marginTop: 12 }}><span>Mensagem</span><textarea ref={corpoRef} className="input" style={{ minHeight: 220 }} disabled={!admin} value={f.email.corpo} onChange={(e) => setIn("email", "corpo", e.target.value)} /></label>
          <div className="row" style={{ marginTop: 8, gap: 5 }}>
            <span className="small soft">Inserir:</span>
            {VARIAVEIS_EMAIL.map((v) => <button key={v.chave} className="pill" disabled={!admin} onClick={() => inserir(v.chave)}>{v.desc}</button>)}
          </div>
          <details style={{ marginTop: 14 }}>
            <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Ver como o aluno recebe</summary>
            <div className="card" style={{ background: "#F7F8FC", marginTop: 8 }}>
              <div className="small"><strong>Assunto:</strong> {renderTemplate(f.email.assunto, exemplo)}</div>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, margin: "10px 0 0", lineHeight: 1.6 }}>{renderTemplate(f.email.corpo, exemplo)}</pre>
            </div>
          </details>
          {admin && <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={!envio.configurado || testando} onClick={teste}><Send size={14} /> {testando ? "Enviando..." : "Enviar um teste para mim"}</button>}
        </div>
      )}

      {aba === "equipe" && <Usuarios embutido />}
      {aba === "importar" && <Importar embutido />}
    </>
  );
}
