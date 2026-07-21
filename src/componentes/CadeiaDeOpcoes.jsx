import { useCallback, useMemo, useRef, useState } from 'react'
import { buscarSeries, buscarVencimentos, cadeiaEhGratis } from '../lib/opcoes.js'
import { emPreco } from '../lib/formato.js'
import { diasAteVencimento, textoDoPrazo } from '../lib/vencimento.js'

const LIMITE_LINHAS = 80

/**
 * Consulta a cadeia de opções do ativo e deixa você carregar uma série
 * direto no formulário, sem digitar nada.
 *
 * Os preços aqui são de FECHAMENTO do último pregão, não do momento atual.
 */
export default function CadeiaDeOpcoes({ ticker, precoAtivo, aoEscolherSerie }) {
  const [vencimentos, setVencimentos] = useState([])
  const [vencimento, setVencimento] = useState('')
  const [series, setSeries] = useState([])
  const [dataDosPrecos, setDataDosPrecos] = useState('')
  const [carregando, setCarregando] = useState('')
  const [erro, setErro] = useState('')
  const [lado, setLado] = useState('CALL')
  const [pertoDoDinheiro, setPertoDoDinheiro] = useState(true)
  const busca = useRef(null)

  const reiniciar = () => {
    setVencimento('')
    setSeries([])
    setDataDosPrecos('')
    setErro('')
  }

  const carregarVencimentos = useCallback(async () => {
    busca.current?.abort()
    const controle = new AbortController()
    busca.current = controle

    reiniciar()
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
    } catch (e) {
      if (!controle.signal.aborted) {
        setErro(e.message)
        setSeries([])
      }
    } finally {
      if (!controle.signal.aborted) setCarregando('')
    }
  }, [ticker])

  const visiveis = useMemo(() => {
    let lista = series.filter((s) => s.tipo === lado)
    if (pertoDoDinheiro && precoAtivo > 0) {
      lista = lista.filter((s) => Math.abs(s.strike - precoAtivo) / precoAtivo <= 0.25)
    }
    return lista
  }, [series, lado, pertoDoDinheiro, precoAtivo])

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
            onChange={(e) => carregarSeries(e.target.value)}
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
                  onClick={() => setLado(t)}
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
                onChange={(e) => setPertoDoDinheiro(e.target.checked)}
              />
              só perto do dinheiro (±25%)
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
                  <th scope="col"><span className="sr-only">Usar</span></th>
                </tr>
              </thead>
              <tbody>
                {visiveis.slice(0, LIMITE_LINHAS).map((s) => (
                  <tr key={s.codigo} className={s.volume > 0 ? undefined : 'linha-parada'}>
                    <td className="codigo-serie">{s.codigo}</td>
                    <td>{emPreco(s.strike)}</td>
                    <td>{emPreco(s.fechamento)}</td>
                    <td>{s.bid > 0 ? emPreco(s.bid) : '—'}</td>
                    <td>{s.ask > 0 ? emPreco(s.ask) : '—'}</td>
                    <td>{(s.volume || 0).toLocaleString('pt-BR')}</td>
                    <td>
                      <button
                        type="button"
                        className="botao-texto"
                        onClick={() => aoEscolherSerie(s)}
                      >
                        usar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visiveis.length === 0 && (
            <p className="ajuda">
              Nenhuma {lado} nesse filtro. Desmarque "perto do dinheiro" para ver todas.
            </p>
          )}
          {visiveis.length > LIMITE_LINHAS && (
            <p className="ajuda">
              Mostrando as {LIMITE_LINHAS} primeiras de {visiveis.length} séries.
            </p>
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
