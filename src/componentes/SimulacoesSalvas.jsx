import { useMemo } from 'react'
import { resultadoTotal } from '../lib/payoff.js'
import { emPorcento, emPreco, emReaisComSinal, paraNumero } from '../lib/formato.js'
import { classificarPrazo, diasAteVencimento, textoDoPrazo } from '../lib/vencimento.js'

/**
 * As posições salvas, identificadas pelo código da opção.
 *
 * A coluna de resultado responde "se o ativo terminar no preço de hoje, quanto
 * eu ganho ou perco no vencimento". NÃO é a marcação a mercado da opção — para
 * isso seria preciso o prêmio negociado agora, que a ferramenta não acompanha.
 */
export default function SimulacoesSalvas({
  lista,
  codigoAtual,
  atualizando,
  aoSalvar,
  aoCarregar,
  aoApagar,
  aoAtualizarCotacoes,
}) {
  const linhas = useMemo(() => lista.map(calcularLinha), [lista])
  const total = useMemo(
    () => linhas.reduce((soma, l) => (Number.isFinite(l.resultado) ? soma + l.resultado : soma), 0),
    [linhas],
  )

  const codigo = codigoAtual.trim().toUpperCase()
  const jaExiste = linhas.some((l) => l.id === codigo)

  return (
    <section className="cartao" aria-labelledby="titulo-salvas">
      <div className="cabecalho-secao">
        <h2 id="titulo-salvas">Minhas opções</h2>
        {lista.length > 0 && (
          <button
            type="button"
            className="botao-secundario"
            onClick={aoAtualizarCotacoes}
            disabled={atualizando}
          >
            {atualizando ? 'Atualizando…' : '↻ Atualizar cotações'}
          </button>
        )}
      </div>

      <div className="linha-salvar">
        <button type="button" className="botao" onClick={aoSalvar} disabled={!codigo}>
          {jaExiste ? `Atualizar ${codigo}` : 'Salvar posição atual'}
        </button>
        <p className="ajuda">
          {codigo
            ? `Salva sob o código ${codigo}. Salvar de novo o mesmo código atualiza a posição.`
            : 'Preencha o "código da opção" no formulário — é ele que identifica a posição.'}
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="ajuda">Nenhuma opção salva ainda.</p>
      ) : (
        <>
          <div className="rolagem-tabela">
            <table className="tabela tabela-carteira">
              <caption className="sr-only">Posições salvas e resultado projetado no vencimento</caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Ativo</th>
                  <th scope="col">Operação</th>
                  <th scope="col">Strike</th>
                  <th scope="col">Prazo</th>
                  <th scope="col">Ativo hoje</th>
                  <th scope="col">Entrada</th>
                  <th scope="col">Se vencer hoje</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <th scope="row" className="codigo-serie">{l.codigo}</th>
                    <td>{l.ticker || '—'}</td>
                    <td className="celula-operacao">
                      {l.tipo} {l.posicao === 'vendida' ? 'vendida' : 'comprada'}
                      <span className="cartao-nota"> ×{l.quantidade}</span>
                    </td>
                    <td>{Number.isFinite(l.strike) ? emPreco(l.strike) : '—'}</td>
                    <td className={l.prazoUrgente ? 'aviso' : undefined}>{l.prazoTexto}</td>
                    <td>{Number.isFinite(l.precoAtivo) ? emPreco(l.precoAtivo) : '—'}</td>
                    <td>{Number.isFinite(l.precoEntrada) ? emPreco(l.precoEntrada) : '—'}</td>
                    <td className={l.resultado >= 0 ? 'ganho' : 'perda'}>
                      <strong>{emReaisComSinal(l.resultado)}</strong>
                      {Number.isFinite(l.percentual) && (
                        <span className="cartao-nota"> {emPorcento(l.percentual, 0)}</span>
                      )}
                    </td>
                    <td className="celula-acoes">
                      <button type="button" className="botao-texto" onClick={() => aoCarregar(l.original)}>
                        abrir
                      </button>
                      <button
                        type="button"
                        className="botao-texto perigo"
                        onClick={() => {
                          if (confirm(`Apagar ${l.codigo}?`)) aoApagar(l.id)
                        }}
                      >
                        apagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={7}>
                    Somando as {linhas.length} {linhas.length === 1 ? 'posição' : 'posições'}
                  </th>
                  <td className={total >= 0 ? 'ganho' : 'perda'}>
                    <strong>{emReaisComSinal(total)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="ajuda">
            "Se vencer hoje" é o resultado <strong>no vencimento</strong> caso o ativo termine
            no preço atual — não é o valor de mercado da opção agora. Use "Atualizar cotações"
            para puxar o preço mais recente dos ativos.
          </p>
        </>
      )}
    </section>
  )
}

function calcularLinha(salva) {
  const d = salva.dados || {}
  const strike = paraNumero(d.strike)
  const quantidade = paraNumero(d.quantidade)
  const precoAtivo = paraNumero(d.precoAtivo)
  const precoEntrada = Number.isFinite(salva.precoEntrada)
    ? salva.precoEntrada
    : paraNumero(d.premio)

  const completa =
    strike > 0 && quantidade > 0 && precoAtivo > 0 && Number.isFinite(precoEntrada)

  const resultado = completa
    ? resultadoTotal(
        { tipo: d.tipo, posicao: d.posicao, strike, premio: precoEntrada, quantidade },
        precoAtivo,
      )
    : NaN

  const custo = precoEntrada * quantidade
  const dias = diasAteVencimento(d.vencimento)
  const situacao = classificarPrazo(dias)

  return {
    id: salva.id,
    codigo: salva.codigo,
    ticker: d.ticker,
    tipo: d.tipo,
    posicao: d.posicao,
    strike,
    quantidade,
    precoAtivo,
    precoEntrada,
    resultado,
    percentual: custo > 0 ? (resultado / custo) * 100 : NaN,
    prazoTexto: Number.isFinite(dias) ? textoDoPrazo(dias) : '—',
    prazoUrgente: ['vencida', 'hoje', 'reta-final'].includes(situacao),
    original: salva,
  }
}
