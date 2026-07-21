import { useMemo } from 'react'
import { melhoresCompras, melhoresTravas, melhoresVendas } from '../lib/estrategias.js'
import { emPorcento, emPreco, emReais, emReaisComSinal } from '../lib/formato.js'

/**
 * Comparador de séries SOB UM PREÇO-ALVO que você escolhe.
 *
 * Não é previsão. A ferramenta não sabe (nem pode saber) para onde o ativo
 * vai. O que ela faz é aritmética condicional: dado o alvo que você digitou,
 * qual série teria rendido mais. Mudou o alvo, muda o ranking inteiro.
 */
export default function Oportunidades({
  series,
  precoAtual,
  precoAlvo,
  quantidade,
  aoMudarAlvo,
  aoUsarPernas,
}) {
  const alvo = Number.isFinite(precoAlvo) && precoAlvo > 0 ? precoAlvo : NaN
  const pronto = series.length > 0 && precoAtual > 0 && Number.isFinite(alvo) && quantidade > 0

  const compras = useMemo(
    () => (pronto ? melhoresCompras(series, { precoAlvo: alvo, quantidade }) : []),
    [pronto, series, alvo, quantidade],
  )
  const vendas = useMemo(
    () => (pronto ? melhoresVendas(series, { precoAlvo: alvo, quantidade }) : []),
    [pronto, series, alvo, quantidade],
  )
  const travas = useMemo(
    () => (pronto ? melhoresTravas(series, { precoAlvo: alvo, precoAtual, quantidade }) : []),
    [pronto, series, alvo, precoAtual, quantidade],
  )

  const variacaoDoAlvo = precoAtual > 0 ? ((alvo - precoAtual) / precoAtual) * 100 : NaN

  return (
    <section className="cartao" aria-labelledby="titulo-oportunidades">
      <h2 id="titulo-oportunidades">Comparar séries sob um alvo</h2>

      <p className="alerta">
        <strong>Leia antes de usar.</strong> Isto não diz qual opção vai dar lucro —
        ninguém sabe o preço futuro. O ranking responde uma pergunta condicional:
        <em> se o ativo terminar no alvo que você digitou</em>, qual série teria rendido
        mais. Se o alvo estiver errado, o ranking está errado junto.
      </p>

      {series.length === 0 ? (
        <p className="ajuda">
          Carregue a cadeia de opções de um vencimento (acima) para comparar as séries.
        </p>
      ) : (
        <>
          <div className="campo">
            <label htmlFor="preco-alvo">Seu preço-alvo no vencimento (R$)</label>
            <input
              id="preco-alvo"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={aoMudarAlvo.valor}
              onChange={(e) => aoMudarAlvo.definir(e.target.value)}
            />
            <span className="ajuda">
              {Number.isFinite(variacaoDoAlvo)
                ? `${variacaoDoAlvo >= 0 ? 'Alta' : 'Queda'} de ${emPorcento(Math.abs(variacaoDoAlvo))} sobre os R$ ${emPreco(precoAtual)} de hoje. É um palpite seu.`
                : 'Digite o preço que você acha que o ativo terá no vencimento.'}
            </span>
          </div>

          <div className="atalhos-alvo">
            {[-0.1, -0.05, 0, 0.05, 0.1].map((v) => (
              <button
                key={v}
                type="button"
                className="botao-secundario"
                onClick={() => aoMudarAlvo.definir(emPreco(precoAtual * (1 + v)))}
              >
                {v === 0 ? 'parado' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`}
              </button>
            ))}
          </div>

          <Bloco
            titulo="Melhor compra"
            explicacao="Entrando pelo ask, maior retorno sobre o custo se o alvo se confirmar."
            vazio="Nenhuma compra dá lucro nesse alvo. É esperado quando o alvo está perto do preço de hoje: opção comprada precisa de movimento para pagar o prêmio."
            itens={compras}
            renderizar={(c) => (
              <>
                <Linha
                  codigo={c.serie.codigo}
                  detalhe={`${c.serie.tipo} strike ${emPreco(c.serie.strike)} · ask ${emPreco(c.serie.ask)}`}
                  resultado={c.resultado}
                  destaque={emPorcento(c.retorno, 0)}
                />
                <p className="cartao-nota">
                  Custo {emReais(c.custo)} · empata em R$ {emPreco(c.breakEven)} ·
                  perda máxima {emReais(c.custo)} · spread na entrada {emReais(c.spread)}
                </p>
              </>
            )}
            aoUsar={aoUsarPernas}
          />

          <Bloco
            titulo="Melhor venda"
            explicacao="Séries que virariam pó no alvo com pelo menos 5% de folga até o strike, da que paga mais prêmio para a que paga menos. A folga existe porque o maior prêmio é sempre da opção mais perto de ser exercida."
            vazio="Nenhuma venda vira pó nesse alvo com folga de 5% até o strike."
            itens={vendas}
            renderizar={(v) => (
              <>
                <Linha
                  codigo={v.serie.codigo}
                  detalhe={`${v.serie.tipo} strike ${emPreco(v.serie.strike)} · bid ${emPreco(v.serie.bid)}`}
                  resultado={v.resultado}
                  destaque={`colchão ${emPorcento(v.colchao, 0)}`}
                />
                <p className={v.perdaIlimitada ? 'aviso' : 'cartao-nota'}>
                  {v.perdaIlimitada
                    ? '⚠️ Call vendida a descoberto: se o ativo disparar, a perda não tem teto. Exige margem na corretora.'
                    : `Perda máxima ${emReais(Math.abs(v.perdaMaxima))} se o ativo for a zero.`}
                  {' '}Empata em R$ {emPreco(v.breakEven)}.
                </p>
              </>
            )}
            aoUsar={aoUsarPernas}
          />

          <Bloco
            titulo="Melhor estratégia (trava)"
            explicacao="Compra um strike e vende outro: barateia a entrada e põe teto na perda, em troca de teto no ganho."
            vazio="Nenhuma trava com lucro nesse alvo — normalmente falta liquidez nos dois strikes ao mesmo tempo."
            itens={travas}
            renderizar={(t) => (
              <>
                <Linha
                  codigo={`${t.compra.codigo} + venda ${t.venda.codigo}`}
                  detalhe={`trava de ${t.direcao} com ${t.tipo} · strikes ${emPreco(t.compra.strike)} → ${emPreco(t.venda.strike)}`}
                  resultado={t.resultado}
                  destaque={emPorcento(t.retorno, 0)}
                />
                <p className="cartao-nota">
                  Custo {emReais(t.custo)} · ganho máximo {emReais(t.ganhoMaximo)} ·
                  perda máxima {emReais(t.custo)} · empata em R$ {emPreco(t.breakEven)}
                </p>
              </>
            )}
            aoUsar={aoUsarPernas}
          />

          <p className="ajuda">
            Só entram séries com giro no pregão e com preço no lado do book que interessa —
            um preço ótimo numa opção que ninguém negocia não serve para nada. Ainda assim,
            os preços são de fechamento: confira o book antes de operar.
          </p>
        </>
      )}
    </section>
  )
}

function Bloco({ titulo, explicacao, vazio, itens, renderizar, aoUsar }) {
  return (
    <div className="bloco-oportunidade">
      <h3>{titulo}</h3>
      <p className="ajuda">{explicacao}</p>
      {itens.length === 0 ? (
        <p className="ajuda">{vazio}</p>
      ) : (
        <ol className="lista-oportunidades">
          {itens.map((item, i) => (
            <li key={i}>
              {renderizar(item)}
              <button
                type="button"
                className="botao-texto"
                onClick={() => aoUsar(item.pernas, item.serie || item.compra)}
              >
                carregar no gráfico →
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Linha({ codigo, detalhe, resultado, destaque }) {
  return (
    <div className="linha-oportunidade">
      <div>
        <strong className="codigo-serie">{codigo}</strong>
        <span className="cartao-nota"> {detalhe}</span>
      </div>
      <div className="valor-oportunidade">
        <strong className={resultado >= 0 ? 'ganho' : 'perda'}>{emReaisComSinal(resultado)}</strong>
        <span className="cartao-nota"> {destaque}</span>
      </div>
    </div>
  )
}
