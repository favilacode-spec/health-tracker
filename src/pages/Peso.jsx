import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MEASUREMENT_FIELDS = [
  { key: 'waist_cm',       label: 'Cintura',         icon: '📏' },
  { key: 'hip_cm',         label: 'Cadera',           icon: '📏' },
  { key: 'chest_cm',       label: 'Pecho',            icon: '📏' },
  { key: 'arm_right_cm',   label: 'Brazo derecho',    icon: '💪' },
  { key: 'arm_left_cm',    label: 'Brazo izquierdo',  icon: '💪' },
  { key: 'thigh_right_cm', label: 'Muslo derecho',    icon: '🦵' },
  { key: 'thigh_left_cm',  label: 'Muslo izquierdo',  icon: '🦵' },
  { key: 'calf_cm',        label: 'Pantorrilla',      icon: '🦵' },
  { key: 'neck_cm',        label: 'Cuello',           icon: '📏' },
]

export default function Peso() {
  const { user, profile } = useAuth()
  const [weights, setWeights] = useState([])
  const [measurements, setMeasurements] = useState([])
  const [tab, setTab] = useState('peso')
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Peso form
  const [weightForm, setWeightForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), weight_kg: '', notes: '' })
  // Medidas form
  const [measForm, setMeasForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    waist_cm: '', hip_cm: '', chest_cm: '',
    arm_right_cm: '', arm_left_cm: '',
    thigh_right_cm: '', thigh_left_cm: '',
    calf_cm: '', neck_cm: '', notes: ''
  })

  useEffect(() => { loadData() }, [user])

  async function loadData() {
    const [w, m] = await Promise.all([
      supabase.from('weight_records').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(60),
      supabase.from('body_measurements').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(20),
    ])
    setWeights(w.data || [])
    setMeasurements(m.data || [])
  }

  function showMsg(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  async function saveWeight(e) {
    e.preventDefault()
    if (!weightForm.weight_kg) return
    const { error } = await supabase.from('weight_records').insert({
      user_id: user.id,
      date: weightForm.date,
      weight_kg: parseFloat(weightForm.weight_kg),
      notes: weightForm.notes
    })
    if (error) { showMsg('error', 'Error al guardar. Intentá de nuevo.'); return }
    showMsg('success', '✅ Peso guardado correctamente')
    setWeightForm(f => ({ ...f, weight_kg: '', notes: '' }))
    loadData()
  }

  async function deleteWeight(id) {
    await supabase.from('weight_records').delete().eq('id', id)
    loadData()
  }

  async function saveMeasurements(e) {
    e.preventDefault()
    const payload = { user_id: user.id, date: measForm.date, notes: measForm.notes }
    MEASUREMENT_FIELDS.forEach(f => { if (measForm[f.key]) payload[f.key] = parseFloat(measForm[f.key]) })

    const { error } = await supabase.from('body_measurements').insert(payload)
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Medidas guardadas correctamente')
    setMeasForm(f => ({ ...f, ...Object.fromEntries(MEASUREMENT_FIELDS.map(x => [x.key, ''])), notes: '' }))
    loadData()
  }

  // Calcular IMC
  const lastWeight = weights[0]
  const height = profile?.height_cm
  const bmi = lastWeight && height ? (lastWeight.weight_kg / ((height / 100) ** 2)).toFixed(1) : null
  const getBmiLabel = (bmi) => {
    if (!bmi) return null
    const b = parseFloat(bmi)
    if (b < 18.5) return { label: 'Bajo peso', color: 'var(--info)' }
    if (b < 25) return { label: 'Peso normal', color: 'var(--secondary)' }
    if (b < 30) return { label: 'Sobrepeso', color: 'var(--accent)' }
    return { label: 'Obesidad', color: 'var(--danger)' }
  }
  const bmiInfo = getBmiLabel(bmi)

  const chartData = [...weights].reverse().slice(-30).map(w => ({
    fecha: format(parseISO(w.date), 'd/M', { locale: es }),
    peso: parseFloat(w.weight_kg)
  }))

  const lastMeas = measurements[0]
  const prevMeas = measurements[1]

  return (
    <div>
      <div className="page-header">
        <h1>⚖️ Peso y Medidas</h1>
        <p>Seguí tu progreso corporal en el tiempo</p>
      </div>

      {/* IMC card */}
      {bmi && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-label">Peso actual</div>
            <div className="stat-card-value">{lastWeight.weight_kg}<span className="stat-card-unit">kg</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">IMC</div>
            <div className="stat-card-value" style={{ color: bmiInfo?.color }}>{bmi}</div>
            {bmiInfo && <div className="stat-card-change neutral">{bmiInfo.label}</div>}
          </div>
          {profile?.goal_weight && (
            <div className="stat-card">
              <div className="stat-card-label">Por bajar</div>
              <div className="stat-card-value">
                {Math.max(0, lastWeight.weight_kg - profile.goal_weight).toFixed(1)}
                <span className="stat-card-unit">kg</span>
              </div>
              <div className="stat-card-change neutral">Meta: {profile.goal_weight}kg</div>
            </div>
          )}
          <div className="stat-card">
            <div className="stat-card-label">Total bajado</div>
            <div className="stat-card-value" style={{ color: 'var(--secondary)' }}>
              {weights.length > 1 ? Math.abs(weights[weights.length - 1].weight_kg - weights[0].weight_kg).toFixed(1) : '0.0'}
              <span className="stat-card-unit">kg</span>
            </div>
            <div className="stat-card-change positive">desde el inicio</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['peso', '⚖️ Peso'], ['medidas', '📏 Medidas corporales']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500,
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--gray-500)',
              marginBottom: -1, transition: 'all 0.15s'
            }}>
            {label}
          </button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {tab === 'peso' && (
        <div className="section-grid">
          {/* Formulario */}
          <div className="card">
            <div className="card-title">➕ Nuevo registro de peso</div>
            <form onSubmit={saveWeight}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={weightForm.date}
                    onChange={e => setWeightForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Peso (kg)</label>
                  <input type="number" step="0.1" min="30" max="300" placeholder="ej: 85.5"
                    value={weightForm.weight_kg}
                    onChange={e => setWeightForm(f => ({ ...f, weight_kg: e.target.value }))}
                    required />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Notas (opcional)</label>
                <input type="text" placeholder="Condición especial, momento del día..."
                  value={weightForm.notes}
                  onChange={e => setWeightForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>Guardar peso</button>
            </form>
          </div>

          {/* Gráfico */}
          <div className="card">
            <div className="card-title">📈 Evolución</div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} unit="kg" />
                  <Tooltip formatter={(v) => [`${v} kg`, 'Peso']} />
                  <Line type="monotone" dataKey="peso" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="empty-state"><p>Registrá al menos 2 pesos para ver el gráfico.</p></div>}
          </div>

          {/* Historial */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-title">📋 Historial de pesos</div>
            {weights.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">⚖️</div><p>No hay registros aún.</p></div>
              : (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Peso</th><th>Variación</th><th>Notas</th><th></th></tr></thead>
                  <tbody>
                    {weights.map((w, i) => {
                      const prev = weights[i + 1]
                      const diff = prev ? (w.weight_kg - prev.weight_kg).toFixed(1) : null
                      return (
                        <tr key={w.id}>
                          <td>{format(parseISO(w.date), "d 'de' MMMM yyyy", { locale: es })}</td>
                          <td><strong>{w.weight_kg} kg</strong></td>
                          <td>
                            {diff !== null && (
                              <span style={{ color: parseFloat(diff) < 0 ? 'var(--secondary)' : parseFloat(diff) > 0 ? 'var(--danger)' : 'var(--gray-500)', fontWeight: 600 }}>
                                {parseFloat(diff) < 0 ? '↓' : parseFloat(diff) > 0 ? '↑' : '='} {Math.abs(diff)} kg
                              </span>
                            )}
                          </td>
                          <td style={{ color: 'var(--gray-500)', fontSize: 'var(--text-xs)' }}>{w.notes || '-'}</td>
                          <td>
                            <button className="btn-icon" onClick={() => deleteWeight(w.id)} title="Eliminar">🗑️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      )}

      {tab === 'medidas' && (
        <div className="section-grid">
          {/* Formulario medidas */}
          <div className="card">
            <div className="card-title">➕ Registrar medidas</div>
            <form onSubmit={saveMeasurements}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Fecha</label>
                <input type="date" value={measForm.date}
                  onChange={e => setMeasForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {MEASUREMENT_FIELDS.map(field => (
                  <div className="form-group" key={field.key}>
                    <label>{field.icon} {field.label} (cm)</label>
                    <input type="number" step="0.1" placeholder="0.0"
                      value={measForm[field.key]}
                      onChange={e => setMeasForm(f => ({ ...f, [field.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Notas</label>
                <input type="text" value={measForm.notes}
                  onChange={e => setMeasForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>Guardar medidas</button>
            </form>
          </div>

          {/* Última medición vs anterior */}
          <div className="card">
            <div className="card-title">📊 Comparativa</div>
            {!lastMeas
              ? <div className="empty-state"><div className="empty-state-icon">📏</div><p>Aún no hay medidas registradas.</p></div>
              : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Medida</th>
                      <th>Última ({format(parseISO(lastMeas.date), 'd/M/yy')})</th>
                      {prevMeas && <th>Anterior ({format(parseISO(prevMeas.date), 'd/M/yy')})</th>}
                      {prevMeas && <th>Cambio</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {MEASUREMENT_FIELDS.filter(f => lastMeas[f.key]).map(field => {
                      const curr = lastMeas[field.key]
                      const prev = prevMeas?.[field.key]
                      const diff = prev ? (curr - prev).toFixed(1) : null
                      return (
                        <tr key={field.key}>
                          <td>{field.label}</td>
                          <td><strong>{curr} cm</strong></td>
                          {prevMeas && <td>{prev ? `${prev} cm` : '—'}</td>}
                          {prevMeas && (
                            <td style={{ color: diff && parseFloat(diff) < 0 ? 'var(--secondary)' : diff && parseFloat(diff) > 0 ? 'var(--danger)' : 'var(--gray-500)', fontWeight: 600 }}>
                              {diff !== null ? `${parseFloat(diff) < 0 ? '↓' : parseFloat(diff) > 0 ? '↑' : '='} ${Math.abs(diff)} cm` : '—'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
