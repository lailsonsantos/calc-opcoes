// Cloudflare Pages Function — rota: /api/cotacao?ticker=BBAS3
//
// Existe por um motivo só: guardar o token da brapi do lado do servidor.
// O celular chama esta função; ela chama a brapi com o token e devolve
// apenas o preço e o horário. O token nunca chega ao navegador.
//
// Onde colocar o token:
//   Cloudflare → Workers & Pages → seu projeto → Settings →
//   Variables and Secrets → adicione BRAPI_TOKEN como "Secret".
//   (Faça isso para Production e para Preview.)

const TICKER_VALIDO = /^[A-Z]{4}\d{1,2}$/

export async function onRequestGet({ request, env }) {
  const ticker = (new URL(request.url).searchParams.get('ticker') || '').toUpperCase().trim()

  if (!TICKER_VALIDO.test(ticker)) {
    return json({ erro: 'Ticker inválido.' }, 400)
  }

  const url = new URL(`https://brapi.dev/api/quote/${ticker}`)
  const cabecalhos = { Accept: 'application/json' }
  if (env.BRAPI_TOKEN) {
    cabecalhos.Authorization = `Bearer ${env.BRAPI_TOKEN}`
  }

  let resposta
  try {
    resposta = await fetch(url, { headers: cabecalhos })
  } catch {
    return json({ erro: 'Não consegui falar com a brapi. Tente de novo.' }, 502)
  }

  if (resposta.status === 401 || resposta.status === 402 || resposta.status === 403) {
    return json(
      {
        erro: env.BRAPI_TOKEN
          ? `O token da brapi não cobre ${ticker}. Digite o preço manualmente.`
          : `${ticker} exige token. Configure BRAPI_TOKEN na hospedagem.`,
      },
      401,
    )
  }

  const dados = await resposta.json().catch(() => null)
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
    // Dado gratuito já vem com atraso; 60s de cache poupa requisições da cota.
    { 'Cache-Control': 'public, max-age=60' },
  )
}

function json(corpo, status = 200, extras = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extras },
  })
}
