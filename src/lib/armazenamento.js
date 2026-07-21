// Opções salvas no próprio navegador (localStorage).
// Sem conta, sem backend — os dados ficam só neste aparelho.
//
// O IDENTIFICADOR é o código da opção (ex.: BBASG198W4). Salvar de novo o
// mesmo código atualiza a posição em vez de criar uma duplicada — é o que
// permite usar a lista como acompanhamento da carteira.

const CHAVE = 'calc-opcoes:simulacoes'

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    const lista = bruto ? JSON.parse(bruto) : []
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function gravar(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
    return true
  } catch {
    return false // modo privado / cota cheia
  }
}

function ordenar(lista) {
  return [...lista].sort((a, b) => (b.salvoEm || '').localeCompare(a.salvoEm || ''))
}

export function listarSimulacoes() {
  return ordenar(ler())
}

/**
 * Salva a posição sob o código da opção.
 * `precoEntrada` é congelado aqui: é o que você pagou, e não muda depois.
 * `dados.precoAtivo` continua vivo — é ele que a atualização de cotação mexe.
 */
export function salvarSimulacao(codigo, dados, precoEntrada) {
  const id = String(codigo || '').trim().toUpperCase()
  if (!id) return listarSimulacoes()

  const lista = ler().filter((s) => s.id !== id)
  const anterior = ler().find((s) => s.id === id)

  lista.push({
    id,
    codigo: id,
    salvoEm: new Date().toISOString(),
    criadoEm: anterior?.criadoEm || new Date().toISOString(),
    precoEntrada,
    dados,
  })
  gravar(lista)
  return listarSimulacoes()
}

export function apagarSimulacao(id) {
  gravar(ler().filter((s) => s.id !== id))
  return listarSimulacoes()
}

/** Tickers distintos entre as posições salvas — para atualizar as cotações. */
export function tickersSalvos() {
  return [...new Set(ler().map((s) => s.dados?.ticker).filter(Boolean))]
}

/** Aplica um preço novo do ativo a todas as posições daquele ticker. */
export function atualizarPrecoDoAtivo(ticker, preco, quando = new Date().toISOString()) {
  const lista = ler().map((s) =>
    s.dados?.ticker === ticker
      ? { ...s, cotadoEm: quando, dados: { ...s.dados, precoAtivo: String(preco) } }
      : s,
  )
  gravar(lista)
  return listarSimulacoes()
}
