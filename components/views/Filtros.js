"use client";
import { useMemo, useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { STATUS_ALUNO, FAIXA_LABEL, TURNOS, TIPOS_TURMA } from "@/lib/constants";
import { normalizar, statusAluno } from "@/lib/engine";

export const FILTRO_PADRAO = { q: "", turno: "", turma: "", situacaoTurma: "ativas", tipo: "", status: "", faixa: "", acomp: "", consec: "", evasao: "ativos" };

export function useFiltros(inicial) {
  const [f, setF] = useState({ ...FILTRO_PADRAO, ...(inicial || {}) });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const limpar = () => setF({ ...FILTRO_PADRAO });
  return { f, set, limpar, setF };
}

export function aplicarFiltros(linhas, f, { alertas, cfg }) {
  const q = normalizar(f.q.trim());
  const comPendencia = new Set(Object.values(alertas || {}).filter((a) => a.status === "aberto").map((a) => `${a.turmaId}|${a.alunoId}`));
  return linhas.filter((l) => {
    if (q && ![l.aluno.nome, l.aluno.email, l.aluno.matricula, l.turma.curso, l.turma.codigo, l.turma.instrutor].some((x) => normalizar(x).includes(q))) return false;
    if (f.turno && l.turma.turno !== f.turno) return false;
    if (f.turma && l.turma.id !== f.turma) return false;
    if (f.situacaoTurma === "ativas" && l.finalizada) return false;
    if (f.situacaoTurma === "finalizadas" && !l.finalizada) return false;
    if (f.tipo && (l.turma.tipo || "") !== f.tipo) return false;
    const st = statusAluno(l.aluno);
    if (f.status && st !== f.status) return false;
    if (f.evasao === "ativos" && !l.ativo && !f.status) return false;
    if (f.evasao === "evadidos" && st !== "Evadido") return false;
    if (f.faixa === "prevencao" && !["atencao", "risco", "critico"].includes(l.r.faixa)) return false;
    if (f.faixa === "intervencao" && !["risco", "critico", "abaixo"].includes(l.r.faixa) && l.r.consecutivas < cfg.consecutivasAlerta) return false;
    if (f.faixa && !["prevencao", "intervencao"].includes(f.faixa) && l.r.faixa !== f.faixa) return false;
    if (f.consec && l.r.consecutivas < Number(f.consec)) return false;
    if (f.acomp === "pendencia" && !comPendencia.has(l.key)) return false;
    if (f.acomp === "semcontato" && (l.contato?.tentativas?.length || 0) > 0) return false;
    if (f.acomp === "comcontato" && !(l.contato?.tentativas?.length > 0)) return false;
    if (f.acomp === "retorno" && !(l.contato?.proximaData && !l.contato.concluido)) return false;
    return true;
  });
}

export function BarraFiltros({ f, set, limpar, turmas, esconder = [], total, filtrados }) {
  const [mais, setMais] = useState(false);
  const ativosCount = Object.entries(f).filter(([k, v]) => v && v !== "ativas" && v !== "ativos" && k !== "q").length;
  const Sel = ({ k, children, label }) => esconder.includes(k) ? null : (
    <select className="select" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-label={label}>{children}</select>
  );
  return (
    <div className="card" style={{ marginBottom: 14, padding: 12 }}>
      <div className="row">
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--ink-soft)" }} />
          <input className="input" style={{ width: "100%", paddingLeft: 30 }} placeholder="Buscar aluno, e-mail, matrícula, turma, código, docente..." value={f.q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Sel k="faixa" label="Frequência">
          <option value="">Todas as faixas</option>
          <option value="intervencao">Precisam de intervenção</option>
          <option value="prevencao">Em risco de chegar a 75%</option>
          {["regular", "atencao", "risco", "critico", "abaixo", "semdados"].map((k) => <option key={k} value={k}>{FAIXA_LABEL[k]}</option>)}
        </Sel>
        <Sel k="status" label="Situação"><option value="">Todas as situações</option>{STATUS_ALUNO.map((s) => <option key={s}>{s}</option>)}</Sel>
        <button className="btn btn-ghost" onClick={() => setMais((v) => !v)}><SlidersHorizontal size={14} /> Filtros{ativosCount ? ` (${ativosCount})` : ""}</button>
        {(ativosCount > 0 || f.q) && <button className="btn btn-ghost btn-icon" title="Limpar filtros" onClick={limpar}><X size={14} /></button>}
      </div>
      {mais && (
        <div className="row" style={{ marginTop: 10 }}>
          <Sel k="turno" label="Turno"><option value="">Todos os turnos</option>{TURNOS.map((t) => <option key={t}>{t}</option>)}</Sel>
          {!esconder.includes("turma") && turmas && (
            <select className="select" value={f.turma} onChange={(e) => set("turma", e.target.value)} style={{ maxWidth: 260 }}><option value="">Todas as turmas</option>{turmas.map((t) => <option key={t.id} value={t.id}>{t.curso} ({t.codigo || "—"})</option>)}</select>
          )}
          <Sel k="situacaoTurma" label="Turmas"><option value="ativas">Turmas ativas</option><option value="finalizadas">Turmas finalizadas</option><option value="">Ativas e finalizadas</option></Sel>
          <Sel k="tipo" label="Tipo"><option value="">Técnico e FIC</option>{TIPOS_TURMA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Sel>
          <Sel k="acomp" label="Acompanhamento">
            <option value="">Qualquer acompanhamento</option><option value="pendencia">Com pendência aberta</option><option value="semcontato">Nunca contatados</option><option value="comcontato">Já contatados</option><option value="retorno">Com retorno agendado</option>
          </Sel>
          <Sel k="consec" label="Faltas consecutivas"><option value="">Qualquer nº de faltas seguidas</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ faltas seguidas</option>)}</Sel>
          <Sel k="evasao" label="Evasão"><option value="ativos">Só alunos ativos</option><option value="">Incluir evadidos/concluídos</option><option value="evadidos">Só evadidos</option></Sel>
        </div>
      )}
      {total !== undefined && <div className="small soft" style={{ marginTop: 8 }}>{filtrados} de {total} aluno(s)</div>}
    </div>
  );
}
