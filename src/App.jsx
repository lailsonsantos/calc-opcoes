import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Formulario from './componentes/Formulario.jsx'
import CadeiaDeOpcoes from './componentes/CadeiaDeOpcoes.jsx'
import Estrategia from './componentes/Estrategia.jsx'
import Oportunidades from './componentes/Oportunidades.jsx'
import Resumo from './componentes/Resumo.jsx'
import GraficoPayoff from './componentes/GraficoPayoff.jsx'
import SimulacoesSalvas from './componentes/SimulacoesSalvas.jsx'
import { buscarCotacao } from './lib/cotacao.js'
import { montarPreset } from './lib/estrategias.js'
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

let proximoId = 1
const novaPerna = (dados = {}) => ({
  id: `perna-${proximoId++}`,
  tipo: 'CALL',
  posicao: 'vendida',
  strike: '',
  premio: '',
  quantidade: '100',
  codigo: '',
  ...dados,
})

export default function App() {
  const [form, setForm] = useState(INICIAL)
  const [extras, setExtras] = useState([])
  const [cotacao, setCotacao] = useState(COTACAO_VAZIA)
  const [salvas, setSalvas] = useState([])
  const [atualizando, setAtualizando] = useState(false)
  const [graficoExpandido, setGraficoExpandido] = useState(false)
  const [seriesDaCadeia, setSeriesDaCadeia] = useState([])
  const [precoAlvo, setPrecoAlvo] = useState('')
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
      setPrecoAlvo(emPreco(preco * 1.05))
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
    setSeriesDaCadeia([])
    if (ticker) buscar(ticker)
  }, [buscar])

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

  const pernaPrincipal = useMemo(() => ({
    tipo: form.tipo,
    posicao: form.posicao,
    strike: numeros.strike,
    premio: premioEntrada,
    quantidade: numeros.quantidade,
  }), [form.tipo, form.posicao, numeros.strike, numeros.quantidade, premioEntrada])

  const pernaValida = (p) =>
    p.strike > 0 && Number.isFinite(p.premio) && p.premio >= 0 && p.quantidade > 0

  /** A estratégia inteira: a perna do formulário mais as extras válidas. */
  const pernas = useMemo(() => {
    const numericas = extras
      .map((e) => ({
        tipo: e.tipo,
        posicao: e.posicao,
        strike: paraNumero(e.strike),
        premio: paraNumero(e.premio),
        quantidade: paraNumero(e.quantidade),
      }))
      .filter(pernaValida)
    return [pernaPrincipal, ...numericas]
  }, [pernaPrincipal, extras])

  const completo = pernaValida(pernaPrincipal) && numeros.precoAtivo > 0

  // --- Cadeia de opções ----------------------------------------------------
  const aoCarregarSeries = useCallback((series) => {
    setSeriesDaCadeia(series)
  }, [])

  /** "usar": a série vira a perna principal, substituindo o formulário. */
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

  /** "+ perna": a série entra como perna extra, sem mexer no formulário. */
  const aoAdicionarPerna = useCallback((serie) => {
    setExtras((atual) => [
      ...atual,
      novaPerna({
        tipo: serie.tipo,
        posicao: 'vendida',
        strike: emPreco(serie.strike),
        premio: emPreco(serie.bid > 0 ? serie.bid : serie.fechamento),
        quantidade: form.quantidade,
        codigo: serie.codigo,
      }),
    ])
  }, [form.quantidade])

  // --- Estratégia ----------------------------------------------------------
  const aoMudarExtra = useCallback((id, campo, valor) => {
    setExtras((atual) => atual.map((p) => (p.id === id ? { ...p, [campo]: valor } : p)))
  }, [])

  const aoRemoverExtra = useCallback((id) => {
    setExtras((atual) => atual.filter((p) => p.id !== id))
  }, [])

  const aoAdicionarVazia = useCallback(() => {
    setExtras((atual) => [...atual, novaPerna({ quantidade: form.quantidade })])
  }, [form.quantidade])

  const aoLimpar = useCallback(() => setExtras([]), [])

  /** Carrega um conjunto de pernas prontas (preset ou sugestão do comparador). */
  const carregarPernas = useCallback((novas, serieDaPrimeira) => {
    if (!novas?.length) return
    const [primeira, ...resto] = novas

    setForm((atual) => ({
      ...atual,
      codigo: serieDaPrimeira?.codigo || atual.codigo,
      tipo: primeira.tipo,
      posicao: primeira.posicao,
      vencimento: serieDaPrimeira?.vencimento || atual.vencimento,
      strike: emPreco(primeira.strike),
      premio: emPreco(primeira.premio),
      quantidade: String(primeira.quantidade),
      // O book da perna principal é do formulário; as pernas do comparador
      // já vêm com o preço do lado certo, então limpamos para não conflitar.
      bid: '',
      ask: '',
    }))

    setExtras(resto.map((p) => novaPerna({
      tipo: p.tipo,
      posicao: p.posicao,
      strike: emPreco(p.strike),
      premio: emPreco(p.premio),
      quantidade: String(p.quantidade),
    })))

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const aoAplicarPreset = useCallback((id) => {
    const montadas = montarPreset(id, seriesDaCadeia, numeros.precoAtivo, numeros.quantidade || 100)
    if (montadas) carregarPernas(montadas)
  }, [seriesDaCadeia, numeros.precoAtivo, numeros.quantidade, carregarPernas])

  // --- Posições salvas -----------------------------------------------------
  const aoSalvar = useCallback(() => {
    setSalvas(salvarSimulacao(form.codigo, form, premioEntrada))
  }, [form, premioEntrada])

  const aoApagar = useCallback((id) => setSalvas(apagarSimulacao(id)), [])

  const aoCarregar = useCallback((simulacao) => {
    setForm({ ...INICIAL, ...simulacao.dados })
    setExtras([])
    setCotacao(COTACAO_VAZIA)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

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
      pernas={pernas}
      precoAtual={numeros.precoAtivo}
      expandido={graficoExpandido}
      aoAlternarExpansao={() => setGraficoExpandido((v) => !v)}
    />
  )

  return (
    <div className="app">
      <header className="topo">
        <h1>Calculadora de payoff de opções</h1>
        <p>Ganho e perda no vencimento, break-even, spread e estratégias.</p>
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
            <Estrategia
              extras={extras}
              pernaPrincipal={pernaPrincipal}
              temCadeia={seriesDaCadeia.length > 0}
              aoMudarExtra={aoMudarExtra}
              aoRemoverExtra={aoRemoverExtra}
              aoAdicionarVazia={aoAdicionarVazia}
              aoAplicarPreset={aoAplicarPreset}
              aoLimpar={aoLimpar}
            />
          </div>

          <div className="coluna">
            {completo ? (
              <>
                <Resumo
                  pernas={pernas}
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

        {/* Largura total: as tabelas têm muitas colunas e não cabem
            confortavelmente na coluna do formulário. */}
        <CadeiaDeOpcoes
          ticker={form.ticker}
          precoAtivo={numeros.precoAtivo}
          aoEscolherSerie={aoEscolherSerie}
          aoAdicionarPerna={aoAdicionarPerna}
          aoCarregarSeries={aoCarregarSeries}
        />

        <Oportunidades
          series={seriesDaCadeia}
          precoAtual={numeros.precoAtivo}
          precoAlvo={paraNumero(precoAlvo)}
          quantidade={numeros.quantidade}
          aoMudarAlvo={{ valor: precoAlvo, definir: setPrecoAlvo }}
          aoUsarPernas={carregarPernas}
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
          O comparador de séries é <strong>aritmética condicional</strong> sobre o preço-alvo
          que você digitar, não uma previsão de mercado nem recomendação de investimento.
          Opções são de alto risco e a perda pode chegar a 100% do valor investido.
        </p>
      </footer>
    </div>
  )
}
