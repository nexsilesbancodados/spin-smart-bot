/**
 * Spin Smart Bot - Public Integration SDK
 * Simplified client for integrating predictions and strategy stats
 */

export interface PredictionRequest {
  numbers: number[];
  sessionId?: string;
}

export interface PredictionResponse {
  signal: {
    predictedNumbers: number[];
    mainNumber: number;
    confidence: number;
    strategies: string[];
  };
  mode: "TENDENCIA" | "REVERSAO" | "NEUTRO" | "waiting";
  layerResults?: any;
  aiLearnings: string[];
  trendEngine?: any;
  dealerBiometrics?: any;
  kellyBetting?: any;
  timestamp: string;
  processingTime: number;
}

export interface StrategyStatsResponse {
  strategy_type: string;
  total_predictions: number;
  total_hits: number;
  win_rate: number;
  exact_hits: number;
  neighbor_hits: number;
  best_streak: number;
  current_streak: number;
}

export interface PredictionHistoryResponse {
  id: string;
  created_at: string;
  predicted_numbers: number[];
  predicted_main: number;
  actual_number: number | null;
  hit: boolean | null;
  hit_type: "exact" | "neighbor" | "miss" | null;
  strategy_type: string;
  confidence: number;
}

export class SpinSmartBotAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(options: { baseUrl?: string; apiKey?: string } = {}) {
    this.baseUrl =
      options.baseUrl || "https://integrate.supabase.co/functions/v1";
    this.apiKey = options.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Get AI prediction for next roulette number
   * @param numbers Array of recent roulette numbers (15-300 recommended)
   * @param sessionId Optional session identifier
   * @returns Prediction with confidence and recommended strategies
   */
  async getPrediction(request: PredictionRequest): Promise<PredictionResponse> {
    const response = await fetch(`${this.baseUrl}/sniper-predict`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Prediction API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get performance statistics for strategies
   * @param timeframe Filter by timeframe ('24h', '7d', '30d', 'all')
   * @param strategy Optional specific strategy filter
   * @returns Array of strategy statistics
   */
  async getStrategyStats(
    timeframe: "24h" | "7d" | "30d" | "all" = "24h",
    strategy?: string,
  ): Promise<StrategyStatsResponse[]> {
    const params = new URLSearchParams({ timeframe });
    if (strategy) params.append("strategy", strategy);

    const response = await fetch(`${this.baseUrl}/strategy-stats?${params}`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Strategy stats API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get prediction history with outcomes
   * @param limit Number of records (default 100, max 1000)
   * @param offset Pagination offset
   * @param resolved Filter by resolved status
   * @returns Array of historical predictions
   */
  async getPredictionHistory(
    limit = 100,
    offset = 0,
    resolved?: boolean,
  ): Promise<PredictionHistoryResponse[]> {
    if (!this.apiKey) {
      throw new Error("Authentication required for prediction history");
    }

    const params = new URLSearchParams({
      limit: Math.min(limit, 1000).toString(),
      offset: offset.toString(),
    });
    if (resolved !== undefined) params.append("resolved", resolved.toString());

    const response = await fetch(
      `${this.baseUrl}/prediction-history?${params}`,
      {
        method: "GET",
        headers: this.getHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(`Prediction history API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get API documentation
   * @returns Complete API specification
   */
  async getDocumentation(): Promise<Record<string, any>> {
    const response = await fetch(`${this.baseUrl}/public-api-docs`, {
      method: "GET",
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Documentation API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Batch predictions for multiple number sets
   * Useful for backtesting or parallel analysis
   */
  async batchPredict(numberArrays: number[][]): Promise<PredictionResponse[]> {
    const promises = numberArrays.map((numbers) =>
      this.getPrediction({ numbers }),
    );
    return Promise.all(promises);
  }

  /**
   * Get best performing strategies
   */
  async getTopStrategies(limit = 5): Promise<StrategyStatsResponse[]> {
    const stats = await this.getStrategyStats("24h");
    return stats.sort((a, b) => b.win_rate - a.win_rate).slice(0, limit);
  }

  /**
   * Calculate average confidence across recent predictions
   */
  async getAverageConfidence(): Promise<number> {
    const history = await this.getPredictionHistory(50);
    const predictions = history.filter(
      (p) => p.predicted_main || p.predicted_numbers,
    );
    if (predictions.length === 0) return 0;

    const total = predictions.reduce((sum, p) => sum + (p.confidence || 0), 0);
    return total / predictions.length;
  }
}

// Export for use in Node.js, browsers, and Deno
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SpinSmartBotAPI };
}
