import { useEffect, useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MEAL_TYPES = [
  { id: 'desayuno', label: 'Desayuno', icon: '🌅' },
  { id: 'almuerzo', label: 'Almuerzo', icon: '☀️' },
  { id: 'merienda', label: 'Merienda', icon: '🍎' },
  { id: 'cena',     label: 'Cena',     icon: '🌙' },
  { id: 'snack',    label: 'Snack',    icon: '🥜' },
]

const WATER_AMOUNTS = [100, 200, 250, 500, 750, 1000]

export default function Nutricion() {
  const { user, profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [nutrition, setNutrition] = useState([])
  const [water, setWater] = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('comidas')

  const [mealForm, setMealForm] = useState({
    meal_type: 'desayuno', meal_name: '', protein_g: '',
    calories: '', carbs_g: '', fat_g: '', notes: ''
  })
  const [waterAmount, setWaterAmount] = useState(250)

  const goalProtein = profile?.goal_protein_g || 120
  const goalWater = profile?.goal_water_ml || 2500

  useEffect(() => { loadDay(); loadWeekly() }, [user, selectedDate])

  async function loadDay() {
    const [n, w] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('user_id', user.id).eq('date', selectedDate).order('created_at'),
      supabase.from('water_logs').select('*').eq('user_id', user.id).eq('date', selectedDate).order('logged_at'),
    ])
    setNutrition(n.data || [])
    setWater(w.data || [])
  }

  async function loadWeekly() {
    const from = format(subDays(new Date(), 6), 'yyyy-MM-dd')
    const [n, w] = await Promise.all([
      supabase.from('nutrition_logs').select('date,protein_g').eq('user_id', user.id).gte('date', from),
      supabase.from('water_logs').select('date,amount_ml').eq('user_id', user.id).gte('date', from),
    ])
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      const dayLabel = format(subDays(new Date(), 6 - i), 'EEE', { locale: es })
      const protein = (n.data || []).filter(r => r.date === d).reduce((s, r) => s + (r.protein_g || 0), 0)
      const waterL = (w.data || []).filter(r => r.date === d).reduce((s, r) => s + r.amount_ml, 0) / 1000
      return { dia: dayLabel, proteina: Math.round(protein), agua: parseFloat(waterL.toFixed(1)) }
    })
    setWeeklyData(days)
  }

  function showMsg(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000) }

  async function saveMeal(e) {
    e.preventDefault()
    if (!mealForm.protein_g) return
    const { error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id, date: selectedDate,
      meal_type: mealForm.meal_type,
      meal_name: mealForm.meal_name,
      protein_g: parseFloat(mealForm.protein_g),
      calories: mealForm.calories ? parseInt(mealForm.calories) : null,
      carbs_g: mealForm.carbs_g ? parseFloat(mealForm.carbs_g) : null,
      fat_g: mealForm.fat_g ? parseFloat(mealForm.fat_g) : null,
      notes: mealForm.notes,
    })
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Comida registrada')
    setMealForm(f => ({ ...f, meal_name: '', protein_g: '', calories: '', carbs_g: '', fat_g: '', notes: '' }))
    loadDay(); loadWeekly()
  }

  async function logWater() {
    const { error } = await supabase.from('water_logs').insert({
      user_id: user.id, date: selectedDate, amount_ml: waterAmount
    })
    if (!error) { loadDay(); loadWeekly() }
  }

  async function deleteWaterEntry(id) {
    await supabase.from('water_logs').delete().eq('id', id)
    loadDay()
  }

  async function deleteMeal(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    loadDay(); loadWeekly()
  }

  const totalProtein = nutrition.reduce((s, m) => s + (m.protein_g || 0), 0)
  const totalCalories = nutrition.reduce((s, m) => s + (m.calories || 0), 0)
  const totalWater = water.reduce((s, w) => s + w.amount_ml, 0)
  const proteinPct = Math.min(100, Math.round(totalProtein / goalProtein * 100))
  const waterPct = Math.min(100, Math.round(totalWater / goalWater * 100))

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    meals: nutrition.filter(m => m.meal_type === mt.id)
  }))

  return (
    <div>
      <div className="page-header">
        <h1>🥗 Nutrición</h1>
        <p>Controlá tu proteína, agua y alimentación diaria</p>
      </div>

      {/* Selector de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn-secondary" onClick={() => setSelectedDate(format(subDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>‹</button>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
        <button className="btn-secondary" onClick={() => setSelectedDate(format(new Date(selectedDate + 'T12:00:00'), 'yyyy-MM-dd').replace(/-/g, '-'))}
          disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}>›</button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
          {format(new Date(selectedDate + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Resumen del día */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-label">🥩 Proteína</div>
          <div className="stat-card-value">{Math.round(totalProtein)}<span className="stat-card-unit">g</span></div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
              <span>Meta {goalProtein}g</span><span>{proteinPct}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill green" style={{ width: `${proteinPct}%` }} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">💧 Agua</div>
          <div className="stat-card-value">{(totalWater / 1000).toFixed(1)}<span className="stat-card-unit">L</span></div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>
              <span>Meta {goalWater / 1000}L</span><span>{waterPct}%</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${waterPct}%` }} />
            </div>
          </div>
        </div>

        {totalCalories > 0 && (
          <div className="stat-card">
            <div className="stat-card-label">🔥 Calorías</div>
            <div className="stat-card-value">{totalCalories}<span className="stat-card-unit">kcal</span></div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-card-label">🍽️ Comidas</div>
          <div className="stat-card-value">{nutrition.length}</div>
          <div className="stat-card-change neutral">registradas hoy</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['comidas', '🍽️ Comidas'], ['agua', '💧 Agua'], ['semana', '📊 Esta semana']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500,
              borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === key ? 'var(--primary)' : 'var(--gray-500)',
              marginBottom: -1
            }}>
            {label}
          </button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* TAB: Comidas */}
      {tab === 'comidas' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">➕ Registrar comida</div>
            <form onSubmit={saveMeal}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(mt => (
                  <button key={mt.id} type="button"
                    onClick={() => setMealForm(f => ({ ...f, meal_type: mt.id }))}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)', fontWeight: 600, transition: 'all 0.15s',
                      border: mealForm.meal_type === mt.id ? '2px solid var(--primary)' : '2px solid var(--gray-300)',
                      background: mealForm.meal_type === mt.id ? 'var(--primary-light)' : 'white',
                      color: mealForm.meal_type === mt.id ? 'var(--primary-dark)' : 'var(--gray-600)',
                    }}>
                    {mt.icon} {mt.label}
                  </button>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>¿Qué comiste?</label>
                <input type="text" placeholder="ej: Pechuga a la plancha con arroz"
                  value={mealForm.meal_name} onChange={e => setMealForm(f => ({ ...f, meal_name: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-group">
                  <label>Proteína (g) *</label>
                  <input type="number" step="0.1" min="0" placeholder="ej: 35" required
                    value={mealForm.protein_g} onChange={e => setMealForm(f => ({ ...f, protein_g: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Calorías (kcal)</label>
                  <input type="number" min="0" placeholder="opcional"
                    value={mealForm.calories} onChange={e => setMealForm(f => ({ ...f, calories: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Carbohidratos (g)</label>
                  <input type="number" step="0.1" min="0" placeholder="opcional"
                    value={mealForm.carbs_g} onChange={e => setMealForm(f => ({ ...f, carbs_g: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Grasas (g)</label>
                  <input type="number" step="0.1" min="0" placeholder="opcional"
                    value={mealForm.fat_g} onChange={e => setMealForm(f => ({ ...f, fat_g: e.target.value }))} />
                </div>
              </div>

              <button type="submit" className="btn-primary">Agregar comida</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">📋 Comidas del día</div>
            {nutrition.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">🍽️</div><p>No hay comidas registradas.</p></div>
              : mealsByType.filter(mt => mt.meals.length > 0).map(mt => (
                <div key={mt.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--gray-700)', marginBottom: 8 }}>
                    {mt.icon} {mt.label}
                  </div>
                  {mt.meals.map(meal => (
                    <div key={meal.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', marginBottom: 6
                    }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{meal.meal_name || 'Sin nombre'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                          🥩 {meal.protein_g}g proteína {meal.calories ? `· 🔥 ${meal.calories} kcal` : ''}
                          {meal.carbs_g ? ` · 🌾 ${meal.carbs_g}g` : ''}{meal.fat_g ? ` · 🫒 ${meal.fat_g}g` : ''}
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => deleteMeal(meal.id)}>🗑️</button>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 600 }}>
                    {mt.meals.reduce((s, m) => s + (m.protein_g || 0), 0).toFixed(0)}g proteína
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB: Agua */}
      {tab === 'agua' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">💧 Registrar agua</div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {WATER_AMOUNTS.map(amt => (
                  <button key={amt} type="button"
                    onClick={() => setWaterAmount(amt)}
                    style={{
                      padding: '8px 16px', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-sm)', fontWeight: 600, transition: 'all 0.15s',
                      border: waterAmount === amt ? '2px solid var(--info)' : '2px solid var(--gray-300)',
                      background: waterAmount === amt ? 'var(--info-light)' : 'white',
                      color: waterAmount === amt ? 'var(--info)' : 'var(--gray-600)',
                    }}>
                    {amt >= 1000 ? `${amt / 1000}L` : `${amt}ml`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" min="1" max="5000" value={waterAmount}
                  onChange={e => setWaterAmount(parseInt(e.target.value) || 250)}
                  style={{ width: 100, padding: '8px 12px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>ml</span>
                <button className="btn-primary" onClick={logWater}>💧 Agregar</button>
              </div>
            </div>

            {/* Historial del día */}
            <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8 }}>Registros de hoy</div>
              {water.length === 0
                ? <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-400)' }}>Aún no tomaste agua hoy.</p>
                : water.map(w => (
                  <div key={w.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid var(--gray-100)'
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)' }}>💧 {w.amount_ml} ml</span>
                    <button className="btn-icon" onClick={() => deleteWaterEntry(w.id)}>🗑️</button>
                  </div>
                ))}
              {water.length > 0 && (
                <div style={{ marginTop: 12, fontWeight: 700, color: 'var(--info)' }}>
                  Total: {(totalWater / 1000).toFixed(2)} L de {goalWater / 1000} L meta
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">💧 Progreso de hidratación</div>
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
                <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="80" cy="80" r="65" fill="none" stroke="var(--gray-200)" strokeWidth="12" />
                  <circle cx="80" cy="80" r="65" fill="none" stroke="var(--info)" strokeWidth="12"
                    strokeDasharray={`${2 * Math.PI * 65 * waterPct / 100} ${2 * Math.PI * 65}`}
                    strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--info)' }}>{waterPct}%</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>{(totalWater / 1000).toFixed(1)}L</div>
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
                Meta diaria: <strong>{goalWater / 1000} litros</strong>
              </p>
            </div>
            <div style={{ padding: 14, background: 'var(--info-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--info)', lineHeight: 1.8 }}>
              <strong>💡 La tirzepatida y la hidratación:</strong><br />
              Con tirzepatida es crucial mantenerse bien hidratado, especialmente si experimentás náuseas o vómitos. Se recomienda mínimo 2.5L de agua por día.
            </div>
          </div>
        </div>
      )}

      {/* TAB: Semana */}
      {tab === 'semana' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">🥩 Proteína esta semana</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="g" />
                <Tooltip formatter={(v) => [`${v}g`, 'Proteína']} />
                <ReferenceLine y={goalProtein} stroke="var(--secondary)" strokeDasharray="4 4" label={{ value: `Meta ${goalProtein}g`, position: 'right', fontSize: 10 }} />
                <Bar dataKey="proteina" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title">💧 Agua esta semana</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="L" />
                <Tooltip formatter={(v) => [`${v}L`, 'Agua']} />
                <ReferenceLine y={goalWater / 1000} stroke="var(--secondary)" strokeDasharray="4 4" label={{ value: `Meta ${goalWater / 1000}L`, position: 'right', fontSize: 10 }} />
                <Bar dataKey="agua" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
