"use client";
import Chamada from "./Chamada";
// Ao clicar na turma, abre a Chamada da turma (como no protótipo); a engrenagem "Configurar" fica no cabeçalho.
export default function Turma({ id }) { return <Chamada key={id} turmaId={id} />; }
