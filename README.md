# Roleta Vision AI

Análise estatística descritiva da Roleta Brasileira ao Vivo (Playtech, roleta europeia · 37 casas).

**Princípio inegociável:** numa roda funcionando corretamente cada giro é independente. A vantagem da casa é fixa em **−2,70%** sobre toda aposta. Nenhuma análise de giros passados prevê o próximo giro.

Este app NUNCA:

- diz qual número/setor "vai sair"
- exibe "sinais", "entradas" ou números "puxados" como recomendação
- sugere progressão de aposta após perdas (Martingale etc.)
- automatiza apostas

Este app SEMPRE:

- trata padrões observados como variância aleatória até prova estatística do contrário
- mostra a perda esperada acumulada (stake × rodadas × 2,70%)
- coloca gestão de banca e limites como módulo principal

## Telas

| Rota | O que faz |
| --- | --- |
| `/` | Dashboard: saldo da sessão, perda esperada acumulada, alertas de limite atingido |
| `/inserir` | Teclado 0–36, importar sequência colada, histórico |
| `/roda` | Mapa físico da roda europeia (sequência horária real) com calor descritivo |
| `/analise` | z-score por setor/dúzia/coluna/cor/terminal, qui-quadrado de uniformidade, gap, índice de concentração |
| `/banca` | Configuração de banca (stake plano, stop loss, meta, máx. rodadas), simulação Monte Carlo (400 trials) com vantagem de −2,70% embutida |
| `/rede` | Grafo de conhecimento da roleta + memória Markov (ordem 1/2/3) + **falsificador**: roda o mesmo modelo no real, embaralhado e ruído puro para provar (ou refutar) se há padrão preditivo |

## Pipeline de dados ao vivo

```
Mesa Playtech (DOM/fetch/XHR/WS)
  ↓ extensão Chrome (extension/)
  ↓ POST /webhook-roulette (Supabase edge function)
  ↓ tabela roulette_numbers
  ↓ Supabase realtime subscription
  ↓ store honesta (useHonestStore) — também aceita postMessage direto da extensão
```

A extensão (`extension/`) apenas captura — não toma decisões, não aposta. Conforme a seção 2.1 do prompt mestre, captura assistida por dispositivo pode violar termos de uso de cassinos. Use por sua conta e risco.

## Stack

- Vite 5 + React 18 + TypeScript
- TailwindCSS + shadcn/ui (componentes base)
- Zustand para estado (persistido em localStorage)
- Supabase (Postgres + Realtime + Edge Functions)
- Recharts (gráficos)

## Desenvolvimento

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
npm run typecheck
```

## Edge functions ativas

- `proxy-roleta`: faz polling da fonte externa de giros
- `webhook-roulette`: recebe POST da extensão e grava em `roulette_numbers`

Todas as funções preditivas (`sniper-predict`, `ai-learn`, `omni-core`, `markov-engine`, `pattern-discovery`, etc.) foram removidas no commit do pivot honesto.

## Aviso de jogo responsável

O jogo tem **resultado esperado negativo no longo prazo**. É entretenimento pago, não fonte de renda. Se você está apostando além do que pode perder, procure ajuda: CVV (188), Jogadores Anônimos Brasil (https://www.jogadoresanonimos.com.br).
