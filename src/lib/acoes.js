// As 20 principais ações da B3 embutidas na ferramenta.
// Ajuste esta lista à vontade — é só editar o array.

export const ACOES = [
  { ticker: 'PETR4', nome: 'Petrobras PN' },
  { ticker: 'VALE3', nome: 'Vale ON' },
  { ticker: 'ITUB4', nome: 'Itaú Unibanco PN' },
  { ticker: 'BBAS3', nome: 'Banco do Brasil ON' },
  { ticker: 'BBDC4', nome: 'Bradesco PN' },
  { ticker: 'ABEV3', nome: 'Ambev ON' },
  { ticker: 'B3SA3', nome: 'B3 ON' },
  { ticker: 'WEGE3', nome: 'WEG ON' },
  { ticker: 'ITSA4', nome: 'Itaúsa PN' },
  { ticker: 'PETR3', nome: 'Petrobras ON' },
  { ticker: 'MGLU3', nome: 'Magazine Luiza ON' },
  { ticker: 'RENT3', nome: 'Localiza ON' },
  { ticker: 'SUZB3', nome: 'Suzano ON' },
  { ticker: 'RADL3', nome: 'Raia Drogasil ON' },
  { ticker: 'PRIO3', nome: 'PRIO ON' },
  { ticker: 'GGBR4', nome: 'Gerdau PN' },
  { ticker: 'RAIL3', nome: 'Rumo ON' },
  { ticker: 'EQTL3', nome: 'Equatorial ON' },
  { ticker: 'VBBR3', nome: 'Vibra Energia ON' },
  { ticker: 'JBSS3', nome: 'JBS ON' },
]

// A brapi.dev libera estas quatro sem token e sem limite.
// As outras 16 dependem da função serverless da fase 9.
export const ACOES_SEM_TOKEN = ['PETR4', 'VALE3', 'ITUB4', 'MGLU3']

export function precisaDeToken(ticker) {
  return !ACOES_SEM_TOKEN.includes(ticker)
}
