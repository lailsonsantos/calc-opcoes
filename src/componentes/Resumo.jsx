import { useMemo } from 'react'
import {
  breakEvensDaEstrategia,
  caixaDaEstrategia,
  cenariosDaEstrategia,
  custoDeSaidaImediata,
  distanciaDoStrike,
  extremosDaEstrategia,
  resultadoDaEstrategia,
  temSpreadAlto,
} from '../lib/payoff.js'
import { emPorcento, emPreco, emReais, emReaisComSinal } from '../lib/formato.js'
import { avisoDoPrazo, classificarPrazo, diasAteVencimento, textoDoPrazo } from '../lib/vencimento.js'

const VARIACOES = [-0.1, -0.075, -0.05, -0.025, 0.025, 0.05, 0.075, 0.1]

/** Os números-chave da estratégia, em destaque acima do gráfico. */
export default function Resumo({ pernas, precoAtual, bid, ask, usandoBook, vencimento }) {
  const dias = diasAteVencimento(vencimento)
  const situacao = classificarPrazo(dias)
  const aviso = avisoDoPrazo(dias)

  const umaPerna = pernas.length === 1
  const principal = pernas[0]

  const caixa = useMemo(() => caixaDaEstrategia(pernas), [pernas])
  const extremos = useMemo(() => extremosDaEstrategia(pernas), [pernas])
  const empates = useMemo(() => breakEvensDaEstrategia(pernas), [pernas])
  const agora = useMemo(() => resultadoDaEstrategia(pernas, precoAtual), [pernas, precoAtual])
  const projecoes = useMemo(
    () => cenariosDaEstrategia(pernas, precoAtual, VARIACOES),
    [pernas, precoAtual],
  )

  const ehDebito = caixa < 0
  const valorEmJogo = Math.abs(caixa)

  const perdaEmPorcento = extremos.perdaIlimitada || valorEmJogo === 0
    ? NaN
    : (Math.abs(extremos.perdaMaxima) / valorEmJogo) * 100

  const distStrike = umaPerna ? distanciaDoStrike(principal.strike, precoAtual) : NaN

  const temBook = umaPerna && Number.isFinite(bid) && Number.isFinite(ask) && ask > 0
  const saida = temBook
    ? custoDeSaidaImediata({ bid, ask, quantidade: principal.quantidade })
    : null
  const spreadAlto = temBook && temSpreadAlto({ bid, ask })

  return (
    <section className="cartao" aria-labelledby="titulo-resumo">
      <h2 id="titulo-resumo">
        Resumo da operação
        {!umaPerna && <span className="etiqueta">{pernas.length} pernas</span>}
      </h2>

      {usandoBook && umaPerna && (
        <p className="ajuda">
          Usando o {principal.posicao === 'comprada' ? 'ask' : 'bid'} do book
          (R$ {emPreco(principal.premio)}) como preço de entrada, em vez do campo "prêmio".
        </p>
      )}

      <div className="grade-cartoes">
        <Numero
          rotulo={ehDebito ? 'Custo para montar' : 'Crédito recebido'}
          valor={emReais(valorEmJogo)}
          nota={umaPerna
            ? `${principal.quantidade} × R$ ${emPreco(principal.premio)}`
            : `soma líquida das ${pernas.length} pernas`}
        />

        <Numero
          rotulo="Perda máxima"
          valor={extremos.perdaIlimitada ? 'ilimitada' : emReais(Math.abs(extremos.perdaMaxima))}
          tom={extremos.perdaIlimitada ? 'aviso' : 'perda'}
          nota={
            extremos.perdaIlimitada
              ? 'call vendida sem cobertura — o ativo pode subir sem teto'
              : Number.isFinite(perdaEmPorcento)
                ? `${emPorcento(perdaEmPorcento, 0)} do valor da operação`
                : 'no pior cenário do vencimento'
          }
        />

        <Numero
          rotulo="Ganho máximo"
          valor={extremos.ganhoIlimitado ? 'ilimitado' : emReais(extremos.ganhoMaximo)}
          tom="ganho"
          nota={extremos.ganhoIlimitado
            ? 'quanto mais o ativo subir, maior'
            : 'no melhor cenário do vencimento'}
        />

        <Numero
          rotulo={empates.length > 1 ? 'Empates (break-even)' : 'Empate (break-even)'}
          valor={empates.length === 0
            ? '—'
            : empates.map((e) => `R$ ${emPreco(e)}`).join('  ·  ')}
          nota={descreverEmpates(empates, precoAtual)}
        />

        <Numero
          rotulo="Resultado no preço atual"
          valor={emReaisComSinal(agora)}
          tom={agora >= 0 ? 'ganho' : 'perda'}
          nota={`se vencesse hoje, com o ativo a R$ ${emPreco(precoAtual)}`}
        />

        {umaPerna && (
          <Numero
            rotulo="Distância do strike"
            valor={Number.isFinite(distStrike) ? emPorcento(distStrike) : '—'}
            nota={
              !Number.isFinite(distStrike)
                ? 'preencha o preço do ativo'
                : (principal.tipo === 'CALL') === (distStrike > 0)
                  ? 'fora do dinheiro'
                  : 'dentro do dinheiro'
            }
          />
        )}

        <Numero
          rotulo="Vencimento"
          valor={Number.isFinite(dias) ? textoDoPrazo(dias) : '—'}
          tom={situacao === 'vencida' || situacao === 'hoje' || situacao === 'reta-final'
            ? 'aviso'
            : undefined}
          nota={vencimento ? formatarData(vencimento) : 'preencha a data de vencimento'}
        />
      </div>

      {aviso && (
        <p className="alerta" role="status">
          <strong>⏳ {situacao === 'vencida' ? 'Opção vencida.' : 'Atenção ao prazo.'}</strong> {aviso}
        </p>
      )}

      {/* O custo real de errar a entrada numa opção ilíquida. */}
      {saida && (
        <div className={spreadAlto ? 'painel-saida com-alerta' : 'painel-saida'}>
          <h3>Custo de sair agora</h3>
          <p className="valor-saida perda">
            {emReaisComSinal(saida.valor)}{' '}
            <span className="valor-saida-pct">({emPorcento(saida.percentual)})</span>
          </p>
          <p className="ajuda">
            É o que você perderia comprando no ask (R$ {emPreco(ask)}) e vendendo na hora
            no bid (R$ {emPreco(bid)}) — R$ {emPreco(saida.porOpcao)} por opção,
            {' '}{principal.quantidade} opções.
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
                <th scope="row">{variacao > 0 ? '+' : ''}{(variacao * 100).toLocaleString('pt-BR')}%</th>
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

function descreverEmpates(empates, precoAtual) {
  if (empates.length === 0) return 'esta montagem não cruza o zero'
  if (empates.length > 1) return 'o ativo precisa sair desta faixa para dar lucro'
  if (!(precoAtual > 0)) return 'preencha o preço do ativo'
  const distancia = ((empates[0] - precoAtual) / precoAtual) * 100
  return `o ativo precisa ${distancia >= 0 ? 'subir' : 'cair'} ${emPorcento(Math.abs(distancia))}`
}

function formatarData(iso) {
  const [ano, mes, dia] = String(iso).split('-')
  return dia ? `${dia}/${mes}/${ano}` : iso
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
