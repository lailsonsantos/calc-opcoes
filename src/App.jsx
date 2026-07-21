import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Formulario from './componentes/Formulario.jsx'
import CadeiaDeOpcoes from './componentes/CadeiaDeOpcoes.jsx'
import Resumo from './componentes/Resumo.jsx'
import GraficoPayoff from './componentes/GraficoPayoff.jsx'
import SimulacoesSalvas from './componentes/SimulacoesSalvas.jsx'
import { buscarCotacao } from './lib/cotacao.js'
import {
  apagarSimulacao,
  atualizarPrecoDoAtivo,
  listarSimulacoes,
  salvarSimulacao,
  tickersSalvos,
} from './lib/armazenamento.js'
import { emPreco, paraNumero } from './lib/formato.js'

// Começa preenchido com um exemplo real, para a ferramenta já nascer útil.
const INICIAL = {
  codigo: 'BBASG198W4',
  ticker: 'BBAS3',
  tipo: 'CALL',
  posicao: 'comprada',
  vencimento: '',
  precoAtivo: '20,79',
  strike: '19,51',
  premio: '0,99',
  quantidade: '100',
  bid: '',
  ask: '',
}

const COTACAO_VAZIA = { carregando: false, erro: '', precisaToken: false, atualizadoEm: '' }

export default function App() {
  const [form, setForm] = useState(INICIAL)
  const [cotacao, setCotacao] = useState(COTACAO_VAZIA)
  const [salvas, setSalvas] = useState([])
  const [atualizando, setAtualizando] = useState(false)
  const [graficoExpandido, setGraficoExpandido] = useState(false)
  const buscaEmCurso = useRef(null)

  useEffect(() => {
    setSalvas(listarSimulacoes())
  }, [])

  const aoMudar = useCallback((campo, valor) => {
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }, [])

  // --- Cotação do ativo ----------------------------------------------------
  const buscar = useCallback(async (ticker) => {
    if (!ticker) return

    buscaEmCurso.current?.abort()
    const controle = new AbortController()
    buscaEmCurso.current = controle

    setCotacao({ ...COTACAO_VAZIA, carregando: true })
    try {
      const { preco, atualizadoEm } = await buscarCotacao(ticker, { signal: controle.signal })
      if (controle.signal.aborted) return
      setForm((atual) => ({ ...atual, precoAtivo: emPreco(preco) }))
      setCotacao({ carregando: false, erro: '', precisaToken: false, atualizadoEm })
    } catch (erro) {
      if (controle.signal.aborted) return
      setCotacao({
        carregando: false,
        erro: erro.message,
        precisaToken: Boolean(erro.precisaToken),
        atualizadoEm: '',
      })
    }
  }, [])

  const aoSelecionarAcao = useCallback((ticker) => {
    setForm((atual) => ({ ...atual, ticker }))
    setCotacao(COTACAO_VAZIA)
    if (ticker) buscar(ticker)
  }, [buscar])

  /** Uma série escolhida na cadeia de opções preenche o formulário inteiro. */
  const aoEscolherSerie = useCallback((serie) => {
    setForm((atual) => ({
      ...atual,
      codigo: serie.codigo,
      tipo: serie.tipo,
      vencimento: serie.vencimento || '',
      strike: emPreco(serie.strike),
      premio: serie.fechamento > 0 ? emPreco(serie.fechamento) : atual.premio,
      bid: serie.bid > 0 ? emPreco(serie.bid) : '',
      ask: serie.ask > 0 ? emPreco(serie.ask) : '',
    }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // --- Números derivados ---------------------------------------------------
  const numeros = useMemo(() => ({
    precoAtivo: paraNumero(form.precoAtivo),
    strike: paraNumero(form.strike),
    premio: paraNumero(form.premio),
    quantidade: paraNumero(form.quantidade),
    bid: paraNumero(form.bid),
    ask: paraNumero(form.ask),
  }), [form])

  // Quando o book está preenchido, ele manda no preço de entrada:
  // quem compra paga o ask; quem vende recebe o bid.
  const { premioEntrada, usandoBook } = useMemo(() => {
    const doBook = form.posicao === 'comprada' ? numeros.ask : numeros.bid
    if (Number.isFinite(doBook) && doBook > 0) {
      return { premioEntrada: doBook, usandoBook: true }
    }
    return { premioEntrada: numeros.premio, usandoBook: false }
  }, [form.posicao, numeros])

  const operacao = useMemo(() => ({
    tipo: form.tipo,
    posicao: form.posicao,
    strike: numeros.strike,
    premio: premioEntrada,
    quantidade: numeros.quantidade,
  }), [form.tipo, form.posicao, numeros.strike, numeros.quantidade, premioEntrada])

  const completo =
    numeros.strike > 0 &&
    Number.isFinite(premioEntrada) && premioEntrada >= 0 &&
    numeros.quantidade > 0 &&
    numeros.precoAtivo > 0

  // --- Posições salvas -----------------------------------------------------
  const aoSalvar = useCallback(() => {
    setSalvas(salvarSimulacao(form.codigo, form, premioEntrada))
  }, [form, premioEntrada])

  const aoApagar = useCallback((id) => setSalvas(apagarSimulacao(id)), [])

  const aoCarregar = useCallback((simulacao) => {
    setForm({ ...INICIAL, ...simulacao.dados })
    setCotacao(COTACAO_VAZIA)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  /** Repuxa a cotação de cada ativo distinto da carteira. */
  const aoAtualizarCotacoes = useCallback(async () => {
    setAtualizando(true)
    let lista = listarSimulacoes()
    for (const ticker of tickersSalvos()) {
      try {
        const { preco, atualizadoEm } = await buscarCotacao(ticker)
        lista = atualizarPrecoDoAtivo(ticker, preco, atualizadoEm)
      } catch {
        // Ativo que exige token fica com o último preço conhecido.
      }
    }
    setSalvas(lista)
    setAtualizando(false)
  }, [])

  const grafico = completo && (
    <GraficoPayoff
      operacao={operacao}
      precoAtual={numeros.precoAtivo}
      expandido={graficoExpandido}
      aoAlternarExpansao={() => setGraficoExpandido((v) => !v)}
    />
  )

  return (
    <div className="app">
      <header className="topo">
        <h1>Calculadora de payoff de opções</h1>
        <p>Ganho e perda no vencimento, break-even e o custo do spread.</p>
      </header>

      <main>
        <div className="layout">
          <div className="coluna">
            <Formulario
              valores={form}
              aoMudar={aoMudar}
              cotacao={cotacao}
              aoSelecionarAcao={aoSelecionarAcao}
              aoRebuscarCotacao={() => buscar(form.ticker)}
            />
          </div>

          <div className="coluna">
            {completo ? (
              <>
                <Resumo
                  operacao={operacao}
                  precoAtual={numeros.precoAtivo}
                  bid={numeros.bid}
                  ask={numeros.ask}
                  usandoBook={usandoBook}
                  vencimento={form.vencimento}
                />
                {/* Expandido, o gráfico sai da coluna e ocupa a largura toda. */}
                {!graficoExpandido && grafico}
              </>
            ) : (
              <section className="cartao">
                <p className="ajuda">
                  Preencha preço do ativo, strike, prêmio (ou o book) e quantidade para ver
                  o resumo e o gráfico.
                </p>
              </section>
            )}
          </div>
        </div>

        {graficoExpandido && grafico}

        {/* Largura total: a tabela da cadeia tem muitas colunas e não cabe
            confortavelmente na coluna do formulário. */}
        <CadeiaDeOpcoes
          ticker={form.ticker}
          precoAtivo={numeros.precoAtivo}
          aoEscolherSerie={aoEscolherSerie}
        />

        <SimulacoesSalvas
          lista={salvas}
          codigoAtual={form.codigo}
          atualizando={atualizando}
          aoSalvar={aoSalvar}
          aoCarregar={aoCarregar}
          aoApagar={aoApagar}
          aoAtualizarCotacoes={aoAtualizarCotacoes}
        />
      </main>

      <footer className="rodape">
        <p>
          Resultado <strong>teórico no vencimento</strong>, a partir do que você digitou.
          Não modela a perda de valor pelo tempo (theta), nem corretagem e impostos.
          Cotações gratuitas vêm com atraso e os preços das opções são de fechamento —
          não são preço de tempo real.
        </p>
        <p>
          Ferramenta de estudo, não é recomendação de investimento. Opções são de alto
          risco e a perda pode chegar a 100% do valor investido.
        </p>
      </footer>
    </div>
  )
}
