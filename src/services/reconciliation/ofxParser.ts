export interface OfxTransaction {
  fitid: string;
  type: string;
  amount: number;
  date: string; // ISO string
  memo: string;
}

export interface OfxStatement {
  bankOrg?: string;
  bankId?: string;
  acctId?: string;
  balanceAmount?: number;
  balanceDate?: string;
  transactions: OfxTransaction[];
}

/**
 * Converte data no formato OFX (YYYYMMDDHHMMSS ou YYYYMMDD) para ISO
 */
export function parseOfxDate(dateStr: string): string {
  const clean = dateStr.trim();
  if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);
    const hours = clean.length >= 10 ? clean.substring(8, 10) : '12';
    const minutes = clean.length >= 12 ? clean.substring(10, 12) : '00';
    const seconds = clean.length >= 14 ? clean.substring(12, 14) : '00';
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  }
  return new Date().toISOString();
}

/**
 * Parser resiliente para extratos OFX bancários brasileiros
 */
export function parseOfxContent(ofxText: string): OfxStatement {
  const transactions: OfxTransaction[] = [];
  let balanceAmount: number | undefined;
  let balanceDate: string | undefined;

  // Extrair Banco e Conta
  const orgMatch = ofxText.match(/<ORG>([\s\S]*?)(?:<\/ORG>|\r|\n|<)/i);
  const bankOrg = orgMatch ? orgMatch[1].trim() : undefined;

  const bankIdMatch = ofxText.match(/<BANKID>([\s\S]*?)(?:<\/BANKID>|\r|\n|<)/i);
  const bankId = bankIdMatch ? bankIdMatch[1].trim() : undefined;

  const acctIdMatch = ofxText.match(/<ACCTID>([\s\S]*?)(?:<\/ACCTID>|\r|\n|<)/i);
  const acctId = acctIdMatch ? acctIdMatch[1].trim() : undefined;

  // Extrair Ledger Balance
  const balAmtMatch = ofxText.match(/<BALAMT>([\s\S]*?)(?:<\/BALAMT>|\r|\n|<)/i);
  if (balAmtMatch) {
    const rawBal = balAmtMatch[1].trim().replace(',', '.');
    balanceAmount = parseFloat(rawBal);
  }

  const dtAsOfMatch = ofxText.match(/<DTASOF>([\s\S]*?)(?:<\/DTASOF>|\r|\n|<)/i);
  if (dtAsOfMatch) {
    balanceDate = parseOfxDate(dtAsOfMatch[1].trim());
  }

  // Extrair blocos <STMTTRN>
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match: RegExpExecArray | null;

  while ((match = stmtTrnRegex.exec(ofxText)) !== null) {
    const block = match[1];

    const trnTypeMatch = block.match(/<TRNTYPE>([\s\S]*?)(?:<\/TRNTYPE>|\r|\n|<)/i);
    const dtPostedMatch = block.match(/<DTPOSTED>([\s\S]*?)(?:<\/DTPOSTED>|\r|\n|<)/i);
    const trnAmtMatch = block.match(/<TRNAMT>([\s\S]*?)(?:<\/TRNAMT>|\r|\n|<)/i);
    const fitidMatch = block.match(/<FITID>([\s\S]*?)(?:<\/FITID>|\r|\n|<)/i);
    const memoMatch = block.match(/<MEMO>([\s\S]*?)(?:<\/MEMO>|\r|\n|<)/i);

    if (trnAmtMatch && fitidMatch) {
      const amtStr = trnAmtMatch[1].trim().replace(',', '.');
      const fitid = fitidMatch[1].trim();
      const type = trnTypeMatch ? trnTypeMatch[1].trim() : 'OTHER';
      const date = dtPostedMatch ? parseOfxDate(dtPostedMatch[1].trim()) : new Date().toISOString();
      const memo = memoMatch ? memoMatch[1].trim() : 'Sem descrição';

      transactions.push({
        fitid,
        type,
        amount: parseFloat(amtStr),
        date,
        memo,
      });
    }
  }

  return {
    bankOrg,
    bankId,
    acctId,
    balanceAmount,
    balanceDate,
    transactions,
  };
}
