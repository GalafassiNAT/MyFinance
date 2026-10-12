export type InstitutionCode = 'NUBANK' | 'C6_BANK' | 'OTHER';
export type AccountType = 'CHECKING' | 'SAVINGS_TURBO' | 'CDB_LIQUIDITY' | 'BROKERAGE';
export type TransactionStatus = 'PROVISIONAL' | 'RECONCILED' | 'SETTLED';
export type TransactionSource = 'PUSH_NOTIFICATION' | 'OFX_IMPORT' | 'MANUAL';
export type AssetClass = 'FII' | 'STOCK' | 'ETF' | 'FIXED_INCOME' | 'TREASURY' | 'CDB' | 'RDB';

export interface Institution {
  id: string;
  code: InstitutionCode;
  name: string;
  created_at?: string;
}

export interface Account {
  id: string;
  institution_id: string;
  name: string;
  type: AccountType;
  currency: string;
  current_ledger_balance: number;
  last_reconciled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  status: TransactionStatus;
  source: TransactionSource;
  amount: number; // Negativo para despesa, positivo para receita
  transaction_date: string;
  description: string;
  fitid?: string | null;
  category?: string | null;
  raw_payload?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_class: AssetClass;
  created_at?: string;
}

export interface FixedIncomeDetails {
  benchmark: 'CDI' | 'IPCA' | 'PRE';
  rate_percentage: number; // ex: 100 (% do CDI) ou 12.5 (% ao ano)
  initial_date: string;
  initial_amount: number;
  maturity_date?: string;
}

export interface Holding {
  id: string;
  account_id: string;
  asset_id: string;
  quantity: number;
  average_price: number;
  updated_at?: string;
  ticker?: string;
  name?: string;
  current_price?: number;
  asset_class?: AssetClass;
  fixed_income_details?: FixedIncomeDetails;
}

export type BillType = 'SUBSCRIPTION' | 'INVOICE' | 'MONTHLY_BILL' | 'INCOME_SALARY' | 'PERIODIC_EXPENSE';

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  category?: string;
  date?: string;
}

export interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  due_day: number; // dia do mês de 1 a 31
  type: BillType;
  category: string;
  auto_detect_keyword?: string; // ex: 'netflix', 'spotify', 'aluguel', 'condominio', 'fatura', 'salario', 'das'
  is_active: boolean;
  created_at?: string;
  items?: InvoiceItem[]; // Lista detalhada de itens que compõem a fatura ou assinatura
}

export interface CheckGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  completed: boolean;
}

export interface FinancialPlan {
  id: string;
  title: string; // ex: 'Aquisição RTX 5070 Ti'
  targetAmount: number; // ex: 8000.00
  savedAmount: number; // ex: 2500.00
  monthlyContribution: number; // ex: 2000.00
  estimatedMonths: number; // ex: 4
  strategy: 'SAVINGS' | 'INSTALLMENTS' | 'HYBRID';
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';
  created_at: string;
  notes?: string;
  checkpoints?: CheckGoal[];
}

export interface PortfolioSummary {
  total_cash: number;
  total_equity: number;
  net_worth: number;
  accounts: Account[];
  holdings: Holding[];
  recurringBills?: RecurringBill[];
  plans?: FinancialPlan[];
}
