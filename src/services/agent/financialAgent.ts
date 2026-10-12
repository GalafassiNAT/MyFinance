import { getPortfolioSummary, getRecentTransactions, getSetting } from '../../database/db';
import { Account, Holding, Transaction } from '../../types/models';
import { buildKnowledgeChunks, queryVectorKnowledge } from '../rag/vectorStore';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Recomendado - Mais Inteligente)', badge: 'Novo' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Estável e Rápido)', badge: 'Estável' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Super Rápido / Econômico)', badge: 'Estável' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (Alta Eficiência)', badge: 'Estável' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (Raciocínio Avançado)', badge: 'Preview' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview', badge: 'Preview' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'Legado' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', badge: 'Legado' },
];

export const INITIAL_SUGGESTIONS = [
  'Como está a distribuição da minha carteira?',
  'O que compõe a fatura do meu cartão?',
  'Quanto rendeu meu CDB do C6?',
  'Minhas receitas cobrem minhas despesas fixas?',
  'Quais ativos você recomenda para balancear?',
];

/**
 * Gera 3 a 4 perguntas de follow-up inteligentes e contextuais
 * baseadas no que o usuário acabou de perguntar e no que a IA respondeu.
 */
export function getContextualSuggestions(lastUserPrompt: string, botResponse?: string): string[] {
  const p = lastUserPrompt.toLowerCase();
  const resp = (botResponse || '').toLowerCase();

  // Intenção de compra / meta / aquisição de bem (ex: RTX 5070 Ti, carro, viagem, computador)
  if (
    p.includes('comprar') ||
    p.includes('compra') ||
    p.includes('aquisição') ||
    p.includes('aquisicao') ||
    p.includes('planejamento') ||
    p.includes('juntar') ||
    p.includes('rtx') ||
    p.includes('meta')
  ) {
    return [
      'Em quantos meses consigo juntar economizando o saldo livre?',
      'Vale a pena resgatar parte do CDB C6 para pagar à vista?',
      'Se eu parcelar em 12x no cartão, compromete meu orçamento?',
      'Qual percentual do meu patrimônio essa compra representa?',
    ];
  }

  // Renda Fixa / CDB / Rendimento
  if (p.includes('cdb') || p.includes('rendeu') || p.includes('rendimento') || p.includes('c6')) {
    return [
      'Qual o impacto se eu aportar mais R$ 500 no CDB?',
      'Vale mais a pena manter no CDB C6 ou ir para Tesouro Selic?',
      'Como meus FIIs performaram comparado ao CDB?',
      'Qual é o imposto de renda retido no resgate do CDB?',
    ];
  }

  // Fatura / Cartão de Crédito
  if (p.includes('fatura') || p.includes('cartão') || p.includes('cartao') || p.includes('parcela')) {
    return [
      'Quantas parcelas faltam no Mercado Livre e Amazon?',
      'Qual categoria mais pesou na fatura esse mês?',
      'Minhas receitas cobrem minhas faturas e despesas fixas?',
      'Como posso reduzir os gastos parcelados?',
    ];
  }

  // Se a resposta da IA mencionou opções ou estratégias
  if (resp.includes('parcelar') || resp.includes('à vista') || resp.includes('a vista') || resp.includes('resgate')) {
    return [
      'Simule o parcelamento em 10x ou 12x no meu fluxo mensal',
      'Quanto sobra por mês se eu guardar R$ 800 para essa meta?',
      'Compensa mais esperar a Black Friday / promoção?',
      'Qual o impacto na minha reserva de emergência?',
    ];
  }

  // Alocação / Distribuição de Carteira
  if (p.includes('distribuição') || p.includes('distribuicao') || p.includes('carteira') || p.includes('alocação') || p.includes('patrimônio') || p.includes('patrimonio')) {
    return [
      'Qual percentual da minha carteira está em Renda Fixa vs FIIs?',
      'Quanto recebo por mês em dividendos dos meus FIIs?',
      'Quais ativos você recomenda para balancear?',
      'Quanto sobrou no meu saldo livre estimado?',
    ];
  }

  // Receitas / Salário / Despesas Fixas
  if (p.includes('receita') || p.includes('despesa') || p.includes('cobrem') || p.includes('fixa') || p.includes('salário') || p.includes('salario')) {
    return [
      'Qual o meu saldo livre estimado para investir este mês?',
      'Quanto gasto com assinaturas e serviços recorrentes?',
      'O que compõe a fatura do meu cartão?',
      'Quanto rendeu meu CDB do C6?',
    ];
  }

  // Recomendações de mercado / ativos
  if (p.includes('recomenda') || p.includes('balancear') || p.includes('ativo') || p.includes('fii')) {
    return [
      'Qual FII da minha carteira paga mais dividendos?',
      'Devo aumentar minha reserva de emergência antes?',
      'Como está a distribuição da minha carteira?',
      'Vale a pena investir em ações de bancos ou energia agora?',
    ];
  }

  // Fallback inteligente
  return [
    'Qual meu saldo livre estimado este mês?',
    'Como está a divisão entre Renda Fixa e Renda Variável?',
    'Quais as maiores despesas parceladas na fatura?',
    'O que você sugere para otimizar meus rendimentos?',
  ];
}

/**
 * Agente Financeiro Pessoal que roda no dispositivo móvel.
 * Utiliza o resumo do SQLite local como contexto fundamentado (Grounding)
 * e consome a API do Google Gemini (ou fallback simulador se nenhuma chave foi informada).
 */
export async function askFinancialAgent(userPrompt: string, history?: ChatMessage[]): Promise<string> {
  const apiKey = await getSetting('GEMINI_API_KEY');
  const portfolio = await getPortfolioSummary();
  const recentTxs = await getRecentTransactions(10);
  const recurringBills = portfolio.recurringBills || [];

  // Indexação Semântica Local e Recuperação Relevante (RAG)
  const allKnowledgeChunks = buildKnowledgeChunks(portfolio, recentTxs, recurringBills);
  const relevantChunks = queryVectorKnowledge(userPrompt, allKnowledgeChunks, 5);

  // Formatar contexto ultra-relevante, preciso e de alta velocidade
  const context = `
CONHECIMENTO FINANCEIRO RECUPERADO VIA RAG (Dados Locais SQLite):
${relevantChunks.map((c, idx) => `[Fato ${idx + 1} - ${c.title}]\n${c.text}`).join('\n\n')}

RESUMO EXECUTIVO DE CAIXA:
- Total em Contas Correntes: R$ ${portfolio.total_cash.toFixed(2)}
- Total em Investimentos: R$ ${portfolio.total_equity.toFixed(2)}
- Patrimônio Líquido Total: R$ ${portfolio.net_worth.toFixed(2)}
`;

  const systemInstruction = `
Você é o Agente de Finanças e Patrimônio Pessoal do MyFinance, atuando como um consultor financeiro sênior, minimalista e focado em preservação patrimonial e crescimento sustentável.

PILAREZ INEGOCIÁVEIS:
1. PRESERVAÇÃO DA SEGURANÇA E RESERVA DE EMERGÊNCIA:
   - NUNCA recomende liquidar ou queimar a totalidade da Reserva de Emergência (Caixinha Nubank / CDB) ou posições de FIIs/Ações para compra de bens de consumo, eletrônicos ou itens depreciáveis (como GPUs, computadores, etc.).
   - A reserva de emergência e os ativos geradores de dividendos são a base da segurança financeira do usuário.

2. ESTRATÉGIA BIFURCADA PARA METAS E COMPRAS (Ex: RTX 5070 Ti, viagens, computadores):
   Apresente sempre 2 cenários responsáveis e um plano de ação:
   - Opção A (Compra à Vista Sustentável): Poupar apenas uma parcela prudente do Saldo Livre Mensal (ex: 50% a 70% do saldo livre, cerca de R$ 2.000 a R$ 2.800/mês), mantendo o restante como margem de segurança e novos aportes. Calcule o prazo realista em meses sem sufocar o orçamento.
   - Opção B (Parcelamento Inteligente & Arbitragem de Juros): Se parcelar sem juros (10x ou 12x), mostre que a parcela consome menos de 20% do saldo livre mensal e recomende manter o valor rendendo em Renda Fixa com liquidez diária (102% CDI) enquanto as faturas vencem.
   - Plano de Ação Recomendado: Indique a melhor decisão prática com passos numerados.

3. INTEGRAÇÃO COM PLANOS E METAS (CHECK GOALS):
   - Quando o usuário expressar interesse em adquirir um bem ou criar uma meta (ex: comprar RTX 5070 Ti, montar reserva, comprar carro), proponha expressamente adicionar a meta na aba de Planos & Metas do app.
   - Forneça uma estimativa clara de meses necessários e checkpoints graduais (ex: 25%, 50%, 75%, 100%).
   - Se o usuário confirmar a criação do plano, inclua no final da mensagem uma tag estruturada em bloco para ativação rápida:
\`\`\`plan_suggestion
{"title": "Nome da Meta", "targetAmount": 8000, "monthlyContribution": 2000, "estimatedMonths": 4, "strategy": "SAVINGS", "notes": "Poupança mensal do saldo livre sem mexer na reserva"}
\`\`\`

4. DADOS DE RENDA FIXA E CONTÁBEIS:
   - Sempre interprete com fidelidade o Aporte Inicial, o Lucro/Rendimento Acumulado (ex: CDB C6 com R$ 49,49 de rendimento e R$ 2.965,49 bruto total) e a taxa contratada (102% CDI).
   - Leve em consideração as despesas fixas recorrentes e salários ao calcular a capacidade de aporte mensal.

5. ESTILO E FORMATAÇÃO MARKDOWN:
   - Vá direto aos números e diagnósticos sem enrolação.
   - Use formatação Markdown:
     - Títulos com '#### ' ou '### '
     - Citações e avisos de segurança com '> '
     - Valores em negrito (**R$ X.XXX,XX**)
     - Marcadores de lista com '• ' ou '- '
     - Linhas divisórias com '---'
   - Conclua sempre a resposta por completo.
`;

  // Se o usuário ainda não colocou uma chave na tela de configurações, fornecemos resposta contextual
  if (!apiKey || apiKey.trim() === '') {
    return (
      `Olá! Estou conectado aos seus dados locais do SQLite.\n\n` +
      `Seu patrimônio líquido atual é de R$ ${portfolio.net_worth.toFixed(2)} (R$ ${portfolio.total_cash.toFixed(2)} em contas e R$ ${portfolio.total_equity.toFixed(2)} em investimentos).\n\n` +
      `💡 Para habilitar respostas livres com IA avançada, cole sua chave de API do Gemini no ícone de Chave/Configurações no topo.`
    );
  }

  // Permite modelo customizado configurado nas preferências ou cascata com os modelos atuais (Gemini 3 e 2.5)
  const customModel = await getSetting('GEMINI_CUSTOM_MODEL');
  const candidateModels = [
    ...(customModel && customModel.trim() ? [customModel.trim()] : []),
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
  ];

  let lastError = '';

  // Monta histórico de mensagens anteriores para manter o contexto do diálogo
  const contentsPayload: { role: string; parts: { text: string }[] }[] = [];

  if (history && history.length > 0) {
    // Pega as últimas 6 mensagens excluindo boas-vindas
    const validHistory = history.filter(h => h.id !== 'welcome').slice(-6);
    for (const h of validHistory) {
      contentsPayload.push({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      });
    }
  }

  // Adiciona a pergunta atual caso não esteja no histórico
  if (contentsPayload.length === 0 || contentsPayload[contentsPayload.length - 1].parts[0].text !== userPrompt) {
    contentsPayload.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });
  }

  for (const model of candidateModels) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [
                {
                  text: `${systemInstruction}\n\n${context}`,
                },
              ],
            },
            contents: contentsPayload,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts;
        if (parts && parts.length > 0) {
          const fullText = parts.map((p: any) => p.text || '').join('');
          if (fullText.trim()) return fullText;
        }
      } else {
        const err = await response.text();
        lastError = `Modelo ${model} retornou ${response.status}: ${err.substring(0, 150)}`;
        // Se foi 404, continua para o próximo modelo na cascata
        if (response.status === 404) {
          continue;
        } else {
          return `Erro na API (${response.status}): ${err.substring(0, 200)}`;
        }
      }
    } catch (error: any) {
      lastError = `Erro na requisição para ${model}: ${error?.message || error}`;
    }
  }

  return `Não foi possível obter resposta da IA. Último erro: ${lastError}`;
}
