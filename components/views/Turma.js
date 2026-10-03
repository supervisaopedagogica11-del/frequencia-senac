"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Users, Phone, LayoutDashboard, Settings, Flag, FileDown } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import Painel from "./Painel";
import Alunos from "./Alunos";
import Chamada from "./Chamada";
import { ListaPendencias } from "./Agenda";
import { isFinalizada, fmtData } from "@/lib/engine";
import { tipoLabel } from "@/lib/constants";
import { exportarPDF } from "@/lib/exportar";
import { colunasTurma } from "./Relatorios";

const ABAS = [["chamada", "Chamada", ClipboardList], ["alunos", "Alunos", Users], ["pendencias", "Pendências", Phone], ["resumo", "Resumo", LayoutDashboard]];

export default function Turma({ id }) {
  const { turmas, linhas, pronto, pode, cfg } = useData();
  const ui = useUI();
  const sp = useSearchParams();
  const aba = sp?.get("aba") || "chamada";
  const turma = turmas.find((t) => t.id === id);
  if (pronto && !turma) return <Empty>Turma não encontrada. Ela pode ter sido excluída.</Empty>;
  if (!turma) return null;
  const fin = isFinalizada(turma);
  const pdf = () => exportarPDF({
    titulo: `Frequência — ${turma.curso}`, subtitulo: `${turma.codigo || "sem código"} · ${turma.turno} · ${turma.cargaHoraria || "?"}h · limite de faltas ${turma.cargaHoraria ? turma.cargaHoraria * 0.25 : "?"}h`,
    colunas: colunasTurma, linhas: linhas.filter((l) => l.turma.id === id).sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)), nome: `frequencia_${turma.codigo || turma.curso}`, instituicao: cfg.instituicao,
  });
  return (
    <>
      <div className="page-header" style={{ marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {turma.curso}
            {fin && <span className="chip" style={{ background: "#6B7280" }}><Flag size={10} /> Finalizada</span>}
          </h2>
          <p>{[turma.codigo, tipoLabel(turma.tipo), turma.turno, turma.instrutor, turma.cargaHoraria ? `${turma.cargaHoraria}h (${turma.horariosPorDia}h por dia)` : "carga horária não informada", `${fmtData(turma.periodoInicio)} a ${fmtData(turma.periodoRealFim || turma.periodoFim)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={pdf} title="Relatório de frequência da turma em PDF"><FileDown size={15} /> PDF</button>
          {pode("turmaConfig") && <button className="btn btn-ghost" onClick={() => ui.abrirConfigTurma(turma.id)}><Settings size={15} /> Configurar</button>}
        </div>
      </div>
      <nav className="tabs">
        {ABAS.map(([k, l, I]) => <Link key={k} href={`/turmas/${id}?aba=${k}`} className={aba === k ? "active" : ""} scroll={false}><I size={14} />{l}</Link>)}
      </nav>
      {aba === "chamada" && <Chamada key={id} turmaId={id} />}
      {aba === "alunos" && <Alunos key={id} turmaId={id} />}
      {aba === "pendencias" && <ListaPendencias turmaId={id} />}
      {aba === "resumo" && <Painel turmaId={id} />}
    </>
  );
}
