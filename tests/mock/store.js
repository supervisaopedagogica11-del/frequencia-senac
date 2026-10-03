// Banco em memória (persistido em localStorage) usado SOMENTE para testes locais da interface.
const KEY = "mockdb_v1";
const listeners = new Set();
let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!db) { db = {}; seed(db); save(); }
  return db;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} listeners.forEach((f) => f()); }
export function getStore() { return load(); }
export function subscribe(f) { listeners.add(f); return () => listeners.delete(f); }
export const uid = () => Math.random().toString(36).slice(2, 12);

function seed(d) {
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const nomes = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Eduarda Melo", "Felipe Costa", "Gabriela Reis", "Henrique Alves", "Isabela Nunes", "João Pedro Silva", "Karina Faria", "Lucas Pinto", "Mariana Teles", "Nicolas Prado"];
  const mk = (id, curso, codigo, turno, tipo, ch, extra = {}) => ({ id, curso, codigo, turno, tipo, cargaHoraria: ch, horariosPorDia: 4, instrutor: "Prof. Marcos", periodoInicio: "2026-08-03", periodoFim: "2026-12-18", periodoRealFim: null, horarioInicio: turno === "Manhã" ? "08:00" : turno === "Tarde" ? "13:30" : "19:00", horarioFim: turno === "Manhã" ? "12:00" : turno === "Tarde" ? "17:30" : "22:30",
    alunos: nomes.map((n, i) => ({ id: `${id}-a${i}`, nome: n, matricula: String(1000 + i), telefone: i % 4 === 0 ? "" : `(35) 9${8800 + i}-12${10 + i}`, email: i % 5 === 0 ? "" : n.toLowerCase().split(" ")[0] + i + "@email.com", situacao: "Ativo" })), ...extra });
  d.turmas = {
    t1: mk("t1", "Técnico em Administração", "ADM-2026-01", "Noite", "Tecnico", 800),
    t2: mk("t2", "Assistente Administrativo", "FIC-ASA-07", "Manhã", "FIC", 160),
    t3: mk("t3", "Auxiliar de Recursos Humanos", "FIC-RH-03", "Tarde", null, 160),
    t4: mk("t4", "Excel Avançado", "FIC-EXC-02", "Noite", "FIC", 40, { periodoInicio: "2026-05-04", periodoFim: "2026-06-12", periodoRealFim: "2026-06-12", finalizada: true }),
  };
  d.frequencias = {};
  const hoje = new Date();
  const dias = [];
  for (let k = 45; k >= 1; k--) { const dt = new Date(hoje); dt.setDate(dt.getDate() - k); if (dt.getDay() !== 0 && dt.getDay() !== 6) dias.push(iso(dt)); }
  // padrões de falta por aluno (índice): taxa
  const taxa = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0, 0, 0.05, 0.25, 0, 0.08, 0];
  let s = 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (const t of ["t1", "t2", "t3"]) {
    dias.forEach((dt, di) => {
      const reg = {};
      d.turmas[t].alunos.forEach((a, i) => {
        let r = rnd();
        if (i === 7 && di >= dias.length - 3) reg[a.id] = { status: "F" }; // 3 faltas consecutivas recentes
        else if (i === 11 && di >= dias.length - 4) reg[a.id] = { status: "F" };
        else if (r < taxa[i]) reg[a.id] = r < taxa[i] * 0.3 ? { status: "H", horas: r < taxa[i] * 0.15 ? [1] : [3, 4] } : { status: "F" };
      });
      if (t === "t3" && di % 2) return;
      d.frequencias[`${t}_${dt}`] = { turmaId: t, data: dt, registros: reg };
    });
  }
  d.usuarios = {};
  d.config = {};
  d.contatos = {}; d.alertas = {}; d.emails = {}; d.historico = {};
}
