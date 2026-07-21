// Motor de cálculo do payoff de opções no vencimento.
// Funções puras: sem React, sem DOM. Podem rodar no Node (ver payoff.test.js).
//
// Convenção da "operação" usada em todo o arquivo:
//   { tipo: 'CALL'|'PUT', posicao: 'comprada'|'vendida',
//     strike: number, premio: number, quantidade: number }
//
// `premio` é sempre o prêmio EFETIVO de entrada por opção. Quem decide se ele
// vem do campo "prêmio" ou do ask/bid (fase 6) é quem monta a operação.

/** Valor intrínseco da opção no vencimento, por opção. */
export function valorIntrinseco(tipo, strike, precoFinal) {
  return tipo === 'CALL'
    ? Math.max(precoFinal - strike, 0)
    : Math.max(strike - precoFinal, 0)
}

/**
 * Lucro/prejuízo de UMA opção no preço final do ativo.
 * Comprada: intrínseco - prêmio pago.
 * Vendida: o inverso (recebe o prêmio, paga o intrínseco).
 */
export function resultadoPorOpcao(operacao, precoFinal) {
  const { tipo, posicao, strike, premio } = operacao
  const comoComprada = valorIntrinseco(tipo, strike, precoFinal) - premio
  return posicao === 'vendida' ? -comoComprada : comoComprada
}

/** Lucro/prejuízo TOTAL da posição (por opção × quantidade). */
export function resultadoTotal(operacao, precoFinal) {
  return resultadoPorOpcao(operacao, precoFinal) * operacao.quantidade
}

/**
 * Preço do ativo em que a operação empata.
 * CALL: strike + prêmio. PUT: strike - prêmio.
 * Vale para comprada e vendida (é o mesmo ponto, só muda o lado do lucro).
 */
export function breakEven({ tipo, strike, premio }) {
  return tipo === 'CALL' ? strike + premio : strike - premio
}

/**
 * Perda máxima da posição. Retorna { valor, ilimitada }.
 * `valor` é negativo (ou 0). Quando ilimitada, valor = -Infinity.
 */
export function perdaMaxima(operacao) {
  const { tipo, posicao, strike, premio, quantidade } = operacao

  if (posicao === 'comprada') {
    // Comprado só perde o que pagou.
    return { valor: -premio * quantidade, ilimitada: false }
  }
  if (tipo === 'CALL') {
    // Call vendida a descoberto: o ativo pode subir sem teto.
    return { valor: -Infinity, ilimitada: true }
  }
  // Put vendida: pior caso é o ativo ir a zero.
  return { valor: -(strike - premio) * quantidade, ilimitada: false }
}

/**
 * Ganho máximo da posição. Retorna { valor, ilimitado }.
 */
export function ganhoMaximo(operacao) {
  const { tipo, posicao, strike, premio, quantidade } = operacao

  if (posicao === 'vendida') {
    // Vendido, o melhor caso é a opção virar pó: fica com o prêmio.
    return { valor: premio * quantidade, ilimitado: false }
  }
  if (tipo === 'CALL') {
    // Call comprada: o ativo pode subir sem teto.
    return { valor: Infinity, ilimitado: true }
  }
  // Put comprada: melhor caso é o ativo ir a zero.
  return { valor: (strike - premio) * quantidade, ilimitado: false }
}

/**
 * Caixa no momento da entrada.
 * Comprada = débito (você paga). Vendida = crédito (você recebe).
 * Retorna sempre valor positivo + a natureza da operação.
 */
export function custoTotal({ posicao, premio, quantidade }) {
  return {
    valor: premio * quantidade,
    tipo: posicao === 'comprada' ? 'debito' : 'credito',
  }
}

/** Distância do strike em relação ao preço atual, em %. */
export function distanciaDoStrike(strike, precoAtual) {
  if (!precoAtual) return NaN
  return ((strike - precoAtual) / precoAtual) * 100
}

// --- Fase 6: spread (bid/ask) -------------------------------------------

/**
 * Quanto você perde se comprar no ask e vender imediatamente no bid.
 * Retorna { valor (negativo), percentual, porOpcao }.
 */
export function custoDeSaidaImediata({ bid, ask, quantidade }) {
  const porOpcao = ask - bid
  return {
    porOpcao,
    valor: -porOpcao * quantidade,
    percentual: ask > 0 ? (porOpcao / ask) * 100 : NaN,
  }
}

/** Spread alto = bid abaixo de 50% do ask (sinal de baixa liquidez). */
export function temSpreadAlto({ bid, ask }) {
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || ask <= 0) return false
  return bid < ask * 0.5
}

// --- Fase 4: série de pontos para o gráfico ------------------------------

/**
 * Gera os pontos [{ preco, resultado }] do gráfico de payoff.
 * Faixa padrão: 25% abaixo até 25% acima do preço atual.
 * O strike e o break-even entram como pontos exatos para o "bico" do
 * gráfico ficar afiado em vez de arredondado pela amostragem.
 */
export function serieDePayoff(operacao, precoAtual, opcoes = {}) {
  const { faixa = 0.25, pontos = 51 } = opcoes

  const centro = Number.isFinite(precoAtual) && precoAtual > 0
    ? precoAtual
    : operacao.strike

  let minimo = Math.max(centro * (1 - faixa), 0)
  let maximo = centro * (1 + faixa)

  // Garante que strike e break-even apareçam dentro da faixa desenhada.
  const be = breakEven(operacao)
  for (const marco of [operacao.strike, be]) {
    if (Number.isFinite(marco)) {
      minimo = Math.min(minimo, marco * 0.98)
      maximo = Math.max(maximo, marco * 1.02)
    }
  }
  minimo = Math.max(minimo, 0)
  if (maximo <= minimo) maximo = minimo + 1

  const passo = (maximo - minimo) / (pontos - 1)
  const precos = []
  for (let i = 0; i < pontos; i++) precos.push(minimo + passo * i)
  for (const marco of [operacao.strike, be, precoAtual]) {
    if (Number.isFinite(marco) && marco >= minimo && marco <= maximo) {
      precos.push(marco)
    }
  }

  return precos
    .sort((a, b) => a - b)
    .filter((p, i, arr) => i === 0 || Math.abs(p - arr[i - 1]) > 1e-9)
    .map((preco) => ({ preco, resultado: resultadoTotal(operacao, preco) }))
}

/**
 * Resultado em cenários de variação do ativo (ex.: [-0.1, 0, 0.05, 0.1]).
 * Retorna [{ variacao, preco, resultado }].
 */
export function cenarios(operacao, precoAtual, variacoes = [0.05, 0.1]) {
  return variacoes.map((variacao) => {
    const preco = precoAtual * (1 + variacao)
    return { variacao, preco, resultado: resultadoTotal(operacao, preco) }
  })
}
