import { useEffect, useState } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const INJECTION_SITES = [
  { id: 'abdomen_izq',  label: 'Abdomen izq.' },
  { id: 'abdomen_der',  label: 'Abdomen der.' },
  { id: 'muslo_izq',   label: 'Muslo izq.' },
  { id: 'muslo_der',   label: 'Muslo der.' },
  { id: 'brazo_izq',   label: 'Brazo izq.' },
  { id: 'brazo_der',   label: 'Brazo der.' },
]

const SIDE_EFFECTS = [
  'Náuseas', 'Vómitos', 'Diarrea', 'Estreñimiento',
  'Fatiga', 'Dolor de cabeza', 'Dolor en sitio de inyección',
  'Pérdida de apetito', 'Mareos', 'Acidez',
]

const DOSES = [2.5, 5, 7.5, 10, 12.5, 15]

export default function Tirzepatida() {
  const { user, profile } = useAuth()
  const [logs, setLogs] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    dose_mg: profile?.current_dose || 2.5,
    injection_site: '',
    time_of_day: 'mañana',
    side_effects: [],
    notes: '',
    next_dose_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  })

  useEffect(() => { loadLogs() }, [user])

  async function loadLogs() {
    const { data } = await supabase.from('tirzepatide_logs').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(20)
    setLogs(data || [])
  }

  function toggleSideEffect(effect) {
    setForm(f => ({
      ...f,
      side_effects: f.side_effects.includes(effect)
        ? f.side_effects.filter(e => e !== effect)
        : [...f.side_effects, effect]
    }))
  }

  function showMsg(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  async function saveLog(e) {
    e.preventDefault()
    const { error } = await supabase.from('tirzepatide_logs').insert({
      user_id: user.id,
      date: form.date,
      dose_mg: parseFloat(form.dose_mg),
      injection_site: form.injection_site,
      time_of_day: form.time_of_day,
      side_effects: form.side_effects,
      notes: form.notes,
      next_dose_date: form.next_dose_date,
    })
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Dosis registrada correctamente')
    setForm(f => ({ ...f, side_effects: [], notes: '', injection_site: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      next_dose_date: format(addDays(new Date(), 7), 'yyyy-MM-dd') }))
    loadLogs()
  }

  async function deleteLog(id) {
    await supabase.from('tirzepatide_logs').delete().eq('id', id)
    loadLogs()
  }

  const lastLog = logs[0]
  const daysToNext = lastLog?.next_dose_date
    ? Math.ceil((new Date(lastLog.next_dose_date) - new Date()) / 86400000)
    : null

  return (
    <div>
      <div className="page-header">
        <h1>💉 Tirzepatida</h1>
        <p>Registrá cada inyección y seguí tus efectos</p>
      </div>

      {/* Info cards */}
      {lastLog && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-label">Dosis actual</div>
            <div className="stat-card-value">{lastLog.dose_mg}<span className="stat-card-unit">mg</span></div>
            <div className="stat-card-change neutral">Tirzepatida semanal</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Última inyección</div>
            <div className="stat-card-value" style={{ fontSize: 'var(--text-xl)' }}>
              {format(parseISO(lastLog.date), 'd MMM', { locale: es })}
            </div>
            <div className="stat-card-change neutral">{lastLog.injection_site?.replace('_', ' ') || 'Sin sitio'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Próxima dosis</div>
            <div className="stat-card-value" style={{ color: daysToNext <= 1 ? 'var(--danger)' : daysToNext <= 3 ? 'var(--accent)' : 'var(--gray-900)' }}>
              {daysToNext !== null ? (daysToNext <= 0 ? 'Hoy' : daysToNext) : '—'}
              {daysToNext > 0 && <span className="stat-card-unit">días</span>}
            </div>
            {lastLog.next_dose_date && (
              <div className="stat-card-change neutral">
                {format(parseISO(lastLog.next_dose_date), "d 'de' MMMM", { locale: es })}
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Inyecciones totales</div>
            <div className="stat-card-value">{logs.length}</div>
            <div className="stat-card-change neutral">registradas</div>
          </div>
        </div>
      )}

      {/* Alerta próxima dosis */}
      {daysToNext !== null && daysToNext <= 1 && (
        <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24, color: '#991b1b', fontWeight: 500 }}>
          ⚠️ {daysToNext <= 0 ? '¡Hoy es el día de tu inyección!' : '¡Tu próxima dosis es mañana!'}
        </div>
      )}

      <div className="section-grid">
        {/* Formulario */}
        <div className="card">
          <div className="card-title">➕ Registrar inyección</div>
          {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 12 }}>{msg.text}</div>}
          <form onSubmit={saveLog}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
              <div className="form-group">
                <label>Fecha de inyección</label>
                <input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Dosis (mg)</label>
                <select value={form.dose_mg} onChange={e => setForm(f => ({ ...f, dose_mg: e.target.value }))}>
                  {DOSES.map(d => <option key={d} value={d}>{d} mg</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Momento del día</label>
                <select value={form.time_of_day} onChange={e => setForm(f => ({ ...f, time_of_day: e.target.value }))}>
                  <option value="mañana">Mañana</option>
                  <option value="tarde">Tarde</option>
                  <option value="noche">Noche</option>
                </select>
              </div>
              <div className="form-group">
                <label>Próxima dosis</label>
                <input type="date" value={form.next_dose_date}
                  onChange={e => setForm(f => ({ ...f, next_dose_date: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 8 }}>
                Sitio de inyección
              </label>
              <div className="injection-sites">
                {INJECTION_SITES.map(site => (
                  <button key={site.id} type="button"
                    className={`injection-site-btn ${form.injection_site === site.id ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, injection_site: site.id }))}>
                    {site.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--gray-700)', display: 'block', marginBottom: 8 }}>
                Efectos secundarios (si tuviste)
              </label>
              <div className="checkbox-grid">
                {SIDE_EFFECTS.map(effect => (
                  <label key={effect} className="checkbox-item">
                    <input type="checkbox" checked={form.side_effects.includes(effect)}
                      onChange={() => toggleSideEffect(effect)} />
                    {effect}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Notas adicionales</label>
              <textarea placeholder="Cómo te sentiste, reacciones, etc."
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <button type="submit" className="btn-primary">Guardar inyección</button>
          </form>
        </div>

        {/* Rotación de sitios */}
        <div className="card">
          <div className="card-title">🔄 Rotación de sitios</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)', marginBottom: 16 }}>
            Es importante rotar los sitios de inyección para evitar lipodistrofia.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {INJECTION_SITES.map(site => {
              const timesUsed = logs.filter(l => l.injection_site === site.id).length
              const lastUsed = logs.find(l => l.injection_site === site.id)
              return (
                <div key={site.id} style={{
                  padding: '12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--gray-200)', background: 'var(--gray-50)'
                }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4 }}>{site.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                    {timesUsed} veces usado
                  </div>
                  {lastUsed && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 2 }}>
                      Última: {format(parseISO(lastUsed.date), 'd/M/yy')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Info educativa */}
          <div style={{ marginTop: 20, padding: 14, background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--primary-dark)', marginBottom: 8 }}>
              💡 Recordatorios importantes
            </div>
            <ul style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-dark)', lineHeight: 1.8, paddingLeft: 16 }}>
              <li>Inyectá en tejido subcutáneo (grasa), no en músculo</li>
              <li>Rotá siempre el sitio de inyección</li>
              <li>Guardá el medicamento refrigerado (2°C–8°C)</li>
              <li>Dejá llegar a temperatura ambiente antes de inyectar</li>
              <li>Dosis inicial: 2.5mg durante las primeras 4 semanas</li>
              <li>Aumentos de dosis: cada 4 semanas según tolerancia</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">📋 Historial de inyecciones</div>
        {logs.length === 0
          ? <div className="empty-state"><div className="empty-state-icon">💉</div><p>No hay inyecciones registradas aún.</p></div>
          : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Dosis</th>
                  <th>Sitio</th>
                  <th>Momento</th>
                  <th>Efectos</th>
                  <th>Próxima dosis</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{format(parseISO(log.date), "d MMM yyyy", { locale: es })}</td>
                    <td><span className="badge badge-primary">{log.dose_mg} mg</span></td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{log.injection_site?.replace('_', ' ') || '—'}</td>
                    <td style={{ fontSize: 'var(--text-xs)', textTransform: 'capitalize' }}>{log.time_of_day || '—'}</td>
                    <td>
                      {log.side_effects?.length > 0
                        ? <span title={log.side_effects.join(', ')} style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
                          ⚠️ {log.side_effects.length} efecto{log.side_effects.length > 1 ? 's' : ''}
                        </span>
                        : <span style={{ color: 'var(--secondary)', fontSize: 'var(--text-xs)' }}>✅ Sin efectos</span>
                      }
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {log.next_dose_date ? format(parseISO(log.next_dose_date), "d MMM", { locale: es }) : '—'}
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => deleteLog(log.id)} title="Eliminar">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  )
}
