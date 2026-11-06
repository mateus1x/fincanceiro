import React, { useState, useEffect, useRef } from 'react';
import { 
  Home, 
  TrendingUp, 
  Settings, 
  Mic, 
  Plus, 
  Wallet, 
  ChevronRight, 
  ChevronLeft,
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
  Trash2,
  Network,
  Calendar,
  Filter,
  Search
} from 'lucide-react';

// --- Custom Hook for Local Storage ---
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
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'investments' | 'analytics' | 'visual'
  const [showSettings, setShowSettings] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [viewDate, setViewDate] = useState(new Date());

  const changeMonth = (delta) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // --- State ---
  const [transactions, setTransactions] = useLocalStorage('fin_transactions_v3', []);
  const [investments, setInvestments] = useLocalStorage('fin_investments_v3', [
    { id: '1', name: 'Caixinha Reserva', bank: 'Nubank', amount: 0 },
    { id: '2', name: 'Viagem', bank: 'Inter', amount: 0 },
    { id: '3', name: 'Carro', bank: 'Inter', amount: 0 },
    { id: '4', name: 'Investimento', bank: 'Inter', amount: 0 }
  ]);
  const [settings, setSettings] = useLocalStorage('fin_settings_v3', {
    salary: 5000,
    voucher: 800,
    salaryAccount: 'Inter',
    voucherAccount: 'Nubank'
  });

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
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

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

  // --- IA ISOLADA PARA CAPTURA DE PARÂMETRO DA SIRI (?texto=...) ---
  // Analisa de forma totalmente independente e segura sem conflitar com a Visual IA
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const siriText = queryParams.get('texto') || queryParams.get('siri') || queryParams.get('t');
    
    if (siriText) {
      const lower = siriText.toLowerCase();
      
      // 1. Extração de valores (ex: 10, 10.50, 30 reais)
      const matchNum = lower.match(/(\d+([.,]\d+)?)/);
      const amount = matchNum ? parseFloat(matchNum[0].replace(',', '.')) : 0;

      // 2. Identificação do Banco (Nubank ou Inter)
      const account = (lower.includes('inter') || lower.includes('laranjinha')) ? 'Inter' : 'Nubank';

      // 3. Identificação do Tipo (Gasto vs Entrada/Ganho)
      const type = (lower.includes('recebi') || lower.includes('ganhei') || lower.includes('pagaram') || lower.includes('entrou')) ? 'income' : 'expense';

      // 4. Limpeza Inteligente da Descrição (Remoção avançada de preposições e ruídos da fala)
      let description = siriText
        .replace(matchNum ? matchNum[0] : '', '')
        .replace(/(gastei|comprei|paguei|recebi|ganhei|reais|real|conto|no|na|app|banco|da|do|dos|das|de|di|com|em|um|uma|pra|para|por|nubank|inter)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      description = description ? description.charAt(0).toUpperCase() + description.slice(1) : 'Gasto via Siri';

      if (amount > 0) {
        addTransaction(description, amount, account, type);
        showToast(`Siri: ${description} (${formatCurrency(amount)}) lançado no ${account}!`);
      }

      // Limpa a URL para evitar repetição ao atualizar a aba
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
    <div className="h-screen w-full bg-neutral-950 text-neutral-50 flex justify-center font-sans selection:bg-purple-500/30 overflow-hidden">
      <div className="w-full max-w-md h-full bg-neutral-950 flex flex-col relative shadow-2xl overflow-hidden">
        
        {/* Header Fixo */}
        {activeTab !== 'visual' && (
          <header className="px-5 pt-8 pb-4 flex justify-between items-center bg-neutral-950/90 backdrop-blur-md sticky top-0 z-30 shrink-0 border-b border-neutral-900">
            <div className="flex items-center gap-4">
              <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center min-w-[100px]">
                <h1 className="text-base font-bold tracking-tight text-white capitalize">
                  {viewDate.toLocaleDateString('pt-BR', { month: 'long' })}
                </h1>
                <p className="text-[10px] text-neutral-400 font-medium">{viewDate.getFullYear()}</p>
              </div>
              <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <Settings size={20} />
            </button>
          </header>
        )}

        {/* Main Content Area - Apenas este container ROLA */}
        {activeTab === 'visual' ? (
           <VisualIA 
             balances={{ total: totalBalance, nubank: nubankBalance, inter: interBalance }}
             addTransaction={addTransaction}
             showToast={showToast}
           />
        ) : (
          <main className="flex-1 overflow-y-auto px-5 pt-4 pb-28 no-scrollbar space-y-6">
            
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
                viewDate={viewDate}
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

          </main>
        )}

        {/* Bottom Navigation Fixo */}
        <nav className="absolute bottom-0 left-0 w-full bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-800 flex justify-around items-center h-20 px-1 z-30 shrink-0">
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
            <span className="text-[10px] font-medium">Extrato & Filtros</span>
          </button>
          
          {/* Bot Central (Visual IA) */}
          <div className="relative -top-6 flex-1 flex justify-center">
            <button 
              onClick={() => setActiveTab('visual')}
              className={`w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white transform hover:scale-105 active:scale-95 transition-all ${activeTab === 'visual' ? 'ring-4 ring-purple-500/30' : ''}`}
            >
              <Network size={24} strokeWidth={2.5} className="opacity-90" />
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
// VISUAL IA COMPONENT (CANVAS + VOZ)
// ==========================================

function VisualIA({ balances, addTransaction, showToast }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState([]);
  const [isListening, setIsListening] = useState(false);
  
  const stateRef = useRef({
    width: 0,
    height: 0,
    particles: [],
    floatingTexts: [],
    nodes: {
      core: { x: 0, y: 0, radius: 35, color: '#a855f7', label: 'FinIA', pulse: 0, type: 'core' },
      Nubank: { x: 0, y: 0, radius: 45, color: '#8b5cf6', label: 'Nubank', type: 'bank' },
      Inter: { x: 0, y: 0, radius: 45, color: '#f97316', label: 'Inter', type: 'bank' }
    }
  });

  const balancesRef = useRef(balances);
  const addTransactionRef = useRef(addTransaction);

  useEffect(() => {
    balancesRef.current = balances;
    addTransactionRef.current = addTransaction;
  }, [balances, addTransaction]);

  const simulateAIParse = (text) => {
    const lowerText = text.toLowerCase();
    
    const matchNumeros = lowerText.match(/(\d+([.,]\d+)?)/);
    let amount = matchNumeros ? parseFloat(matchNumeros[0].replace(',', '.')) : 0;

    let account = lowerText.includes('inter') || lowerText.includes('laranjinha') ? 'Inter' : 'Nubank';

    // Determina o TIPO com suporte a INVESTIMENTO:
    let type = 'expense';
    const isInvestment = lowerText.includes('investimento') || lowerText.includes('caixinha') || lowerText.includes('investir') || lowerText.includes('reserva');
    const isIncome = lowerText.includes('recebi') || lowerText.includes('ganhei') || lowerText.includes('pagaram') || lowerText.includes('entrou') || lowerText.includes('lucro');

    if (isInvestment) {
      type = 'investment';
    } else if (isIncome) {
      type = 'income';
    } else {
      type = 'expense';
    }

    // Sanitização e Limpeza Inteligente para extrair apenas o nome principal do item
    let description = text
        .replace(matchNumeros ? matchNumeros[0] : '', '')
        .replace(/(gastei|comprei|paguei|recebi|ganhei|reais|real|conto|no|na|da|do|dos|das|de|di|com|em|um|uma|pra|para|por|banco|nubank|inter|investir|investimento|caixinha)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    description = description.charAt(0).toUpperCase() + description.slice(1);
    if (!description) {
      description = type === 'investment' ? 'Investimento' : 'Transação via IA';
    } else if (type === 'investment' && !description.toLowerCase().startsWith('investimento')) {
      description = `Investimento ${description}`;
    }

    return { action: "add_transaction", description, amount, account, type };
  };

  const processCommand = (commandText) => {
    if (!commandText.trim()) return;

    const parsedData = simulateAIParse(commandText);
    setInput('');
    
    if (parsedData.amount <= 0) {
       setLogs(prev => [{ id: Date.now(), type: 'expense', text: `Erro: Valor não identificado.` }, ...prev]);
       return;
    }

    stateRef.current.nodes.core.pulse = 20;

    const targetNode = stateRef.current.nodes[parsedData.account];
    
    // Cores: Investimento = Branco, Gasto = Vermelho, Lucro = Verde
    let particleColor = '#ef4444'; // Gasto (vermelho)
    if (parsedData.type === 'income') particleColor = '#10b981'; // Lucro (verde)
    if (parsedData.type === 'investment') particleColor = '#ffffff'; // Investimento (branco)

    stateRef.current.particles.push({
        x: stateRef.current.nodes.core.x,
        y: stateRef.current.nodes.core.y,
        targetX: targetNode.x,
        targetY: targetNode.y,
        color: particleColor,
        data: parsedData,
        progress: 0,
        speed: 0.03
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    processCommand(input);
  };

  // Suporte a Ditado por Voz nativo
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (showToast) showToast('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      processCommand(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const updateSize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      stateRef.current.width = width;
      stateRef.current.height = height;

      const nodes = stateRef.current.nodes;
      nodes.core.x = width / 2;
      nodes.core.y = height / 2 - 40;
      
      nodes.Nubank.x = width * 0.25;
      nodes.Nubank.y = height / 2 + 60;
      
      nodes.Inter.x = width * 0.75;
      nodes.Inter.y = height / 2 + 60;
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const draw = () => {
      const { width, height, nodes, particles, floatingTexts } = stateRef.current;
      const currentBalances = balancesRef.current;
      
      ctx.clearRect(0, 0, width, height);

      ctx.beginPath();
      ctx.moveTo(nodes.core.x, nodes.core.y);
      ctx.lineTo(nodes.Nubank.x, nodes.Nubank.y);
      ctx.moveTo(nodes.core.x, nodes.core.y);
      ctx.lineTo(nodes.Inter.x, nodes.Inter.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();

      for (let i = particles.length - 1; i >= 0; i--) {
          let p = particles[i];
          p.progress += p.speed;

          let currentX = p.x + (p.targetX - p.x) * p.progress;
          let currentY = p.y + (p.targetY - p.y) * p.progress;

          ctx.beginPath();
          ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.shadowBlur = 0;

          if (p.progress >= 1) {
              // Registra como gasto normal no banco se for investimento ou expense
              const txTypeToSave = p.data.type === 'income' ? 'income' : 'expense';
              addTransactionRef.current(p.data.description, p.data.amount, p.data.account, txTypeToSave);

              let signal = '-';
              if (p.data.type === 'income') signal = '+';
              if (p.data.type === 'investment') signal = '📦';

              floatingTexts.push({
                  x: p.targetX,
                  y: p.targetY - 30,
                  text: `${signal} ${formatCurrency(p.data.amount)}`,
                  color: p.color,
                  alpha: 1
              });

              setLogs(prev => [{ 
                  id: Date.now(), 
                  type: p.data.type, 
                  text: `${p.data.description}: ${signal} ${formatCurrency(p.data.amount)} (${p.data.account})` 
              }, ...prev].slice(0, 5));

              nodes[p.data.account].pulse = 15;
              particles.splice(i, 1);
          }
      }

      Object.values(nodes).forEach(node => {
          if (node.pulse > 0) node.pulse -= 0.5;
          const currentRadius = node.radius + node.pulse;

          ctx.beginPath();
          ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#0a0a0a';
          ctx.strokeStyle = node.color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = node.pulse > 0 ? 25 : 10;
          ctx.shadowColor = node.color;
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label, node.x, node.y - (node.type === 'bank' ? 10 : 0));

          if (node.type === 'bank') {
              ctx.fillStyle = '#a3a3a3';
              ctx.font = '12px "Segoe UI", sans-serif';
              ctx.fillText(formatCurrency(currentBalances[node.label.toLowerCase()]), node.x, node.y + 12);
          }
      });

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Patrimônio: ${formatCurrency(currentBalances.total)}`, width / 2, Math.max(40, nodes.core.y - 100));

      for (let i = floatingTexts.length - 1; i >= 0; i--) {
          let ft = floatingTexts[i];
          ft.y -= 1;
          ft.alpha -= 0.02;

          if (ft.alpha <= 0) {
              floatingTexts.splice(i, 1);
              continue;
          }

          ctx.fillStyle = ft.color;
          ctx.globalAlpha = ft.alpha;
          ctx.font = 'bold 16px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.globalAlpha = 1;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="flex-1 relative w-full h-full overflow-hidden animate-in fade-in" ref={containerRef}>
      <canvas ref={canvasRef} className="absolute inset-0 z-0 bg-neutral-950" />
      
      <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none p-5 pb-24">
        <div className="text-center pt-2">
          <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
             Rede FinIA
          </h2>
          <p className="text-[11px] text-neutral-400 mt-1">Ex: "gastei 45 no ifood" | "investimento 100 viagem inter"</p>
        </div>

        <div className="flex flex-col gap-4">
           <div className="pointer-events-auto flex flex-col-reverse gap-2 max-h-32 overflow-y-auto no-scrollbar">
             {logs.map(log => {
               let badgeColor = 'bg-rose-500/10 text-rose-300 border-rose-500/20'; // Gasto
               if (log.type === 'income') badgeColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'; // Lucro
               if (log.type === 'investment') badgeColor = 'bg-white/10 text-white border-white/20'; // Investimento (Branco)

               return (
                 <div key={log.id} className={`text-[11px] font-medium px-3 py-2 rounded-xl backdrop-blur-md border animate-in slide-in-from-left-4 ${badgeColor}`}>
                   {log.text}
                 </div>
               );
             })}
           </div>

           <form onSubmit={handleSubmit} className="pointer-events-auto flex items-center gap-2 bg-neutral-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-neutral-800 focus-within:border-purple-500/50 shadow-2xl">
             <button 
               type="button"
               onClick={startListening}
               className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
               title="Falar comando"
             >
               <Mic size={18} />
             </button>

             <input 
               type="text" 
               placeholder={isListening ? "Ouvindo você..." : "Digite ou use o microfone..."}
               value={input}
               onChange={(e) => setInput(e.target.value)}
               className="flex-1 bg-transparent border-none text-white text-sm px-2 focus:outline-none placeholder:text-neutral-500"
             />
             <button 
               type="submit"
               disabled={!input.trim()}
               className="bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white p-2.5 rounded-xl transition-all"
             >
               <Send size={16} />
             </button>
           </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// DASHBOARD COMPONENT
// ==========================================

function Dashboard({ totalBalance, nubankBalance, interBalance, transactions, addTransaction, updateTransaction, deleteTransaction, showToast, viewDate }) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [account, setAccount] = useState('Nubank');
  const [txType, setTxType] = useState('expense');
  const [editingTx, setEditingTx] = useState(null);

  const monthlyTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
  });

  const monthlyIncome = monthlyTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyExpense = monthlyTx.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const monthlyFlow = monthlyIncome - monthlyExpense;

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
          <p className="text-sm font-medium text-neutral-400 mb-1">Balanço do Mês</p>
          <h2 className={`text-3xl font-bold tracking-tight ${monthlyFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {monthlyFlow > 0 ? '+' : ''}{formatCurrency(monthlyFlow)}
          </h2>
          <div className="flex gap-4 mt-4 text-xs font-medium">
            <span className="text-emerald-400 flex items-center gap-1"><ArrowUpCircle size={14}/> {formatCurrency(monthlyIncome)}</span>
            <span className="text-rose-400 flex items-center gap-1"><ArrowDownCircle size={14}/> {formatCurrency(monthlyExpense)}</span>
          </div>
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
          {monthlyTx.length === 0 ? (
            <div className="text-center py-8 text-neutral-600 text-sm bg-neutral-900/50 rounded-2xl border border-neutral-800/50">
              Nenhuma movimentação neste mês.
            </div>
          ) : (
            monthlyTx.slice(0, 5).map(tx => (
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

// ==========================================
// INVESTMENTS COMPONENT
// ==========================================

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

// ==========================================
// ANALYTICS & ADVANCED EXTRATO COMPONENT
// ==========================================

function Analytics({ transactions }) {
  // Filtros Globais e Avançados
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'all' ou índice '0' a '11'
  const [selectedYear, setSelectedYear] = useState('all');   // 'all' ou string ex '2026'
  const [filterType, setFilterType] = useState('all');       // 'all' | 'income' | 'expense' | 'investment'
  const [filterBank, setFilterBank] = useState('all');       // 'all' | 'Nubank' | 'Inter'
  const [searchTerm, setSearchTerm] = useState('');

  // Extrair anos disponíveis com base nas transações cadastradas
  const availableYears = Array.from(new Set(transactions.map(t => new Date(t.date).getFullYear()))).sort((a,b) => b-a);
  if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

  // Helper para saber se a transação é caixinha/investimento
  const isInvestmentTx = (t) => t.type === 'expense' && t.description.match(/^investimentos?\s*(.*)/i);

  // Aplicar filtros robustos
  const filteredTransactions = transactions.filter(t => {
    const txDate = new Date(t.date);
    const matchesMonth = selectedMonth === 'all' || txDate.getMonth().toString() === selectedMonth;
    const matchesYear = selectedYear === 'all' || txDate.getFullYear().toString() === selectedYear;
    
    let matchesType = true;
    if (filterType === 'income') matchesType = t.type === 'income';
    if (filterType === 'expense') matchesType = t.type === 'expense' && !isInvestmentTx(t);
    if (filterType === 'investment') matchesType = isInvestmentTx(t);

    const matchesBank = filterBank === 'all' || t.account === filterBank;
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesMonth && matchesYear && matchesType && matchesBank && matchesSearch;
  });

  // Totais do filtro atual
  const totalFilteredIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalFilteredExpense = filteredTransactions
    .filter(t => t.type === 'expense' && !isInvestmentTx(t))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalFilteredInvestment = filteredTransactions
    .filter(t => isInvestmentTx(t))
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netBalance = totalFilteredIncome - totalFilteredExpense - totalFilteredInvestment;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
      
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Extrato & Filtros Avançados</h2>
        <p className="text-xs text-neutral-400">Consulte receitas, gastos, investimentos e bancos detalhadamente.</p>
      </div>

      {/* Cards de Resumo dos Filtros Aplicados */}
      <div className="grid grid-cols-4 gap-1.5">
        <div className="bg-neutral-900 rounded-2xl p-2.5 border border-emerald-500/20">
          <p className="text-[9px] text-neutral-400 mb-0.5 truncate flex items-center gap-0.5"><ArrowUpCircle size={10} className="text-emerald-400"/> Lucros</p>
          <p className="text-xs font-bold text-emerald-400 truncate">{formatCurrency(totalFilteredIncome)}</p>
        </div>
        <div className="bg-neutral-900 rounded-2xl p-2.5 border border-rose-500/20">
          <p className="text-[9px] text-neutral-400 mb-0.5 truncate flex items-center gap-0.5"><ArrowDownCircle size={10} className="text-rose-400"/> Gastos</p>
          <p className="text-xs font-bold text-rose-400 truncate">{formatCurrency(totalFilteredExpense)}</p>
        </div>
        <div className="bg-neutral-900 rounded-2xl p-2.5 border border-white/20">
          <p className="text-[9px] text-neutral-400 mb-0.5 truncate">Investimentos</p>
          <p className="text-xs font-bold text-white truncate">{formatCurrency(totalFilteredInvestment)}</p>
        </div>
        <div className="bg-neutral-900 rounded-2xl p-2.5 border border-neutral-800">
          <p className="text-[9px] text-neutral-400 mb-0.5 truncate">Balanço</p>
          <p className={`text-xs font-bold truncate ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(netBalance)}
          </p>
        </div>
      </div>

      {/* Painel Completo de Filtros */}
      <div className="bg-neutral-900 p-4 rounded-3xl border border-neutral-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
          <Filter size={14} /> Filtros de Pesquisa
        </div>

        {/* Busca por Texto */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3 text-neutral-500" />
          <input 
            type="text" 
            placeholder="Buscar por descrição (ex: churrasco, salário)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Filtro por Mês */}
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="all">Todos os Meses</option>
            <option value="0">Janeiro</option>
            <option value="1">Fevereiro</option>
            <option value="2">Março</option>
            <option value="3">Abril</option>
            <option value="4">Maio</option>
            <option value="5">Junho</option>
            <option value="6">Julho</option>
            <option value="7">Agosto</option>
            <option value="8">Setembro</option>
            <option value="9">Outubro</option>
            <option value="10">Novembro</option>
            <option value="11">Dezembro</option>
          </select>

          {/* Filtro por Ano */}
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="all">Todos os Anos</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Filtro por Tipo */}
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="all">Todos os Tipos</option>
            <option value="income">Apenas Lucros (Entradas)</option>
            <option value="expense">Apenas Gastos</option>
            <option value="investment">Apenas Investimentos</option>
          </select>

          {/* Filtro por Banco */}
          <select 
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="all">Todos os Bancos</option>
            <option value="Nubank">Nubank</option>
            <option value="Inter">Inter</option>
          </select>
        </div>
      </div>

      {/* Lista de Resultados */}
      <div>
        <div className="flex justify-between items-center mb-3 ml-1">
          <h3 className="text-sm font-bold text-neutral-300">
            Resultados ({filteredTransactions.length})
          </h3>
        </div>

        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 text-sm bg-neutral-900 rounded-3xl border border-neutral-800">
              Nenhuma movimentação encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const isInv = isInvestmentTx(tx);
              let textColor = tx.type === 'expense' ? 'text-rose-400' : 'text-emerald-400';
              let signal = tx.type === 'expense' ? '-' : '+';
              
              if (isInv) {
                textColor = 'text-white font-bold'; // Investimento fica BRANCO
                signal = '📦 ';
              }

              return (
                <div key={tx.id} className="flex justify-between items-center p-3.5 bg-neutral-900 rounded-2xl border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.account === 'Nubank' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'}`}>
                      {tx.account === 'Nubank' ? <Wallet size={16} /> : <Building size={16} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-100">{tx.description}</p>
                      <p className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                        <Calendar size={10} /> {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} 
                        <span>•</span> 
                        <span className="uppercase text-neutral-400 font-medium">{tx.account}</span>
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm ${textColor}`}>
                    {signal}{formatCurrency(tx.amount)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}

// ==========================================
// SETTINGS MODAL COMPONENT
// ==========================================

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
              <ChevronRight size= {18} />
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
              <label className="text-xs font-medium text-neutral-500 block view-none block mb-1">Banco</label>
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
