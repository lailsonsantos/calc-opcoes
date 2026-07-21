import { useMemo } from 'react'
import {
  breakEven,
  cenarios,
  custoDeSaidaImediata,
  custoTotal,
  distanciaDoStrike,
  ganhoMaximo,
  perdaMaxima,
  resultadoTotal,
  temSpreadAlto,
} from '../lib/payoff.js'
import { emPorcento, emPreco, emReais, emReaisComSinal } from '../lib/formato.js'

const VARIACOES = [-0.1, -0.05, 0.05, 0.1]

/** Fases 5 e 6: os números-chave em destaque, acima do gráfico. */
export default function Resumo({ operacao, precoAtual, bid, ask, usandoBook }) {
  const custo = useMemo(() => custoTotal(operacao), [operacao])
  const perda = useMemo(() => perdaMaxima(operacao), [operacao])
  const ganho = useMemo(() => ganhoMaximo(operacao), [operacao])
  const be = useMemo(() => breakEven(operacao), [operacao])
  const agora = useMemo(() => resultadoTotal(operacao, precoAtual), [operacao, precoAtual])
  const projecoes = useMemo(() => cenarios(operacao, precoAtual, VARIACOES), [operacao, precoAtual])

  const perdaEmPorcento = perda.ilimitada || custo.valor === 0
    ? NaN
    : (Math.abs(perda.valor) / custo.valor) * 100

  const distanciaBe = Number.isFinite(precoAtual) && precoAtual > 0
    ? ((be - precoAtual) / precoAtual) * 100
    : NaN
  const distStrike = distanciaDoStrike(operacao.strike, precoAtual)

  const temBook = Number.isFinite(bid) && Number.isFinite(ask) && ask > 0
  const saida = temBook ? custoDeSaidaImediata({ bid, ask, quantidade: operacao.quantidade }) : null
  const spreadAlto = temBook && temSpreadAlto({ bid, ask })

  return (
    <section className="cartao" aria-labelledby="titulo-resumo">
      <h2 id="titulo-resumo">Resumo da operação</h2>

      {usandoBook && (
        <p className="ajuda">
          Usando o {operacao.posicao === 'comprada' ? 'ask' : 'bid'} do book (R$ {emPreco(operacao.premio)})
          como preço de entrada, em vez do campo "prêmio".
        </p>
      )}

      <div className="grade-cartoes">
        <Numero
          rotulo={custo.tipo === 'debito' ? 'Custo total' : 'Crédito recebido'}
          valor={emReais(custo.valor)}
          nota={`${operacao.quantidade} × R$ ${emPreco(operacao.premio)}`}
        />

        <Numero
          rotulo="Perda máxima"
          valor={perda.ilimitada ? 'ilimitada' : emReais(Math.abs(perda.valor))}
          tom={perda.ilimitada ? 'aviso' : 'perda'}
          nota={
            perda.ilimitada
              ? 'call vendida a descoberto — o ativo pode subir sem teto'
              : `${emPorcento(perdaEmPorcento, 0)} do valor da operação`
          }
        />

        <Numero
          rotulo="Ganho máximo"
          valor={ganho.ilimitado ? 'ilimitado' : emReais(ganho.valor)}
          tom="ganho"
          nota={ganho.ilimitado ? 'quanto mais o ativo subir, maior' : 'no melhor cenário do vencimento'}
        />

        <Numero
          rotulo="Empate (break-even)"
          valor={`R$ ${emPreco(be)}`}
          nota={
            Number.isFinite(distanciaBe)
              ? `o ativo precisa ${distanciaBe >= 0 ? 'subir' : 'cair'} ${emPorcento(Math.abs(distanciaBe))}`
              : 'preencha o preço do ativo'
          }
        />

        <Numero
          rotulo="Resultado no preço atual"
          valor={emReaisComSinal(agora)}
          tom={agora >= 0 ? 'ganho' : 'perda'}
          nota={`se vencesse hoje, com o ativo a R$ ${emPreco(precoAtual)}`}
        />

        <Numero
          rotulo="Distância do strike"
          valor={Number.isFinite(distStrike) ? emPorcento(distStrike) : '—'}
          nota={
            !Number.isFinite(distStrike)
              ? 'preencha o preço do ativo'
              : (operacao.tipo === 'CALL') === (distStrike > 0)
                ? 'fora do dinheiro'
                : 'dentro do dinheiro'
          }
        />
      </div>

      {/* Fase 6: o custo real de errar a entrada numa opção ilíquida. */}
      {saida && (
        <div className={spreadAlto ? 'painel-saida com-alerta' : 'painel-saida'}>
          <h3>Custo de sair agora</h3>
          <p className="valor-saida perda">
            {emReaisComSinal(saida.valor)}{' '}
            <span className="valor-saida-pct">({emPorcento(saida.percentual)})</span>
          </p>
          <p className="ajuda">
            É o que você perderia comprando no ask (R$ {emPreco(ask)}) e vendendo na hora
            no bid (R$ {emPreco(bid)}) — R$ {emPreco(saida.porOpcao)} por opção, {operacao.quantidade} opções.
          </p>
          {spreadAlto && (
            <p className="alerta" role="status">
              <strong>⚠️ Baixa liquidez / spread alto.</strong> O bid está abaixo de metade do ask:
              você já entra perdendo boa parte do valor e pode não achar comprador para sair.
            </p>
          )}
        </div>
      )}

      <h3>Se o ativo variar</h3>
      <div className="rolagem-tabela">
        <table className="tabela">
          <caption className="sr-only">Resultado projetado por variação do ativo</caption>
          <thead>
            <tr>
              <th scope="col">Variação</th>
              <th scope="col">Preço do ativo</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {projecoes.map(({ variacao, preco, resultado }) => (
              <tr key={variacao}>
                <th scope="row">{variacao > 0 ? '+' : ''}{Math.round(variacao * 100)}%</th>
                <td>R$ {emPreco(preco)}</td>
                <td className={resultado >= 0 ? 'ganho' : 'perda'}>{emReaisComSinal(resultado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Numero({ rotulo, valor, nota, tom }) {
  return (
    <div className="cartao-numero">
      <span className="cartao-rotulo">{rotulo}</span>
      <strong className={tom ? `cartao-valor tom-${tom}` : 'cartao-valor'}>{valor}</strong>
      {nota && <span className="cartao-nota">{nota}</span>}
    </div>
  )
}
