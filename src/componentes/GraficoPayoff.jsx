import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { breakEven, serieDePayoff } from '../lib/payoff.js'
import { emPreco, emReaisComSinal } from '../lib/formato.js'

/**
 * Fase 4: linha de lucro/prejuízo (Y) contra o preço do ativo no vencimento (X).
 *
 * Cor: aqua = lucro, vermelho = prejuízo, com a virada exatamente no zero.
 * A cor é reforço — quem carrega o sinal é a posição da linha em relação à
 * linha do zero, que é rotulada. Assim o gráfico continua legível para quem
 * não distingue as duas cores.
 */
export default function GraficoPayoff({ operacao, precoAtual }) {
  const [tabela, setTabela] = useState(false)

  const dados = useMemo(() => serieDePayoff(operacao, precoAtual), [operacao, precoAtual])
  const be = useMemo(() => breakEven(operacao), [operacao])

  // Onde, em fração da altura do gráfico, fica a linha do zero.
  // O gradiente troca de cor exatamente nesse ponto.
  const viradaDaCor = useMemo(() => {
    const valores = dados.map((d) => d.resultado)
    const maximo = Math.max(...valores)
    const minimo = Math.min(...valores)
    if (maximo <= 0) return 0
    if (minimo >= 0) return 1
    return maximo / (maximo - minimo)
  }, [dados])

  // Arrow functions de propósito: o Recharts passa o índice do tick como 2º
  // argumento, e o emPreco leria esse índice como "número de casas decimais".
  const eixoX = (v) => emPreco(v)
  const eixoY = (v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

  return (
    <section className="cartao" aria-labelledby="titulo-grafico">
      <div className="cabecalho-secao">
        <h2 id="titulo-grafico">Ganho e perda no vencimento</h2>
        <button type="button" className="botao-texto" onClick={() => setTabela((v) => !v)}>
          {tabela ? 'ver gráfico' : 'ver tabela'}
        </button>
      </div>
      <p className="ajuda">
        Resultado total em reais conforme o preço do ativo no dia do vencimento.
      </p>

      {tabela ? (
        <TabelaDePontos dados={dados} be={be} precoAtual={precoAtual} />
      ) : (
        <div className="moldura-grafico">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados} margin={{ top: 20, right: 10, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="gradientePayoff" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="var(--ganho, #1baf7a)" />
                  <stop offset={viradaDaCor} stopColor="var(--ganho, #1baf7a)" />
                  <stop offset={viradaDaCor} stopColor="var(--perda, #d03b3b)" />
                  <stop offset={1} stopColor="var(--perda, #d03b3b)" />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="var(--grade, #e1e0d9)" vertical={false} />

              <XAxis
                dataKey="preco"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={eixoX}
                tick={{ fill: 'var(--ink-muted, #898781)', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--eixo, #c3c2b7)' }}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={eixoY}
                tick={{ fill: 'var(--ink-muted, #898781)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />

              <Tooltip
                content={<Dica />}
                cursor={{ stroke: 'var(--eixo, #c3c2b7)', strokeWidth: 1 }}
              />

              {/* A fronteira lucro/prejuízo — é ela que dá o sentido, não a cor. */}
              <ReferenceLine
                y={0}
                stroke="var(--eixo-forte, #898781)"
                strokeWidth={1.5}
                label={{
                  value: 'zero',
                  position: 'insideTopLeft',
                  fill: 'var(--ink-muted, #898781)',
                  fontSize: 10,
                }}
              />

              <ReferenceLine
                x={be}
                stroke="var(--ink-muted, #898781)"
                strokeDasharray="4 3"
                label={{
                  value: 'empate',
                  position: 'top',
                  fill: 'var(--ink-muted, #898781)',
                  fontSize: 10,
                }}
              />

              {Number.isFinite(precoAtual) && precoAtual > 0 && (
                <ReferenceLine
                  x={precoAtual}
                  stroke="var(--serie-1, #2a78d6)"
                  strokeDasharray="4 3"
                  label={{
                    // Uma linha abaixo do rótulo "empate": quando o preço atual
                    // está perto do break-even, os dois textos se sobrepunham.
                    value: 'agora',
                    position: 'insideTop',
                    dy: 4,
                    fill: 'var(--serie-1, #2a78d6)',
                    fontSize: 10,
                  }}
                />
              )}

              <Line
                type="linear"
                dataKey="resultado"
                name="Resultado"
                stroke="url(#gradientePayoff)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: 'var(--superficie, #fcfcfb)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="legenda-marcos">
        <li><span className="marca marca-empate" /> empate (break-even) em R$ {emPreco(be)}</li>
        {Number.isFinite(precoAtual) && precoAtual > 0 && (
          <li><span className="marca marca-agora" /> preço atual R$ {emPreco(precoAtual)}</li>
        )}
        <li><span className="marca marca-ganho" /> acima do zero = lucro</li>
        <li><span className="marca marca-perda" /> abaixo do zero = prejuízo</li>
      </ul>
    </section>
  )
}

function Dica({ active, payload }) {
  if (!active || !payload?.length) return null
  const { preco, resultado } = payload[0].payload
  const lucro = resultado >= 0
  return (
    <div className="dica">
      <div className="dica-preco">Ativo a R$ {emPreco(preco)}</div>
      <div className={lucro ? 'dica-valor ganho' : 'dica-valor perda'}>
        {lucro ? 'Lucro' : 'Prejuízo'} {emReaisComSinal(resultado)}
      </div>
    </div>
  )
}

/** Alternativa acessível ao gráfico: os mesmos números em tabela. */
function TabelaDePontos({ dados, be, precoAtual }) {
  // Uma amostra legível, não os 50 pontos.
  const marcos = [...new Set([
    dados[0].preco,
    ...[0.9, 0.95, 1, 1.05, 1.1].map((f) => precoAtual * f).filter((p) => Number.isFinite(p) && p > 0),
    be,
    dados[dados.length - 1].preco,
  ])].sort((a, b) => a - b)

  const maisProximo = (alvo) =>
    dados.reduce((a, b) => (Math.abs(b.preco - alvo) < Math.abs(a.preco - alvo) ? b : a))

  return (
    <div className="rolagem-tabela">
      <table className="tabela">
        <caption className="sr-only">Resultado da operação por preço do ativo no vencimento</caption>
        <thead>
          <tr>
            <th scope="col">Preço do ativo</th>
            <th scope="col">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {marcos.map((preco) => {
            const ponto = maisProximo(preco)
            return (
              <tr key={preco}>
                <td>R$ {emPreco(preco)}</td>
                <td className={ponto.resultado >= 0 ? 'ganho' : 'perda'}>
                  {emReaisComSinal(ponto.resultado)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
