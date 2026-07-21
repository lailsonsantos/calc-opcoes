// Fase 8: simulações salvas no próprio navegador (localStorage).
// Sem conta, sem backend — os dados ficam só neste aparelho.

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

export function listarSimulacoes() {
  return ler().sort((a, b) => (b.salvoEm || '').localeCompare(a.salvoEm || ''))
}

/** Salva (ou sobrescreve, se o nome já existir) e devolve a lista atualizada. */
export function salvarSimulacao(nome, dados) {
  const limpo = nome.trim()
  if (!limpo) return listarSimulacoes()

  const lista = ler().filter((s) => s.nome.toLowerCase() !== limpo.toLowerCase())
  lista.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: limpo,
    salvoEm: new Date().toISOString(),
    dados,
  })
  gravar(lista)
  return listarSimulacoes()
}

export function apagarSimulacao(id) {
  gravar(ler().filter((s) => s.id !== id))
  return listarSimulacoes()
}
