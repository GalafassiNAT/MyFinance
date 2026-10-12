# Especificação Técnica de Arquitetura: Sistema de Finanças e Patrimônio Pessoal

Este documento detalha os requisitos, modelo de dados, fluxos de integração e lógica de negócio para a construção de um sistema de finanças pessoais independente. O sistema opera no modelo **Híbrido de Eventos em Tempo Real (Push) + Conciliação Periódica em Lote (OFX) + Precificação de Mercado de Renda Variável (APIs Públicas B3)**.

---

## 1. Visão Geral do Sistema

### 1.1 Objetivo
Permitir a consolidação de contas bancárias (Nubank, C6 Bank) e custódia de investimentos (FIIs e Renda Fixa) com:
1. **Zero dependência de intermediários pagos ou regulados de Open Finance.**
2. **Zero web scraping de aplicativos bancários protegidos.**
3. **Visibilidade instantânea** do fluxo diário via notificações push do smartphone.
4. **Precisão contábil estrita** via conciliação por extratos bancários padronizados (`.ofx`).
5. **Valor patrimonial atualizado** via ingestão de cotações públicas da B3.

### 1.2 Arquitetura Geral

```
 ┌──────────────────────┐
 │ Android (Macro/Task) │──► [POST /api/v1/webhooks/push] ──┐
 └──────────────────────┘                                   │
                                                            ▼
 ┌──────────────────────┐                           ┌──────────────┐
 │ Usuário (Upload OFX) │──► [POST /statements/ofx] ──►│   Backend    │
 └──────────────────────┘                           │  (API REST + │
                                                    │ Reconciliation│
 ┌──────────────────────┐                           │   Engine)    │
 │ Brapi / Yahoo API    │──► [Cron Job / 18:00h] ───►│              │
 └──────────────────────┘                           └──────┬───────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  PostgreSQL  │
                                                    └──────────────┘
```

---

## 2. Modelo Relacional de Dados (PostgreSQL DDL)

```sql
-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2.1 Instituições Financeiras
CREATE TYPE institution_code AS ENUM ('NUBANK', 'C6_BANK', 'OTHER');

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code institution_code UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Contas Financeiras
CREATE TYPE account_type AS ENUM ('CHECKING', 'SAVINGS_TURBO', 'CDB_LIQUIDITY', 'BROKERAGE');

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type account_type NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    current_ledger_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    last_reconciled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 Transações Financeiras e Ciclo de Vida
CREATE TYPE transaction_status AS ENUM (
    'PROVISIONAL', -- Capturada via push notification, aguarda validação
    'RECONCILED',  -- Transação provisória casada com extrato OFX
    'SETTLED'      -- Transação criada diretamente pelo OFX (sem push prévio)
);

CREATE TYPE transaction_source AS ENUM ('PUSH_NOTIFICATION', 'OFX_IMPORT', 'MANUAL');

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    status transaction_status NOT NULL DEFAULT 'PROVISIONAL',
    source transaction_source NOT NULL,
    amount NUMERIC(15, 2) NOT NULL, -- Negativo para despesas, positivo para receitas
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    description VARCHAR(255) NOT NULL,
    fitid VARCHAR(255), -- Código único de identificação bancária do OFX
    category VARCHAR(100),
    raw_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_account_fitid UNIQUE (account_id, fitid)
);

CREATE INDEX idx_transactions_acc_date ON transactions (account_id, transaction_date);
CREATE INDEX idx_transactions_status ON transactions (status);

-- 2.4 Ativos de Investimento (FIIs, Ações, Renda Fixa)
CREATE TYPE asset_class AS ENUM ('FII', 'STOCK', 'ETF', 'FIXED_INCOME');

CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker VARCHAR(20) UNIQUE NOT NULL, -- Ex: MXRF11, KNCR11, BRCO11
    name VARCHAR(150) NOT NULL,
    asset_class asset_class NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5 Posições de Custódia (Holdings)
CREATE TABLE holdings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    quantity NUMERIC(15, 4) NOT NULL DEFAULT 0,
    average_price NUMERIC(15, 4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_account_asset UNIQUE (account_id, asset_id)
);

-- 2.6 Histórico de Preços de Mercado
CREATE TABLE asset_price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    price NUMERIC(15, 4) NOT NULL,
    reference_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_asset_date UNIQUE (asset_id, reference_date)
);

-- 2.7 Snapshots Diários de Patrimônio
CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_date DATE UNIQUE NOT NULL,
    cash_balance NUMERIC(15, 2) NOT NULL,
    investments_market_value NUMERIC(15, 2) NOT NULL,
    total_net_worth NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Motor de Ingestão de Eventos (Push Notifications)

### 3.1 Contrato do Endpoint
* **Endpoint:** `POST /api/v1/webhooks/push`
* **Autenticação:** Header `X-API-Key: <CHAVE_SECRETA_PESSOAL>`
* **Payload JSON:**

```json
{
  "source_app": "com.nu.production",
  "raw_title": "Compra aprovada",
  "raw_text": "Você gastou R$ 42,90 em Mercado Livre",
  "timestamp": "2026-10-09T14:32:00Z"
}
```

### 3.2 Tabela de Expressões Regulares de Parsing

| Instituição | App ID / Origem | Padrão Regex | Extrações | Sinal do Valor |
| :--- | :--- | :--- | :--- | :--- |
| **Nubank** | `com.nu.production` | `(?:gastou|Compra de) R\$\s*([0-9.,]+) no débito em (.*)` | `amount=$1`, `desc=$2` | Negativo ($-$) |
| **Nubank** | `com.nu.production` | `Transferência de R\$\s*([0-9.,]+) enviada para (.*)` | `amount=$1`, `desc=$2` | Negativo ($-$) |
| **Nubank** | `com.nu.production` | `Você recebeu uma transferência de R\$\s*([0-9.,]+) de (.*)` | `amount=$1`, `desc=$2` | Positivo ($+$) |
| **C6 Bank** | `com.c6bank.app` | `Pix enviado: R\$\s*([0-9.,]+) para (.*)` | `amount=$1`, `desc=$2` | Negativo ($-$) |
| **C6 Bank** | `com.c6bank.app` | `Pix recebido: R\$\s*([0-9.,]+) de (.*)` | `amount=$1`, `desc=$2` | Positivo ($+$) |

### 3.3 Regra de Negócio na Recepção do Push
1. Sanitizar valor monetário: converter `"42,90"` para `42.90` (tipo `NUMERIC(15,2)`).
2. Atribuir a transação à conta correspondente da instituição.
3. Gravar na tabela `transactions` com `status = 'PROVISIONAL'` e `fitid = NULL`.
4. Atualizar o saldo operacional da conta:

$$\text{current\_ledger\_balance} = \text{current\_ledger\_balance} + \text{amount}$$

---

## 4. Motor de Conciliação em Lote (Importador de OFX)

### 4.1 Estrutura do Arquivo OFX
O extrato bancário padrão contém blocos de transações e saldo de fechamento:

```xml
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
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
```

### 4.2 Algoritmo de Conciliação e Deduplicação (Passo a Passo)

Para cada registro `<STMTTRN>` lido no arquivo:

```
Passo 1: Checagem de Idempotência
  └─ Se existe transação com (account_id, fitid == STMTTRN.FITID):
       └─ Pular registro (já processado anteriormente).

Passo 2: Busca por Correspondência Provisória (Matching)
  └─ Consultar na tabela transactions onde:
       - account_id == target_account_id
       - status == 'PROVISIONAL'
       - amount == STMTTRN.TRNAMT (comparação exata de centavos)
       - transaction_date BETWEEN (STMTTRN.DTPOSTED - 2 dias) AND (STMTTRN.DTPOSTED + 2 dias)
     ORDER BY ABS(transaction_date - STMTTRN.DTPOSTED) ASC
     LIMIT 1;

Passo 3: Ramificação
  ├─ SE encontrou transação candidata:
  │    └─ UPDATE transactions:
  │         - status = 'RECONCILED'
  │         - fitid = STMTTRN.FITID
  │         - description = STMTTRN.MEMO (normalização)
  │         - updated_at = NOW()
  │    (Nota: O saldo da conta NÃO é alterado, pois o push já havia computado o delta).
  │
  └─ SE NÃO encontrou correspondência (ex: juros de conta, tarifas, transferências silenciosas):
       ├─ INSERT transactions:
       │    - account_id = target_account_id
       │    - status = 'SETTLED'
       │    - source = 'OFX_IMPORT'
       │    - amount = STMTTRN.TRNAMT
       │    - transaction_date = STMTTRN.DTPOSTED
       │    - description = STMTTRN.MEMO
       │    - fitid = STMTTRN.FITID
       └─ UPDATE accounts:
            current_ledger_balance = current_ledger_balance + STMTTRN.TRNAMT

Passo 4: Alinhamento de Saldo Oficial (Ledger Balance)
  └─ Obter o valor <LEDGERBAL>.<BALAMT> do arquivo OFX.
  └─ Gravar accounts.current_ledger_balance = BALAMT.
  └─ Atualizar accounts.last_reconciled_at = NOW().
```

---

## 5. Ingestão de Cotações da B3 (Renda Variável)

### 5.1 Serviço Agendado (Cron Job)
* **Frequência:** Executar de segunda a sexta-feira às 18:30 (pós-fechamento do pregão B3).
* **Fonte Recomendada:** Brapi API (`https://brapi.dev/api/quote/{tickers}`) ou Yahoo Finance (`yfinance`).

### 5.2 Fluxo de Execução
1. Coletar todos os tickers ativos da tabela `assets` que possuam saldo em `holdings` ($quantity > 0$).
2. Realizar chamada HTTP:
   ```http
   GET https://brapi.dev/api/quote/BRCO11,KNCR11,MXRF11?token=SEU_TOKEN
   ```
3. Fazer o upsert dos valores na tabela `asset_price_history`:
   ```sql
   INSERT INTO asset_price_history (asset_id, price, reference_date)
   VALUES ($asset_id, $regularMarketPrice, CURRENT_DATE)
   ON CONFLICT (asset_id, reference_date)
   DO UPDATE SET price = EXCLUDED.price;
   ```

---

## 6. Cálculo do Patrimônio Líquido Consolidado (Net Worth)

O cálculo do patrimônio líquido agregado $P_t$ no dia $t$ é determinado pela fórmula:

$$P_t = \sum_{a \in \text{Accounts}} \text{Saldo}(a) + \sum_{h \in \text{Holdings}} \left( \text{Quantidade}_h \times \text{PreçoAtual}(h.\text{asset}) \right)$$

### 6.1 View SQL de Consolidação em Tempo Real

```sql
CREATE OR REPLACE VIEW view_portfolio_overview AS
WITH cash_balances AS (
    SELECT 
        SUM(current_ledger_balance) AS total_cash
    FROM accounts
),
market_investments AS (
    SELECT 
        COALESCE(SUM(h.quantity * p.price), 0.00) AS total_equity_value
    FROM holdings h
    JOIN (
        -- Pega a cotação mais recente de cada ativo
        SELECT DISTINCT ON (asset_id) asset_id, price
        FROM asset_price_history
        ORDER BY asset_id, reference_date DESC
    ) p ON h.asset_id = p.asset_id
)
SELECT 
    cb.total_cash,
    mi.total_equity_value,
    (cb.total_cash + mi.total_equity_value) AS net_worth,
    NOW() AS calculated_at
FROM cash_balances cb, market_investments mi;
```

---

## 7. Roteiro de Implementação para o Agente Desenvolvedor

O agente deve executar a criação do projeto na seguinte ordem lógica:

1. **Sprint 1 (Banco de Dados e Entidades):**
   * Inicializar banco PostgreSQL e rodar as migrações DDL da Seção 2.
   * Criar seed inicial com as instituições (`NUBANK`, `C6_BANK`) e contas (`Conta Corrente Nu`, `Caixinha Nu Turbo`, `CDB C6 Liquidez`).
   * Cadastrar os ativos iniciais: `BRCO11`, `KNCR11`, `MXRF11`.

2. **Sprint 2 (Ingestão de Push e OFX):**
   * Criar o endpoint `POST /api/v1/webhooks/push` com a tabela de Regex da Seção 3.
   * Criar o endpoint `POST /api/v1/accounts/:id/statements/ofx` utilizando um parser SGML/XML para OFX.
   * Implementar o algoritmo de matching e deduplicação da Seção 4.

3. **Sprint 3 (Custódia e Precificação):**
   * Criar endpoint para registrar ordens de compra de ativos (`POST /api/v1/holdings/transaction`).
   * Configurar cron job para consumir a API da Brapi às 18:30 e persistir os preços.

4. **Sprint 4 (Dashboard e Métricas):**
   * Expor o endpoint `GET /api/v1/portfolio/summary` consumindo a view de consolidação patrimonial.
   * Adicionar métricas de exposição percentual por classe de ativo (Liquidez vs. FII Papel vs. FII Tijolo).