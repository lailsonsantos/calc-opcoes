// Busca de cotação.
//
// Estratégia em duas camadas:
//  1. Tenta a função serverless própria (/api/cotacao) — é ela que guarda o
//     token da brapi em segredo e libera as 20 ações (fase 9).
//  2. Se a função não existir (ex.: `npm run dev` sem o wrangler), cai para a
//     chamada direta à brapi, que atende PETR4, VALE3, ITUB4 e MGLU3 sem token.

const URL_BRAPI = 'https://brapi.dev/api/v2/stocks/quote'

export class ErroDeCotacao extends Error {
  constructor(mensagem, { precisaToken = false } = {}) {
    super(mensagem)
    this.name = 'ErroDeCotacao'
    this.precisaToken = precisaToken
  }
}

/** Em dev, aceita um token local via .env.local (VITE_BRAPI_TOKEN). Nunca em produção. */
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

/** Camada 1: a nossa função serverless. Retorna null se ela não estiver no ar. */
async function viaFuncaoPropria(ticker, signal) {
  let resposta
  try {
    resposta = await fetch(`/api/cotacao?ticker=${encodeURIComponent(ticker)}`, { signal })
  } catch {
    return null // rede caiu ou rota inexistente
  }

  const dados = await lerJson(resposta)
  // Sem JSON = a rota não existe (o dev server devolve o index.html).
  if (!dados) return null

  if (!resposta.ok) {
    throw new ErroDeCotacao(dados.erro || `Falha ao buscar ${ticker}.`, {
      precisaToken: resposta.status === 401 || resposta.status === 402,
    })
  }
  return { preco: dados.preco, atualizadoEm: dados.atualizadoEm, origem: 'funcao' }
}

/** Camada 2: brapi direto do navegador. Só funciona nas 4 ações sem token. */
async function viaBrapiDireto(ticker, signal) {
  const token = tokenDeDesenvolvimento()
  const url = `${URL_BRAPI}?symbols=${encodeURIComponent(ticker)}`

  let resposta
  try {
    resposta = await fetch(url, {
      signal,
      // Só em dev: o token vai no header, nunca na URL (query string entra
      // em log de servidor e histórico do navegador).
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ErroDeCotacao('Sem conexão com a brapi. Digite o preço manualmente.')
  }

  if (resposta.status === 401 || resposta.status === 402 || resposta.status === 403) {
    throw new ErroDeCotacao(
      `${ticker} exige o token da brapi. Publique a função da fase 9 ou digite o preço manualmente.`,
      { precisaToken: true },
    )
  }

  const dados = await lerJson(resposta)
  // O v2 aninha em results[0].data; o v1 deixa na raiz. Aceita os dois.
  const bruto = dados?.results?.[0]
  const resultado = bruto?.data || bruto

  if (!resposta.ok || !resultado || typeof resultado.regularMarketPrice !== 'number') {
    throw new ErroDeCotacao(
      dados?.message || `Não consegui a cotação de ${ticker}. Digite o preço manualmente.`,
    )
  }

  return {
    preco: resultado.regularMarketPrice,
    atualizadoEm: resultado.regularMarketTime || new Date().toISOString(),
    origem: 'brapi',
  }
}

/**
 * Busca a cotação de um ticker.
 * Retorna { preco, atualizadoEm, origem }. Lança ErroDeCotacao em caso de falha.
 */
export async function buscarCotacao(ticker, { signal } = {}) {
  const daFuncao = await viaFuncaoPropria(ticker, signal)
  if (daFuncao) return daFuncao
  return viaBrapiDireto(ticker, signal)
}
