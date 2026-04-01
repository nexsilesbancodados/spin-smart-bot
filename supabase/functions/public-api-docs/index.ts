// Public API Documentation Endpoint
// Exposes the prediction API contract for external integrations

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const API_DOCUMENTATION = {
  version: "1.0.0",
  title: "Spin Smart Bot - Public Prediction API",
  description:
    "Advanced roulette prediction engine with AI-driven pattern recognition and real-time learning",
  baseUrl: "https://integrate.supabase.co/functions/v1",

  endpoints: [
    {
      name: "getPrediction",
      method: "POST",
      path: "/sniper-predict",
      description: "Get AI-powered prediction for next roulette number",
      authentication: "Optional (Supabase API key for higher rate limits)",
      rateLimit: {
        authenticated: "1000 requests/hour",
        anonymous: "100 requests/hour",
      },
      requestBody: {
        type: "object",
        properties: {
          numbers: {
            type: "array",
            items: { type: "number" },
            description:
              "Array of recent roulette numbers (last 15-300 spins recommended)",
            example: "[32, 15, 19, 4, 21, 2, 25, 17, 34, 6]",
          },
          sessionId: {
            type: "string",
            description: "Optional session identifier for tracking patterns",
            example: "session_abc123",
          },
        },
        required: ["numbers"],
      },
      responseBody: {
        type: "object",
        properties: {
          signal: {
            type: "object",
            description: "Main prediction signal",
            properties: {
              predictedNumbers: { type: "array", items: { type: "number" } },
              mainNumber: { type: "number" },
              confidence: { type: "number", min: 0, max: 100 },
              strategies: { type: "array", items: { type: "string" } },
            },
          },
          mode: {
            type: "string",
            enum: ["TENDENCIA", "REVERSAO", "NEUTRO", "waiting"],
            description:
              "Market regime: Trend, Reversal, Neutral, or Waiting for data",
          },
          layerResults: {
            type: "object",
            description:
              "Detailed analysis across 9 computational layers (A-I)",
          },
          aiLearnings: {
            type: "array",
            items: { type: "string" },
            description: "Human-readable insights from AI analysis",
          },
          trendEngine: {
            type: "object",
            description: "Trend analysis (TENDENCIA/REVERSAO detection)",
          },
          dealerBiometrics: {
            type: "object",
            description: "Dealer behavior profile (mechanical vs chaotic)",
          },
          kellyBetting: {
            type: "object",
            description: "Risk management using Kelly Criterion",
          },
          timestamp: { type: "string", format: "ISO8601" },
          processingTime: { type: "number", description: "Milliseconds" },
        },
      },
      examples: [
        {
          title: "Basic prediction request",
          request: {
            numbers: [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30],
          },
          response: {
            signal: {
              predictedNumbers: [8, 23, 10, 5],
              mainNumber: 8,
              confidence: 72,
            },
            mode: "TENDENCIA",
            message: "Prediction ready",
          },
        },
      ],
      errorCodes: {
        400: "Invalid request - missing or invalid 'numbers' array",
        401: "Unauthorized - invalid API key",
        429: "Rate limit exceeded",
        500: "Server error",
      },
    },

    {
      name: "getStrategyStats",
      method: "GET",
      path: "/strategy-stats",
      description: "Get performance statistics for all strategies",
      authentication: "Optional",
      queryParams: {
        timeframe: {
          type: "string",
          enum: ["24h", "7d", "30d", "all"],
          default: "24h",
        },
        strategy: {
          type: "string",
          description: "Filter by specific strategy name (optional)",
        },
      },
      responseBody: {
        type: "array",
        items: {
          type: "object",
          properties: {
            strategy_type: { type: "string" },
            total_predictions: { type: "number" },
            total_hits: { type: "number" },
            win_rate: { type: "number", min: 0, max: 1 },
            exact_hits: { type: "number" },
            neighbor_hits: { type: "number" },
            best_streak: { type: "number" },
            current_streak: { type: "number" },
          },
        },
      },
    },

    {
      name: "getPredictionHistory",
      method: "GET",
      path: "/prediction-history",
      description: "Retrieve past predictions and their outcomes",
      authentication: "Required",
      queryParams: {
        limit: { type: "number", default: 100, max: 1000 },
        offset: { type: "number", default: 0 },
        resolved: { type: "boolean", description: "Filter by resolved status" },
      },
      responseBody: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            created_at: { type: "string", format: "ISO8601" },
            predicted_numbers: { type: "array", items: { type: "number" } },
            predicted_main: { type: "number" },
            actual_number: { type: "number" },
            hit: { type: "boolean" },
            hit_type: { type: "string", enum: ["exact", "neighbor", "miss"] },
            strategy_type: { type: "string" },
            confidence: { type: "number" },
          },
        },
      },
    },
  ],

  authentication: {
    description:
      "Optional authentication for higher rate limits and priority processing",
    methods: [
      {
        type: "API Key",
        header: "Authorization",
        format: "Bearer YOUR_SUPABASE_API_KEY",
        obtain: "https://app.supabase.com/project/[project-id]/api/keys",
      },
    ],
  },

  sdks: {
    javascript: {
      package: "npm install spin-smart-bot-sdk",
      example: `
import { SpinSmartBot } from 'spin-smart-bot-sdk';

const bot = new SpinSmartBot({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://integrate.supabase.co/functions/v1'
});

const prediction = await bot.getPrediction({
  numbers: [32, 15, 19, 4, 21, 2, 25, 17, 34, 6]
});

console.log('Predicted numbers:', prediction.signal.predictedNumbers);
console.log('Confidence:', prediction.signal.confidence);
      `,
    },
    python: {
      package: "pip install spin-smart-bot",
      example: `
from spin_smart_bot import SpinSmartBot

bot = SpinSmartBot(api_key='YOUR_API_KEY')

prediction = bot.get_prediction(
    numbers=[32, 15, 19, 4, 21, 2, 25, 17, 34, 6]
)

print(f"Predicted numbers: {prediction['signal']['predictedNumbers']}")
print(f"Confidence: {prediction['signal']['confidence']}")
      `,
    },
  },

  useCases: [
    {
      title: "Real-time Betting Application",
      description:
        "Integrate live predictions into betting platforms with confidence filtering",
    },
    {
      title: "Data Science Research",
      description:
        "Use prediction API for pattern analysis and machine learning research",
    },
    {
      title: "Trading Bots",
      description:
        "Feed predictions into automated trading systems with risk management",
    },
    {
      title: "Analytics Dashboard",
      description:
        "Monitor prediction performance and strategy statistics in real-time",
    },
  ],

  rateLimits: {
    description: "API rate limiting to ensure fair usage",
    anonymous: "100 requests per hour",
    authenticated: "1000 requests per hour",
    enterprise: "Custom limits available",
  },

  support: {
    documentation: "https://docs.spin-smart-bot.com",
    issues: "https://github.com/spin-smart-bot/issues",
    email: "api-support@spin-smart-bot.com",
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("OK", { headers: corsHeaders });
  }

  // GET documentation
  if (req.method === "GET") {
    return new Response(JSON.stringify(API_DOCUMENTATION, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    headers: corsHeaders,
    status: 405,
  });
});
