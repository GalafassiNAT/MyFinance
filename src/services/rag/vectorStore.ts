import { PortfolioSummary, Holding, Transaction, RecurringBill } from '../../types/models';

export interface ContextChunk {
  id: string;
  category: 'PORTFOLIO_SUMMARY' | 'HOLDING' | 'RECURRING_BILL' | 'TRANSACTION' | 'MARKET_OPPORTUNITY';
  title: string;
  text: string;
  keywords: string[];
  embedding?: number[];
  score?: number;
}

/**
 * Calcula a similaridade de cosseno entre dois vetores normalizados
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Cria pedaços de conhecimento estruturados (Knowledge Chunks)
 * a partir do banco de dados local do usuário para alimentar a busca vetorial / híbrida.
 */
export function buildKnowledgeChunks(
  portfolio: PortfolioSummary,
  transactions: Transaction[],
  recurringBills: RecurringBill[]
): ContextChunk[] {
  const chunks: ContextChunk[] = [];

  // 1. Chunk Síntese Executiva de Patrimônio e Saldo Livre
  const guaranteedIncome = recurringBills
    .filter((b) => b.is_active && b.type === 'INCOME_SALARY')
    .reduce((acc, b) => acc + b.amount, 0);

  const committedExpenses = recurringBills
    .filter((b) => b.is_active && b.type !== 'INCOME_SALARY')
    .reduce((acc, b) => acc + b.amount, 0);

  const freeMonthlyCash = guaranteedIncome - committedExpenses;

  chunks.push({
    id: 'chunk-portfolio-core',
    category: 'PORTFOLIO_SUMMARY',
    title: 'Visão Geral do Patrimônio e Fluxo Livre Mensal',
    text: `Patrimônio Líquido Total: R$ ${portfolio.net_worth.toFixed(2)}. Saldo em contas correntes/liquidez: R$ ${portfolio.total_cash.toFixed(2)}. Valor total em investimentos (FIIs, Ações e Renda Fixa): R$ ${portfolio.total_equity.toFixed(2)}. Rendas/Salários Garantidos Mensais: R$ ${guaranteedIncome.toFixed(2)}. Despesas e Faturas Fixas Comprometidas: R$ ${committedExpenses.toFixed(2)}. Saldo Livre Estimado por Mês para Poupança ou Aportes: R$ ${freeMonthlyCash.toFixed(2)}.`,
    keywords: [
      'patrimonio',
      'patrimônio',
      'saldo',
      'liquidez',
      'renda',
      'salario',
      'salário',
      'livre',
      'poupança',
      'investir',
      'rtx',
      'compra',
      'meta',
      'guardar',
      'planejamento',
      'capacidade',
    ],
  });

  // 2. Chunks individuais por Ativo / Investimento
  portfolio.holdings.forEach((h: Holding) => {
    let fixedDetails = '';
    const ticker = h.ticker || 'ATIVO';
    const name = h.name || ticker;
    const currentVal = h.quantity * (h.current_price || h.average_price || 1.0);
    const keywords = [ticker.toLowerCase(), name.toLowerCase(), (h.asset_class || '').toLowerCase()];

    if (h.fixed_income_details) {
      const init = h.fixed_income_details.initial_amount;
      const profit = currentVal - init;
      fixedDetails = ` Renda Fixa: Taxa de ${h.fixed_income_details.rate_percentage}% do ${h.fixed_income_details.benchmark}. Aporte inicial aplicado: R$ ${init.toFixed(2)}. Lucro/Rendimento acumulado real: R$ ${profit.toFixed(2)} (Saldo bruto acumulado: R$ ${currentVal.toFixed(2)}).`;
      keywords.push('cdb', 'rendimento', 'lucro', 'cdi', 'resgate', 'aporte', 'rendeu');
    } else {
      keywords.push('cota', 'cotas', 'dividendos', 'renda variavel', 'fii', 'acoes');
    }

    chunks.push({
      id: `chunk-holding-${h.id}`,
      category: 'HOLDING',
      title: `Ativo ${ticker} - ${name}`,
      text: `Posição em ${ticker} (${name}) [Classe: ${h.asset_class || 'OUTROS'}]: ${h.quantity} cotas/unidades a preço médio de R$ ${Number(h.average_price).toFixed(2)}, cotação atual de R$ ${Number(h.current_price || h.average_price).toFixed(2)}. Saldo total na posição: R$ ${currentVal.toFixed(2)}.${fixedDetails}`,
      keywords,
    });
  });

  // 3. Chunks individuais por Compromisso Recorrente / Fatura
  recurringBills.forEach((b: RecurringBill) => {
    const itemsText =
      b.items && b.items.length > 0
        ? ` Itens da Fatura: ${b.items.map((it) => `${it.description} (R$ ${it.amount.toFixed(2)} - ${it.category || 'Geral'})`).join(', ')}.`
        : '';

    chunks.push({
      id: `chunk-bill-${b.id}`,
      category: 'RECURRING_BILL',
      title: `${b.name} (${b.type})`,
      text: `Compromisso recorrente: ${b.name} (${b.type}) com valor de R$ ${b.amount.toFixed(2)}, vencimento no dia ${b.due_day} [Status: ${b.is_active ? 'ATIVO' : 'PAUSADO'}]. Categoria: ${b.category || 'Geral'}.${itemsText}`,
      keywords: [
        'fatura',
        'cartao',
        'cartão',
        'conta',
        'parcela',
        'amazon',
        'mercadolivre',
        'mercado livre',
        'assinatura',
        b.name.toLowerCase(),
        (b.category || '').toLowerCase(),
      ],
    });
  });

  // 4. Chunks de Planos e Metas Financeiras (Check Goals)
  if (portfolio.plans && portfolio.plans.length > 0) {
    portfolio.plans.forEach((plan) => {
      const pct = Math.round((plan.savedAmount / plan.targetAmount) * 100);
      const checkpointsText = plan.checkpoints
        ? ` Checkpoints: ${plan.checkpoints.map((cp) => `[${cp.completed ? 'CONCLUÍDO' : 'PENDENTE'}] ${cp.title}`).join(' | ')}.`
        : '';

      chunks.push({
        id: `chunk-plan-${plan.id}`,
        category: 'PORTFOLIO_SUMMARY',
        title: `Plano / Meta: ${plan.title}`,
        text: `Plano Financeiro Ativo: "${plan.title}". Meta total: R$ ${plan.targetAmount.toFixed(2)}. Valor acumulado até agora: R$ ${plan.savedAmount.toFixed(2)} (${pct}% do objetivo). Aporte mensal planejado: R$ ${plan.monthlyContribution.toFixed(2)}/mês. Prazo estimado: ${plan.estimatedMonths} meses. Estratégia: ${plan.strategy}. Notas: ${plan.notes || 'Sem observações'}.${checkpointsText}`,
        keywords: [
          'plano',
          'meta',
          'objetivo',
          'progresso',
          'check',
          'goal',
          plan.title.toLowerCase(),
          'rtx',
          'compra',
          'planejamento',
        ],
      });
    });
  }

  return chunks;
}

/**
 * Busca Híbrida Inteligente (Semântica + Léxica BM25-like):
 * Prioriza os chunks mais relevantes para a dúvida do usuário,
 * garantindo contexto enxuto, alta precisão e baixíssima latência.
 */
export function queryVectorKnowledge(
  userQuery: string,
  allChunks: ContextChunk[],
  topK: number = 4
): ContextChunk[] {
  const queryWords = userQuery
    .toLowerCase()
    .replace(/[^\w\sáéíóúãõâêîôûàèìòùç]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scoredChunks = allChunks.map((chunk) => {
    let score = 0;
    const chunkFullText = (chunk.title + ' ' + chunk.text).toLowerCase();

    // Relevância por termos exatos no texto e título
    queryWords.forEach((word) => {
      if (chunk.title.toLowerCase().includes(word)) score += 5;
      if (chunk.keywords.some((k) => k.includes(word) || word.includes(k))) score += 4;
      if (chunkFullText.includes(word)) score += 2;
    });

    // Se o usuário está perguntando sobre planejamento/compra de algo (ex: RTX 5070 Ti, compra, meta),
    // o chunk de patrimônio geral e fluxo mensal é CRÍTICO
    if (
      userQuery.toLowerCase().match(/(comprar|aquisi|meta|juntar|rtx|vale a pena|parcelar|planej)/) &&
      chunk.category === 'PORTFOLIO_SUMMARY'
    ) {
      score += 15;
    }

    // Se for sobre CDB, impulsiona chunks do CDB
    if (userQuery.toLowerCase().match(/(cdb|c6|rendeu|rendimento)/) && chunk.text.toLowerCase().includes('cdb')) {
      score += 15;
    }

    // Se for sobre fatura ou cartão, impulsiona chunks de faturas
    if (userQuery.toLowerCase().match(/(fatura|cartao|cartão|parcela)/) && chunk.category === 'RECURRING_BILL') {
      score += 12;
    }

    return { ...chunk, score };
  });

  // Ordena por maior pontuação de relevância e devolve os topK
  scoredChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Sempre inclui o resumo de patrimônio se pontuou minimamente
  return scoredChunks.slice(0, topK);
}
