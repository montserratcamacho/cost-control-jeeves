import { useState, useEffect, useRef, useMemo } from 'react';
import { FileText, CheckCircle, Upload, X, Image as ImageIcon, Eye } from 'lucide-react';
import Select from 'react-select';

const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
};

// Componente Modal para Recibos (Fotos)
function ReceiptPhotoModal({ txn, onClose, onUpload }) {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(`http://localhost:3001/api/transactions/${txn.unique_id}/receipt-photo`, {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        onUpload(txn.unique_id, result.url, file.name);
        onClose();
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#fff', padding: '24px', borderRadius: '12px',
        width: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Subir Foto de Recibo</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        
        <div style={{ textAlign: 'center', padding: '20px' }}>
          {txn.archivo_factura_url && txn.archivo_factura_url.includes('/uploads/receipts/') ? (
            <div style={{ marginBottom: '20px' }}>
              <img src={txn.archivo_factura_url} alt="Recibo" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{txn.archivo_factura_nombre}</p>
            </div>
          ) : (
            <div style={{ marginBottom: '20px', color: '#94a3b8' }}>
              <ImageIcon size={48} style={{ margin: '0 auto' }} />
              <p>No hay foto cargada</p>
            </div>
          )}

          <button 
            className="btn-primary" 
            onClick={() => fileInputRef.current.click()}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', width: '100%' }}
          >
            <Upload size={18} /> {loading ? 'Subiendo...' : 'Seleccionar Foto'}
          </button>
          <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
        </div>
      </div>
    </div>
  );
}

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

const VALIDATION_STATUS = {
  0: { label: 'Validado', color: '#10b981' },
  1: { label: 'Pendiente Validación', color: '#f59e0b' }
};

export default function Transactions({ data }) {
  const [transactions, setTransactions] = useState(data?.transactions || []);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPo, setFilterPo] = useState(null);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterValidation, setFilterValidation] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [selectedPhotoTxn, setSelectedPhotoTxn] = useState(null);
  const rowsPerPage = 50;

  useEffect(() => {
    if (data?.transactions) {
      setTransactions(data.transactions);
    }
  }, [data]);

  const handlePhotoUpload = (id, url, name) => {
    setTransactions(prev => prev.map(txn => 
      txn.unique_id === id ? { ...txn, archivo_factura_url: url, archivo_factura_nombre: name } : txn
    ));
  };

  const handleUpdate = async (id, field, value) => {
    try {
      const response = await fetch(`http://localhost:3001/api/transactions/${id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value, updated_by: data?.userEmail })
      });
      if (response.ok) {
        setTransactions(prev => prev.map(txn => 
          txn.unique_id === id ? { ...txn, [field]: value, needs_validation: field === 'needs_validation' ? value : txn.needs_validation } : txn
        ));
      }
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const handleAcceptSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    if (!confirm(`¿Estás seguro de marcar ${ids.length} transacciones como validadas?`)) return;

    try {
      for (const id of ids) {
        await fetch(`http://localhost:3001/api/transactions/${id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field: 'needs_validation', value: 0, updated_by: data?.userEmail })
        });
      }
      
      setTransactions(prev => prev.map(txn => 
        selectedIds.has(txn.unique_id) ? { ...txn, needs_validation: 0 } : txn
      ));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error accepting selected:', error);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (currentRows) => {
    if (selectedIds.size === currentRows.length && currentRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentRows.map(r => r.unique_id)));
    }
  };

  const handleImportHistorical = async () => {
    if (!confirm('¿Deseas iniciar la conciliación con archivos históricos de Excel? Esto puede tardar unos segundos.')) return;
    
    setLoadingHistorical(true);
    try {
      const response = await fetch('http://localhost:3001/api/import-historical', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        // Recargar datos
        window.location.reload();
      } else {
        alert('Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error importing:', error);
      alert('Error de conexión con el servidor');
    } finally {
      setLoadingHistorical(false);
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
        txn.payment_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        txn.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesName = !filterName || txn.user_name === filterName;
      const matchesCategory = !filterCategory || txn.jeeves_category === filterCategory;
      const matchesPo = !filterPo || txn.po_id === filterPo.value;
      const matchesDateStart = !filterDateStart || date >= filterDateStart;
      const matchesDateEnd = !filterDateEnd || date <= filterDateEnd;
      const matchesValidation = filterValidation === '' || txn.needs_validation === parseInt(filterValidation);
      
      return matchesSearch && matchesName && matchesCategory && matchesPo && matchesDateStart && matchesDateEnd && matchesValidation;
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
  }, [transactions, searchTerm, filterName, filterCategory, filterPo, filterDateStart, filterDateEnd, filterValidation]);

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
        <select value={filterValidation} onChange={(e) => {setFilterValidation(e.target.value); setCurrentPage(1);}} style={{ padding: '6px' }}>
          <option value="">Estado Validación</option>
          <option value="0">Validado</option>
          <option value="1">Pendiente</option>
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
        {selectedIds.size > 0 && (
          <button 
            onClick={handleAcceptSelected}
            className="btn-primary"
            style={{ backgroundColor: '#10b981', padding: '6px 12px', fontSize: '12px' }}
          >
            Validar Seleccionados ({selectedIds.size})
          </button>
        )}
        <button 
          onClick={handleImportHistorical}
          className="btn-secondary"
          disabled={loadingHistorical}
          style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Upload size={14} />
          {loadingHistorical ? 'Procesando...' : 'Cargar Históricos'}
        </button>
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
              <th style={{ padding: '12px' }}>
                <input type="checkbox" checked={selectedIds.size === currentRows.length && currentRows.length > 0} onChange={() => toggleSelectAll(currentRows)} />
              </th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Comercio</th>
              <th>Descripción</th>
              <th>Monto</th>
              <th>Categoría Jeeves</th>
              <th style={{ minWidth: '130px' }}>Tipo Gasto</th>
              <th>Descripción Interna</th>
              <th>Foto Recibo</th>
              <th>Factura (UUID)</th>
              <th>PO</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map(txn => (
              <tr key={txn.unique_id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: txn.needs_validation ? '#fffbeb' : 'inherit' }}>
                <td style={{ padding: '10px' }}>
                  <input type="checkbox" checked={selectedIds.has(txn.unique_id)} onChange={() => toggleSelect(txn.unique_id)} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: VALIDATION_STATUS[txn.needs_validation || 0].color }}></div>
                    {txn.needs_validation === 1 && (
                      <button 
                        onClick={() => handleUpdate(txn.unique_id, 'needs_validation', 0)}
                        className="btn-secondary"
                        style={{ fontSize: '10px', padding: '2px 4px' }}
                      >
                        Aceptar
                      </button>
                    )}
                  </div>
                </td>
                <td>{txn.created_at_utc?.substring(0, 10)}</td>
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
                    value={txn.tipo_gasto_interno || ''}
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
                  <button 
                    onClick={() => setSelectedPhotoTxn(txn)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '4px', 
                      padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0',
                      backgroundColor: txn.archivo_factura_url?.includes('/uploads/receipts/') ? '#eff6ff' : '#fff',
                      color: txn.archivo_factura_url?.includes('/uploads/receipts/') ? '#3b82f6' : '#64748b',
                      cursor: 'pointer', fontSize: '11px'
                    }}
                  >
                    {txn.archivo_factura_url?.includes('/uploads/receipts/') ? <Eye size={14} /> : <ImageIcon size={14} />}
                    {txn.archivo_factura_url?.includes('/uploads/receipts/') ? 'Ver Foto' : 'Subir Foto'}
                  </button>
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

      {selectedPhotoTxn && (
        <ReceiptPhotoModal 
          txn={selectedPhotoTxn} 
          onClose={() => setSelectedPhotoTxn(null)} 
          onUpload={handlePhotoUpload} 
        />
      )}
    </div>
  );
}
