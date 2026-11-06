import React, { useState, useEffect } from 'react';
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

// --- Custom Hook for Local Storage --

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
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
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'investments' | 'assistant' | 'analytics'
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // --- State ---
  const [transactions, setTransactions] = useLocalStorage('fin_transactions_v2', []);
  const [investments, setInvestments] = useLocalStorage('fin_investments_v2', [
    { id: '1', name: 'Caixinha Reserva', bank: 'Nubank', amount: 0 },
    { id: '2', name: 'Viagem', bank: 'Inter', amount: 0 },
    { id: '3', name: 'Carro', bank: 'Inter', amount: 0 },
    { id: '4', name: 'Investimento', bank: 'Inter', amount: 0 }
  ]);
  const [settings, setSettings] = useLocalStorage('fin_settings_v2', {
    salary: 5000,
    voucher: 800,
    salaryAccount: 'Inter',
    voucherAccount: 'Nubank'
  });
  const [chatMessages, setChatMessages] = useLocalStorage('fin_chat_messages_v2', [
    { role: 'model', text: 'Olá! Sou sua FinIA 🤖 Posso analisar seus gastos, te dar dicas de investimentos ou registrar entradas e saídas automaticamente pra você. Pode digitar ou usar o microfone!' }
  ]);

  // Função auxiliar para identificar se é investimento e pegar o nome correto
  const getCaixinhaName = (description) => {
    const match = description.match(/^investimentos?\s*(.*)/i);
    if (match) {
      const rawName = match[1].trim();
      return rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Investimento';
    }
    return null;
  };

  const addTransaction = (description, amount, account, type = 'expense') => {
    const parsedAmount = parseFloat(amount);
    const newTx = {
      id: crypto.randomUUID(),
      description,
      amount: parsedAmount,
      account,
      type,
      date: new Date().toISOString()
    };
    setTransactions(prev => [newTx, ...prev]);

    if (type === 'expense') {
      const caixinhaName = getCaixinhaName(description);
      if (caixinhaName) {
        setInvestments(prev => {
          const existing = prev.find(i => i.name.toLowerCase() === caixinhaName.toLowerCase() && i.bank === account);
          if (existing) {
            return prev.map(i => i.id === existing.id ? { ...i, amount: i.amount + parsedAmount } : i);
          } else {
            return [...prev, { id: crypto.randomUUID(), name: caixinhaName, bank: account, amount: parsedAmount }];
          }
        });
      }
    }
  };

  // --- Integração com a Siri (Lê e processa perfeitamente o parâmetro ?texto= da URL) ---
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const textoParam = queryParams.get('texto');
    
    if (textoParam) {
      const matchNumeros = textoParam.match(/(\d+([.,]\d+)?)/);
      let valor = 0;
      
      if (matchNumeros) {
        valor = parseFloat(matchNumeros[0].replace(',', '.'));
      }

      const descricao = textoParam
        .replace(matchNumeros ? matchNumeros[0] : '', '')
        .replace(/reais|real|gastei|comprei|de|por/gi, '')
        .trim();

      addTransaction(
        descricao ? descricao.charAt(0).toUpperCase() + descricao.slice(1) : 'Gasto via Siri', 
        valor || 0, 
        'Nubank', 
        'expense'
      );
      
      showToast(`Gasto via Siri registrado: ${formatCurrency(valor)}`);

      // Limpa a URL para evitar reprocessar ao atualizar a página
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // --- Derived State (Balances) ---
  const getBalance = (account) => {
    return transactions
      .filter(t => account === 'Total' || t.account === account)
      .reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);
  };

  const totalBalance = getBalance('Total');
  const nubankBalance = getBalance('Nubank');
  const interBalance = getBalance('Inter');

  // --- Actions ---
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const updateTransaction = (id, updatedData) => {
    const oldTx = transactions.find(t => t.id === id);
    if (!oldTx) return;

    setTransactions(prev => prev.map(tx => tx.id === id ? { ...tx, ...updatedData } : tx));

    setInvestments(prevInvestments => {
      let newInvestments = [...prevInvestments];

      if (oldTx.type === 'expense') {
        const oldCaixinhaName = getCaixinhaName(oldTx.description);
        if (oldCaixinhaName) {
          newInvestments = newInvestments.map(inv => {
            if (inv.name.toLowerCase() === oldCaixinhaName.toLowerCase() && inv.bank === oldTx.account) {
              return { ...inv, amount: Math.max(0, inv.amount - oldTx.amount) };
            }
            return inv;
          });
        }
      }

      const newType = updatedData.type !== undefined ? updatedData.type : oldTx.type;
      const newDesc = updatedData.description !== undefined ? updatedData.description : oldTx.description;
      const newAmount = updatedData.amount !== undefined ? updatedData.amount : oldTx.amount;
      const newAccount = updatedData.account !== undefined ? updatedData.account : oldTx.account;

      if (newType === 'expense') {
        const newCaixinhaName = getCaixinhaName(newDesc);
        if (newCaixinhaName) {
          const existingIndex = newInvestments.findIndex(i => i.name.toLowerCase() === newCaixinhaName.toLowerCase() && i.bank === newAccount);
          if (existingIndex >= 0) {
             newInvestments[existingIndex] = {
               ...newInvestments[existingIndex],
               amount: newInvestments[existingIndex].amount + newAmount
             };
          } else {
             newInvestments.push({
               id: crypto.randomUUID(),
               name: newCaixinhaName,
               bank: newAccount,
               amount: newAmount
             });
          }
        }
      }

      return newInvestments;
    });
  };

  const deleteTransaction = (id) => {
    const txToDelete = transactions.find(t => t.id === id);
    setTransactions(prev => prev.filter(tx => tx.id !== id));

    if (txToDelete && txToDelete.type === 'expense') {
      const caixinhaName = getCaixinhaName(txToDelete.description);
      if (caixinhaName) {
        setInvestments(prev => prev.map(inv => {
          if (inv.name.toLowerCase() === caixinhaName.toLowerCase() && inv.bank === txToDelete.account) {
            return { ...inv, amount: Math.max(0, inv.amount - txToDelete.amount) };
          }
          return inv;
        }));
      }
    }
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
              setInvestments={setInvestments}
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
              setInvestments={setInvestments}
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

function Dashboard({ totalBalance, nubankBalance, interBalance, transactions, addTransaction, updateTransaction, deleteTransaction, showToast }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Nubank');
  const [txType, setTxType] = useState('expense');
  const [editingTx, setEditingTx] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc || !amount) return;
    addTransaction(desc, amount, account, txType);
    
    let msg = txType === 'expense' ? 'Gasto registrado!' : 'Ganho registrado!';
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
          <h3 className="text-sm font-bold text-neutral-300">Recentes</h3>
        </div>
        
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-neutral-600 text-sm bg-neutral-900/50 rounded-2xl border border-neutral-800/50">
              Nenhuma movimentação ainda.
            </div>
          ) : (
            transactions.slice(0, 5).map(tx => (
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
          onSave={(data) => {
            updateTransaction(editingTx.id, data);
            setEditingTx(null);
            showToast('Movimentação atualizada!');
          }}
          onDelete={() => {
            deleteTransaction(editingTx.id);
            setEditingTx(null);
            showToast('Movimentação excluída!');
          }}
        />
      )}
    </div>
  );
}

function EditTransactionModal({ tx, onClose, onSave, onDelete }) {
  const [description, setDescription] = useState(tx.description);
  const [amount, setAmount] = useState(tx.amount);
  const [account, setAccount] = useState(tx.account);
  const [type, setType] = useState(tx.type);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      description,
      amount: parseFloat(amount),
      account,
      type
    });
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

function Investments({ investments, setInvestments, showToast, transactions, addTransaction }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedCaixinha, setSelectedCaixinha] = useState(null);
  const [withdrawModal, setWithdrawModal] = useState(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBank, setNewBank] = useState('Inter');

  const totalInvested = investments.reduce((acc, curr) => acc + curr.amount, 0);
  
  const investmentsByBank = investments.reduce((acc, curr) => {
    if (!acc[curr.bank]) acc[curr.bank] = [];
    acc[curr.bank].push(curr);
    return acc;
  }, {});

  const handleUpdate = (id) => {
    if (editValue === '') return;
    setInvestments(prev => prev.map(inv => 
      inv.id === id ? { ...inv, amount: parseFloat(editValue) } : inv
    ));
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = (id, name) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
    setConfirmDeleteId(null);
    showToast(`Caixinha "${name}" excluída com sucesso!`);
  };

  const handleAddCaixinha = (e) => {
    e.preventDefault();
    if (!newName) return;
    
    const newInv = {
      id: crypto.randomUUID(),
      name: newName,
      bank: newBank,
      amount: 0
    };
    
    setInvestments(prev => [...prev, newInv]);
    setNewName('');
    setShowAddForm(false);
    showToast(`Caixinha "${newName}" criada no ${newBank}!`);
  };

  const handleWithdraw = (e) => {
    e.preventDefault();
    const val = parseFloat(withdrawAmount);
    if (!withdrawModal || isNaN(val) || val <= 0) return;

    if (val > withdrawModal.amount) {
      showToast('Você não tem todo esse valor nesta caixinha!');
      return;
    }

    setInvestments(prev => prev.map(inv => 
      inv.id === withdrawModal.id ? { ...inv, amount: inv.amount - val } : inv
    ));

    addTransaction(`Resgate Caixinha: ${withdrawModal.name}`, val, withdrawModal.bank, 'income');

    showToast(`Resgatado ${formatCurrency(val)} para a conta ${withdrawModal.bank}!`);
    setWithdrawModal(null);
    setWithdrawAmount('');
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
            
            {investmentsByBank[bankName].map(inv => (
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
                {transactions.filter(t => t.description.toLowerCase().includes(selectedCaixinha.name.toLowerCase())).length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-sm bg-neutral-950 rounded-2xl border border-neutral-800">
                    Nenhuma movimentação encontrada para esta caixinha.
                  </div>
                ) : (
                  transactions
                    .filter(t => t.description.toLowerCase().includes(selectedCaixinha.name.toLowerCase()))
                    .map(tx => (
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

function Analytics({ transactions }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyTx = transactions.filter(t => {
    const txDate = new Date(t.date);
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  });

  const monthlyIncome = monthlyTx
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);
    
  const monthlyExpense = monthlyTx
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const budgetLeft = monthlyIncome - monthlyExpense;
  const percentSpent = monthlyIncome > 0 ? Math.min((monthlyExpense / monthlyIncome) * 100, 100) : 0;
  
  let progressColor = 'bg-emerald-500';
  if (percentSpent > 70) progressColor = 'bg-yellow-500';
  if (percentSpent > 90) progressColor = 'bg-rose-500';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Resumo de {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</h2>
        
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-neutral-900 rounded-2xl p-4 border border-emerald-500/20">
            <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><ArrowUpCircle size={12} className="text-emerald-400"/> Recebido</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(monthlyIncome)}</p>
          </div>
          <div className="bg-neutral-900 rounded-2xl p-4 border border-rose-500/20">
            <p className="text-xs text-neutral-400 mb-1 flex items-center gap-1"><ArrowDownCircle size={12} className="text-rose-400"/> Gasto</p>
            <p className="text-lg font-bold text-rose-400">{formatCurrency(monthlyExpense)}</p>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800 shadow-sm relative overflow-hidden">
        <h3 className="text-sm font-bold text-neutral-300 mb-4">Seu Orçamento</h3>
        
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
          <div 
            className={`h-full ${progressColor} rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        
        {monthlyIncome === 0 && (
          <p className="text-xs text-neutral-500 mt-4 text-center">
            Adicione uma receita (Entrada) para ver seu orçamento.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-neutral-300 mb-3 ml-1">Onde você gastou esse mês</h3>
        <div className="space-y-2">
          {monthlyTx.filter(t => t.type === 'expense').length === 0 ? (
            <p className="text-xs text-neutral-500 text-center py-4 bg-neutral-900 rounded-2xl">Nenhum gasto registrado este mês.</p>
          ) : (
            monthlyTx.filter(t => t.type === 'expense').map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 bg-neutral-900/50 rounded-xl border border-neutral-800">
                <span className="text-sm text-neutral-200">{tx.description}</span>
                <span className="text-sm font-bold text-rose-400">-{formatCurrency(tx.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

function SettingsModal({ settings, setSettings, onClose, onSimulateMonth }) {
  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      ></div>
      
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

function Assistant({ transactions, investments, balances, addTransaction, setInvestments, showToast, chatMessages, setChatMessages }) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = React.useRef(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Microfone não suportado neste navegador. Use o texto.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech error", event.error);
      if (event.error !== 'aborted') {
        showToast('Não consegui te ouvir direito. Tente novamente.');
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const handleSend = async (textToProcess) => {
    const text = typeof textToProcess === 'string' ? textToProcess : input;
    if (!text.trim()) return;

    const newMessages = [...chatMessages, { role: 'user', text }];
    setChatMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const systemPrompt = `Você é a FinIA, uma consultora financeira e assistente pessoal no aplicativo do usuário.
DADOS ATUAIS:
- Saldo Total: R$ ${balances.total} (Nubank: R$ ${balances.nubank} | Inter: R$ ${balances.inter})
- Caixinhas de Investimento atuais: ${JSON.stringify(investments)}
- Histórico de Transações JSON (últimas 30): ${JSON.stringify(transactions.slice(0, 30))}

SUAS FUNÇÕES:
1. ANALISAR E ACONSELHAR: Responda perguntas sobre gastos, investimentos e melhores bancos para investir.
2. ADICIONAR GASTO/ENTRADA: Se o usuário pedir para registrar um gasto ou ganho comum.
3. INVESTIR OU RESGATAR DE CAIXINHAS: Se o usuário pedir para investir em uma caixinha ou resgatar.

FORMATO DO JSON DE RESPOSTA (retorne obrigatoriamente no final se houver ação financeira):
\`\`\`json
{
  "action": "add_transaction" | "invest_caixinha" | "withdraw_caixinha",
  "description": "descrição curta",
  "amount": 50.00,
  "account": "Nubank" ou "Inter",
  "type": "expense" ou "income",
  "caixinhaName": "Nome da Caixinha (se aplicável)"
}
\`\`\`
`;

    try {
      const payload = {
        contents: newMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3
        }
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
              const cName = actionData.caixinhaName || 'Investimento';
              addTransaction(`Investimento ${cName}`, actionData.amount, actionData.account, 'expense');
              showToast(`R$ ${actionData.amount} investido na caixinha ${cName}!`);
            } 
            else if (actionData.action === 'withdraw_caixinha') {
              const cName = actionData.caixinhaName || 'Investimento';
              setInvestments(prev => prev.map(inv => {
                if (inv.name.toLowerCase() === cName.toLowerCase() && inv.bank === actionData.account) {
                  return { ...inv, amount: Math.max(0, inv.amount - actionData.amount) };
                }
                return inv;
              }));
              addTransaction(`Resgate Caixinha: ${cName}`, actionData.amount, actionData.account, 'income');
              showToast(`Resgatado R$ ${actionData.amount} da caixinha ${cName}!`);
            }

            displayText = aiResponse.replace(/```json\n[\s\S]*?\n```/, '').trim();
          } catch (err) {
            console.error('Erro ao processar JSON da IA', err);
          }
        }
        
        setChatMessages([...newMessages, { role: 'model', text: displayText }]);
      }
    } catch (error) {
      console.error('API Error:', error);
      showToast('Erro de conexão com a FinIA.');
      setChatMessages([...newMessages, { role: 'model', text: 'Puxa, tive um problema de conexão. Pode repetir?' }]);
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
        {chatMessages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-purple-600 text-white rounded-br-sm' 
                : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-sm'
            }`}>
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
          <button 
            onClick={startListening}
            className={`p-3 rounded-xl transition-all ${isListening ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
          >
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
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
