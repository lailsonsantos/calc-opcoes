import { ACOES, precisaDeToken } from '../lib/acoes.js'
import { emDataHora } from '../lib/formato.js'
import { classificarPrazo, diasAteVencimento, textoDoPrazo } from '../lib/vencimento.js'

/**
 * Fases 2, 6 e 7: os campos de entrada da operação.
 * Todo o estado mora no App; aqui só desenhamos e avisamos as mudanças.
 */
export default function Formulario({ valores, aoMudar, cotacao, aoSelecionarAcao, aoRebuscarCotacao }) {
  const campo = (nome) => ({
    id: nome,
    value: valores[nome],
    onChange: (e) => aoMudar(nome, e.target.value),
  })

  // type="text" + inputMode="decimal": deixa digitar vírgula e abre o
  // teclado numérico no celular (type="number" recusa vírgula em alguns navegadores).
  const numerico = { type: 'text', inputMode: 'decimal', autoComplete: 'off' }

  const dias = diasAteVencimento(valores.vencimento)
  const situacao = classificarPrazo(dias)
  const prazo = {
    texto: Number.isFinite(dias) ? textoDoPrazo(dias) : '',
    classe: situacao === 'vencida' || situacao === 'hoje' || situacao === 'reta-final'
      ? 'aviso'
      : 'ajuda',
  }

  return (
    <section className="cartao" aria-labelledby="titulo-dados">
      <h2 id="titulo-dados">Dados da opção</h2>

      <div className="campo">
        <label htmlFor="ticker">Ação (busca a cotação)</label>
        <div className="linha-acao">
          <select
            id="ticker"
            value={valores.ticker}
            onChange={(e) => aoSelecionarAcao(e.target.value)}
          >
            <option value="">— escolher ação —</option>
            {ACOES.map(({ ticker, nome }) => (
              <option key={ticker} value={ticker}>
                {ticker} · {nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="botao-secundario"
            onClick={aoRebuscarCotacao}
            disabled={!valores.ticker || cotacao.carregando}
            aria-label="Atualizar cotação"
          >
            {cotacao.carregando ? '…' : '↻'}
          </button>
        </div>

        {cotacao.carregando && <p className="ajuda">Buscando cotação…</p>}

        {!cotacao.carregando && cotacao.erro && (
          <p className={cotacao.precisaToken ? 'aviso' : 'erro'} role="status">
            {cotacao.precisaToken ? '🔒 ' : '⚠️ '}
            {cotacao.erro}
          </p>
        )}

        {!cotacao.carregando && !cotacao.erro && cotacao.atualizadoEm && (
          <p className="ajuda" role="status">
            Cotação de {emDataHora(cotacao.atualizadoEm)} — dado gratuito, com atraso
            (a B3 atrasa 15 min). Não é preço do segundo atual.
          </p>
        )}

        {!cotacao.carregando && !cotacao.erro && !cotacao.atualizadoEm && valores.ticker && precisaDeToken(valores.ticker) && (
          <p className="ajuda">
            {valores.ticker} depende do token da brapi (fase 9). Sem ele, digite o preço à mão.
          </p>
        )}
      </div>

      <div className="grade-campos">
        <div className="campo">
          <label htmlFor="codigo">Código da opção</label>
          <input
            id="codigo"
            type="text"
            autoComplete="off"
            placeholder="BBASG198W4"
            spellCheck="false"
            {...campo('codigo')}
          />
          <span className="ajuda">Identifica a posição na lista salva.</span>
        </div>

        <div className="campo">
          <label htmlFor="vencimento">Vencimento</label>
          <input id="vencimento" type="date" {...campo('vencimento')} />
          {prazo.texto && (
            <span className={prazo.classe}>{prazo.texto}</span>
          )}
        </div>
      </div>

      <fieldset className="grupo-radio">
        <legend>Tipo</legend>
        {['CALL', 'PUT'].map((t) => (
          <label key={t} className={valores.tipo === t ? 'pilula ativa' : 'pilula'}>
            <input
              type="radio"
              name="tipo"
              value={t}
              checked={valores.tipo === t}
              onChange={(e) => aoMudar('tipo', e.target.value)}
            />
            {t}
          </label>
        ))}
      </fieldset>

      <fieldset className="grupo-radio">
        <legend>Posição</legend>
        {[
          { valor: 'comprada', rotulo: 'Comprada (titular)' },
          { valor: 'vendida', rotulo: 'Vendida (lançador)' },
        ].map(({ valor, rotulo }) => (
          <label key={valor} className={valores.posicao === valor ? 'pilula ativa' : 'pilula'}>
            <input
              type="radio"
              name="posicao"
              value={valor}
              checked={valores.posicao === valor}
              onChange={(e) => aoMudar('posicao', e.target.value)}
            />
            {rotulo}
          </label>
        ))}
      </fieldset>

      <div className="grade-campos">
        <div className="campo">
          <label htmlFor="precoAtivo">Preço atual do ativo (R$)</label>
          <input {...numerico} placeholder="20,79" {...campo('precoAtivo')} />
        </div>

        <div className="campo">
          <label htmlFor="strike">Strike / preço de exercício (R$)</label>
          <input {...numerico} placeholder="19,51" {...campo('strike')} />
        </div>

        <div className="campo">
          <label htmlFor="premio">Prêmio por opção (R$)</label>
          <input {...numerico} placeholder="0,99" {...campo('premio')} />
        </div>

        <div className="campo">
          <label htmlFor="quantidade">Quantidade de opções</label>
          <input type="text" inputMode="numeric" autoComplete="off" placeholder="100" {...campo('quantidade')} />
        </div>
      </div>

      <h3>Spread do book (opcional)</h3>
      <p className="ajuda">
        Preencha o bid e o ask reais da opção. O ask vira o custo de entrada de quem
        compra; o bid, o que recebe quem vende. É o que mostra o custo de sair da posição.
      </p>
      <div className="grade-campos">
        <div className="campo">
          <label htmlFor="bid">Bid — melhor compra (R$)</label>
          <input {...numerico} placeholder="0,13" {...campo('bid')} />
        </div>
        <div className="campo">
          <label htmlFor="ask">Ask — melhor venda (R$)</label>
          <input {...numerico} placeholder="0,99" {...campo('ask')} />
        </div>
      </div>
    </section>
  )
}
