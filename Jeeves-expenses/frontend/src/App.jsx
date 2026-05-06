import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Projects from './pages/Projects';
import Limits from './pages/Limits';
import './index.css';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = (shouldSync = false) => {
    fetch('http://localhost:3001/api/init')
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
        
        if (shouldSync) {
          // Iniciar sincronización en segundo plano solo si se solicita
          fetch('http://localhost:3001/api/sync-jeeves', { method: 'POST' })
            .then(res => res.json())
            .then(syncResult => {
              if (syncResult.success) {
                console.log(`Sincronización automática: ${syncResult.count} procesadas (${syncResult.totalInDb} totales en base de datos).`);
                fetchData(false); // Recargar solo los datos locales después del sync
              }
            })
            .catch(err => console.error('Error en sincronización automática:', err));
        }
      })
      .catch(err => {
        console.error('Error fetching initial data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData(true); // Sincronizar al cargar la app por primera vez

    // Polling cada 30 segundos para actualizaciones automáticas de la UI
    const interval = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleSync = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/sync-jeeves', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        alert(`Sincronización exitosa: ${result.count} procesadas (${result.totalInDb} totales en base de datos).`);
        fetchData(); // Recargar datos
      } else {
        alert(`Error en sincronización: ${result.error}`);
      }
    } catch (error) {
      alert(`Error al conectar con el servidor: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div id="loading-screen">
        <div className="loading-content">
          <div className="loading-logo">P</div>
          <h1>Jeeves Cost Control</h1>
          <p>Cargando aplicación...</p>
          <div className="loading-bar"></div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div id="app" className="app-layout">
        <Sidebar user={data} />
        <div className="main">
          <TopBar user={data} onSync={handleSync} />
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard data={data} />} />
            <Route path="/transactions" element={<Transactions data={data} />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/limits" element={<Limits />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
