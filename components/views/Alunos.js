"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, UserPlus, Pencil, ClipboardCheck, Download, MailWarning } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, StatusChip, Pct, FaltasBar, Empty } from "../ui";
import { normalizar, isFinalizada } from "@/lib/engine";
import { FAIXA_LABEL } from "@/lib/constants";
import { exportarExcel } from "@/lib/exportar";

const FILTROS = [
  ["todos", "Todos"], ["atencao", "Precisam de atenção"], ["risco", "Em risco"], ["abaixo", "Abaixo de 75%"],
  ["seguidas", "Faltas seguidas"], ["contato", "Necessita contato"], ["evadidos", "Evadidos"], ["semEmail", "Sem e-mail"],
];

const EXTRAS = { regular: "Regular", f7580: "Entre 75% e 80%", f8090: "Entre 80% e 90%", f90: "Acima de 90%", acomp: "Acompanhar", evasao: "Risco de evasão" };

export default function Alunos({ turmaId }) {
  const { linhas, turmas, cfg, pode } = useData();
  const ui = useUI();
  const sp = useSearchParams();
  const [f, setF] = useState(sp?.get("f") || "todos");
  const [q, setQ] = useState("");
  const [turma, setTurma] = useState(turmaId || sp?.get("turma") || "");

  const lista = useMemo(() => {
    const nq = normalizar(q.trim());
    return linhas.filter((l) => {
      if (turma && l.turma.id !== turma) return false;
      if (!turmaId && !turma && l.finalizada) return false;
      if (nq && ![l.aluno.nome, l.aluno.email, l.aluno.matricula, l.turma.curso, l.turma.codigo].some((x) => normalizar(x).includes(nq))) return false;
      switch (f) {
        case "atencao": return l.ativo && ["risco", "abaixo"].includes(l.r.faixa);
        case "risco": return l.ativo && l.r.faixa === "risco";
        case "abaixo": return l.ativo && l.r.faixa === "abaixo";
        case "seguidas": return l.ativo && l.r.consecutivas >= cfg.consecutivasAlerta;
        case "contato": return l.status === "Necessita contato";
        case "evadidos": return l.status === "Evadido";
        case "semEmail": return l.ativo && !l.aluno.email;
        case "regular": return l.ativo && l.r.faixa === "regular";
        case "f7580": return l.ativo && l.r.pct !== null && l.r.pct >= 75 && l.r.pct < 80;
        case "f8090": return l.ativo && l.r.pct !== null && l.r.pct >= 80 && l.r.pct < 90;
        case "f90": return l.ativo && l.r.pct !== null && l.r.pct >= 90;
        case "acomp": return l.ativo && ["Necessita contato", "Em acompanhamento", "Aguardando retorno"].includes(l.status);
        case "evasao": return l.ativo && (l.r.faixa === "abaixo" || l.r.consecutivas >= cfg.consecutivasAlerta);
        default: return l.ativo;
      }
    }).sort((a, b) => (f === "todos" ? a.aluno.nome.localeCompare(b.aluno.nome) : b.prioridade - a.prioridade));
  }, [linhas, f, q, turma, turmaId, cfg]);

  const exportar = () => exportarExcel({
    nome: `alunos_${f}`, aba: "Alunos", linhas: lista,
    colunas: [
      { titulo: "Aluno", valor: (l) => l.aluno.nome }, { titulo: "Turma", valor: (l) => l.turma.curso }, { titulo: "Código", valor: (l) => l.turma.codigo },
      { titulo: "E-mail", valor: (l) => l.aluno.email }, { titulo: "Telefone", valor: (l) => l.aluno.telefone },
      { titulo: "Frequência %", valor: (l) => l.r.pct }, { titulo: "Horas de falta", valor: (l) => l.r.horasFalta }, { titulo: "Limite de horas", valor: (l) => l.r.limiteHoras },
      { titulo: "Pode faltar ainda (h)", valor: (l) => l.r.horasRestantes }, { titulo: "Faltas seguidas", valor: (l) => l.r.consecutivas },
      { titulo: "Frequência", valor: (l) => FAIXA_LABEL[l.r.faixa] }, { titulo: "Situação", valor: (l) => l.status },
    ],
  });

  return (
    <>
      {!turmaId && <div className="page-header"><div><h2>Alunos</h2><p>Frequência, faltas e situação de cada aluno</p></div></div>}
      <div className="pills" style={{ marginBottom: 10 }}>
        {FILTROS.map(([k, l]) => <button key={k} className={"pill" + (f === k ? " on" : "")} onClick={() => setF(k)}>{l}</button>)}
        {EXTRAS[f] && <button className="pill on">{EXTRAS[f]}</button>}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--ink-soft)" }} />
          <input className="input" style={{ width: "100%", paddingLeft: 30 }} placeholder="Buscar por nome, e-mail ou matrícula..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!turmaId && (
          <select className="select" value={turma} onChange={(e) => setTurma(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Todas as turmas ativas</option>
            {turmas.map((t) => <option key={t.id} value={t.id}>{t.curso}{isFinalizada(t) ? " (finalizada)" : ""}</option>)}
          </select>
        )}
        <button className="btn btn-ghost" onClick={exportar} disabled={!lista.length}><Download size={14} /> Excel</button>
        {turmaId && pode("editar") && <button className="btn btn-primary" onClick={() => ui.abrirAluno(turmaId, null)}><UserPlus size={14} /> Incluir aluno</button>}
      </div>
      {!lista.length ? <Empty>Nenhum aluno neste filtro.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Aluno</th><th>Frequência</th><th>Faltas</th><th>Acompanhamento</th><th></th></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((l) => (
                <tr key={l.key}>
                  <td className="principal">
                    <div><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                      {!l.aluno.email && <MailWarning size={12} color="var(--amarelo)" style={{ marginLeft: 5, verticalAlign: "-1px" }} />}
                      {!turmaId && <div className="small soft">{l.turma.curso}</div>}</div>
                  </td>
                  <td data-label="Frequência"><span className="row" style={{ gap: 6, flexWrap: "nowrap" }}><Pct r={l.r} /><FaixaChip faixa={l.r.faixa} small /></span></td>
                  <td data-label="Faltas"><FaltasBar r={l.r} /></td>
                  <td data-label="Acompanhamento"><StatusChip status={l.status} /></td>
                  <td className="num"><div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    {pode("contatos") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirContato(l.turma.id, l.aluno.id)}><ClipboardCheck size={12} /> Contato</button>}
                    {pode("editar") && <button className="btn btn-ghost btn-sm btn-icon" title="Editar cadastro" onClick={() => ui.abrirAluno(l.turma.id, l.aluno.id)}><Pencil size={12} /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > 300 && <div className="small soft" style={{ padding: 10 }}>Mostrando 300 de {lista.length}. Use a busca para encontrar mais rápido.</div>}
        </div>
      )}
    </>
  );
}
