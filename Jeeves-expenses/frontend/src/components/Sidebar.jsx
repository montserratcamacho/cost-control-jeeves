import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, FolderKanban, Users, ShieldAlert } from 'lucide-react';

export default function Sidebar({ user }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">P</div>
        <div>
          <div className="logo-text">Jeeves Control</div>
          <div className="logo-sub">Prima AI</div>
        </div>
      </div>
      <div className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon"><LayoutDashboard size={18} /></div>
          Dashboard
        </NavLink>
        <NavLink to="/transactions" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon"><Receipt size={18} /></div>
          Transacciones
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <div className="nav-icon"><FolderKanban size={18} /></div>
          Proyectos (PO)
        </NavLink>
        {user?.isAdmin && (
          <>
            <NavLink to="/limits" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><ShieldAlert size={18} /></div>
              Límites
            </NavLink>
            <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <div className="nav-icon"><Users size={18} /></div>
              Usuarios
            </NavLink>
          </>
        )}
      </div>
      <div className="sidebar-user">
        <div className="user-pill">
          <div className="user-avatar">{user?.userEmail?.charAt(0).toUpperCase() || 'U'}</div>
          <div className="user-info">
            <div className="user-email">{user?.userEmail}</div>
            {user?.isAdmin && <span className="badge-admin">Admin</span>}
          </div>
        </div>
      </div>
    </aside>
  );
}
