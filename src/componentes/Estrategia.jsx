import { PRESETS } from '../lib/estrategias.js'
import { emPreco } from '../lib/formato.js'

/**
 * As pernas extras da estratégia (a perna 1 é o formulário principal).
 *
 * Combinar pernas é o que transforma uma aposta direcional numa estrutura:
 * vender um strike acima do que você comprou barateia a entrada e põe teto
 * na perda, em troca de pôr teto no ganho também.
 */
export default function Estrategia({
  extras,
  pernaPrincipal,
  temCadeia,
  aoMudarExtra,
  aoRemoverExtra,
  aoAdicionarVazia,
  aoAplicarPreset,
  aoLimpar,
}) {
  const numerico = { type: 'text', inputMode: 'decimal', autoComplete: 'off' }

  return (
    <section className="cartao" aria-labelledby="titulo-estrategia">
      <div className="cabecalho-secao">
        <h2 id="titulo-estrategia">Estratégia</h2>
        {extras.length > 0 && (
          <button type="button" className="botao-texto perigo" onClick={aoLimpar}>
            voltar para uma perna
          </button>
        )}
      </div>

      <p className="ajuda">
        Some pernas para montar travas, straddles e afins. O gráfico e o resumo
        passam a mostrar o resultado da estrutura inteira, somada.
      </p>

      <div className="montagens">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="botao-secundario"
            onClick={() => aoAplicarPreset(p.id)}
            disabled={!temCadeia}
            title={p.resumo}
          >
            {p.nome}
          </button>
        ))}
      </div>
      <p className="ajuda">
        {temCadeia
          ? 'As montagens prontas usam as séries reais da cadeia carregada acima.'
          : 'Carregue a cadeia de opções acima para habilitar as montagens prontas.'}
      </p>

      <ol className="lista-pernas">
        <li className="perna perna-fixa">
          <div className="perna-titulo">
            <strong>Perna 1</strong>
            <span className="cartao-nota">vem do formulário</span>
          </div>
          <p className="ajuda">
            {pernaPrincipal.tipo} {pernaPrincipal.posicao} · strike{' '}
            {Number.isFinite(pernaPrincipal.strike) ? emPreco(pernaPrincipal.strike) : '—'} · prêmio{' '}
            {Number.isFinite(pernaPrincipal.premio) ? emPreco(pernaPrincipal.premio) : '—'} ·{' '}
            {pernaPrincipal.quantidade || '—'} opções
          </p>
        </li>

        {extras.map((perna, i) => (
          <li className="perna" key={perna.id}>
            <div className="perna-titulo">
              <strong>Perna {i + 2}</strong>
              <button
                type="button"
                className="botao-texto perigo"
                onClick={() => aoRemoverExtra(perna.id)}
              >
                remover
              </button>
            </div>

            <div className="grade-perna">
              <div className="campo">
                <label htmlFor={`tipo-${perna.id}`}>Tipo</label>
                <select
                  id={`tipo-${perna.id}`}
                  value={perna.tipo}
                  onChange={(e) => aoMudarExtra(perna.id, 'tipo', e.target.value)}
                >
                  <option value="CALL">CALL</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div className="campo">
                <label htmlFor={`posicao-${perna.id}`}>Posição</label>
                <select
                  id={`posicao-${perna.id}`}
                  value={perna.posicao}
                  onChange={(e) => aoMudarExtra(perna.id, 'posicao', e.target.value)}
                >
                  <option value="comprada">Comprada</option>
                  <option value="vendida">Vendida</option>
                </select>
              </div>

              <div className="campo">
                <label htmlFor={`strike-${perna.id}`}>Strike</label>
                <input
                  id={`strike-${perna.id}`}
                  {...numerico}
                  value={perna.strike}
                  onChange={(e) => aoMudarExtra(perna.id, 'strike', e.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor={`premio-${perna.id}`}>Prêmio</label>
                <input
                  id={`premio-${perna.id}`}
                  {...numerico}
                  value={perna.premio}
                  onChange={(e) => aoMudarExtra(perna.id, 'premio', e.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor={`qtd-${perna.id}`}>Quantidade</label>
                <input
                  id={`qtd-${perna.id}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={perna.quantidade}
                  onChange={(e) => aoMudarExtra(perna.id, 'quantidade', e.target.value)}
                />
              </div>
            </div>

            {perna.codigo && <p className="ajuda codigo-serie">{perna.codigo}</p>}
          </li>
        ))}
      </ol>

      <button type="button" className="botao-secundario" onClick={aoAdicionarVazia}>
        + adicionar perna
      </button>
    </section>
  )
}
