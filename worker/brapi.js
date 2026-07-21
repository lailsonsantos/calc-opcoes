// Conversa com a brapi.dev do lado do servidor.
//
// Existe por um motivo só: o token fica aqui, no Worker, e nunca chega ao
// navegador. O celular chama a nossa rota; ela chama a brapi com o token.

// Não dá para assumir "4 letras + dígitos": B3SA3 tem dígito na 2ª posição,
// e ETFs como BOVA11 têm 6 caracteres. Aceitamos letras e números, de 4 a 6,
// o que já barra path traversal, query string e injeção — o valor é
// normalizado (maiúsculas, sem espaços) antes de chegar aqui.
export const TICKER_VALIDO = /^[A-Z0-9]{4,6}$/
export const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/

export function json(corpo, status = 200, extras = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extras },
  })
}

/** Chama a brapi e devolve { dados, resposta } ou lança um Response de erro. */
export async function pedirBrapi(url, env) {
  const cabecalhos = { Accept: 'application/json' }
  if (env.BRAPI_TOKEN) cabecalhos.Authorization = `Bearer ${env.BRAPI_TOKEN}`

  let resposta
  try {
    resposta = await fetch(url, { headers: cabecalhos })
  } catch {
    throw json({ erro: 'Não consegui falar com a brapi. Tente de novo.' }, 502)
  }

  const dados = await resposta.json().catch(() => null)
  return { resposta, dados }
}

/** true quando a brapi recusou por falta de plano/token. */
export function semPermissao(resposta) {
  return resposta.status === 401 || resposta.status === 402 || resposta.status === 403
}
