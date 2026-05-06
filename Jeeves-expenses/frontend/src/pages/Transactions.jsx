import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, CheckCircle, Upload, X } from 'lucide-react';
import Select from 'react-select';

const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};

// Componente Modal para Facturas
function InvoiceModal({ txn, onClose, onUpload }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    await onUpload(txn.unique_id, file);
    setLoading(false);
    onClose();
  };

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    await onUpload(txn.unique_id, text);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
        width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Cargar Factura</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          Sube el archivo <b>PDF/HTML</b> o pega el contenido para extraer el UUID y validar RFCs.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button 
            className="btn-primary" 
            onClick={() => fileInputRef.current.click()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
          >
            <Upload size={18} /> {loading ? 'Procesando...' : 'Subir Archivo (PDF/HTML)'}
          </button>
          <input type="file" ref={fileInputRef} hidden accept=".pdf,.html,.xml" onChange={handleFileChange} />

          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>— O PEGA EL CONTENIDO AQUÍ —</div>

          <textarea 
            placeholder="Pega el texto de la factura o el UUID directamente..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px' }}
          />
          
          <button 
            className="btn-secondary" 
            onClick={handleTextSubmit}
            disabled={loading || !text.trim()}
            style={{ padding: '10px' }}
          >
            Procesar Texto
          </button>
        </div>
      </div>
    </div>
  );
}

const INTERNAL_CATEGORIES = [
  'Transaction Cost', 
  'Tech & Product', 
  'Sales', 
  'Recruiting', 
  'Office Expenses', 
  'G&A Expenses', 
  'Capex'
];

export default function Transactions({ data }) {
  const [transactions, setTransactions] = useState(data?.transactions || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPo, setFilterPo] = useState(null);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const rowsPerPage = 50;

  useEffect(() => {
    if (data?.transactions) {
      setTransactions(data.transactions);
    }
  }, [data]);

  const handleUpdate = async (id, field, value) => {
    try {
      const response = await fetch(`http://localhost:3001/api/transactions/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, updated_by: data?.userEmail })
      });
      if (response.ok) {
        setTransactions(prev => prev.map(txn => 
          txn.unique_id === id ? { ...txn, [field]: value } : txn
        ));
      }
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleInvoiceUpload = async (id, fileOrText) => {
    const formData = new FormData();
    if (fileOrText instanceof File) formData.append('file', fileOrText);
    else formData.append('manualText', fileOrText);

    try {
      const response = await fetch(`http://localhost:3001/api/transactions/${id}/invoice`, {
        method: 'POST',
        body: formData
      });
    const result = await response.json();
    if (result.success) {
      setTransactions(prev => prev.map(txn => 
        txn.unique_id === id ? { 
          ...txn, 
          factura_uuid: result.uuid || txn.factura_uuid,
          rfc_emisor: result.rfcEmisor || txn.rfc_emisor,
          rfc_receptor: result.rfcReceptor || txn.rfc_receptor
        } : txn
      ));
      return result;
    }
    return { success: false, error: result.error };
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Filtrado Lógica
  const filteredTransactions = useMemo(() => {
    let currentTransactions = transactions.filter(txn => {
      const date = txn.created_at_utc?.substring(0, 10) || "";
      const matchesSearch = 
        txn.payee?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.payment_description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesName = !filterName || txn.user_name === filterName;
      const matchesCategory = !filterCategory || txn.jeeves_category === filterCategory;
      const matchesPo = !filterPo || txn.po_id === filterPo.value;
      const matchesDateStart = !filterDateStart || date >= filterDateStart;
      const matchesDateEnd = !filterDateEnd || date <= filterDateEnd;
      
      return matchesSearch && matchesName && matchesCategory && matchesPo && matchesDateStart && matchesDateEnd;
    });

    // Sort POs by ID in descending order
    currentTransactions.sort((a, b) => {
      const poA = parseInt(a.po_id);
      const poB = parseInt(b.po_id);
      if (isNaN(poA) && isNaN(poB)) return 0; // Both are not numbers, keep original order relative to each other
      if (isNaN(poA)) return 1; // A is not a number, push it to the end
      if (isNaN(poB)) return -1; // B is not a number, push it to the end
      return poB - poA; // Sort descending
    });
    return currentTransactions;
  }, [transactions, searchTerm, filterName, filterCategory, filterPo, filterDateStart, filterDateEnd]);

  // Cálculo de Paginación
  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage);
  const currentRows = filteredTransactions.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const users = [...new Set(transactions.map(t => t.user_name))].filter(Boolean).sort();
  const jeevesCategories = [...new Set(transactions.map(t => t.jeeves_category))].filter(Boolean).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: '10px' }}>
      {/* Barra de Filtros */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '15px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <input 
          type="text" 
          placeholder="Buscar..." 
          value={searchTerm}
          onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
          style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #ddd', minWidth: '150px' }}
        />
        <select value={filterName} onChange={(e) => {setFilterName(e.target.value); setCurrentPage(1);}} style={{ padding: '6px' }}>
          <option value="">Cualquier Usuario</option>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Desde:</span>
          <input type="date" value={filterDateStart} onChange={(e) => {setFilterDateStart(e.target.value); setCurrentPage(1);}} style={{ padding: '4px' }} />
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Hasta:</span>
          <input type="date" value={filterDateEnd} onChange={(e) => {setFilterDateEnd(e.target.value); setCurrentPage(1);}} style={{ padding: '4px' }} />
        </div>
        <select value={filterCategory} onChange={(e) => {setFilterCategory(e.target.value); setCurrentPage(1);}} style={{ padding: '6px' }}>
          <option value="">Categoría Jeeves</option>
          {jeevesCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ minWidth: '200px' }}>
          <Select
            options={data?.projects?.map(p => ({ value: p.id, label: p.nombre })) || []}
            onChange={(selectedOption) => {setFilterPo(selectedOption); setCurrentPage(1);}}
            value={filterPo}
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

      {/* Info de resultados y Paginación Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 5px' }}>
        <span style={{ fontSize: '13px', color: '#666' }}>Mostrando {currentRows.length} de {filteredTransactions.length} transacciones</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn-pagination">Anterior</button>
          <span style={{ padding: '5px 10px', fontSize: '14px' }}>Pag {currentPage} de {totalPages || 1}</span>
          <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="btn-pagination">Siguiente</button>
        </div>
      </div>

      {/* Tabla con Scroll */}
      <div className="table-container" style={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th>Usuario</th>
              <th>Comercio</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Categoría Jeeves</th>
              <th style={{ minWidth: '130px' }}>Tipo Gasto</th>
              <th>Descripción Interna</th>
              <th>Factura (UUID)</th>
              <th>PO</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map(txn => (
              <tr key={txn.unique_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px' }}>{txn.created_at_utc?.substring(0, 10)}</td>
                <td style={{ fontWeight: 500 }}>{txn.user_name}</td>
                <td>{txn.payee}</td>
                <td title={txn.payment_description}>
                  <div style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {txn.payment_description}
                  </div>
                </td>
                <td style={{ fontWeight: 'bold', color: '#0f172a' }}>{formatMoney(txn.amount_destination)}</td>
                <td><span className="badge-jeeves" style={{ fontSize: '10px' }}>{txn.jeeves_category}</span></td>
                <td>
                  <select 
                    className="cell-select" 
                    defaultValue={txn.tipo_gasto_interno || ''}
                    onChange={(e) => handleUpdate(txn.unique_id, 'tipo_gasto_interno', e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    {INTERNAL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </td>
                <td>
                  <input 
                    type="text" 
                    className="cell-input"
                    defaultValue={txn.descripcion_interna || ''}
                    onBlur={(e) => handleUpdate(txn.unique_id, 'descripcion_interna', e.target.value)}
                    placeholder="..."
                  />
                </td>
                <td>
                  {txn.factura_uuid ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: 600 }}>
                      <CheckCircle size={16} /> Facturado
                      <button 
                        onClick={() => setSelectedTxn(txn)}
                        style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '10px', textDecoration: 'underline' }}
                      >
                        (ver/cambiar)
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn-secondary" 
                      style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setSelectedTxn(txn)}
                    >
                      <FileText size={14} /> Cargar Factura
                    </button>
                  )}
                </td>
                <td>
                  <Select
                    options={data?.projects?.map(p => ({ value: p.id, label: p.nombre })) || []}
                    onChange={(selectedOption) => handleUpdate(txn.unique_id, 'po_id', selectedOption ? selectedOption.value : null)}
                    value={data?.projects?.find(p => p.id === txn.po_id) ? { value: txn.po_id, label: data.projects.find(p => p.id === txn.po_id).nombre } : null}
                    placeholder="-- Sin PO --"
                    isClearable
                    isSearchable
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '28px',
                        height: '28px',
                        fontSize: '0.75rem',
                      }),
                      valueContainer: (base) => ({
                        ...base,
                        height: '26px',
                        padding: '0 6px',
                      }),
                      input: (base) => ({
                        ...base,
                        margin: '0px',
                      }),
                      indicatorsContainer: (base) => ({
                        ...base,
                        height: '26px',
                      }),
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTxn && (
        <InvoiceModal 
          txn={selectedTxn} 
          onClose={() => setSelectedTxn(null)} 
          onUpload={handleInvoiceUpload} 
        />
      )}
    </div>
  );
}
