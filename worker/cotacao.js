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

  // v2 é o endpoint que a brapi recomenda para integrações novas. O v1
  // (/api/quote/{ticker}) continua no ar, mas sem previsão de manutenção.
  const { resposta, dados } = await pedirBrapi(
    `https://brapi.dev/api/v2/stocks/quote?symbols=${ticker}`,
    env,
  )

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

  // O v2 aninha os campos em results[0].data; o v1 os deixa na raiz.
  // Aceitar os dois formatos evita quebrar se a resposta mudar de lado.
  const bruto = dados?.results?.[0]
  const resultado = bruto?.data || bruto

  if (!resposta.ok || typeof resultado?.regularMarketPrice !== 'number') {
    return json({ erro: dados?.message || `Sem cotação para ${ticker}.` }, 502)
  }

  return json(
    {
      ticker: bruto?.symbol || ticker,
      preco: resultado.regularMarketPrice,
      atualizadoEm: resultado.regularMarketTime || new Date().toISOString(),
    },
    200,
    // O dado gratuito já vem com atraso; 60s de cache poupa a cota mensal.
    { 'Cache-Control': 'public, max-age=60' },
  )
}
