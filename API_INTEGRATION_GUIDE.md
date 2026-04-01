# Spin Smart Bot - API de Previsões e Integrações Externas

## Visão Geral

A **Spin Smart Bot API** expõe o poder do motor de previsão de roleta com IA para integrações externas. Você pode usar nossas previsões em:

- **Plataformas de apostas**: Integração em tempo real com confiança e recomendações de risco
- **Pesquisa de dados**: Análise de padrões e histórico de desempenho
- **Trading bots**: Alimentar sistemas automatizados com sinais confiáveis
- **Dashboards analíticos**: Monitorar performance de estratégias em tempo real

## 🚀 Quick Start

### 1. Instalação do SDK

```bash
npm install spin-smart-bot-sdk
# ou
yarn add spin-smart-bot-sdk
```

### 2. Uso Básico

```typescript
import { SpinSmartBotAPI } from "spin-smart-bot-sdk";

const bot = new SpinSmartBotAPI({
  baseUrl: "https://integrate.supabase.co/functions/v1",
  apiKey: "sua-chave-api-aqui", // opcional para mais rate limits
});

// Obter previsão
const prediction = await bot.getPrediction({
  numbers: [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30],
});

console.log("Números preditos:", prediction.signal.predictedNumbers);
console.log("Número principal:", prediction.signal.mainNumber);
console.log("Confiança:", prediction.signal.confidence);
console.log("Modo:", prediction.mode);
```

### 3. Entender a Resposta

```typescript
{
  signal: {
    predictedNumbers: [8, 23, 10, 5],      // Números mais prováveis
    mainNumber: 8,                          // Primeira recomendação
    confidence: 72,                         // 0-100%
    strategies: ['sniper', 'voisins', ...] // Estratégias ativas
  },
  mode: 'TENDENCIA',                        // TENDENCIA | REVERSAO | NEUTRO
  aiLearnings: [                            // Insights em português
    '🚀 MODO TENDÊNCIA: Jogar A FAVOR do algoritmo',
    '🔴 Vermelho ACELERANDO...'
  ],
  kellyBetting: {
    unitMultiplier: 2,                      // Multiplicador de risco
    riskLevel: 'elevado'                    // minimo | normal | elevado | maximo
  },
  timestamp: '2026-03-31T10:30:00Z',
  processingTime: 145                       // ms
}
```

## 📊 Endpoints Disponíveis

### GET `/public-api-docs`

Documentação completa da API

```bash
curl https://integrate.supabase.co/functions/v1/public-api-docs
```

### POST `/sniper-predict`

Obter previsão de número

**Request:**

```json
{
  "numbers": [32, 15, 19, 4, 21, 2, 25, 17, 34, 6],
  "sessionId": "optional-session-123"
}
```

**Response:** Veja exemplo acima

### GET `/strategy-stats`

Performance das estratégias

```bash
curl "https://integrate.supabase.co/functions/v1/strategy-stats?timeframe=24h"
```

**Parâmetros:**

- `timeframe`: '24h' | '7d' | '30d' | 'all' (padrão: '24h')
- `strategy`: Filtrar estratégia específica (opcional)

**Response:**

```json
[
  {
    "strategy_type": "sniper",
    "total_predictions": 125,
    "total_hits": 38,
    "win_rate": 0.304,
    "exact_hits": 12,
    "neighbor_hits": 26,
    "best_streak": 5,
    "current_streak": 2
  }
]
```

### GET `/prediction-history`

Histórico de previsões (requer autenticação)

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://integrate.supabase.co/functions/v1/prediction-history?limit=10"
```

**Parâmetros:**

- `limit`: 1-1000 (padrão: 100)
- `offset`: Para paginação (padrão: 0)
- `resolved`: Filtrar apenas resolvidas (true/false)

## 💻 Exemplos de Integração

### JavaScript/Node.js

```typescript
import { SpinSmartBotAPI } from "spin-smart-bot-sdk";

async function runBettingBot() {
  const bot = new SpinSmartBotAPI({ apiKey: process.env.SPIN_API_KEY });

  const recentNumbers = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6];

  const prediction = await bot.getPrediction({ numbers: recentNumbers });

  // Aplicar filtro de confiança
  if (prediction.signal.confidence >= 70) {
    console.log("✅ Sinal forte:", prediction.signal.mainNumber);

    // Usar recomendação de risco Kelly
    const unitsToRisk = prediction.kellyBetting?.unitMultiplier || 1;
    console.log(`Risco recomendado: ${unitsToRisk}x`);
  } else {
    console.log("⚠️ Confiança baixa, aguardando...");
  }
}

runBettingBot().catch(console.error);
```

### Python

```python
import requests
import json

BASE_URL = "https://integrate.supabase.co/functions/v1"
API_KEY = "sua-chave-api"

def get_prediction(numbers):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "numbers": numbers,
        "sessionId": "session-001"
    }

    response = requests.post(
        f"{BASE_URL}/sniper-predict",
        headers=headers,
        json=payload
    )

    return response.json()

# Usar
recent_spins = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6]
prediction = get_prediction(recent_spins)

print(f"Predicted: {prediction['signal']['predictedNumbers']}")
print(f"Confidence: {prediction['signal']['confidence']}%")
print(f"Mode: {prediction['mode']}")
```

### cURL

```bash
# Obter previsão
curl -X POST https://integrate.supabase.co/functions/v1/sniper-predict \
  -H "Content-Type: application/json" \
  -d '{
    "numbers": [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30],
    "sessionId": "session-001"
  }'

# Obter estatísticas
curl "https://integrate.supabase.co/functions/v1/strategy-stats?timeframe=24h"

# Obter histórico (com autenticação)
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://integrate.supabase.co/functions/v1/prediction-history?limit=50"
```

## 🔐 Autenticação

### Sem autenticação (limite 100 req/hora)

```typescript
const bot = new SpinSmartBotAPI();
const prediction = await bot.getPrediction({ numbers: [...] });
```

### Com autenticação (limite 1000 req/hora)

```typescript
const bot = new SpinSmartBotAPI({
  apiKey: process.env.SUPABASE_API_KEY,
});
```

**Obter sua chave:**

1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá para Settings → API
4. Copie sua chave pública ou anon key

## ⚡ Rate Limiting

- **Anonymous**: 100 requisições/hora
- **Authenticated**: 1000 requisições/hora
- **Enterprise**: Limites customizados

Quando exceder o limite, receberá:

```json
{
  "error": "Rate limit exceeded",
  "status": 429,
  "retryAfter": 3600
}
```

## 📈 Melhores Práticas

### 1. Usar Confiança como Filtro

```typescript
const prediction = await bot.getPrediction({ numbers });

if (prediction.signal.confidence >= 70) {
  // Aposta recomendada
} else if (prediction.signal.confidence >= 50) {
  // Aposta pequena
} else {
  // Não apostar
}
```

### 2. Respeitar o Modo da Mesa

```typescript
if (prediction.mode === "TENDENCIA") {
  // Jogar A FAVOR do algoritmo
  betOn(prediction.signal.mainNumber);
} else if (prediction.mode === "REVERSAO") {
  // Jogar CONTRA a tendência
  betOn(getOpposite(prediction.signal.mainNumber));
} else {
  // Modo neutral - cautela
  reduceRisk();
}
```

### 3. Monitorar Performance

```typescript
const topStrategies = await bot.getTopStrategies(5);

topStrategies.forEach((strategy) => {
  console.log(
    `${strategy.strategy_type}: ${(strategy.win_rate * 100).toFixed(1)}%`,
  );
});
```

### 4. Usar Batch para Análise

```typescript
const numberSets = [
  [32, 15, 19, 4, 21],
  [21, 2, 25, 17, 34],
  [34, 6, 27, 13, 36],
];

const predictions = await bot.batchPredict(numberSets);
predictions.forEach((p) => {
  console.log(`Confidence: ${p.signal.confidence}%`);
});
```

## 🐛 Tratamento de Erros

```typescript
try {
  const prediction = await bot.getPrediction({ numbers: recentNumbers });
} catch (error) {
  if (error.status === 429) {
    console.error("Rate limit exceeded");
    // Aguardar antes de tentar novamente
  } else if (error.status === 400) {
    console.error("Invalid request - check numbers array");
  } else if (error.status === 401) {
    console.error("Unauthorized - check API key");
  } else {
    console.error("Prediction failed:", error.message);
  }
}
```

## 📞 Suporte

- **Documentação**: https://docs.spin-smart-bot.com
- **Issues**: https://github.com/spin-smart-bot/issues
- **Email**: api-support@spin-smart-bot.com
- **Discord**: https://discord.gg/spin-smart-bot

## 📄 Licença

A API é fornecida sob licença comercial. Veja LICENSE.md para detalhes.

---

**Última atualização**: 31 de março de 2026
**Versão API**: 1.0.0
