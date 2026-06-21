import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/',             icon: '📊', label: 'Dashboard' },
  { to: '/peso',         icon: '⚖️',  label: 'Peso y Medidas' },
  { to: '/biopedancia',  icon: '🔬', label: 'Biopedancia' },
  { to: '/tirzepatida',  icon: '💉', label: 'Tirzepatida' },
  { to: '/nutricion',    icon: '🥗', label: 'Nutrición' },
  { to: '/ejercicio',    icon: '🏃', label: 'Ejercicio' },
  { to: '/alimentacion', icon: '🛒', label: 'Alimentación' },
  { to: '/sueno',        icon: '🌙', label: 'Sueño' },
]

const toolItems = [
  { to: '/exportar', icon: '📥', label: 'Exportar' },
  { to: '/reporte',  icon: '📋', label: 'Reporte IA' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">💉</div>
          <div className="sidebar-title">
            <span className="sidebar-app-name">Health Tracker</span>
            <span className="sidebar-user-name">{profile?.name || 'Usuario'}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div style={{ margin: '8px 0 4px', padding: '6px 16px', fontSize: 10, fontWeight: 700,
            color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Herramientas
          </div>

          {toolItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/perfil"
            className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="nav-icon">⚙️</span>
            <span>Mi Perfil</span>
          </NavLink>
          <button className="nav-item nav-item-logout" onClick={handleSignOut}>
            <span className="nav-icon">🚪</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="main-wrapper">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="topbar-title">Health Tracker</span>
          <span className="topbar-user">{profile?.name?.split(' ')[0]}</span>
        </header>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
