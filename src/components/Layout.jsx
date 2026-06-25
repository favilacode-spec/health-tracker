import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sakura from './Sakura'

/* ── Kanji per route – displayed as ambient watermark ── */
const ROUTE_KANJI = {
  '/':             '前進',
  '/peso':         '重量',
  '/biopedancia':  '体組成',
  '/tirzepatida':  '治癒',
  '/nutricion':    '栄養',
  '/ejercicio':    '鍛錬',
  '/alimentacion': '食事',
  '/sueno':        '睡眠',
  '/exportar':     '記録',
  '/reporte':      '分析',
  '/perfil':       '自己',
}

const navItems = [
  { to: '/',             kanji: '前', label: 'Dashboard' },
  { to: '/peso',         kanji: '重', label: 'Peso y Medidas' },
  { to: '/biopedancia',  kanji: '体', label: 'Biopedancia' },
  { to: '/tirzepatida',  kanji: '治', label: 'Tirzepatida' },
  { to: '/nutricion',    kanji: '栄', label: 'Nutrición' },
  { to: '/ejercicio',    kanji: '鍛', label: 'Ejercicio' },
  { to: '/alimentacion', kanji: '食', label: 'Alimentación' },
  { to: '/sueno',        kanji: '眠', label: 'Sueño' },
]

const toolItems = [
  { to: '/exportar', kanji: '記', label: 'Exportar' },
  { to: '/reporte',  kanji: '分', label: 'Reporte IA' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate  = useNavigate()
  const location  = useLocation()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const watermarkKanji = ROUTE_KANJI[location.pathname] || '前進'

  return (
    <div className="layout">
      <Sakura />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <span className="sidebar-app-name">ZENSHIN</span>
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
              <span className="nav-icon">{item.kanji}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          <div className="nav-section-label" style={{ marginTop: 8 }}>Herramientas</div>
          {toolItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.kanji}</span>
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
            <span className="nav-icon">自</span>
            <span>Mi Perfil</span>
          </NavLink>
          <button className="nav-item nav-item-logout" onClick={handleSignOut}>
            <span className="nav-icon" style={{ fontSize: '0.95rem' }}>出</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div className="main-wrapper">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="topbar-title">ZENSHIN</span>
          <span className="topbar-user">{profile?.name?.split(' ')[0]}</span>
        </header>
        <main className="main-content">
          <div className="kanji-watermark" aria-hidden="true">{watermarkKanji}</div>
          {children}
        </main>
      </div>
    </div>
  )
}
