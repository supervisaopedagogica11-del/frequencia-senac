"use client";
import "./globals.css";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { listarTurmas } from "../lib/firestoreData";
import { isAlunoAtivo } from "../lib/logic";
import ConfigurarTurmaModal from "../components/ConfigurarTurmaModal";
import { LayoutDashboard, ClipboardList, FileSpreadsheet, LogOut, Settings } from "lucide-react";

export default function RootLayout({ children }) {
  const user = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  const [turmas, setTurmas] = useState([]);
  const [carregandoTurmas, setCarregandoTurmas] = useState(true);
  const [turnoFiltro, setTurnoFiltro] = useState("Todos");
  const [statusFiltro, setStatusFiltro] = useState("Ativas");
  const [busca, setBusca] = useState("");
  const [turmaConfigurando, setTurmaConfigurando] = useState(null);

  useEffect(() => {
    if (user === null && !isLoginPage) router.replace("/login");
  }, [user, isLoginPage, router]);

  useEffect(() => {
    if (!user) return;
    carregarTurmas();
  }, [user]);

  async function carregarTurmas() {
    setCarregandoTurmas(true);
    const t = await listarTurmas();
    setTurmas(t);
    setCarregandoTurmas(false);
  }

  function irParaTurma(turmaId) {
    router.push(`/chamada?turma=${turmaId}`);
  }

  const buscaAtiva = busca.trim().length > 0;
  const q = busca.trim().toLowerCase();
  const turmasEncontradas = buscaAtiva ? turmas.filter((t) => t.curso.toLowerCase().includes(q) || (t.codigo || "").toLowerCase().includes(q)) : [];
  const alunosEncontrados = buscaAtiva ? turmas.flatMap((t) => (t.alunos || []).filter((a) => a.nome.toLowerCase().includes(q)).map((a) => ({ turma: t, aluno: a }))) : [];

  const turmasFiltradas = turmas.filter((t) => {
    if (turnoFiltro !== "Todos" && t.turno !== turnoFiltro) return false;
    if (statusFiltro === "Ativas" && t.periodoRealFim) return false;
    if (statusFiltro === "Finalizadas" && !t.periodoRealFim) return false;
    return true;
  });

  return (
    <html lang="pt-BR">
      <body>
        {isLoginPage || user === undefined || user === null ? (
          children
        ) : (
          <div className="app-shell">
            <aside className="sidebar">
              <div className="brand">
                <h1>Senac Três Corações</h1>
                <p>Acompanhamento de frequência</p>
              </div>

              <nav>
                <a href="/painel" className={pathname === "/painel" ? "active" : ""}><LayoutDashboard size={15} /> Painel</a>
                <a href="/chamada" className={pathname === "/chamada" ? "active" : ""}><ClipboardList size={15} /> Chamada</a>
                <a href="/importar" className={pathname === "/importar" ? "active" : ""}><FileSpreadsheet size={15} /> Importar</a>
              </nav>

              <div className="turnos">
                {["Todos", "Manhã", "Tarde", "Noite"].map((tn) => (
                  <div key={tn} className={"turno-pill" + (turnoFiltro === tn ? " active" : "")} onClick={() => setTurnoFiltro(tn)}>{tn}</div>
                ))}
              </div>

              <div className="search">
                <input placeholder="Buscar turma ou aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>

              {!buscaAtiva && (
                <div className="turnos" style={{ paddingTop: 0 }}>
                  {["Ativas", "Finalizadas", "Todas"].map((s) => (
                    <div key={s} className={"turno-pill" + (statusFiltro === s ? " active" : "")} onClick={() => setStatusFiltro(s)}>{s}</div>
                  ))}
                </div>
              )}

              <div className="turma-list">
                {carregandoTurmas ? (
                  <div style={{ fontSize: 12, color: "#B9AEDD", padding: "10px 8px" }}>Carregando turmas...</div>
                ) : buscaAtiva ? (
                  <>
                    {!turmasEncontradas.length && !alunosEncontrados.length && (
                      <div style={{ fontSize: 12, color: "#B9AEDD", padding: "10px 8px" }}>Nenhum resultado para "{busca}".</div>
                    )}
                    {turmasEncontradas.length > 0 && (
                      <>
                        <div className="turma-list-label">Turmas ({turmasEncontradas.length})</div>
                        {turmasEncontradas.map((t) => (
                          <div key={t.id} className="turma-item" onClick={() => { irParaTurma(t.id); setBusca(""); }}>
                            <span className="dot" style={{ background: t.periodoRealFim ? "#9CA3AF" : "#10B981" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div>{t.curso}</div>
                              <div className="sub">{t.codigo || "sem código"} {t.periodoRealFim ? "· Finalizada" : "· Ativa"}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    {alunosEncontrados.length > 0 && (
                      <>
                        <div className="turma-list-label">Alunos ({alunosEncontrados.length})</div>
                        {alunosEncontrados.map((r, i) => (
                          <div key={i} className="turma-item" onClick={() => { irParaTurma(r.turma.id); setBusca(""); }}>
                            <span className="dot" style={{ background: isAlunoAtivo(r.aluno) ? "#10B981" : "#9CA3AF" }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div>{r.aluno.nome}</div>
                              <div className="sub">{r.turma.curso}</div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {!turmas.length && <div style={{ fontSize: 12, color: "#B9AEDD", padding: "10px 8px" }}>Nenhuma turma importada ainda.</div>}
                    {turmas.length > 0 && !turmasFiltradas.length && <div style={{ fontSize: 12, color: "#B9AEDD", padding: "10px 8px" }}>Nenhuma turma neste filtro.</div>}
                    {turmasFiltradas.map((t) => {
                      const ativos = (t.alunos || []).filter(isAlunoAtivo);
                      return (
                        <div key={t.id} className="turma-item" onClick={() => irParaTurma(t.id)}>
                          <span className="dot" style={{ background: t.periodoRealFim ? "#9CA3AF" : "#10B981" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.curso}</div>
                            <div className="sub">{t.turno} · {ativos.length} alunos{ativos.length !== (t.alunos || []).length ? ` (${(t.alunos || []).length - ativos.length} inativos)` : ""}</div>
                          </div>
                          <Settings size={14} className="gear" onClick={(e) => { e.stopPropagation(); setTurmaConfigurando(t); }} />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <button className="logout" onClick={() => signOut(auth)}><LogOut size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />Sair</button>
            </aside>
            <main className="main">{children}</main>

            {turmaConfigurando && (
              <ConfigurarTurmaModal
                turma={turmaConfigurando}
                onClose={() => setTurmaConfigurando(null)}
                onSalvo={() => { setTurmaConfigurando(null); carregarTurmas(); }}
                onExcluido={() => { setTurmaConfigurando(null); carregarTurmas(); }}
              />
            )}
          </div>
        )}
      </body>
    </html>
  );
}
