# Calculadora de payoff de opções

Ferramenta pessoal para simular o ganho e a perda de uma posição de opções **no
vencimento**. Você preenche os dados da opção e vê na hora o gráfico de payoff,
o break-even, a perda máxima e — o detalhe que mais importa em opção ilíquida —
quanto custaria sair da posição agora, pelo spread do book.

Roda inteira no navegador. Sem conta, sem banco de dados.

## Rodar no seu PC

```bash
npm install
npm run dev
```

O Vite mostra dois endereços:

- **Local** — `http://localhost:5173`, para usar no próprio PC.
- **Network** — algo como `http://192.168.x.x:5173`. Abra esse no celular,
  na mesma Wi-Fi, para testar no aparelho de verdade.

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes do motor de cálculo (sem framework, é só Node). |
| `npm run build` | Gera o site estático em `dist/`. |
| `npm run preview` | Serve o `dist/` para conferir o build. |
| `npm run lint` | Passa o oxlint no código. |

## Como está organizado

```
src/
  lib/
    payoff.js         motor de cálculo — funções puras, o coração da ferramenta
    payoff.test.js    testes do motor (npm test)
    formato.js        vírgula decimal, R$, datas em pt-BR
    acoes.js          as 20 ações da lista
    cotacao.js        busca de cotação (função própria → brapi direto)
    opcoes.js         cadeia de opções (vencimentos e séries)
    estrategias.js    montagens prontas e o comparador de séries
    vencimento.js     dias restantes e o aviso de reta final
    armazenamento.js  posições no localStorage, indexadas pelo código
  componentes/
    Formulario.jsx       campos da opção + seletor de ação + book
    CadeiaDeOpcoes.jsx   navegador paginado das séries do ativo
    Estrategia.jsx       pernas extras e montagens prontas
    Oportunidades.jsx    comparador de séries sob um preço-alvo
    Resumo.jsx           cartões de números e o painel do spread
    GraficoPayoff.jsx    o gráfico (recharts), tabela e expandir/retrair
    SimulacoesSalvas.jsx a carteira: posições salvas e resultado
functions/api/*.js  funções serverless (Cloudflare Pages)
api/*.js            as mesmas funções, versão Vercel
```

No PC o layout é de duas colunas — formulário à esquerda, resumo e gráfico à
direita — e o gráfico tem um botão **expandir** que o joga para a largura toda.
No celular tudo vira uma coluna só.

## A matemática

Resultado de **uma** opção com o ativo a `P` no vencimento:

- CALL comprada: `max(P − strike, 0) − prêmio`
- PUT comprada: `max(strike − P, 0) − prêmio`
- Posições vendidas: o mesmo, com o sinal invertido.

Total = resultado por opção × quantidade. Break-even da CALL é `strike + prêmio`;
da PUT, `strike − prêmio`.

Quando você preenche o book, o **ask** vira o preço de entrada de quem compra e o
**bid**, o de quem vende — é o custo real, não o teórico.

## Cotações

Fonte: [brapi.dev](https://brapi.dev), plano grátis (15.000 requisições/mês).

- **PETR4, VALE3, ITUB4 e MGLU3** funcionam sem token nenhum.
- As outras 16 ações exigem um token grátis da brapi — e ele só funciona depois
  de publicar a função serverless (veja abaixo).
- Nenhuma cotação grátis da B3 é tempo real: vem com atraso (a própria B3 atrasa
  15 min). Por isso a tela sempre mostra o horário do dado.

O frontend tenta primeiro a sua função `/api/cotacao`; se ela não existir (é o
caso do `npm run dev` puro), cai para a chamada direta à brapi.

### Cadeia de opções

Em "Opções de {ATIVO}" dá para listar os vencimentos negociados, abrir as séries
de um deles e clicar em **usar** para preencher o formulário inteiro — código,
tipo, strike, vencimento, prêmio, bid e ask — sem digitar nada.

**O que é grátis:** só **PETR4**. A brapi atende `/api/v2/options/*` sem token
apenas para esse ativo; as demais ações exigem o **plano Pro** (pago) — um token
do plano grátis não basta. Para elas, a ferramenta avisa e você preenche à mão.

Os preços da cadeia são de **fechamento do último pregão**, não do momento atual.
Confira o book na corretora antes de operar.

## Estratégias

Uma posição simples é uma estratégia de **uma perna**. O botão "+ adicionar perna"
(ou o "+ perna" na cadeia de opções) soma outras, e o gráfico e o resumo passam a
mostrar o resultado da estrutura inteira: perda máxima, ganho máximo e todos os
pontos de empate (um straddle tem dois).

Há montagens prontas — trava de alta, trava de baixa, straddle e strangle — que se
armam com as séries reais da cadeia carregada.

A conta é exata, não numérica: o payoff é linear por partes e só dobra nos strikes,
então os extremos e os empates saem por interpolação nos próprios strikes.

## Comparar séries sob um alvo

**Esta parte não prevê nada, e é importante entender por quê.**

Não existe cálculo que aponte a opção que vai dar lucro — isso exigiria saber o
preço futuro do ativo. O comparador responde uma pergunta *condicional*:

> Se o ativo terminar no preço-alvo que **você** digitou, qual série teria rendido mais?

É aritmética, não previsão. Muda o alvo, muda o ranking inteiro. Três listas:

- **Melhor compra** — maior retorno sobre o custo, entrando pelo ask.
- **Melhor venda** — séries que virariam pó no alvo, ordenadas pelo prêmio. Exige
  pelo menos **5% de folga** entre o alvo e o strike: sem esse piso o ranking sempre
  apontaria a opção mais perto de ser exercida, que é a mais arriscada.
- **Melhor estratégia** — travas de dois strikes, que barateiam a entrada e põem
  teto na perda.

Só entram séries com giro no pregão e com preço no lado do book que interessa — um
preço ótimo numa opção que ninguém negocia não serve para nada.

## Minhas opções (a carteira)

O **código da opção** é o identificador da posição. Salvar de novo o mesmo código
atualiza a posição em vez de duplicar.

A tabela mostra, por posição, o resultado **se o ativo terminar no preço de hoje**
— que não é a marcação a mercado da opção (para isso seria preciso o prêmio
negociado agora, que a ferramenta não acompanha). O preço de entrada fica
congelado no momento em que você salva; o botão **Atualizar cotações** repuxa o
preço dos ativos e recalcula tudo.

### Token em desenvolvimento local

Opcional. Copie `.env.example` para `.env.local` e preencha `VITE_BRAPI_TOKEN`.
Esse arquivo é ignorado pelo Git, e a variável só é lida em modo dev.

> **O token nunca vai para o repositório nem para o código do site publicado.**
> Em produção ele mora exclusivamente na variável de ambiente da hospedagem,
> lida pela função serverless.

## Publicar de graça

### Cloudflare Pages (recomendado)

Tem função serverless no plano grátis e não restringe uso pessoal.

1. `dash.cloudflare.com` → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Autorize o GitHub e escolha o repositório `calc-opcoes`.
3. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. **Settings → Variables and Secrets** → adicione o secret:
   - Nome: `BRAPI_TOKEN`
   - Valor: o token do painel da brapi
   - Marque **Production** e **Preview**.
5. Deploy. Você recebe um link `.pages.dev`.

O arquivo `functions/api/cotacao.js` vira a rota `/api/cotacao` sozinho — não
precisa configurar nada além do secret.

### Vercel (alternativa)

1. `vercel.com` → **Import Project** → escolha o repositório.
2. A Vercel detecta o Vite sozinha (`npm run build`, saída `dist`).
3. **Settings → Environment Variables** → `BRAPI_TOKEN` (Production + Preview).
4. Deploy. Link `.vercel.app`.

Aqui quem atende `/api/cotacao` é o arquivo `api/cotacao.js`. Os dois arquivos
podem conviver no repositório: cada plataforma ignora o da outra.

Depois de conectado, todo `git push` republica o site sozinho.

## Acessibilidade e cores

O gráfico usa aqua para lucro e vermelho para prejuízo, um par validado para
daltonismo (ΔE 9,9 em deuteranopia). Ainda assim, a cor é só reforço: o que
carrega o sentido é a posição da linha em relação à linha do zero — que é
rotulada — e os textos "Lucro"/"Prejuízo". Há também um botão **ver tabela** com
os mesmos números. A interface é clara em todos os aparelhos.

## O que a ferramenta NÃO faz

- Não modela a perda de valor pelo tempo antes do vencimento (**theta**).
- Não inclui corretagem nem impostos.
- Não usa cotação de tempo real.

Serve para entender a estrutura de ganho e perda de uma posição. **Não é
recomendação de investimento.** Opções são de alto risco e a perda pode chegar a
100% do valor investido.
