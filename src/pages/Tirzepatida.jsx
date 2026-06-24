import { useEffect, useState } from 'react'
import { format, parseISO, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const INJECTION_SITES = [
  { id: 'abdomen_izq', label: 'Abdomen izq.' },
  { id: 'abdomen_der', label: 'Abdomen der.' },
  { id: 'muslo_izq',   label: 'Muslo izq.' },
  { id: 'muslo_der',   label: 'Muslo der.' },
  { id: 'brazo_izq',   label: 'Brazo izq.' },
  { id: 'brazo_der',   label: 'Brazo der.' },
]

const DOSES = [2.5, 5, 7.5, 10, 12.5, 15]

export default function Tirzepatida() {
  const { user, profile } = useAuth()
  const [logs, setLogs] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('registro')
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    dose_mg: profile?.current_dose || 2.5,
    injection_site: '',
    time_of_day: 'mañana',
    notes: '',
    next_dose_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  })

  useEffect(() => { loadLogs() }, [user])

  async function loadLogs() {
    const { data } = await supabase.from('tirzepatide_logs').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(30)
    setLogs(data || [])
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
      side_effects: [],
      notes: form.notes,
      next_dose_date: form.next_dose_date,
    })
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Inyección registrada')
    setForm(f => ({
      ...f, notes: '', injection_site: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      next_dose_date: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    }))
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

  const logsWithNotes = logs.filter(l => l.notes?.trim())

  return (
    <div>
      <div className="page-header">
        <h1>💉 Tirzepatida</h1>
        <p>Registrá inyecciones y llevá tu diario de bienestar</p>
      </div>

      {/* Stat cards */}
      {lastLog && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-card-label">Dosis actual</div>
            <div className="stat-card-value" style={{ color: 'var(--primary)' }}>
              {lastLog.dose_mg}<span className="stat-card-unit">mg</span>
            </div>
            <div className="stat-card-change neutral">Tirzepatida semanal</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Última inyección</div>
            <div className="stat-card-value" style={{ fontSize: 'var(--text-xl)' }}>
              {format(parseISO(lastLog.date), "d 'de' MMM", { locale: es })}
            </div>
            <div className="stat-card-change neutral">
              {lastLog.injection_site?.replace('_', ' ') || 'Sin sitio'} · {lastLog.time_of_day}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Próxima dosis</div>
            <div className="stat-card-value" style={{ color: daysToNext <= 1 ? 'var(--danger)' : daysToNext <= 3 ? 'var(--accent)' : 'var(--text-primary)' }}>
              {daysToNext !== null ? (daysToNext <= 0 ? 'Hoy' : daysToNext) : '—'}
              {daysToNext > 0 && <span className="stat-card-unit">días</span>}
            </div>
            {lastLog.next_dose_date && (
              <div className="stat-card-change neutral">
                {format(parseISO(lastLog.next_dose_date), "EEEE d MMM", { locale: es })}
              </div>
            )}
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Total inyecciones</div>
            <div className="stat-card-value">{logs.length}</div>
            <div className="stat-card-change neutral">registradas</div>
          </div>
        </div>
      )}

      {/* Alerta próxima dosis */}
      {daysToNext !== null && daysToNext <= 1 && (
        <div className="alert alert-warning" style={{ marginBottom: 24 }}>
          ⚠️ {daysToNext <= 0 ? '¡Hoy es el día de tu inyección!' : '¡Tu próxima dosis es mañana!'}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-bar">
        {[['registro', '💉 Registrar'], ['notas', '📓 Diario'], ['rotacion', '🔄 Rotación'], ['historial', '📋 Historial']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {msg.text && (
        <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* TAB: Registro */}
      {tab === 'registro' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">➕ Registrar inyección</div>
            <form onSubmit={saveLog}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
                <div className="form-group">
                  <label>Fecha</label>
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
                <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
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

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>¿Cómo te sentiste? (notas)</label>
                <textarea
                  placeholder="Ej: Ligeras náuseas por la mañana, mejoró al mediodía. Sin dolor en el sitio. Energía normal..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ minHeight: 100 }}
                />
              </div>

              <button type="submit" className="btn-primary btn-full">Guardar inyección</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">💡 Recordatorios</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '🎯', text: 'Inyectá en tejido subcutáneo (grasa), no en músculo' },
                { icon: '🔄', text: 'Rotá siempre el sitio de inyección' },
                { icon: '❄️', text: 'Guardá refrigerado (2°C–8°C). Puede estar fuera del frío hasta 21 días' },
                { icon: '🌡️', text: 'Dejá llegar a temperatura ambiente antes de inyectar (~30 min)' },
                { icon: '📅', text: 'Dosis inicial: 2.5mg las primeras 4 semanas' },
                { icon: '📈', text: 'Aumentos de dosis cada 4 semanas según tolerancia y médico' },
                { icon: '💧', text: 'Mantente muy hidratado, especialmente los primeros días de cada dosis' },
                { icon: '🍽️', text: 'Evitá comidas grasas o muy abundantes el día de la inyección' },
              ].map((tip, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)'
                }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{tip.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Diario de notas */}
      {tab === 'notas' && (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 20 }}>
            Registro de cómo te sentiste después de cada inyección. Completá el campo "¿Cómo te sentiste?" al registrar una dosis.
          </p>
          {logsWithNotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📓</div>
              <p>No hay notas aún. Escribí cómo te sentiste al registrar tu próxima inyección.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {logsWithNotes.map(log => (
                <div key={log.id} style={{
                  padding: 16, borderRadius: 'var(--radius)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                        {format(parseISO(log.date), "d 'de' MMMM yyyy", { locale: es })}
                      </span>
                      <span className="badge badge-primary">{log.dose_mg} mg</span>
                      {log.injection_site && (
                        <span className="badge badge-gray">{log.injection_site.replace('_', ' ')}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {log.time_of_day}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {log.notes}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: Rotación */}
      {tab === 'rotacion' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">🔄 Historial por sitio</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
              Rotá los sitios para evitar lipodistrofia.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {INJECTION_SITES.map(site => {
                const used = logs.filter(l => l.injection_site === site.id)
                const last = used[0]
                const isRecent = last && Math.abs((new Date() - new Date(last.date)) / 86400000) < 7
                return (
                  <div key={site.id} style={{
                    padding: 14, borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isRecent ? 'rgba(240,165,0,0.3)' : 'var(--border)'}`,
                    background: isRecent ? 'var(--accent-light)' : 'var(--bg-elevated)',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 4, color: 'var(--text-primary)' }}>
                      {site.label} {isRecent && '⚠️'}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {used.length} {used.length === 1 ? 'vez' : 'veces'} usado
                    </div>
                    {last && (
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                        Última: {format(parseISO(last.date), 'd/M/yy')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--accent-light)', border: '1px solid rgba(240,165,0,0.2)', fontSize: 'var(--text-xs)', color: 'var(--accent)' }}>
              ⚠️ Las zonas con inyección reciente (menos de 7 días) están marcadas. Elegí otra zona.
            </div>
          </div>
          <div className="card">
            <div className="card-title">📊 Distribución</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {INJECTION_SITES.map(site => {
                const count = logs.filter(l => l.injection_site === site.id).length
                const pct = logs.length > 0 ? Math.round(count / logs.length * 100) : 0
                return (
                  <div key={site.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <span>{site.label}</span>
                      <span>{count} veces ({pct}%)</span>
                    </div>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Historial */}
      {tab === 'historial' && (
        <div className="card">
          <div className="card-title">📋 Historial de inyecciones</div>
          {logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💉</div>
              <p>No hay inyecciones registradas aún.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Dosis</th>
                  <th>Sitio</th>
                  <th>Momento</th>
                  <th>Próxima</th>
                  <th>Nota</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {format(parseISO(log.date), "d MMM yyyy", { locale: es })}
                    </td>
                    <td><span className="badge badge-primary">{log.dose_mg} mg</span></td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{log.injection_site?.replace('_', ' ') || '—'}</td>
                    <td style={{ fontSize: 'var(--text-xs)', textTransform: 'capitalize' }}>{log.time_of_day || '—'}</td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {log.next_dose_date ? format(parseISO(log.next_dose_date), "d MMM", { locale: es }) : '—'}
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)', maxWidth: 200 }}>
                      {log.notes
                        ? <span title={log.notes} style={{ color: 'var(--text-secondary)' }}>
                          {log.notes.length > 40 ? log.notes.slice(0, 40) + '…' : log.notes}
                        </span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
      )}
    </div>
  )
}
