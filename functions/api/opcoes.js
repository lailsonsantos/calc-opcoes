// Cloudflare Pages Function — cadeia de opções.
//
//   /api/opcoes?underlying=PETR4                       -> lista de vencimentos
//   /api/opcoes?underlying=PETR4&vencimento=2026-08-21 -> séries daquele vencimento
//
// Igual à /api/cotacao, existe para o token da brapi ficar no servidor.
//
// ATENÇÃO ao plano: sem token, a brapi só aceita PETR4 (sandbox). As demais
// ações exigem o plano Pro — um token do plano grátis devolve 401 aqui.

const TICKER_VALIDO = /^[A-Z]{4}\d{1,2}$/
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams
  const underlying = (params.get('underlying') || '').toUpperCase().trim()
  const vencimento = (params.get('vencimento') || '').trim()

  if (!TICKER_VALIDO.test(underlying)) {
    return json({ erro: 'Ativo inválido.' }, 400)
  }
  if (vencimento && !DATA_VALIDA.test(vencimento)) {
    return json({ erro: 'Vencimento inválido.' }, 400)
  }

  const url = vencimento
    ? `https://brapi.dev/api/v2/options/chain?underlying=${underlying}&expirationDate=${vencimento}`
    : `https://brapi.dev/api/v2/options/expirations?underlying=${underlying}`

  const cabecalhos = { Accept: 'application/json' }
  if (env.BRAPI_TOKEN) cabecalhos.Authorization = `Bearer ${env.BRAPI_TOKEN}`

  let resposta
  try {
    resposta = await fetch(url, { headers: cabecalhos })
  } catch {
    return json({ erro: 'Não consegui falar com a brapi. Tente de novo.' }, 502)
  }

  if (resposta.status === 401 || resposta.status === 402 || resposta.status === 403) {
    return json(
      {
        erro: `A cadeia de opções de ${underlying} não está liberada no seu plano da brapi `
          + '(sem token, só PETR4 funciona). Preencha os dados da opção à mão.',
      },
      401,
    )
  }

  const dados = await resposta.json().catch(() => null)
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

function json(corpo, status = 200, extras = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extras },
  })
}
