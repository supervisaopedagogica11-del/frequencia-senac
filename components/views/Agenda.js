"use client";
import { useMemo } from "react";
import Link from "next/link";
import { ClipboardCheck, Send, MessageCircle, Clock, CheckCircle2, Eye, ClipboardList, AlertTriangle, Mail } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, Empty } from "../ui";
import { montarAgenda } from "@/lib/pendencias";
import { addDias, fmtData, fmtDataCurta, waLink, fmtPct } from "@/lib/engine";
import { FAIXA_COR } from "@/lib/constants";

const EMAIL_STATUS = {
  enviado: { t: "E-mail automático enviado", c: "#10B981" },
  erro: { t: "Falha no e-mail — contato manual", c: "#EF4444" },
  sem_email: { t: "Sem e-mail cadastrado — contato manual", c: "#F59E0B" },
  desativado: { t: "E-mail automático desativado", c: "#9CA3AF" },
  pendente: { t: "Enviando e-mail...", c: "#3B82F6" },
};

function Acoes({ linha, alerta }) {
  const ui = useUI();
  const { acoes, pode, hoje, cfg } = useData();
  if (!pode("contatos")) return <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirFicha(linha.turma.id, linha.aluno.id)}><Eye size={12} /> Ver</button>;
  const wa = waLink(linha.aluno.telefone, `Olá, ${(linha.aluno.nome || "").split(" ")[0]}! Aqui é da Supervisão Pedagógica do ${cfg.instituicao}. Sentimos sua falta nas aulas de ${linha.turma.curso} e queremos saber se está tudo bem. Podemos ajudar em algo?`);
  return (
    <div className="acoes">
      <button className="btn btn-primary btn-sm" onClick={() => ui.abrirContato(linha.turma.id, linha.aluno.id)}><ClipboardCheck size={12} /> Registrar contato</button>
      {wa && <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noreferrer" title="Abrir WhatsApp"><MessageCircle size={12} /></a>}
      {linha.aluno.email && pode("emails") && <button className="btn btn-ghost btn-sm" title="Enviar e-mail" onClick={() => ui.abrirEmail(linha.turma.id, linha.aluno.id, { motivo: alerta?.titulo })}><Send size={12} /></button>}
      {alerta && alerta.emailStatus === "erro" && pode("emails") && <button className="btn btn-ghost btn-sm" onClick={() => acoes.reenviarAlerta(alerta)}><Mail size={12} /> Reenviar</button>}
      {alerta && <button className="btn btn-ghost btn-sm" title="Adiar 2 dias" onClick={() => acoes.adiarAlerta(alerta, addDias(hoje, 2))}><Clock size={12} /></button>}
      {alerta && <button className="btn btn-ghost btn-sm" title="Marcar como resolvida" onClick={() => acoes.resolverAlerta(alerta, "Resolvido pela agenda")}><CheckCircle2 size={12} /></button>}
    </div>
  );
}

function Grupo({ titulo, itens, render, cor }) {
  if (!itens.length) return null;
  return (
    <div className="secao">
      <div className="secao-head"><h3 style={{ color: cor }}>{titulo} <span className="badge" style={{ background: cor || "var(--primary)" }}>{itens.length}</span></h3></div>
      <div className="lista">{itens.map(render)}</div>
    </div>
  );
}

export default function Agenda({ turmaId }) {
  const data = useData();
  const ui = useUI();
  const { turmas, linhas, alertas, contatos, freq, cfg, hoje } = data;
  const ag = useMemo(() => (turmaId ? montarAgenda({ turmas, linhas, alertas, contatos, freq, cfg, hoje, turmaId }) : ui.agenda), [turmaId, turmas, linhas, alertas, contatos, freq, cfg, hoje, ui.agenda]);
  const nada = !ag.total && !ag.chamadasPendentes.length && !ag.turmasOcorrencia.length && !ag.avisos.length;
  const dia = new Date(hoje + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  const ItemAluno = ({ linha, alerta, sub, cor, extra }) => (
    <div className="item" style={{ borderLeftColor: cor || FAIXA_COR[linha.r.faixa] }}>
      <div className="grow" style={{ minWidth: 200 }}>
        <div className="t"><button className="link-aluno" onClick={() => ui.abrirFicha(linha.turma.id, linha.aluno.id)}>{linha.aluno.nome}</button> <FaixaChip faixa={linha.r.faixa} small /> <span className="mono small" style={{ color: FAIXA_COR[linha.r.faixa], fontWeight: 800 }}>{fmtPct(linha.r.pct)}</span></div>
        <div className="s">{linha.turma.curso} · {sub}</div>
        {extra}
      </div>
      <Acoes linha={linha} alerta={alerta} />
    </div>
  );

  return (
    <>
      {!turmaId && (
        <div className="page-header">
          <div><h2>Agenda do dia</h2><p><span style={{ textTransform: "capitalize" }}>{dia}</span> · {ag.total} {ag.total === 1 ? "ação" : "ações"} de acompanhamento</p></div>
        </div>
      )}
      {nada ? <Empty>Nenhuma ação pendente. Tudo em dia! 🎉</Empty> : (
        <>
          <Grupo titulo={`🚨 ${cfg.consecutivasAlerta}+ faltas consecutivas`} cor="#DC2626" itens={ag.consecutivas} render={({ alerta, linha }) => (
            <ItemAluno key={alerta.id} linha={linha} alerta={alerta} cor="#DC2626"
              sub={`${linha.r.consecutivas} faltas seguidas (${linha.r.datasConsecutivas.map(fmtDataCurta).join(", ")}) · alerta em ${fmtData(alerta.criadoEm?.slice(0, 10))}`}
              extra={EMAIL_STATUS[alerta.emailStatus] && <div className="small" style={{ color: EMAIL_STATUS[alerta.emailStatus].c, fontWeight: 600, marginTop: 3 }}>✉ {EMAIL_STATUS[alerta.emailStatus].t}{alerta.emailErro ? `: ${alerta.emailErro}` : ""}</div>} />
          )} />
          <Grupo titulo={`⚠️ Aproximando-se de ${cfg.limiteMinimo}%`} cor="#F97316" itens={ag.limite} render={({ alerta, linha }) => (
            <ItemAluno key={alerta.id} linha={linha} alerta={alerta}
              sub={`pode faltar mais ${linha.r.faltasPermitidasRestantes ?? "—"} dia(s) · projeção ${fmtPct(linha.r.projecaoPct)} · ${linha.r.motivos[0] || ""}`} />
          )} />
          <Grupo titulo="📅 Retornos agendados" cor="#4F46E5" itens={ag.retornos} render={({ linha, contato, atraso }) => (
            <ItemAluno key={linha.key} linha={linha} cor="#4F46E5"
              sub={`${atraso > 0 ? `atrasado há ${atraso} dia(s)` : "para hoje"} · ${contato.proximaAcao || "retomar contato"} · último contato ${fmtDataCurta(contato.ultimoContato)}`} />
          )} />
          <Grupo titulo="⏳ Aguardando retorno do aluno" cor="#F59E0B" itens={ag.semRetorno} render={({ linha, contato, dias }) => (
            <ItemAluno key={linha.key} linha={linha} cor="#F59E0B" sub={`sem resposta há ${dias} dias · último contato por ${contato.tentativas?.at(-1)?.forma || "—"}`} />
          )} />
          <Grupo titulo="📞 Marcados como “Necessita contato”" cor="#EF4444" itens={ag.necessitaContato} render={(linha) => (
            <ItemAluno key={linha.key} linha={linha} sub={linha.r.motivos[0] || "situação marcada manualmente"} />
          )} />

          {ag.chamadasPendentes.length > 0 && (
            <div className="secao">
              <div className="secao-head"><h3>📝 Chamada de hoje ainda não registrada <span className="badge" style={{ background: "#6B7280" }}>{ag.chamadasPendentes.length}</span></h3></div>
              <div className="lista">
                {ag.chamadasPendentes.map((t) => (
                  <Link key={t.id} href={`/turmas/${t.id}?aba=chamada`} className="item click" style={{ textDecoration: "none", color: "inherit" }}>
                    <ClipboardList size={16} color="var(--ink-soft)" />
                    <div className="grow"><div className="t">{t.curso}</div><div className="s">{t.codigo || "sem código"} · {t.turno} · {t.instrutor || "sem docente"}</div></div>
                    <span className="btn btn-ghost btn-sm">Fazer chamada</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {ag.turmasOcorrencia.length > 0 && !turmaId && (
            <div className="secao">
              <div className="secao-head"><h3>🏫 Turmas com ocorrência coletiva</h3></div>
              <div className="lista">
                {ag.turmasOcorrencia.map((x) => (
                  <Link key={x.turma.id} href={`/turmas/${x.turma.id}`} className="item click" style={{ borderLeftColor: "var(--vermelho)", textDecoration: "none", color: "inherit" }}>
                    <div className="grow"><div className="t">{x.turma.curso} <span className="soft">({x.turma.codigo})</span></div><div className="s">{x.n} alunos ({Math.round(x.prop * 100)}%) em risco ou com faltas seguidas — vale conversar com o docente</div></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {ag.avisos.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid var(--amarelo)" }}>
              <h4 style={{ marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}><AlertTriangle size={14} /> Pendências administrativas</h4>
              {ag.avisos.map((a, i) => (
                <div key={i} className="small" style={{ padding: "5px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span>{a.texto}</span>
                  {a.linha ? <button className="link-aluno small" onClick={() => ui.abrirAluno(a.turma.id, a.linha.aluno.id)}>Cadastrar</button> : <button className="link-aluno small" onClick={() => ui.abrirConfigTurma(a.turma.id)}>Ajustar</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
