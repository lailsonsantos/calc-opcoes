// Testes do motor de cálculo. Rode com:  npm run test
// Sem framework: é só Node executando asserções e imprimindo o resultado.

import {
  resultadoTotal,
  breakEven,
  perdaMaxima,
  ganhoMaximo,
  custoTotal,
  custoDeSaidaImediata,
  temSpreadAlto,
  serieDePayoff,
  cenarios,
} from './payoff.js'
import {
  breakEvensDaEstrategia,
  caixaDaEstrategia,
  extremosDaEstrategia,
  resultadoDaEstrategia,
} from './payoff.js'
import { melhoresCompras, melhoresTravas, melhoresVendas } from './estrategias.js'
import { ACOES } from './acoes.js'
import { TICKER_VALIDO } from '../../worker/brapi.js'
import {
  avisoDoPrazo,
  classificarPrazo,
  diasAteVencimento,
  textoDoPrazo,
} from './vencimento.js'

let passou = 0
let falhou = 0

function verificar(descricao, obtido, esperado, tolerancia = 0.005) {
  const ok =
    typeof esperado === 'number' && typeof obtido === 'number'
      ? (esperado === obtido) || Math.abs(obtido - esperado) <= tolerancia
      : obtido === esperado
  if (ok) {
    passou++
    console.log(`  ok   ${descricao} -> ${obtido}`)
  } else {
    falhou++
    console.error(`  FALHOU ${descricao}\n         esperado: ${esperado}\n         obtido:   ${obtido}`)
  }
}

function titulo(t) {
  console.log(`\n${t}`)
}

// --- Caso real da planilha: BBAS3 a 20,79 -------------------------------
// CALL comprada, strike 19,51, prêmio 0,99, 100 opções.
const callComprada = { tipo: 'CALL', posicao: 'comprada', strike: 19.51, premio: 0.99, quantidade: 100 }

titulo('CALL comprada — strike 19,51 / prêmio 0,99 / 100 opções')
verificar('break-even', breakEven(callComprada), 20.50)
verificar('perda máxima', perdaMaxima(callComprada).valor, -99)
verificar('ganho máximo é ilimitado', ganhoMaximo(callComprada).ilimitado, true)
verificar('custo total', custoTotal(callComprada).valor, 99)
verificar('custo é débito', custoTotal(callComprada).tipo, 'debito')
verificar('resultado com ativo a 20,79', resultadoTotal(callComprada, 20.79), 29)
verificar('resultado no break-even é zero', resultadoTotal(callComprada, 20.50), 0)
verificar('resultado abaixo do strike = perda total', resultadoTotal(callComprada, 18.00), -99)
verificar('resultado com ativo a 25,00', resultadoTotal(callComprada, 25.00), 450)

// --- Os outros três casos ------------------------------------------------
const callVendida = { ...callComprada, posicao: 'vendida' }
titulo('CALL vendida — mesmos parâmetros')
verificar('break-even', breakEven(callVendida), 20.50)
verificar('perda máxima é ilimitada', perdaMaxima(callVendida).ilimitada, true)
verificar('ganho máximo', ganhoMaximo(callVendida).valor, 99)
verificar('custo é crédito', custoTotal(callVendida).tipo, 'credito')
verificar('resultado com ativo a 18,00 (virou pó)', resultadoTotal(callVendida, 18.00), 99)
verificar('resultado com ativo a 25,00', resultadoTotal(callVendida, 25.00), -450)

const putComprada = { tipo: 'PUT', posicao: 'comprada', strike: 20.00, premio: 0.80, quantidade: 100 }
titulo('PUT comprada — strike 20,00 / prêmio 0,80 / 100 opções')
verificar('break-even', breakEven(putComprada), 19.20)
verificar('perda máxima', perdaMaxima(putComprada).valor, -80)
verificar('ganho máximo (ativo a zero)', ganhoMaximo(putComprada).valor, 1920)
verificar('resultado com ativo a 18,00', resultadoTotal(putComprada, 18.00), 120)
verificar('resultado com ativo a 22,00', resultadoTotal(putComprada, 22.00), -80)

const putVendida = { ...putComprada, posicao: 'vendida' }
titulo('PUT vendida — mesmos parâmetros')
verificar('break-even', breakEven(putVendida), 19.20)
verificar('perda máxima (ativo a zero)', perdaMaxima(putVendida).valor, -1920)
verificar('ganho máximo', ganhoMaximo(putVendida).valor, 80)
verificar('resultado com ativo a 22,00', resultadoTotal(putVendida, 22.00), 80)
verificar('resultado com ativo a 18,00', resultadoTotal(putVendida, 18.00), -120)

// --- Fase 6: spread ------------------------------------------------------
titulo('Spread — bid 0,13 / ask 0,99 / 100 opções')
const saida = custoDeSaidaImediata({ bid: 0.13, ask: 0.99, quantidade: 100 })
verificar('prejuízo de saída imediata', saida.valor, -86)
verificar('prejuízo em %', saida.percentual, 86.87, 0.01)
verificar('dispara alerta de spread alto', temSpreadAlto({ bid: 0.13, ask: 0.99 }), true)
verificar('spread saudável não dispara', temSpreadAlto({ bid: 0.95, ask: 0.99 }), false)

// Com o ask como custo de entrada, o break-even sobe.
const comAsk = { ...callComprada, premio: 0.99 }
verificar('break-even usando o ask', breakEven(comAsk), 20.50)

// --- Gráfico e cenários --------------------------------------------------
titulo('Série do gráfico e cenários')
const serie = serieDePayoff(callComprada, 20.79)
verificar('série tem pontos', serie.length > 40, true)
verificar('série é crescente em preço', serie.every((p, i) => i === 0 || p.preco >= serie[i - 1].preco), true)
verificar('primeiro ponto é perda máxima', serie[0].resultado, -99)
verificar('inclui o break-even exato', serie.some((p) => Math.abs(p.preco - 20.50) < 1e-9), true)

const [maisCinco, maisDez] = cenarios(callComprada, 20.79, [0.05, 0.1])
verificar('ativo +5% (21,83)', maisCinco.resultado, 133.0, 0.5)
verificar('ativo +10% (22,87)', maisDez.resultado, 236.9, 0.5)

// --- Estratégias de várias pernas ----------------------------------------
titulo('Trava de alta — compra call 40 a 2,00 / vende call 45 a 0,50 / 100')
const travaAlta = [
  { tipo: 'CALL', posicao: 'comprada', strike: 40, premio: 2.0, quantidade: 100 },
  { tipo: 'CALL', posicao: 'vendida', strike: 45, premio: 0.5, quantidade: 100 },
]
verificar('caixa é débito de 150', caixaDaEstrategia(travaAlta), -150)
verificar('perda máxima', extremosDaEstrategia(travaAlta).perdaMaxima, -150)
verificar('ganho máximo', extremosDaEstrategia(travaAlta).ganhoMaximo, 350)
verificar('ganho NÃO é ilimitado', extremosDaEstrategia(travaAlta).ganhoIlimitado, false)
verificar('um único break-even', breakEvensDaEstrategia(travaAlta).length, 1)
verificar('break-even em 41,50', breakEvensDaEstrategia(travaAlta)[0], 41.5)
verificar('resultado a 38 (tudo pó)', resultadoDaEstrategia(travaAlta, 38), -150)
verificar('resultado a 50 (teto)', resultadoDaEstrategia(travaAlta, 50), 350)
verificar('resultado a 100 continua no teto', resultadoDaEstrategia(travaAlta, 100), 350)
verificar('resultado a 42', resultadoDaEstrategia(travaAlta, 42), 50)

titulo('Straddle — compra call e put strike 40 (2,00 e 1,80) / 100')
const straddle = [
  { tipo: 'CALL', posicao: 'comprada', strike: 40, premio: 2.0, quantidade: 100 },
  { tipo: 'PUT', posicao: 'comprada', strike: 40, premio: 1.8, quantidade: 100 },
]
verificar('caixa é débito de 380', caixaDaEstrategia(straddle), -380)
verificar('perda máxima no strike', extremosDaEstrategia(straddle).perdaMaxima, -380)
verificar('ganho ilimitado para cima', extremosDaEstrategia(straddle).ganhoIlimitado, true)
verificar('dois break-evens', breakEvensDaEstrategia(straddle).length, 2)
verificar('break-even de baixo', breakEvensDaEstrategia(straddle)[0], 36.2)
verificar('break-even de cima', breakEvensDaEstrategia(straddle)[1], 43.8)
verificar('resultado com ativo a zero', resultadoDaEstrategia(straddle, 0), 3620)

titulo('Call vendida a descoberto — perda ilimitada')
const callSeca = [{ tipo: 'CALL', posicao: 'vendida', strike: 40, premio: 2, quantidade: 100 }]
verificar('perda é ilimitada', extremosDaEstrategia(callSeca).perdaIlimitada, true)
verificar('ganho máximo é o prêmio', extremosDaEstrategia(callSeca).ganhoMaximo, 200)
verificar('break-even em 42', breakEvensDaEstrategia(callSeca)[0], 42)

titulo('Uma perna só = mesma conta da posição simples')
const umaPerna = [callComprada]
verificar('bate com resultadoTotal', resultadoDaEstrategia(umaPerna, 20.79), resultadoTotal(callComprada, 20.79))
verificar('bate com o break-even simples', breakEvensDaEstrategia(umaPerna)[0], breakEven(callComprada))

// --- Ranking sob o preço-alvo --------------------------------------------
titulo('Comparador de séries (alvo R$ 45, ativo a R$ 40)')
const cadeiaFalsa = [
  { tipo: 'CALL', strike: 40, bid: 1.9, ask: 2.0, volume: 5000 },
  { tipo: 'CALL', strike: 45, bid: 0.5, ask: 0.6, volume: 3000 },
  { tipo: 'CALL', strike: 50, bid: 0.1, ask: 0.2, volume: 1000 },
  { tipo: 'CALL', strike: 42, bid: 1.0, ask: 1.1, volume: 0 }, // parada: sai fora
  { tipo: 'PUT', strike: 38, bid: 0.7, ask: 0.8, volume: 2000 },
]
const compras = melhoresCompras(cadeiaFalsa, { precoAlvo: 45, quantidade: 100, limite: 3 })
verificar('só entram séries com lucro no alvo', compras.every((c) => c.resultado > 0), true)
verificar('ignora a série sem giro', compras.some((c) => c.serie.strike === 42), false)
verificar('a melhor é a call 40', compras[0].serie.strike, 40)
verificar('retorno da call 40 no alvo', compras[0].retorno, 150)

const vendas = melhoresVendas(cadeiaFalsa, { precoAlvo: 45, quantidade: 100, limite: 3 })
verificar('só vende o que vira pó com folga', vendas.every((v) => v.colchao >= 5), true)
// A call 45 vira pó exatamente no alvo (colchão 0) — perto demais, fica fora.
verificar('descarta a venda no fio do navalha', vendas.some((v) => v.serie.strike === 45), false)
// A put 38 paga R$ 70 e também vira pó a 45; a call 50 paga só R$ 10.
verificar('a melhor venda é a put 38 (maior prêmio)', vendas[0].serie.strike, 38)
verificar('venda de put tem perda limitada', vendas[0].perdaIlimitada, false)
verificar('venda de call é marcada como ilimitada',
  vendas.find((v) => v.serie.tipo === 'CALL')?.perdaIlimitada, true)

const travas = melhoresTravas(cadeiaFalsa, { precoAlvo: 45, precoAtual: 40, quantidade: 100, limite: 3 })
verificar('achou pelo menos uma trava', travas.length > 0, true)
verificar('a trava rende mais que a compra seca', travas[0].retorno > compras[0].retorno, true)
verificar('trava tem ganho limitado', Number.isFinite(travas[0].ganhoMaximo), true)

// --- Validação de ticker (usada pelas rotas do Worker) -------------------
titulo('Regex de ticker aceita a lista toda e barra lixo')
verificar('todas as 20 ações passam', ACOES.every((a) => TICKER_VALIDO.test(a.ticker)), true)
// B3SA3 tem dígito na 2ª posição e reprovava na regex "4 letras + dígitos".
verificar('B3SA3 passa', TICKER_VALIDO.test('B3SA3'), true)
verificar('ETF de 6 letras passa', TICKER_VALIDO.test('BOVA11'), true)
for (const lixo of ['../etc/passwd', 'PETR4?x=1', 'PETR4&a=b', '', 'A', 'AB CD', 'PETR4;rm']) {
  verificar(`bloqueia ${JSON.stringify(lixo)}`, TICKER_VALIDO.test(lixo), false)
}

// --- Vencimento ----------------------------------------------------------
titulo('Data de vencimento')
const hoje = new Date('2026-07-21T10:00:00')
verificar('vence daqui a 3 dias', diasAteVencimento('2026-07-24', hoje), 3)
verificar('vence hoje', diasAteVencimento('2026-07-21', hoje), 0)
verificar('já venceu', diasAteVencimento('2026-07-18', hoje), -3)
verificar('sem data', Number.isNaN(diasAteVencimento('', hoje)), true)
verificar('3 dias é reta final', classificarPrazo(3), 'reta-final')
verificar('30 dias é tranquilo', classificarPrazo(30), 'tranquilo')
verificar('vencida é classificada', classificarPrazo(-1), 'vencida')
verificar('texto do prazo', textoDoPrazo(3), 'faltam 3 dias')
verificar('texto no singular', textoDoPrazo(1), 'faltam 1 dia')
verificar('reta final tem aviso', Boolean(avisoDoPrazo(3)), true)
verificar('prazo longo não avisa', avisoDoPrazo(60), null)

// --- Resumo --------------------------------------------------------------
console.log(`\n${'-'.repeat(50)}`)
console.log(`${passou} passaram, ${falhou} falharam`)
if (falhou > 0) process.exitCode = 1
