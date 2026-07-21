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
