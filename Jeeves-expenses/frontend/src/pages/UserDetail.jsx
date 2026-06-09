import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Select from 'react-select';
import { ArrowLeft, Calendar, CheckCircle2, XCircle, MessageSquare, Save, X } from 'lucide-react';
import { ACCOUNTING_OPTIONS } from '../constants';

// Modal para motivo de rechazo
function RejectionModal({ txn, onClose, onSubmit }) {
  const [reason, setReason] = useState(txn.rejection_reason || '');

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
          <h3 style={{ margin: 0 }}>Motivo de Rechazo</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Indica por qué no se acepta el gasto de <strong>{txn.payee}</strong> por <strong>${txn.amount_destination.toLocaleString()}</strong>.
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Escribe el motivo aquí..."
          style={{
            width: '100%', height: '120px', padding: '12px', borderRadius: '8px',
            border: '1px solid #e2e8f0', marginBottom: '20px', outline: 'none',
            fontSize: '14px', resize: 'none'
          }}
        />

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button 
            onClick={() => onSubmit(reason)} 
            className="btn-primary" 
            style={{ backgroundColor: '#ef4444' }}
            disabled={!reason.trim()}
          >
            Confirmar Rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserDetail() {
  const { email } = useParams();
  const [searchParams] = useSearchParams();
  const month = searchParams.get('month');
  const navigate = useNavigate();
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectionModalTxn, setRejectionModalTxn] = useState(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const url = `/api/users/${email}/transactions${month ? `?month=${month}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setTransactions(result.transactions);
      }
    } catch (error) {
      console.error('Error fetching user transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [email, month]);

  const handleAcceptance = async (txnId, status, reason = null) => {
    try {
      const response = await fetch(`/api/transactions/${txnId}/acceptance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason })
      });
      const result = await response.json();
      if (result.success) {
        setTransactions(prev => prev.map(t => 
          t.unique_id === txnId ? { ...t, accepted_status: status, rejection_reason: reason } : t
        ));
        setRejectionModalTxn(null);
      }
    } catch (error) {
      console.error('Error updating acceptance:', error);
    }
  };

  const handleAccountingChange = async (txnId, option) => {
    try {
      const response = await fetch(`/api/transactions/${txnId}/accounting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clasificacion_contable: option.value })
      });
      const result = await response.json();
      if (result.success) {
        setTransactions(prev => prev.map(t => t.unique_id === txnId ? { ...t, clasificacion_contable: option.value } : t));
      }
    } catch (error) {
      console.error('Error updating accounting:', error);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/users')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: '500', padding: 0, marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Volver a Usuarios
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 className="page-title" style={{ marginBottom: '4px' }}>Transacciones de {email}</h1>
            <p style={{ color: '#64748b', margin: 0 }}>Periodo: <strong>{month || 'Todos'}</strong></p>
          </div>
        </div>
      </div>

      <div className="table-container" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '16px', width: '120px' }}>Aceptación</th>
              <th>Fecha</th>
              <th>Establecimiento / Descripción</th>
              <th>Monto</th>
              <th style={{ width: '300px' }}>Clasificación Contable</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>Cargando transacciones...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron transacciones.</td></tr>
            ) : transactions.map(txn => {
              const currentClassification = txn.clasificacion_contable || txn.default_clasificacion_contable;
              const isOverride = !!txn.clasificacion_contable;

              return (
                <tr key={txn.unique_id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: txn.accepted_status === 2 ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => handleAcceptance(txn.unique_id, 1)}
                        title="Aceptar Gasto"
                        style={{ 
                          border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                          color: txn.accepted_status === 1 ? '#10b981' : '#e2e8f0',
                          transition: 'color 0.2s'
                        }}
                      >
                        <CheckCircle2 size={24} fill={txn.accepted_status === 1 ? '#dcfce7' : 'none'} />
                      </button>
                      <button 
                        onClick={() => setRejectionModalTxn(txn)}
                        title="Rechazar Gasto"
                        style={{ 
                          border: 'none', background: 'none', cursor: 'pointer', padding: 0,
                          color: txn.accepted_status === 2 ? '#ef4444' : '#e2e8f0',
                          transition: 'color 0.2s'
                        }}
                      >
                        <XCircle size={24} fill={txn.accepted_status === 2 ? '#fee2e2' : 'none'} />
                      </button>
                      {txn.rejection_reason && (
                        <div title={txn.rejection_reason} style={{ color: '#ef4444' }}>
                          <MessageSquare size={16} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '14px' }}>
                    {new Date(txn.created_at_utc).toLocaleDateString('es-MX')}
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>{txn.payee}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{txn.payment_description}</div>
                    {txn.po_id && <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: 'bold' }}>PO: {txn.po_id}</div>}
                  </td>
                  <td style={{ fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>
                    ${txn.amount_destination.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ position: 'relative' }}>
                      <Select
                        options={ACCOUNTING_OPTIONS}
                        value={ACCOUNTING_OPTIONS.find(opt => opt.value === currentClassification)}
                        onChange={(opt) => handleAccountingChange(txn.unique_id, opt)}
                        placeholder="Usar default..."
                        styles={{
                          control: (base) => ({ 
                            ...base, borderRadius: '8px', fontSize: '12px', minHeight: '32px',
                            borderColor: isOverride ? '#2563eb' : '#e2e8f0',
                            backgroundColor: isOverride ? '#f8faff' : '#fff'
                          })
                        }}
                      />
                      {isOverride && (
                        <div style={{ position: 'absolute', top: '-8px', right: '8px', background: '#2563eb', color: 'white', fontSize: '8px', padding: '1px 4px', borderRadius: '3px', fontWeight: '700' }}>
                          MODIFICADO
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rejectionModalTxn && (
        <RejectionModal 
          txn={rejectionModalTxn} 
          onClose={() => setRejectionModalTxn(null)} 
          onSubmit={(reason) => handleAcceptance(rejectionModalTxn.unique_id, 2, reason)}
        />
      )}
    </div>
  );
}
