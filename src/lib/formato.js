// Conversão e formatação de números no padrão brasileiro (vírgula decimal).

/**
 * Converte texto digitado pelo usuário em número.
 * Aceita "20,79", "20.79", "1.234,56" e "1,234.56".
 * Retorna NaN quando não dá para interpretar.
 */
export function paraNumero(texto) {
  if (typeof texto === 'number') return texto
  if (texto == null) return NaN

  const limpo = String(texto).trim().replace(/\s|R\$/g, '')
  if (limpo === '') return NaN

  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')

  let normalizado = limpo
  if (temVirgula && temPonto) {
    // O separador decimal é o que aparece por último; o outro é milhar.
    const decimal = limpo.lastIndexOf(',') > limpo.lastIndexOf('.') ? ',' : '.'
    const milhar = decimal === ',' ? '.' : ','
    normalizado = limpo.split(milhar).join('').replace(decimal, '.')
  } else if (temVirgula) {
    normalizado = limpo.replace(',', '.')
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : NaN
}

/** true quando o texto vira um número válido. */
export function ehNumero(texto) {
  return Number.isFinite(paraNumero(texto))
}

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 1234.5 -> "R$ 1.234,50". Aceita Infinity. */
export function emReais(valor) {
  if (!Number.isFinite(valor)) return valor > 0 ? 'ilimitado' : '—'
  return moeda.format(valor)
}

/** Mesmo que emReais, mas com sinal explícito (+/-) para resultados. */
export function emReaisComSinal(valor) {
  if (!Number.isFinite(valor)) return valor > 0 ? 'ilimitado' : '—'
  const prefixo = valor > 0 ? '+' : ''
  return prefixo + moeda.format(valor)
}

/** 12.345 -> "12,3%" */
export function emPorcento(valor, casas = 1) {
  if (!Number.isFinite(valor)) return '—'
  return `${valor.toFixed(casas).replace('.', ',')}%`
}

/** Preço curto para eixos do gráfico: 20.79 -> "20,79" */
export function emPreco(valor, casas = 2) {
  if (!Number.isFinite(valor)) return '—'
  return valor.toFixed(casas).replace('.', ',')
}

/** ISO ou epoch -> "21/07/2026 17:42" */
export function emDataHora(valor) {
  if (!valor) return ''
  const d = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
