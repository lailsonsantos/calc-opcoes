import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buscarSeries, buscarVencimentos, cadeiaEhGratis } from '../lib/opcoes.js'
import { emPreco } from '../lib/formato.js'
import { diasAteVencimento, textoDoPrazo } from '../lib/vencimento.js'

const TAMANHOS_DE_PAGINA = [10, 20, 50]

/**
 * Consulta a cadeia de opções do ativo e deixa você carregar uma série no
 * formulário (usar) ou somá-la à estratégia (+ perna), sem digitar nada.
 *
 * Os preços aqui são de FECHAMENTO do último pregão, não do momento atual.
 */
export default function CadeiaDeOpcoes({
  ticker,
  precoAtivo,
  aoEscolherSerie,
  aoAdicionarPerna,
  aoCarregarSeries,
}) {
  const [vencimentos, setVencimentos] = useState([])
  const [vencimento, setVencimento] = useState('')
  const [series, setSeries] = useState([])
  const [dataDosPrecos, setDataDosPrecos] = useState('')
  const [carregando, setCarregando] = useState('')
  const [erro, setErro] = useState('')
  const [lado, setLado] = useState('CALL')
  const [pertoDoDinheiro, setPertoDoDinheiro] = useState(true)
  const [porPagina, setPorPagina] = useState(TAMANHOS_DE_PAGINA[0])
  const [pagina, setPagina] = useState(1)
  const busca = useRef(null)

  const carregarVencimentos = useCallback(async () => {
    busca.current?.abort()
    const controle = new AbortController()
    busca.current = controle

    setVencimento('')
    setSeries([])
    setDataDosPrecos('')
    setErro('')
    setVencimentos([])
    setCarregando('vencimentos')
    try {
      const lista = await buscarVencimentos(ticker, { signal: controle.signal })
      if (controle.signal.aborted) return
      setVencimentos(lista)
      if (lista.length === 0) setErro(`Nenhum vencimento negociado para ${ticker}.`)
    } catch (e) {
      if (!controle.signal.aborted) setErro(e.message)
    } finally {
      if (!controle.signal.aborted) setCarregando('')
    }
  }, [ticker])

  const carregarSeries = useCallback(async (data) => {
    setVencimento(data)
    if (!data) {
      setSeries([])
      aoCarregarSeries?.([], '')
      return
    }

    busca.current?.abort()
    const controle = new AbortController()
    busca.current = controle

    setErro('')
    setCarregando('series')
    try {
      const resultado = await buscarSeries(ticker, data, { signal: controle.signal })
      if (controle.signal.aborted) return
      setSeries(resultado.series)
      setDataDosPrecos(resultado.dataDosPrecos || '')
      aoCarregarSeries?.(resultado.series, data)
    } catch (e) {
      if (!controle.signal.aborted) {
        setErro(e.message)
        setSeries([])
        aoCarregarSeries?.([], '')
      }
    } finally {
      if (!controle.signal.aborted) setCarregando('')
    }
  }, [ticker, aoCarregarSeries])

  const visiveis = useMemo(() => {
    let lista = series.filter((s) => s.tipo === lado)
    if (pertoDoDinheiro && precoAtivo > 0) {
      lista = lista.filter((s) => Math.abs(s.strike - precoAtivo) / precoAtivo <= 0.25)
    }
    return lista
  }, [series, lado, pertoDoDinheiro, precoAtivo])

  const totalPaginas = Math.max(1, Math.ceil(visiveis.length / porPagina))

  // Trocar filtro ou tamanho de página não pode deixar você numa página vazia.
  useEffect(() => {
    setPagina((atual) => Math.min(atual, totalPaginas))
  }, [totalPaginas])

  const daPagina = useMemo(
    () => visiveis.slice((pagina - 1) * porPagina, pagina * porPagina),
    [visiveis, pagina, porPagina],
  )

  const trocarFiltro = (acao) => {
    acao()
    setPagina(1)
  }

  if (!ticker) {
    return (
      <section className="cartao" aria-labelledby="titulo-cadeia">
        <h2 id="titulo-cadeia">Opções do ativo</h2>
        <p className="ajuda">Escolha uma ação acima para consultar as opções dela.</p>
      </section>
    )
  }

  return (
    <section className="cartao" aria-labelledby="titulo-cadeia">
      <div className="cabecalho-secao">
        <h2 id="titulo-cadeia">Opções de {ticker}</h2>
        <button
          type="button"
          className="botao-secundario"
          onClick={carregarVencimentos}
          disabled={Boolean(carregando)}
        >
          {carregando === 'vencimentos' ? 'Buscando…' : 'Buscar opções'}
        </button>
      </div>

      {!cadeiaEhGratis(ticker) && vencimentos.length === 0 && !erro && (
        <p className="ajuda">
          A cadeia de opções sem token cobre apenas PETR4. Para {ticker}, a brapi exige o
          plano Pro — enquanto isso, preencha os dados da opção à mão.
        </p>
      )}

      {erro && <p className="erro" role="status">⚠️ {erro}</p>}

      {vencimentos.length > 0 && (
        <div className="campo">
          <label htmlFor="vencimento-cadeia">Vencimento</label>
          <select
            id="vencimento-cadeia"
            value={vencimento}
            onChange={(e) => trocarFiltro(() => carregarSeries(e.target.value))}
          >
            <option value="">— escolher vencimento —</option>
            {vencimentos.map((data) => (
              <option key={data} value={data}>
                {formatarData(data)} · {textoDoPrazo(diasAteVencimento(data))}
              </option>
            ))}
          </select>
        </div>
      )}

      {carregando === 'series' && <p className="ajuda">Carregando séries…</p>}

      {series.length > 0 && (
        <>
          <div className="filtros-cadeia">
            <div className="grupo-radio compacto" role="group" aria-label="Tipo de opção">
              {['CALL', 'PUT'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={lado === t ? 'pilula ativa' : 'pilula'}
                  onClick={() => trocarFiltro(() => setLado(t))}
                  aria-pressed={lado === t}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="caixa-marcar">
              <input
                type="checkbox"
                checked={pertoDoDinheiro}
                onChange={(e) => trocarFiltro(() => setPertoDoDinheiro(e.target.checked))}
              />
              só perto do dinheiro (±25%)
            </label>

            <label className="caixa-marcar">
              por página
              <select
                className="select-compacto"
                value={porPagina}
                onChange={(e) => trocarFiltro(() => setPorPagina(Number(e.target.value)))}
                aria-label="Séries por página"
              >
                {TAMANHOS_DE_PAGINA.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="ajuda">
            Preços de fechamento{dataDosPrecos ? ` do pregão de ${formatarData(dataDosPrecos)}` : ''} —
            não são do momento atual. Confira o book na sua corretora antes de operar.
          </p>

          <div className="rolagem-tabela">
            <table className="tabela tabela-cadeia">
              <caption className="sr-only">
                Séries de {lado} de {ticker} com vencimento em {formatarData(vencimento)}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Strike</th>
                  <th scope="col">Últ.</th>
                  <th scope="col">Bid</th>
                  <th scope="col">Ask</th>
                  <th scope="col">Vol.</th>
                  <th scope="col"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {daPagina.map((s) => (
                  <tr key={s.codigo} className={s.volume > 0 ? undefined : 'linha-parada'}>
                    <td className="codigo-serie">{s.codigo}</td>
                    <td>{emPreco(s.strike)}</td>
                    <td>{emPreco(s.fechamento)}</td>
                    <td>{s.bid > 0 ? emPreco(s.bid) : '—'}</td>
                    <td>{s.ask > 0 ? emPreco(s.ask) : '—'}</td>
                    <td>{(s.volume || 0).toLocaleString('pt-BR')}</td>
                    <td className="celula-acoes">
                      <button type="button" className="botao-texto" onClick={() => aoEscolherSerie(s)}>
                        usar
                      </button>
                      <button
                        type="button"
                        className="botao-texto"
                        onClick={() => aoAdicionarPerna(s)}
                        title="Somar esta série à estratégia"
                      >
                        + perna
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visiveis.length === 0 ? (
            <p className="ajuda">
              Nenhuma {lado} nesse filtro. Desmarque "perto do dinheiro" para ver todas.
            </p>
          ) : (
            <div className="paginacao">
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
              >
                ← anterior
              </button>
              <span className="ajuda">
                {(pagina - 1) * porPagina + 1}–{Math.min(pagina * porPagina, visiveis.length)}
                {' de '}{visiveis.length} · página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                className="botao-secundario"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
              >
                próxima →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function formatarData(iso) {
  if (!iso) return ''
  const [ano, mes, dia] = String(iso).split('-')
  return dia ? `${dia}/${mes}/${ano}` : iso
}
