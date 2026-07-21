// Montagem de estratégias e comparação de séries da cadeia de opções.
//
// LEIA ISTO ANTES DE CONFIAR NO RANKING:
//
// Não existe cálculo que diga qual opção vai dar lucro — isso dependeria de
// saber o preço futuro do ativo, que ninguém sabe. O que este arquivo faz é
// responder a uma pergunta CONDICIONAL:
//
//   "SE o ativo terminar no preço-alvo que EU escolhi, qual série teria dado
//    o melhor resultado?"
//
// A resposta é aritmética, não previsão. Se o alvo estiver errado, o ranking
// inteiro está errado junto. Por isso o alvo é um campo que você preenche, e
// nunca um palpite da ferramenta.

import { breakEvensDaEstrategia, extremosDaEstrategia, resultadoDaEstrategia } from './payoff.js'

/** Quantas séries de cada lado entram no cruzamento de travas. */
const MAX_CANDIDATAS_TRAVA = 40

/**
 * Folga mínima, em %, entre o alvo e o strike para uma venda entrar no ranking.
 *
 * Sem este piso o ranking vira armadilha: quem paga mais prêmio é sempre a
 * opção mais perto do dinheiro, ou seja, a mais provável de ser exercida.
 * Ordenar só por prêmio empurraria você para a venda mais arriscada da lista.
 */
const COLCHAO_MINIMO = 5

/**
 * Só entram séries que dá para negociar de verdade: com preço no lado do
 * book que interessa e com giro no pregão. Ranking cheio de série parada é
 * ranking inútil — o preço "bom" é de uma opção que ninguém negocia.
 */
function negociaveis(series, lado) {
  return series.filter((s) => {
    if (!(s.volume > 0)) return false
    return lado === 'compra' ? s.ask > 0 : s.bid > 0
  })
}

function perna(serie, posicao, quantidade) {
  return {
    tipo: serie.tipo,
    posicao,
    strike: serie.strike,
    premio: posicao === 'comprada' ? serie.ask : serie.bid,
    quantidade,
  }
}

function proximasDoDinheiro(series, precoAtual, limite) {
  return [...series]
    .sort((a, b) => Math.abs(a.strike - precoAtual) - Math.abs(b.strike - precoAtual))
    .slice(0, limite)
}

/**
 * Melhores COMPRAS sob o alvo: quanto cada série renderia, entrando pelo ask.
 * Só entram as que dão lucro no alvo.
 */
export function melhoresCompras(series, { precoAlvo, quantidade, limite = 3 }) {
  const candidatas = negociaveis(series, 'compra')

  return candidatas
    .map((serie) => {
      const pernas = [perna(serie, 'comprada', quantidade)]
      const custo = serie.ask * quantidade
      const resultado = resultadoDaEstrategia(pernas, precoAlvo)
      return {
        serie,
        pernas,
        custo,
        resultado,
        retorno: custo > 0 ? (resultado / custo) * 100 : NaN,
        breakEven: breakEvensDaEstrategia(pernas)[0],
        spread: (serie.ask - serie.bid) * quantidade,
      }
    })
    .filter((c) => c.resultado > 0 && Number.isFinite(c.retorno))
    .sort((a, b) => b.retorno - a.retorno)
    .slice(0, limite)
}

/**
 * Melhores VENDAS sob o alvo: séries que virariam pó no alvo, ordenadas pelo
 * prêmio recebido. O "colchão" é a distância entre o alvo e o strike — é ele
 * que diz quanto o ativo pode andar contra antes de a venda começar a doer.
 */
export function melhoresVendas(series, { precoAlvo, quantidade, limite = 3 }) {
  const candidatas = negociaveis(series, 'venda')

  return candidatas
    .map((serie) => {
      const pernas = [perna(serie, 'vendida', quantidade)]
      const premio = serie.bid * quantidade
      const resultado = resultadoDaEstrategia(pernas, precoAlvo)
      const extremos = extremosDaEstrategia(pernas)

      // Quanto o ativo pode andar contra você antes de a opção virar exercício.
      const colchao = serie.tipo === 'CALL'
        ? ((serie.strike - precoAlvo) / precoAlvo) * 100
        : ((precoAlvo - serie.strike) / precoAlvo) * 100

      return {
        serie,
        pernas,
        premio,
        resultado,
        colchao,
        perdaIlimitada: extremos.perdaIlimitada,
        perdaMaxima: extremos.perdaMaxima,
        breakEven: breakEvensDaEstrategia(pernas)[0],
      }
    })
    // Só as que expiram sem valor no alvo, e com folga de sobra até o strike.
    .filter((v) => v.colchao >= COLCHAO_MINIMO && v.resultado >= v.premio - 1e-9)
    .sort((a, b) => b.premio - a.premio)
    .slice(0, limite)
}

/**
 * Melhores TRAVAS (dois strikes do mesmo tipo) sob o alvo.
 *
 * A trava troca ganho ilimitado por risco limitado: você compra um strike e
 * vende outro, o que barateia a entrada e põe teto na perda. É por isso que
 * ela costuma aparecer melhor que a compra seca quando o alvo é moderado.
 */
export function melhoresTravas(series, { precoAlvo, precoAtual, quantidade, limite = 3 }) {
  const resultados = []

  for (const tipo of ['CALL', 'PUT']) {
    const doTipo = series.filter((s) => s.tipo === tipo)
    const perto = proximasDoDinheiro(doTipo, precoAtual, MAX_CANDIDATAS_TRAVA)

    for (const compra of perto) {
      if (!(compra.ask > 0) || !(compra.volume > 0)) continue

      for (const venda of perto) {
        if (!(venda.bid > 0) || !(venda.volume > 0)) continue
        if (compra.strike === venda.strike) continue

        // Trava de alta usa call com venda acima; trava de baixa, put com
        // venda abaixo. O contrário é a mesma coisa com o sinal trocado.
        const ehAlta = tipo === 'CALL' && venda.strike > compra.strike
        const ehBaixa = tipo === 'PUT' && venda.strike < compra.strike
        if (!ehAlta && !ehBaixa) continue

        const debitoUnitario = compra.ask - venda.bid
        if (!(debitoUnitario > 0)) continue // dado ruim ou trava de crédito

        const largura = Math.abs(venda.strike - compra.strike)
        const ganhoMaximoUnitario = largura - debitoUnitario
        if (!(ganhoMaximoUnitario > 0)) continue // paga mais que o teto: nunca vale

        const pernas = [
          perna(compra, 'comprada', quantidade),
          perna(venda, 'vendida', quantidade),
        ]
        const custo = debitoUnitario * quantidade
        const resultado = resultadoDaEstrategia(pernas, precoAlvo)

        resultados.push({
          tipo,
          direcao: ehAlta ? 'alta' : 'baixa',
          compra,
          venda,
          pernas,
          custo,
          resultado,
          retorno: (resultado / custo) * 100,
          ganhoMaximo: ganhoMaximoUnitario * quantidade,
          breakEven: breakEvensDaEstrategia(pernas)[0],
        })
      }
    }
  }

  return resultados
    .filter((t) => t.resultado > 0 && Number.isFinite(t.retorno))
    .sort((a, b) => b.retorno - a.retorno)
    .slice(0, limite)
}

// --- Montagens prontas ----------------------------------------------------

function maisProxima(series, tipo, strikeAlvo) {
  const doTipo = series.filter((s) => s.tipo === tipo && s.volume > 0)
  if (doTipo.length === 0) return null
  return doTipo.reduce((a, b) =>
    Math.abs(b.strike - strikeAlvo) < Math.abs(a.strike - strikeAlvo) ? b : a,
  )
}

export const PRESETS = [
  { id: 'trava-alta', nome: 'Trava de alta', resumo: 'compra call e vende call acima — risco limitado' },
  { id: 'trava-baixa', nome: 'Trava de baixa', resumo: 'compra put e vende put abaixo — risco limitado' },
  { id: 'straddle', nome: 'Straddle', resumo: 'compra call e put no mesmo strike — aposta em movimento forte' },
  { id: 'strangle', nome: 'Strangle', resumo: 'compra call acima e put abaixo — mais barato que o straddle' },
]

/**
 * Monta um preset com as séries reais da cadeia carregada.
 * Retorna as pernas, ou null quando faltam séries negociáveis.
 */
export function montarPreset(id, series, precoAtual, quantidade) {
  if (!series?.length || !(precoAtual > 0)) return null

  const pegar = (tipo, strikeAlvo, posicao) => {
    const s = maisProxima(series, tipo, strikeAlvo)
    if (!s) return null
    const premio = posicao === 'comprada' ? s.ask : s.bid
    if (!(premio > 0)) return null
    return perna(s, posicao, quantidade)
  }

  const montagens = {
    'trava-alta': () => [
      pegar('CALL', precoAtual, 'comprada'),
      pegar('CALL', precoAtual * 1.07, 'vendida'),
    ],
    'trava-baixa': () => [
      pegar('PUT', precoAtual, 'comprada'),
      pegar('PUT', precoAtual * 0.93, 'vendida'),
    ],
    straddle: () => [
      pegar('CALL', precoAtual, 'comprada'),
      pegar('PUT', precoAtual, 'comprada'),
    ],
    strangle: () => [
      pegar('CALL', precoAtual * 1.05, 'comprada'),
      pegar('PUT', precoAtual * 0.95, 'comprada'),
    ],
  }

  const pernas = montagens[id]?.()
  if (!pernas || pernas.some((p) => !p)) return null

  // Duas pernas no mesmo strike e tipo não formam trava nenhuma.
  if (pernas.length === 2 && pernas[0].strike === pernas[1].strike && pernas[0].tipo === pernas[1].tipo) {
    return null
  }
  return pernas
}
