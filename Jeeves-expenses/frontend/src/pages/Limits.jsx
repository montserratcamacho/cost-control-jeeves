import React, { useState, useEffect } from 'react';

export default function Limits() {
  const [pendingBudgets, setPendingBudgets] = useState([]);
  const [selectedBudgets, setSelectedBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPendingBudgets = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/project-budgets/pending');
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      if (result.success) {
        setPendingBudgets(result.pendingBudgets);
      } else {
        setError(result.error || 'Error al cargar presupuestos pendientes');
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError('Error al conectar con el servidor para cargar presupuestos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBudgets();
  }, []);

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
      const response = await fetch('http://localhost:3001/api/project-budgets/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_ids: selectedBudgets, status: 'authorized', updated_by: 'admin' }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      if (result.success) {
        alert('Presupuestos autorizados exitosamente.');
        setSelectedBudgets([]);
        fetchPendingBudgets(); // Recargar la lista
      } else {
        alert(`Error al autorizar: ${result.error}`);
      }
    } catch (err) {
      console.error("Authorization error:", err);
      alert('Error al conectar con el servidor para autorizar presupuestos.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state">Cargando presupuestos pendientes...</div>;
  if (error) return <div className="empty-state" style={{ color: 'var(--err)' }}>{error}</div>;

  return (
    <div className="page-container" style={{ padding: '20px' }}>
      <h1 className="page-title">Autorización de Presupuestos Indirectos</h1>
      
      {pendingBudgets.length === 0 ? (
        <div className="empty-state">No hay presupuestos pendientes de autorización.</div>
      ) : (
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontWeight: 'bold' }}>
              <input 
                type="checkbox" 
                onChange={handleSelectAll} 
                checked={selectedBudgets.length === pendingBudgets.length && pendingBudgets.length > 0}
                style={{ marginRight: '8px' }}
              />
              Seleccionar Todos
            </label>
            <button 
              onClick={handleAuthorize} 
              disabled={selectedBudgets.length === 0 || loading}
              className="btn-primary"
              style={{ padding: '8px 16px' }}
            >
              Autorizar ({selectedBudgets.length})
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
                <th style={{ padding: '10px' }}></th>
                <th>ID PO</th>
                <th>Monto Presupuesto</th>
                <th>Solicitado Por</th>
                <th>Fecha Solicitud</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pendingBudgets.map(budget => (
                <tr key={budget.po_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedBudgets.includes(budget.po_id)}
                      onChange={() => handleSelectBudget(budget.po_id)}
                    />
                  </td>
                  <td>{budget.po_id}</td>
                  <td style={{ fontWeight: 'bold' }}>${parseFloat(budget.budget_indirectos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td>{budget.updated_by}</td>
                  <td>{new Date(budget.updated_at).toLocaleDateString()}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      backgroundColor: budget.status === 'authorized' ? '#dcfce7' : (budget.status === 'pending' ? '#fffbeb' : '#fee2e2'),
                      color: budget.status === 'authorized' ? '#16a34a' : (budget.status === 'pending' ? '#f59e0b' : '#dc2626'),
                    }}>
                      {budget.status === 'authorized' ? 'Autorizado' : (budget.status === 'pending' ? 'Pendiente' : 'Rechazado')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}