import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [data, setData] = useState({
    weights: [],
    lastWeight: null,
    lastMeasurements: null,
    lastTirze: null,
    todayNutrition: [],
    todayWater: 0,
    todayExercise: [],
    lastBio: null,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) loadDashboard()
  }, [user])

  async function loadDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    const [weights, lastMeas, lastTirze, nutrition, water, exercise, lastBio] = await Promise.all([
      supabase.from('weight_records').select('date,weight_kg').eq('user_id', user.id)
        .gte('date', thirtyDaysAgo).order('date', { ascending: true }),
      supabase.from('body_measurements').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
      supabase.from('tirzepatide_logs').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', today),
      supabase.from('exercise_logs').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('bioimpedance_records').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
    ])

    const totalWater = (water.data || []).reduce((sum, r) => sum + r.amount_ml, 0)
    const lastW = weights.data?.at(-1)
    const prevW = weights.data?.at(-2)

    setData({
      weights: weights.data || [],
      lastWeight: lastW,
      prevWeight: prevW,
      lastMeasurements: lastMeas.data?.[0] || null,
      lastTirze: lastTirze.data?.[0] || null,
      todayNutrition: nutrition.data || [],
      todayWater: totalWater,
      todayExercise: exercise.data || [],
      lastBio: lastBio.data?.[0] || null,
    })
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const { weights, lastWeight, prevWeight, lastTirze, todayNutrition, todayWater, todayExercise, lastBio } = data
  const todayProtein = todayNutrition.reduce((s, m) => s + (m.protein_g || 0), 0)
  const goalProtein = profile?.goal_protein_g || 120
  const goalWater = profile?.goal_water_ml || 2500
  const weightChange = lastWeight && prevWeight ? (lastWeight.weight_kg - prevWeight.weight_kg).toFixed(1) : null

  // Calcular días para próxima dosis
  let nextDoseInfo = null
  if (lastTirze?.next_dose_date) {
    const diff = Math.ceil((new Date(lastTirze.next_dose_date) - new Date()) / 86400000)
    nextDoseInfo = diff
  }

  const chartData = weights.map(w => ({
    fecha: format(parseISO(w.date), 'd MMM', { locale: es }),
    peso: parseFloat(w.weight_kg)
  }))

  return (
    <div>
      <div className="page-header">
        <h1>¡Hola, {profile?.name?.split(' ')[0] || 'Usuario'}! 👋</h1>
        <p>{format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}</p>
      </div>

      {/* Stats principales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">⚖️ Peso actual</div>
          <div className="stat-card-value">
            {lastWeight ? lastWeight.weight_kg : '—'}
            <span className="stat-card-unit">kg</span>
          </div>
          {weightChange && (
            <div className={`stat-card-change ${parseFloat(weightChange) < 0 ? 'positive' : parseFloat(weightChange) > 0 ? 'negative' : 'neutral'}`}>
              {parseFloat(weightChange) < 0 ? '↓' : parseFloat(weightChange) > 0 ? '↑' : '='} {Math.abs(weightChange)} kg vs anterior
            </div>
          )}
        </div>

        <div className="stat-card">
          <div className="stat-card-label">🥩 Proteína hoy</div>
          <div className="stat-card-value">
            {Math.round(todayProtein)}
            <span className="stat-card-unit">g</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
              <span>Meta: {goalProtein}g</span>
              <span>{Math.min(100, Math.round(todayProtein / goalProtein * 100))}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill green" style={{ width: `${Math.min(100, todayProtein / goalProtein * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">💧 Agua hoy</div>
          <div className="stat-card-value">
            {(todayWater / 1000).toFixed(1)}
            <span className="stat-card-unit">L</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
              <span>Meta: {goalWater / 1000}L</span>
              <span>{Math.min(100, Math.round(todayWater / goalWater * 100))}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, todayWater / goalWater * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">💉 Próxima dosis</div>
          <div className="stat-card-value">
            {nextDoseInfo !== null
              ? nextDoseInfo <= 0 ? 'Hoy' : `${nextDoseInfo}`
              : '—'}
            {nextDoseInfo > 0 && <span className="stat-card-unit">días</span>}
          </div>
          <div className={`stat-card-change ${nextDoseInfo <= 1 ? 'negative' : 'neutral'}`}>
            {lastTirze ? `Última: ${lastTirze.dose_mg}mg` : 'Sin registros aún'}
          </div>
        </div>

        {lastBio && (
          <div className="stat-card">
            <div className="stat-card-label">🔬 % Grasa</div>
            <div className="stat-card-value">
              {lastBio.body_fat_pct}
              <span className="stat-card-unit">%</span>
            </div>
            <div className="stat-card-change neutral">
              Masa muscular: {lastBio.muscle_mass_kg}kg
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-card-label">🏃 Ejercicio hoy</div>
          <div className="stat-card-value">
            {todayExercise.reduce((s, e) => s + e.duration_min, 0)}
            <span className="stat-card-unit">min</span>
          </div>
          <div className="stat-card-change neutral">
            {todayExercise.length === 0 ? 'Sin actividad registrada' : `${todayExercise.length} actividad${todayExercise.length > 1 ? 'es' : ''}`}
          </div>
        </div>
      </div>

      {/* Gráfico de peso */}
      <div className="section-grid">
        <div className="card" style={{ gridColumn: chartData.length > 0 ? 'span 2' : undefined }}>
          <div className="card-title">📈 Evolución de peso (últimos 30 días)</div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--gray-500)' }} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--gray-500)' }} unit="kg" width={50} />
                <Tooltip formatter={(v) => [`${v} kg`, 'Peso']} />
                <Line type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--primary)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">⚖️</div>
              <p>Aún no hay suficientes registros de peso para mostrar el gráfico.</p>
              <Link to="/peso" className="btn-primary" style={{ display: 'inline-block', marginTop: 12 }}>
                Registrar primer peso
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="card">
        <div className="card-title">⚡ Accesos rápidos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          {[
            { to: '/peso', icon: '⚖️', label: 'Registrar peso' },
            { to: '/tirzepatida', icon: '💉', label: 'Registrar dosis' },
            { to: '/nutricion', icon: '🥗', label: 'Registrar comida' },
            { to: '/ejercicio', icon: '🏃', label: 'Registrar ejercicio' },
            { to: '/biopedancia', icon: '🔬', label: 'Biopedancia' },
            { to: '/alimentacion', icon: '🛒', label: 'Lista de compras' },
          ].map(item => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '16px 8px', borderRadius: 'var(--radius)', border: '1.5px solid var(--gray-200)',
              textAlign: 'center', transition: 'all 0.15s', color: 'var(--gray-700)',
              fontSize: 'var(--text-sm)', fontWeight: 500
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-light)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-200)'; e.currentTarget.style.background = 'white' }}
            >
              <span style={{ fontSize: '1.75rem' }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
