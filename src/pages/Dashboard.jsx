import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { format, subDays, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadDashboard() }, [user])

  async function loadDashboard() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const sevenAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const thirtyAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    const [
      weightHistory, firstWeightRes, lastMeasRes, lastTirze,
      todayNutrition, todayWater, todayExercise,
      lastBioRes, weekProtein, sleepRes
    ] = await Promise.all([
      supabase.from('weight_records').select('date,weight_kg').eq('user_id', user.id)
        .gte('date', thirtyAgo).order('date', { ascending: true }),
      supabase.from('weight_records').select('weight_kg,date').eq('user_id', user.id)
        .order('date', { ascending: true }).limit(1),
      supabase.from('body_measurements').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
      supabase.from('tirzepatide_logs').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('water_logs').select('amount_ml').eq('user_id', user.id).eq('date', today),
      supabase.from('exercise_logs').select('*').eq('user_id', user.id).eq('date', today),
      supabase.from('bioimpedance_records').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(1),
      supabase.from('nutrition_logs').select('date,protein_g').eq('user_id', user.id).gte('date', sevenAgo),
      supabase.from('sleep_records').select('fecha,duracion_total').eq('user_id', user.id)
        .order('fecha', { ascending: false }).limit(7),
    ])

    const weights = weightHistory.data || []
    const lastW  = weights.at(-1)
    const prevW  = weights.at(-2)
    const firstW = firstWeightRes.data?.[0]

    // Weekly avg protein
    const weekDates = [...new Set((weekProtein.data || []).map(r => r.date))]
    const weekProt = weekProtein.data || []
    const avgProtein = weekDates.length > 0
      ? weekProt.reduce((s, r) => s + (r.protein_g || 0), 0) / weekDates.length
      : null

    // Sleep avg
    const sleepRecs = sleepRes.data || []
    const avgSleep = sleepRecs.length > 0
      ? sleepRecs.reduce((s, r) => s + (r.duracion_total || 0), 0) / sleepRecs.length
      : null

    setData({
      weights,
      lastWeight: lastW,
      prevWeight: prevW,
      firstWeight: firstW,
      lastMeasurements: lastMeasRes.data?.[0] || null,
      lastTirze: lastTirze.data?.[0] || null,
      todayNutrition: todayNutrition.data || [],
      todayWater: (todayWater.data || []).reduce((s, r) => s + r.amount_ml, 0),
      todayExercise: todayExercise.data || [],
      lastBio: lastBioRes.data?.[0] || null,
      avgProtein,
      avgSleep,
      weekDaysLogged: weekDates.length,
    })
    setLoading(false)
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const { weights, lastWeight, prevWeight, firstWeight, lastTirze, todayNutrition,
          todayWater, todayExercise, lastBio, avgProtein, avgSleep, weekDaysLogged } = data

  const goalProtein = profile?.goal_protein_g || 120
  const goalWater   = profile?.goal_water_ml  || 2500
  const todayProtein = todayNutrition.reduce((s, m) => s + (m.protein_g || 0), 0)
  const weightChange = lastWeight && prevWeight
    ? (lastWeight.weight_kg - prevWeight.weight_kg).toFixed(1) : null
  const totalLost = firstWeight && lastWeight
    ? (firstWeight.weight_kg - lastWeight.weight_kg).toFixed(1) : null

  let nextDoseInfo = null
  if (lastTirze?.next_dose_date) {
    nextDoseInfo = Math.ceil((new Date(lastTirze.next_dose_date) - new Date()) / 86400000)
  }

  const chartData = weights.map(w => ({
    fecha: format(parseISO(w.date), 'd MMM', { locale: es }),
    peso: parseFloat(w.weight_kg)
  }))

  const Stat = ({ label, value, unit, sub, subColor }) => (
    <div className="stat-card">
      <div className="stat-card-label">{label}</div>
      <div className="stat-card-value">
        {value ?? '—'}
        {unit && value !== undefined && value !== null && <span className="stat-card-unit">{unit}</span>}
      </div>
      {sub && (
        <div className={`stat-card-change ${subColor || 'neutral'}`}>{sub}</div>
      )}
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1>Hola, {profile?.name?.split(' ')[0] || 'Usuario'}</h1>
        <p style={{ textTransform: 'capitalize' }}>
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* Métricas principales */}
      <div className="stats-grid">
        <Stat
          label="⚖️ Peso actual"
          value={lastWeight?.weight_kg}
          unit="kg"
          sub={weightChange
            ? `${parseFloat(weightChange) < 0 ? '↓' : parseFloat(weightChange) > 0 ? '↑' : '='} ${Math.abs(weightChange)} kg vs anterior`
            : 'Sin registro previo'}
          subColor={parseFloat(weightChange) < 0 ? 'positive' : parseFloat(weightChange) > 0 ? 'negative' : 'neutral'}
        />

        {totalLost !== null && parseFloat(totalLost) > 0 && (
          <div className="stat-card" style={{ borderColor: 'rgba(38,217,160,0.35)' }}>
            <div className="stat-card-label">🏆 Total perdido</div>
            <div className="stat-card-value" style={{ color: 'var(--secondary)' }}>
              {totalLost}
              <span className="stat-card-unit">kg</span>
            </div>
            <div className="stat-card-change positive">
              desde {format(parseISO(firstWeight.date), 'd MMM yy', { locale: es })}
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-card-label">🥩 Proteína hoy</div>
          <div className="stat-card-value">
            {Math.round(todayProtein)}
            <span className="stat-card-unit">g</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Meta {goalProtein}g</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Meta {goalWater / 1000}L</span>
              <span>{Math.min(100, Math.round(todayWater / goalWater * 100))}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, todayWater / goalWater * 100)}%` }} />
            </div>
          </div>
        </div>

        <Stat
          label="💉 Próxima dosis"
          value={nextDoseInfo !== null ? (nextDoseInfo <= 0 ? 'Hoy' : nextDoseInfo) : null}
          unit={nextDoseInfo > 0 ? 'días' : ''}
          sub={lastTirze ? `Última: ${lastTirze.dose_mg}mg` : 'Sin registros'}
          subColor={nextDoseInfo !== null && nextDoseInfo <= 1 ? 'negative' : 'neutral'}
        />

        {lastBio && (
          <div className="stat-card" style={{ borderColor: 'rgba(90,168,240,0.3)' }}>
            <div className="stat-card-label">🔬 Grasa corporal</div>
            <div className="stat-card-value" style={{ color: 'var(--info)' }}>
              {lastBio.body_fat_pct}
              <span className="stat-card-unit">%</span>
            </div>
            <div className="stat-card-change neutral">
              Músculo: {lastBio.muscle_mass_kg} kg
            </div>
          </div>
        )}

        <Stat
          label="🏃 Ejercicio hoy"
          value={todayExercise.reduce((s, e) => s + e.duration_min, 0)}
          unit="min"
          sub={todayExercise.length === 0 ? 'Sin actividad' : `${todayExercise.length} actividad${todayExercise.length > 1 ? 'es' : ''}`}
        />

        {avgProtein !== null && (
          <div className="stat-card">
            <div className="stat-card-label">📊 Proteína (semana)</div>
            <div className="stat-card-value">
              {Math.round(avgProtein)}
              <span className="stat-card-unit">g/día</span>
            </div>
            <div className={`stat-card-change ${avgProtein >= goalProtein * 0.9 ? 'positive' : 'negative'}`}>
              promedio últimos {weekDaysLogged} día{weekDaysLogged !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {avgSleep !== null && (
          <div className="stat-card">
            <div className="stat-card-label">🌙 Sueño (promedio)</div>
            <div className="stat-card-value">
              {avgSleep.toFixed(1)}
              <span className="stat-card-unit">h</span>
            </div>
            <div className={`stat-card-change ${avgSleep >= 7 ? 'positive' : avgSleep >= 6 ? 'neutral' : 'negative'}`}>
              {avgSleep >= 7 ? 'Excelente' : avgSleep >= 6 ? 'Aceptable' : 'Mejorar'}
            </div>
          </div>
        )}
      </div>

      {/* Gráfico de peso */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">📈 Evolución de peso — últimos 30 días</div>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="kg" width={52} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 8, color: 'var(--text-primary)' }}
                formatter={(v) => [`${v} kg`, 'Peso']}
                labelStyle={{ color: 'var(--text-secondary)', fontSize: 11 }}
              />
              {firstWeight && lastWeight && (
                <ReferenceLine
                  y={firstWeight.weight_kg}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  label={{ value: 'Inicio', position: 'insideTopRight', fontSize: 10, fill: 'var(--text-muted)' }}
                />
              )}
              <Line
                type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--primary)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">⚖️</div>
            <p>Aún no hay suficientes registros de peso para mostrar el gráfico.</p>
          </div>
        )}
      </div>

      {/* Resumen del día */}
      <div className="section-grid">
        <div className="card">
          <div className="card-title">📋 Resumen del día</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: '🥩', label: 'Proteína', value: `${Math.round(todayProtein)}g`, meta: `meta ${goalProtein}g`, ok: todayProtein >= goalProtein * 0.9 },
              { icon: '💧', label: 'Agua', value: `${(todayWater / 1000).toFixed(1)}L`, meta: `meta ${goalWater / 1000}L`, ok: todayWater >= goalWater * 0.9 },
              { icon: '🍽️', label: 'Comidas', value: `${todayNutrition.length}`, meta: 'registradas', ok: todayNutrition.length >= 3 },
              { icon: '🏃', label: 'Ejercicio', value: `${todayExercise.reduce((s, e) => s + e.duration_min, 0)} min`, meta: `${todayExercise.length} actividades`, ok: todayExercise.length > 0 },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: `1px solid ${item.ok ? 'rgba(38,217,160,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{item.value}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{item.meta}</span>
                  <span style={{ fontSize: '0.85rem' }}>{item.ok ? '✅' : '○'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info tirzepatida */}
        <div className="card">
          <div className="card-title">💉 Tirzepatida</div>
          {lastTirze ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Dosis actual</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{lastTirze.dose_mg} mg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Última inyección</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {format(parseISO(lastTirze.date), "d 'de' MMM", { locale: es })}
                </span>
              </div>
              {lastTirze.next_dose_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: nextDoseInfo <= 1 ? 'var(--danger-light)' : 'var(--bg-elevated)', border: `1px solid ${nextDoseInfo <= 1 ? 'rgba(240,101,101,0.3)' : 'var(--border)'}` }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Próxima dosis</span>
                  <span style={{ fontWeight: 700, color: nextDoseInfo <= 1 ? 'var(--danger)' : 'var(--accent)' }}>
                    {nextDoseInfo <= 0 ? '¡Hoy!' : `en ${nextDoseInfo} día${nextDoseInfo !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
              {lastTirze.notes && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>Última nota</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{lastTirze.notes}"</div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">💉</div>
              <p>No hay registros de tirzepatida aún.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
