import { memo, useState } from 'react';
import { getPredictionExplanation } from '@/lib/getPredictionExplanation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Brain, History, ChevronDown, ChevronUp, Zap, Target, BarChart3, Cpu, TrendingUp, GitMerge, Layers, Dices, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MODEL_ICONS: Record<string, any> = {
  markov: Layers,
  neural_pattern: Brain,
  gradient: BarChart3,
  bayesian: Dices,
  statistical: Target,
  pattern_discovery: Lightbulb,
  rl_optimizer: Cpu,
  momentum: TrendingUp,
  convergence: GitMerge,
};

const MODEL_EMOJI: Record<string, string> = {
  markov: '⛓️',
  neural_pattern: '🧠',
  gradient: '📊',
  bayesian: '🎲',
  statistical: '📐',
  pattern_discovery: '🔍',
  rl_optimizer: '🤖',
  momentum: '🚀',
  convergence: '🔱',
};

interface AgentSignal {
  modelId: string;
  modelName: string;
  numbers: number[];
  confidence: number;
  reasoning: string;
  score: number;
}

interface AIDebatePanelProps {
  agents: AgentSignal[];
  consensusMap?: Record<number, number>;
  ensembleConsensus?: number;
  fusionTop5?: { number: number; score: number; voters: string[]; voterCount: number }[];
  fusionConfidence?: number;
  entryAction?: string;
  totalModels?: number;
  modelPerformance?: Record<string, { winRate: number; total: number; hits: number; streak: number; weight: number }>;
}

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const numColor = (n: number) => n === 0 ? 'bg-emerald-600' : RED_NUMBERS.has(n) ? 'bg-red-600' : 'bg-zinc-800';

const AIDebatePanel = memo(({ agents, consensusMap, ensembleConsensus, fusionTop5, fusionConfidence, entryAction, totalModels = 9, modelPerformance }: AIDebatePanelProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const sortedAgents = Array.isArray(agents) ? [...agents].sort((a, b) => b.confidence - a.confidence) : [];
  const mainNum = fusionTop5?.[0]?.number;
  const votingModels = fusionTop5?.[0]?.voterCount ?? 0;

  const entryColor = entryAction === 'ENTRAR_FORTE' ? 'text-emerald-400' :
    entryAction === 'ENTRAR' ? 'text-yellow-400' :
    entryAction === 'ENTRAR_LEVE' ? 'text-orange-400' : 'text-muted-foreground';

  return (
    <Card className="border-primary/30 bg-card/95 backdrop-blur">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            DEBATE DAS IAs
            <Badge variant="outline" className="text-[10px] ml-1">
              {sortedAgents.length}/{totalModels} ativos
            </Badge>
          </CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <CardContent className="pt-0 space-y-2">
              {/* Consensus Card */}
              {mainNum !== undefined && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground">CONSENSO</span>
                    <span className={`text-xs font-bold ${entryColor}`}>{entryAction || 'AGUARDAR'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {fusionTop5?.slice(0, 5).map((f, i) => (
                        <div key={i} className={`w-8 h-8 rounded-full ${numColor(f.number)} flex items-center justify-center text-white text-xs font-bold ${i === 0 ? 'ring-2 ring-yellow-400 scale-110' : ''}`}>
                          {f.number}
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{votingModels}/{totalModels} modelos → #{mainNum}</span>
                        <span>{fusionConfidence}%</span>
                      </div>
                      <Progress value={fusionConfidence || 0} className="h-2" />
                    </div>
                  </div>
                </div>
              )}

              {/* Per-model debate */}
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                {sortedAgents.map((agent, idx) => {
                  const Icon = MODEL_ICONS[agent.modelId] || Brain;
                  const emoji = MODEL_EMOJI[agent.modelId] || '🤖';
                  const perf = modelPerformance?.[agent.modelId];
                  const wr = perf ? `${(perf.winRate * 100).toFixed(0)}%` : '';

                  return (
                    <div key={idx} className="rounded border border-border/50 bg-muted/30 p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{emoji}</span>
                          <span className="text-xs font-semibold truncate max-w-[120px]">{agent.modelName}</span>
                          {wr && <Badge variant="outline" className="text-[9px] px-1 py-0">{wr}</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-primary">{agent.confidence}%</span>
                          <div className="w-16">
                            <Progress value={agent.confidence} className="h-1.5" />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 mb-1">
                        {agent.numbers.slice(0, 5).map((n, i) => (
                          <span key={i} className={`inline-block w-5 h-5 rounded-full ${numColor(n)} text-white text-[9px] flex items-center justify-center font-bold`}>
                            {n}
                          </span>
                        ))}
                        {agent.numbers.length > 5 && (
                          <span className="text-[9px] text-muted-foreground">+{agent.numbers.length - 5}</span>
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground line-clamp-2 leading-tight">{getPredictionExplanation(agent)}</p>
                    </div>
                  );
                })}
              </div>

              {sortedAgents.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-4">
                  Aguardando sinais dos modelos...
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
});

AIDebatePanel.displayName = 'AIDebatePanel';
export default AIDebatePanel;
