// Entrada do Worker.
//
// Como funciona o roteamento com assets estáticos:
//   - Se o caminho casa com um arquivo do dist/, a Cloudflare serve direto
//     e este Worker nem roda.
//   - O que sobra cai aqui: as rotas /api/* são tratadas abaixo, e qualquer
//     outra coisa volta para os assets (que devolvem o index.html).

import { json } from './brapi.js'
import { cotacao } from './cotacao.js'
import { opcoes } from './opcoes.js'

const ROTAS = {
  '/api/cotacao': cotacao,
  '/api/opcoes': opcoes,
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const rota = ROTAS[url.pathname]

    if (rota) {
      if (request.method !== 'GET') {
        return json({ erro: 'Use GET.' }, 405, { Allow: 'GET' })
      }
      try {
        return await rota(url, env)
      } catch (erro) {
        // pedirBrapi lança um Response pronto quando a rede falha.
        if (erro instanceof Response) return erro
        return json({ erro: 'Erro inesperado ao consultar a brapi.' }, 500)
      }
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ erro: 'Rota não encontrada.' }, 404)
    }

    return env.ASSETS.fetch(request)
  },
}
