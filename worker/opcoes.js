// Rota /api/opcoes — cadeia de opções.
//
//   ?underlying=PETR4                       -> lista de vencimentos
//   ?underlying=PETR4&vencimento=2026-08-21 -> séries daquele vencimento
//
// ATENÇÃO ao plano: sem token a brapi só aceita PETR4 (sandbox), e as demais
// ações exigem o plano Pro — um token do plano grátis NÃO basta aqui.

import { DATA_VALIDA, TICKER_VALIDO, json, pedirBrapi, semPermissao } from './brapi.js'

export async function opcoes(url, env) {
  const underlying = (url.searchParams.get('underlying') || '').toUpperCase().trim()
  const vencimento = (url.searchParams.get('vencimento') || '').trim()

  if (!TICKER_VALIDO.test(underlying)) {
    return json({ erro: 'Ativo inválido.' }, 400)
  }
  if (vencimento && !DATA_VALIDA.test(vencimento)) {
    return json({ erro: 'Vencimento inválido.' }, 400)
  }

  const alvo = vencimento
    ? `https://brapi.dev/api/v2/options/chain?underlying=${underlying}&expirationDate=${vencimento}`
    : `https://brapi.dev/api/v2/options/expirations?underlying=${underlying}`

  const { resposta, dados } = await pedirBrapi(alvo, env)

  if (semPermissao(resposta)) {
    // Com token configurado, o que falta é plano — não adianta mandar
    // configurar token de novo. Sem token, a dica é outra.
    return json(
      {
        erro: env.BRAPI_TOKEN
          ? `A cadeia de opções de ${underlying} exige o plano Pro da brapi, que seu `
            + 'token atual não cobre. Só PETR4 vem no plano grátis — preencha os dados '
            + 'da opção à mão.'
          : `A cadeia de opções de ${underlying} exige token e plano Pro. Sem token, `
            + 'só PETR4 funciona — preencha os dados da opção à mão.',
      },
      401,
    )
  }

  if (!resposta.ok || !dados) {
    return json({ erro: dados?.error?.message || `Sem dados de opções para ${underlying}.` }, 502)
  }

  const corpo = vencimento
    ? { underlying, vencimento, dataDosPrecos: dados.date, series: enxugar(dados.series) }
    : { underlying, vencimentos: dados.expirations || [] }

  // Dados de fechamento (EOD): não mudam durante o dia. Cache generoso.
  return json(corpo, 200, { 'Cache-Control': 'public, max-age=900' })
}

/** A brapi devolve ~290 séries com 18 campos. Só o que a calculadora usa. */
function enxugar(series) {
  return (series || [])
    .map((s) => ({
      codigo: s.symbol,
      tipo: s.side === 'put' ? 'PUT' : 'CALL',
      strike: s.strike,
      vencimento: s.expirationDate,
      fechamento: s.close,
      bid: s.bid,
      ask: s.ask,
      volume: s.volume,
      negocios: s.trades,
      ultimoPregao: s.lastTradeDate,
    }))
    .sort((a, b) => a.strike - b.strike)
}
