import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Sakura from './Sakura'

/* ── Kanji per route – displayed as ambient watermark ── */
const ROUTE_KANJI = {
  '/':             '前進',  // Zenshin  — progreso
  '/peso':         '重量',  // Jūryō    — peso
  '/biopedancia':  '体組成', // Taiso    — composición corporal
  '/tirzepatida':  '治癒',  // Chiyu    — curación
  '/nutricion':    '栄養',  // Eiyō     — nutrición
  '/ejercicio':    '鍛錬',  // Tanren   — forja / entrenamiento
  '/alimentacion': '食事',  // Shokuji  — alimento
  '/sueno':        '睡眠',  // Suimin   — sueño
  '/exportar':     '記録',  // Kiroku   — registro
  '/reporte':      '分析',  // Bunseki  — análisis
  '/perfil':       '自己',  // Jiko     — identidad
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

/* ── Torii gate SVG logo ── */
function ToriiLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top crossbeam — gold */}
      <rect x="1" y="5" width="32" height="3.5" rx="1.75" fill="#c9a227" />
      {/* Second crossbeam — red */}
      <rect x="5" y="11" width="24" height="2.8" rx="1.4" fill="#c0383f" />
      {/* Left pillar */}
      <rect x="7" y="13.8" width="3.2" height="19" rx="1.6" fill="#c0383f" />
      {/* Right pillar */}
      <rect x="23.8" y="13.8" width="3.2" height="19" rx="1.6" fill="#c0383f" />
      {/* Cap ends on top beam */}
      <rect x="0" y="3.5" width="5" height="5" rx="2.5" fill="#c9a227" opacity="0.9" />
      <rect x="29" y="3.5" width="5" height="5" rx="2.5" fill="#c9a227" opacity="0.9" />
      {/* Glow dot center */}
      <circle cx="17" cy="6.75" r="1.2" fill="rgba(255,255,255,0.3)" />
    </svg>
  )
}

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
      {/* Ambient sakura petals */}
      <Sakura />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>

        {/* Brand header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <ToriiLogo />
          </div>
          <div className="sidebar-title">
            <span className="sidebar-app-name">ZENSHIN</span>
            <span className="sidebar-app-kanji">前進</span>
            <span className="sidebar-user-name">{profile?.name || 'Usuario'}</span>
          </div>
        </div>

        {/* Navigation */}
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

          <div className="nav-section-label" style={{ marginTop: 8 }}>
            Herramientas
          </div>

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

        {/* Footer */}
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

      {/* ── MAIN ── */}
      <div className="main-wrapper">
        <header className="topbar">
          <button className="topbar-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span className="topbar-title">ZENSHIN</span>
          <span className="topbar-user">{profile?.name?.split(' ')[0]}</span>
        </header>

        <main className="main-content">
          {/* Route-specific kanji watermark */}
          <div className="kanji-watermark" aria-hidden="true">
            {watermarkKanji}
          </div>

          {children}
        </main>
      </div>
    </div>
  )
}
