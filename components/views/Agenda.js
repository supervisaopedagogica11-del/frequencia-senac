"use client";
import Link from "next/link";
import { Eye } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { fmtData, fmtPct, fmtHoras } from "@/lib/engine";
import { RISCO_COR, STATUS_CONTATO_COR } from "@/lib/constants";

// Agenda do dia — somente ações pendentes (igual ao protótipo)
export default function Agenda() {
  const { alertas } = useData();
  const ui = useUI();
  const ag = ui.agenda;
  const vazio = !ag.total && !ag.proximosLimite.length && !ag.turmasAcompanhar.length && !ag.pendenciasAdmin.length && !ag.avisos.length;
  const emailInfo = (l) => {
    const a = Object.values(alertas).find((x) => x.turmaId === l.turma.id && x.alunoId === l.aluno.id && x.status === "aberto" && x.tipo === "consecutivas");
    if (!a) return null;
    return { enviado: "✉ e-mail automático enviado", erro: "✉ falha no e-mail automático — contato manual", sem_email: "✉ sem e-mail cadastrado" }[a.emailStatus] || null;
  };
  const Item = ({ l, cor, sub, direita }) => (
    <div className="agenda-item" style={{ borderLeftColor: cor }} onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>
      <div className="grow">
        <div style={{ fontSize: 13, fontWeight: 700 }}>{l.aluno.nome}</div>
        <div className="small soft">{l.turma.curso} · {sub}</div>
      </div>
      {direita || <Eye size={14} color="var(--ink-soft)" />}
    </div>
  );
  const Secao = ({ titulo, itens, children }) => itens.length ? (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 13.5, margin: "0 0 8px" }}>{titulo} ({itens.length})</h3>
      <div className="lista" style={{ gap: 6 }}>{children}</div>
    </div>
  ) : null;

  return (
    <>
      <div className="page-header"><div><h2>Agenda do dia</h2><p>Somente ações pendentes — para ver a classificação de risco por aluno, use o Painel ou a Gestão de Permanência</p></div></div>
      {vazio ? <Empty>Nenhuma ação pendente hoje. Tudo em dia. 🎉</Empty> : (
        <>
          <Secao titulo="📞 Sem nenhum contato registrado" itens={ag.semContato}>
            {ag.semContato.map((l) => <Item key={l.key} l={l} cor={RISCO_COR[l.risco.nivel]} sub={[l.risco.motivos[0] || `${l.r.consecutivas} faltas seguidas`, emailInfo(l)].filter(Boolean).join(" · ")} />)}
          </Secao>
          <Secao titulo="⏳ Aguardando retorno" itens={ag.aguardandoRetorno}>
            {ag.aguardandoRetorno.map((l) => {
              const st = l.contato.status || "Aguardando retorno";
              return <Item key={l.key} l={l} cor={STATUS_CONTATO_COR[st]} sub={`última tentativa em ${fmtData(l.contato.tentativas.at(-1)?.data)}`} direita={<span className="chip" style={{ background: STATUS_CONTATO_COR[st] || "#9CA3AF" }}>{st}</span>} />;
            })}
          </Secao>
          <Secao titulo="✅ Retornaram após contato — revisar e finalizar" itens={ag.retornaram}>
            {ag.retornaram.map((l) => <Item key={l.key} l={l} cor="var(--verde)" sub={l.contato.justificativa || "retornou"} />)}
          </Secao>
          <Secao titulo="⚠ Próximos do limite crítico de 75%" itens={ag.proximosLimite}>
            {ag.proximosLimite.map((l) => {
              const dias = Math.floor(l.r.horasRestantes / (l.r.horasDia || 1));
              return <Item key={l.key} l={{ ...l }} cor="var(--vermelho)" sub={`${fmtPct(l.r.pct)} · só pode faltar mais ${fmtHoras(l.r.horasRestantes)} (${dias >= 1 ? `~${dias} ${dias === 1 ? "dia" : "dias"}` : "menos de 1 dia"}) antes de reprovar por falta`} />;
            })}
          </Secao>
          {ag.turmasAcompanhar.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 13.5, margin: "0 0 8px" }}>🏫 Turmas que precisam de acompanhamento ({ag.turmasAcompanhar.length})</h3>
              <div className="lista" style={{ gap: 6 }}>
                {ag.turmasAcompanhar.map((x) => (
                  <Link key={x.turma.id} href={`/turmas/${x.turma.id}`} className="agenda-item" style={{ borderLeftColor: "var(--vermelho)", textDecoration: "none", color: "inherit" }}>
                    <div className="grow"><div style={{ fontSize: 13, fontWeight: 700 }}>{x.turma.curso} <span className="soft" style={{ fontWeight: 400 }}>({x.turma.codigo})</span></div><div className="small soft">{x.n} alunos ({Math.round(x.prop * 100)}%) em risco de evasão</div></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(ag.pendenciasAdmin.length > 0 || ag.avisos.length > 0) && (
            <div className="grid2">
              {ag.pendenciasAdmin.length > 0 && (
                <div className="card" style={{ borderLeft: "4px solid var(--amarelo)" }}>
                  <div className="small soft" style={{ fontWeight: 700, marginBottom: 8 }}>🗂 Pendências administrativas</div>
                  {ag.pendenciasAdmin.map((p, i) => (
                    <div key={i} className="small" style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{p.texto}</span>
                      <button className="link-aluno small" onClick={() => (p.linha ? ui.abrirAluno(p.turma.id, p.linha.aluno.id) : ui.abrirConfigTurma(p.turma.id))}>Resolver</button>
                    </div>
                  ))}
                </div>
              )}
              {ag.avisos.length > 0 && (
                <div className="card" style={{ borderLeft: "4px solid var(--roxo)" }}>
                  <div className="small soft" style={{ fontWeight: 700, marginBottom: 8 }}>📌 Avisos importantes</div>
                  {ag.avisos.map((a, i) => (
                    <div key={i} className="small" style={{ padding: "4px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{a.texto}</span>
                      {a.chamada ? <Link className="small" href={`/turmas/${a.turma.id}`}>Fazer chamada</Link> : <button className="link-aluno small" onClick={() => ui.abrirConfigTurma(a.turma.id)}>Finalizar</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
