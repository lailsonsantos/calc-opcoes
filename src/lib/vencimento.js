// Data de vencimento: dias restantes e o aviso de "reta final".
//
// A ferramenta NÃO modela o theta (a perda de valor pelo tempo). O que ela faz
// é avisar: perto do vencimento, o prêmio derrete rápido e o resultado real
// se afasta do teórico calculado aqui.

/** Meia-noite local, para comparar datas sem o ruído do horário. */
function meiaNoite(data) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Dias CORRIDOS até o vencimento. Hoje = 0, ontem = -1.
 * Retorna NaN se a data for inválida ou vazia.
 */
export function diasAteVencimento(dataISO, hoje = new Date()) {
  if (!dataISO) return NaN
  // 'YYYY-MM-DD' parseia como UTC; o T00:00 força hora local.
  const alvo = meiaNoite(/^\d{4}-\d{2}-\d{2}$/.test(dataISO) ? `${dataISO}T00:00` : dataISO)
  if (Number.isNaN(alvo.getTime())) return NaN
  return Math.round((alvo - meiaNoite(hoje)) / 86400000)
}

/**
 * Classifica o prazo restante:
 *   'vencida'    — já passou
 *   'hoje'       — vence hoje
 *   'reta-final' — até 7 dias: o prêmio derrete rápido
 *   'curto'      — até 21 dias
 *   'tranquilo'  — mais que isso
 */
export function classificarPrazo(dias) {
  if (!Number.isFinite(dias)) return 'desconhecido'
  if (dias < 0) return 'vencida'
  if (dias === 0) return 'hoje'
  if (dias <= 7) return 'reta-final'
  if (dias <= 21) return 'curto'
  return 'tranquilo'
}

/** Frase curta para mostrar na tela. */
export function textoDoPrazo(dias) {
  switch (classificarPrazo(dias)) {
    case 'vencida':
      return `venceu há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}`
    case 'hoje':
      return 'vence hoje'
    case 'desconhecido':
      return 'sem data de vencimento'
    default:
      return `faltam ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  }
}

/** Aviso a mostrar, ou null quando não há o que alertar. */
export function avisoDoPrazo(dias) {
  switch (classificarPrazo(dias)) {
    case 'vencida':
      return 'Esta opção já venceu. O resultado abaixo é o do dia do vencimento.'
    case 'hoje':
      return 'Vence hoje: o prêmio já é praticamente só valor intrínseco.'
    case 'reta-final':
      return 'Reta final. Nos últimos dias o prêmio derrete rápido (theta), '
        + 'e vender antes do vencimento costuma render bem menos que o cálculo teórico.'
    default:
      return null
  }
}
