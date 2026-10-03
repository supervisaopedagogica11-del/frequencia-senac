"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CheckCircle2, Trash2, UserPlus, Settings, FileDown, ClipboardCheck, X, Users, MailWarning } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { addDias, fmtData, fmtDataCurta, datasRegistradas, isFinalizada, fmtHoras, todayISO } from "@/lib/engine";
import { TIER_GRAD, TIPOS_TURMA, TURNOS } from "@/lib/constants";
import { exportarPDFTurma } from "./Painel";

// campo que salva ao sair (evita gravar a cada tecla)
function CampoTurma({ turma, campo, rotulo, tipo = "text", largura, conv = (v) => v || null }) {
  const { acoes, pode } = useData();
  const [v, setV] = useState(turma[campo] ?? "");
  useEffect(() => { setV(turma[campo] ?? ""); }, [turma[campo]]); // eslint-disable-line
  const salvar = () => { const nv = conv(v); if ((turma[campo] ?? null) !== nv) acoes.atualizarTurma(turma, { [campo]: nv }, { [campo]: rotulo }); };
  return (
    <label className="campo" style={{ minWidth: largura || 120 }}><span>{rotulo}</span>
      <input className="input" type={tipo} value={v} disabled={!pode("turmaConfig")} onChange={(e) => setV(e.target.value)} onBlur={salvar} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
    </label>
  );
}

function ConfigBox({ turma, fechar }) {
  const { acoes, pode } = useData();
  const num = (v) => (v === "" ? null : Number(v) || null);
  const fin = isFinalizada(turma);
  return (
    <div className="configbox">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}><Settings size={13} style={{ verticalAlign: "-2px" }} /> Configuração da turma</strong>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={fechar} aria-label="Fechar"><X size={13} /></button>
      </div>
      <div className="grid-form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <label className="campo"><span>Tipo</span>
          <select className="select" value={turma.tipo || ""} disabled={!pode("turmaConfig")} onChange={(e) => acoes.atualizarTurma(turma, { tipo: e.target.value || null }, { tipo: "Tipo" })}>
            <option value="">Não definido</option>{TIPOS_TURMA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="campo"><span>Turno</span>
          <select className="select" value={turma.turno || ""} disabled={!pode("turmaConfig")} onChange={(e) => acoes.atualizarTurma(turma, { turno: e.target.value }, { turno: "Turno" })}>
            {TURNOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <CampoTurma turma={turma} campo="horariosPorDia" rotulo="Carga horária diária (h)" tipo="number" conv={num} />
        <CampoTurma turma={turma} campo="cargaHoraria" rotulo="Carga horária total (h)" tipo="number" conv={num} />
        <CampoTurma turma={turma} campo="instrutor" rotulo="Docente" largura={180} />
        <CampoTurma turma={turma} campo="periodoInicio" rotulo="Início do curso" tipo="date" />
        <CampoTurma turma={turma} campo="periodoFim" rotulo="Previsão de término" tipo="date" />
        <CampoTurma turma={turma} campo="periodoRealFim" rotulo="Data real de encerramento" tipo="date" />
      </div>
      {turma.cargaHoraria ? <p className="small soft" style={{ margin: "10px 0 0" }}>Limite de faltas: <strong>{fmtHoras(turma.cargaHoraria * 0.25)}</strong> (25% de {turma.cargaHoraria}h) — o aluno precisa de no mínimo 75% de frequência.</p> : <p className="small" style={{ margin: "10px 0 0", color: "var(--vermelho)" }}>Informe a carga horária total para calcular a frequência.</p>}
      {pode("turmaConfig") && (
        <div className="row" style={{ marginTop: 12 }}>
          {!fin
            ? <button className="btn btn-ghost btn-sm" onClick={() => acoes.finalizarTurma(turma, turma.periodoRealFim || todayISO())}><ClipboardCheck size={12} /> Marcar como finalizada</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => acoes.reabrirTurma(turma)}>Reabrir turma</button>}
          {pode("excluirTurma") && <button className="btn btn-perigo-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={async () => { if (await acoes.excluirTurma(turma)) window.location.href = "/painel"; }}><X size={12} /> Excluir turma</button>}
        </div>
      )}
    </div>
  );
}

function SemTurma() {
  const { turmas, freq, hoje } = useData();
  const ativas = turmas.filter((t) => !isFinalizada(t));
  return (
    <>
      <div className="page-header"><div><h2>Chamada</h2><p>Selecione uma turma na barra lateral ou abaixo</p></div></div>
      {!ativas.length ? <Empty icone={<Users size={22} />}>Nenhuma turma ativa.</Empty> : (
        <div className="grid3">
          {TURNOS.map((tn) => (
            <div key={tn} className="card">
              <h4 style={{ marginBottom: 8 }}>{tn}</h4>
              {!ativas.filter((t) => t.turno === tn).length && <div className="small soft">Nenhuma turma</div>}
              {ativas.filter((t) => t.turno === tn).map((t) => {
                const feita = !!freq[`${t.id}|${hoje}`];
                return (
                  <Link key={t.id} href={`/turmas/${t.id}`} className="row small" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit", flexWrap: "nowrap" }}>
                    {feita ? <CheckCircle2 size={14} color="var(--verde)" /> : <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--cinza)", flexShrink: 0 }} />}
                    <span className="grow ellipsis">{t.curso} <span className="soft">({t.codigo || "—"})</span></span>
                    <span style={{ fontWeight: 700, color: feita ? "var(--ink-soft)" : "var(--primary)" }}>{feita ? "feita" : "fazer"}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function Chamada({ turmaId }) {
  const { turmas, freq, linhas, hoje, pode, acoes, cfg } = useData();
  const ui = useUI();
  const turma = turmas.find((t) => t.id === turmaId);
  const [data, setData] = useState(hoje);
  const [config, setConfig] = useState(false);
  const datas = useMemo(() => (turmaId ? datasRegistradas(turmaId, freq).reverse() : []), [turmaId, freq]);
  if (!turmaId) return <SemTurma />;
  if (!turma) return <Empty>Turma não encontrada.</Empty>;
  const fin = isFinalizada(turma);
  const hd = Number(turma.horariosPorDia) || 1;
  const reg = freq[`${turmaId}|${data}`];
  const feita = !!reg;
  const podeMarcar = pode("chamada");
  const ls = linhas.filter((l) => l.turma.id === turmaId).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  const horasDe = (r) => (!r ? [] : r.status === "F" ? Array.from({ length: hd }, (_, i) => i + 1) : r.status === "H" ? r.horas || [] : r.status === "A" ? [1] : []);
  const alternarHora = (l, h) => {
    const atual = horasDe(reg?.[l.aluno.id]);
    acoes.definirRegistro(turma, data, l.aluno, { status: "H", horas: atual.includes(h) ? atual.filter((x) => x !== h) : [...atual, h] });
  };
  let nF = 0, nH = 0;
  ls.forEach((l) => { if (!l.ativo) return; const r = reg?.[l.aluno.id]; if (r?.status === "F") nF++; else if (r) nH++; });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{turma.curso} <span className="chip" style={{ background: fin ? TIER_GRAD.cinza : TIER_GRAD.verde, marginLeft: 8, verticalAlign: "middle" }}>{fin ? "Finalizada" : "Ativa"}</span></h2>
          <p>{turma.codigo || "sem código"} · {turma.turno} · {turma.horarioInicio || "—"}–{turma.horarioFim || "—"} · {hd}h/dia · Carga horária {turma.cargaHoraria ?? "—"}h{turma.instrutor ? ` · ${turma.instrutor}` : ""}</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-icon" onClick={() => setData(addDias(data, -1))} aria-label="Dia anterior"><ChevronLeft size={15} /></button>
          <input type="date" className="input" value={data} max={hoje} onChange={(e) => e.target.value && setData(e.target.value)} />
          <button className="btn btn-ghost btn-icon" disabled={data >= hoje} onClick={() => setData(addDias(data, 1))} aria-label="Próximo dia"><ChevronRight size={15} /></button>
          <button className="btn btn-ghost" onClick={() => setConfig((v) => !v)}><Settings size={14} /> Configurar</button>
          {fin && <button className="btn btn-primary" onClick={() => exportarPDFTurma(turma, linhas, cfg, true)}><FileDown size={14} /> Relatório final (PDF)</button>}
        </div>
      </div>

      {config && <ConfigBox turma={turma} fechar={() => setConfig(false)} />}

      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <span className="small soft"><strong>Faltou</strong> = falta o dia inteiro ({hd}h) · chegou atrasado ou saiu mais cedo? clique nos <strong>horários</strong> em que não estava (1h cada)</span>
        <div className="row" style={{ gap: 6 }}>
          {feita ? <span className="chip" style={{ background: "var(--verde)" }}><CheckCircle2 size={11} /> Chamada feita · {nF} faltas · {nH} parciais</span> : <span className="chip" style={{ background: "#9CA3AF" }}>Chamada não feita</span>}
          {podeMarcar && !feita && <button className="btn btn-verde btn-sm" onClick={() => acoes.confirmarChamada(turma, data)}><CheckCircle2 size={13} /> Todos presentes</button>}
          {podeMarcar && feita && <button className="btn btn-ghost btn-sm btn-icon" title="Apagar a chamada deste dia (aula não aconteceu)" onClick={() => acoes.excluirChamada(turma, data)}><Trash2 size={13} /></button>}
        </div>
      </div>

      {!ls.length ? (
        <Empty icone={<UserPlus size={22} />}>Nenhum aluno nesta turma. {pode("editar") && <button className="link-aluno" onClick={() => ui.abrirAluno(turma.id, null)}>Incluir aluno</button>}</Empty>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela responsiva chamada">
            <thead><tr><th>Aluno</th><th className="center">Marcação</th><th className="center">Horários de falta</th><th>Situação</th></tr></thead>
            <tbody>
              {ls.map((l) => {
                const r = reg?.[l.aluno.id];
                const horas = horasDe(r);
                return (
                  <tr key={l.key} style={{ opacity: l.ativo ? 1 : 0.55 }}>
                    <td className="principal">
                      <button className="link-aluno" onClick={() => ui.abrirFicha(turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                      {!l.aluno.email && <MailWarning size={12} color="var(--amarelo)" style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
                      {!l.ativo && <span className="chip" style={{ background: "#9CA3AF", marginLeft: 6 }}>{l.situacao}</span>}
                    </td>
                    <td className="center" data-label="Presença">
                      <div className="seg">
                        <button className={"pres" + (feita && !r ? " on" : "")} disabled={!podeMarcar} onClick={() => acoes.definirRegistro(turma, data, l.aluno, null)}>Presente</button>
                        <button className={"falt" + (r?.status === "F" ? " on" : "")} disabled={!podeMarcar} onClick={() => acoes.definirRegistro(turma, data, l.aluno, r?.status === "F" ? null : { status: "F" })}>Faltou</button>
                      </div>
                    </td>
                    <td className="center" data-label="Horários">
                      <div className="horas">
                        {Array.from({ length: hd }, (_, i) => i + 1).map((h) => <button key={h} className={horas.includes(h) ? "on" : ""} disabled={!podeMarcar} title={`${h}º horário`} onClick={() => alternarHora(l, h)}>{h}º</button>)}
                      </div>
                    </td>
                    <td data-label="Faltas no curso">
                      <span className="chip" style={{ background: TIER_GRAD[l.st.tier] }}>{l.st.label}</span>
                      <div className="small soft" style={{ marginTop: 3 }}>{l.r.pct !== null ? `${String(l.r.pct).replace(".", ",")}% · ${fmtHoras(l.r.horasFalta)} de ${fmtHoras(l.r.limiteHoras)}` : "sem carga horária"}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pode("editar") && <div style={{ marginTop: 10, textAlign: "right" }}><button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turma.id, null)}><UserPlus size={13} /> Incluir aluno</button></div>}

      {datas.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ marginBottom: 8 }}>Chamadas registradas · {datas.length} aulas ({datas.length * hd}h de {turma.cargaHoraria || "?"}h)</h4>
          <div className="row" style={{ gap: 5 }}>{datas.slice(0, 40).map((d) => <button key={d} className={"pill" + (d === data ? " on" : "")} onClick={() => setData(d)} title={fmtData(d)}>{fmtDataCurta(d)}</button>)}</div>
        </div>
      )}
    </>
  );
}
