import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query } from "firebase/firestore";
import { 
  Home, 
  TrendingUp, 
  Settings, 
  Mic, 
  Plus, 
  Wallet, 
  ChevronRight, 
  X, 
  Check,
  Building,
  PiggyBank,
  Bot,
  Send,
  Loader2,
  PieChart,
  ArrowDownCircle,
  ArrowUpCircle,
  Pencil,
  Trash2
} from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBKbLyMPB9Ddvka2tnMa54lyVZH1h7NOG8",
  authDomain: "meu-financeiro-19a3b.firebaseapp.com",
  projectId: "meu-financeiro-19a3b",
  storageBucket: "meu-financeiro-19a3b.firebasestorage.app",
  messagingSenderId: "740044765257",
  appId: "1:740044765257:web:c1ac9b45c6d30abbaf2798",
  measurementId: "G-7C8YPRV4FP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Hook Local ---
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

// --- Formatter ---
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  
  const [settings, setSettings] = useLocalStorage('fin_settings_v2', {
    salary: 5000,
    voucher: 800,
    salaryAccount: 'Inter',
    voucherAccount: 'Nubank'
  });
  const [chatMessages, setChatMessages] = useLocalStorage('fin_chat_messages_v2', [
    { role: 'model', text: 'Olá! Sou sua FinIA 🤖 Posso analisar seus gastos ou registrar entradas e saídas.' }
  ]);

  // --- OUVINTES EM TEMPO REAL (FIREBASE & SIRI) ---
  useEffect(() => {
    const unsubTxs = onSnapshot(collection(db, "transactions"), (snapshot) => {
      const txData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      txData.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txData);
    });

    const unsubInvs = onSnapshot(collection(db, "investments"), (snapshot) => {
      const invData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setInvestments(invData);
    });

    const qSiri = query(collection(db, "siri_inbox"));
    const unsubSiri = onSnapshot(qSiri, (snapshot) => {
      snapshot.docChanges().forEach((change: any) => {
        if (change.type === "added") {
          const rawData = change.doc.data();
          const textoDitado = rawData.texto?.stringValue || rawData.texto || "";

          if (textoDitado) {
            const textoLower = textoDitado.toLowerCase();
            
            // 1. Identifica se é entrada (recebimento/lucro) ou saída (gasto)
            const isIncome = textoLower.includes('recebi') || 
                             textoLower.includes('ganhei') || 
                             textoLower.includes('caiu') || 
                             textoLower.includes('lucro') || 
                             textoLower.includes('entrada');

            // 2. Identifica o banco mencionado
            let banco = 'Nubank';
            if (textoLower.includes('inter')) {
              banco = 'Inter';
            } else if (textoLower.includes('nubank') || textoLower.includes('nu')) {
              banco = 'Nubank';
            }

            // 3. Extrai o valor numérico
            const matchNumeros = textoDitado.match(/(\d+([.,]\d+)?)/);
            let valor = 0;
            if (matchNumeros) valor = parseFloat(matchNumeros[0].replace(',', '.'));

            // 4. Limpeza inteligente da descrição (remove o banco, valores e palavras de comando)
            let descricao = textoDitado
              .replace(matchNumeros ? matchNumeros[0] : '', '')
              .replace(/banco\s*inter|inter|nubank|nu/gi, '')
              .replace(/reais|real|gastei|comprei|recebi|ganhei|caiu|lucro|no|na|de|por|um|uma/gi, '')
              .trim();

            if (!descricao || descricao.length < 2) {
              descricao = isIncome ? 'Recebimento via Siri' : 'Gasto via Siri';
            } else {
              descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
            }

            const tipoTx = isIncome ? 'income' : 'expense';

            addTransaction(descricao, valor || 0, banco, tipoTx);
            
            showToast(`Siri registrou em ${banco}: ${isIncome ? '+' : '-'}${formatCurrency(valor)} (${descricao})`);
            deleteDoc(doc(db, "siri_inbox", change.doc.id));
          }
        }
      });
    });

    return () => {
      unsubTxs();
      unsubInvs();
      unsubSiri();
    };
  }, []);

  const getCaixinhaName = (description: string) => {
    const match = description.match(/^investimentos?\s*(.*)/i);
    if (match) {
      const rawName = match[1].trim();
      return rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Investimento';
    }
    return null;
  };

  const addTransaction = async (description: string, amount: number, account: string, type = 'expense') => {
    const parsedAmount = parseFloat(String(amount));
    const newTx = {
      description,
      amount: parsedAmount,
      account,
      type,
      date: new Date().toISOString()
    };
    
    try {
      await addDoc(collection(db, 'transactions'), newTx);

      if (type === 'expense') {
        const caixinhaName = getCaixinhaName(description);
        if (caixinhaName) {
          const existing = investments.find((i: any) => i.name.toLowerCase() === caixinhaName.toLowerCase() && i.bank === account);
          if (existing) {
            await updateDoc(doc(db, 'investments', existing.id), { amount: existing.amount + parsedAmount });
          } else {
            await addDoc(collection(db, 'investments'), { name: caixinhaName, bank: account, amount: parsedAmount });
          }
        }
      }
    } catch (e) {
      console.error("Erro ao adicionar transação: ", e);
      showToast("Erro ao conectar com a nuvem.");
    }
  };

  const updateTransaction = async (id: string, updatedData: any) => {
    try {
      await updateDoc(doc(db, 'transactions', id), updatedData);
    } catch (e) {
      console.error("Erro ao atualizar transação: ", e);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (e) {
      console.error("Erro ao deletar transação: ", e);
    }
  };

  const getBalance = (account: string) => {
    return transactions
      .filter(t => account === 'Total' || t.account === account)
      .reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);
  };

  const totalBalance = getBalance('Total');
  const nubankBalance = getBalance('Nubank');
  const interBalance = getBalance('Inter');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const simulateMonthTurn = () => {
    addTransaction('Salário (5º Dia Útil)', settings.salary, settings.salaryAccount, 'income');
    addTransaction('Vale Alimentação (1º Dia Útil)', settings.voucher, settings.voucherAccount, 'income');
    showToast('Salário e Vale depositados com sucesso!');
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50 flex justify-center font-sans selection:bg-purple-500/30">
      <div className="w-full max-w-md bg-neutral-950 flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* Header */}
        <header className="px-5 pt-8 pb-4 flex justify-between items-center bg-neutral-950 sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Meu Controle</h1>
            <p className="text-xs text-neutral-400 font-medium">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <Settings size={20} />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 px-5 no-scrollbar space-y-6">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              totalBalance={totalBalance}
              nubankBalance={nubankBalance}
              interBalance={interBalance}
              transactions={transactions}
              addTransaction={addTransaction}
              updateTransaction={updateTransaction}
              deleteTransaction={deleteTransaction}
              showToast={showToast}
            />
          )}

          {activeTab === 'investments' && (
            <Investments 
              investments={investments} 
              db={db}
              showToast={showToast}
              transactions={transactions}
              addTransaction={addTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            <Analytics 
              transactions={transactions}
            />
          )}

          {activeTab === 'assistant' && (
            <Assistant 
              transactions={transactions}
              investments={investments}
              balances={{ total: totalBalance, nubank: nubankBalance, inter: interBalance }}
              addTransaction={addTransaction}
              db={db}
              showToast={showToast}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
            />
          )}

        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 w-full bg-neutral-900/80 backdrop-blur-md border-t border-neutral-800 flex justify-around items-center h-20 px-2 sm:px-4 z-20">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-white' : 'text-neutral-500'} flex-1`}
          >
            <Home size={22} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Início</span>
          </button>

          <button 
            onClick={() => setActiveTab('analytics')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'analytics' ? 'text-white' : 'text-neutral-500'} flex-1`}
          >
            <PieChart size={22} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Gráficos</span>
          </button>
          
          <div className="relative -top-6 flex-1 flex justify-center">
            <button 
              onClick={() => setActiveTab('assistant')}
              className={`w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white transform hover:scale-105 active:scale-95 transition-all ${activeTab === 'assistant' ? 'ring-4 ring-purple-500/30' : ''}`}
            >
              <Bot size={24} fill="currentColor" className="opacity-90" />
            </button>
          </div>

          <button 
            onClick={() => setActiveTab('investments')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'investments' ? 'text-white' : 'text-neutral-500'} flex-1`}
          >
            <TrendingUp size={22} strokeWidth={activeTab === 'investments' ? 2.5 : 2} />
            <span className="text-[10px] font-medium">Caixinhas</span>
          </button>
        </nav>

        {showSettings && (
          <SettingsModal 
            settings={settings}
            setSettings={setSettings}
            onClose={() => setShowSettings(false)}
            onSimulateMonth={simulateMonthTurn}
          />
        )}

        {toastMessage && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-neutral-800 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 z-50 animate-in fade-in slide-in-from-top-4 text-sm font-medium border border-neutral-700 w-11/12 max-w-sm">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Check size={16} />
            </div>
            <p className="flex-1">{toastMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function Dashboard({ totalBalance, nubankBalance, interBalance, transactions, addTransaction, updateTransaction, deleteTransaction, showToast }: any) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Nubank');
  const [txType, setTxType] = useState('expense');
  const [editingTx, setEditingTx] = useState<any>(null);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!desc || !amount) return;
    addTransaction(desc, Number(amount), account, txType);
    
    let msg = txType === 'expense' ? 'Gasto registrado na nuvem!' : 'Ganho registrado na nuvem!';
    if (txType === 'expense' && desc.match(/^investimentos?\s*(.*)/i)) {
      msg = `Dinheiro enviado para a Caixinha automaticamente!`;
    }
    
    setDesc('');
    setAmount('');
    showToast(msg);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-4">
        <div className="bg-neutral-900 rounded-3xl p-6 shadow-sm border border-neutral-800">
          <p className="text-sm font-medium text-neutral-400 mb-1">Saldo Geral</p>
          <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totalBalance)}</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full"></div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center text-white font-bold text-xs">N</div>
              <span className="text-xs font-semibold text-neutral-300">Nubank</span>
            </div>
            <p className="text-lg font-bold z-10">{formatCurrency(nubankBalance)}</p>
          </div>
          
          <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 flex flex-col justify-between h-28 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full"></div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center text-white font-bold text-xs">I</div>
              <span className="text-xs font-semibold text-neutral-300">Inter</span>
            </div>
            <p className="text-lg font-bold z-10">{formatCurrency(interBalance)}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex justify-between items-end mb-3 ml-1">
          <h3 className="text-sm font-bold text-neutral-300">Nova Movimentação</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-neutral-900 rounded-3xl p-5 border border-neutral-800 space-y-4 shadow-sm relative overflow-hidden">
          <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800">
            <button 
              type="button"
              onClick={() => setTxType('expense')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${txType === 'expense' ? 'bg-rose-500/20 text-rose-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <ArrowDownCircle size={16} /> Saída
            </button>
            <button 
              type="button"
              onClick={() => setTxType('income')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${txType === 'income' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              <ArrowUpCircle size={16} /> Entrada
            </button>
          </div>

          <div>
            <input 
              type="text" 
              placeholder={txType === 'expense' ? "O que você comprou?" : "De onde veio o dinheiro?"}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full bg-transparent border-b border-neutral-700 px-1 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-purple-500 transition-colors text-lg"
              required
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className={`absolute left-1 top-3 font-medium ${txType === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>R$</span>
              <input 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-full bg-transparent border-b border-neutral-700 pl-8 pr-1 py-3 placeholder:text-neutral-600 focus:outline-none focus:border-purple-500 transition-colors text-lg font-medium ${txType === 'expense' ? 'text-rose-100' : 'text-emerald-100'}`}
                required
              />
            </div>
            
            <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800">
              <button 
                type="button"
                onClick={() => setAccount('Nubank')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${account === 'Nubank' ? 'bg-purple-600 text-white shadow-sm' : 'text-neutral-500'}`}
              >
                Nu
              </button>
              <button 
                type="button"
                onClick={() => setAccount('Inter')}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${account === 'Inter' ? 'bg-orange-500 text-white shadow-sm' : 'text-neutral-500'}`}
              >
                Inter
              </button>
            </div>
          </div>

          <button 
            type="submit"
            className={`w-full font-bold py-3.5 rounded-xl transition-colors active:scale-[0.98] ${txType === 'expense' ? 'bg-rose-500 hover:bg-rose-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950'}`}
          >
            {txType === 'expense' ? 'Registrar Gasto' : 'Registrar Receita'}
          </button>
        </form>
      </section>

      <section className="pb-4">
        <div className="flex justify-between items-center mb-4 ml-1">
          <h3 className="text-sm font-bold text-neutral-300">Recentes da Nuvem</h3>
        </div>
        
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-neutral-600 text-sm bg-neutral-900/50 rounded-2xl border border-neutral-800/50">
              Nenhuma movimentação no Firebase ainda.
            </div>
          ) : (
            transactions.slice(0, 5).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-neutral-900 rounded-2xl border border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.account === 'Nubank' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'}`}>
                    {tx.account === 'Nubank' ? <Wallet size={18} /> : <Building size={18} />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-neutral-100 truncate max-w-[150px]">{tx.description}</p>
                    <p className="text-[10px] text-neutral-500 uppercase font-medium">{tx.account}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.type === 'expense' ? 'text-white' : 'text-emerald-400'}`}>
                      {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <button 
                    onClick={() => setEditingTx(tx)}
                    className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {editingTx && (
        <EditTransactionModal 
          tx={editingTx}
          onClose={() => setEditingTx(null)}
          onSave={(data: any) => {
            updateTransaction(editingTx.id, data);
            setEditingTx(null);
            showToast('Movimentação atualizada na nuvem!');
          }}
          onDelete={() => {
            deleteTransaction(editingTx.id);
            setEditingTx(null);
            showToast('Movimentação excluída da nuvem!');
          }}
        />
      )}
    </div>
  );
}

function EditTransactionModal({ tx, onClose, onSave, onDelete }: any) {
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(tx.amount);
  const [account, setAccount] = useState(tx.account);
  const [type, setType] = useState(tx.type);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSave({ description, amount: parseFloat(amount), account, type });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-neutral-900 w-full rounded-t-[32px] p-6 pb-10 shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300">
        <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto mb-6"></div>
        
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Editar Movimentação</h3>
          <button onClick={onClose} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-neutral-950 rounded-xl p-1 border border-neutral-800">
            <button 
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'expense' ? 'bg-rose-500/20 text-rose-400' : 'text-neutral-500'}`}
            >
              Saída (Gasto)
            </button>
            <button 
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500'}`}
            >
              Entrada (Ganho)
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-500 block mb-1">Descrição</label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-500 block mb-1">Valor (R$)</label>
              <input 
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 block mb-1">Banco</label>
              <select 
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="Nubank">Nubank</option>
                <option value="Inter">Inter</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="submit"
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl transition-all"
            >
              Salvar Alterações
            </button>
            <button 
              type="button"
              onClick={onDelete}
              className="px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-colors border border-rose-500/20 flex items-center justify-center"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Investments({ investments, db, showToast, transactions, addTransaction }: any) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedCaixinha, setSelectedCaixinha] = useState<any>(null);
  const [withdrawModal, setWithdrawModal] = useState<any>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBank, setNewBank] = useState('Inter');

  const totalInvested = investments.reduce((acc: number, curr: any) => acc + curr.amount, 0);
  
  const investmentsByBank = investments.reduce((acc: any, curr: any) => {
    if (!acc[curr.bank]) acc[curr.bank] = [];
    acc[curr.bank].push(curr);
    return acc;
  }, {});

  const handleUpdate = async (id: string) => {
    if (editValue === '') return;
    try {
      await updateDoc(doc(db, 'investments', id), { amount: parseFloat(editValue) });
      setEditingId(null);
      setEditValue('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteDoc(doc(db, 'investments', id));
      setConfirmDeleteId(null);
      showToast(`Caixinha "${name}" excluída com sucesso!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCaixinha = async (e: any) => {
    e.preventDefault();
    if (!newName) return;
    
    try {
      await addDoc(collection(db, 'investments'), {
        name: newName,
        bank: newBank,
        amount: 0
      });
      setNewName('');
      setShowAddForm(false);
      showToast(`Caixinha "${newName}" criada no ${newBank}!`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleWithdraw = async (e: any) => {
    e.preventDefault();
    const val = parseFloat(withdrawAmount);
    if (!withdrawModal || isNaN(val) || val <= 0) return;

    if (val > withdrawModal.amount) {
      showToast('Você não tem todo esse valor nesta caixinha!');
      return;
    }

    try {
      await updateDoc(doc(db, 'investments', withdrawModal.id), { amount: withdrawModal.amount - val });
      addTransaction(`Resgate Caixinha: ${withdrawModal.name}`, val, withdrawModal.bank, 'income');
      showToast(`Resgatado ${formatCurrency(val)} para a conta ${withdrawModal.bank}!`);
      setWithdrawModal(null);
      setWithdrawAmount('');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      
      <div className="bg-gradient-to-br from-emerald-900/40 to-neutral-900 rounded-3xl p-6 border border-emerald-500/20">
        <div className="flex items-center gap-2 mb-2">
          <PiggyBank size={18} className="text-emerald-400" />
          <p className="text-sm font-medium text-emerald-400/80">Patrimônio Investido</p>
        </div>
        <h2 className="text-3xl font-bold tracking-tight">{formatCurrency(totalInvested)}</h2>
      </div>

      <div className="space-y-6">
        {Object.keys(investmentsByBank).map(bankName => (
          <div key={bankName} className="space-y-3">
            <h3 className={`text-sm font-bold ml-1 flex items-center gap-2 ${bankName === 'Nubank' ? 'text-purple-400' : 'text-orange-400'}`}>
              <Building size={16} /> Caixinhas - {bankName}
            </h3>
            
            {investmentsByBank[bankName].map((inv: any) => (
              <div 
                key={inv.id} 
                className={`bg-neutral-900 rounded-2xl p-4 border ${bankName === 'Nubank' ? 'border-purple-500/20' : 'border-orange-500/20'} transition-all`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="cursor-pointer flex-1" onClick={() => setSelectedCaixinha(inv)}>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-neutral-100">{inv.name}</p>
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        Ver histórico <ChevronRight size={10} />
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 uppercase mt-0.5">Saldo atual</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-white">{formatCurrency(inv.amount)}</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-neutral-800/60">
                  <button 
                    onClick={() => setWithdrawModal(inv)}
                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2 rounded-xl text-xs font-semibold transition-colors border border-emerald-500/20 flex items-center justify-center gap-1"
                  >
                    Resgatar Dinheiro
                  </button>
                  <button 
                    onClick={() => { setEditingId(inv.id); setEditValue(inv.amount); }}
                    className="px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded-xl text-xs font-medium transition-colors"
                  >
                    Ajustar
                  </button>
                  <button 
                    onClick={() => setConfirmDeleteId(inv.id)}
                    className="px-3 bg-neutral-800 hover:bg-rose-500/10 text-neutral-500 hover:text-rose-400 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {editingId === inv.id && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-800">
                    <input 
                      type="number"
                      step="0.01"
                      autoFocus
                      placeholder="Novo saldo total"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button 
                      onClick={() => handleUpdate(inv.id)}
                      className="bg-emerald-500 text-neutral-950 px-4 py-2 rounded-xl text-sm font-bold"
                    >
                      Salvar
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      className="p-2 text-neutral-400"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}

                {confirmDeleteId === inv.id && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-800">
                    <button 
                      onClick={() => handleDelete(inv.id, inv.name)}
                      className="flex-1 bg-rose-500/20 text-rose-400 py-2 rounded-xl text-xs font-bold transition-colors border border-rose-500/20"
                    >
                      Sim, excluir caixinha
                    </button>
                    <button 
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 bg-neutral-800 text-neutral-300 py-2 rounded-xl text-xs font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {selectedCaixinha && (
          <div className="absolute inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCaixinha(null)}></div>
            <div className="bg-neutral-900 w-full rounded-t-[32px] p-6 pb-10 shadow-2xl relative z-10 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto mb-6"></div>
              
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Histórico: {selectedCaixinha.name}</h3>
                  <p className="text-xs text-neutral-400">Banco {selectedCaixinha.bank} • Saldo atual: {formatCurrency(selectedCaixinha.amount)}</p>
                </div>
                <button onClick={() => setSelectedCaixinha(null)} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 mt-4">
                {transactions.filter((t: any) => t.description.toLowerCase().includes(selectedCaixinha.name.toLowerCase())).length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-sm bg-neutral-950 rounded-2xl border border-neutral-800">
                    Nenhuma movimentação encontrada para esta caixinha.
                  </div>
                ) : (
                  transactions
                    .filter((t: any) => t.description.toLowerCase().includes(selectedCaixinha.name.toLowerCase()))
                    .map((tx: any) => (
                      <div key={tx.id} className="flex justify-between items-center p-3 bg-neutral-950 rounded-xl border border-neutral-800">
                        <div>
                          <p className="text-sm font-medium text-white">{tx.description}</p>
                          <p className="text-[10px] text-neutral-500">{new Date(tx.date).toLocaleDateString('pt-BR')} • {tx.account}</p>
                        </div>
                        <span className="text-sm font-bold text-emerald-400">+{formatCurrency(tx.amount)}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {withdrawModal && (
          <div className="absolute inset-0 z-50 flex items-end justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setWithdrawModal(null)}></div>
            <div className="bg-neutral-900 w-full rounded-t-[32px] p-6 pb-10 shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300">
              <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto mb-6"></div>
              
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Resgatar da Caixinha "{withdrawModal.name}"</h3>
                <button onClick={() => setWithdrawModal(null)} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-neutral-400 mb-4">
                Disponível para resgate: <span className="text-emerald-400 font-bold">{formatCurrency(withdrawModal.amount)}</span>
                <br />O valor será depositado de volta no saldo da sua conta {withdrawModal.bank}.
              </p>

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 block mb-1">Quanto deseja retirar? (R$)</label>
                  <input 
                    type="number"
                    step="0.01"
                    autoFocus
                    placeholder="0,00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-lg font-medium focus:outline-none focus:border-emerald-500"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-3.5 rounded-xl transition-all"
                >
                  Confirmar Resgate
                </button>
              </form>
            </div>
          </div>
        )}

        {showAddForm ? (
          <form onSubmit={handleAddCaixinha} className="bg-neutral-900 rounded-2xl p-4 border border-dashed border-neutral-600 space-y-4 animate-in fade-in">
            <h4 className="text-sm font-bold text-white mb-2">Criar nova caixinha</h4>
            
            <input 
              type="text" 
              placeholder="Nome (ex: Reserva de Emergência)" 
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              required
            />
            
            <select 
              value={newBank}
              onChange={(e) => setNewBank(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="Inter">Banco Inter</option>
              <option value="Nubank">Nubank</option>
            </select>
            
            <div className="flex gap-2 pt-2">
              <button 
                type="submit"
                className="flex-1 bg-white text-neutral-950 font-bold py-2.5 rounded-xl text-sm"
              >
                Criar
              </button>
              <button 
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 text-white font-medium text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button 
            onClick={() => setShowAddForm(true)}
            className="w-full border border-dashed border-neutral-700 bg-neutral-900/30 text-neutral-400 hover:text-neutral-200 py-4 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition-colors mt-4"
          >
            <Plus size={16} /> Nova Caixinha/Investimento
          </button>
        )}
      </div>
    </div>
  );
}

function Analytics({ transactions }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const monthlyTx = transactions.filter((t: any) => {
    const txDate = new Date(t.date);
    return txDate.getMonth() === currentDate.getMonth() && txDate.getFullYear() === currentDate.getFullYear();
  });

  const monthlyIncome = monthlyTx.filter((t: any) => t.type === 'income').reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const monthlyExpense = monthlyTx.filter((t: any) => t.type === 'expense').reduce((acc: number, curr: any) => acc + curr.amount, 0);
  const budgetLeft = monthlyIncome - monthlyExpense;
  const percentSpent = monthlyIncome > 0 ? Math.min((monthlyExpense / monthlyIncome) * 100, 100) : 0;
  
  let progressColor = 'bg-emerald-500';
  if (percentSpent > 70) progressColor = 'bg-yellow-500';
  if (percentSpent > 90) progressColor = 'bg-rose-500';

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      <div className="flex items-center justify-between bg-neutral-900 p-2 rounded-2xl border border-neutral-800">
        <button onClick={prevMonth} className="p-2 text-neutral-400 hover:text-white bg-neutral-950 rounded-xl"><ChevronRight size={18} className="rotate-180" /></button>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">{monthName}</h2>
        <button onClick={nextMonth} className="p-2 text-neutral-400 hover:text-white bg-neutral-950 rounded-xl"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-neutral-900 rounded-2xl p-4 border border-emerald-500/20">
          <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><ArrowUpCircle size={12} className="text-emerald-400"/> Entradas</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(monthlyIncome)}</p>
        </div>
        <div className="bg-neutral-900 rounded-2xl p-4 border border-rose-500/20">
          <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><ArrowDownCircle size={12} className="text-rose-400"/> Saídas</p>
          <p className="text-lg font-bold text-rose-400">{formatCurrency(monthlyExpense)}</p>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 shadow-sm relative overflow-hidden">
        <h3 className="text-sm font-bold text-neutral-300 mb-4">Seu Orçamento do Mês</h3>
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[10px] text-neutral-500 uppercase font-medium">Livre para gastar</p>
            <p className={`text-2xl font-bold tracking-tight ${budgetLeft < 0 ? 'text-rose-500' : 'text-white'}`}>
              {formatCurrency(budgetLeft)}
            </p>
          </div>
          <p className="text-sm font-bold text-neutral-400">{percentSpent.toFixed(0)}% gasto</p>
        </div>

        <div className="h-4 w-full bg-neutral-950 rounded-full overflow-hidden mt-4 border border-neutral-800">
          <div className={`h-full ${progressColor} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percentSpent}%` }} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-neutral-300 mb-3 ml-1">Extrato do Mês</h3>
        <div className="space-y-2">
          {monthlyTx.length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-4 bg-neutral-900 rounded-2xl">Nenhuma movimentação neste mês.</p>
          ) : (
            monthlyTx.map((tx: any) => (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
                <div>
                  <span className="text-sm font-medium text-neutral-200 block">{tx.description}</span>
                  <span className="text-[10px] text-neutral-500">{new Date(tx.date).toLocaleDateString('pt-BR')} • {tx.account}</span>
                </div>
                <span className={`text-sm font-bold ${tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ settings, setSettings, onClose, onSimulateMonth }: any) {
  const handleChange = (field: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose}></div>
      <div className="bg-neutral-900 w-full rounded-t-[32px] p-6 pb-10 shadow-2xl relative z-10 animate-in slide-in-from-bottom-full duration-300 max-h-[85vh] overflow-y-auto">
        <div className="w-12 h-1.5 bg-neutral-800 rounded-full mx-auto mb-6"></div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Configurações</h2>
          <button onClick={onClose} className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center text-neutral-400">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-4 bg-neutral-950 p-4 rounded-2xl border border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-2">Rendas Mensais Fixas</h3>
            <div>
              <label className="text-xs font-medium text-neutral-500 block mb-1">Salário (Cai no 5º dia útil)</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={settings.salary}
                  onChange={(e) => handleChange('salary', Number(e.target.value))}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-600"
                />
                <select 
                  value={settings.salaryAccount}
                  onChange={(e) => handleChange('salaryAccount', e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                >
                  <option value="Nubank">Nubank</option>
                  <option value="Inter">Inter</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 block mb-1">Vale Alimentação/Refeição (1º dia útil)</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={settings.voucher}
                  onChange={(e) => handleChange('voucher', Number(e.target.value))}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-600"
                />
                <select 
                  value={settings.voucherAccount}
                  onChange={(e) => handleChange('voucherAccount', e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                >
                  <option value="Nubank">Nubank</option>
                  <option value="Inter">Inter</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <button 
              onClick={onSimulateMonth}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Simular Virada de Mês 
              <ChevronRight size={18} />
            </button>
            <p className="text-center text-[10px] text-neutral-500 mt-3 px-4">
              Isto vai depositar automaticamente o Salário e o Vale nas contas configuradas acima.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Assistant({ transactions, investments, balances, addTransaction, db, showToast, chatMessages, setChatMessages }: any) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = React.useRef<any>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Microfone não suportado neste navegador.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => handleSend(event.results[0][0].transcript);
    recognition.onerror = () => { setIsListening(false); showToast('Não entendi, tente novamente.'); };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const handleSend = async (textToProcess?: string) => {
    const text = typeof textToProcess === 'string' ? textToProcess : input;
    if (!text.trim()) return;

    const newMessages = [...chatMessages, { role: 'user', text }];
    setChatMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const systemPrompt = `Você é a FinIA, uma assistente financeira no app.
DADOS ATUAIS:
- Saldo Total: R$ ${balances.total} (Nubank: R$ ${balances.nubank} | Inter: R$ ${balances.inter})
- Caixinhas atuais: ${JSON.stringify(investments)}

FORMATO DO JSON DE RESPOSTA OBRIGATÓRIO (se houver ação):
\`\`\`json
{
  "action": "add_transaction" | "invest_caixinha" | "withdraw_caixinha",
  "description": "descrição",
  "amount": 50.00,
  "account": "Nubank" ou "Inter",
  "type": "expense" ou "income",
  "caixinhaName": "Nome da Caixinha"
}
\`\`\`
`;

    try {
      const payload = {
        contents: newMessages.map((m: any) => ({ role: m.role, parts: [{ text: m.text }] })),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.3 }
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=SUA_CHAVE`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (aiResponse) {
        let displayText = aiResponse;
        const jsonMatch = aiResponse.match(/```json\n([\s\S]*?)\n```/);
        
        if (jsonMatch) {
          try {
            const actionData = JSON.parse(jsonMatch[1]);
            
            if (actionData.action === 'add_transaction') {
              addTransaction(actionData.description, actionData.amount, actionData.account, actionData.type);
              showToast(`${actionData.type === 'expense' ? 'Gasto' : 'Ganho'} adicionado!`);
            } 
            else if (actionData.action === 'invest_caixinha') {
              addTransaction(`Investimento ${actionData.caixinhaName || 'Investimento'}`, actionData.amount, actionData.account, 'expense');
            } 
            else if (actionData.action === 'withdraw_caixinha') {
              const cName = actionData.caixinhaName || 'Investimento';
              const inv = investments.find((i: any) => i.name.toLowerCase() === cName.toLowerCase() && i.bank === actionData.account);
              if (inv) {
                await updateDoc(doc(db, 'investments', inv.id), { amount: Math.max(0, inv.amount - actionData.amount) });
                addTransaction(`Resgate Caixinha: ${cName}`, actionData.amount, actionData.account, 'income');
              }
            }
            displayText = aiResponse.replace(/```json\n[\s\S]*?\n```/, '').trim();
          } catch (err) {}
        }
        
        setChatMessages([...newMessages, { role: 'model', text: displayText }]);
      }
    } catch (error) {
      showToast('Erro de conexão com a FinIA.');
      setChatMessages([...newMessages, { role: 'model', text: 'Tive um problema de conexão. Pode repetir?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 rounded-3xl p-5 border border-purple-500/20 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
            <Bot size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">FinIA</h2>
            <p className="text-xs text-purple-300/70">Conselheira Financeira & Siri</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
        {chatMessages.map((msg: any, idx: number) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={16} className="text-purple-500 animate-spin" />
              <span className="text-sm text-neutral-400">Analisando...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="pt-2 shrink-0 relative">
        {isListening && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-full animate-pulse shadow-lg shadow-purple-500/30 flex items-center gap-2">
            <Mic size={14} className="animate-bounce" /> Ouvindo você...
          </div>
        )}
        <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-800 focus-within:border-purple-500 transition-colors">
          <button onClick={startListening} className={`p-3 rounded-xl transition-all ${isListening ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}>
            <Mic size={20} />
          </button>
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite ou fale seu gasto..."
            className="flex-1 bg-transparent border-none focus:outline-none text-sm px-2 text-white placeholder:text-neutral-600"
            disabled={isLoading || isListening}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl transition-colors">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
