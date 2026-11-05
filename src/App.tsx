import React, { useState, useEffect } from 'react';

interface Gasto {
  id: string;
  descricao: string;
  valor: number;
  data: string;
}

export default function App() {
  const [gastos, setGastos] = useState<Gasto[]>(() => {
    const salvo = localStorage.getItem('meus_gastos');
    return salvo ? JSON.parse(salvo) : [];
  });

  // Lógica para capturar requisições externas ou parâmetros via URL (vindos do atalho)
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const textoParam = queryParams.get('texto');
    
    if (textoParam) {
      processarTextoGasto(textoParam);
    }
  }, []);

  const processarTextoGasto = (bruto: string) => {
    // Tenta extrair o valor numérico da frase (ex: "2", "45,50")
    const numeros = bruto.match(/\d+([.,]\d+)?/);
    const valor = numeros ? parseFloat(numeros[0].replace(',', '.')) : 0;
    const descricao = bruto.replace(numeros ? numeros[0] : '', '').replace(/reais|real|gastei|comprei|de/gi, '').trim();

    const novoGasto: Gasto = {
      id: Date.now().toString(),
      descricao: descricao || 'Gasto via Siri',
      valor: valor || 0,
      data: new Date().toLocaleDateString('pt-BR')
    };

    setGastos(prev => {
      const atualizado = [novoGasto, ...prev];
      localStorage.setItem('meus_gastos', JSON.stringify(atualizado));
      return atualizado;
    });
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Controle Financeiro 📊</h1>
      <p>Integrado com a Siri do iPhone 🚀</p>

      <div style={{ background: '#f4f4f4', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <h3>Últimos Registos</h3>
        {gastos.length === 0 ? (
          <p>Ainda sem gastos registados. Tenta usar a Siri!</p>
        ) : (
          ulList(gastos)
        )}
      </div>
    </div>
  );
}

function ulList(gastos: any[]) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {gastos.map(g => (
        <li key={g.id} style={{ background: '#fff', padding: '10px', margin: '5px 0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
          <span>{g.descricao}</span>
          <strong>R$ {g.valor.toFixed(2)}</strong>
        </li>
      ))}
    </ul>
  );
}
