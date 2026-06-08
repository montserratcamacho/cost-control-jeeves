import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Select from 'react-select';
import { Download, User as UserIcon, Calendar } from 'lucide-react';
import { ACCOUNTING_OPTIONS } from '../constants';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/users-accounting?month=${selectedMonth}`);
      const result = await response.json();
      if (result.success) {
        setUsers(result.users);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedMonth]);

  const handleDefaultClassificationChange = async (email, name, option) => {
    try {
      const response = await fetch('http://localhost:3001/api/user-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email,
          user_name: name,
          default_clasificacion_contable: option.value
        })
      });
      const result = await response.json();
      if (result.success) {
        setUsers(prev => prev.map(u => u.user_email === email ? { ...u, default_classification: option.value } : u));
      }
    } catch (error) {
      console.error('Error updating user config:', error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export-accounting');
      const result = await response.json();
      if (result.success) {
        const headers = ["Fecha", "Usuario", "Correo", "Establecimiento", "Descripcion", "Monto", "Moneda", "Clasificacion Contable"];
        const csvRows = [
          headers.join(','),
          ...result.transactions.map(t => [
            t.Fecha,
            `"${t.Usuario}"`,
            t.Correo,
            `"${t.Establecimiento}"`,
            `"${t.Descripcion}"`,
            t.Monto,
            t.Moneda,
            `"${t.Clasificacion_Contable}"`
          ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_contable_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Error exporting accounting:', error);
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Gestión de Usuarios y Contabilidad</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <Calendar size={16} color="#64748b" />
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '14px', color: '#1e293b', fontWeight: '500' }}
            />
          </div>
          <button onClick={handleExport} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={18} /> Exportar Reporte
          </button>
        </div>
      </div>

      <div className="table-container" style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ padding: '16px' }}>Nombre</th>
              <th>Correo</th>
              <th>Monto Gastado ({selectedMonth})</th>
              <th style={{ width: '350px' }}>Clasificación Contable (Default)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center' }}>Cargando usuarios...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron transacciones para este mes.</td></tr>
            ) : users.map(user => (
              <tr key={user.user_email} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '16px' }}>
                  <Link to={`/users/${user.user_email}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: '#2563eb', fontWeight: '600' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#eff6ff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <UserIcon size={16} />
                    </div>
                    {user.user_name || 'Sin Nombre'}
                  </Link>
                </td>
                <td style={{ color: '#64748b', fontSize: '14px' }}>{user.user_email}</td>
                <td style={{ fontWeight: '700', color: '#1e293b' }}>
                  ${user.total_spent.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '8px 16px' }}>
                  <Select
                    options={ACCOUNTING_OPTIONS}
                    value={ACCOUNTING_OPTIONS.find(opt => opt.value === user.default_classification)}
                    onChange={(opt) => handleDefaultClassificationChange(user.user_email, user.user_name, opt)}
                    placeholder="Seleccionar clasificación..."
                    styles={{
                      control: (base) => ({ ...base, borderRadius: '8px', fontSize: '13px' })
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
