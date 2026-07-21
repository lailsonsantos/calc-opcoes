// Versão Vercel da função de cadeia de opções. Ver functions/api/opcoes.js
// para a explicação — esta é a mesma coisa na API da Vercel.

const TICKER_VALIDO = /^[A-Z]{4}\d{1,2}$/
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export default async function handler(req, res) {
  const underlying = String(req.query.underlying || '').toUpperCase().trim()
  const vencimento = String(req.query.vencimento || '').trim()

  if (!TICKER_VALIDO.test(underlying)) {
    return res.status(400).json({ erro: 'Ativo inválido.' })
  }
  if (vencimento && !DATA_VALIDA.test(vencimento)) {
    return res.status(400).json({ erro: 'Vencimento inválido.' })
  }

  const url = vencimento
    ? `https://brapi.dev/api/v2/options/chain?underlying=${underlying}&expirationDate=${vencimento}`
    : `https://brapi.dev/api/v2/options/expirations?underlying=${underlying}`

  const cabecalhos = { Accept: 'application/json' }
  if (process.env.BRAPI_TOKEN) {
    cabecalhos.Authorization = `Bearer ${process.env.BRAPI_TOKEN}`
  }

  let resposta
  try {
    resposta = await fetch(url, { headers: cabecalhos })
  } catch {
    return res.status(502).json({ erro: 'Não consegui falar com a brapi. Tente de novo.' })
  }

  if ([401, 402, 403].includes(resposta.status)) {
    return res.status(401).json({
      erro: `A cadeia de opções de ${underlying} não está liberada no seu plano da brapi `
        + '(sem token, só PETR4 funciona). Preencha os dados da opção à mão.',
    })
  }

  const dados = await resposta.json().catch(() => null)
  if (!resposta.ok || !dados) {
    return res.status(502).json({ erro: dados?.error?.message || `Sem dados de opções para ${underlying}.` })
  }

  res.setHeader('Cache-Control', 'public, max-age=900')
  return res.status(200).json(
    vencimento
      ? { underlying, vencimento, dataDosPrecos: dados.date, series: enxugar(dados.series) }
      : { underlying, vencimentos: dados.expirations || [] },
  )
}

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
