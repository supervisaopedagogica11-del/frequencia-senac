"use client";
import { useMemo, useState } from "react";
import { ClipboardCheck, MessageCircle, Phone, Send, Download, Eye } from "lucide-react";
import { useData } from "../DataProvider";
import { useUI } from "../Shell";
import { FaixaChip, StatusChip, Empty } from "../ui";
import { fmtData, fmtDataHora, normalizar, telLink, waLink, fmtPct } from "@/lib/engine";
import { FORMAS_CONTATO, FAIXA_COR } from "@/lib/constants";
import { exportarExcel } from "@/lib/exportar";

export function HistoricoContatos({ turmaId }) {
  const { turmas, contatos, linhas } = useData();
  const ui = useUI();
  const [q, setQ] = useState("");
  const [forma, setForma] = useState("");
  const [de, setDe] = useState("");
  const porKey = useMemo(() => new Map(linhas.map((l) => [l.key, l])), [linhas]);
  const itens = useMemo(() => {
    const out = [];
    for (const [k, c] of Object.entries(contatos)) {
      if (turmaId && !k.startsWith(turmaId + "|")) continue;
      const l = porKey.get(k);
      if (!l) continue;
      (c.tentativas || []).forEach((t) => out.push({ l, t }));
    }
    const nq = normalizar(q);
    return out.filter(({ l, t }) => (!nq || normalizar(l.aluno.nome + " " + l.turma.curso + " " + (t.obs || "") + " " + (t.retorno || "")).includes(nq)) && (!forma || (t.forma || t.tipo) === forma) && (!de || (t.data || "") >= de))
      .sort((a, b) => (b.t.data || "").localeCompare(a.t.data || "") || (b.t.criadoEm || "").localeCompare(a.t.criadoEm || ""));
  }, [contatos, porKey, q, forma, de, turmaId]);
  const colunas = [
    { titulo: "Data", valor: (x) => fmtData(x.t.data) }, { titulo: "Aluno", valor: (x) => x.l.aluno.nome }, { titulo: "Turma", valor: (x) => x.l.turma.curso },
    { titulo: "Forma", valor: (x) => x.t.forma || x.t.tipo }, { titulo: "Motivo", valor: (x) => x.t.motivo }, { titulo: "Resultado", valor: (x) => x.t.resultado },
    { titulo: "Retorno do aluno", valor: (x) => x.t.retorno }, { titulo: "Justificativa", valor: (x) => x.t.justificativa }, { titulo: "Encaminhamento", valor: (x) => x.t.encaminhamento },
    { titulo: "Próxima ação", valor: (x) => x.t.proximaAcao }, { titulo: "Próximo contato", valor: (x) => fmtData(x.t.proximaData) }, { titulo: "Observações", valor: (x) => x.t.obs }, { titulo: "Responsável", valor: (x) => x.t.responsavel },
  ];
  return (
    <>
      <div className="card row" style={{ marginBottom: 12, padding: 12 }}>
        <input className="input grow" placeholder="Buscar por aluno, turma ou texto..." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 200 }} />
        <select className="select" value={forma} onChange={(e) => setForma(e.target.value)}><option value="">Todas as formas</option>{FORMAS_CONTATO.map((x) => <option key={x}>{x}</option>)}</select>
        <label className="row small soft">desde <input type="date" className="input" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <button className="btn btn-ghost" onClick={() => exportarExcel({ colunas, linhas: itens, nome: "contatos_realizados", aba: "Contatos" })}><Download size={14} /> Excel</button>
      </div>
      {!itens.length ? <Empty>Nenhum contato registrado.</Empty> : (
        <div className="lista">
          {itens.slice(0, 300).map(({ l, t }, i) => (
            <div key={i} className="item" style={{ borderLeftColor: "#8B5CF6", alignItems: "flex-start" }}>
              <div className="grow">
                <div className="t"><span className="mono">{fmtData(t.data)}</span> – {t.forma || t.tipo} – <button className="link-aluno" onClick={() => ui.abrirFicha(l.turma.id, l.aluno.id)}>{l.aluno.nome}</button> <span className="soft" style={{ fontWeight: 400 }}>· {l.turma.curso}</span></div>
                <div className="s">
                  {[t.motivo && `Motivo: ${t.motivo}`, t.resultado && `Resultado: ${t.resultado}`].filter(Boolean).join(" · ")}
                  {t.retorno && <div>Retorno: {t.retorno}</div>}
                  {t.justificativa && <div>Justificativa: {t.justificativa}</div>}
                  {t.encaminhamento && <div>Encaminhamento: {t.encaminhamento}</div>}
                  {(t.proximaAcao || t.proximaData) && <div>Próximo: {t.proximaAcao} {t.proximaData ? `(${fmtData(t.proximaData)})` : ""}</div>}
                  {t.obs && <div style={{ fontStyle: "italic" }}>{t.obs}</div>}
                  <div style={{ marginTop: 2 }}>por {t.responsavel || t.criadoPor || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function EmailsEnviados({ turmaId }) {
  const { emails } = useData();
  const ui = useUI();
  const [aberto, setAberto] = useState(null);
  const lista = emails.filter((e) => !turmaId || e.turmaId === turmaId);
  const colunas = [
    { titulo: "Data/hora", valor: (e) => fmtDataHora(e.enviadoEm) }, { titulo: "Aluno", valor: (e) => e.alunoNome }, { titulo: "E-mail", valor: (e) => e.para },
    { titulo: "Turma", valor: (e) => e.turmaNome }, { titulo: "Motivo", valor: (e) => e.motivo }, { titulo: "Tipo", valor: (e) => (e.automatico ? "Automático" : "Manual") },
    { titulo: "Status", valor: (e) => (e.status === "enviado" ? "Enviado" : "Erro: " + (e.erro || "")) }, { titulo: "Responsável", valor: (e) => e.usuario }, { titulo: "Modelo", valor: (e) => e.modelo }, { titulo: "Assunto", valor: (e) => e.assunto },
  ];
  return (
    <>
      <div className="row" style={{ marginBottom: 10, justifyContent: "space-between" }}>
        <span className="small soft">{lista.length} disparo(s) · {lista.filter((e) => e.status === "erro").length} com erro</span>
        <button className="btn btn-ghost btn-sm" onClick={() => exportarExcel({ colunas, linhas: lista, nome: "emails_enviados", aba: "E-mails" })}><Download size={13} /> Excel</button>
      </div>
      {!lista.length ? <Empty>Nenhum e-mail disparado ainda.</Empty> : (
        <div className="tabela-wrap">
          <table className="tabela responsiva">
            <thead><tr><th>Data/hora</th><th>Aluno</th><th>E-mail usado</th><th>Motivo</th><th>Tipo</th><th>Status</th><th>Responsável</th><th></th></tr></thead>
            <tbody>
              {lista.slice(0, 300).map((e) => (
                <tr key={e.id}>
                  <td className="principal small">{fmtDataHora(e.enviadoEm)}</td>
                  <td data-label="Aluno"><button className="link-aluno" onClick={() => ui.abrirFicha(e.turmaId, e.alunoId)}>{e.alunoNome}</button></td>
                  <td data-label="E-mail" className="small">{e.para || "—"}</td>
                  <td data-label="Motivo" className="small">{e.motivo}</td>
                  <td data-label="Tipo"><span className="chip-out" style={{ color: e.automatico ? "#4F46E5" : "#6B7280", borderColor: e.automatico ? "#4F46E5" : "#9CA3AF" }}>{e.automatico ? "Automático" : "Manual"}</span></td>
                  <td data-label="Status">{e.status === "enviado" ? <span className="chip" style={{ background: "var(--verde)" }}>Enviado</span> : <span className="chip" style={{ background: "var(--vermelho)" }} title={e.erro}>Erro</span>}</td>
                  <td data-label="Responsável" className="small">{e.usuario}</td>
                  <td className="num"><button className="btn btn-ghost btn-sm" onClick={() => setAberto(aberto === e.id ? null : e.id)}><Eye size={12} /> {aberto === e.id ? "Fechar" : "Ver"}</button></td>
                </tr>
              )).flatMap((tr, i) => {
                const e = lista[i];
                return aberto === e.id ? [tr, (
                  <tr key={e.id + "x"}><td colSpan={8} style={{ background: "#F7F8FC" }}>
                    <div className="small"><strong>Modelo:</strong> {e.modelo} · <strong>Remetente:</strong> {e.remetente || "—"} {e.erro && <span style={{ color: "var(--vermelho)" }}>· <strong>Erro:</strong> {e.erro}</span>}</div>
                    <div className="small" style={{ marginTop: 6 }}><strong>Assunto:</strong> {e.assunto}</div>
                    <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 12.5, margin: "8px 0 0" }}>{e.corpo}</pre>
                  </td></tr>
                )] : [tr];
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

