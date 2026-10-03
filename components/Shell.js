"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarClock, ShieldAlert, ClipboardList, Phone, FileSpreadsheet, FileBarChart, Settings, Plus, LogOut, Menu, X,
} from "lucide-react";
import { useData } from "./DataProvider";
import { isFinalizada, normalizar } from "@/lib/engine";
import { TIER_COR } from "@/lib/constants";
import { montarAgenda } from "@/lib/pendencias";
import { FichaAluno, TurmaConfigModal, NovaTurmaModal, EmailModal, AlunoModal } from "./Modais";

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);
const ORDEM_TIER = { vermelho: 0, roxo: 1, amarelo: 2, verde: 3 };

export default function Shell({ children }) {
  const { turmas, linhas, alertas, freq, cfg, hoje, usuario, pode, acoes } = useData();
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [turno, setTurno] = useState("Todos");
  const [statusTurma, setStatusTurma] = useState("Todas");
  const [modal, setModal] = useState(null);

  useEffect(() => { setMenuAberto(false); }, [pathname]);

  const ui = useMemo(() => ({
    abrirFicha: (turmaId, alunoId) => setModal({ tipo: "ficha", turmaId, alunoId }),
    abrirConfigTurma: (turmaId) => setModal({ tipo: "config", turmaId }),
    abrirNovaTurma: () => setModal({ tipo: "novaTurma" }),
    abrirEmail: (turmaId, alunoId, extra) => setModal({ tipo: "email", turmaId, alunoId, ...extra }),
    abrirAluno: (turmaId, alunoId) => setModal({ tipo: "aluno", turmaId, alunoId }),
    fechar: () => setModal(null),
  }), []);
  // "Registrar acompanhamento": cria a tentativa e leva para Contato com alunos
  ui.abrirContato = async (turmaId, alunoId) => {
    const t = turmas.find((x) => x.id === turmaId);
    const a = t?.alunos.find((x) => x.id === alunoId);
    if (!t || !a) return;
    await acoes.adicionarTentativa(t, a);
    setModal(null);
    router.push(`/contatos#c-${turmaId}-${alunoId}`);
  };

  const agenda = useMemo(() => montarAgenda({ turmas, linhas, alertas, freq, cfg, hoje }), [turmas, linhas, alertas, freq, cfg, hoje]);

  const turmasFiltradas = turmas.filter((t) => {
    if (turno !== "Todos" && t.turno !== turno) return false;
    if (statusTurma === "Ativas" && isFinalizada(t)) return false;
    if (statusTurma === "Finalizadas" && !isFinalizada(t)) return false;
    return true;
  });
  const porTipo = { Tecnico: turmasFiltradas.filter((t) => t.tipo === "Tecnico"), FIC: turmasFiltradas.filter((t) => t.tipo === "FIC"), Indef: turmasFiltradas.filter((t) => !t.tipo) };
  const piorTier = useMemo(() => {
    const m = {};
    for (const t of turmas) {
      let pior = "verde";
      linhas.forEach((l) => { if (l.turma.id === t.id && l.ativo && ORDEM_TIER[l.st.tier] < ORDEM_TIER[pior]) pior = l.st.tier; });
      m[t.id] = pior;
    }
    return m;
  }, [turmas, linhas]);

  const resultado = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return null;
    const ts = turmas.filter((t) => [t.curso, t.codigo, t.instrutor].some((x) => normalizar(x).includes(q)));
    const as = [];
    turmas.forEach((t) => t.alunos.forEach((a) => { if ([a.nome, a.email, a.matricula].some((x) => normalizar(x).includes(q))) as.push({ t, a }); }));
    return { ts, as: as.slice(0, 40) };
  }, [busca, turmas]);

  const turmaAtualId = pathname.startsWith("/turmas/") ? pathname.split("/")[2] : null;
  const ativo = (href) => pathname === href || pathname.startsWith(href + "/");
  const NavLink = ({ href, icon: Icon, children, badge }) => (
    <Link href={href} className={ativo(href) ? "active" : ""}><Icon size={15} />{children}{badge ? <span className="badge">{badge}</span> : null}</Link>
  );
  const ItemTurma = ({ t }) => {
    const ativos = t.alunos.filter((a) => (a.situacao || "Ativo") === "Ativo" && !["Evadido", "Concluído"].includes(a.statusAcomp));
    return (
      <Link href={`/turmas/${t.id}`} className={"turma-item" + (turmaAtualId === t.id ? " active" : "")} style={{ marginLeft: 0 }}>
        <span className="dot" style={{ background: isFinalizada(t) ? "#9CA3AF" : TIER_COR[piorTier[t.id]] }} />
        <div className="grow">
          <div className="ellipsis">{t.curso}{isFinalizada(t) ? " 🏁" : ""}</div>
          <div className="sub">{t.turno} · {ativos.length} alunos{ativos.length !== t.alunos.length ? ` (${t.alunos.length - ativos.length} inativos)` : ""}</div>
        </div>
        {pode("turmaConfig") && <button className="gear" title="Configurar turma" onClick={(e) => { e.preventDefault(); e.stopPropagation(); ui.abrirConfigTurma(t.id); }}><Settings size={13} /></button>}
      </Link>
    );
  };
  const tituloTopo = turmaAtualId ? turmas.find((t) => t.id === turmaAtualId)?.curso : { "/painel": "Painel", "/agenda": "Agenda do dia", "/permanencia": "Gestão de Permanência", "/chamada": "Chamada", "/contatos": "Contato com alunos", "/importar": "Importar", "/relatorios": "Relatórios", "/configuracoes": "Configurações" }[pathname];

  return (
    <UICtx.Provider value={{ ...ui, agenda }}>
      <div className="app">
        <div className="topbar">
          <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu size={18} /></button>
          <div className="t">{tituloTopo || cfg.instituicao}</div>
        </div>
        {menuAberto && <div className="side-overlay" onClick={() => setMenuAberto(false)} />}

        <aside className={"sidebar" + (menuAberto ? " aberta" : "")}>
          <div className="brand">
            <div><h1>{cfg.instituicao}</h1><p>Acompanhamento de frequência</p></div>
            {menuAberto && <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }} onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><X size={18} /></button>}
          </div>
          <div className="side-scroll">
            <div className="pills-side">
              {["Todos", "Manhã", "Tarde", "Noite"].map((tn) => (
                <button key={tn} className={`pill-side ${{ Todos: "tp-todos", "Manhã": "tp-manha", Tarde: "tp-tarde", Noite: "tp-noite" }[tn]}` + (turno === tn ? " active" : "")} onClick={() => setTurno(tn)}>{tn}</button>
              ))}
            </div>
            <div className="side-search" style={{ paddingTop: 6 }}>
              <input id="busca-global" style={{ paddingLeft: 10 }} placeholder="Buscar turma ou aluno..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {!busca && (
              <div className="pills-side" style={{ paddingTop: 2 }}>
                {["Todas", "Ativas", "Finalizadas"].map((s) => <button key={s} className={"pill-side" + (statusTurma === s ? " active tp-todos" : "")} onClick={() => setStatusTurma(s)}>{s}</button>)}
              </div>
            )}
            <nav className="nav" style={{ borderBottom: "1px solid rgba(255,255,255,0.14)", paddingBottom: 10 }}>
              <NavLink href="/painel" icon={LayoutDashboard}>Painel</NavLink>
              <NavLink href="/agenda" icon={CalendarClock} badge={agenda.total || null}>Agenda do dia</NavLink>
              <NavLink href="/permanencia" icon={ShieldAlert}>Gestão de Permanência</NavLink>
              <NavLink href="/chamada" icon={ClipboardList}>Chamada</NavLink>
              <NavLink href="/contatos" icon={Phone} badge={agenda.paraContato.length || null}>Contato com alunos</NavLink>
              {pode("importar") && <NavLink href="/importar" icon={FileSpreadsheet}>Importar</NavLink>}
              <NavLink href="/relatorios" icon={FileBarChart}>Relatórios</NavLink>
              <NavLink href="/configuracoes" icon={Settings}>Configurações</NavLink>
            </nav>
            <div className="nav" style={{ paddingTop: 4 }}>
              {resultado ? (
                <>
                  {!resultado.ts.length && !resultado.as.length && <div className="small" style={{ color: "#B9AEDD", padding: 8 }}>Nenhum resultado para “{busca}”.</div>}
                  {resultado.ts.length > 0 && <div className="tipo-label">Turmas ({resultado.ts.length})</div>}
                  {resultado.ts.map((t) => (
                    <Link key={t.id} href={`/turmas/${t.id}`} className="turma-item" style={{ marginLeft: 0 }} onClick={() => setBusca("")}>
                      <span className="dot" style={{ background: isFinalizada(t) ? "#9CA3AF" : "#10B981" }} />
                      <div className="grow"><div className="ellipsis">{t.curso}</div><div className="sub">{t.codigo || "sem código"} · {isFinalizada(t) ? "Finalizada" : "Ativa"}</div></div>
                    </Link>
                  ))}
                  {resultado.as.length > 0 && <div className="tipo-label">Alunos ({resultado.as.length})</div>}
                  {resultado.as.map(({ t, a }) => (
                    <button key={t.id + a.id} className="turma-item" style={{ marginLeft: 0, border: "none", background: "none", width: "100%", textAlign: "left" }} onClick={() => { ui.abrirFicha(t.id, a.id); setBusca(""); }}>
                      <span className="dot" style={{ background: (a.situacao || "Ativo") === "Ativo" ? "#10B981" : "#9CA3AF" }} />
                      <div className="grow"><div className="ellipsis">{a.nome}</div><div className="sub ellipsis">{t.curso}{a.situacao && a.situacao !== "Ativo" ? ` · ${a.situacao}` : ""}</div></div>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {[["Tecnico", "Técnicos"], ["FIC", "FIC"], ["Indef", "Sem tipo definido"]].map(([k, label]) => porTipo[k].length ? (
                    <div key={k}>
                      <div className="tipo-label">{label} ({porTipo[k].length})</div>
                      {porTipo[k].map((t) => <ItemTurma key={t.id} t={t} />)}
                    </div>
                  ) : null)}
                  {!turmas.length && <div className="small" style={{ color: "#B9AEDD", padding: "10px 8px" }}>Nenhuma turma importada ainda.</div>}
                  {turmas.length > 0 && !turmasFiltradas.length && <div className="small" style={{ color: "#B9AEDD", padding: "10px 8px" }}>Nenhuma turma neste filtro.</div>}
                  {pode("turmaConfig") && <button className="turma-item" style={{ marginLeft: 0, border: "1px dashed rgba(255,255,255,0.25)", background: "none", width: "100%", marginTop: 6, justifyContent: "center" }} onClick={() => ui.abrirNovaTurma()}><Plus size={13} /> Nova turma</button>}
                </>
              )}
            </div>
          </div>
          <div className="side-footer">
            <div className="avatar">{(usuario?.nome || usuario?.email || "?")[0].toUpperCase()}</div>
            <div className="grow">
              <div className="ellipsis" style={{ fontWeight: 700, color: "#fff" }}>{usuario?.nome || usuario?.email}</div>
              <div className="ellipsis" style={{ fontSize: 11, color: "#C7C2F0" }}>{usuario?.perfil}</div>
            </div>
            <button onClick={acoes.sair} title="Sair"><LogOut size={15} /></button>
          </div>
        </aside>

        <main className="main">{children}</main>

        <nav className="bottom-nav">
          <Link href="/painel" className={ativo("/painel") ? "active" : ""}><LayoutDashboard size={19} />Painel</Link>
          <Link href="/agenda" className={ativo("/agenda") ? "active" : ""}><CalendarClock size={19} />Agenda{agenda.total ? <span className="badge">{agenda.total}</span> : null}</Link>
          <Link href="/chamada" className={ativo("/chamada") || !!turmaAtualId ? "active" : ""}><ClipboardList size={19} />Chamada</Link>
          <Link href="/contatos" className={ativo("/contatos") ? "active" : ""}><Phone size={19} />Contato{agenda.paraContato.length ? <span className="badge">{agenda.paraContato.length}</span> : null}</Link>
          <button onClick={() => setMenuAberto(true)}><Menu size={19} />Turmas</button>
        </nav>
      </div>

      {modal?.tipo === "ficha" && <FichaAluno {...modal} />}
      {modal?.tipo === "config" && <TurmaConfigModal {...modal} />}
      {modal?.tipo === "novaTurma" && <NovaTurmaModal {...modal} onCriada={(t) => router.push(`/turmas/${t.id}`)} />}
      {modal?.tipo === "email" && <EmailModal {...modal} />}
      {modal?.tipo === "aluno" && <AlunoModal {...modal} />}
    </UICtx.Provider>
  );
}
