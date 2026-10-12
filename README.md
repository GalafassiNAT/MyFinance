# 📱 MyFinance — Gestão Financeira Pessoal Inteligente

Um aplicativo moderno e minimalista de finanças pessoais desenvolvido com **React Native**, **Expo SDK 54**, **SQLite** local e integração com **Google Gemini IA**.

Projetado com estética Dark Mode de alta precisão, motor de conciliação bancária automática (OFX + Push Notifications), acompanhamento de investimentos na B3 e metas sustentáveis.

---

## ✨ Principais Funcionalidades

- 📊 **Patrimônio Consolidado & Alocação de Ativos:**
  - Gráfico de rosca dinâmico com proporções e rentabilidade em tempo real.
  - Separação entre Caixa/Liquidez, Renda Fixa (CDBs/Tesouro) e Renda Variável (FIIs e ETFs na B3).
- 🧭 **Mercado & Oportunidades:**
  - Diagnóstico automatizado de carteira (Caixa vs. Renda Fixa vs. Bolsa).
  - Sugestões inteligentes de ativos de alta qualidade (CDI vs. IPCA+).
- 🔄 **Extrato & Conciliação Bancária Dupla:**
  - Importação e parsing de extratos bancários em formato `.ofx` (C6 Bank, Nubank e outros).
  - Parser inteligente com regex para notificações push de compras, transferências e aportes.
  - Idempotência e reconciliação automática de lançamentos provisórios para liquidados.
- 📅 **Compromissos Recorrentes & Previsão Mensal:**
  - Controle de faturas de cartão com detalhamento de itens.
  - Gestão de assinaturas, despesas fixas e salários com cálculo do Saldo Livre Estimado.
- 🎯 **Planos & Metas (Check Goals):**
  - Objetivos com checkpoints automáticos (25%, 50%, 75%, 100%).
  - Cálculo de meses estimados com base no aporte mensal sustentável.
- 🤖 **Agente Financeiro IA (Google Gemini):**
  - Chat consultivo inteligente contextualizado com seus dados e investimentos.
  - Chips dinâmicos com sugestões contextuais e criação interativa de planos financeiros.
- 🎨 **Interface Vectorcraft Dark Mode:**
  - Barra de navegação inferior fluida com pílula expansível e física de mola (`Animated.spring`).
  - Suporte completo a dados de demonstração (`MOCK`) e dados persistidos (`REAL`).

---

## 🛠️ Tecnologias Utilizadas

- **React Native** & **Expo SDK 54**
- **TypeScript**
- **Expo SQLite** (Armazenamento local seguro e offline-first)
- **Lucide React Native** (Ícones vetoriais modernos)
- **React Native SVG** (Visualizações e gráficos)
- **Google Generative AI SDK** (Modelos Gemini)
- **Jest & ts-jest** (Testes unitários automatizados)

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js (v18+)
- npm ou bun

### 1. Clonar o repositório
```bash
git clone git@github.com:GalafassiNAT/MyFinance.git
cd MyFinance
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Executar o servidor de desenvolvimento
```bash
# Iniciar no navegador (Web)
npm run web

# Ou iniciar para Android / iOS via Expo Go
npm start
```

### 4. Executar os Testes Unitários
```bash
npm test
```

### 5. Checagem de Tipos
```bash
npm run typecheck
```

---

## 🔒 Segurança e Privacidade

- **Chave de API do Gemini:** A chave é armazenada exclusivamente de forma local no seu dispositivo via banco SQLite e nunca é compartilhada ou commitada.
- **Armazenamento Local:** Todos os dados financeiros, extratos e transações permanecem offline no seu aparelho.

---

## 📄 Licença

Este projeto está sob a licença MIT. Sinta-se livre para usar e contribuir!
