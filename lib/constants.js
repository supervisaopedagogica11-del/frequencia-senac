// Constantes de domínio compartilhadas por todo o sistema

export const INSTITUICAO_PADRAO = "Senac Três Corações";

export const TURNOS = ["Manhã", "Tarde", "Noite"];

export const TIPOS_TURMA = [
  { value: "Tecnico", label: "Técnico" },
  { value: "FIC", label: "FIC" },
];
export const tipoLabel = (t) => (t === "Tecnico" ? "Técnico" : t === "FIC" ? "FIC" : "Não definido");

// Situação / status de acompanhamento do aluno
export const STATUS_ALUNO = [
  "Regular",
  "Em acompanhamento",
  "Necessita contato",
  "Contatado",
  "Aguardando retorno",
  "Risco de evasão",
  "Evadido",
  "Concluído",
];
export const STATUS_ALUNO_COR = {
  "Regular": "#10B981",
  "Em acompanhamento": "#8B5CF6",
  "Necessita contato": "#EF4444",
  "Contatado": "#3B82F6",
  "Aguardando retorno": "#F59E0B",
  "Risco de evasão": "#DC2626",
  "Evadido": "#6B7280",
  "Concluído": "#0EA5E9",
};
export const STATUS_INATIVOS = ["Evadido", "Concluído"];

// Formas de contato / intervenção
export const FORMAS_CONTATO = [
  "WhatsApp",
  "Ligação",
  "E-mail",
  "E-mail automático",
  "Atendimento presencial",
  "Atendimento remoto",
  "Conversa com docente",
  "Conversa com coordenação",
  "Conversa com responsável",
  "Visita institucional",
  "Outro",
];

export const RESULTADOS_CONTATO = [
  "Contato realizado",
  "Aguardando retorno",
  "Sem resposta",
  "Não localizado",
  "Número/e-mail inválido",
  "Aluno retornou às aulas",
  "Aluno informou desistência",
];

export const MOTIVOS_CONTATO = [
  "Faltas consecutivas",
  "Frequência próxima de 75%",
  "Frequência abaixo de 75%",
  "Atrasos recorrentes",
  "Retorno agendado",
  "Solicitação do docente",
  "Acompanhamento de rotina",
  "Outro",
];

// Faixas de acompanhamento (prevenção do limite mínimo)
export const FAIXAS = ["regular", "atencao", "risco", "critico", "abaixo", "semdados"];
export const FAIXA_LABEL = {
  regular: "Regular",
  atencao: "Atenção",
  risco: "Risco",
  critico: "Crítico",
  abaixo: "Abaixo do mínimo",
  semdados: "Sem dados",
};
export const FAIXA_COR = {
  regular: "#10B981",
  atencao: "#F59E0B",
  risco: "#F97316",
  critico: "#EF4444",
  abaixo: "#991B1B",
  semdados: "#9CA3AF",
};
export const FAIXA_ORDEM = { abaixo: 0, critico: 1, risco: 2, atencao: 3, regular: 4, semdados: 5 };

export const PERFIS = ["Administrador", "Coordenação", "Supervisão", "Consulta"];
export const PERFIL_DESCRICAO = {
  Administrador: "Acesso total, incluindo usuários, automações e configurações.",
  Coordenação: "Gerencia turmas (inclusive excluir), frequência, contatos e relatórios.",
  Supervisão: "Registra chamada, contatos e acompanhamento; edita turmas e alunos.",
  Consulta: "Somente visualização e relatórios.",
};

export const CONFIG_PADRAO = {
  instituicao: INSTITUICAO_PADRAO,
  limiteMinimo: 75,
  // percentuais: a faixa é aplicada quando a frequência fica ABAIXO do valor
  faixas: { atencao: 88, risco: 82, critico: 78 },
  // folga: quantidade de faltas (dias) que o aluno ainda pode ter
  folga: { risco: 5, critico: 2 },
  consecutivasAlerta: 3,
  pesoAtraso: 0.5,
  automacoes: {
    alertaConsecutivas: true,
    pendenciaAutomatica: true,
    emailAutomatico: false,
    alertaLimite: true,
    alertaChamadaPendente: true,
  },
  email: {
    remetenteNome: "Supervisão Pedagógica — Senac Três Corações",
    remetenteEmail: "",
    responsavelContato: "Supervisão Pedagógica",
    assunto: "Acompanhamento de sua frequência – Senac",
    corpo:
      "Olá, {{aluno}}!\n\n" +
      "Tudo bem com você? Aqui é a {{responsavel}} do {{instituicao}}.\n\n" +
      "Notamos que você não esteve presente nas últimas {{faltas_consecutivas}} aulas da turma {{turma}} ({{curso}}) — nos dias {{datas_faltas}}.\n\n" +
      "Estamos entrando em contato porque nos importamos com a sua permanência e queremos entender se está tudo bem ou se existe algo em que possamos ajudar. Sua frequência atual é de {{frequencia}}.\n\n" +
      "Se puder, responda este e-mail ou procure a Supervisão Pedagógica. Vamos encontrar juntos a melhor forma de você continuar no curso.\n\n" +
      "Um abraço,\n{{responsavel}}\n{{instituicao}}",
  },
};

export const VARIAVEIS_EMAIL = [
  { chave: "aluno", desc: "Nome do aluno" },
  { chave: "primeiro_nome", desc: "Primeiro nome do aluno" },
  { chave: "turma", desc: "Código/nome da turma" },
  { chave: "curso", desc: "Nome do curso" },
  { chave: "faltas_consecutivas", desc: "Quantidade de faltas seguidas" },
  { chave: "total_faltas", desc: "Total de faltas acumuladas" },
  { chave: "datas_faltas", desc: "Datas das faltas consecutivas" },
  { chave: "frequencia", desc: "Frequência atual (%)" },
  { chave: "instituicao", desc: "Nome da instituição" },
  { chave: "responsavel", desc: "Responsável pelo contato" },
  { chave: "docente", desc: "Docente da turma" },
];
