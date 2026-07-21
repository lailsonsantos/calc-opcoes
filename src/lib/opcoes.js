// Busca da cadeia de opções, com a mesma estratégia em duas camadas da cotação:
// primeiro a nossa função serverless (que tem o token), depois a brapi direto.
//
// Sem token, a brapi só libera PETR4. As demais ações precisam do plano Pro.

import { ErroDeCotacao } from './cotacao.js'

const BASE_BRAPI = 'https://brapi.dev/api/v2/options'

/** Cadeia de opções livre para consulta sem token nenhum. */
export const ATIVOS_COM_OPCOES_GRATIS = ['PETR4']

export function cadeiaEhGratis(ticker) {
  return ATIVOS_COM_OPCOES_GRATIS.includes(ticker)
}

function tokenDeDesenvolvimento() {
  return import.meta.env.DEV ? import.meta.env.VITE_BRAPI_TOKEN : undefined
}

async function lerJson(resposta) {
  const contentType = resposta.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    return await resposta.json()
  } catch {
    return null
  }
}

const erroDePlano = (ticker) =>
  new ErroDeCotacao(
    `A cadeia de opções de ${ticker} exige o plano Pro da brapi. `
      + 'Sem token, só PETR4 funciona — preencha os dados da opção à mão.',
    { precisaToken: true },
  )

/** Camada 1: função própria. Retorna null quando a rota não existe (dev local). */
async function viaFuncaoPropria(params, signal) {
  let resposta
  try {
    resposta = await fetch(`/api/opcoes?${params}`, { signal })
  } catch {
    return null
  }

  const dados = await lerJson(resposta)
  if (!dados) return null

  if (!resposta.ok) {
    throw new ErroDeCotacao(dados.erro || 'Falha ao buscar as opções.', {
      precisaToken: resposta.status === 401,
    })
  }
  return dados
}

/** Camada 2: brapi direto. Só passa para PETR4 (ou com token de dev). */
async function viaBrapiDireto(caminho, params, ticker, signal) {
  const token = tokenDeDesenvolvimento()
  const url = `${BASE_BRAPI}/${caminho}?${params}`

  let resposta
  try {
    resposta = await fetch(url, {
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ErroDeCotacao('Sem conexão com a brapi.')
  }

  if ([401, 402, 403].includes(resposta.status)) throw erroDePlano(ticker)

  const dados = await lerJson(resposta)
  if (!resposta.ok || !dados) {
    throw new ErroDeCotacao(`Não consegui as opções de ${ticker}.`)
  }
  return dados
}

/** Lista as datas de vencimento negociadas do ativo. */
export async function buscarVencimentos(ticker, { signal } = {}) {
  const params = new URLSearchParams({ underlying: ticker })

  const daFuncao = await viaFuncaoPropria(params, signal)
  if (daFuncao) return daFuncao.vencimentos || []

  const direto = await viaBrapiDireto('expirations', params, ticker, signal)
  return direto.expirations || []
}

/** Lista as séries de um vencimento, já enxutas e ordenadas por strike. */
export async function buscarSeries(ticker, vencimento, { signal } = {}) {
  const daFuncao = await viaFuncaoPropria(
    new URLSearchParams({ underlying: ticker, vencimento }),
    signal,
  )
  if (daFuncao) return { series: daFuncao.series || [], dataDosPrecos: daFuncao.dataDosPrecos }

  const direto = await viaBrapiDireto(
    'chain',
    new URLSearchParams({ underlying: ticker, expirationDate: vencimento }),
    ticker,
    signal,
  )
  return { series: enxugar(direto.series), dataDosPrecos: direto.date }
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
