// Constantes de domínio compartilhadas por todo o sistema

export const INSTITUICAO_PADRAO = "Senac Três Corações";

// Regra de aprovação: frequência mínima de 75% da carga horária total do curso (fixa)
export const FREQ_MINIMA = 75;

export const TURNOS = ["Manhã", "Tarde", "Noite"];

export const TIPOS_TURMA = [
  { value: "Tecnico", label: "Técnico" },
  { value: "FIC", label: "FIC" },
];
export const tipoLabel = (t) => (t === "Tecnico" ? "Técnico" : t === "FIC" ? "FIC" : "Não definido");

// Situação de acompanhamento do aluno (lista curta)
export const STATUS_ALUNO = ["Regular", "Necessita contato", "Em acompanhamento", "Aguardando retorno", "Evadido", "Concluído"];
export const STATUS_ALUNO_COR = {
  "Regular": "#10B981",
  "Necessita contato": "#EF4444",
  "Em acompanhamento": "#8B5CF6",
  "Aguardando retorno": "#F59E0B",
  "Evadido": "#6B7280",
  "Concluído": "#0EA5E9",
};
export const STATUS_INATIVOS = ["Evadido", "Concluído"];

export const FORMAS_CONTATO = ["WhatsApp", "Ligação", "E-mail", "Presencial", "Outro"];
export const RESULTADOS_CONTATO = [
  "Conversou com o aluno",
  "Aguardando retorno",
  "Não atendeu / sem resposta",
  "Aluno vai retornar às aulas",
  "Aluno informou desistência",
];

// Situação de frequência (3 níveis, fáceis de entender)
export const FAIXA_LABEL = { regular: "OK", risco: "Em risco", abaixo: "Abaixo de 75%", semdados: "Sem carga horária" };
export const FAIXA_COR = { regular: "#10B981", risco: "#F59E0B", abaixo: "#DC2626", semdados: "#9CA3AF" };
export const FAIXA_ORDEM = { abaixo: 0, risco: 1, regular: 2, semdados: 3 };

export const PERFIS = ["Administrador", "Coordenação", "Supervisão", "Consulta"];
export const PERFIL_DESCRICAO = {
  Administrador: "Acesso total, incluindo usuários e configurações.",
  Coordenação: "Turmas (inclusive excluir), chamada, contatos e relatórios.",
  Supervisão: "Chamada, contatos e edição de turmas e alunos.",
  Consulta: "Somente visualização e relatórios.",
};

export const CONFIG_PADRAO = {
  instituicao: INSTITUICAO_PADRAO,
  // aluno fica "Em risco" quando já usou esta porcentagem das horas de falta permitidas (25% da carga horária)
  usoAlerta: 60,
  consecutivasAlerta: 3,
  automacoes: {
    alertaConsecutivas: true,
    emailAutomatico: false,
    alertaRisco: true,
  },
  email: {
    remetenteNome: "Supervisão Pedagógica — Senac Três Corações",
    remetenteEmail: "",
    responsavelContato: "Supervisão Pedagógica",
    assunto: "Acompanhamento de sua frequência – Senac",
    corpo:
      "Olá, {{aluno}}!\n\n" +
      "Tudo bem com você? Aqui é a {{responsavel}} do {{instituicao}}.\n\n" +
      "Notamos que você não esteve presente nas últimas {{faltas_consecutivas}} aulas do curso {{curso}} — nos dias {{datas_faltas}}.\n\n" +
      "Estamos entrando em contato porque nos importamos com a sua permanência e queremos entender se está tudo bem ou se existe algo em que possamos ajudar. Sua frequência atual é de {{frequencia}}.\n\n" +
      "Se puder, responda este e-mail ou procure a Supervisão Pedagógica. Vamos encontrar juntos a melhor forma de você continuar no curso.\n\n" +
      "Um abraço,\n{{responsavel}}\n{{instituicao}}",
  },
};

export const VARIAVEIS_EMAIL = [
  { chave: "aluno", desc: "Nome do aluno" },
  { chave: "primeiro_nome", desc: "Primeiro nome" },
  { chave: "curso", desc: "Nome do curso" },
  { chave: "turma", desc: "Código da turma" },
  { chave: "faltas_consecutivas", desc: "Faltas seguidas" },
  { chave: "datas_faltas", desc: "Datas das faltas" },
  { chave: "frequencia", desc: "Frequência atual" },
  { chave: "horas_falta", desc: "Horas de falta" },
  { chave: "instituicao", desc: "Instituição" },
  { chave: "responsavel", desc: "Responsável" },
  { chave: "docente", desc: "Docente" },
];
