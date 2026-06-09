import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock, Search, X } from 'lucide-react';

export default function Limits() {
  const [pendingBudgets, setPendingBudgets] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [selectedBudgets, setSelectedBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, allRes] = await Promise.all([
        fetch('/api/project-budgets/pending'),
        fetch('/api/purchase-orders')
      ]);
      
      const pendingData = await pendingRes.json();
      const allData = await allRes.json();

      if (pendingData.success) setPendingBudgets(pendingData.pendingBudgets);
      if (allData.success) setAllProjects(allData.projects);
      
    } catch (err) {
      console.error("Fetch error:", err);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const overBudgetProjects = useMemo(() => {
    return allProjects.filter(p => p.budget_indirectos > 0 && p.budget_gastado > p.budget_indirectos);
  }, [allProjects]);

  const filteredOverBudget = useMemo(() => {
    return overBudgetProjects.filter(p => 
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [overBudgetProjects, searchTerm]);

  const handleSelectBudget = (poId) => {
    setSelectedBudgets(prev => 
      prev.includes(poId) ? prev.filter(id => id !== poId) : [...prev, poId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBudgets.length === pendingBudgets.length) {
      setSelectedBudgets([]);
    } else {
      setSelectedBudgets(pendingBudgets.map(pb => pb.po_id));
    }
  };

  const handleAuthorize = async () => {
    if (selectedBudgets.length === 0) return;
    try {
      setLoading(true);
      const response = await fetch('/api/project-budgets/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_ids: selectedBudgets, status: 'authorized', updated_by: 'admin' }),
      });
      const result = await response.json();
      if (result.success) {
        alert('Presupuestos autorizados exitosamente.');
        setSelectedBudgets([]);
        fetchData();
      }
    } catch (err) {
      console.error("Authorization error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && pendingBudgets.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando datos de control...</div>;

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <h1 className="page-title">Centro de Control y Límites</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '20px' }}>
        {/* Panel de Alertas */}
        <div className="card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
              <AlertTriangle size={20} /> POs Excedidas ({overBudgetProjects.length})
            </h2>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="Filtrar..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '4px 8px 4px 28px', fontSize: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}
              />
            </div>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {filteredOverBudget.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                No hay alertas críticas en este momento.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 1 }}>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '8px' }}>PO</th>
                    <th>Presupuesto</th>
                    <th>Gastado</th>
                    <th>Exceso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOverBudget.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{p.id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{p.nombre}</div>
                      </td>
                      <td>${p.budget_indirectos.toLocaleString()}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>${p.budget_gastado.toLocaleString()}</td>
                      <td style={{ color: '#ef4444' }}>
                        +{((p.budget_gastado / p.budget_indirectos - 1) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel de Autorizaciones */}
        <div className="card" style={{ background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
              <Clock size={20} /> Autorizaciones Pendientes ({pendingBudgets.length})
            </h2>
            {selectedBudgets.length > 0 && (
              <button 
                onClick={handleAuthorize} 
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#10b981' }}
              >
                Autorizar {selectedBudgets.length}
              </button>
            )}
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {pendingBudgets.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                No hay solicitudes pendientes.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                    <th style={{ padding: '8px' }}>
                      <input type="checkbox" onChange={handleSelectAll} checked={selectedBudgets.length === pendingBudgets.length} />
                    </th>
                    <th>PO</th>
                    <th>Nuevo Budget</th>
                    <th>Solicitante</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBudgets.map(b => (
                    <tr key={b.po_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 8px' }}>
                        <input type="checkbox" checked={selectedBudgets.includes(b.po_id)} onChange={() => handleSelectBudget(b.po_id)} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.po_id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{b.nombre}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>${parseFloat(b.budget_indirectos).toLocaleString()}</td>
                      <td>
                        <div style={{ fontSize: '12px' }}>{b.updated_by}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{new Date(b.updated_at).toLocaleDateString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}