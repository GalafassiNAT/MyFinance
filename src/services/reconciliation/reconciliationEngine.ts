import { Transaction, Account } from '../../types/models';
import { OfxStatement, OfxTransaction } from './ofxParser';

export interface ReconciliationResult {
  reconciledCount: number;
  settledCount: number;
  skippedCount: number;
  newBalance: number;
  updatedTransactions: Transaction[];
  createdTransactions: Transaction[];
}

/**
 * Algoritmo estrito de conciliação e deduplicação (Seção 4.2 da especificação)
 */
export function reconcileStatement(
  account: Account,
  existingTransactions: Transaction[],
  statement: OfxStatement
): ReconciliationResult {
  let currentBalance = account.current_ledger_balance;
  let reconciledCount = 0;
  let settledCount = 0;
  let skippedCount = 0;

  const updatedTransactions: Transaction[] = [];
  const createdTransactions: Transaction[] = [];

  // Mapear fitids existentes para deduplicação instantânea
  const existingFitids = new Set<string>();
  for (const t of existingTransactions) {
    if (t.fitid) {
      existingFitids.add(t.fitid);
    }
  }

  // Lista mutável de transações provisórias elegíveis
  const provisionalPool = existingTransactions.filter(
    (t) => t.status === 'PROVISIONAL' && !t.fitid
  );

  for (const stmtTrn of statement.transactions) {
    // Passo 1: Idempotência
    if (existingFitids.has(stmtTrn.fitid)) {
      skippedCount++;
      continue;
    }

    const trnTime = new Date(stmtTrn.date).getTime();
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

    // Passo 2: Busca por Correspondência Provisória (Matching)
    // - status == 'PROVISIONAL'
    // - amount == TRNAMT (centavos exatos)
    // - transaction_date BETWEEN (DTPOSTED - 2 dias) AND (DTPOSTED + 2 dias)
    let bestIndex = -1;
    let minDiff = Infinity;

    for (let i = 0; i < provisionalPool.length; i++) {
      const candidate = provisionalPool[i];
      // Comparação exata de centavos
      if (Math.abs(candidate.amount - stmtTrn.amount) < 0.001) {
        const candTime = new Date(candidate.transaction_date).getTime();
        const diff = Math.abs(candTime - trnTime);
        if (diff <= TWO_DAYS_MS && diff < minDiff) {
          minDiff = diff;
          bestIndex = i;
        }
      }
    }

    // Passo 3: Ramificação
    if (bestIndex !== -1) {
      // SE encontrou transação candidata:
      const matched = provisionalPool.splice(bestIndex, 1)[0];
      matched.status = 'RECONCILED';
      matched.fitid = stmtTrn.fitid;
      matched.description = stmtTrn.memo || matched.description;
      matched.updated_at = new Date().toISOString();

      existingFitids.add(stmtTrn.fitid);
      updatedTransactions.push(matched);
      reconciledCount++;
      // Nota da especificação: O saldo da conta NÃO é alterado aqui pois o push já computou o delta
    } else {
      // SE NÃO encontrou correspondência (tarifas, juros, transferências silenciosas):
      const newTransaction: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        account_id: account.id,
        status: 'SETTLED',
        source: 'OFX_IMPORT',
        amount: stmtTrn.amount,
        transaction_date: stmtTrn.date,
        description: stmtTrn.memo,
        fitid: stmtTrn.fitid,
        category: 'Outros',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      existingFitids.add(stmtTrn.fitid);
      createdTransactions.push(newTransaction);
      settledCount++;
      currentBalance += stmtTrn.amount;
    }
  }

  // Passo 4: Alinhamento de Saldo Oficial (Ledger Balance)
  if (statement.balanceAmount !== undefined) {
    currentBalance = statement.balanceAmount;
  }

  return {
    reconciledCount,
    settledCount,
    skippedCount,
    newBalance: currentBalance,
    updatedTransactions,
    createdTransactions,
  };
}
