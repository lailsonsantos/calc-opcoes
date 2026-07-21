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

// =========================================================================
// Estratégias: várias pernas somadas (travas, straddles, o que você montar)
//
// Uma "perna" tem o mesmo formato de uma operação. Uma posição simples é
// só uma estratégia de uma perna — o app trata as duas do mesmo jeito.
// =========================================================================

/** Lucro/prejuízo somado de todas as pernas num preço final. */
export function resultadoDaEstrategia(pernas, precoFinal) {
  return pernas.reduce((soma, perna) => soma + resultadoTotal(perna, precoFinal), 0)
}

/**
 * Caixa na montagem: negativo = débito (você paga para montar),
 * positivo = crédito (você recebe).
 */
export function caixaDaEstrategia(pernas) {
  return pernas.reduce((soma, p) => {
    const valor = p.premio * p.quantidade
    return soma + (p.posicao === 'vendida' ? valor : -valor)
  }, 0)
}

/**
 * Inclinação do payoff para preços acima do maior strike.
 * Só as CALLs continuam ganhando/perdendo valor lá em cima.
 */
function inclinacaoAcima(pernas) {
  return pernas.reduce((s, p) => {
    if (p.tipo !== 'CALL') return s
    return s + (p.posicao === 'vendida' ? -1 : 1) * p.quantidade
  }, 0)
}

function strikesOrdenados(pernas) {
  return [...new Set(pernas.map((p) => p.strike))].sort((a, b) => a - b)
}

/**
 * Perda e ganho máximos da estratégia.
 *
 * O payoff é linear por partes e só "dobra" nos strikes — então os extremos
 * estão nos strikes, no zero, ou no infinito. Não precisa varrer nada.
 */
export function extremosDaEstrategia(pernas) {
  if (pernas.length === 0) {
    return { ganhoMaximo: 0, perdaMaxima: 0, ganhoIlimitado: false, perdaIlimitada: false }
  }

  const candidatos = [0, ...strikesOrdenados(pernas)]
  const valores = candidatos.map((p) => resultadoDaEstrategia(pernas, p))

  const inclinacao = inclinacaoAcima(pernas)
  return {
    ganhoMaximo: inclinacao > 0 ? Infinity : Math.max(...valores),
    perdaMaxima: inclinacao < 0 ? -Infinity : Math.min(...valores),
    ganhoIlimitado: inclinacao > 0,
    perdaIlimitada: inclinacao < 0,
  }
}

/**
 * Os preços em que a estratégia empata. Uma trava tem um; um straddle tem
 * dois; algumas montagens não têm nenhum.
 *
 * Cada trecho entre strikes é uma reta, então dá para achar o zero exato por
 * interpolação, sem varredura numérica.
 */
export function breakEvensDaEstrategia(pernas) {
  if (pernas.length === 0) return []

  const strikes = strikesOrdenados(pernas)
  const zeros = []

  // Trechos fechados: [0, k1], [k1, k2], ...
  const bordas = [0, ...strikes]
  for (let i = 0; i < bordas.length - 1; i++) {
    const a = bordas[i]
    const b = bordas[i + 1]
    const fa = resultadoDaEstrategia(pernas, a)
    const fb = resultadoDaEstrategia(pernas, b)
    if (fa === 0) zeros.push(a)
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      zeros.push(a + ((b - a) * -fa) / (fb - fa))
    }
  }

  // Última borda e o raio que vai dela até o infinito.
  const ultimo = bordas[bordas.length - 1]
  const fUltimo = resultadoDaEstrategia(pernas, ultimo)
  if (fUltimo === 0) zeros.push(ultimo)

  const inclinacao = inclinacaoAcima(pernas)
  if (inclinacao !== 0) {
    const cruzamento = ultimo - fUltimo / inclinacao
    if (cruzamento > ultimo) zeros.push(cruzamento)
  }

  return [...new Set(zeros.map((z) => Math.round(z * 1e6) / 1e6))].sort((a, b) => a - b)
}

/** Pontos [{ preco, resultado }] do gráfico da estratégia. */
export function serieDaEstrategia(pernas, precoAtual, opcoes = {}) {
  const { faixa = 0.25, pontos = 61 } = opcoes
  if (pernas.length === 0) return []

  const strikes = strikesOrdenados(pernas)
  const centro = Number.isFinite(precoAtual) && precoAtual > 0
    ? precoAtual
    : strikes[Math.floor(strikes.length / 2)]

  let minimo = Math.max(centro * (1 - faixa), 0)
  let maximo = centro * (1 + faixa)

  // Todo strike e todo break-even precisa caber no desenho.
  for (const marco of [...strikes, ...breakEvensDaEstrategia(pernas)]) {
    if (Number.isFinite(marco)) {
      minimo = Math.min(minimo, marco * 0.95)
      maximo = Math.max(maximo, marco * 1.05)
    }
  }
  minimo = Math.max(minimo, 0)
  if (maximo <= minimo) maximo = minimo + 1

  const passo = (maximo - minimo) / (pontos - 1)
  const precos = []
  for (let i = 0; i < pontos; i++) precos.push(minimo + passo * i)

  // Os "bicos" entram exatos, senão a amostragem os arredonda.
  for (const marco of [...strikes, ...breakEvensDaEstrategia(pernas), precoAtual]) {
    if (Number.isFinite(marco) && marco >= minimo && marco <= maximo) precos.push(marco)
  }

  return precos
    .sort((a, b) => a - b)
    .filter((p, i, arr) => i === 0 || Math.abs(p - arr[i - 1]) > 1e-9)
    .map((preco) => ({ preco, resultado: resultadoDaEstrategia(pernas, preco) }))
}

/** Cenários de variação, versão estratégia. */
export function cenariosDaEstrategia(pernas, precoAtual, variacoes) {
  return variacoes.map((variacao) => {
    const preco = precoAtual * (1 + variacao)
    return { variacao, preco, resultado: resultadoDaEstrategia(pernas, preco) }
  })
}
