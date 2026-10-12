import { parsePushNotification, parseBrlAmount } from '../src/services/notifications/parser';
import { parseOfxContent } from '../src/services/reconciliation/ofxParser';
import { reconcileStatement } from '../src/services/reconciliation/reconciliationEngine';
import { Account, Transaction } from '../src/types/models';

describe('Notification Parser', () => {
  test('Nubank: Gasto no débito', () => {
    const text = 'Você gastou R$ 42,90 no débito em Mercado Livre';
    const result = parsePushNotification('com.nu.production', text);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(-42.9);
    expect(result?.description).toBe('Mercado Livre');
    expect(result?.institution_code).toBe('NUBANK');
  });

  test('Nubank: Transferência enviada', () => {
    const text = 'Transferência de R$ 150,00 enviada para João Silva';
    const result = parsePushNotification('com.nu.production', text);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(-150.0);
    expect(result?.description).toContain('João Silva');
    expect(result?.institution_code).toBe('NUBANK');
  });

  test('Nubank: Aplicação em MXRF11 / Investimento', () => {
    const text = 'Aplicação realizada: R$ 94,50 em MXRF11';
    const result = parsePushNotification('com.nu.production', text);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(-94.5);
    expect(result?.description).toContain('MXRF11');
    expect(result?.institution_code).toBe('NUBANK');
  });

  test('C6 Bank: Pix recebido', () => {
    const text = 'Pix recebido: R$ 500,00 de Empresa XYZ';
    const result = parsePushNotification('com.c6bank.app', text);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(500.0);
    expect(result?.description).toContain('Empresa XYZ');
    expect(result?.institution_code).toBe('C6_BANK');
  });

  test('C6 Bank: Aplicação em CDB C6', () => {
    const text = 'Aplicação realizada: R$ 500,00 em CDB C6 Pós-Fixado';
    const result = parsePushNotification('com.c6bank.app', text);
    expect(result).not.toBeNull();
    expect(result?.amount).toBe(-500.0);
    expect(result?.description).toContain('CDB C6');
    expect(result?.institution_code).toBe('C6_BANK');
  });
});

describe('OFX Parser & Reconciliation Engine', () => {
  const sampleOfx = `
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <LEDGERBAL>
          <BALAMT>2962.30</BALAMT>
          <DTASOF>20261009120000</DTASOF>
        </LEDGERBAL>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261009143200</DTPOSTED>
            <TRNAMT>-42.90</TRNAMT>
            <FITID>NU-20261009-98741</FITID>
            <MEMO>Mercado Livre</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261009150000</DTPOSTED>
            <TRNAMT>-12.50</TRNAMT>
            <FITID>NU-20261009-98742</FITID>
            <MEMO>Tarifa Bancaria</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

  test('OFX Parser extrai saldo e transações corretamente', () => {
    const parsed = parseOfxContent(sampleOfx);
    expect(parsed.balanceAmount).toBe(2962.3);
    expect(parsed.transactions.length).toBe(2);
    expect(parsed.transactions[0].fitid).toBe('NU-20261009-98741');
    expect(parsed.transactions[0].amount).toBe(-42.9);
  });

  test('Motor de Conciliação casa PROVISIONAL e cria SETTLED para novidades', () => {
    const account: Account = {
      id: 'acc-1',
      institution_id: 'inst-1',
      name: 'Conta Nu',
      type: 'CHECKING',
      currency: 'BRL',
      current_ledger_balance: 3000.0,
    };

    // Transação previamente capturada via push
    const existingTransactions: Transaction[] = [
      {
        id: 'tx-1',
        account_id: 'acc-1',
        status: 'PROVISIONAL',
        source: 'PUSH_NOTIFICATION',
        amount: -42.9,
        transaction_date: '2026-10-09T14:30:00.000Z',
        description: 'Mercado Livre',
        fitid: null,
      },
    ];

    const statement = parseOfxContent(sampleOfx);
    const result = reconcileStatement(account, existingTransactions, statement);

    // Deve reconciliar a de 42.90
    expect(result.reconciledCount).toBe(1);
    expect(result.updatedTransactions[0].status).toBe('RECONCILED');
    expect(result.updatedTransactions[0].fitid).toBe('NU-20261009-98741');

    // Deve assentar a tarifa não notificada de 12.50
    expect(result.settledCount).toBe(1);
    expect(result.createdTransactions[0].status).toBe('SETTLED');
    expect(result.createdTransactions[0].fitid).toBe('NU-20261009-98742');

    // Saldo final alinhado com o LEDGERBAL
    expect(result.newBalance).toBe(2962.3);
  });
});
