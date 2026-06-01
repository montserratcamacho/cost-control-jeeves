import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Filter, X, Calendar } from 'lucide-react';
import Select from 'react-select';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

// Mapeo de categorías inteligentes
const SMART_CATEGORIES = {
  'Comida': ['Restaurant', 'Fast Food', 'Grocery', 'Bakeries', 'Dining'],
  'Digital': ['Software', 'Cloud', 'Digital Goods', 'Advertising', 'Computer'],
  'Transporte': ['Taxi', 'Uber', 'Gasoline', 'Parking', 'Toll', 'Automotive'],
  'Viajes': ['Hotel', 'Airline', 'Travel', 'Lodging']
};

function getSmartCategory(jeevesCat) {
  for (const [smart, keywords] of Object.entries(SMART_CATEGORIES)) {
    if (keywords.some(k => jeevesCat?.toLowerCase().includes(k.toLowerCase()))) {
      return smart;
    }
  }
  return 'Otros';
}

export default function Dashboard({ data }) {
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterPO, setFilterPO] = useState(null);

  const stats = useMemo(() => {
    const byInternalType = {};
    const byJeevesCategory = {};
    const bySmartCategory = { 'Comida': 0, 'Digital': 0, 'Transporte': 0, 'Viajes': 0, 'Otros': 0 };
    const byPO = {};
    const byMonth = {};
    let totalSpend = 0;
    
    const transactions = data?.transactions || [];

    const uniqueUsers = [...new Set(transactions.map(t => t.user_name).filter(Boolean))].sort();
    const allPOs = data?.projects || [];
    const uniquePOsFromData = [...new Set(allPOs.map(po => po.id))].sort((a,b) => parseInt(b) - parseInt(a));

    transactions.forEach(t => {
      const amount = t.amount_destination || 0;
      const dateFull = t.created_at_utc || t.posted_at_utc;
      const date = dateFull?.substring(0, 10) || "";
      const month = dateFull ? dateFull.substring(0, 7) : 'Sin fecha';

      // Filtros
      if (dateStart && date < dateStart) return;
      if (dateEnd && date > dateEnd) return;
      if (filterUser && t.user_name !== filterUser) return;
      if (filterPO && t.po_id !== filterPO.value) return;

      totalSpend += amount;
      
      // Agrupaciones
      const intType = t.tipo_gasto_interno || 'Sin clasificar';
      byInternalType[intType] = (byInternalType[intType] || 0) + amount;

      const jeevesCat = t.jeeves_category || 'Other';
      byJeevesCategory[jeevesCat] = (byJeevesCategory[jeevesCat] || 0) + amount;

      const smart = getSmartCategory(jeevesCat);
      bySmartCategory[smart] = (bySmartCategory[smart] || 0) + amount;

      const po = t.po_id || 'Sin PO';
      byPO[po] = (byPO[po] || 0) + amount;

      if (month !== 'Sin fecha') {
        byMonth[month] = (byMonth[month] || 0) + amount;
      }
    });

    return { 
      totalSpend, 
      totalTxns: transactions.length, 
      byInternalType, 
      byJeevesCategory, 
      bySmartCategory,
      byPO,
      byMonth,
      uniqueUsers,
      uniquePOs: uniquePOsFromData
    };
  }, [data, dateStart, dateEnd, filterUser, filterPO]);

  const smartData = {
    labels: Object.keys(stats.bySmartCategory),
    datasets: [{
      data: Object.values(stats.bySmartCategory),
      backgroundColor: ['#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#94a3b8'],
    }]
  };

  const poData = {
    labels: Object.keys(stats.byPO),
    datasets: [{
      label: 'Gasto por PO',
      data: Object.values(stats.byPO),
      backgroundColor: '#6366f1',
    }]
  };

  const trendData = {
    labels: Object.keys(stats.byMonth).sort(),
    datasets: [{
      label: 'Gasto Mensual',
      data: Object.keys(stats.byMonth).sort().map(m => stats.byMonth[m]),
      borderColor: '#0ea5e9',
      tension: 0.3,
      fill: true,
      backgroundColor: 'rgba(14, 165, 233, 0.1)'
    }]
  };

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Dashboard General</h1>
        
        <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} />
            <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="filter-select" style={{ width: '130px' }} />
            <span>a</span>
            <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="filter-select" style={{ width: '130px' }} />
          </div>
          
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="filter-select">
            <option value="">Todos los usuarios</option>
            {stats.uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>

          <div style={{ minWidth: '200px' }}>
            <Select
              options={data?.projects?.map(p => ({ value: p.id, label: p.nombre })) || []}
              onChange={(selectedOption) => setFilterPO(selectedOption ? selectedOption.value : null)}
              value={filterPO ? { value: filterPO, label: data?.projects?.find(p => p.id === filterPO)?.nombre || '' } : null}
              placeholder="Todas las POs"
              isClearable
              isSearchable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '32px',
                  height: '32px',
                  fontSize: '0.875rem',
                }),
                valueContainer: (base) => ({
                  ...base,
                  height: '30px',
                  padding: '0 8px',
                }),
                input: (base) => ({
                  ...base,
                  margin: '0px',
                }),
                indicatorsContainer: (base) => ({
                  ...base,
                  height: '30px',
                }),
              }}
            />
          </div>

          {(dateStart || dateEnd || filterUser || filterPO) && (
            <button onClick={() => { setDateStart(''); setDateEnd(''); setFilterUser(''); setFilterPO(''); }} className="btn-secondary" style={{ padding: '4px 8px' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Gasto Total</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0 0 0' }}>${stats.totalSpend.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Transacciones</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '10px 0 0 0' }}>{stats.totalTxns}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
        <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
          <h3>Categorización Inteligente</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ maxWidth: '250px', flex: 1 }}>
              <Doughnut data={smartData} options={{ plugins: { legend: { display: false } } }} />
            </div>
            <div style={{ flex: 1 }}>
              <table style={{ width: '100%', fontSize: '12px' }}>
                <tbody>
                  {Object.entries(stats.bySmartCategory)
                    .sort((a,b) => b[1] - a[1])
                    .map(([cat, amount]) => (
                      <tr key={cat}>
                        <td style={{ padding: '4px 0' }}>{cat}</td>
                        <td style={{ padding: '8px', fontWeight: 'bold' }}>${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop: '15px', fontSize: '12px', color: '#64748b' }}>
            * Categorías automáticas basadas en el comercio y tipo de gasto.
          </div>
        </div>
        
        <div className="card" style={{ background: '#fff', padding: '20px', borderRadius: '12px' }}>
          <h3>Gasto por PO</h3>
          <div style={{ height: '400px' }}>
            <Bar data={poData} options={{ 
              indexAxis: 'y', 
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              }
            }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px', background: '#fff', padding: '20px', borderRadius: '12px' }}>
        <h3>Tendencia Mensual (Respeta Filtros)</h3>
        <Line data={trendData} />
      </div>

      <div className="card" style={{ marginTop: '24px', background: '#fff', padding: '20px', borderRadius: '12px' }}>
        <h3>Resumen por PO</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '10px' }}>ID PO</th>
              <th>Monto Total</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.byPO).map(([po, amount]) => (
              <tr key={po} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px' }}>{po}</td>
                <td style={{ fontWeight: 'bold' }}>${amount.toLocaleString('es-MX')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
