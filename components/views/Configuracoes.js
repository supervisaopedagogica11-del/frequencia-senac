"use client";
import { useEffect, useRef, useState } from "react";
import { Save, Send, CheckCircle2, AlertTriangle, RotateCcw, Zap, Mail, Gauge, Building2 } from "lucide-react";
import { useData } from "../DataProvider";
import { Switch } from "../ui";
import { CONFIG_PADRAO, VARIAVEIS_EMAIL, FAIXA_COR, FAIXA_LABEL } from "@/lib/constants";
import { mergeConfig, renderTemplate, variaveisEmail, emailValido } from "@/lib/engine";
import { auth } from "@/lib/firebase";
import { statusEnvio } from "@/lib/email";

const AUTOMACOES = [
  ["alertaConsecutivas", "Alerta de faltas consecutivas", "Detecta automaticamente quando o aluno atinge o número de faltas seguidas configurado e registra no histórico."],
  ["pendenciaAutomatica", "Criação automática de pendência de contato", "Coloca o aluno na Agenda e muda a situação para “Necessita contato”."],
  ["emailAutomatico", "E-mail automático ao aluno", "Envia o modelo de e-mail abaixo para o e-mail cadastrado do aluno — uma única vez por episódio de faltas."],
  ["alertaLimite", `Alertas de aproximação do limite mínimo`, "Gera uma pendência quando o aluno entra nas faixas Risco, Crítico ou Abaixo do mínimo (uma vez por faixa)."],
  ["alertaChamadaPendente", "Aviso de chamada não registrada", "Mostra na Agenda as turmas que costumam ter aula no dia e ainda estão sem chamada."],
];

function Num({ g, k, min, max, step, sufixo, label, dica, f, set, setIn, admin }) {
  const conv = (v) => (v === "" ? "" : Number(v));
  return (
    <label className="campo"><span>{label}</span>
      <span className="row" style={{ flexWrap: "nowrap" }}><input type="number" className="input" style={{ width: 90 }} min={min} max={max} step={step || 1} disabled={!admin}
        value={g ? f[g][k] : f[k]} onChange={(e) => (g ? setIn(g, k, conv(e.target.value)) : set(k, conv(e.target.value)))} /> <span className="small soft">{sufixo}</span></span>
      {dica && <small>{dica}</small>}
    </label>
  );
}

export default function Configuracoes() {
  const { cfg, cfgRaw, pode, acoes, envio, setEnvio, usuario, toast } = useData();
  const [f, setF] = useState(cfg);
  const [testando, setTestando] = useState(false);
  const corpoRef = useRef(null);
  useEffect(() => { setF(cfg); }, [cfgRaw]); // eslint-disable-line
  const admin = pode("configuracoes");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setIn = (g, k, v) => setF((x) => ({ ...x, [g]: { ...x[g], [k]: v } }));
  const num = (v) => (v === "" ? "" : Number(v));
  const np = { f, set, setIn, admin };
  const mudou = JSON.stringify(mergeConfig(f)) !== JSON.stringify(cfg);
  const faixasOk = f.faixas.atencao > f.faixas.risco && f.faixas.risco > f.faixas.critico && f.faixas.critico > f.limiteMinimo;

  const exemplo = variaveisEmail({
    turma: { curso: "Técnico em Administração", codigo: "ADM-2026-01", instrutor: "Prof. Ana" },
    aluno: { nome: "João da Silva" },
    resumo: { consecutivas: 3, faltas: 7, pct: 84.4, datasConsecutivas: ["2026-09-29", "2026-09-30", "2026-10-01"] },
    cfg: f,
  });

  function inserir(chave) {
    const el = corpoRef.current;
    const tag = `{{${chave}}}`;
    if (!el) return setIn("email", "corpo", f.email.corpo + tag);
    const i = el.selectionStart ?? f.email.corpo.length;
    const novo = f.email.corpo.slice(0, i) + tag + f.email.corpo.slice(el.selectionEnd ?? i);
    setIn("email", "corpo", novo);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = i + tag.length; }, 0);
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

  return (
    <>
      <div className="page-header">
        <div><h2>Configurações</h2><p>Limites de frequência, automações e e-mail automático — sem precisar alterar o código</p></div>
        {admin && <div className="row">
          <button className="btn btn-ghost" onClick={() => setF(mergeConfig({ ...CONFIG_PADRAO, email: { ...CONFIG_PADRAO.email, remetenteEmail: f.email.remetenteEmail } }))}><RotateCcw size={14} /> Restaurar padrões</button>
          <button className="btn btn-primary" disabled={!mudou || !faixasOk} onClick={() => acoes.salvarConfig(mergeConfig(f))}><Save size={14} /> Salvar configurações</button>
        </div>}
      </div>
      {!admin && <div className="aviso info" style={{ marginBottom: 14 }}>Somente administradores podem alterar as configurações. Você está vendo os valores atuais.</div>}
      {mudou && admin && <div className="aviso" style={{ marginBottom: 14 }}><AlertTriangle size={14} /> Há alterações não salvas.</div>}

      <div className="card secao">
        <h3 style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><Building2 size={16} /> Instituição</h3>
        <label className="campo" style={{ maxWidth: 420 }}><span>Nome da instituição (aparece no sistema, relatórios e e-mails)</span><input className="input" disabled={!admin} value={f.instituicao} onChange={(e) => set("instituicao", e.target.value)} /></label>
      </div>

      <div className="card secao">
        <h3 style={{ marginBottom: 6, display: "flex", gap: 8, alignItems: "center" }}><Gauge size={16} /> Frequência e faixas de acompanhamento</h3>
        <p className="small soft" style={{ marginTop: 0 }}>O aluno entra na faixa quando a frequência fica <strong>abaixo</strong> do percentual — ou quando as faltas que ainda pode ter ficam iguais ou menores que a folga.</p>
        <div className="grid-form">
          <Num {...np} k="limiteMinimo" min={50} max={100} sufixo="%" label="Frequência mínima exigida" />
          <Num {...np} k="consecutivasAlerta" min={2} max={10} sufixo="faltas" label="Alerta de faltas consecutivas" />
          <Num {...np} k="pesoAtraso" min={0} max={1} step={0.25} sufixo="do dia" label="Peso do atraso" dica="0,5 = atraso desconta meio dia" />
        </div>
        <div className="grid-form" style={{ marginTop: 14 }}>
          <Num {...np} g="faixas" k="atencao" min={50} max={100} sufixo="%" label={<span style={{ color: FAIXA_COR.atencao }}>● Atenção abaixo de</span>} />
          <Num {...np} g="faixas" k="risco" min={50} max={100} sufixo="%" label={<span style={{ color: FAIXA_COR.risco }}>● Risco abaixo de</span>} />
          <Num {...np} g="faixas" k="critico" min={50} max={100} sufixo="%" label={<span style={{ color: FAIXA_COR.critico }}>● Crítico abaixo de</span>} />
          <Num {...np} g="folga" k="risco" min={0} max={30} sufixo="dias" label="Risco se pode faltar no máx." />
          <Num {...np} g="folga" k="critico" min={0} max={30} sufixo="dias" label="Crítico se pode faltar no máx." />
        </div>
        {!faixasOk && <div className="aviso erro" style={{ marginTop: 12 }}>Os percentuais precisam seguir a ordem: Atenção &gt; Risco &gt; Crítico &gt; mínimo ({f.limiteMinimo}%).</div>}
        <div className="row" style={{ marginTop: 14, gap: 6 }}>
          {[["regular", `≥ ${f.faixas.atencao}%`], ["atencao", `${f.faixas.risco}% a ${f.faixas.atencao}% (ou projeção < ${Number(f.limiteMinimo) + 5}%)`], ["risco", `${f.faixas.critico}% a ${f.faixas.risco}% ou pode faltar ≤ ${f.folga.risco}`], ["critico", `${f.limiteMinimo}% a ${f.faixas.critico}% ou pode faltar ≤ ${f.folga.critico}`], ["abaixo", `< ${f.limiteMinimo}%`]].map(([k, t]) => (
            <span key={k} className="chip-out" style={{ color: FAIXA_COR[k], borderColor: FAIXA_COR[k] }}>{FAIXA_LABEL[k]}: {t}</span>
          ))}
        </div>
      </div>

      <div className="card secao">
        <h3 style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><Zap size={16} /> Automações</h3>
        {AUTOMACOES.map(([k, t, d]) => (
          <div key={k} className="row" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Switch checked={f.automacoes[k]} disabled={!admin} onChange={(v) => setIn("automacoes", k, v)} />
            <div><div style={{ fontWeight: 700, fontSize: 13 }}>{t}</div><div className="small soft">{d}</div></div>
          </div>
        ))}
        <p className="small soft" style={{ marginBottom: 0 }}>Proteção contra duplicidade: cada episódio de faltas tem um identificador único (aluno + data da 1ª falta da sequência). Enquanto a sequência continua, nenhum novo alerta ou e-mail é gerado. Depois de uma presença, uma nova sequência gera um novo episódio.</p>
      </div>

      <div className="card secao">
        <h3 style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><Mail size={16} /> E-mail automático</h3>
        <div className={"aviso " + (envio.configurado ? "ok" : "erro")} style={{ marginBottom: 14 }}>
          {envio.configurado ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <div>{envio.configurado
            ? <>Servidor de envio configurado ({envio.provedor === "microsoft-graph" ? "Microsoft 365 / Outlook" : "SMTP"}). Remetente: <strong>{envio.remetente}</strong>.</>
            : <>O servidor de envio ainda não está configurado. Peça para cadastrar as variáveis de ambiente na Vercel (veja o guia de implantação). Enquanto isso, os alertas continuam sendo gerados e o contato fica como pendência manual.</>}</div>
        </div>
        <div className="grid-form">
          <label className="campo"><span>Nome do remetente</span><input className="input" disabled={!admin} value={f.email.remetenteNome} onChange={(e) => setIn("email", "remetenteNome", e.target.value)} /></label>
          <label className="campo"><span>E-mail para respostas (responder para)</span><input className="input" type="email" disabled={!admin} placeholder={envio.remetente || "supervisao@..."} value={f.email.remetenteEmail} onChange={(e) => setIn("email", "remetenteEmail", e.target.value)} /><small>Se o aluno responder, a resposta vai para este endereço.</small></label>
          <label className="campo"><span>Responsável pelo contato</span><input className="input" disabled={!admin} value={f.email.responsavelContato} onChange={(e) => setIn("email", "responsavelContato", e.target.value)} /></label>
        </div>
        <div className="small" style={{ margin: "14px 0 6px" }}><strong>Quando dispara:</strong> automaticamente quando o aluno atinge {f.consecutivasAlerta} faltas consecutivas, se “E-mail automático ao aluno” estiver ligado ({f.automacoes.emailAutomatico ? <span style={{ color: "var(--verde)" }}>ligado</span> : <span style={{ color: "var(--vermelho)" }}>desligado</span>}).</div>
        <label className="campo" style={{ marginTop: 10 }}><span>Assunto</span><input className="input" disabled={!admin} value={f.email.assunto} onChange={(e) => setIn("email", "assunto", e.target.value)} /></label>
        <label className="campo" style={{ marginTop: 12 }}><span>Modelo da mensagem</span><textarea ref={corpoRef} className="input" style={{ minHeight: 240 }} disabled={!admin} value={f.email.corpo} onChange={(e) => setIn("email", "corpo", e.target.value)} /></label>
        <div className="row" style={{ marginTop: 8, gap: 5 }}>
          <span className="small soft">Inserir variável:</span>
          {VARIAVEIS_EMAIL.map((v) => <button key={v.chave} className="pill" disabled={!admin} title={v.desc} onClick={() => inserir(v.chave)}>{`{{${v.chave}}}`}</button>)}
        </div>
        <h4 style={{ margin: "18px 0 8px" }}>Pré-visualização (aluno de exemplo)</h4>
        <div className="card" style={{ background: "#F7F8FC" }}>
          <div className="small"><strong>Assunto:</strong> {renderTemplate(f.email.assunto, exemplo)}</div>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, margin: "10px 0 0", lineHeight: 1.6 }}>{renderTemplate(f.email.corpo, exemplo)}</pre>
        </div>
        {admin && <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={!envio.configurado || testando} onClick={teste}><Send size={14} /> {testando ? "Enviando..." : `Enviar teste para ${usuario?.email}`}</button>}
      </div>
    </>
  );
}
