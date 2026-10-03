// Níveis de acesso
const MATRIZ = {
  Administrador: ["ver", "editar", "chamada", "contatos", "turmaConfig", "excluirTurma", "importar", "usuarios", "configuracoes", "emails"],
  "Coordenação": ["ver", "editar", "chamada", "contatos", "turmaConfig", "excluirTurma", "importar", "emails"],
  "Supervisão": ["ver", "editar", "chamada", "contatos", "turmaConfig", "importar", "emails"],
  Consulta: ["ver"],
};
export function pode(perfil, acao) {
  return (MATRIZ[perfil] || []).includes(acao);
}
