import { Platform } from 'react-native';
import {
  Account,
  Asset,
  Holding,
  Institution,
  Transaction,
  PortfolioSummary,
  RecurringBill,
  AssetClass,
  FinancialPlan,
  CheckGoal,
} from '../types/models';

// MOCK DATA PREPARADO
export const MOCK_ACCOUNTS: Account[] = [
  { id: 'acc-nu-checking', institution_id: 'inst-nubank', name: 'Conta Corrente Nu', type: 'CHECKING', currency: 'BRL', current_ledger_balance: 3250.00 },
  { id: 'acc-nu-box', institution_id: 'inst-nubank', name: 'Caixinha Turbo Nu', type: 'SAVINGS_TURBO', currency: 'BRL', current_ledger_balance: 8500.00 },
  { id: 'acc-c6-checking', institution_id: 'inst-c6', name: 'Conta C6', type: 'CHECKING', currency: 'BRL', current_ledger_balance: 1420.00 },
];

export const MOCK_HOLDINGS: (Holding & { ticker: string; name: string; current_price: number })[] = [
  { id: 'hld-1', account_id: 'acc-nu-checking', asset_id: 'ast-mxrf11', quantity: 350, average_price: 10.25, ticker: 'MXRF11', name: 'Maxi Renda FII', current_price: 10.45 },
  { id: 'hld-2', account_id: 'acc-c6-checking', asset_id: 'ast-kncr11', quantity: 45, average_price: 102.50, ticker: 'KNCR11', name: 'Kinea Rendimentos Imobiliários', current_price: 103.80 },
  { id: 'hld-3', account_id: 'acc-nu-checking', asset_id: 'ast-brco11', quantity: 30, average_price: 118.00, ticker: 'BRCO11', name: 'Bresco Logística FII', current_price: 121.10 },
];

export const MOCK_RECURRING_BILLS: RecurringBill[] = [
  {
    id: 'bill-1',
    name: 'Fatura Nubank',
    amount: 1450.00,
    due_day: 15,
    type: 'INVOICE',
    category: 'Cartão de Crédito',
    auto_detect_keyword: 'fatura',
    is_active: true,
    items: [
      { id: 'm-item-1', description: 'Assinatura Netflix 4K', amount: 59.90, category: 'Lazer e Streaming', date: '2026-10-20' },
      { id: 'm-item-2', description: 'Assinatura Spotify Família', amount: 34.90, category: 'Lazer e Streaming', date: '2026-10-22' },
      { id: 'm-item-3', description: 'Supermercado e Restaurantes', amount: 1355.20, category: 'Alimentação', date: '2026-10-24' },
    ],
  },
  { id: 'bill-2', name: 'Aluguel do Imóvel', amount: 1800.00, due_day: 5, type: 'MONTHLY_BILL', category: 'Moradia', auto_detect_keyword: 'aluguel', is_active: true },
  { id: 'bill-3', name: 'Recarga Celular Vivo', amount: 35.00, due_day: 10, type: 'PERIODIC_EXPENSE', category: 'Comunicação', auto_detect_keyword: 'celular', is_active: true },
  { id: 'bill-4', name: 'DAS Simples / MEI', amount: 75.00, due_day: 20, type: 'PERIODIC_EXPENSE', category: 'Impostos', auto_detect_keyword: 'das', is_active: true },
  { id: 'bill-5', name: 'Salário Fixo Mensal', amount: 5200.00, due_day: 5, type: 'INCOME_SALARY', category: 'Salário / Renda Fixa', auto_detect_keyword: 'salario', is_active: true },
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx-m-1', account_id: 'acc-nu-checking', status: 'RECONCILED', source: 'OFX_IMPORT', amount: -1450.00, transaction_date: '2026-10-08T10:00:00Z', description: 'Pagamento Fatura Nubank', category: 'Cartão de Crédito', fitid: 'NU-20261008-01' },
  { id: 'tx-m-2', account_id: 'acc-nu-checking', status: 'PROVISIONAL', source: 'PUSH_NOTIFICATION', amount: -59.90, transaction_date: '2026-10-09T14:20:00Z', description: 'Netflix Assinatura Mensal', category: 'Lazer e Streaming' },
  { id: 'tx-m-3', account_id: 'acc-c6-checking', status: 'SETTLED', source: 'OFX_IMPORT', amount: 4500.00, transaction_date: '2026-10-05T09:00:00Z', description: 'Salário / Pro-labore Mensal', category: 'Salário', fitid: 'C6-20261005-01' },
];

// DADOS REAIS EXTRAÍDOS DO EXTRATO DE CUSTÓDIA OFICIAL NUBANK (10/10/2026)
export const REAL_DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc-nu-real', institution_id: 'inst-nubank', name: 'Conta Nubank (Real)', type: 'CHECKING', currency: 'BRL', current_ledger_balance: 347.19 },
  { id: 'acc-c6-real', institution_id: 'inst-c6', name: 'Conta C6 Bank (Real)', type: 'CHECKING', currency: 'BRL', current_ledger_balance: 0.87 },
];

export const REAL_DEFAULT_HOLDINGS: (Holding & { ticker: string; name: string; current_price: number })[] = [
  // 1. Renda Fixa / Caixinha Nubank
  {
    id: 'hld-real-caixinha',
    account_id: 'acc-nu-real',
    asset_id: 'ast-rdb-reserva',
    ticker: 'RDB-RESERVA',
    name: 'Caixinha Reserva (RDB Resgate Imediato)',
    quantity: 661.38,
    average_price: 1.0,
    current_price: 1.0,
    asset_class: 'RDB',
    fixed_income_details: {
      benchmark: 'CDI',
      rate_percentage: 100,
      initial_date: '2026-01-01',
      initial_amount: 649.11,
    },
  },
  // 2. Tesouro Direto
  {
    id: 'hld-real-tesouro',
    account_id: 'acc-nu-real',
    asset_id: 'ast-td-ipca-2032',
    ticker: 'TD-IPCA+2032',
    name: 'Tesouro IPCA+ 2032',
    quantity: 0.04,
    average_price: 2876.50,
    current_price: 3251.25, // 0.04 * 3251.25 = 130.05
    asset_class: 'TREASURY',
    fixed_income_details: {
      benchmark: 'IPCA',
      rate_percentage: 6.2,
      initial_date: '2026-05-10',
      initial_amount: 115.06,
      maturity_date: '2032-08-15',
    },
  },
  // 3. ETFs
  {
    id: 'hld-real-xina11',
    account_id: 'acc-nu-real',
    asset_id: 'ast-xina11',
    ticker: 'XINA11',
    name: 'Trend China ETF',
    quantity: 9,
    average_price: 6.82,
    current_price: 6.82,
    asset_class: 'ETF',
  },
  {
    id: 'hld-real-nasd11',
    account_id: 'acc-nu-real',
    asset_id: 'ast-nasd11',
    ticker: 'NASD11',
    name: 'Trend Nasdaq 100 ETF',
    quantity: 4,
    average_price: 21.46,
    current_price: 21.46,
    asset_class: 'ETF',
  },
  // 4. Fundos Imobiliários (FIIs)
  {
    id: 'hld-real-mxrf11',
    account_id: 'acc-nu-real',
    asset_id: 'ast-mxrf11',
    ticker: 'MXRF11',
    name: 'Maxi Renda FII',
    quantity: 24,
    average_price: 9.45,
    current_price: 9.45,
    asset_class: 'FII',
  },
  {
    id: 'hld-real-kncr11',
    account_id: 'acc-nu-real',
    asset_id: 'ast-kncr11',
    ticker: 'KNCR11',
    name: 'Kinea Rendimentos FII',
    quantity: 1,
    average_price: 105.45,
    current_price: 105.45,
    asset_class: 'FII',
  },
  {
    id: 'hld-real-brco11',
    account_id: 'acc-nu-real',
    asset_id: 'ast-brco11',
    ticker: 'BRCO11',
    name: 'Bresco Logística FII',
    quantity: 1,
    average_price: 112.19,
    current_price: 112.19,
    asset_class: 'FII',
  },
  // 5. CDB C6 Bank (Total acumulado: R$ 2.965,49 | Lucro: R$ 49,49 | Aplicado: R$ 2.916,00)
  {
    id: 'hld-real-cdb-c6',
    account_id: 'acc-c6-real',
    asset_id: 'ast-cdb-c6-pos',
    ticker: 'CDB-C6',
    name: 'CDB C6 Pós-Fixado Liquidez Diária',
    quantity: 2965.49,
    average_price: 1.0,
    current_price: 1.0,
    asset_class: 'CDB',
    fixed_income_details: {
      benchmark: 'CDI',
      rate_percentage: 102, // 102% do CDI padrão C6
      initial_date: '2026-10-09',
      initial_amount: 2916.00,
    },
  },
];

export const REAL_DEFAULT_BILLS: RecurringBill[] = [
  {
    id: 'bill-real-nu-cc',
    name: 'Fatura Cartão Nubank',
    amount: 259.27,
    due_day: 14,
    type: 'INVOICE',
    category: 'Cartão de Crédito',
    auto_detect_keyword: 'fatura',
    is_active: true,
    items: [
      { id: 'item-1', description: 'Mercadolivre*Mercadol - Parcela 5/12', amount: 34.75, category: 'Compras Parceladas', date: '2026-10-07' },
      { id: 'item-2', description: 'Mercado*Mercadolivre - Parcela 5/12', amount: 82.95, category: 'Compras Parceladas', date: '2026-10-07' },
      { id: 'item-3', description: 'Amazon - Parcela 4/12', amount: 95.34, category: 'Compras Parceladas', date: '2026-10-07' },
      { id: 'item-4', description: 'Mercadolivre*Mercadol - Parcela 5/6', amount: 46.24, category: 'Compras Parceladas', date: '2026-10-07' },
    ],
  },
  {
    id: 'bill-real-phone',
    name: 'Recarga / Plano de Celular',
    amount: 35.00,
    due_day: 10,
    type: 'PERIODIC_EXPENSE',
    category: 'Comunicação',
    auto_detect_keyword: 'celular',
    is_active: true,
  },
  {
    id: 'bill-real-das',
    name: 'Guia DAS (MEI / Simples)',
    amount: 75.00,
    due_day: 20,
    type: 'PERIODIC_EXPENSE',
    category: 'Impostos e Taxas',
    auto_detect_keyword: 'das',
    is_active: true,
  },
  {
    id: 'bill-real-salary',
    name: 'Salário / Renda Mensal Garantida',
    amount: 4500.00,
    due_day: 5,
    type: 'INCOME_SALARY',
    category: 'Salário / Renda Fixa',
    auto_detect_keyword: 'salario',
    is_active: true,
  },
];

export const REAL_DEFAULT_TRANSACTIONS: Transaction[] = [];

// Funções auxiliares de persistência local para Web/Mobile
function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(`myfinance_${key}`);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        console.error('Erro ao ler do storage:', e);
      }
    }
  }
  return defaultValue;
}

function saveToStorage<T>(key: string, value: T): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`myfinance_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('Erro ao gravar no storage:', e);
    }
  }
}

// Planos Padrão / Iniciais
export const REAL_DEFAULT_PLANS: FinancialPlan[] = [
  {
    id: 'plan-rtx-5070ti',
    title: 'Aquisição RTX 5070 Ti',
    targetAmount: 8000.00,
    savedAmount: 0.00,
    monthlyContribution: 2000.00,
    estimatedMonths: 4,
    strategy: 'SAVINGS',
    status: 'IN_PROGRESS',
    created_at: new Date().toISOString(),
    notes: 'Meta planejada com segurança: poupar R$ 2.000/mês do saldo livre em CDB 102% CDI mantendo reserva de emergência intacta.',
    checkpoints: [
      { id: 'cp-1', title: 'Primeiro Aporte (25% - R$ 2.000)', targetAmount: 2000.00, currentAmount: 0, completed: false },
      { id: 'cp-2', title: 'Metade da Meta (50% - R$ 4.000)', targetAmount: 4000.00, currentAmount: 0, completed: false },
      { id: 'cp-3', title: 'Reta Final (75% - R$ 6.000)', targetAmount: 6000.00, currentAmount: 0, completed: false },
      { id: 'cp-4', title: 'Meta Concluída (100% - R$ 8.000)', targetAmount: 8000.00, currentAmount: 0, completed: false },
    ],
  },
];

let userRealAccounts: Account[] = loadFromStorage<Account[]>('userRealAccounts', [...REAL_DEFAULT_ACCOUNTS]);
let userRealHoldings: Holding[] = loadFromStorage<Holding[]>('userRealHoldings', [...REAL_DEFAULT_HOLDINGS]);
let userRealBills: RecurringBill[] = loadFromStorage<RecurringBill[]>('userRealBills', [...REAL_DEFAULT_BILLS]);
let userRealTransactions: Transaction[] = loadFromStorage<Transaction[]>('userRealTransactions', [...REAL_DEFAULT_TRANSACTIONS]);
let userRealPlans: FinancialPlan[] = loadFromStorage<FinancialPlan[]>('userRealPlans', [...REAL_DEFAULT_PLANS]);

let mockAccounts: Account[] = [...MOCK_ACCOUNTS];
let mockHoldings: Holding[] = [...MOCK_HOLDINGS];
let mockBills: RecurringBill[] = [...MOCK_RECURRING_BILLS];
let mockTransactions: Transaction[] = [...MOCK_TRANSACTIONS];
let mockPlans: FinancialPlan[] = [...REAL_DEFAULT_PLANS];

let memorySettings: Record<string, string> = {};
let useMockMode = false;

// Alternar modo Mock vs Real
export function isMockMode(): boolean {
  return useMockMode;
}

export function setMockMode(enabled: boolean): void {
  useMockMode = enabled;
}

// Configurações
export async function getSetting(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(`myfinance_${key}`);
  }
  return memorySettings[key] || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(`myfinance_${key}`, value);
  }
  memorySettings[key] = value;
}

// Resumo do Portfólio
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const accounts = useMockMode ? mockAccounts : userRealAccounts;
  const holdings = useMockMode ? mockHoldings : userRealHoldings;
  const bills = useMockMode ? mockBills : userRealBills;

  const totalCash = accounts.reduce((sum, a) => sum + Number(a.current_ledger_balance), 0);
  const totalEquity = holdings.reduce((sum, h) => sum + Number(h.quantity) * Number(h.current_price || h.average_price), 0);

  const plans = useMockMode ? mockPlans : userRealPlans;

  return {
    total_cash: totalCash,
    total_equity: totalEquity,
    net_worth: totalCash + totalEquity,
    accounts: [...accounts],
    holdings: [...holdings],
    recurringBills: [...bills],
    plans: [...plans],
  };
}

// Transações Recentes
export async function getRecentTransactions(limit = 30): Promise<Transaction[]> {
  const list = useMockMode ? mockTransactions : userRealTransactions;
  return [...list].slice(0, limit);
}

// Criar Transação Manual (Entrada ou Saída)
export async function addManualTransaction(params: {
  accountId: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  category: string;
  date?: string;
}): Promise<Transaction> {
  const accounts = useMockMode ? mockAccounts : userRealAccounts;
  const transactions = useMockMode ? mockTransactions : userRealTransactions;

  const targetAccount = accounts.find((a) => a.id === params.accountId) || accounts[0];
  const finalAmount = params.type === 'EXPENSE' ? -Math.abs(params.amount) : Math.abs(params.amount);
  const txDate = params.date || new Date().toISOString();

  // Atualizar saldo da conta
  targetAccount.current_ledger_balance += finalAmount;

  const newTx: Transaction = {
    id: `man_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    account_id: targetAccount.id,
    status: 'SETTLED',
    source: 'MANUAL',
    amount: finalAmount,
    transaction_date: txDate,
    description: params.description,
    category: params.category,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  transactions.unshift(newTx);
  return newTx;
}

// Registrar Transação Provisória (Push Notification)
export async function saveProvisionalTransaction(
  institutionCode: string,
  amount: number,
  description: string,
  rawText: string
): Promise<Transaction> {
  const accounts = useMockMode ? mockAccounts : userRealAccounts;
  const transactions = useMockMode ? mockTransactions : userRealTransactions;

  let targetAccount = accounts.find((a) =>
    institutionCode === 'NUBANK' ? a.name.toLowerCase().includes('nu') : a.name.toLowerCase().includes('c6')
  ) || accounts[0];

  targetAccount.current_ledger_balance += amount;

  const newTx: Transaction = {
    id: `push_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    account_id: targetAccount.id,
    status: 'PROVISIONAL',
    source: 'PUSH_NOTIFICATION',
    amount,
    transaction_date: new Date().toISOString(),
    description,
    raw_payload: rawText,
    category: detectCategoryFromDescription(description),
  };

  transactions.unshift(newTx);

  // Acúmulo automático de Ativos / Investimentos via Push Notification
  accumulateAssetFromTransaction(newTx, targetAccount.id);

  return newTx;
}

// Aplicar resultado de conciliação OFX
export async function applyReconciliationResult(
  accountId: string,
  newBalance: number,
  updatedTransactions: Transaction[],
  createdTransactions: Transaction[]
): Promise<void> {
  const accounts = useMockMode ? mockAccounts : userRealAccounts;
  const transactions = useMockMode ? mockTransactions : userRealTransactions;

  // Atualizar saldo e data de conciliação
  const targetAcc = accounts.find((a) => a.id === accountId) || accounts[0];
  if (targetAcc) {
    targetAcc.current_ledger_balance = newBalance;
    targetAcc.last_reconciled_at = new Date().toISOString();
  }

  // Atualizar transações que foram casadas (status PROVISIONAL -> RECONCILED)
  for (const updated of updatedTransactions) {
    const idx = transactions.findIndex((t) => t.id === updated.id);
    if (idx !== -1) {
      transactions[idx] = { ...updated };
    }
  }

  // Inserir novas transações liquidadas (SETTLED) e acumular investimentos identificados
  for (const created of createdTransactions) {
    transactions.unshift(created);
    accumulateAssetFromTransaction(created, targetAcc.id);
  }
}

/**
 * Função utilitária que reconhece e acumula aportes em ativos e investimentos
 * a partir de transações geradas por Extratos OFX ou Notificações Push
 */
function accumulateAssetFromTransaction(tx: Transaction, accountId: string) {
  const holdings = useMockMode ? mockHoldings : userRealHoldings;
  const text = `${tx.description} ${tx.raw_payload || ''}`;
  const absAmount = Math.abs(tx.amount);
  if (absAmount <= 0) return;

  // 1. Ticker de FIIs / Ações / ETFs (ex: MXRF11, KNCR11, BRCO11, XINA11, NASD11, BOVA11, ITUB4, PETR4, etc.)
  const tickerMatch = text.match(/\b([A-Z]{4}(?:11|3|4|5|6))\b/i);
  if (tickerMatch) {
    const ticker = tickerMatch[1].toUpperCase();
    const existingHolding = holdings.find((h) => h.ticker === ticker);

    // Preço de cotação padrão / estimativa
    const defaultPrice = existingHolding
      ? (existingHolding.current_price || existingHolding.average_price)
      : (ticker === 'MXRF11' ? 9.45 : ticker === 'KNCR11' ? 105.45 : ticker === 'BRCO11' ? 112.19 : ticker === 'XINA11' ? 6.82 : ticker === 'NASD11' ? 21.46 : 10.00);

    const estimatedQty = Math.max(1, Math.round(absAmount / defaultPrice));

    if (existingHolding) {
      const oldQty = existingHolding.quantity;
      const oldCost = oldQty * existingHolding.average_price;
      const newQty = oldQty + estimatedQty;
      existingHolding.quantity = newQty;
      // Recalcular preço médio ponderado
      existingHolding.average_price = (oldCost + absAmount) / newQty;
    } else {
      const assetClass: AssetClass = ticker.endsWith('11') ? 'FII' : 'STOCK';
      holdings.push({
        id: `hld_${ticker}_${Date.now()}`,
        account_id: accountId,
        asset_id: `ast_${ticker.toLowerCase()}`,
        ticker: ticker,
        name: `${ticker} Ativo B3`,
        quantity: estimatedQty,
        average_price: defaultPrice,
        current_price: defaultPrice,
        asset_class: assetClass,
      });
    }
    return;
  }

  // 2. CDB / Renda Fixa / Caixinha
  const isCdb = /CDB|RDB|Caixinha|Liquidez Di[aá]ria|Renda Fixa/i.test(text);
  if (isCdb) {
    const isC6 = text.toLowerCase().includes('c6');
    const targetTicker = isC6 ? 'CDB-C6' : 'CDB-LIQ';
    const cdbHolding = holdings.find((h) => h.ticker === targetTicker || h.ticker === 'CDB-C6');

    if (cdbHolding) {
      cdbHolding.quantity += absAmount;
      if (cdbHolding.fixed_income_details) {
        cdbHolding.fixed_income_details.initial_amount += absAmount;
      }
    } else {
      holdings.push({
        id: `hld_cdb_${Date.now()}`,
        account_id: accountId,
        asset_id: `ast_${targetTicker.toLowerCase()}`,
        ticker: targetTicker,
        name: isC6 ? 'CDB C6 Pós-Fixado Liquidez Diária' : 'CDB Liquidez Diária',
        quantity: absAmount,
        average_price: 1.0,
        current_price: 1.0,
        asset_class: 'CDB',
        fixed_income_details: {
          benchmark: 'CDI',
          rate_percentage: 102,
          initial_date: new Date().toISOString().split('T')[0],
          initial_amount: absAmount,
        },
      });
    }
  }
}

// Controle de Faturas, Mensalidades, Assinaturas, Salários e Despesas Periódicas
export async function getRecurringBills(): Promise<RecurringBill[]> {
  return useMockMode ? [...mockBills] : [...userRealBills];
}

export async function addRecurringBill(bill: Omit<RecurringBill, 'id'>): Promise<RecurringBill> {
  const bills = useMockMode ? mockBills : userRealBills;
  const newBill: RecurringBill = {
    id: `bill_${Date.now()}`,
    ...bill,
    created_at: new Date().toISOString(),
  };
  bills.push(newBill);
  if (!useMockMode) saveToStorage('userRealBills', userRealBills);
  return newBill;
}

export async function updateRecurringBill(id: string, updates: Partial<Omit<RecurringBill, 'id'>>): Promise<RecurringBill | null> {
  const bills = useMockMode ? mockBills : userRealBills;
  const target = bills.find((b) => b.id === id);
  if (target) {
    Object.assign(target, updates);
    if (!useMockMode) saveToStorage('userRealBills', userRealBills);
    return target;
  }
  return null;
}

export async function toggleRecurringBill(id: string): Promise<void> {
  const bills = useMockMode ? mockBills : userRealBills;
  const target = bills.find((b) => b.id === id);
  if (target) {
    target.is_active = !target.is_active;
    if (!useMockMode) saveToStorage('userRealBills', userRealBills);
  }
}

export async function deleteRecurringBill(id: string): Promise<void> {
  const bills = useMockMode ? mockBills : userRealBills;
  const idx = bills.findIndex((b) => b.id === id);
  if (idx !== -1) {
    bills.splice(idx, 1);
    if (!useMockMode) saveToStorage('userRealBills', userRealBills);
  }
}

// Controle de Planos e Metas Financeiras (Check Goals)
export async function getFinancialPlans(): Promise<FinancialPlan[]> {
  return useMockMode ? [...mockPlans] : [...userRealPlans];
}

export async function addFinancialPlan(plan: Omit<FinancialPlan, 'id' | 'created_at'>): Promise<FinancialPlan> {
  const plans = useMockMode ? mockPlans : userRealPlans;
  const newPlan: FinancialPlan = {
    id: `plan_${Date.now()}`,
    ...plan,
    created_at: new Date().toISOString(),
  };
  plans.push(newPlan);
  if (!useMockMode) saveToStorage('userRealPlans', userRealPlans);
  return newPlan;
}

export async function updateFinancialPlan(id: string, updates: Partial<Omit<FinancialPlan, 'id'>>): Promise<FinancialPlan | null> {
  const plans = useMockMode ? mockPlans : userRealPlans;
  const target = plans.find((p) => p.id === id);
  if (target) {
    Object.assign(target, updates);
    if (!useMockMode) saveToStorage('userRealPlans', userRealPlans);
    return target;
  }
  return null;
}

export async function deleteFinancialPlan(id: string): Promise<void> {
  const plans = useMockMode ? mockPlans : userRealPlans;
  const idx = plans.findIndex((p) => p.id === id);
  if (idx !== -1) {
    plans.splice(idx, 1);
    if (!useMockMode) saveToStorage('userRealPlans', userRealPlans);
  }
}

export async function togglePlanCheckpoint(planId: string, checkpointId: string): Promise<void> {
  const plans = useMockMode ? mockPlans : userRealPlans;
  const plan = plans.find((p) => p.id === planId);
  if (plan && plan.checkpoints) {
    const cp = plan.checkpoints.find((c) => c.id === checkpointId);
    if (cp) {
      cp.completed = !cp.completed;
      // Se concluiu checkpoint e tiver targetAmount maior que savedAmount, atualiza savedAmount proporcionalmente
      const completedCps = plan.checkpoints.filter((c) => c.completed);
      if (completedCps.length > 0) {
        const highestTarget = Math.max(...completedCps.map((c) => c.targetAmount));
        if (highestTarget > plan.savedAmount) {
          plan.savedAmount = highestTarget;
        }
      }
      if (!useMockMode) saveToStorage('userRealPlans', userRealPlans);
    }
  }
}

// Categorias Padrão estilo Nubank
export const EXPENSE_CATEGORIES = [
  'Compras',
  'Restaurante / Alimentação',
  'Streaming',
  'App de Música',
  'Plano de Aplicativo / Software',
  'Transporte / Viagem',
  'Supermercado',
  'Saúde / Farmácia',
  'Educação',
  'Serviços / Tributos',
  'Moradia',
  'Outros',
] as const;

// Utilitário para detecção inteligente de categoria no padrão Nubank
export function detectCategoryFromDescription(desc: string): string {
  const lower = desc.toLowerCase();
  // App de Música
  if (lower.includes('spotify') || lower.includes('deezer') || lower.includes('apple music') || lower.includes('tidal') || lower.includes('amazon music')) {
    return 'App de Música';
  }
  // Streaming de Vídeo
  if (lower.includes('netflix') || lower.includes('prime video') || lower.includes('disney') || lower.includes('hbo') || lower.includes('max') || lower.includes('youtube') || lower.includes('globoplay')) {
    return 'Streaming';
  }
  // Plano de Aplicativo / Software / Cloud
  if (lower.includes('chatgpt') || lower.includes('openai') || lower.includes('google storage') || lower.includes('icloud') || lower.includes('github') || lower.includes('adobe') || lower.includes('notion') || lower.includes('microsoft')) {
    return 'Plano de Aplicativo / Software';
  }
  // Viagem & Hospedagem
  if (lower.includes('airbnb') || lower.includes('booking') || lower.includes('hotel') || lower.includes('latam') || lower.includes('gol') || lower.includes('azul') || lower.includes('decolar') || lower.includes('viagem')) {
    return 'Transporte / Viagem';
  }
  // Restaurante / Delivery
  if (lower.includes('ifood') || lower.includes('restaurante') || lower.includes('burger') || lower.includes('pizza') || lower.includes('padaria') || lower.includes('bar') || lower.includes('lanchonete') || lower.includes('mcdonald') || lower.includes('café')) {
    return 'Restaurante / Alimentação';
  }
  // Supermercado
  if (lower.includes('supermercado') || lower.includes('carrefour') || lower.includes('pao de acucar') || lower.includes('atacadao') || lower.includes('assai') || lower.includes('mercado livre') || lower.includes('mercadolivre') || lower.includes('amazon') || lower.includes('shopee') || lower.includes('magalu')) {
    return 'Compras';
  }
  // Transporte
  if (lower.includes('uber') || lower.includes('99app') || lower.includes('gasolina') || lower.includes('posto') || lower.includes('ipiranga') || lower.includes('shell')) {
    return 'Transporte / Viagem';
  }
  // Saúde
  if (lower.includes('farmacia') || lower.includes('droga') || lower.includes('panvel') || lower.includes('raia') || lower.includes('drogasil') || lower.includes('consulta') || lower.includes('hospital')) {
    return 'Saúde / Farmácia';
  }
  // Moradia / Contas
  if (lower.includes('aluguel') || lower.includes('condominio') || lower.includes('luz') || lower.includes('energia') || lower.includes('internet') || lower.includes('vivo') || lower.includes('claro') || lower.includes('tim')) {
    return 'Moradia';
  }
  // Tributos / Guias
  if (lower.includes('das') || lower.includes('receita') || lower.includes('imposto') || lower.includes('taxa') || lower.includes('simples')) {
    return 'Serviços / Tributos';
  }
  if (lower.includes('fatura') || lower.includes('cartao')) return 'Fatura / Cartão';
  return 'Compras';
}

// Adicionar ou Acumular qualquer Ativo / Investimento (Ações, FIIs, ETFs, CDBs, etc.)
export async function addOrAccumulateHolding(params: {
  accountId: string;
  ticker: string;
  name: string;
  assetClass: AssetClass;
  quantityDelta: number; // Quantidade de cotas ou valor adicional para acumular
  price: number; // Preço da cota ou cotação (1.0 para CDB)
  isNewTotal?: boolean; // Se true, sobrescreve o saldo/cotas ao invés de somar
  accumulatedProfit?: number; // Para CDB/Renda Fixa: lucro acumulado para bater valor líquido
  fixedIncomeRate?: number; // Ex: 102 (% CDI)
  fixedIncomeBenchmark?: 'CDI' | 'IPCA' | 'PRE';
}): Promise<Holding> {
  const holdings = useMockMode ? mockHoldings : userRealHoldings;
  const upperTicker = params.ticker.toUpperCase().trim();
  const existingIdx = holdings.findIndex((h) => h.ticker === upperTicker);
  const existing = existingIdx !== -1 ? holdings[existingIdx] : null;

  if (existing) {
    if (params.isNewTotal) {
      existing.quantity = params.quantityDelta;
      existing.current_price = params.price;
      if (params.assetClass === 'CDB' || params.assetClass === 'RDB' || params.assetClass === 'FIXED_INCOME') {
        const profit = params.accumulatedProfit || 0;
        existing.fixed_income_details = {
          benchmark: params.fixedIncomeBenchmark || existing.fixed_income_details?.benchmark || 'CDI',
          rate_percentage: params.fixedIncomeRate || existing.fixed_income_details?.rate_percentage || 102,
          initial_date: existing.fixed_income_details?.initial_date || new Date().toISOString().split('T')[0],
          initial_amount: Math.max(0, params.quantityDelta - profit),
        };
      }
    } else {
      // Acumula novas cotas ou valor
      const oldQty = existing.quantity;
      const oldCost = oldQty * existing.average_price;
      const newQty = oldQty + params.quantityDelta;
      existing.quantity = newQty;
      existing.current_price = params.price;
      // Recalcular preço médio ponderado
      if (newQty > 0) {
        existing.average_price = (oldCost + (params.quantityDelta * params.price)) / newQty;
      }
      if (existing.fixed_income_details) {
        existing.fixed_income_details.initial_amount += (params.quantityDelta * params.price);
      }
    }
    existing.updated_at = new Date().toISOString();
    return existing;
  }

  // Novo ativo na carteira
  const newHolding: Holding = {
    id: `hld_${upperTicker}_${Date.now()}`,
    account_id: params.accountId,
    asset_id: `ast_${upperTicker.toLowerCase()}`,
    ticker: upperTicker,
    name: params.name.trim() || upperTicker,
    quantity: params.quantityDelta,
    average_price: params.price,
    current_price: params.price,
    asset_class: params.assetClass,
    updated_at: new Date().toISOString(),
  };

  if (params.assetClass === 'CDB' || params.assetClass === 'RDB' || params.assetClass === 'FIXED_INCOME') {
    const profit = params.accumulatedProfit || 0;
    newHolding.fixed_income_details = {
      benchmark: params.fixedIncomeBenchmark || 'CDI',
      rate_percentage: params.fixedIncomeRate || 102,
      initial_date: new Date().toISOString().split('T')[0],
      initial_amount: Math.max(0, params.quantityDelta - profit),
    };
  }

  holdings.push(newHolding);
  return newHolding;
}

// Cadastrar ou Atualizar CDB / Renda Fixa Manual com Acúmulo ou Saldo Real
export async function addManualFixedIncome(params: {
  accountId: string;
  name: string;
  ticker: string;
  initialAmount: number;
  initialDate: string;
  benchmark: 'CDI' | 'IPCA' | 'PRE';
  ratePercentage: number;
  totalGrossAmount?: number; // Saldo total acumulado informado pelo usuário (ex: 2965.49)
  accumulatedProfit?: number; // Lucro líquido/bruto acumulado informado (ex: 49.49)
  mode?: 'ACCUMULATE' | 'OVERWRITE';
}): Promise<Holding> {
  return addOrAccumulateHolding({
    accountId: params.accountId,
    ticker: params.ticker,
    name: params.name,
    assetClass: 'CDB',
    quantityDelta: params.totalGrossAmount !== undefined ? params.totalGrossAmount : params.initialAmount,
    price: 1.0,
    isNewTotal: params.totalGrossAmount !== undefined || params.mode === 'OVERWRITE',
    accumulatedProfit: params.accumulatedProfit,
    fixedIncomeRate: params.ratePercentage,
    fixedIncomeBenchmark: params.benchmark,
  });
}
