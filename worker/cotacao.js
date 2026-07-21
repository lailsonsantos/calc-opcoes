// Rota /api/cotacao?ticker=PETR4 — preço do ativo.
//
// Sem token, a brapi atende só PETR4, VALE3, ITUB4 e MGLU3.
// O token grátis (BRAPI_TOKEN) libera as 20 ações da lista.

import { TICKER_VALIDO, json, pedirBrapi, semPermissao } from './brapi.js'

export async function cotacao(url, env) {
  const ticker = (url.searchParams.get('ticker') || '').toUpperCase().trim()

  if (!TICKER_VALIDO.test(ticker)) {
    return json({ erro: 'Ticker inválido.' }, 400)
  }

  const { resposta, dados } = await pedirBrapi(`https://brapi.dev/api/quote/${ticker}`, env)

  if (semPermissao(resposta)) {
    return json(
      {
        erro: env.BRAPI_TOKEN
          ? `O token da brapi não cobre ${ticker}. Digite o preço manualmente.`
          : `${ticker} exige token. Configure BRAPI_TOKEN na hospedagem.`,
      },
      401,
    )
  }

  const resultado = dados?.results?.[0]
  if (!resposta.ok || typeof resultado?.regularMarketPrice !== 'number') {
    return json({ erro: dados?.message || `Sem cotação para ${ticker}.` }, 502)
  }

  return json(
    {
      ticker: resultado.symbol || ticker,
      preco: resultado.regularMarketPrice,
      atualizadoEm: resultado.regularMarketTime || new Date().toISOString(),
    },
    200,
    // O dado gratuito já vem com atraso; 60s de cache poupa a cota mensal.
    { 'Cache-Control': 'public, max-age=60' },
  )
}
