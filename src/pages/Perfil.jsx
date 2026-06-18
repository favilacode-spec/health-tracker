import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Perfil() {
  const { profile, updateProfile } = useAuth()
  const [form, setForm] = useState({
    name: profile?.name || '',
    birth_date: profile?.birth_date || '',
    height_cm: profile?.height_cm || '',
    goal_weight: profile?.goal_weight || '',
    current_dose: profile?.current_dose || 2.5,
    injection_day: profile?.injection_day || 'lunes',
    goal_protein_g: profile?.goal_protein_g || 120,
    goal_water_ml: profile?.goal_water_ml || 2500,
  })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateProfile({
      name: form.name,
      birth_date: form.birth_date || null,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      goal_weight: form.goal_weight ? parseFloat(form.goal_weight) : null,
      current_dose: parseFloat(form.current_dose),
      injection_day: form.injection_day,
      goal_protein_g: parseInt(form.goal_protein_g),
      goal_water_ml: parseInt(form.goal_water_ml),
    })
    setLoading(false)
    if (error) setMsg({ type: 'error', text: 'Error al guardar.' })
    else setMsg({ type: 'success', text: '✅ Perfil actualizado correctamente' })
    setTimeout(() => setMsg({ type: '', text: '' }), 3000)
  }

  const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
  const DOSES = [2.5, 5, 7.5, 10, 12.5, 15]

  return (
    <div>
      <div className="page-header">
        <h1>⚙️ Mi Perfil</h1>
        <p>Configurá tus datos personales y metas</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="card-title">👤 Datos personales</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label>Nombre completo</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Fecha de nacimiento</label>
              <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Altura (cm)</label>
              <input type="number" step="0.1" min="100" max="250" placeholder="ej: 175"
                value={form.height_cm} onChange={e => setForm(f => ({ ...f, height_cm: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Peso objetivo (kg)</label>
              <input type="number" step="0.1" min="30" max="300" placeholder="ej: 80"
                value={form.goal_weight} onChange={e => setForm(f => ({ ...f, goal_weight: e.target.value }))} />
            </div>
          </div>

          <div className="card-title">💉 Tirzepatida</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label>Dosis actual (mg)</label>
              <select value={form.current_dose} onChange={e => setForm(f => ({ ...f, current_dose: e.target.value }))}>
                {DOSES.map(d => <option key={d} value={d}>{d} mg</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Día habitual de inyección</label>
              <select value={form.injection_day} onChange={e => setForm(f => ({ ...f, injection_day: e.target.value }))}>
                {DAYS.map(d => <option key={d} value={d} style={{ textTransform: 'capitalize' }}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="card-title">🎯 Metas diarias</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="form-group">
              <label>Meta de proteína diaria (g)</label>
              <input type="number" min="50" max="400" placeholder="120"
                value={form.goal_protein_g} onChange={e => setForm(f => ({ ...f, goal_protein_g: e.target.value }))} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 2 }}>
                Recomendado: 1.2-1.6g × kg de peso
              </span>
            </div>
            <div className="form-group">
              <label>Meta de agua diaria (ml)</label>
              <input type="number" min="1000" max="6000" step="100" placeholder="2500"
                value={form.goal_water_ml} onChange={e => setForm(f => ({ ...f, goal_water_ml: e.target.value }))} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 2 }}>
                Mínimo 2500ml con tirzepatida
              </span>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </div>
  )
}
