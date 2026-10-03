"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CalendarClock, ShieldAlert, ClipboardList, Phone, FileBarChart, Users, Settings, FileSpreadsheet,
  Search, Sun, CloudSun, Moon, Flag, ChevronDown, ChevronRight, Plus, LogOut, Menu, X, GraduationCap, Mail,
} from "lucide-react";
import { useData } from "./DataProvider";
import { isFinalizada, normalizar, piorFaixa } from "@/lib/engine";
import { FAIXA_COR, tipoLabel } from "@/lib/constants";
import { montarAgenda } from "@/lib/pendencias";
import { FichaAluno, ContatoModal, TurmaConfigModal, NovaTurmaModal, EmailModal, AlunoModal } from "./Modais";

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

const TURNO_ICON = { "Manhã": Sun, "Tarde": CloudSun, "Noite": Moon };

export default function Shell({ children }) {
  const data = useData();
  const { turmas, linhas, alertas, contatos, freq, cfg, hoje, usuario, pode, acoes } = data;
  const pathname = usePathname();
  const router = useRouter();
  const [menuAberto, setMenuAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState({ "Manhã": true, "Tarde": true, "Noite": true, "Outros": true, Finalizadas: false });
  const [modal, setModal] = useState(null); // {tipo, ...}

  useEffect(() => { setMenuAberto(false); }, [pathname]);
  useEffect(() => { try { const s = localStorage.getItem("menuTurnos"); if (s) setAbertos((a) => ({ ...a, ...JSON.parse(s) })); } catch {} }, []);
  const alternar = (k) => setAbertos((a) => { const n = { ...a, [k]: !a[k] }; try { localStorage.setItem("menuTurnos", JSON.stringify(n)); } catch {} return n; });

  const ui = useMemo(() => ({
    abrirFicha: (turmaId, alunoId) => setModal({ tipo: "ficha", turmaId, alunoId }),
    abrirContato: (turmaId, alunoId, extra) => setModal({ tipo: "contato", turmaId, alunoId, ...extra }),
    abrirConfigTurma: (turmaId) => setModal({ tipo: "config", turmaId }),
    abrirNovaTurma: (turno) => setModal({ tipo: "novaTurma", turno }),
    abrirEmail: (turmaId, alunoId, extra) => setModal({ tipo: "email", turmaId, alunoId, ...extra }),
    abrirAluno: (turmaId, alunoId) => setModal({ tipo: "aluno", turmaId, alunoId }),
    fechar: () => setModal(null),
  }), []);

  const agenda = useMemo(() => montarAgenda({ turmas, linhas, alertas, contatos, freq, cfg, hoje }), [turmas, linhas, alertas, contatos, freq, cfg, hoje]);
  const precisamContato = agenda.consecutivas.length + agenda.necessitaContato.length + agenda.limite.filter((x) => ["critico", "abaixo"].includes(x.linha.r.faixa)).length;

  // faixa mais grave por turma (indicador no menu)
  const piorPorTurma = useMemo(() => {
    const m = {};
    for (const t of turmas) m[t.id] = piorFaixa(linhas.filter((l) => l.turma.id === t.id && l.ativo).map((l) => l.r.faixa));
    return m;
  }, [turmas, linhas]);

  const grupos = useMemo(() => {
    const g = { "Manhã": [], "Tarde": [], "Noite": [], "Outros": [], Finalizadas: [] };
    turmas.forEach((t) => {
      if (isFinalizada(t)) g.Finalizadas.push(t);
      else (g[t.turno] || g.Outros).push(t);
    });
    g.Finalizadas.sort((a, b) => (b.periodoRealFim || "").localeCompare(a.periodoRealFim || ""));
    return g;
  }, [turmas]);

  const resultado = useMemo(() => {
    const q = normalizar(busca.trim());
    if (q.length < 2) return null;
    const ts = turmas.filter((t) => [t.curso, t.codigo, t.instrutor].some((x) => normalizar(x).includes(q))).slice(0, 12);
    const as = [];
    for (const t of turmas) for (const a of t.alunos) {
      if ([a.nome, a.email, a.matricula, a.telefone].some((x) => normalizar(x).includes(q))) as.push({ t, a });
      if (as.length >= 25) break;
    }
    return { ts, as };
  }, [busca, turmas]);

  const turmaAtualId = pathname.startsWith("/turmas/") ? pathname.split("/")[2] : null;
  const ativo = (href) => pathname === href || (href !== "/painel" && pathname.startsWith(href + "/"));
  const iniciais = (usuario?.nome || usuario?.email || "?").split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

  const NavLink = ({ href, icon: Icon, children, badge }) => (
    <Link href={href} className={ativo(href) ? "active" : ""}><Icon size={16} />{children}{badge ? <span className="badge">{badge}</span> : null}</Link>
  );

  const TurmaItem = ({ t }) => {
    const fin = isFinalizada(t);
    const nAtivos = t.alunos.filter((a) => !["Evadido", "Concluído"].includes(a.statusAcomp)).length;
    return (
      <Link href={`/turmas/${t.id}`} className={"turma-item" + (turmaAtualId === t.id ? " active" : "")} title={`${t.curso} — ${t.codigo || "sem código"}`}>
        <span className="dot" style={{ background: fin ? "#9CA3AF" : FAIXA_COR[piorPorTurma[t.id]] || "#10B981" }} />
        <div className="grow">
          <div className="ellipsis">{t.curso}</div>
          <div className="sub ellipsis">{t.codigo || "sem código"} · {nAtivos} alunos · {tipoLabel(t.tipo)}</div>
        </div>
        {fin ? <Flag size={12} color="#B9AEDD" /> : null}
        {pode("turmaConfig") && (
          <button className="gear" title="Configurações da turma" onClick={(e) => { e.preventDefault(); e.stopPropagation(); ui.abrirConfigTurma(t.id); }}><Settings size={13} /></button>
        )}
      </Link>
    );
  };

  const Grupo = ({ nome, lista, Icon }) => {
    if (nome === "Outros" && !lista.length) return null;
    return (
      <div className="turno-grupo">
        <button className="turno-head" onClick={() => alternar(nome)}>
          {abertos[nome] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {Icon && <Icon size={14} />} {nome === "Finalizadas" ? "Turmas Finalizadas" : nome}
          <span className="cont">{lista.length}</span>
        </button>
        {abertos[nome] && (lista.length ? lista.map((t) => <TurmaItem key={t.id} t={t} />) : <div className="small" style={{ color: "#B9AEDD", padding: "2px 0 6px 34px" }}>Nenhuma turma</div>)}
      </div>
    );
  };

  const tituloTopo = turmaAtualId ? turmas.find((t) => t.id === turmaAtualId)?.curso : {
    "/painel": "Painel Geral", "/agenda": "Agenda", "/permanencia": "Gestão de Permanência", "/frequencia": "Frequência", "/contatos": "Contatos",
    "/relatorios": "Relatórios", "/usuarios": "Usuários/Equipe", "/configuracoes": "Configurações", "/importar": "Importar",
  }[pathname];

  return (
    <UICtx.Provider value={{ ...ui, agenda }}>
      <div className="app">
        <div className="topbar">
          <button onClick={() => setMenuAberto(true)} aria-label="Abrir menu"><Menu size={18} /></button>
          <div className="t">{tituloTopo || "Senac Três Corações"}</div>
          <button onClick={() => { setMenuAberto(true); setTimeout(() => document.getElementById("busca-global")?.focus(), 250); }} aria-label="Buscar"><Search size={18} /></button>
        </div>
        {menuAberto && <div className="side-overlay" onClick={() => setMenuAberto(false)} />}

        <aside className={"sidebar" + (menuAberto ? " aberta" : "")}>
          <div className="brand">
            <div><h1>{cfg.instituicao || "Senac Três Corações"}</h1><p>Frequência · Permanência · Evasão</p></div>
            <button className="btn-icon" style={{ background: "none", border: "none", color: "#fff", display: menuAberto ? "flex" : "none", cursor: "pointer" }} onClick={() => setMenuAberto(false)} aria-label="Fechar menu"><X size={18} /></button>
          </div>
          <div className="side-search">
            <Search size={14} />
            <input id="busca-global" placeholder="Buscar aluno, turma, código, docente, e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="side-scroll">
            {resultado ? (
              <div className="nav">
                {!resultado.ts.length && !resultado.as.length && <div className="small" style={{ color: "#B9AEDD", padding: 8 }}>Nada encontrado para “{busca}”.</div>}
                {resultado.ts.length > 0 && <div className="nav-label">Turmas ({resultado.ts.length})</div>}
                {resultado.ts.map((t) => (
                  <Link key={t.id} href={`/turmas/${t.id}`} className="turma-item" style={{ marginLeft: 0 }} onClick={() => setBusca("")}>
                    <span className="dot" style={{ background: isFinalizada(t) ? "#9CA3AF" : "#10B981" }} />
                    <div className="grow"><div className="ellipsis">{t.curso}</div><div className="sub ellipsis">{t.codigo || "sem código"} · {t.turno} · {t.instrutor || "sem docente"} {isFinalizada(t) ? "· Finalizada" : ""}</div></div>
                  </Link>
                ))}
                {resultado.as.length > 0 && <div className="nav-label">Alunos ({resultado.as.length})</div>}
                {resultado.as.map(({ t, a }) => (
                  <button key={t.id + a.id} className="turma-item" style={{ marginLeft: 0, border: "none", background: "none", width: "100%", textAlign: "left" }} onClick={() => { ui.abrirFicha(t.id, a.id); setBusca(""); }}>
                    <GraduationCap size={14} color="#B9AEDD" />
                    <div className="grow"><div className="ellipsis">{a.nome}</div><div className="sub ellipsis">{t.curso}{a.email ? ` · ${a.email}` : ""}</div></div>
                  </button>
                ))}
              </div>
            ) : (
              <>
                <nav className="nav">
                  <NavLink href="/painel" icon={LayoutDashboard}>Painel Geral</NavLink>
                  <NavLink href="/agenda" icon={CalendarClock} badge={agenda.total || null}>Agenda</NavLink>
                  <NavLink href="/permanencia" icon={ShieldAlert}>Gestão de Permanência</NavLink>
                  <NavLink href="/frequencia" icon={ClipboardList}>Frequência/Chamadas</NavLink>
                  <NavLink href="/contatos" icon={Phone} badge={precisamContato || null}>Contatos</NavLink>
                  <NavLink href="/relatorios" icon={FileBarChart}>Relatórios</NavLink>
                </nav>
                <div className="nav" style={{ paddingTop: 0 }}>
                  <div className="nav-label">
                    <span>Turmas</span>
                    {pode("turmaConfig") && <button title="Nova turma" onClick={() => ui.abrirNovaTurma()} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 6, padding: 3, cursor: "pointer", display: "flex" }}><Plus size={13} /></button>}
                  </div>
                  {["Manhã", "Tarde", "Noite"].map((tn) => <Grupo key={tn} nome={tn} lista={grupos[tn]} Icon={TURNO_ICON[tn]} />)}
                  <Grupo nome="Outros" lista={grupos.Outros} />
                  <Grupo nome="Finalizadas" lista={grupos.Finalizadas} Icon={Flag} />
                  {!turmas.length && <div className="small" style={{ color: "#B9AEDD", padding: "4px 10px" }}>Nenhuma turma ainda — importe a planilha ou crie uma turma.</div>}
                </div>
                <nav className="nav" style={{ borderTop: "1px solid rgba(255,255,255,0.14)", marginTop: 6 }}>
                  {pode("importar") && <NavLink href="/importar" icon={FileSpreadsheet}>Importar planilha</NavLink>}
                  <NavLink href="/usuarios" icon={Users}>Usuários/Equipe</NavLink>
                  <NavLink href="/configuracoes" icon={Settings}>Configurações</NavLink>
                </nav>
              </>
            )}
          </div>
          <div className="side-footer">
            <div className="avatar">{iniciais}</div>
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
          <Link href="/frequencia" className={ativo("/frequencia") ? "active" : ""}><ClipboardList size={19} />Frequência</Link>
          <Link href="/contatos" className={ativo("/contatos") ? "active" : ""}><Phone size={19} />Contatos{precisamContato ? <span className="badge">{precisamContato}</span> : null}</Link>
          <button onClick={() => setMenuAberto(true)}><Menu size={19} />Turmas</button>
        </nav>
      </div>

      {modal?.tipo === "ficha" && <FichaAluno {...modal} />}
      {modal?.tipo === "contato" && <ContatoModal {...modal} />}
      {modal?.tipo === "config" && <TurmaConfigModal {...modal} />}
      {modal?.tipo === "novaTurma" && <NovaTurmaModal {...modal} onCriada={(t) => router.push(`/turmas/${t.id}`)} />}
      {modal?.tipo === "email" && <EmailModal {...modal} />}
      {modal?.tipo === "aluno" && <AlunoModal {...modal} />}
    </UICtx.Provider>
  );
}
