// Exportação de relatórios: CSV, Excel (.xlsx) e PDF
import { fmtData, fmtDataHora, fmtPct, fmtHoras } from "./engine";
import { FAIXA_LABEL } from "./constants";

const nomeArquivo = (s) => String(s || "relatorio").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\-]+/g, "_").slice(0, 80);
const valor = (v) => (v === null || v === undefined ? "" : v);

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// colunas: [{ titulo, valor: (linha) => any }]
export function exportarCSV({ colunas, linhas, nome }) {
  const esc = (v) => { const s = String(valor(v)); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const txt = [colunas.map((c) => esc(c.titulo)).join(";"), ...linhas.map((l) => colunas.map((c) => esc(c.valor(l))).join(";"))].join("\r\n");
  baixar(new Blob(["﻿" + txt], { type: "text/csv;charset=utf-8" }), `${nomeArquivo(nome)}.csv`);
}

export async function exportarExcel({ colunas, linhas, nome, aba }) {
  const XLSX = await import("xlsx");
  const dados = linhas.map((l) => Object.fromEntries(colunas.map((c) => [c.titulo, valor(c.valor(l))])));
  const ws = XLSX.utils.json_to_sheet(dados);
  ws["!cols"] = colunas.map((c) => ({ wch: Math.min(50, Math.max(10, c.titulo.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, String(aba || "Relatório").replace(/[:\\/?*[\]]/g, "-").slice(0, 31));
  XLSX.writeFile(wb, `${nomeArquivo(nome)}.xlsx`);
}

async function novoPDF(orientacao = "landscape") {
  const { jsPDF } = await import("jspdf");
  const mod = await import("jspdf-autotable");
  const fn = [mod.default, mod.default?.default, mod.autoTable].find((f) => typeof f === "function");
  const autoTable = fn || ((doc, opts) => { mod.applyPlugin(jsPDF); return doc.autoTable(opts); });
  const pdf = new jsPDF({ orientation: orientacao, unit: "pt", format: "a4" });
  return { pdf, autoTable };
}
function cabecalho(pdf, titulo, subtitulo, instituicao) {
  const w = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(79, 70, 229); pdf.rect(0, 0, w, 6, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.setTextColor(30, 39, 51);
  pdf.text(titulo, 40, 38);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(107, 118, 134);
  const sub = pdf.splitTextToSize(`${instituicao || "Senac Três Corações"} · ${subtitulo || ""} · Emitido em ${new Date().toLocaleString("pt-BR")}`, w - 80);
  pdf.text(sub, 40, 54);
  return 54 + sub.length * 11 + 6;
}
function rodape(pdf) {
  const n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8); pdf.setTextColor(150);
    pdf.text(`Página ${i} de ${n}`, pdf.internal.pageSize.getWidth() - 40, pdf.internal.pageSize.getHeight() - 18, { align: "right" });
  }
}

export async function exportarPDF({ titulo, subtitulo, colunas, linhas, nome, orientacao, instituicao, resumo }) {
  const { pdf, autoTable } = await novoPDF(orientacao || (colunas.length > 6 ? "landscape" : "portrait"));
  let y = cabecalho(pdf, titulo, subtitulo, instituicao);
  if (resumo) {
    pdf.setFontSize(9.5); pdf.setTextColor(30, 39, 51); pdf.setFont("helvetica", "bold");
    const t = pdf.splitTextToSize(resumo, pdf.internal.pageSize.getWidth() - 80);
    pdf.text(t, 40, y); y += t.length * 12 + 4;
  }
  autoTable(pdf, {
    startY: y,
    head: [colunas.map((c) => c.titulo)],
    body: linhas.length ? linhas.map((l) => colunas.map((c) => String(valor(c.valor(l))))) : [[{ content: "Nenhum registro encontrado.", colSpan: colunas.length }]],
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 248, 252] },
    margin: { left: 40, right: 40 },
  });
  rodape(pdf);
  pdf.save(`${nomeArquivo(nome || titulo)}.pdf`);
}

// Relatório individual do aluno (ficha)
export async function exportarFichaPDF({ turma, aluno, linha, contato, historico, cfg }) {
  const { pdf, autoTable } = await novoPDF("portrait");
  const r = linha.r;
  let y = cabecalho(pdf, `Relatório individual — ${aluno.nome}`, `${turma.curso} · ${turma.codigo || "sem código"} · ${turma.turno} · Docente: ${turma.instrutor || "—"}`, cfg?.instituicao);
  autoTable(pdf, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [245, 243, 255], cellWidth: 190 } },
    body: [
      ["Situação do aluno", linha.status],
      ["E-mail / Telefone", `${aluno.email || "—"} / ${aluno.telefone || "—"}`],
      ["Frequência atual", `${fmtPct(r.pct)}  (${FAIXA_LABEL[r.faixa]})`],
      ["Horas de falta", r.limiteHoras !== null ? `${fmtHoras(r.horasFalta)} de ${fmtHoras(r.limiteHoras)} permitidas (25% de ${r.cargaHoraria}h)` : fmtHoras(r.horasFalta)],
      ["Ainda pode faltar", fmtHoras(r.horasRestantes)],
      ["Dias de falta inteira / dias com falta parcial", `${r.diasFalta} / ${r.diasParcial}`],
      ["Faltas seguidas (atual)", String(r.consecutivas)],
      ["Aulas registradas", `${r.aulas} (${r.horasDadas}h)`],
      ["Observação", r.motivo || "—"],
      ["Observações da Supervisão", contato?.observacoes || "—"],
    ],
    margin: { left: 40, right: 40 },
  });
  y = pdf.lastAutoTable.finalY + 18;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(30, 39, 51);
  pdf.text("Histórico de acompanhamento", 40, y);
  autoTable(pdf, {
    startY: y + 8,
    head: [["Quando", "Registro", "Responsável"]],
    body: (historico || []).length ? historico.map((h) => [h.hora ? fmtDataHora(h.em) : fmtData((h.em || "").slice(0, 10)), [h.titulo, ...(h.texto || [])].join("\n"), h.quem || ""]) : [["", "Nenhum registro.", ""]],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [79, 70, 229] },
    columnStyles: { 0: { cellWidth: 90 }, 2: { cellWidth: 110 } },
    margin: { left: 40, right: 40 },
  });
  rodape(pdf);
  pdf.save(`${nomeArquivo("relatorio_" + aluno.nome)}.pdf`);
}
