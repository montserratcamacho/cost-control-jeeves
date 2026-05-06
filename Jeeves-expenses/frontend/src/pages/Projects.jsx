import { useState, useEffect, useMemo } from 'react';
import Select from 'react-select';

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="filter-bar">
        <label style={{ fontSize: '.75rem', fontWeight: 600, marginRight: '8px' }}>Buscar PO:</label>
        <Select
          options={purchaseOrders.map(po => ({ value: po.id, label: po.nombre }))}
          onChange={setFilterPO}
          value={filterPO}
          placeholder="Escribe para buscar PO..."
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

      <div className="table-container" style={{ marginTop: '16px', overflowY: 'auto' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre del Proyecto (PO)</th>
                <th>Monto PO</th>
                <th>Budget Indirectos</th>
                <th>Budget Gastado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    <div className="empty-state">Cargando...</div>
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    <div className="empty-state" style={{ color: 'var(--err)' }}>{error}</div>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredAndSortedPOs.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-cell">
                    <div className="empty-state">No hay purchase orders para mostrar.</div>
                  </td>
                </tr>
              )}
              {!loading && !error && filteredAndSortedPOs.map(po => (
                <tr key={po.id}>
                  <td>{po.id}</td>
                  <td style={{ fontWeight: 500 }}>{po.nombre}</td>
                  <td>${po.monto_po.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <input
                      type="number"
                      value={po.budget_indirectos}
                      onChange={(e) => handleBudgetChange(po.id, parseFloat(e.target.value))}
                      onBlur={(e) => saveBudget(po.id, parseFloat(e.target.value))}
                      style={{ width: '100px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </td>
                  <td>${po.budget_gastado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      backgroundColor: po.budget_status === 'authorized' ? '#dcfce7' : (po.budget_status === 'pending' ? '#fffbeb' : '#fee2e2'),
                      color: po.budget_status === 'authorized' ? '#16a34a' : (po.budget_status === 'pending' ? '#f59e0b' : '#dc2626'),
                    }}>
                      {po.budget_status === 'authorized' ? 'Autorizado' : (po.budget_status === 'pending' ? 'Pendiente' : 'Rechazado')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
