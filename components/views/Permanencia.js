"use client";
import { useState } from "react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import { fmtPct, fmtHoras, normalizar } from "@/lib/engine";
import { RISCO_LABEL, RISCO_COR, TIER_COR } from "@/lib/constants";

// Gestão de Permanência — classificação de risco de evasão por aluno (igual ao protótipo)
export default function Permanencia() {
  const { linhas } = useData();
  const ui = useUI();
  const [q, setQ] = useState("");
  const nq = normalizar(q.trim());
  const todos = linhas.filter((l) => l.ativo && !l.finalizada && (!nq || normalizar(l.aluno.nome + " " + l.turma.curso + " " + l.turma.codigo).includes(nq)))
    .sort((a, b) => (a.r.pct ?? 999) - (b.r.pct ?? 999));
  return (
    <>
      <div className="page-header">
        <div><h2>Gestão de Permanência</h2><p>Classificação de risco de evasão por aluno</p></div>
        <input className="input" style={{ minWidth: 240 }} placeholder="Buscar aluno ou turma..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!todos.length && <Empty>Nenhum aluno ativo encontrado.</Empty>}
      {["vermelho", "laranja", "amarelo", "verde"].map((nivel) => {
        const itens = todos.filter((l) => l.risco.nivel === nivel);
        if (!itens.length) return null;
        return (
          <div key={nivel} style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13.5, margin: "0 0 8px", color: RISCO_COR[nivel] }}>{RISCO_LABEL[nivel]} ({itens.length})</h3>
            <div className="tabela-wrap">
              <table className="tabela responsiva">
                <thead><tr><th>Aluno</th><th>Turma</th><th>Motivo</th><th className="center">Horas de falta</th><th className="num">Frequência</th></tr></thead>
                <tbody>
                  {itens.map((l) => (
                    <tr key={l.key}>
                      <td className="principal"><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button></td>
                      <td className="small soft" data-label="Turma">{l.turma.curso} · {l.turma.codigo}</td>
                      <td className="small" data-label="Motivo">{l.risco.motivos.join(" · ") || "—"}</td>
                      <td className="center mono" data-label="Horas de falta">{fmtHoras(l.r.horasFalta)} <span className="soft small">/ {fmtHoras(l.r.limiteHoras)}</span></td>
                      <td className="num mono" data-label="Frequência" style={{ fontWeight: 800, color: TIER_COR[l.st.tier] }}>{fmtPct(l.r.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
