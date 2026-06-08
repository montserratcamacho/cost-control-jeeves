import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { ArrowLeft, Receipt, Calendar, Tag } from 'lucide-react';
import { ACCOUNTING_OPTIONS } from '../constants';

export default function UserDetail() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/users/${email}/transactions`);
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
  }, [email]);

  const handleTransactionClassificationChange = async (txnId, option) => {
    try {
      const response = await fetch(`http://localhost:3001/api/transactions/${txnId}/accounting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clasificacion_contable: option.value })
      });
      const result = await response.json();
      if (result.success) {
        setTransactions(prev => prev.map(t => t.unique_id === txnId ? { ...t, clasificacion_contable: option.value } : t));
      }
    } catch (error) {
      console.error('Error updating transaction accounting:', error);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={() => navigate('/users')} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', fontWeight: '500', padding: 0, marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Volver a Usuarios
        </button>
        <h1 className="page-title">Transacciones de {email}</h1>
      </div>

      <div className="table-container" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '16px' }}>Fecha</th>
              <th>Establecimiento / Descripción</th>
              <th>Monto</th>
              <th style={{ width: '350px' }}>Clasificación Contable</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center' }}>Cargando transacciones...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron transacciones para este usuario.</td></tr>
            ) : transactions.map(txn => {
              const currentClassification = txn.clasificacion_contable || txn.default_clasificacion_contable;
              const isOverride = !!txn.clasificacion_contable;

              return (
                <tr key={txn.unique_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b', fontWeight: '500' }}>
                      <Calendar size={14} color="#64748b" />
                      {new Date(txn.created_at_utc).toLocaleDateString('es-MX')}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{txn.payee}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>{txn.payment_description}</div>
                  </td>
                  <td style={{ fontWeight: '700', color: '#1e293b' }}>
                    ${txn.amount_destination.toLocaleString('es-MX', { minimumFractionDigits: 2 })} {txn.local_currency}
                  </td>
                  <td style={{ padding: '8px 16px' }}>
                    <div style={{ position: 'relative' }}>
                      <Select
                        options={ACCOUNTING_OPTIONS}
                        value={ACCOUNTING_OPTIONS.find(opt => opt.value === currentClassification)}
                        onChange={(opt) => handleTransactionClassificationChange(txn.unique_id, opt)}
                        placeholder="Usar default..."
                        styles={{
                          control: (base) => ({ 
                            ...base, 
                            borderRadius: '8px', 
                            fontSize: '13px',
                            borderColor: isOverride ? '#2563eb' : '#e2e8f0',
                            backgroundColor: isOverride ? '#f8faff' : '#fff'
                          })
                        }}
                      />
                      {isOverride && (
                        <div style={{ position: 'absolute', top: '-10px', right: '10px', background: '#2563eb', color: 'white', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          PERSONALIZADO
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
    </div>
  );
}
