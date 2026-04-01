// Função utilitária para extrair explicação legível de uma previsão
export function getPredictionExplanation(pred: any): string {
  if (!pred) return '';
  if (typeof pred.justification === 'string' && pred.justification.trim()) return pred.justification;
  if (Array.isArray(pred.reasons) && pred.reasons.length) return pred.reasons.slice(0, 3).join(' | ');
  if (Array.isArray(pred.reasoning) && pred.reasoning.length) return pred.reasoning.slice(0, 3).join(' | ');
  if (typeof pred.reason === 'string' && pred.reason.trim()) return pred.reason;
  return '';
}
