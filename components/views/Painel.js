"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, AlertTriangle, TrendingDown, Phone, ClipboardCheck } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { Kpi, FaixaChip, Pct, FaltasBar, Empty } from "../ui";
import { resumoTurma, isFinalizada } from "@/lib/engine";
import { montarAgenda } from "@/lib/pendencias";

// lista compacta usada no Início e no Resumo da turma
export function ListaAtencao({ itens, mostrarTurma = true, vazio, limite = 15 }) {
  const ui = useUI();
  const { pode } = useData();
  if (!itens.length) return <Empty>{vazio || "Nenhum aluno precisando de atenção. 🎉"}</Empty>;
  return (
    <div className="tabela-wrap">
      <table className="tabela responsiva">
        <thead><tr><th>Aluno</th><th className="num">Frequência</th><th>Faltas</th><th>Por quê</th><th></th></tr></thead>
        <tbody>
          {itens.slice(0, limite).map((l) => (
            <tr key={l.key}>
              <td className="principal">
                <div><button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button>
                  {mostrarTurma && <div className="small soft">{l.turma.curso}</div>}</div>
              </td>
              <td className="num" data-label="Frequência"><Pct r={l.r} /></td>
              <td data-label="Faltas"><FaltasBar r={l.r} /></td>
              <td data-label="Por quê" className="small"><FaixaChip faixa={l.r.faixa} small /> <span className="soft">{l.r.motivo}</span></td>
              <td className="num">{pode("contatos") && <button className="btn btn-ghost btn-sm" onClick={() => ui.abrirContato(l.turma.id, l.aluno.id)}><ClipboardCheck size={12} /> Contato</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {itens.length > limite && <div className="small soft" style={{ padding: "8px 12px" }}>+ {itens.length - limite} — veja todos em <Link href="/alunos?f=atencao">Alunos</Link>.</div>}
    </div>
  );
}

export default function Painel({ turmaId }) {
  const { turmas, linhas, alertas, contatos, freq, hoje } = useData();
  const ui = useUI();
  const router = useRouter();
  const escopo = linhas.filter((l) => (turmaId ? l.turma.id === turmaId : !l.finalizada));
  const rt = resumoTurma(escopo, null);
  const ag = useMemo(() => (turmaId ? montarAgenda({ turmas, linhas, alertas, contatos, freq, hoje, turmaId }) : ui.agenda), [turmaId, turmas, linhas, alertas, contatos, freq, hoje, ui.agenda]);
  const atencao = escopo.filter((l) => l.ativo && ["risco", "abaixo"].includes(l.r.faixa)).sort((a, b) => b.prioridade - a.prioridade);
  const ir = (q) => router.push(`/alunos?f=${q}${turmaId ? `&turma=${turmaId}` : ""}`);

  return (
    <>
      {!turmaId && (
        <div className="page-header">
          <div><h2>Início</h2><p>Para aprovação o aluno precisa de no mínimo 75% de frequência na carga horária do curso.</p></div>
        </div>
      )}
      <div className="cards">
        <Kpi n={rt.ativos} l="Alunos ativos" d={turmaId ? undefined : `${turmas.filter((t) => !isFinalizada(t)).length} turmas ativas`} cor="#4F46E5" icone={<Users size={12} />} onClick={() => ir("todos")} />
        <Kpi n={rt.risco} l="Em risco" d="perto do limite de faltas" cor="var(--amarelo)" icone={<TrendingDown size={12} />} onClick={() => ir("risco")} />
        <Kpi n={rt.abaixo} l="Abaixo de 75%" d="passaram do limite" cor="#DC2626" icone={<AlertTriangle size={12} />} onClick={() => ir("abaixo")} />
        <Kpi n={ag.total} l="Para contatar" d="pendências de hoje" cor="var(--roxo)" icone={<Phone size={12} />} onClick={() => router.push(turmaId ? `/turmas/${turmaId}?aba=alunos` : "/agenda")} />
      </div>
      {!turmaId && ag.chamadas.length > 0 && (
        <div className="aviso info" style={{ marginBottom: 16 }}>
          <span>Chamada de hoje ainda não feita: {ag.chamadas.map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link href={`/turmas/${t.id}`}>{t.curso}</Link></span>)}</span>
        </div>
      )}
      {!escopo.length ? (
        <Empty icone={<Users size={24} />}>{turmaId ? "Esta turma ainda não tem alunos." : <>Nenhuma turma ativa ainda. Crie uma turma pelo “+” no menu ou importe a planilha em Configurações.</>}</Empty>
      ) : (
        <div className="secao">
          <div className="secao-head"><h3>Precisam de atenção ({atencao.length})</h3></div>
          <ListaAtencao itens={atencao} mostrarTurma={!turmaId} vazio="Nenhum aluno em risco ou abaixo de 75%. 🎉" />
        </div>
      )}
    </>
  );
}
