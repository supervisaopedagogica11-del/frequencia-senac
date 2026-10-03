"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LayoutDashboard, CalendarClock, Users, ClipboardList, ShieldAlert, Phone, FileBarChart, Settings, Flag } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Empty } from "../ui";
import Painel from "./Painel";
import Agenda from "./Agenda";
import Alunos from "./Alunos";
import Chamada from "./Chamada";
import Permanencia from "./Permanencia";
import Contatos from "./Contatos";
import Relatorios from "./Relatorios";
import { isFinalizada, fmtData } from "@/lib/engine";
import { tipoLabel } from "@/lib/constants";

const ABAS = [
  ["painel", "Painel", LayoutDashboard], ["agenda", "Agenda do dia", CalendarClock], ["alunos", "Alunos", Users], ["chamada", "Chamada/Frequência", ClipboardList],
  ["permanencia", "Gestão de permanência", ShieldAlert], ["contatos", "Contatos", Phone], ["relatorios", "Relatórios", FileBarChart],
];

export default function Turma({ id }) {
  const { turmas, pronto, pode } = useData();
  const ui = useUI();
  const sp = useSearchParams();
  const aba = sp?.get("aba") || "painel";
  const turma = turmas.find((t) => t.id === id);
  if (pronto && !turma) return <Empty>Turma não encontrada. Ela pode ter sido excluída.</Empty>;
  if (!turma) return null;
  const fin = isFinalizada(turma);
  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="breadcrumb">Turmas › {fin ? "Finalizadas" : turma.turno}</div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {turma.curso}
            <span className="chip" style={{ background: fin ? "#6B7280" : "var(--verde)" }}>{fin ? <><Flag size={10} /> Finalizada</> : "Ativa"}</span>
          </h2>
          <p>{turma.codigo || "sem código"} · {tipoLabel(turma.tipo)} · {turma.turno} · {turma.instrutor || "sem docente"} · {turma.cargaHoraria ?? "?"}h ({turma.horariosPorDia}h/dia) · {fmtData(turma.periodoInicio)} a {fmtData(turma.periodoRealFim || turma.periodoFim)}</p>
        </div>
        {pode("turmaConfig") && <button className="btn btn-ghost" onClick={() => ui.abrirConfigTurma(turma.id)} title="Configurações da turma"><Settings size={15} /> Configurar</button>}
      </div>
      <nav className="tabs">
        {ABAS.map(([k, l, I]) => <Link key={k} href={`/turmas/${id}?aba=${k}`} className={aba === k ? "active" : ""} scroll={false}><I size={14} />{l}</Link>)}
        {pode("turmaConfig") && <button onClick={() => ui.abrirConfigTurma(turma.id)}><Settings size={14} /> Configurações</button>}
      </nav>
      {aba === "painel" && <Painel turmaId={id} />}
      {aba === "agenda" && <Agenda turmaId={id} />}
      {aba === "alunos" && <Alunos turmaId={id} />}
      {aba === "chamada" && <Chamada key={id} turmaId={id} />}
      {aba === "permanencia" && <Permanencia key={id} turmaId={id} />}
      {aba === "contatos" && <Contatos turmaId={id} />}
      {aba === "relatorios" && <Relatorios turmaId={id} />}
    </>
  );
}
