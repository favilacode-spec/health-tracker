import { useEffect, useState, useRef } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const EXERCISE_TYPES = [
  { id: 'caminata',      label: 'Caminata',        icon: '🚶' },
  { id: 'trote',         label: 'Trote/Correr',    icon: '🏃' },
  { id: 'bicicleta',     label: 'Bicicleta',       icon: '🚴' },
  { id: 'natacion',      label: 'Natación',         icon: '🏊' },
  { id: 'pesas',         label: 'Pesas/Fuerza',    icon: '🏋️' },
  { id: 'yoga',          label: 'Yoga/Pilates',     icon: '🧘' },
  { id: 'hiit',          label: 'HIIT',             icon: '⚡' },
  { id: 'eliptica',      label: 'Elíptica',         icon: '🔄' },
  { id: 'funcional',     label: 'Funcional',        icon: '💪' },
  { id: 'otro',          label: 'Otro',             icon: '🏅' },
]

const INTENSITIES = [
  { id: 'baja',   label: 'Baja',   color: '#9a8660' },  /* muted gold */
  { id: 'media',  label: 'Media',  color: '#c9a227' },  /* imperial gold */
  { id: 'alta',   label: 'Alta',   color: '#ede8e0' },  /* cream / high attention */
]

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

export default function Ejercicio() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('historial')

  // Apple Health import state
  const [importWorkouts, setImportWorkouts] = useState([])
  const [importStatus, setImportStatus] = useState('idle')
  const [importMsg, setImportMsg] = useState('')

  // Hevy state
  const [hevyConfig, setHevyConfig] = useState(null)
  const [hevyWorkouts, setHevyWorkouts] = useState([])
  const [hevyApiKeyInput, setHevyApiKeyInput] = useState('')
  const [hevySyncing, setHevySyncing] = useState(false)
  const [hevyMsg, setHevyMsg] = useState({ type: '', text: '' })
  const [hevyLoading, setHevyLoading] = useState(true)
  const [expandedWorkout, setExpandedWorkout] = useState(null)
  const syncIntervalRef = useRef(null)

  useEffect(() => { loadExercises(); loadWeekly() }, [user, selectedDate])

  // Cargar Hevy al montar el componente
  useEffect(() => {
    if (user) loadHevyConfig()
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current) }
  }, [user])

  async function loadExercises() {
    const { data } = await supabase.from('exercise_logs').select('*')
      .eq('user_id', user.id).eq('date', selectedDate).order('created_at', { ascending: false })
    setExercises(data || [])
  }

  async function loadWeekly() {
    const from = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const { data } = await supabase.from('exercise_logs').select('date,duration_min,calories_burned')
      .eq('user_id', user.id).gte('date', from)

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const dayExercises = (data || []).filter(r => r.date === d)
      return {
        dia: format(subDays(new Date(), 6 - i), 'EEE', { locale: es }),
        minutos: dayExercises.reduce((s, e) => s + e.duration_min, 0),
        calorias: dayExercises.reduce((s, e) => s + (e.calories_burned || 0), 0),
      }
    })
    setWeeklyData(days)
  }

  function showMsg(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000) }

  // ─── HEVY FUNCTIONS ──────────────────────────────────────────────────────────

  async function getHevyHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    }
  }

  async function loadHevyConfig() {
    setHevyLoading(true)
    const { data } = await supabase.from('hevy_config').select('*').eq('user_id', user.id).single()
    setHevyConfig(data || null)
    if (data) {
      await loadHevyWorkouts()
      // Auto-sync si pasaron más de 5 min desde el último sync
      const lastSync = new Date(data.last_sync_at)
      if (Date.now() - lastSync.getTime() > SYNC_INTERVAL_MS) {
        syncHevy(true) // silencioso
      }
      // Configurar auto-sync cada 5 min
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = setInterval(() => syncHevy(true), SYNC_INTERVAL_MS)
    }
    setHevyLoading(false)
  }

  async function loadHevyWorkouts() {
    const { data } = await supabase.from('hevy_workouts')
      .select('*').eq('user_id', user.id)
      .order('start_time', { ascending: false }).limit(30)
    setHevyWorkouts(data || [])
  }

  async function saveHevyKey() {
    const key = hevyApiKeyInput.trim()
    if (!key) return
    setHevySyncing(true)
    setHevyMsg({ type: '', text: '' })
    try {
      const headers = await getHevyHeaders()
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-hevy`,
        { method: 'POST', headers, body: JSON.stringify({ action: 'save_key', api_key: key }) }
      )
      const result = await resp.json()
      if (!resp.ok) {
        setHevyMsg({ type: 'error', text: result.error || 'Error al guardar la clave' })
      } else {
        setHevyApiKeyInput('')
        setHevyMsg({ type: 'success', text: '✅ Hevy conectado. Sincronizando historial...' })
        await loadHevyConfig()
        await syncHevy(false)
      }
    } catch (err) {
      setHevyMsg({ type: 'error', text: 'Error de conexión: ' + err.message })
    }
    setHevySyncing(false)
  }

  async function syncHevy(silent = false) {
    if (!silent) setHevySyncing(true)
    try {
      const headers = await getHevyHeaders()
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-hevy`,
        { method: 'POST', headers, body: JSON.stringify({ action: 'sync' }) }
      )
      const result = await resp.json()
      if (resp.ok) {
        if (!silent && result.synced > 0) {
          setHevyMsg({ type: 'success', text: `✅ ${result.synced} entrenamientos sincronizados` })
        } else if (!silent) {
          setHevyMsg({ type: 'success', text: '✅ Todo actualizado' })
        }
        await loadHevyWorkouts()
        // Actualizar config local
        const { data } = await supabase.from('hevy_config').select('*').eq('user_id', user.id).single()
        setHevyConfig(data || null)
      } else if (!silent) {
        setHevyMsg({ type: 'error', text: result.error || 'Error al sincronizar' })
      }
    } catch (err) {
      if (!silent) setHevyMsg({ type: 'error', text: 'Error: ' + err.message })
    }
    if (!silent) setHevySyncing(false)
  }

  async function disconnectHevy() {
    if (!confirm('¿Desconectar Hevy? Se eliminarán los entrenamientos sincronizados.')) return
    setHevySyncing(true)
    try {
      const headers = await getHevyHeaders()
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-hevy`,
        { method: 'POST', headers, body: JSON.stringify({ action: 'disconnect' }) }
      )
      setHevyConfig(null)
      setHevyWorkouts([])
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
      setHevyMsg({ type: '', text: '' })
    } catch (err) {
      setHevyMsg({ type: 'error', text: 'Error: ' + err.message })
    }
    setHevySyncing(false)
  }

  function formatLastSync(isoString) {
    if (!isoString || isoString === '1970-01-01T00:00:00Z') return 'Nunca'
    const date = new Date(isoString)
    const diffMs = Date.now() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Justo ahora'
    if (diffMin < 60) return `hace ${diffMin} min`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `hace ${diffH}h`
    return format(date, "d 'de' MMM", { locale: es })
  }

  function formatVolume(kg) {
    if (!kg || kg === 0) return null
    if (kg >= 1000) return `${(kg / 1000).toFixed(1)} ton`
    return `${Math.round(kg)} kg`
  }

  // ─── APPLE HEALTH ────────────────────────────────────────────────────────────

  const APPLE_TYPE_MAP = {
    HKWorkoutActivityTypeRunning: 'trote',
    HKWorkoutActivityTypeWalking: 'caminata',
    HKWorkoutActivityTypeCycling: 'bicicleta',
    HKWorkoutActivityTypeSwimming: 'natacion',
    HKWorkoutActivityTypeHighIntensityIntervalTraining: 'hiit',
    HKWorkoutActivityTypeStrengthTraining: 'pesas',
    HKWorkoutActivityTypeFunctionalStrengthTraining: 'pesas',
    HKWorkoutActivityTypeTraditionalStrengthTraining: 'pesas',
    HKWorkoutActivityTypeYoga: 'yoga',
    HKWorkoutActivityTypePilates: 'yoga',
    HKWorkoutActivityTypeElliptical: 'eliptica',
    HKWorkoutActivityTypeCrossTraining: 'funcional',
    HKWorkoutActivityTypeMixedCardio: 'funcional',
    HKWorkoutActivityTypeCoreTraining: 'funcional',
    HKWorkoutActivityTypeFlexibility: 'yoga',
    HKWorkoutActivityTypeCooldown: 'caminata',
    HKWorkoutActivityTypeHiking: 'caminata',
  }

  function appleTypeToIntensity(appleType) {
    if (['HKWorkoutActivityTypeHighIntensityIntervalTraining'].includes(appleType)) return 'alta'
    if (['HKWorkoutActivityTypeYoga', 'HKWorkoutActivityTypePilates', 'HKWorkoutActivityTypeFlexibility', 'HKWorkoutActivityTypeCooldown'].includes(appleType)) return 'baja'
    return 'media'
  }

  function parseAppleHealthXML(file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(e.target.result, 'text/xml')
        const workouts = Array.from(doc.querySelectorAll('Workout'))
        if (workouts.length === 0) {
          setImportMsg('❌ No se encontraron entrenamientos en el archivo.')
          return
        }
        const parsed = workouts.map(w => {
          const appleType = w.getAttribute('workoutActivityType') || ''
          const durationRaw = parseFloat(w.getAttribute('duration') || '0')
          const durationUnit = w.getAttribute('durationUnit') || 'min'
          const durationMin = durationUnit === 'min' ? Math.round(durationRaw) : Math.round(durationRaw / 60)
          const distRaw = parseFloat(w.getAttribute('totalDistance') || '0')
          const distUnit = w.getAttribute('totalDistanceUnit') || 'km'
          let distKm = null
          if (distRaw > 0) {
            if (distUnit === 'km') distKm = Math.round(distRaw * 100) / 100
            else if (distUnit === 'mi') distKm = Math.round(distRaw * 1.60934 * 100) / 100
            else if (distUnit === 'm') distKm = Math.round(distRaw / 10) / 100
          }
          const calRaw = parseFloat(w.getAttribute('totalEnergyBurned') || '0')
          const calUnit = w.getAttribute('totalEnergyBurnedUnit') || 'Cal'
          let cal = null
          if (calRaw > 0) cal = calUnit === 'kJ' ? Math.round(calRaw / 4.184) : Math.round(calRaw)
          const startDateRaw = w.getAttribute('startDate') || ''
          const date = startDateRaw.split(' ')[0] || format(new Date(), 'yyyy-MM-dd')
          return { date, exercise_type: APPLE_TYPE_MAP[appleType] || 'otro', duration_min: durationMin, intensity: appleTypeToIntensity(appleType), calories_burned: cal, distance_km: distKm, notes: `Importado de ${w.getAttribute('sourceName') || 'Apple Health'}` }
        }).filter(w => w.duration_min > 0)
        setImportWorkouts(parsed)
        setImportStatus('parsed')
        setImportMsg(`✅ Se encontraron ${parsed.length} entrenamientos listos para importar.`)
      } catch {
        setImportMsg('❌ Error al leer el archivo.')
      }
    }
    reader.readAsText(file)
  }

  async function importToSupabase() {
    setImportStatus('importing')
    const rows = importWorkouts.map(w => ({ user_id: user.id, ...w }))
    let errors = 0
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('exercise_logs').insert(rows.slice(i, i + 50))
      if (error) errors++
    }
    setImportStatus('done')
    setImportMsg(errors === 0 ? `🎉 ¡${importWorkouts.length} entrenamientos importados!` : `⚠️ Importados con ${errors} errores en lotes.`)
    loadExercises(); loadWeekly()
  }

  async function deleteExercise(id) {
    await supabase.from('exercise_logs').delete().eq('id', id)
    loadExercises(); loadWeekly()
  }

  const totalMinToday = exercises.reduce((s, e) => s + e.duration_min, 0)
  const totalCalToday = exercises.reduce((s, e) => s + (e.calories_burned || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h1>🏃 Ejercicio</h1>
        <p>Registrá tu actividad física diaria</p>
      </div>

      {/* Selector de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-secondary" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate + 'T12:00:00'), 1), 'yyyy-MM-dd'))}>‹</button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
        <button className="btn-secondary" onClick={() => setSelectedDate(format(new Date(selectedDate + 'T12:00:00'), 'yyyy-MM-dd'))}
          disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}>›</button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          {format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Resumen del día */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-label">⏱️ Tiempo activo</div>
          <div className="stat-card-value">{totalMinToday}<span className="stat-card-unit">min</span></div>
          {totalMinToday >= 30 && <div className="stat-card-change positive">✅ Meta diaria cumplida</div>}
          {totalMinToday > 0 && totalMinToday < 30 && <div className="stat-card-change neutral">Meta: 30+ min</div>}
        </div>
        {totalCalToday > 0 && (
          <div className="stat-card">
            <div className="stat-card-label">🔥 Calorías quemadas</div>
            <div className="stat-card-value">{totalCalToday}<span className="stat-card-unit">kcal</span></div>
          </div>
        )}
        <div className="stat-card">
          <div className="stat-card-label">🏅 Actividades</div>
          <div className="stat-card-value">{exercises.length}</div>
          <div className="stat-card-change neutral">hoy</div>
        </div>
        {hevyConfig && (
          <div className="stat-card">
            <div className="stat-card-label">🏋️ Hevy</div>
            <div className="stat-card-value" style={{ fontSize: '1.2rem' }}>{hevyWorkouts.length}</div>
            <div className="stat-card-change neutral">entrenamientos</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        {[
          ['historial', '📋', 'Historial'],
          ['semana', '📊', 'Semana'],
          ['hevy', '🏋️', hevyConfig ? 'Hevy ✅' : 'Hevy'],
          ['apple', '🍎', 'Apple Health'],
        ].map(([key, em, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            <span className="emoji-bw">{em}</span> {label}
          </button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* ═══════════════════════════════════════════════════════════
          TAB: Historial
      ═══════════════════════════════════════════════════════════ */}
      {tab === 'historial' && (
        <div className="card">
          <div className="card-title">📋 Últimos ejercicios</div>
          <HistorialEjercicio userId={user.id} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: HEVY
      ═══════════════════════════════════════════════════════════ */}
      {tab === 'hevy' && (
        <div>
          {hevyLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : !hevyConfig ? (
            /* ── Sin conectar ── */
            <div>
              <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--primary)' }}>
                <div className="card-title">🏋️ Conectar Hevy</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginBottom: 16 }}>
                  Sincronizá automáticamente tus entrenamientos de Hevy. Los datos se actualizan cada 5 minutos mientras usás la app.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {[
                    { n: '1', text: 'Suscribite a Hevy Pro en la app', icon: '💳' },
                    { n: '2', text: 'Entrá a hevy.com/settings?developer', icon: '🌐' },
                    { n: '3', text: 'Copiá tu API Key', icon: '🔑' },
                    { n: '4', text: 'Pegala acá abajo y conectá', icon: '🔗' },
                  ].map(s => (
                    <div key={s.n} style={{ display: 'flex', gap: 10, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)' }}>
                      <span style={{ background: 'var(--primary)', color: '#000', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)' }}>{s.icon} {s.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="password"
                    placeholder="Pegá tu Hevy API Key aquí"
                    value={hevyApiKeyInput}
                    onChange={e => setHevyApiKeyInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveHevyKey()}
                    style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}
                  />
                  <button
                    className="btn-primary"
                    onClick={saveHevyKey}
                    disabled={hevySyncing || !hevyApiKeyInput.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {hevySyncing ? '⏳ Conectando...' : '🔗 Conectar'}
                  </button>
                </div>
                {hevyMsg.text && (
                  <div className={hevyMsg.type === 'error' ? 'form-error' : 'form-success'} style={{ marginTop: 12 }}>
                    {hevyMsg.text}
                  </div>
                )}
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-gold)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--secondary)' }}>
                    🔒 Tu API key se guarda de forma segura en tu base de datos privada con Row Level Security
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* ── Conectado ── */
            <div>
              {/* Status bar */}
              <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--primary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 6px var(--secondary-glow)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>🏋️ Hevy conectado</div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                        Último sync: {formatLastSync(hevyConfig.last_sync_at)} · {hevyWorkouts.length} entrenamientos · Auto-sync cada 5 min
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-primary"
                      onClick={() => syncHevy(false)}
                      disabled={hevySyncing}
                      style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}
                    >
                      {hevySyncing ? '⏳ Sincronizando...' : '🔄 Sync ahora'}
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={disconnectHevy}
                      disabled={hevySyncing}
                      style={{ fontSize: 'var(--text-sm)', padding: '8px 14px' }}
                    >
                      Desconectar
                    </button>
                  </div>
                </div>
                {hevyMsg.text && (
                  <div className={hevyMsg.type === 'error' ? 'form-error' : 'form-success'} style={{ marginTop: 12 }}>
                    {hevyMsg.text}
                  </div>
                )}
              </div>

              {/* Lista de workouts */}
              {hevyWorkouts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🏋️</div>
                  <p>No hay entrenamientos sincronizados todavía.</p>
                  <button className="btn-primary" onClick={() => syncHevy(false)} style={{ marginTop: 12 }}>
                    Sincronizar ahora
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {hevyWorkouts.map(w => {
                    const isExpanded = expandedWorkout === w.hevy_id
                    const exercises = w.exercises || []
                    const vol = formatVolume(w.total_volume_kg)
                    return (
                      <div key={w.hevy_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {/* Header del workout */}
                        <div
                          onClick={() => setExpandedWorkout(isExpanded ? null : w.hevy_id)}
                          style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                              💪 {w.title || 'Entrenamiento'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                              {w.start_time ? format(new Date(w.start_time), "EEEE d 'de' MMMM, HH:mm", { locale: es }) : '—'}
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                              {w.duration_min > 0 && (
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>⏱️ {w.duration_min} min</span>
                              )}
                              {w.total_sets > 0 && (
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--gray-600)' }}>📊 {w.total_sets} series</span>
                              )}
                              {vol && (
                                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--primary)' }}>🏋️ {vol} vol.</span>
                              )}
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                                {exercises.length} ejercicio{exercises.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <span style={{ color: 'var(--gray-400)', fontSize: 'var(--text-sm)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                        </div>

                        {/* Detalle expandido */}
                        {isExpanded && exercises.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--gray-100)', padding: '12px 18px', background: 'var(--gray-50)' }}>
                            {exercises.map((ex, i) => {
                              const sets = ex.sets || []
                              const workSets = sets.filter(s => s.type !== 'warmup')
                              return (
                                <div key={i} style={{ marginBottom: i < exercises.length - 1 ? 12 : 0 }}>
                                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4 }}>
                                    {ex.title || ex.exercise_template_id}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {sets.map((set, j) => {
                                      const isWarmup = set.type === 'warmup'
                                      const label = set.weight_kg
                                        ? `${set.weight_kg}kg × ${set.reps}`
                                        : set.reps
                                        ? `× ${set.reps}`
                                        : set.duration_seconds
                                        ? `${set.duration_seconds}s`
                                        : '—'
                                      return (
                                        <span key={j} style={{
                                          fontSize: 'var(--text-xs)', fontWeight: 600,
                                          padding: '3px 8px', borderRadius: 20,
                                          background: 'var(--bg-elevated)',
                                          color: isWarmup ? 'var(--secondary)' : 'var(--text-primary)',
                                          border: `1px solid ${isWarmup ? 'var(--border-gold)' : 'var(--border-bright)'}`
                                        }}>
                                          {isWarmup ? '🔥 ' : ''}{label}
                                        </span>
                                      )
                                    })}
                                  </div>
                                  {workSets.length > 0 && workSets[0].weight_kg && (
                                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 3 }}>
                                      Vol: {Math.round(workSets.reduce((s, set) => s + (set.weight_kg || 0) * (set.reps || 0), 0))} kg
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: Apple Health
      ═══════════════════════════════════════════════════════════ */}
      {tab === 'apple' && (
        <div>
          <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #555' }}>
            <div className="card-title">🍎 Cómo exportar desde Apple Health</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 8 }}>
              {[
                { n: '1', text: 'Abrí la app Health en tu iPhone' },
                { n: '2', text: 'Tocá tu foto de perfil (arriba a la derecha)' },
                { n: '3', text: 'Bajá y tocá "Exportar todos los datos de salud"' },
                { n: '4', text: 'Compartí el .zip a tu computadora' },
                { n: '5', text: 'Descomprimí el .zip y buscá el archivo export.xml' },
                { n: '6', text: 'Subí ese archivo acá abajo 👇' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 1.4 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">📁 Subir archivo export.xml</div>
            <div style={{ border: '2px dashed var(--gray-300)', borderRadius: 'var(--radius)', padding: '32px 20px', textAlign: 'center', marginBottom: 16, background: 'var(--gray-50)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📱</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Seleccioná el archivo export.xml</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 16 }}>El archivo puede pesar varios MB, es normal</div>
              <label style={{ cursor: 'pointer' }}>
                <span className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px' }}>Elegir archivo XML</span>
                <input type="file" accept=".xml" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) { setImportStatus('idle'); setImportWorkouts([]); setImportMsg('⏳ Procesando archivo...'); parseAppleHealthXML(file) }
                  }} />
              </label>
            </div>
            {importMsg && <div className={importMsg.startsWith('❌') ? 'form-error' : 'form-success'} style={{ marginBottom: 12 }}>{importMsg}</div>}
            {importStatus === 'parsed' && importWorkouts.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Vista previa — {importWorkouts.length} entrenamientos:</div>
                <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                  <table className="data-table">
                    <thead><tr><th>Fecha</th><th>Ejercicio</th><th>Duración</th><th>Distancia</th><th>Calorías</th></tr></thead>
                    <tbody>
                      {importWorkouts.slice(0, 100).map((w, i) => {
                        const type = EXERCISE_TYPES.find(t => t.id === w.exercise_type)
                        return (
                          <tr key={i}>
                            <td style={{ fontSize: 'var(--text-xs)' }}>{w.date}</td>
                            <td>{type?.icon} {type?.label}</td>
                            <td>{w.duration_min} min</td>
                            <td>{w.distance_km ? `${w.distance_km} km` : '—'}</td>
                            <td>{w.calories_burned ? `🔥 ${w.calories_burned}` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {importWorkouts.length > 100 && <div style={{ textAlign: 'center', padding: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>... y {importWorkouts.length - 100} más</div>}
                </div>
                <button className="btn-primary" onClick={importToSupabase}>✅ Importar {importWorkouts.length} entrenamientos</button>
              </div>
            )}
            {importStatus === 'importing' && <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto 12px' }} /><div>Importando...</div></div>}
            {importStatus === 'done' && <button className="btn-secondary" onClick={() => { setImportStatus('idle'); setImportWorkouts([]); setImportMsg('') }}>Importar otro archivo</button>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB: Semana
      ═══════════════════════════════════════════════════════════ */}
      {tab === 'semana' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">⏱️ Minutos activos esta semana</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="min" />
                <Tooltip formatter={(v) => [`${v} min`, 'Actividad']} />
                <Bar dataKey="minutos" fill="var(--secondary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title">🔥 Calorías quemadas esta semana</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="kcal" />
                <Tooltip formatter={(v) => [`${v} kcal`, 'Calorías']} />
                <Bar dataKey="calorias" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1', padding: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>💡 Recomendaciones con Tirzepatida</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { icon: '🚶', title: 'Caminatas diarias', text: 'Empezá con 20-30 min de caminata al día. Es el ejercicio más seguro al inicio del tratamiento.' },
                { icon: '🏋️', title: 'Entrenamiento de fuerza', text: 'Crucial para preservar masa muscular. 2-3 veces por semana con pesas o resistencia.' },
                { icon: '⚡', title: 'Progresión gradual', text: 'Aumentá intensidad y duración de forma gradual. Escuchá tu cuerpo, especialmente las primeras semanas.' },
                { icon: '🧘', title: 'Recuperación', text: 'Respetá días de descanso. Con tirzepatida, la fatiga puede ser más marcada al inicio.' },
              ].map(tip => (
                <div key={tip.title} style={{ padding: 14, background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4 }}>{tip.icon} {tip.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', lineHeight: 1.6 }}>{tip.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HistorialEjercicio({ userId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('exercise_logs').select('*').eq('user_id', userId)
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setLogs(data || []); setLoading(false) })
  }, [userId])

  if (loading) return <div className="spinner" style={{ margin: '20px auto' }} />
  if (logs.length === 0) return <div className="empty-state"><div className="empty-state-icon">🏃</div><p>No hay ejercicios registrados.</p></div>

  return (
    <table className="data-table">
      <thead><tr><th>Fecha</th><th>Ejercicio</th><th>Duración</th><th>Intensidad</th><th>Calorías</th></tr></thead>
      <tbody>
        {logs.map(ex => {
          const type = EXERCISE_TYPES.find(t => t.id === ex.exercise_type)
          const intensity = INTENSITIES.find(i => i.id === ex.intensity)
          return (
            <tr key={ex.id}>
              <td>{format(parseISO(ex.date), "d MMM yyyy", { locale: es })}</td>
              <td>{type?.icon} {type?.label || ex.exercise_type}</td>
              <td>{ex.duration_min} min{ex.distance_km ? ` · ${ex.distance_km}km` : ''}</td>
              <td><span className="badge" style={{ background: intensity?.color + '20', color: intensity?.color }}>{intensity?.label}</span></td>
              <td>{ex.calories_burned ? `🔥 ${ex.calories_burned} kcal` : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
