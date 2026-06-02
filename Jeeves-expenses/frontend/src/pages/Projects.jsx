import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';
import { TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function Projects() {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterPO, setFilterPO] = useState(null);

  const fetchData = () => {
    fetch('http://localhost:3001/api/purchase-orders')
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(result => {
        if (result.success && result.projects) {
          setPurchaseOrders(result.projects || []);
        } else {
          setPurchaseOrders([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError('Error al cargar proyectos (Purchase Orders)');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBudgetChange = (poId, value) => {
    setPurchaseOrders(prevPOs =>
      prevPOs.map(po => (po.id === poId ? { ...po, budget_indirectos: value } : po))
    );
  };

  const saveBudget = async (poId, value) => {
    try {
      await fetch('http://localhost:3001/api/project-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: poId, budget_indirectos: value, updated_by: 'project_manager' }),
      });
      fetchData(); // Refetch data to ensure consistency and update status
    } catch (error) {
      console.error("Error saving budget:", error);
    }
  };

  const filteredAndSortedPOs = useMemo(() => {
    let currentPOs = [...purchaseOrders];

    // Filter
    if (filterPO) {
      currentPOs = currentPOs.filter(po => po.id.includes(filterPO.value) || po.nombre.toLowerCase().includes(filterPO.label.toLowerCase()));
    }

    // Sort Descending by ID
    currentPOs.sort((a, b) => parseInt(b.id) - parseInt(a.id));

    return currentPOs;
  }, [purchaseOrders, filterPO]);

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Control de Presupuestos por PO</h1>
        
        <div className="filter-bar" style={{ background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', minWidth: '300px' }}>
          <Select
            options={purchaseOrders.map(po => ({ value: po.id, label: po.nombre }))}
            onChange={setFilterPO}
            value={filterPO}
            placeholder="Buscar PO..."
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
      </div>

      <div className="table-container" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead style={{ backgroundColor: '#f8fafc' }}>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '16px' }}>ID PO</th>
              <th>Nombre del Proyecto</th>
              <th>Presupuesto Indirectos</th>
              <th>Gasto Acumulado</th>
              <th>Progreso</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>Cargando proyectos...</td></tr>
            )}
            {!loading && filteredAndSortedPOs.map(po => {
              const percent = po.budget_indirectos > 0 ? (po.budget_gastado / po.budget_indirectos) * 100 : 0;
              const isOverBudget = po.budget_indirectos > 0 && po.budget_gastado > po.budget_indirectos;
              
              return (
                <tr key={po.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', fontWeight: 'bold' }}>{po.id}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{po.nombre}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Monto Original: ${po.monto_po.toLocaleString('es-MX')}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b' }}>$</span>
                      <input
                        type="number"
                        value={po.budget_indirectos}
                        onChange={(e) => handleBudgetChange(po.id, parseFloat(e.target.value))}
                        onBlur={(e) => saveBudget(po.id, parseFloat(e.target.value))}
                        style={{ 
                          width: '120px', 
                          padding: '6px 8px', 
                          border: '1px solid #e2e8f0', 
                          borderRadius: '6px',
                          fontWeight: 'bold',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </td>
                  <td style={{ fontWeight: 'bold', color: isOverBudget ? '#ef4444' : '#1e293b' }}>
                    ${po.budget_gastado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(percent, 100)}%`, 
                          height: '100%', 
                          backgroundColor: percent > 90 ? '#ef4444' : (percent > 70 ? '#f59e0b' : '#10b981')
                        }}></div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '35px' }}>{Math.round(percent)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {po.budget_status === 'authorized' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '12px', fontWeight: 600 }}>
                          <CheckCircle2 size={14} /> Autorizado
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '12px', backgroundColor: '#fffbeb', color: '#f59e0b', fontSize: '12px', fontWeight: 600 }}>
                          <Clock size={14} /> Pendiente
                        </span>
                      )}
                      {isOverBudget && (
                        <span title="Presupuesto excedido" style={{ color: '#ef4444' }}><AlertCircle size={18} /></span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
