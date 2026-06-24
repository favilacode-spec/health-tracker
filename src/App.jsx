import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Peso from './pages/Peso'
import Biopedancia from './pages/Biopedancia'
import Tirzepatida from './pages/Tirzepatida'
import Nutricion from './pages/Nutricion'
import NutricionIA from './pages/NutricionIA'
import Ejercicio from './pages/Ejercicio'
import Alimentacion from './pages/Alimentacion'
import Perfil from './pages/Perfil'
import Sueno from './pages/Sueno'
import Exportar from './pages/Exportar'
import Reporte from './pages/Reporte'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Cargando...</p></div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Cargando...</p></div>

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/peso"          element={<ProtectedRoute><Peso /></ProtectedRoute>} />
      <Route path="/biopedancia"   element={<ProtectedRoute><Biopedancia /></ProtectedRoute>} />
      <Route path="/tirzepatida"   element={<ProtectedRoute><Tirzepatida /></ProtectedRoute>} />
      <Route path="/nutricion"     element={<ProtectedRoute><Nutricion /></ProtectedRoute>} />
      <Route path="/nutricion-ia"  element={<ProtectedRoute><NutricionIA /></ProtectedRoute>} />
      <Route path="/ejercicio"     element={<ProtectedRoute><Ejercicio /></ProtectedRoute>} />
      <Route path="/alimentacion"  element={<ProtectedRoute><Alimentacion /></ProtectedRoute>} />
      <Route path="/sueno"         element={<ProtectedRoute><Sueno /></ProtectedRoute>} />
      <Route path="/exportar"      element={<ProtectedRoute><Exportar /></ProtectedRoute>} />
      <Route path="/reporte"       element={<ProtectedRoute><Reporte /></ProtectedRoute>} />
      <Route path="/perfil"        element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
