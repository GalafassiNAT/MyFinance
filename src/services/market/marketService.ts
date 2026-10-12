import { PortfolioSummary, Holding } from '../../types/models';

export interface MarketAsset {
  ticker: string;
  name: string;
  category: 'FII' | 'ETF' | 'RENDA_FIXA' | 'ACAO';
  currentPrice: number;
  yieldOrRate: string; // Ex: '12.4% a.a.' ou '105% CDI'
  recommendationType: 'OPORTUNIDADE' | 'DIVERSIFICACAO' | 'DEFENSIVO';
  rationale: string;
}

export const MARKET_OPPORTUNITIES: MarketAsset[] = [
  {
    ticker: 'BTLG11',
    name: 'BTG Pactual Logística FII',
    category: 'FII',
    currentPrice: 101.40,
    yieldOrRate: '9.3% a.a. (Dividend Yield)',
    recommendationType: 'DIVERSIFICACAO',
    rationale: 'Galpões logísticos classe A com contratos atípicos. Complementa a exposição de tijolo com o BRCO11.',
  },
  {
    ticker: 'HGLG11',
    name: 'CSHG Logística FII',
    category: 'FII',
    currentPrice: 162.80,
    yieldOrRate: '8.8% a.a. (Dividend Yield)',
    recommendationType: 'DEFENSIVO',
    rationale: 'Fundo resiliente de altíssima liquidez e histórico consolidado de distribuição.',
  },
  {
    ticker: 'IVVB11',
    name: 'iShares S&P 500 ETF',
    category: 'ETF',
    currentPrice: 312.50,
    yieldOrRate: 'Dólar + S&P 500',
    recommendationType: 'DIVERSIFICACAO',
    rationale: 'Diversificação geográfica global e proteção cambial contra o risco Brasil.',
  },
  {
    ticker: 'CDB 110% CDI',
    name: 'CDB Banco Master / C6 Promocional',
    category: 'RENDA_FIXA',
    currentPrice: 1000.00,
    yieldOrRate: '110% do CDI (Liquidez no vencimento)',
    recommendationType: 'OPORTUNIDADE',
    rationale: 'Prêmio superior ao CDB de liquidez diária tradicional para prazos de 1 a 2 anos.',
  },
  {
    ticker: 'TESOURO SELIC 2029',
    name: 'Tesouro Selic Pós-fixado',
    category: 'RENDA_FIXA',
    currentPrice: 148.50,
    yieldOrRate: 'Selic + 0.15% a.a.',
    recommendationType: 'DEFENSIVO',
    rationale: 'Risco soberano zero e liquidez diária D+0, ideal para reforço de reserva de oportunidade.',
  },
];

export interface PortfolioInsights {
  cashPercent: number;
  fixedPercent: number;
  equityPercent: number;
  tips: string[];
  opportunities: MarketAsset[];
}

/**
 * Gera recomendações analíticas personalizadas com base na composição real da carteira
 */
export function generatePortfolioInsights(portfolio: PortfolioSummary | null): PortfolioInsights {
  if (!portfolio || portfolio.net_worth === 0) {
    return {
      cashPercent: 0,
      fixedPercent: 0,
      equityPercent: 0,
      tips: ['Cadastre suas contas e primeiros investimentos para receber um diagnóstico sob medida.'],
      opportunities: MARKET_OPPORTUNITIES,
    };
  }

  const cashPercent = (portfolio.total_cash / portfolio.net_worth) * 100;
  const fixedIncomeVal = portfolio.holdings
    .filter((h: Holding) => ['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(h.asset_class || ''))
    .reduce((sum: number, h: Holding) => sum + h.quantity * (h.current_price || h.average_price), 0);
  const fixedPercent = (fixedIncomeVal / portfolio.net_worth) * 100;

  const equityVal = portfolio.holdings
    .filter((h: Holding) => !['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(h.asset_class || ''))
    .reduce((sum: number, h: Holding) => sum + h.quantity * (h.current_price || h.average_price), 0);
  const equityPercent = (equityVal / portfolio.net_worth) * 100;

  const tips: string[] = [];

  if (fixedPercent > 60) {
    tips.push(
      `Sua carteira está altamente concentrada em Renda Fixa e CDB (${fixedPercent.toFixed(1)}%). Considere balancear gradualmente aportes em Fundos Imobiliários de Tijolo/Papel para gerar fluxo de dividendos isentos mensais.`
    );
  }

  if (cashPercent < 15) {
    tips.push(
      `Sua reserva de caixa imediato em conta está em ${cashPercent.toFixed(1)}%. Mantenha uma reserva em liquidez diária antes de travar capital em ativos de prazo mais longo.`
    );
  }

  if (equityPercent > 0 && equityPercent < 30) {
    tips.push(
      `Sua fatia de Bolsa de Valores (${equityPercent.toFixed(1)}%) possui uma base sólida em FIIs (MXRF11, KNCR11, BRCO11) e ETFs internacionais (NASD11, XINA11). Novos aportes podem focar em ativos de valor ou dividendos consistentes.`
    );
  }

  return {
    cashPercent,
    fixedPercent,
    equityPercent,
    tips,
    opportunities: MARKET_OPPORTUNITIES,
  };
}
