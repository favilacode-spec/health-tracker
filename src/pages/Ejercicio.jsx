import { useEffect, useState } from 'react'
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
  { id: 'baja',   label: 'Baja',   color: 'var(--secondary)' },
  { id: 'media',  label: 'Media',  color: 'var(--accent)' },
  { id: 'alta',   label: 'Alta',   color: 'var(--danger)' },
]

export default function Ejercicio() {
  const { user } = useAuth()
  const [exercises, setExercises] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('registrar')

  // Apple Health import state
  const [importWorkouts, setImportWorkouts] = useState([])
  const [importStatus, setImportStatus] = useState('idle') // idle | parsed | importing | done
  const [importMsg, setImportMsg] = useState('')

  const [form, setForm] = useState({
    exercise_type: 'caminata',
    duration_min: '',
    intensity: 'media',
    calories_burned: '',
    distance_km: '',
    sets: '',
    reps: '',
    weight_used_kg: '',
    notes: '',
  })

  useEffect(() => { loadExercises(); loadWeekly() }, [user, selectedDate])

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

  async function saveExercise(e) {
    e.preventDefault()
    if (!form.duration_min) return
    const { error } = await supabase.from('exercise_logs').insert({
      user_id: user.id,
      date: selectedDate,
      exercise_type: form.exercise_type,
      duration_min: parseInt(form.duration_min),
      intensity: form.intensity,
      calories_burned: form.calories_burned ? parseInt(form.calories_burned) : null,
      distance_km: form.distance_km ? parseFloat(form.distance_km) : null,
      sets: form.sets ? parseInt(form.sets) : null,
      reps: form.reps ? parseInt(form.reps) : null,
      weight_used_kg: form.weight_used_kg ? parseFloat(form.weight_used_kg) : null,
      notes: form.notes,
    })
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Ejercicio registrado')
    setForm(f => ({ ...f, duration_min: '', calories_burned: '', distance_km: '', sets: '', reps: '', weight_used_kg: '', notes: '' }))
    loadExercises(); loadWeekly()
  }

  // Apple Health workout type → our exercise types
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
          setImportMsg('❌ No se encontraron entrenamientos en el archivo. Asegurate de subir el archivo export.xml de Apple Health.')
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
          if (calRaw > 0) {
            cal = calUnit === 'kJ' ? Math.round(calRaw / 4.184) : Math.round(calRaw)
          }

          // Parse date from "2026-06-15 10:00:00 -0300"
          const startDateRaw = w.getAttribute('startDate') || ''
          const date = startDateRaw.split(' ')[0] || format(new Date(), 'yyyy-MM-dd')

          const exerciseType = APPLE_TYPE_MAP[appleType] || 'otro'
          const intensity = appleTypeToIntensity(appleType)
          const source = w.getAttribute('sourceName') || 'Apple Health'

          return { date, exercise_type: exerciseType, duration_min: durationMin, intensity, calories_burned: cal, distance_km: distKm, notes: `Importado de ${source}`, _appleType: appleType }
        }).filter(w => w.duration_min > 0)

        setImportWorkouts(parsed)
        setImportStatus('parsed')
        setImportMsg(`✅ Se encontraron ${parsed.length} entrenamientos listos para importar.`)
      } catch {
        setImportMsg('❌ Error al leer el archivo. Verificá que sea el export.xml de Apple Health.')
      }
    }
    reader.readAsText(file)
  }

  async function importToSupabase() {
    setImportStatus('importing')
    const rows = importWorkouts.map(w => ({
      user_id: user.id,
      date: w.date,
      exercise_type: w.exercise_type,
      duration_min: w.duration_min,
      intensity: w.intensity,
      calories_burned: w.calories_burned,
      distance_km: w.distance_km,
      notes: w.notes,
    }))

    // Insert in batches of 50
    let errors = 0
    for (let i = 0; i < rows.length; i += 50) {
      const { error } = await supabase.from('exercise_logs').insert(rows.slice(i, i + 50))
      if (error) errors++
    }

    setImportStatus('done')
    if (errors === 0) {
      setImportMsg(`🎉 ¡${importWorkouts.length} entrenamientos importados exitosamente!`)
    } else {
      setImportMsg(`⚠️ Se importaron la mayoría pero hubo ${errors} errores en lotes.`)
    }
    loadExercises(); loadWeekly()
  }

  async function deleteExercise(id) {
    await supabase.from('exercise_logs').delete().eq('id', id)
    loadExercises(); loadWeekly()
  }

  const totalMinToday = exercises.reduce((s, e) => s + e.duration_min, 0)
  const totalCalToday = exercises.reduce((s, e) => s + (e.calories_burned || 0), 0)
  const selectedType = EXERCISE_TYPES.find(t => t.id === form.exercise_type)
  const showStrengthFields = ['pesas', 'funcional'].includes(form.exercise_type)
  const showDistanceFields = ['caminata', 'trote', 'bicicleta', 'natacion'].includes(form.exercise_type)

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
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['registrar', '➕ Registrar'], ['historial', '📋 Historial'], ['semana', '📊 Semana'], ['apple', '🍎 Apple Health']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500,
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--gray-500)', marginBottom: -1
            }}>
            {label}
          </button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* TAB: Registrar */}
      {tab === 'registrar' && (
        <div className="section-grid">
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title">➕ Nuevo ejercicio</div>
            <form onSubmit={saveExercise}>
              {/* Tipo de ejercicio */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 8 }}>Tipo de ejercicio</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EXERCISE_TYPES.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setForm(f => ({ ...f, exercise_type: t.id }))}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-xs)', fontWeight: 600, transition: 'all 0.15s',
                        border: form.exercise_type === t.id ? '2px solid var(--primary)' : '2px solid var(--gray-300)',
                        background: form.exercise_type === t.id ? 'var(--primary-light)' : 'white',
                        color: form.exercise_type === t.id ? 'var(--primary-dark)' : 'var(--gray-600)',
                      }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Intensidad */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 8 }}>Intensidad</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {INTENSITIES.map(int => (
                    <button key={int.id} type="button"
                      onClick={() => setForm(f => ({ ...f, intensity: int.id }))}
                      style={{
                        padding: '8px 20px', borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'all 0.15s',
                        border: `2px solid ${form.intensity === int.id ? int.color : 'var(--gray-300)'}`,
                        background: form.intensity === int.id ? int.color + '20' : 'white',
                        color: form.intensity === int.id ? int.color : 'var(--gray-600)',
                      }}>
                      {int.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>Duración (min) *</label>
                  <input type="number" min="1" max="600" placeholder="ej: 45" required
                    value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Calorías quemadas</label>
                  <input type="number" min="0" placeholder="opcional"
                    value={form.calories_burned} onChange={e => setForm(f => ({ ...f, calories_burned: e.target.value }))} />
                </div>
                {showDistanceFields && (
                  <div className="form-group">
                    <label>Distancia (km)</label>
                    <input type="number" step="0.01" min="0" placeholder="ej: 3.5"
                      value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} />
                  </div>
                )}
                {showStrengthFields && (
                  <>
                    <div className="form-group">
                      <label>Series</label>
                      <input type="number" min="1" placeholder="ej: 3"
                        value={form.sets} onChange={e => setForm(f => ({ ...f, sets: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Reps por serie</label>
                      <input type="number" min="1" placeholder="ej: 12"
                        value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label>Peso usado (kg)</label>
                      <input type="number" step="0.5" min="0" placeholder="ej: 20"
                        value={form.weight_used_kg} onChange={e => setForm(f => ({ ...f, weight_used_kg: e.target.value }))} />
                    </div>
                  </>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Notas</label>
                <input type="text" placeholder="Cómo te sentiste, circuito, etc."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" className="btn-primary">Guardar ejercicio</button>
            </form>
          </div>

          {exercises.length > 0 && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-title">🏅 Ejercicios de hoy</div>
              {exercises.map(ex => {
                const type = EXERCISE_TYPES.find(t => t.id === ex.exercise_type)
                const intensity = INTENSITIES.find(i => i.id === ex.intensity)
                return (
                  <div key={ex.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 0', borderBottom: '1px solid var(--gray-100)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '1.5rem' }}>{type?.icon || '🏅'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{type?.label || ex.exercise_type}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                          ⏱️ {ex.duration_min} min
                          {ex.distance_km ? ` · 📍 ${ex.distance_km} km` : ''}
                          {ex.calories_burned ? ` · 🔥 ${ex.calories_burned} kcal` : ''}
                          {ex.sets ? ` · ${ex.sets}×${ex.reps}` : ''}
                          {ex.weight_used_kg ? ` · ${ex.weight_used_kg}kg` : ''}
                        </div>
                        {ex.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 2 }}>{ex.notes}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{ background: intensity?.color + '20', color: intensity?.color }}>
                        {intensity?.label}
                      </span>
                      <button className="btn-icon" onClick={() => deleteExercise(ex.id)}>🗑️</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div className="card">
          <div className="card-title">📋 Últimos ejercicios</div>
          <HistorialEjercicio userId={user.id} />
        </div>
      )}

      {/* TAB: Apple Health */}
      {tab === 'apple' && (
        <div>
          {/* Instrucciones */}
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

          {/* Zona de carga */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">📁 Subir archivo export.xml</div>
            <div style={{
              border: '2px dashed var(--gray-300)', borderRadius: 'var(--radius)',
              padding: '32px 20px', textAlign: 'center', marginBottom: 16,
              background: 'var(--gray-50)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📱</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Seleccioná el archivo export.xml</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 16 }}>El archivo puede pesar varios MB, es normal</div>
              <label style={{ cursor: 'pointer' }}>
                <span className="btn-primary" style={{ display: 'inline-block', padding: '10px 24px' }}>
                  Elegir archivo XML
                </span>
                <input type="file" accept=".xml" style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImportStatus('idle')
                      setImportWorkouts([])
                      setImportMsg('⏳ Procesando archivo...')
                      parseAppleHealthXML(file)
                    }
                  }} />
              </label>
            </div>

            {importMsg && (
              <div className={importMsg.startsWith('❌') ? 'form-error' : 'form-success'} style={{ marginBottom: 12 }}>
                {importMsg}
              </div>
            )}

            {importStatus === 'parsed' && importWorkouts.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>
                  Vista previa — {importWorkouts.length} entrenamientos encontrados:
                </div>
                <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Fecha</th><th>Ejercicio</th><th>Duración</th><th>Distancia</th><th>Calorías</th></tr>
                    </thead>
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
                  {importWorkouts.length > 100 && (
                    <div style={{ textAlign: 'center', padding: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                      ... y {importWorkouts.length - 100} más
                    </div>
                  )}
                </div>
                <button className="btn-primary" onClick={importToSupabase}>
                  ✅ Importar {importWorkouts.length} entrenamientos
                </button>
                <span style={{ marginLeft: 12, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                  Se agregarán a tu historial de ejercicios
                </span>
              </div>
            )}

            {importStatus === 'importing' && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                <div>Importando entrenamientos...</div>
              </div>
            )}

            {importStatus === 'done' && (
              <button className="btn-secondary" onClick={() => { setImportStatus('idle'); setImportWorkouts([]); setImportMsg('') }}>
                Importar otro archivo
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB: Semana */}
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
      <thead>
        <tr><th>Fecha</th><th>Ejercicio</th><th>Duración</th><th>Intensidad</th><th>Calorías</th></tr>
      </thead>
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
