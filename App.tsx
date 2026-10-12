import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  FlatList,
  Platform,
  LayoutAnimation,
  UIManager,
  Animated,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Wallet,
  Receipt,
  Bot,
  TrendingUp,
  PlusCircle,
  UploadCloud,
  Send,
  KeyRound,
  Calendar,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  Check,
  ToggleLeft,
  ToggleRight,
  Database,
  ShieldCheck,
  Compass,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit2,
  Target,
  CheckCircle2,
  Circle,
  Settings,
  HandCoins,
  ArrowUpDown,
  ArrowLeft,
} from 'lucide-react-native';
import {
  getPortfolioSummary,
  getRecentTransactions,
  getSetting,
  setSetting,
  saveProvisionalTransaction,
  isMockMode,
  setMockMode,
  addManualTransaction,
  getRecurringBills,
  addRecurringBill,
  updateRecurringBill,
  toggleRecurringBill,
  deleteRecurringBill,
  getFinancialPlans,
  addFinancialPlan,
  updateFinancialPlan,
  deleteFinancialPlan,
  togglePlanCheckpoint,
  applyReconciliationResult,
  addManualFixedIncome,
  addOrAccumulateHolding,
  EXPENSE_CATEGORIES,
  detectCategoryFromDescription,
} from './src/database/db';
import * as DocumentPicker from 'expo-document-picker';
import { PortfolioSummary, Transaction, RecurringBill, BillType, AssetClass, FinancialPlan, CheckGoal } from './src/types/models';
import { parsePushNotification } from './src/services/notifications/parser';
import { parseOfxContent } from './src/services/reconciliation/ofxParser';
import { reconcileStatement } from './src/services/reconciliation/reconciliationEngine';
import {
  askFinancialAgent,
  ChatMessage,
  AVAILABLE_GEMINI_MODELS,
  INITIAL_SUGGESTIONS,
  getContextualSuggestions,
} from './src/services/agent/financialAgent';
import { DonutChart, DonutSlice } from './src/components/DonutChart';
import { MarkdownText } from './src/components/MarkdownText';
import { generatePortfolioInsights, MARKET_OPPORTUNITIES } from './src/services/market/marketService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AnimatedNavItemProps {
  label: string;
  icon: (color: string) => React.ReactNode;
  isActive: boolean;
  onPress: () => void;
  pillWidth?: number;
}

function AnimatedNavItem({ label, icon, isActive, onPress, pillWidth = 114 }: AnimatedNavItemProps) {
  const anim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: isActive ? 1 : 0,
      damping: 16,
      stiffness: 160,
      mass: 0.9,
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  const containerWidth = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, pillWidth],
  });

  const contentOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });

  const contentTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{ overflow: 'hidden' }}
    >
      <Animated.View
        style={[
          styles.navItemAnimatedWrapper,
          {
            width: containerWidth,
            backgroundColor: isActive ? '#1E293B' : '#313438',
            borderColor: '#464646',
          },
        ]}
      >
        {/* Círculo do Ícone que fica fixo à esquerda cobrindo o início da pílula */}
        <View style={styles.activeIconCircle}>
          {icon(isActive ? '#FFFFFF' : '#CBD5E1')}
        </View>

        {/* Pílula interna com o Texto e Ponto que desliza de trás da circunferência */}
        <Animated.View
          style={[
            styles.animatedPillContent,
            {
              opacity: contentOpacity,
              transform: [{ translateX: contentTranslate }],
            },
          ]}
        >
          <Text style={styles.activeNavText} numberOfLines={1}>
            {label}
          </Text>
          <View style={styles.activeDot} />
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}

function MainScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'bills' | 'plans' | 'market' | 'chat' | 'lab'>('dashboard');

  function changeTab(tab: 'dashboard' | 'transactions' | 'bills' | 'plans' | 'market' | 'chat' | 'lab') {
    LayoutAnimation.configureNext({
      duration: 260,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.spring, springDamping: 0.78 },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
    setActiveTab(tab);
  }
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [plans, setPlans] = useState<FinancialPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [mockActive, setMockActive] = useState(isMockMode());

  // Modal de Configurações (Chave de API e Modelo)
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('gemini-3.8-flash');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [savedKeyStatus, setSavedKeyStatus] = useState<string | null>(null);

  // Modal de Entrada/Saída Manual
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualType, setManualType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [manualAmount, setManualAmount] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualCategory, setManualCategory] = useState('Alimentação');
  const [manualAccount, setManualAccount] = useState('');

  // Modal de Nova Assinatura / Fatura / Salário / Despesa Periódica
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDay, setBillDueDay] = useState('10');
  const [billType, setBillType] = useState<BillType>('INVOICE');
  const [billCategory, setBillCategory] = useState('Cartão de Crédito');
  const [billItemsRaw, setBillItemsRaw] = useState(''); // Linhas descritivas dos itens da fatura
  const [expandedBills, setExpandedBills] = useState<Record<string, boolean>>({}); // Controle de sanfona para ver itens da fatura
  const [billTypeFilter, setBillTypeFilter] = useState<'ALL' | BillType>('ALL'); // Filtro por tipo de movimentação

  // Modal de Investimento / Ativos (Renda Fixa, CDB, FII, ETF, Ação)
  const [fixedIncomeModalVisible, setFixedIncomeModalVisible] = useState(false);
  const [cdbAssetClass, setCdbAssetClass] = useState<AssetClass>('CDB');
  const [cdbMode, setCdbMode] = useState<'ACCUMULATE' | 'OVERWRITE'>('ACCUMULATE');
  const [cdbName, setCdbName] = useState('CDB C6 Pós-Fixado Liquidez Diária');
  const [cdbTicker, setCdbTicker] = useState('CDB-C6');
  const [cdbAmount, setCdbAmount] = useState('');
  const [cdbRate, setCdbRate] = useState('102');
  const [cdbProfit, setCdbProfit] = useState('');
  const [cdbDate, setCdbDate] = useState('2026-10-09');

  // Modal de Planos & Metas (Check Goals)
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState('');
  const [planTargetAmount, setPlanTargetAmount] = useState('');
  const [planSavedAmount, setPlanSavedAmount] = useState('');
  const [planMonthlyContribution, setPlanMonthlyContribution] = useState('');
  const [planStrategy, setPlanStrategy] = useState<'SAVINGS' | 'INSTALLMENTS' | 'HYBRID'>('SAVINGS');
  const [planNotes, setPlanNotes] = useState('');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Olá! Sou o seu Agente Financeiro Pessoal. Posso analisar sua distribuição de renda, investimentos, faturas e gastos. Como posso te ajudar hoje?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuggestions, setChatSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);

  // Simulador Push (Lab)
  const [selectedApp, setSelectedApp] = useState<'com.nu.production' | 'com.c6bank.app'>('com.nu.production');
  const [simText, setSimText] = useState('Você gastou R$ 42,90 no débito em Mercado Livre');
  const [simStatus, setSimStatus] = useState<string | null>(null);

  // Mock OFX Import
  const [ofxModalVisible, setOfxModalVisible] = useState(false);
  const [ofxRawText, setOfxRawText] = useState(`
<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <LEDGERBAL>
          <BALAMT>3420.50</BALAMT>
          <DTASOF>20261010120000</DTASOF>
        </LEDGERBAL>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261010143000</DTPOSTED>
            <TRNAMT>-42.90</TRNAMT>
            <FITID>NU-20261010-001</FITID>
            <MEMO>Mercado Livre</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20261010150000</DTPOSTED>
            <TRNAMT>-9.90</TRNAMT>
            <FITID>NU-20261010-002</FITID>
            <MEMO>Tarifa de Manutencao</MEMO>
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
  `);

  async function loadData() {
    try {
      const summary = await getPortfolioSummary();
      const txs = await getRecentTransactions(30);
      const bills = await getRecurringBills();
      const loadedPlans = await getFinancialPlans();
      setPortfolio(summary);
      setTransactions(txs);
      setRecurringBills(bills);
      setPlans(loadedPlans);
      if (summary.accounts.length > 0 && !manualAccount) {
        setManualAccount(summary.accounts[0].id);
      }
      const key = await getSetting('GEMINI_API_KEY');
      if (key) setApiKeyInput(key);
      const savedModel = await getSetting('GEMINI_CUSTOM_MODEL');
      setCustomModelInput(savedModel || 'gemini-3.8-flash');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleToggleMode(mockEnabled: boolean) {
    setMockMode(mockEnabled);
    setMockActive(mockEnabled);
    loadData();
  }

  async function handleSaveKey() {
    await setSetting('GEMINI_API_KEY', apiKeyInput);
    await setSetting('GEMINI_CUSTOM_MODEL', customModelInput.trim());
    setSavedKeyStatus('Configurações salvas com sucesso!');
    setTimeout(() => {
      setSavedKeyStatus(null);
      setSettingsVisible(false);
    }, 1200);
  }

  async function handleAddManual() {
    const parsedAmt = parseFloat(manualAmount.replace(',', '.'));
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Por favor, informe um valor válido.');
      return;
    }
    if (!manualDesc.trim()) {
      alert('Por favor, informe uma descrição detalhada.');
      return;
    }

    await addManualTransaction({
      accountId: manualAccount || (portfolio?.accounts[0]?.id ?? ''),
      type: manualType,
      amount: parsedAmt,
      description: manualDesc.trim(),
      category: manualCategory,
    });

    setManualAmount('');
    setManualDesc('');
    setManualModalVisible(false);
    await loadData();
  }

  async function handleAddBill() {
    let parsedAmt = parseFloat(billAmount.replace(',', '.'));
    const dueDayNum = parseInt(billDueDay, 10);
    if (!billName.trim() || isNaN(dueDayNum)) {
      alert('Por favor, preencha o nome e o dia de vencimento com valores válidos.');
      return;
    }

    // Processar itens detalhados da fatura / recorrência caso informados
    const items: { id: string; description: string; amount: number; category?: string }[] = [];
    if (billItemsRaw.trim()) {
      const lines = billItemsRaw.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Padrão: "Item ou Estabelecimento: 42,90" ou "Item - R$ 42,90"
        const match = trimmed.match(/(.+?)[\s:-]+(?:R\$\s*)?([0-9.,]+)$/i);
        if (match) {
          const desc = match[1].trim();
          const val = parseFloat(match[2].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            items.push({
              id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              description: desc,
              amount: val,
              category: detectCategoryFromDescription(desc) || billCategory,
            });
          }
        }
      }
    }

    // Se o valor total não foi digitado mas há itens, somamos automaticamente os itens
    if ((isNaN(parsedAmt) || parsedAmt <= 0) && items.length > 0) {
      parsedAmt = items.reduce((sum, it) => sum + it.amount, 0);
    } else if (isNaN(parsedAmt) || parsedAmt <= 0) {
      alert('Por favor, informe o valor total ou adicione os itens da fatura.');
      return;
    }

    // Se for edição de compromisso existente
    if (editingBillId) {
      await updateRecurringBill(editingBillId, {
        name: billName.trim(),
        amount: parsedAmt,
        due_day: dueDayNum,
        type: billType,
        category: billCategory,
        items: items.length > 0 ? items : undefined,
      });
    } else {
      await addRecurringBill({
        name: billName.trim(),
        amount: parsedAmt,
        due_day: dueDayNum,
        type: billType,
        category: billCategory,
        is_active: true,
        items: items.length > 0 ? items : undefined,
      });
    }

    setEditingBillId(null);
    setBillName('');
    setBillAmount('');
    setBillItemsRaw('');
    setBillModalVisible(false);
    await loadData();
  }

  function handleOpenCreateBill() {
    setEditingBillId(null);
    setBillName('');
    setBillAmount('');
    setBillDueDay('10');
    setBillType('INVOICE');
    setBillCategory('Cartão de Crédito');
    setBillItemsRaw('');
    setBillModalVisible(true);
  }

  function handleOpenEditBill(bill: RecurringBill) {
    setEditingBillId(bill.id);
    setBillName(bill.name);
    setBillAmount(bill.amount.toString());
    setBillDueDay(bill.due_day.toString());
    setBillType(bill.type);
    setBillCategory(bill.category);
    if (bill.items && bill.items.length > 0) {
      const text = bill.items.map((it) => `${it.description}: ${it.amount.toFixed(2).replace('.', ',')}`).join('\n');
      setBillItemsRaw(text);
    } else {
      setBillItemsRaw('');
    }
    setBillModalVisible(true);
  }

  async function handleToggleBill(id: string) {
    await toggleRecurringBill(id);
    await loadData();
  }

  async function handleDeleteBill(id: string) {
    await deleteRecurringBill(id);
    await loadData();
  }

  function handleOpenCreatePlan() {
    setEditingPlanId(null);
    setPlanTitle('');
    setPlanTargetAmount('');
    setPlanSavedAmount('0');
    setPlanMonthlyContribution('');
    setPlanStrategy('SAVINGS');
    setPlanNotes('');
    setPlanModalVisible(true);
  }

  function handleOpenEditPlan(plan: FinancialPlan) {
    setEditingPlanId(plan.id);
    setPlanTitle(plan.title);
    setPlanTargetAmount(plan.targetAmount.toString());
    setPlanSavedAmount(plan.savedAmount.toString());
    setPlanMonthlyContribution(plan.monthlyContribution.toString());
    setPlanStrategy(plan.strategy);
    setPlanNotes(plan.notes || '');
    setPlanModalVisible(true);
  }

  async function handleSavePlan() {
    const target = parseFloat(planTargetAmount.replace(',', '.'));
    const monthly = parseFloat(planMonthlyContribution.replace(',', '.'));
    const saved = planSavedAmount ? parseFloat(planSavedAmount.replace(',', '.')) : 0;

    if (!planTitle.trim() || isNaN(target) || target <= 0) {
      alert('Por favor, informe um título e o valor da meta.');
      return;
    }

    const validMonthly = isNaN(monthly) || monthly <= 0 ? 1000 : monthly;
    const estMonths = Math.max(1, Math.ceil((target - saved) / validMonthly));

    // Gera 4 checkpoints automáticos (25%, 50%, 75%, 100%)
    const checkpoints: CheckGoal[] = [
      { id: `cp-${Date.now()}-1`, title: `Início (25% - R$ ${(target * 0.25).toFixed(0)})`, targetAmount: target * 0.25, currentAmount: Math.min(saved, target * 0.25), completed: saved >= target * 0.25 },
      { id: `cp-${Date.now()}-2`, title: `Metade (50% - R$ ${(target * 0.50).toFixed(0)})`, targetAmount: target * 0.50, currentAmount: Math.min(saved, target * 0.50), completed: saved >= target * 0.50 },
      { id: `cp-${Date.now()}-3`, title: `Reta Final (75% - R$ ${(target * 0.75).toFixed(0)})`, targetAmount: target * 0.75, currentAmount: Math.min(saved, target * 0.75), completed: saved >= target * 0.75 },
      { id: `cp-${Date.now()}-4`, title: `Meta Batida (100% - R$ ${target.toFixed(0)})`, targetAmount: target, currentAmount: saved, completed: saved >= target },
    ];

    if (editingPlanId) {
      await updateFinancialPlan(editingPlanId, {
        title: planTitle.trim(),
        targetAmount: target,
        savedAmount: saved,
        monthlyContribution: validMonthly,
        estimatedMonths: estMonths,
        strategy: planStrategy,
        notes: planNotes.trim(),
      });
    } else {
      await addFinancialPlan({
        title: planTitle.trim(),
        targetAmount: target,
        savedAmount: saved,
        monthlyContribution: validMonthly,
        estimatedMonths: estMonths,
        strategy: planStrategy,
        status: 'IN_PROGRESS',
        notes: planNotes.trim(),
        checkpoints,
      });
    }

    setPlanModalVisible(false);
    await loadData();
  }

  async function handleDeletePlan(id: string) {
    await deleteFinancialPlan(id);
    await loadData();
  }

  async function handleToggleCheckpoint(planId: string, checkpointId: string) {
    await togglePlanCheckpoint(planId, checkpointId);
    await loadData();
  }

  async function handleAddFixedIncome() {
    const amt = parseFloat(cdbAmount.replace(',', '.'));
    if (!cdbName.trim() || !cdbTicker.trim() || isNaN(amt) || amt <= 0) {
      alert('Por favor, informe valores válidos (nome, código e valor/cotas).');
      return;
    }

    const isFixed = ['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass);
    const profitNum = cdbProfit.trim() ? parseFloat(cdbProfit.replace(',', '.')) : undefined;
    const rateNum = cdbRate.trim() ? parseFloat(cdbRate.replace(',', '.')) : 102;

    const defaultAcc = portfolio?.accounts.find((a) =>
      cdbTicker.toUpperCase().includes('C6')
        ? a.name.toLowerCase().includes('c6')
        : a.name.toLowerCase().includes('nu')
    ) || portfolio?.accounts[0];

    if (isFixed) {
      if (cdbMode === 'OVERWRITE') {
        await addOrAccumulateHolding({
          accountId: defaultAcc?.id || 'acc-c6-real',
          ticker: cdbTicker.trim(),
          name: cdbName.trim(),
          assetClass: cdbAssetClass,
          quantityDelta: amt,
          price: 1.0,
          isNewTotal: true,
          accumulatedProfit: profitNum,
          fixedIncomeRate: rateNum,
        });
      } else {
        await addOrAccumulateHolding({
          accountId: defaultAcc?.id || 'acc-c6-real',
          ticker: cdbTicker.trim(),
          name: cdbName.trim(),
          assetClass: cdbAssetClass,
          quantityDelta: amt,
          price: 1.0,
          isNewTotal: false,
          fixedIncomeRate: rateNum,
        });
      }
    } else {
      // Renda Variável: FII / ETF / Ações (Cotas + Cotação)
      const unitPrice = profitNum !== undefined && profitNum > 0 ? profitNum : 10.0;
      await addOrAccumulateHolding({
        accountId: defaultAcc?.id || 'acc-nu-real',
        ticker: cdbTicker.trim(),
        name: cdbName.trim(),
        assetClass: cdbAssetClass,
        quantityDelta: amt, // cotas
        price: unitPrice,
        isNewTotal: cdbMode === 'OVERWRITE',
      });
    }

    setFixedIncomeModalVisible(false);
    setCdbAmount('');
    setCdbProfit('');
    await loadData();
  }

  async function handleSimulatePush() {
    const parsed = parsePushNotification(selectedApp, simText);
    if (!parsed) {
      setSimStatus('❌ Notificação não casou com os padrões regex esperados.');
      return;
    }
    try {
      await saveProvisionalTransaction(parsed.institution_code, parsed.amount, parsed.description, simText);
      setSimStatus(`✅ Transação PROVISÓRIA gravada! R$ ${parsed.amount.toFixed(2)} - ${parsed.description}`);
      await loadData();
    } catch (err: any) {
      setSimStatus(`Erro: ${err.message}`);
    }
  }

  async function handlePickOfxFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        if (file.file) {
          // No ambiente Web
          const text = await file.file.text();
          setOfxRawText(text);
        } else if (file.uri) {
          // No ambiente Mobile
          const response = await fetch(file.uri);
          const text = await response.text();
          setOfxRawText(text);
        }
      }
    } catch (err: any) {
      alert(`Erro ao selecionar arquivo: ${err.message}`);
    }
  }

  async function handleImportOfx() {
    if (!portfolio || portfolio.accounts.length === 0) return;
    const statement = parseOfxContent(ofxRawText);

    // Identificar inteligentemente a conta de destino pelo OFX
    let targetAccount = portfolio.accounts[0];
    const isC6 =
      (statement.bankOrg && statement.bankOrg.toLowerCase().includes('c6')) ||
      statement.bankId === '336' ||
      ofxRawText.includes('Banco C6');

    const isNu =
      (statement.bankOrg && statement.bankOrg.toLowerCase().includes('nu')) ||
      statement.bankId === '0260' ||
      statement.bankId === '260' ||
      ofxRawText.includes('NU PAGAMENTOS');

    if (isC6) {
      const c6Acc = portfolio.accounts.find((a) => a.name.toLowerCase().includes('c6'));
      if (c6Acc) targetAccount = c6Acc;
    } else if (isNu) {
      const nuAcc = portfolio.accounts.find((a) => a.name.toLowerCase().includes('nu'));
      if (nuAcc) targetAccount = nuAcc;
    }

    const result = reconcileStatement(targetAccount, transactions, statement);

    // Persistir o resultado da conciliação no banco/estado
    await applyReconciliationResult(
      targetAccount.id,
      result.newBalance,
      result.updatedTransactions,
      result.createdTransactions
    );

    alert(
      `Conciliação Concluída com Sucesso!\n\n` +
      `• Reconciliadas com Push: ${result.reconciledCount}\n` +
      `• Novas Registradas (Settled): ${result.settledCount}\n` +
      `• Ignoradas (Idempotência/Duplicadas): ${result.skippedCount}\n` +
      `• Novo Saldo Atualizado: R$ ${result.newBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    );
    setOfxModalVisible(false);
    await loadData();
  }

  async function handleSendChat(customText?: string) {
    const textToSend = (typeof customText === 'string' ? customText : chatInput).trim();
    if (!textToSend || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setChatLoading(true);

    const response = await askFinancialAgent(textToSend, updatedMessages);

    const botMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: 'assistant',
      text: response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, botMsg]);
    setChatLoading(false);

    // Atualiza chips com sugestões dinâmicas e contextuais baseadas na pergunta feita e na resposta da IA
    const nextSuggestions = getContextualSuggestions(textToSend, response);
    setChatSuggestions(nextSuggestions);
  }

  // Preparar dados do Gráfico de Rosca
  const donutSlices: DonutSlice[] = [];
  if (portfolio && portfolio.net_worth > 0) {
    if (portfolio.total_cash > 0) {
      donutSlices.push({
        label: 'Caixa / Reserva',
        value: portfolio.total_cash,
        color: '#00C48C',
      });
    }
    // Agrupar ativos por ticker ou classe
    portfolio.holdings.forEach((h, idx) => {
      const colors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
      const val = h.quantity * (h.current_price || h.average_price);
      if (val > 0) {
        donutSlices.push({
          label: h.ticker || `Ativo ${idx + 1}`,
          value: val,
          color: colors[idx % colors.length],
        });
      }
    });
  }

  const totalMonthlyIncomes = recurringBills
    .filter((b) => b.is_active && b.type === 'INCOME_SALARY')
    .reduce((sum, b) => sum + b.amount, 0);

  const totalMonthlyExpenses = recurringBills
    .filter((b) => b.is_active && b.type !== 'INCOME_SALARY')
    .reduce((sum, b) => sum + b.amount, 0);

  const netMonthlyForecast = totalMonthlyIncomes - totalMonthlyExpenses;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00C48C" />
        <Text style={styles.loadingText}>Carregando MyFinance...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Superior estilo Vectorcraft */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerGreeting}>Olá, Usuário!</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Botões Mock vs Real sutis */}
          <View style={styles.togglePill}>
            <TouchableOpacity
              style={[styles.pillBtn, mockActive && styles.pillBtnActive]}
              onPress={() => handleToggleMode(true)}
            >
              <Text style={[styles.pillBtnText, mockActive && styles.pillBtnActiveText]}>Mock</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, !mockActive && styles.pillBtnActive]}
              onPress={() => handleToggleMode(false)}
            >
              <Text style={[styles.pillBtnText, !mockActive && styles.pillBtnActiveText]}>Real</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => setSettingsVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Settings size={22} color="#FFFFFF" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conteúdo Dinâmico por Aba */}
      {activeTab === 'dashboard' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* CARD 1 (Top compact card): Saldo e Patrimônio Líquido Consolidado */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardLabel}>PATRIMÔNIO LÍQUIDO</Text>
              <View style={[styles.modeIndicator, mockActive ? styles.modeMock : styles.modeReal]}>
                <Text style={styles.modeText}>{mockActive ? 'MOCK' : 'REAL'}</Text>
              </View>
            </View>
            <Text style={styles.netWorthValue}>
              R$ {portfolio?.net_worth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <View style={styles.rowSplit}>
              <View style={styles.subCol}>
                <Text style={styles.subColLabel}>Caixa / Liquidez</Text>
                <Text style={styles.subColValue}>
                  R$ {portfolio?.total_cash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.subCol}>
                <Text style={styles.subColLabel}>Investimentos</Text>
                <Text style={styles.subColValue}>
                  R$ {portfolio?.total_equity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* CARD 2 (Medium card): Distribuição de Ativos (Gráfico de Rosca) */}
          <View style={styles.cardContainer}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Distribuição da Carteira</Text>
              <TouchableOpacity
                style={styles.cardActionLink}
                onPress={() => setActiveTab('market')}
              >
                <Compass size={14} color="#38BDF8" />
                <Text style={styles.cardActionLinkText}>Ver Mercado</Text>
              </TouchableOpacity>
            </View>
            {portfolio && portfolio.net_worth > 0 ? (
              <View>
                <DonutChart
                  slices={donutSlices}
                  size={180}
                  strokeWidth={24}
                  centerLabel="Total"
                  centerValue={`R$ ${(portfolio.net_worth / 1000).toFixed(1)}k`}
                />
                <View style={styles.donutLegendContainer}>
                  {donutSlices.map((slice, i) => (
                    <View key={i} style={styles.donutLegendItem}>
                      <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                      <Text style={styles.legendLabelText}>{slice.label}</Text>
                      <Text style={styles.legendValueText}>
                        R$ {slice.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                        {((slice.value / portfolio.net_worth) * 100).toFixed(1)}%)
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyCardBox}>
                <Text style={styles.emptyText}>Sem ativos cadastrados nos Dados Reais.</Text>
                <Text style={styles.emptySubText}>
                  Use o botão no topo para alternar para "Mock" ou registre novos aportes.
                </Text>
              </View>
            )}
          </View>

          {/* CARD 3 (Compact Banner): Atalho para Mercado & Oportunidades Inteligentes */}
          <TouchableOpacity
            style={styles.cardBannerShortcut}
            activeOpacity={0.8}
            onPress={() => setActiveTab('market')}
          >
            <View style={styles.bannerIconCircle}>
              <Compass size={22} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.bannerTitle}>Mercado & Oportunidades</Text>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>{MARKET_OPPORTUNITIES.length} ativos</Text>
                </View>
              </View>
              <Text style={styles.bannerSubtitle}>
                Diagnóstico de carteira, CDI vs IPCA+ e ativos sugeridos
              </Text>
            </View>
            <ArrowUpRight size={18} color="#94A3B8" />
          </TouchableOpacity>

          {/* CARD 4 (Large card): Contas Correntes & Custódia de Ativos Detalhada */}
          <View style={styles.cardContainer}>
            {/* Cabeçalho Contas */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Contas & Saldos</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => {
                  setManualType('INCOME');
                  setManualModalVisible(true);
                }}
              >
                <PlusCircle size={14} color="#00C48C" />
                <Text style={styles.smallAddBtnText}>Lançar</Text>
              </TouchableOpacity>
            </View>
            {portfolio?.accounts.map((acc) => (
              <View key={acc.id} style={styles.itemRow}>
                <Text style={styles.itemTitle}>{acc.name}</Text>
                <Text style={styles.itemAmount}>
                  R$ {Number(acc.current_ledger_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            ))}

            {/* Cabeçalho Investimentos */}
            <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
              <Text style={styles.sectionTitle}>Investimentos & Custódia</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setFixedIncomeModalVisible(true)}
              >
                <PlusCircle size={14} color="#00C48C" />
                <Text style={styles.smallAddBtnText}>+ Aporte</Text>
              </TouchableOpacity>
            </View>

            {/* Seção Renda Fixa */}
            <Text style={styles.subCategoryHeader}>Renda Fixa & Títulos Públicos</Text>
            {portfolio?.holdings
              .filter((h) => ['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(h.asset_class || ''))
              .map((h) => {
                const totalVal = h.quantity * (h.current_price || h.average_price);
                const initialVal = h.fixed_income_details?.initial_amount || totalVal;
                const profit = totalVal - initialVal;
                const profitPercent = initialVal > 0 ? (profit / initialVal) * 100 : 0;

                return (
                  <View key={h.id} style={styles.itemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemTitle}>{h.name || h.ticker}</Text>
                      <Text style={styles.itemSubtitle}>
                        {h.fixed_income_details
                          ? `${h.fixed_income_details.rate_percentage}% do ${h.fixed_income_details.benchmark} • Aplicado: R$ ${initialVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'Renda Fixa'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemAmount}>
                        R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={[styles.itemSubtitle, { color: profit >= 0 ? '#00C48C' : '#F87171', fontWeight: '700' }]}>
                        {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)} ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                );
              })}

            {/* Seção Renda Variável */}
            <Text style={[styles.subCategoryHeader, { marginTop: 14 }]}>Renda Variável (FIIs & ETFs - B3)</Text>
            {portfolio?.holdings
              .filter((h) => !['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(h.asset_class || ''))
              .map((h) => {
                const totalVal = h.quantity * (h.current_price || h.average_price);
                const totalCost = h.quantity * h.average_price;
                const profit = totalVal - totalCost;
                const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

                return (
                  <View key={h.id} style={styles.itemRow}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.itemTitle}>{h.ticker}</Text>
                      <Text style={styles.itemSubtitle}>
                        {h.quantity} {h.quantity === 1 ? 'cota' : 'cotas'} • PM: R$ {h.average_price.toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.itemAmount}>
                        R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={[styles.itemSubtitle, { color: profit >= 0 ? '#00C48C' : '#F87171', fontWeight: '700' }]}>
                        {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)} ({profitPercent >= 0 ? '+' : ''}{profitPercent.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>
                );
              })}
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {activeTab === 'transactions' && (
        <View style={styles.content}>
          <View style={styles.actionRow}>
            <Text style={styles.sectionTitle}>Histórico de Transações</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#3B82F6' }]}
                onPress={() => setManualModalVisible(true)}
              >
                <PlusCircle size={15} color="#3B82F6" />
                <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Manual</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={() => setOfxModalVisible(true)}>
                <UploadCloud size={15} color="#00C48C" />
                <Text style={styles.actionBtnText}>OFX</Text>
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.txCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDesc}>{item.description}</Text>
                  <View style={styles.statusRow}>
                    <Text
                      style={[
                        styles.badge,
                        item.status === 'RECONCILED'
                          ? styles.badgeReconciled
                          : item.status === 'SETTLED'
                          ? styles.badgeSettled
                          : styles.badgeProvisional,
                      ]}
                    >
                      {item.status}
                    </Text>
                    {item.category && <Text style={styles.categoryPill}>{item.category}</Text>}
                    <Text style={styles.txDate}>{new Date(item.transaction_date).toLocaleDateString('pt-BR')}</Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    item.amount < 0 ? styles.txNegative : styles.txPositive,
                  ]}
                >
                  {item.amount < 0 ? '-' : '+'} R${' '}
                  {Math.abs(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyCardBox}>
                <Text style={styles.emptyText}>Nenhuma transação registrada neste modo.</Text>
                <Text style={styles.emptySubText}>
                  Use o botão "+ Manual" acima para adicionar entradas ou saídas descritivas.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Aba de Controle de Faturas, Mensalidades, Assinaturas, Salários e Despesas Periódicas */}
      {activeTab === 'bills' && (
        <ScrollView style={styles.content}>
          {/* Card Resumo Previsão Mensal */}
          <View style={[styles.netWorthCard, { paddingVertical: 14, paddingHorizontal: 14, marginBottom: 14 }]}>
            <Text style={styles.cardLabel}>PREVISÃO MENSAL RECORRENTE</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subColLabel} numberOfLines={1}>Entradas</Text>
                <Text style={[styles.subColValue, { color: '#00C48C', fontSize: 14, fontWeight: '800' }]} numberOfLines={1}>
                  +R$ {totalMonthlyIncomes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subColLabel} numberOfLines={1}>Saídas</Text>
                <Text style={[styles.subColValue, { color: '#F87171', fontSize: 14, fontWeight: '800' }]} numberOfLines={1}>
                  -R$ {totalMonthlyExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1.1 }}>
                <Text style={styles.subColLabel} numberOfLines={1}>Saldo Livre</Text>
                <Text
                  style={[
                    styles.subColValue,
                    { color: netMonthlyForecast >= 0 ? '#38BDF8' : '#F87171', fontSize: 14, fontWeight: '800' },
                  ]}
                  numberOfLines={1}
                >
                  R$ {netMonthlyForecast.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <View style={{ flex: 1, paddingRight: 6 }}>
              <Text style={styles.sectionTitle} numberOfLines={1}>Compromissos</Text>
              <Text style={styles.subColLabel} numberOfLines={1}>Faturas, assinaturas e salários</Text>
            </View>
            <TouchableOpacity style={styles.actionBtn} onPress={handleOpenCreateBill}>
              <PlusCircle size={14} color="#00C48C" />
              <Text style={styles.actionBtnText}>+ Novo</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de Filtros por Tipo de Movimentação */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 14 }}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {[
              { key: 'ALL', label: `Todos (${recurringBills.length})` },
              { key: 'INVOICE', label: `Faturas (${recurringBills.filter((b) => b.type === 'INVOICE').length})` },
              { key: 'SUBSCRIPTION', label: `Assinaturas (${recurringBills.filter((b) => b.type === 'SUBSCRIPTION').length})` },
              { key: 'PERIODIC_EXPENSE', label: `Despesas Fixas (${recurringBills.filter((b) => b.type === 'PERIODIC_EXPENSE').length})` },
              { key: 'INCOME_SALARY', label: `Salários / Rendas (${recurringBills.filter((b) => b.type === 'INCOME_SALARY').length})` },
            ].map((f) => {
              const active = billTypeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.chip,
                    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
                    active && styles.chipActive,
                  ]}
                  onPress={() => setBillTypeFilter(f.key as any)}
                >
                  <Text style={[styles.chipText, active && styles.chipActiveText]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {recurringBills
            .filter((bill) => billTypeFilter === 'ALL' || bill.type === billTypeFilter)
            .map((bill) => {
              const isExpanded = !!expandedBills[bill.id];
              const hasItems = bill.items && bill.items.length > 0;
              const isIncome = bill.type === 'INCOME_SALARY';

              return (
                <View key={bill.id} style={[styles.billCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  {/* Linha Principal do Card */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.billIconContainer, isIncome && { backgroundColor: '#10B98122' }]}>
                      {bill.type === 'INVOICE' ? (
                        <CreditCard size={22} color="#F59E0B" />
                      ) : isIncome ? (
                        <ArrowDownLeft size={22} color="#00C48C" />
                      ) : (
                        <Calendar size={22} color="#3B82F6" />
                      )}
                    </View>

                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <Text style={styles.billTitle}>{bill.name}</Text>
                      <Text style={styles.billSubtitle}>
                        {isIncome ? 'Recebimento' : 'Vence'} dia {bill.due_day} • {bill.category}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text
                          style={[
                            styles.billTypeBadge,
                            isIncome && { backgroundColor: '#10B98122', color: '#00C48C' },
                          ]}
                        >
                          {bill.type === 'INVOICE'
                            ? 'Fatura de Cartão'
                            : bill.type === 'SUBSCRIPTION'
                            ? 'Assinatura'
                            : bill.type === 'INCOME_SALARY'
                            ? 'Salário / Renda'
                            : bill.type === 'PERIODIC_EXPENSE'
                            ? 'Despesa Periódica'
                            : 'Mensalidade'}
                        </Text>
                        {hasItems && (
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                            onPress={() =>
                              setExpandedBills((prev) => ({ ...prev, [bill.id]: !prev[bill.id] }))
                            }
                          >
                            <Text style={{ fontSize: 11, color: '#38BDF8', fontWeight: '700' }}>
                              {bill.items?.length} itens {isExpanded ? '▲' : '▼'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.billAmount, isIncome && { color: '#00C48C' }]}>
                        {isIncome ? '+' : ''}R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        <TouchableOpacity onPress={() => handleOpenEditBill(bill)}>
                          <Edit2 size={14} color="#38BDF8" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleToggleBill(bill.id)}>
                          <Text style={bill.is_active ? styles.billActiveText : styles.billPausedText}>
                            {bill.is_active ? 'Ativo' : 'Pausado'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteBill(bill.id)}>
                          <Trash2 size={14} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Composição detalhada da Fatura / Assinatura (Sanfona) */}
                  {hasItems && isExpanded && (
                    <View
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: '#334155',
                        backgroundColor: '#0F172A44',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingBottom: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '700', marginBottom: 6 }}>
                        O QUE COMPÕE ESTA FATURA:
                      </Text>
                      {bill.items?.map((item) => (
                        <View
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: 4,
                            borderBottomWidth: 1,
                            borderBottomColor: '#1E293B',
                          }}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={{ fontSize: 13, color: '#F1F5F9', fontWeight: '500' }}>
                              {item.description}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              {item.category && (
                                <View style={{ backgroundColor: '#334155', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 9, color: '#93C5FD', fontWeight: '700' }}>{item.category}</Text>
                                </View>
                              )}
                              {item.date && (
                                <Text style={{ fontSize: 10, color: '#64748B' }}>
                                  Cobrado em {new Date(item.date).toLocaleDateString('pt-BR')}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Text style={{ fontSize: 13, color: '#F59E0B', fontWeight: '700' }}>
                            R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

          {recurringBills.filter((bill) => billTypeFilter === 'ALL' || bill.type === billTypeFilter).length === 0 && (
            <View style={styles.emptyCardBox}>
              <Text style={styles.emptyText}>Nenhum compromisso encontrado para este filtro.</Text>
              <Text style={styles.emptySubText}>
                Alterne os filtros acima ou cadastre novos compromissos no botão "+ Novo Compromisso".
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Aba de Planos & Metas Financeiras (Check Goals) */}
      {activeTab === 'plans' && (
        <ScrollView style={styles.content}>
          {/* Card Resumo de Metas */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text style={styles.sectionTitle} numberOfLines={1}>Planos & Metas</Text>
                <Text style={styles.subColLabel} numberOfLines={1}>Check Goals e progresso automático</Text>
              </View>
              <TouchableOpacity style={styles.actionBtn} onPress={handleOpenCreatePlan}>
                <PlusCircle size={14} color="#00C48C" />
                <Text style={styles.actionBtnText}>+ Novo</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.rowSplit}>
              <View style={styles.subCol}>
                <Text style={styles.subColLabel}>Total em Metas</Text>
                <Text style={[styles.subColValue, { color: '#38BDF8' }]}>
                  R$ {plans.reduce((acc, p) => acc + p.targetAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.subCol}>
                <Text style={styles.subColLabel}>Total Já Guardado</Text>
                <Text style={[styles.subColValue, { color: '#00C48C' }]}>
                  R$ {plans.reduce((acc, p) => acc + p.savedAmount, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.subCol}>
                <Text style={styles.subColLabel}>Planos Ativos</Text>
                <Text style={[styles.subColValue, { color: '#F59E0B' }]}>
                  {plans.filter((p) => p.status === 'IN_PROGRESS').length}
                </Text>
              </View>
            </View>
          </View>

          {/* Lista de Planos e Checkpoints */}
          {plans.map((plan) => {
            const pct = Math.min(100, Math.round((plan.savedAmount / plan.targetAmount) * 100));
            const remaining = Math.max(0, plan.targetAmount - plan.savedAmount);
            const monthsLeft = plan.monthlyContribution > 0 ? Math.ceil(remaining / plan.monthlyContribution) : plan.estimatedMonths;

            return (
              <View key={plan.id} style={styles.planCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Target size={20} color="#00C48C" />
                      <Text style={styles.planTitle}>{plan.title}</Text>
                    </View>
                    <Text style={styles.planStrategyBadge}>
                      {plan.strategy === 'SAVINGS' ? 'Poupança Sustentável' : plan.strategy === 'INSTALLMENTS' ? 'Parcelamento Inteligente' : 'Estratégia Híbrida'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleOpenEditPlan(plan)}>
                      <Edit2 size={15} color="#38BDF8" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePlan(plan.id)}>
                      <Trash2 size={15} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Barra de Progresso Visual */}
                <View style={{ marginVertical: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                      Progresso: <Text style={{ color: '#00C48C', fontWeight: '700' }}>{pct}%</Text>
                    </Text>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                      Faltam: <Text style={{ color: '#F8FAFC', fontWeight: '600' }}>R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text> ({monthsLeft} meses)
                    </Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                  </View>
                </View>

                <View style={styles.planMetaRow}>
                  <View>
                    <Text style={styles.planMetaLabel}>Meta Alvo</Text>
                    <Text style={styles.planMetaVal}>R$ {plan.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View>
                    <Text style={styles.planMetaLabel}>Acumulado</Text>
                    <Text style={[styles.planMetaVal, { color: '#00C48C' }]}>R$ {plan.savedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</Text>
                  </View>
                  <View>
                    <Text style={styles.planMetaLabel}>Aporte Mensal</Text>
                    <Text style={styles.planMetaVal}>R$ {plan.monthlyContribution.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</Text>
                  </View>
                </View>

                {/* Check Goals Integrados */}
                {plan.checkpoints && plan.checkpoints.length > 0 && (
                  <View style={styles.checkpointsContainer}>
                    <Text style={styles.checkpointsTitle}>CHECK GOALS DE EVOLUÇÃO:</Text>
                    {plan.checkpoints.map((cp) => (
                      <TouchableOpacity
                        key={cp.id}
                        style={styles.checkpointItem}
                        onPress={() => handleToggleCheckpoint(plan.id, cp.id)}
                      >
                        {cp.completed ? (
                          <CheckCircle2 size={18} color="#00C48C" />
                        ) : (
                          <Circle size={18} color="#64748B" />
                        )}
                        <Text style={[styles.checkpointText, cp.completed && styles.checkpointTextCompleted]}>
                          {cp.title}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {plan.notes ? (
                  <Text style={styles.planNotesText}>💡 {plan.notes}</Text>
                ) : null}
              </View>
            );
          })}

          {plans.length === 0 && (
            <View style={styles.emptyCardBox}>
              <Text style={styles.emptyText}>Nenhum plano cadastrado no momento.</Text>
              <Text style={styles.emptySubText}>
                Clique em "+ Novo Plano" ou peça ao Agente IA no chat para criar um plano financeiro para você.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Aba de Mercado & Recomendações Personalizadas */}
      {activeTab === 'market' && (
        <ScrollView style={styles.content}>
          <View style={styles.actionRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setActiveTab('dashboard')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowLeft size={18} color="#F1F5F9" />
              </TouchableOpacity>
              <View>
                <Text style={styles.sectionTitle}>Mercado & Oportunidades</Text>
                <Text style={styles.subColLabel}>Análise inteligente com base na sua carteira</Text>
              </View>
            </View>
          </View>

          {/* Card de Diagnóstico da Carteira */}
          {(() => {
            const insights = generatePortfolioInsights(portfolio);
            return (
              <View>
                <View style={styles.sectionCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Lightbulb size={20} color="#F59E0B" />
                    <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Diagnóstico de Alocação</Text>
                  </View>

                  <View style={styles.rowSplit}>
                    <View style={styles.subCol}>
                      <Text style={styles.subColLabel}>Caixa</Text>
                      <Text style={[styles.subColValue, { color: '#00C48C' }]}>
                        {insights.cashPercent.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.subCol}>
                      <Text style={styles.subColLabel}>Renda Fixa</Text>
                      <Text style={[styles.subColValue, { color: '#38BDF8' }]}>
                        {insights.fixedPercent.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.subCol}>
                      <Text style={styles.subColLabel}>Bolsa (FII/ETF)</Text>
                      <Text style={[styles.subColValue, { color: '#A855F7' }]}>
                        {insights.equityPercent.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 14 }}>
                    {insights.tips.map((tip, idx) => (
                      <View key={idx} style={styles.tipBox}>
                        <Text style={styles.tipText}>💡 {tip}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Lista de Ativos Recomendados */}
                <Text style={[styles.sectionTitle, { marginTop: 8, marginBottom: 12 }]}>
                  Ativos Recomendados para Balanceamento
                </Text>

                {insights.opportunities.map((item, idx) => (
                  <View key={idx} style={styles.marketCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <Text style={styles.marketTicker}>{item.ticker}</Text>
                        <Text style={styles.marketName}>{item.name}</Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          item.recommendationType === 'DIVERSIFICACAO'
                            ? styles.badgeSettled
                            : item.recommendationType === 'OPORTUNIDADE'
                            ? styles.badgeReconciled
                            : styles.badgeProvisional,
                        ]}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#F8FAFC' }}>
                          {item.recommendationType}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.marketRationale}>{item.rationale}</Text>

                    <View style={styles.marketFooter}>
                      <Text style={styles.marketPrice}>
                        Cotação: R$ {item.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </Text>
                      <Text style={styles.marketYield}>{item.yieldOrRate}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {activeTab === 'chat' && (
        <View style={styles.chatContainer}>
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              // Verifica se a resposta contém uma sugestão de plano para ativação direta
              const planMatch = item.sender === 'assistant' && item.text.includes('```plan_suggestion');
              let suggestedPlanObj: any = null;
              let cleanText = item.text;

              if (planMatch) {
                try {
                  const jsonPart = item.text.split('```plan_suggestion')[1]?.split('```')[0]?.trim();
                  if (jsonPart) suggestedPlanObj = JSON.parse(jsonPart);
                  cleanText = item.text.replace(/```plan_suggestion[\s\S]*?```/, '').trim();
                } catch (e) {
                  // Fallback se JSON for inválido
                }
              }

              return (
                <View
                  style={[
                    styles.msgBubble,
                    item.sender === 'user' ? styles.msgUser : styles.msgAssistant,
                  ]}
                >
                  {item.sender === 'assistant' ? (
                    <MarkdownText content={cleanText} />
                  ) : (
                    <Text style={styles.msgText}>{item.text}</Text>
                  )}

                  {/* Card interativo de confirmação rápida de plano proposto pelo agente */}
                  {suggestedPlanObj && (
                    <View style={styles.planSuggestionCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Target size={16} color="#00C48C" />
                        <Text style={styles.planSuggestionTitle}>Sugestão de Meta: {suggestedPlanObj.title}</Text>
                      </View>
                      <Text style={styles.planSuggestionMeta}>
                        Alvo: R$ {Number(suggestedPlanObj.targetAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} • Aporte: R$ {Number(suggestedPlanObj.monthlyContribution).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês ({suggestedPlanObj.estimatedMonths} meses)
                      </Text>
                      <TouchableOpacity
                        style={styles.planSuggestionBtn}
                        onPress={async () => {
                          const target = Number(suggestedPlanObj.targetAmount);
                          await addFinancialPlan({
                            title: suggestedPlanObj.title,
                            targetAmount: target,
                            savedAmount: 0,
                            monthlyContribution: Number(suggestedPlanObj.monthlyContribution),
                            estimatedMonths: Number(suggestedPlanObj.estimatedMonths),
                            strategy: suggestedPlanObj.strategy || 'SAVINGS',
                            status: 'IN_PROGRESS',
                            notes: suggestedPlanObj.notes || 'Meta criada via Agente IA',
                            checkpoints: [
                              { id: `cp-${Date.now()}-1`, title: `Início (25% - R$ ${(target * 0.25).toFixed(0)})`, targetAmount: target * 0.25, currentAmount: 0, completed: false },
                              { id: `cp-${Date.now()}-2`, title: `Metade (50% - R$ ${(target * 0.50).toFixed(0)})`, targetAmount: target * 0.50, currentAmount: 0, completed: false },
                              { id: `cp-${Date.now()}-3`, title: `Reta Final (75% - R$ ${(target * 0.75).toFixed(0)})`, targetAmount: target * 0.75, currentAmount: 0, completed: false },
                              { id: `cp-${Date.now()}-4`, title: `Meta Batida (100% - R$ ${target.toFixed(0)})`, targetAmount: target, currentAmount: 0, completed: false },
                            ],
                          });
                          await loadData();
                          alert(`Plano "${suggestedPlanObj.title}" adicionado com sucesso na aba Planos!`);
                          setActiveTab('plans');
                        }}
                      >
                        <Check size={14} color="#000" />
                        <Text style={styles.planSuggestionBtnText}>Adicionar aos Meus Planos</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.msgTime}>{item.timestamp}</Text>
                </View>
              );
            }}
            contentContainerStyle={{ padding: 16 }}
          />
          {chatLoading && (
            <View style={styles.chatTyping}>
              <ActivityIndicator size="small" color="#00C48C" />
              <Text style={styles.chatTypingText}>Agente analisando finanças...</Text>
            </View>
          )}

          {/* Chips de Perguntas Contextuais com Envio Imediato */}
          {chatSuggestions.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 42, paddingHorizontal: 16, marginBottom: 8 }}
              contentContainerStyle={{ gap: 8 }}
            >
              {chatSuggestions.map((sug) => (
                <TouchableOpacity
                  key={sug}
                  style={[styles.chip, { backgroundColor: '#1E293B', borderColor: '#38BDF8', borderWidth: 1 }]}
                  disabled={chatLoading}
                  onPress={() => {
                    handleSendChat(sug);
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#38BDF8', fontWeight: '600' }}>{sug}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Pergunte sobre sua carteira, faturas ou despesas..."
              placeholderTextColor="#666"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={() => handleSendChat()}
            />
            <TouchableOpacity style={styles.chatSendBtn} onPress={() => handleSendChat()}>
              <Send size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeTab === 'lab' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Simulador de Notificações Push</Text>
          <Text style={styles.labSubtitle}>
            Teste a ingestão e o regex das notificações do Nubank e C6 sem precisar do aparelho físico:
          </Text>

          <View style={styles.segmentedButtons}>
            <TouchableOpacity
              style={[styles.segBtn, selectedApp === 'com.nu.production' && styles.segBtnActive]}
              onPress={() => {
                setSelectedApp('com.nu.production');
                setSimText('Você gastou R$ 42,90 no débito em Mercado Livre');
              }}
            >
              <Text style={selectedApp === 'com.nu.production' ? styles.segBtnActiveText : styles.segBtnText}>
                Nubank
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segBtn, selectedApp === 'com.c6bank.app' && styles.segBtnActive]}
              onPress={() => {
                setSelectedApp('com.c6bank.app');
                setSimText('Pix enviado: R$ 85,00 para Restaurante Bom Sabor');
              }}
            >
              <Text style={selectedApp === 'com.c6bank.app' ? styles.segBtnActiveText : styles.segBtnText}>
                C6 Bank
              </Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={3}
            value={simText}
            onChangeText={setSimText}
            placeholder="Texto da notificação"
            placeholderTextColor="#777"
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: '#1E293B' }]}
              onPress={() => setSimText('Aplicação realizada: R$ 500,00 em CDB C6 Pós-Fixado')}
            >
              <Text style={styles.chipText}>+ R$ 500 no CDB C6</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: '#1E293B' }]}
              onPress={() => setSimText('Aplicação realizada: R$ 94,50 em MXRF11')}
            >
              <Text style={styles.chipText}>+ 10 cotas MXRF11</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: '#1E293B' }]}
              onPress={() => setSimText('Você gastou R$ 42,90 no débito em Mercado Livre')}
            >
              <Text style={styles.chipText}>Gasto Cartão</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSimulatePush}>
            <Text style={styles.primaryBtnText}>Simular Push e Acumular</Text>
          </TouchableOpacity>

          {simStatus && <Text style={styles.simResult}>{simStatus}</Text>}
        </ScrollView>
      )}

      {/* Barra de Navegação Inferior estilo Vectorcraft com Animação Fluida */}
      <View style={[styles.bottomNavContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.bottomNavRow}>
          {/* Aba 1: Início */}
          <AnimatedNavItem
            label="Início"
            icon={(color) => <Wallet size={18} color={color} strokeWidth={2} />}
            isActive={activeTab === 'dashboard'}
            onPress={() => setActiveTab('dashboard')}
            pillWidth={106}
          />

          {/* Aba 2: Extrato */}
          <AnimatedNavItem
            label="Extrato"
            icon={(color) => <HandCoins size={18} color={color} strokeWidth={2} />}
            isActive={activeTab === 'transactions'}
            onPress={() => setActiveTab('transactions')}
            pillWidth={114}
          />

          {/* Aba 3: Movimentos / Compromissos */}
          <AnimatedNavItem
            label="Movimento"
            icon={(color) => <ArrowUpDown size={18} color={color} strokeWidth={2} />}
            isActive={activeTab === 'bills'}
            onPress={() => setActiveTab('bills')}
            pillWidth={132}
          />

          {/* Aba 4: Metas / Planos */}
          <AnimatedNavItem
            label="Metas"
            icon={(color) => <Target size={18} color={color} strokeWidth={2} />}
            isActive={activeTab === 'plans'}
            onPress={() => setActiveTab('plans')}
            pillWidth={106}
          />

          {/* Aba 5: Assistente IA */}
          <AnimatedNavItem
            label="Assistente"
            icon={(color) => <Bot size={18} color={color} strokeWidth={2} />}
            isActive={activeTab === 'chat'}
            onPress={() => setActiveTab('chat')}
            pillWidth={132}
          />
        </View>
      </View>

      {/* Modal de Lançamento Manual (Entrada / Saída Descritiva) */}
      <Modal visible={manualModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Novo Lançamento Manual</Text>
            <Text style={styles.modalSubtitle}>Adicione uma entrada ou despesa de forma descritiva:</Text>

            {/* Alternância Entrada vs Saída */}
            <View style={styles.segmentedButtons}>
              <TouchableOpacity
                style={[styles.segBtn, manualType === 'EXPENSE' && styles.segBtnExpense]}
                onPress={() => setManualType('EXPENSE')}
              >
                <Text style={manualType === 'EXPENSE' ? styles.segBtnActiveText : styles.segBtnText}>
                  Saída / Despesa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, manualType === 'INCOME' && styles.segBtnIncome]}
                onPress={() => setManualType('INCOME')}
              >
                <Text style={manualType === 'INCOME' ? styles.segBtnActiveText : styles.segBtnText}>
                  Entrada / Receita
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Valor (R$)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 150,00"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={manualAmount}
              onChangeText={setManualAmount}
            />

            <Text style={styles.inputLabel}>Descrição Detalhada</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Almoço com clientes, Manutenção carro, Freela"
              placeholderTextColor="#666"
              value={manualDesc}
              onChangeText={setManualDesc}
            />

            <Text style={styles.inputLabel}>Categoria</Text>
            <View style={styles.categoryChipsRow}>
              {['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Salário', 'Outros'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, manualCategory === cat && styles.chipActive]}
                  onPress={() => setManualCategory(cat)}
                >
                  <Text style={[styles.chipText, manualCategory === cat && styles.chipActiveText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setManualModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddManual}>
                <Text style={styles.saveBtnText}>Registrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Nova Fatura / Assinatura */}
      <Modal visible={billModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingBillId ? 'Editar Compromisso' : 'Cadastrar Recorrência'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {editingBillId
                ? 'Atualize valores, datas, categorias ou itens detalhados:'
                : 'Controle de faturas, assinaturas, salários e mensalidades:'}
            </Text>

            <View style={styles.segmentedButtons}>
              <TouchableOpacity
                style={[styles.segBtn, billType === 'INVOICE' && styles.segBtnActive]}
                onPress={() => {
                  setBillType('INVOICE');
                  setBillCategory('Cartão de Crédito');
                }}
              >
                <Text style={billType === 'INVOICE' ? styles.segBtnActiveText : styles.segBtnText}>
                  Fatura
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, billType === 'SUBSCRIPTION' && styles.segBtnActive]}
                onPress={() => {
                  setBillType('SUBSCRIPTION');
                  setBillCategory('Lazer e Streaming');
                }}
              >
                <Text style={billType === 'SUBSCRIPTION' ? styles.segBtnActiveText : styles.segBtnText}>
                  Assinatura
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, billType === 'PERIODIC_EXPENSE' && styles.segBtnExpense]}
                onPress={() => {
                  setBillType('PERIODIC_EXPENSE');
                  setBillCategory('Contas / Tributos');
                }}
              >
                <Text style={billType === 'PERIODIC_EXPENSE' ? styles.segBtnActiveText : styles.segBtnText}>
                  Despesa Fixa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, billType === 'INCOME_SALARY' && styles.segBtnIncome]}
                onPress={() => {
                  setBillType('INCOME_SALARY');
                  setBillCategory('Salário / Renda Fixa');
                }}
              >
                <Text style={billType === 'INCOME_SALARY' ? styles.segBtnActiveText : styles.segBtnText}>
                  + Salário / Renda
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nome do Compromisso</Text>
            <TextInput
              style={styles.input}
              placeholder={
                billType === 'INCOME_SALARY'
                  ? 'Ex: Salário Empresa, Pró-Labore, Renda Aluguel'
                  : billType === 'PERIODIC_EXPENSE'
                  ? 'Ex: DAS MEI, Recarga de Celular, Conta de Luz'
                  : 'Ex: Fatura Cartão Nubank, Netflix, Spotify'
              }
              placeholderTextColor="#666"
              value={billName}
              onChangeText={setBillName}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Valor Mensal (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={billType === 'INCOME_SALARY' ? 'Ex: 4500,00' : 'Ex: 259,27'}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={billAmount}
                  onChangeText={setBillAmount}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  {billType === 'INCOME_SALARY' ? 'Dia de Recebimento' : 'Dia do Vencimento'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 5"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={billDueDay}
                  onChangeText={setBillDueDay}
                />
              </View>
            </View>

            {/* Categoria estilo Nubank */}
            <Text style={styles.inputLabel}>Categoria</Text>
            <View style={styles.categoryChipsRow}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, billCategory === cat && styles.chipActive]}
                  onPress={() => setBillCategory(cat)}
                >
                  <Text style={[styles.chipText, billCategory === cat && styles.chipActiveText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Inserção de Itens / Composição da Fatura */}
            {billType === 'INVOICE' && (
              <View>
                <Text style={styles.inputLabel}>O que compõe esta fatura? (1 por linha: Nome - Valor)</Text>
                <TextInput
                  style={[styles.textArea, { height: 90 }]}
                  multiline
                  placeholder={'Mercadolivre*Mercadol - Parcela 5/12: 34,75\nAmazon - Parcela 4/12: 95,34'}
                  placeholderTextColor="#666"
                  value={billItemsRaw}
                  onChangeText={setBillItemsRaw}
                />
                <Text style={{ fontSize: 10, color: '#64748B', marginTop: 3 }}>
                  Dica: Cada item detecta automaticamente a categoria Nubank (Compras, Streaming, Restaurante, etc.)!
                </Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBillModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddBill}>
                <Text style={styles.saveBtnText}>
                  {editingBillId ? 'Atualizar Alterações' : 'Salvar Compromisso'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro e Acúmulo de Investimentos / Ativos */}
      <Modal visible={fixedIncomeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Lançamento / Acúmulo de Ativo</Text>
            <Text style={styles.modalSubtitle}>
              Acumule aportes, cotas ou atualize saldos com lucro (CDB, FII, ETF, Ações):
            </Text>

            {/* Alternância da Classe do Ativo */}
            <Text style={styles.inputLabel}>Classe do Ativo</Text>
            <View style={styles.categoryChipsRow}>
              {(['CDB', 'FII', 'ETF', 'STOCK', 'TREASURY'] as AssetClass[]).map((cls) => (
                <TouchableOpacity
                  key={cls}
                  style={[styles.chip, cdbAssetClass === cls && styles.chipActive]}
                  onPress={() => {
                    setCdbAssetClass(cls);
                    if (cls === 'CDB') {
                      setCdbName('CDB C6 Pós-Fixado Liquidez Diária');
                      setCdbTicker('CDB-C6');
                    } else if (cls === 'FII') {
                      setCdbName('Maxi Renda FII');
                      setCdbTicker('MXRF11');
                    } else if (cls === 'ETF') {
                      setCdbName('Trend Nasdaq 100 ETF');
                      setCdbTicker('NASD11');
                    } else if (cls === 'STOCK') {
                      setCdbName('Itaú Unibanco');
                      setCdbTicker('ITUB4');
                    } else if (cls === 'TREASURY') {
                      setCdbName('Tesouro Selic 2029');
                      setCdbTicker('TD-SELIC');
                    }
                  }}
                >
                  <Text style={[styles.chipText, cdbAssetClass === cls && styles.chipActiveText]}>
                    {cls === 'CDB' ? 'CDB / Renda Fixa' : cls === 'FII' ? 'FII' : cls === 'ETF' ? 'ETF' : cls === 'STOCK' ? 'Ações' : 'Tesouro'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Alternância Modo: Somar/Acumular vs Saldo Total */}
            <Text style={styles.inputLabel}>Tipo de Atualização</Text>
            <View style={styles.segmentedButtons}>
              <TouchableOpacity
                style={[styles.segBtn, cdbMode === 'ACCUMULATE' && styles.segBtnIncome]}
                onPress={() => setCdbMode('ACCUMULATE')}
              >
                <Text style={cdbMode === 'ACCUMULATE' ? styles.segBtnActiveText : styles.segBtnText}>
                  + Acumular Novo Aporte
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, cdbMode === 'OVERWRITE' && styles.segBtnActive]}
                onPress={() => setCdbMode('OVERWRITE')}
              >
                <Text style={cdbMode === 'OVERWRITE' ? styles.segBtnActiveText : styles.segBtnText}>
                  Definir Posição Total
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.2 }}>
                <Text style={styles.inputLabel}>Ticker / Código</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: CDB-C6 ou MXRF11"
                  placeholderTextColor="#666"
                  value={cdbTicker}
                  onChangeText={setCdbTicker}
                />
              </View>
              <View style={{ flex: 1.8 }}>
                <Text style={styles.inputLabel}>Nome do Ativo</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: CDB C6 Liquidez Diária"
                  placeholderTextColor="#666"
                  value={cdbName}
                  onChangeText={setCdbName}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  {['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass)
                    ? (cdbMode === 'ACCUMULATE' ? 'Valor do Aporte (R$)' : 'Saldo Bruto Total (R$)')
                    : (cdbMode === 'ACCUMULATE' ? '+ Quantidade de Cotas' : 'Total de Cotas')}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass) ? 'Ex: 500,00' : 'Ex: 10'}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={cdbAmount}
                  onChangeText={setCdbAmount}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>
                  {['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass)
                    ? 'Rentabilidade (% CDI)'
                    : 'Preço da Cota (R$)'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass) ? 'Ex: 102' : 'Ex: 10,45'}
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass) ? cdbRate : cdbProfit}
                  onChangeText={['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass) ? setCdbRate : setCdbProfit}
                />
              </View>
            </View>

            {['CDB', 'RDB', 'TREASURY', 'FIXED_INCOME'].includes(cdbAssetClass) && cdbMode === 'OVERWRITE' && (
              <View>
                <Text style={styles.inputLabel}>Lucro Acumulado (R$) - Opcional</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 49,49 (para bater valor líquido/rentabilidade)"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={cdbProfit}
                  onChangeText={setCdbProfit}
                />
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFixedIncomeModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddFixedIncome}>
                <Text style={styles.saveBtnText}>
                  {cdbMode === 'ACCUMULATE' ? 'Acumular Aporte' : 'Atualizar Posição'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Criação / Edição de Plano Financeiro (Check Goals) */}
      <Modal visible={planModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editingPlanId ? 'Editar Plano Financeiro' : 'Novo Plano & Meta'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Defina um objetivo, aporte mensal e checkpoints de acompanhamento:
            </Text>

            <Text style={styles.inputLabel}>Título da Meta</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Aquisição RTX 5070 Ti, Viagem, Reserva 6 Meses"
              placeholderTextColor="#666"
              value={planTitle}
              onChangeText={setPlanTitle}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Valor Alvo (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 8000,00"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={planTargetAmount}
                  onChangeText={setPlanTargetAmount}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Já Guardado (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 0,00"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={planSavedAmount}
                  onChangeText={setPlanSavedAmount}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Aporte Mensal (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: 2000,00"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={planMonthlyContribution}
                  onChangeText={setPlanMonthlyContribution}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Estratégia</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity
                    style={[styles.chip, { flex: 1, alignItems: 'center' }, planStrategy === 'SAVINGS' && styles.chipActive]}
                    onPress={() => setPlanStrategy('SAVINGS')}
                  >
                    <Text style={[styles.chipText, planStrategy === 'SAVINGS' && styles.chipActiveText]}>À Vista</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.chip, { flex: 1, alignItems: 'center' }, planStrategy === 'INSTALLMENTS' && styles.chipActive]}
                    onPress={() => setPlanStrategy('INSTALLMENTS')}
                  >
                    <Text style={[styles.chipText, planStrategy === 'INSTALLMENTS' && styles.chipActiveText]}>Parcelado</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={styles.inputLabel}>Observações / Estratégia de Segurança</Text>
            <TextInput
              style={[styles.input, { height: 60 }]}
              placeholder="Ex: Guardar no CDB 102% CDI sem tocar na reserva"
              placeholderTextColor="#666"
              multiline
              value={planNotes}
              onChangeText={setPlanNotes}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlanModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSavePlan}>
                <Text style={styles.saveBtnText}>
                  {editingPlanId ? 'Atualizar Plano' : 'Salvar Plano'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Configuração da API Key */}
      <Modal visible={settingsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Configuração da IA</Text>
            <Text style={styles.modalSubtitle}>
              Cole sua chave de API do Google Gemini para habilitar o agente de finanças pessoal:
            </Text>
            <Text style={styles.inputLabel}>Chave de API (Google AI Studio)</Text>
            <TextInput
              style={styles.input}
              placeholder="Cole sua API Key aqui..."
              placeholderTextColor="#666"
              secureTextEntry
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
            />
            <Text style={styles.inputLabel}>Modelo Gemini</Text>
            <TouchableOpacity
              style={styles.dropdownSelector}
              onPress={() => setModelDropdownOpen(!modelDropdownOpen)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.dropdownSelectedText}>
                  {AVAILABLE_GEMINI_MODELS.find(m => m.id === customModelInput)?.label || customModelInput || 'Selecione um modelo'}
                </Text>
                <Text style={styles.dropdownSelectedSubtext}>ID: {customModelInput}</Text>
              </View>
              {modelDropdownOpen ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </TouchableOpacity>

            {modelDropdownOpen && (
              <View style={styles.dropdownMenu}>
                <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
                  {AVAILABLE_GEMINI_MODELS.map((model) => {
                    const isSelected = customModelInput === model.id;
                    return (
                      <TouchableOpacity
                        key={model.id}
                        style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                        onPress={() => {
                          setCustomModelInput(model.id);
                          setModelDropdownOpen(false);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.dropdownItemLabel, isSelected && styles.dropdownItemLabelActive]}>
                              {model.label}
                            </Text>
                            <View style={[styles.modelBadge, model.badge === 'Novo' ? styles.modelBadgeNew : styles.modelBadgeDefault]}>
                              <Text style={styles.modelBadgeText}>{model.badge}</Text>
                            </View>
                          </View>
                          <Text style={styles.dropdownItemSub}>Endpoint: {model.id}</Text>
                        </View>
                        {isSelected && <Check size={16} color="#00C48C" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
            {savedKeyStatus && <Text style={styles.savedStatusText}>{savedKeyStatus}</Text>}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSettingsVisible(false)}>
                <Text style={styles.cancelBtnText}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveKey}>
                <Text style={styles.saveBtnText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Importação de OFX */}
      <Modal visible={ofxModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Importar Extrato OFX</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1, justifyContent: 'center' }]}
                onPress={handlePickOfxFile}
              >
                <UploadCloud size={16} color="#00C48C" />
                <Text style={styles.actionBtnText}>Selecionar Arquivo .ofx</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { borderColor: '#64748B' }]}
                onPress={() => setOfxRawText('')}
              >
                <Text style={[styles.actionBtnText, { color: '#94A3B8', marginLeft: 0 }]}>Limpar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ou cole o texto XML/OFX abaixo:</Text>
            <TextInput
              style={[styles.textArea, { height: 160 }]}
              multiline
              value={ofxRawText}
              onChangeText={setOfxRawText}
              placeholder="Cole o conteúdo do seu extrato .ofx aqui..."
              placeholderTextColor="#666"
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOfxModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleImportOfx}>
                <Text style={styles.saveBtnText}>Processar OFX</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerGreeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeMock: {
    backgroundColor: '#F59E0B22',
  },
  modeReal: {
    backgroundColor: '#10B98122',
  },
  modeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#00C48C',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  togglePill: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 2,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pillBtnActive: {
    backgroundColor: '#00C48C',
  },
  pillBtnText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  pillBtnActiveText: {
    color: '#000',
    fontWeight: '800',
  },
  iconButton: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  cardContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#0284C720',
  },
  cardActionLinkText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  cardBannerShortcut: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#38BDF844',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0284C722',
    borderWidth: 1,
    borderColor: '#38BDF866',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  bannerBadge: {
    backgroundColor: '#38BDF822',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bannerBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  netWorthCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  netWorthValue: {
    fontSize: 30,
    fontWeight: '800',
    color: '#00C48C',
    marginVertical: 8,
  },
  rowSplit: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  subCol: {
    flex: 1,
  },
  subColLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  subColValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F1F5F9',
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 12,
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  subCategoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#00C48C18',
  },
  smallAddBtnText: {
    color: '#00C48C',
    fontSize: 12,
    fontWeight: '700',
  },
  donutLegendContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  donutLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabelText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  legendValueText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCardBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#283548',
  },
  itemTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '500',
  },
  itemSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  itemAmount: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00C48C',
  },
  actionBtnText: {
    color: '#00C48C',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  txCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  txDesc: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    overflow: 'hidden',
  },
  badgeProvisional: {
    backgroundColor: '#F59E0B33',
    color: '#F59E0B',
  },
  badgeReconciled: {
    backgroundColor: '#10B98133',
    color: '#10B981',
  },
  badgeSettled: {
    backgroundColor: '#3B82F633',
    color: '#60A5FA',
  },
  categoryPill: {
    fontSize: 10,
    color: '#94A3B8',
    backgroundColor: '#334155',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  txDate: {
    color: '#64748B',
    fontSize: 11,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txNegative: {
    color: '#F87171',
  },
  txPositive: {
    color: '#00C48C',
  },
  billCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  billIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  billTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  billSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  billTypeBadge: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  billAmount: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  billActiveText: {
    color: '#00C48C',
    fontSize: 11,
    fontWeight: '700',
  },
  billPausedText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  msgUser: {
    backgroundColor: '#00C48C',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  msgAssistant: {
    backgroundColor: '#1E293B',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
  },
  msgText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    color: '#CBD5E1',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatTyping: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  chatTypingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
  },
  chatInputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    height: 42,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#00C48C',
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  labSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 14,
  },
  segmentedButtons: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    borderRadius: 8,
  },
  segBtnActive: {
    backgroundColor: '#00C48C',
  },
  segBtnExpense: {
    backgroundColor: '#EF4444',
  },
  segBtnIncome: {
    backgroundColor: '#10B981',
  },
  segBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  segBtnActiveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  textArea: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    color: '#F8FAFC',
    padding: 12,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: '#00C48C',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },
  simResult: {
    marginTop: 14,
    color: '#F1F5F9',
    fontSize: 13,
  },
  bottomNavContainer: {
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  bottomNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
  },
  navItemAnimatedWrapper: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  animatedPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 48,
    paddingRight: 14,
    gap: 6,
  },
  activeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#313438',
    borderWidth: 1,
    borderColor: '#464646',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: -1,
    top: -1,
    zIndex: 2,
  },
  activeNavText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginLeft: 2,
  },
  navCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#313438',
    borderWidth: 1,
    borderColor: '#464646',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    color: '#F8FAFC',
    marginBottom: 14,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipActive: {
    backgroundColor: '#00C48C',
    borderColor: '#00C48C',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  chipActiveText: {
    color: '#000000',
    fontWeight: '700',
  },
  dropdownSelector: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dropdownSelectedText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownSelectedSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dropdownItemActive: {
    backgroundColor: '#1E293B',
  },
  dropdownItemLabel: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '500',
  },
  dropdownItemLabelActive: {
    color: '#00C48C',
    fontWeight: '700',
  },
  dropdownItemSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  modelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  modelBadgeNew: {
    backgroundColor: 'rgba(0, 196, 140, 0.2)',
  },
  modelBadgeDefault: {
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  modelBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
  },
  savedStatusText: {
    color: '#00C48C',
    fontSize: 13,
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#00C48C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '700',
  },
  tipBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  tipText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
  },
  marketCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  marketTicker: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  marketName: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  marketRationale: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 10,
  },
  marketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  marketPrice: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  marketYield: {
    color: '#00C48C',
    fontSize: 12,
    fontWeight: '700',
  },
  // Estilos de Planos e Metas (Check Goals)
  planCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  planStrategyBadge: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 3,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00C48C',
    borderRadius: 4,
  },
  planMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  planMetaLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  planMetaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 2,
  },
  checkpointsContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  checkpointsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  checkpointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  checkpointText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  checkpointTextCompleted: {
    color: '#00C48C',
    textDecorationLine: 'line-through',
  },
  planNotesText: {
    marginTop: 8,
    fontSize: 11,
    color: '#FDE68A',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: 8,
    borderRadius: 6,
  },
  planSuggestionCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00C48C44',
  },
  planSuggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00C48C',
  },
  planSuggestionMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 8,
  },
  planSuggestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00C48C',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  planSuggestionBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
});
