import { useState } from 'react'
import { emDataHora } from '../lib/formato.js'

/** Fase 8: salvar e recarregar simulações do localStorage. */
export default function SimulacoesSalvas({ lista, aoSalvar, aoCarregar, aoApagar }) {
  const [nome, setNome] = useState('')

  function salvar(e) {
    e.preventDefault()
    if (!nome.trim()) return
    aoSalvar(nome)
    setNome('')
  }

  return (
    <section className="cartao" aria-labelledby="titulo-salvas">
      <h2 id="titulo-salvas">Simulações salvas</h2>
      <p className="ajuda">Ficam guardadas só neste aparelho, no navegador. Sem conta, sem servidor.</p>

      <form className="linha-salvar" onSubmit={salvar}>
        <label className="sr-only" htmlFor="nome-simulacao">Nome da simulação</label>
        <input
          id="nome-simulacao"
          type="text"
          autoComplete="off"
          placeholder="ex.: BBAS3 call 19,51"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <button type="submit" className="botao" disabled={!nome.trim()}>Salvar</button>
      </form>

      {lista.length === 0 ? (
        <p className="ajuda">Nenhuma simulação salva ainda.</p>
      ) : (
        <ul className="lista-salvas">
          {lista.map((s) => (
            <li key={s.id}>
              <div className="salva-info">
                <strong>{s.nome}</strong>
                <span className="cartao-nota">{emDataHora(s.salvoEm)}</span>
              </div>
              <div className="salva-acoes">
                <button type="button" className="botao-secundario" onClick={() => aoCarregar(s)}>
                  Carregar
                </button>
                <button
                  type="button"
                  className="botao-secundario perigo"
                  onClick={() => {
                    if (confirm(`Apagar "${s.nome}"?`)) aoApagar(s.id)
                  }}
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
