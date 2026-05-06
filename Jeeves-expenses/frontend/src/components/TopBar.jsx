import { DownloadCloud, Play } from 'lucide-react';

export default function TopBar({ onSync }) {
  return (
    <div className="top-bar">
      <h2>Control de Gastos</h2>
      <div className="top-actions">
        <button className="btn-secondary">
          <DownloadCloud size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Exportar
        </button>
        <button className="btn-primary" onClick={onSync}>
          <Play size={14} style={{ display: 'inline', marginRight: '4px' }} />
          Sincronizar
        </button>
      </div>
    </div>
  );
}
