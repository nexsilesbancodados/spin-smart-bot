import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  SpinSmartBotAPI,
  PredictionResponse,
  StrategyStatsResponse,
} from "../lib/spin-smart-bot-api";

describe("SpinSmartBotAPI - External Integration", () => {
  let api: SpinSmartBotAPI;
  let mockFetch: any;

  beforeAll(() => {
    api = new SpinSmartBotAPI({
      baseUrl: "http://localhost:3000/functions/v1",
      apiKey: "test-key-123",
    });

    // Mock fetch for testing
    globalThis.fetch = vi.fn();
    mockFetch = globalThis.fetch as any;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("getPrediction", () => {
    it("should return valid prediction response", async () => {
      const mockResponse: PredictionResponse = {
        signal: {
          predictedNumbers: [8, 23, 10, 5],
          mainNumber: 8,
          confidence: 72,
          strategies: ["sniper", "voisins"],
        },
        mode: "TENDENCIA",
        aiLearnings: [
          "🚀 MODO TENDÊNCIA: Jogar A FAVOR do algoritmo (72% confiança)",
          "🔴 Vermelho ACELERANDO: 4/5 recentes",
        ],
        timestamp: new Date().toISOString(),
        processingTime: 145,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.getPrediction({
        numbers: [32, 15, 19, 4, 21, 2, 25, 17, 34, 6],
      });

      expect(result.signal.mainNumber).toBe(8);
      expect(result.signal.confidence).toBe(72);
      expect(result.mode).toBe("TENDENCIA");
      expect(result.aiLearnings.length).toBeGreaterThan(0);
    });

    it("should include session ID in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          signal: { predictedNumbers: [8] },
          mode: "NEUTRO",
          aiLearnings: [],
          timestamp: new Date().toISOString(),
          processingTime: 100,
        }),
      });

      await api.getPrediction({
        numbers: [32, 15, 19],
        sessionId: "session-abc123",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("sniper-predict"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("session-abc123"),
        }),
      );
    });

    it("should handle prediction error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
      });

      await expect(api.getPrediction({ numbers: [] })).rejects.toThrow(
        "Prediction API error",
      );
    });
  });

  describe("getStrategyStats", () => {
    it("should return strategy statistics", async () => {
      const mockStats: StrategyStatsResponse[] = [
        {
          strategy_type: "sniper",
          total_predictions: 125,
          total_hits: 38,
          win_rate: 0.304,
          exact_hits: 12,
          neighbor_hits: 26,
          best_streak: 5,
          current_streak: 2,
        },
        {
          strategy_type: "voisins",
          total_predictions: 95,
          total_hits: 32,
          win_rate: 0.337,
          exact_hits: 8,
          neighbor_hits: 24,
          best_streak: 4,
          current_streak: 1,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await api.getStrategyStats("24h");

      expect(result).toHaveLength(2);
      expect(result[0].strategy_type).toBe("sniper");
      expect(result[0].win_rate).toBe(0.304);
    });

    it("should filter by strategy type", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            strategy_type: "sniper",
            total_predictions: 125,
            total_hits: 38,
            win_rate: 0.304,
            exact_hits: 12,
            neighbor_hits: 26,
            best_streak: 5,
            current_streak: 2,
          },
        ],
      });

      const result = await api.getStrategyStats("24h", "sniper");

      expect(result).toHaveLength(1);
      expect(result[0].strategy_type).toBe("sniper");
    });

    it("should support different timeframes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      for (const timeframe of ["24h", "7d", "30d", "all"] as const) {
        await api.getStrategyStats(timeframe);
      }

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("getPredictionHistory", () => {
    it("should require authentication", async () => {
      const unauthenticatedApi = new SpinSmartBotAPI();

      await expect(unauthenticatedApi.getPredictionHistory()).rejects.toThrow(
        "Authentication required",
      );
    });

    it("should return prediction history", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "pred-123",
            created_at: "2026-03-31T10:30:00Z",
            predicted_numbers: [8, 23, 10, 5],
            predicted_main: 8,
            actual_number: 8,
            hit: true,
            hit_type: "exact",
            strategy_type: "sniper",
            confidence: 72,
          },
          {
            id: "pred-124",
            created_at: "2026-03-31T10:15:00Z",
            predicted_numbers: [23, 10, 5],
            predicted_main: 23,
            actual_number: 10,
            hit: true,
            hit_type: "neighbor",
            strategy_type: "voisins",
            confidence: 65,
          },
        ],
      });

      const result = await api.getPredictionHistory(10);

      expect(result).toHaveLength(2);
      expect(result[0].hit).toBe(true);
      expect(result[0].hit_type).toBe("exact");
      expect(result[1].hit_type).toBe("neighbor");
    });

    it("should support pagination", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.getPredictionHistory(50, 100);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("limit=50"),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("offset=100"),
        expect.anything(),
      );
    });

    it("should filter by resolved status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await api.getPredictionHistory(100, 0, true);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("resolved=true"),
        expect.anything(),
      );
    });
  });

  describe("getDocumentation", () => {
    it("should return API documentation", async () => {
      const mockDocs = {
        version: "1.0.0",
        title: "Spin Smart Bot - Public Prediction API",
        endpoints: [
          { name: "getPrediction", method: "POST", path: "/sniper-predict" },
          { name: "getStrategyStats", method: "GET", path: "/strategy-stats" },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDocs,
      });

      const result = await api.getDocumentation();

      expect(result.version).toBe("1.0.0");
      expect(result.endpoints).toHaveLength(2);
    });
  });

  describe("batchPredict", () => {
    it("should handle multiple number sets", async () => {
      const mockResponse1: PredictionResponse = {
        signal: {
          predictedNumbers: [8],
          mainNumber: 8,
          confidence: 70,
          strategies: [],
        },
        mode: "NEUTRO",
        aiLearnings: [],
        timestamp: new Date().toISOString(),
        processingTime: 100,
      };

      const mockResponse2: PredictionResponse = {
        signal: {
          predictedNumbers: [23],
          mainNumber: 23,
          confidence: 75,
          strategies: [],
        },
        mode: "TENDENCIA",
        aiLearnings: [],
        timestamp: new Date().toISOString(),
        processingTime: 120,
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse1 })
        .mockResolvedValueOnce({ ok: true, json: async () => mockResponse2 });

      const result = await api.batchPredict([
        [32, 15, 19, 4, 21],
        [21, 2, 25, 17, 34],
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].signal.mainNumber).toBe(8);
      expect(result[1].signal.mainNumber).toBe(23);
    });
  });

  describe("getTopStrategies", () => {
    it("should return strategies sorted by win rate", async () => {
      const mockStats: StrategyStatsResponse[] = [
        {
          strategy_type: "voisins",
          total_predictions: 95,
          total_hits: 32,
          win_rate: 0.337,
          exact_hits: 8,
          neighbor_hits: 24,
          best_streak: 4,
          current_streak: 1,
        },
        {
          strategy_type: "sniper",
          total_predictions: 125,
          total_hits: 38,
          win_rate: 0.304,
          exact_hits: 12,
          neighbor_hits: 26,
          best_streak: 5,
          current_streak: 2,
        },
        {
          strategy_type: "cavalos",
          total_predictions: 60,
          total_hits: 18,
          win_rate: 0.3,
          exact_hits: 5,
          neighbor_hits: 13,
          best_streak: 3,
          current_streak: 0,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      });

      const result = await api.getTopStrategies(2);

      expect(result).toHaveLength(2);
      expect(result[0].strategy_type).toBe("voisins");
      expect(result[1].strategy_type).toBe("sniper");
    });
  });

  describe("getAverageConfidence", () => {
    it("should calculate average confidence", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { predicted_main: 8, confidence: 75 },
          { predicted_main: 23, confidence: 80 },
          { predicted_main: 10, confidence: 70 },
        ],
      });

      const result = await api.getAverageConfidence();

      expect(result).toBe(75); // (75 + 80 + 70) / 3
    });

    it("should handle empty history", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await api.getAverageConfidence();

      expect(result).toBe(0);
    });
  });
});
