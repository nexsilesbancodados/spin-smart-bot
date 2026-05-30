import { supabase } from "@/integrations/supabase/client";

export type ClaudeTask =
  | "session-report"
  | "family-meta"
  | "critic"
  | "tilt-detect"
  | "pattern-explain";

export interface ClaudeResult {
  text: string;
  model: string;
  task: ClaudeTask;
  input_tokens: number;
  output_tokens: number;
  cached?: boolean;
}

export const analyzeWithClaude = async (
  task: ClaudeTask,
  context: Record<string, unknown>
): Promise<{ result: ClaudeResult | null; error: string | null }> => {
  try {
    const res = await supabase.functions.invoke<ClaudeResult>("claude-analyze", {
      body: { task, context },
    });
    if (res.error) {
      return { result: null, error: res.error.message ?? "Erro ao chamar IA" };
    }
    if (!res.data || !res.data.text) {
      return { result: null, error: "Resposta vazia do servidor" };
    }
    return { result: res.data, error: null };
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};
