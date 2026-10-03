"use client";
import { useState } from "react";
import { UserPlus, Pencil, Eye, MailWarning, Search } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { StatusChip, FaixaChip, Pct, Empty } from "../ui";
import { normalizar } from "@/lib/engine";

export default function Alunos({ turmaId }) {
  const { linhas, cfg, pode } = useData();
  const ui = useUI();
  const [q, setQ] = useState("");
  const ls = linhas.filter((l) => l.turma.id === turmaId && (!q || normalizar(l.aluno.nome + " " + l.aluno.email + " " + l.aluno.matricula).includes(normalizar(q)))).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome));
  const semEmail = linhas.filter((l) => l.turma.id === turmaId && l.ativo && !l.aluno.email).length;
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--ink-soft)" }} />
          <input className="input" style={{ width: "100%", paddingLeft: 30 }} placeholder="Buscar aluno, e-mail ou matrícula..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {pode("editar") && <button className="btn btn-primary" onClick={() => ui.abrirAluno(turmaId, null)}><UserPlus size={14} /> Incluir aluno</button>}
      </div>
      {semEmail > 0 && <div className="aviso" style={{ marginBottom: 12 }}><MailWarning size={14} /> {semEmail} aluno(s) ativo(s) sem e-mail cadastrado — o e-mail automático não chega até eles. Clique em “Editar” para completar.</div>}
      {!ls.length ? <Empty>Nenhum aluno.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Aluno</th><th>Matrícula</th><th>Telefone</th><th>E-mail</th><th className="num">Frequência</th><th>Faixa</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {ls.map((l) => (
                <tr key={l.key} style={{ opacity: l.ativo ? 1 : 0.6 }}>
                  <td className="principal"><button className="link-aluno" onClick={() => ui.abrirFicha(turmaId, l.aluno.id)}>{l.aluno.nome}</button></td>
                  <td data-label="Matrícula" className="small">{l.aluno.matricula || "—"}</td>
                  <td data-label="Telefone" className="small">{l.aluno.telefone || "—"}</td>
                  <td data-label="E-mail" className="small">{l.aluno.email || <span style={{ color: "var(--amarelo)", fontWeight: 600 }}>não cadastrado</span>}</td>
                  <td className="num" data-label="Frequência"><Pct r={l.r} limite={cfg.limiteMinimo} /></td>
                  <td data-label="Faixa"><FaixaChip faixa={l.r.faixa} /></td>
                  <td data-label="Situação"><StatusChip status={l.status} /></td>
                  <td className="num"><div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    {pode("editar") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirAluno(turmaId, l.aluno.id)}><Pencil size={12} /> Editar</button>}
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => ui.abrirFicha(turmaId, l.aluno.id)} title="Ficha"><Eye size={13} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
