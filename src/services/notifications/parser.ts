export interface ParsedPush {
  amount: number; // Negativo para saída, positivo para entrada
  description: string;
  institution_code: 'NUBANK' | 'C6_BANK';
}

/**
 * Normaliza valores monetários brasileiros (ex: "42,90" ou "1.250,50") para number
 */
export function parseBrlAmount(amountStr: string): number {
  const clean = amountStr.replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(clean);
}

/**
 * Analisa título e corpo da notificação de acordo com as regras da Seção 3.2
 */
export function parsePushNotification(sourceApp: string, text: string): ParsedPush | null {
  if (!text) return null;

  // Nubank: com.nu.production
  if (sourceApp.includes('nu') || sourceApp.includes('nubank')) {
    // 1. Compra no débito / gasto: "(?:gastou|Compra de) R$ X no débito em Y"
    const debitMatch = text.match(/(?:gastou|Compra de)\s*R\$\s*([0-9.,]+)\s*(?:no débito|no cartão)?\s*em\s*(.+)/i);
    if (debitMatch) {
      return {
        amount: -Math.abs(parseBrlAmount(debitMatch[1])),
        description: debitMatch[2].trim(),
        institution_code: 'NUBANK',
      };
    }

    // 2. Transferência enviada: "Transferência de R$ X enviada para Y"
    const transferSentMatch = text.match(/Transferência de\s*R\$\s*([0-9.,]+)\s*enviada para\s*(.+)/i);
    if (transferSentMatch) {
      return {
        amount: -Math.abs(parseBrlAmount(transferSentMatch[1])),
        description: `Pix enviado: ${transferSentMatch[2].trim()}`,
        institution_code: 'NUBANK',
      };
    }

    // 3. Transferência recebida: "Você recebeu uma transferência de R$ X de Y"
    const transferReceivedMatch = text.match(/Você recebeu uma transferência de\s*R\$\s*([0-9.,]+)\s*de\s*(.+)/i);
    if (transferReceivedMatch) {
      return {
        amount: Math.abs(parseBrlAmount(transferReceivedMatch[1])),
        description: `Pix recebido: ${transferReceivedMatch[2].trim()}`,
        institution_code: 'NUBANK',
      };
    }
    // 4. Aplicação em Investimento / CDB / Caixinha / Ações / FIIs: "Aplicação realizada: R$ X em Y" ou "Você guardou R$ X no RDB/Caixinha"
    const investNuMatch = text.match(/(?:Aplicação realizada|Você investiu|Você guardou|Aplicação de)[:\s]*R\$\s*([0-9.,]+)\s*(?:em|no|na)?\s*(.+)/i);
    if (investNuMatch) {
      return {
        amount: -Math.abs(parseBrlAmount(investNuMatch[1])),
        description: `Aplicação: ${investNuMatch[2].trim()}`,
        institution_code: 'NUBANK',
      };
    }
  }

  // C6 Bank: com.c6bank.app
  if (sourceApp.includes('c6') || sourceApp.includes('c6bank')) {
    // 1. Pix enviado: "Pix enviado: R$ X para Y"
    const c6PixSent = text.match(/Pix enviado:\s*R\$\s*([0-9.,]+)\s*para\s*(.+)/i);
    if (c6PixSent) {
      return {
        amount: -Math.abs(parseBrlAmount(c6PixSent[1])),
        description: `Pix enviado: ${c6PixSent[2].trim()}`,
        institution_code: 'C6_BANK',
      };
    }

    // 2. Pix recebido: "Pix recebido: R$ X de Y"
    const c6PixReceived = text.match(/Pix recebido:\s*R\$\s*([0-9.,]+)\s*de\s*(.+)/i);
    if (c6PixReceived) {
      return {
        amount: Math.abs(parseBrlAmount(c6PixReceived[1])),
        description: `Pix recebido: ${c6PixReceived[2].trim()}`,
        institution_code: 'C6_BANK',
      };
    }

    // 3. Aplicação / Investimento C6 (CDB / Ações): "Aplicação no CDB de R$ X realizada com sucesso" ou "Você investiu R$ X em CDB"
    const c6InvestMatch = text.match(/(?:Aplicação no|Você investiu|Investimento de)\s*(.+?)\s*(?:de\s*)?R\$\s*([0-9.,]+)/i) ||
      text.match(/(?:Aplicação realizada|Investimento realizado):\s*R\$\s*([0-9.,]+)\s*em\s*(.+)/i);
    if (c6InvestMatch) {
      const isReversed = !c6InvestMatch[2] || isNaN(parseFloat(c6InvestMatch[1].replace(',', '.')));
      const amtStr = isReversed ? c6InvestMatch[2] : c6InvestMatch[1];
      const descStr = isReversed ? c6InvestMatch[1] : c6InvestMatch[2];
      return {
        amount: -Math.abs(parseBrlAmount(amtStr)),
        description: `Aplicação: ${descStr.trim()}`,
        institution_code: 'C6_BANK',
      };
    }
  }

  return null;
}
