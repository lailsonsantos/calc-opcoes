// Versão Vercel da mesma função — rota: /api/cotacao?ticker=BBAS3
// Só é usada se você publicar na Vercel em vez do Cloudflare Pages.
// (Pode manter os dois arquivos no repositório: cada plataforma ignora o do outro.)
//
// Onde colocar o token:
//   Vercel → seu projeto → Settings → Environment Variables →
//   adicione BRAPI_TOKEN (Production + Preview) e refaça o deploy.

const TICKER_VALIDO = /^[A-Z]{4}\d{1,2}$/

export default async function handler(req, res) {
  const ticker = String(req.query.ticker || '').toUpperCase().trim()

  if (!TICKER_VALIDO.test(ticker)) {
    return res.status(400).json({ erro: 'Ticker inválido.' })
  }

  const token = process.env.BRAPI_TOKEN
  const cabecalhos = { Accept: 'application/json' }
  if (token) cabecalhos.Authorization = `Bearer ${token}`

  let resposta
  try {
    resposta = await fetch(`https://brapi.dev/api/quote/${ticker}`, { headers: cabecalhos })
  } catch {
    return res.status(502).json({ erro: 'Não consegui falar com a brapi. Tente de novo.' })
  }

  if ([401, 402, 403].includes(resposta.status)) {
    return res.status(401).json({
      erro: token
        ? `O token da brapi não cobre ${ticker}. Digite o preço manualmente.`
        : `${ticker} exige token. Configure BRAPI_TOKEN na hospedagem.`,
    })
  }

  const dados = await resposta.json().catch(() => null)
  const resultado = dados?.results?.[0]

  if (!resposta.ok || typeof resultado?.regularMarketPrice !== 'number') {
    return res.status(502).json({ erro: dados?.message || `Sem cotação para ${ticker}.` })
  }

  res.setHeader('Cache-Control', 'public, max-age=60')
  return res.status(200).json({
    ticker: resultado.symbol || ticker,
    preco: resultado.regularMarketPrice,
    atualizadoEm: resultado.regularMarketTime || new Date().toISOString(),
  })
}
