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

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Nutricion() {
  const { user, profile } = useAuth()
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [nutrition, setNutrition] = useState([])
  const [water, setWater]         = useState([])
  const [weeklyData, setWeeklyData] = useState([])
  const [msg, setMsg]   = useState({ type: '', text: '' })
  const [tab, setTab]   = useState('comidas')

  // Manual form
  const [mealForm, setMealForm] = useState({
    meal_type: 'desayuno', meal_name: '', protein_g: '',
    calories: '', carbs_g: '', fat_g: '',
  })
  const [waterAmount, setWaterAmount] = useState(250)

  // AI analysis
  const [iaInput, setIaInput]     = useState('')
  const [iaMealType, setIaMealType] = useState('almuerzo')
  const [iaDate, setIaDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [iaLoading, setIaLoading] = useState(false)
  const [iaResult, setIaResult]   = useState(null)
  const [iaMsg, setIaMsg]         = useState({ type: '', text: '' })
  const [iaEditing, setIaEditing] = useState(null)

  const goalProtein = profile?.goal_protein_g || 120
  const goalWater   = profile?.goal_water_ml  || 2500

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
      meal_type: mealForm.meal_type, meal_name: mealForm.meal_name,
      protein_g: parseFloat(mealForm.protein_g),
      calories: mealForm.calories ? parseInt(mealForm.calories) : null,
      carbs_g: mealForm.carbs_g ? parseFloat(mealForm.carbs_g) : null,
      fat_g: mealForm.fat_g ? parseFloat(mealForm.fat_g) : null,
    })
    if (error) { showMsg('error', 'Error al guardar.'); return }
    showMsg('success', '✅ Comida registrada')
    setMealForm(f => ({ ...f, meal_name: '', protein_g: '', calories: '', carbs_g: '', fat_g: '' }))
    loadDay(); loadWeekly()
  }

  async function logWater() {
    await supabase.from('water_logs').insert({ user_id: user.id, date: selectedDate, amount_ml: waterAmount })
    loadDay(); loadWeekly()
  }

  async function deleteWater(id) {
    await supabase.from('water_logs').delete().eq('id', id); loadDay()
  }

  async function deleteMeal(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id); loadDay(); loadWeekly()
  }

  // ── IA Analysis ──
  async function analyzeWithIA(e) {
    e.preventDefault()
    if (!iaInput.trim()) return
    setIaLoading(true); setIaResult(null); setIaMsg({ type: '', text: '' })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-food`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ food_description: iaInput }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Error al analizar')
      setIaResult(data)
      setIaEditing({ ...data })
    } catch (err) {
      setIaMsg({ type: 'error', text: `Error: ${err.message}` })
    } finally {
      setIaLoading(false)
    }
  }

  async function saveIAResult() {
    if (!iaEditing) return
    const { error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id, date: iaDate, meal_type: iaMealType,
      meal_name: iaEditing.descripcion_normalizada || iaInput.slice(0, 80),
      protein_g: parseFloat(iaEditing.proteinas_g) || 0,
      calories: parseInt(iaEditing.calorias) || null,
      carbs_g: parseFloat(iaEditing.carbos_g) || null,
      fat_g: parseFloat(iaEditing.grasas_g) || null,
    })
    if (error) { setIaMsg({ type: 'error', text: 'Error al guardar.' }); return }
    setIaMsg({ type: 'success', text: '✅ Guardado en tu registro de nutrición' })
    setIaResult(null); setIaEditing(null); setIaInput('')
    if (iaDate === selectedDate) { loadDay(); loadWeekly() }
  }

  const totalProtein   = nutrition.reduce((s, m) => s + (m.protein_g || 0), 0)
  const totalCalories  = nutrition.reduce((s, m) => s + (m.calories || 0), 0)
  const totalWater     = water.reduce((s, w) => s + w.amount_ml, 0)
  const proteinPct     = Math.min(100, Math.round(totalProtein / goalProtein * 100))
  const waterPct       = Math.min(100, Math.round(totalWater / goalWater * 100))
  const mealsByType    = MEAL_TYPES.map(mt => ({ ...mt, meals: nutrition.filter(m => m.meal_type === mt.id) }))

  const MacroBar = ({ label, value, color, max }) => {
    const pct = Math.min(100, Math.round((value / max) * 100))
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
          <span>{label}</span><span>{value}g</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>🥗 Nutrición</h1>
        <p>Controlá tu proteína, agua y alimentación diaria</p>
      </div>

      {/* Selector de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <button className="btn-secondary" style={{ padding: '8px 14px' }}
          onClick={() => setSelectedDate(format(subDays(new Date(selectedDate + 'T12:00'), 1), 'yyyy-MM-dd'))}>‹</button>
        <input type="date" value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }} />
        <button className="btn-secondary" style={{ padding: '8px 14px' }}
          onClick={() => setSelectedDate(format(new Date(selectedDate + 'T12:00'), 'yyyy-MM-dd').replace(/-/g, (m,i) => i > 0 ? m : m))}
          disabled={selectedDate >= format(new Date(), 'yyyy-MM-dd')}>›</button>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
          {format(new Date(selectedDate + 'T12:00'), "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-card-label">🥩 Proteína</div>
          <div className="stat-card-value">{Math.round(totalProtein)}<span className="stat-card-unit">g</span></div>
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
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
          <div className="stat-card-change neutral">registradas</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar">
        {[
          ['comidas', '🍽️ Comidas'],
          ['ia', '🤖 Analizar con IA'],
          ['agua', '💧 Agua'],
          ['semana', '📊 Esta semana'],
        ].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {msg.text && <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>}

      {/* TAB: Comidas */}
      {tab === 'comidas' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">➕ Registrar comida</div>
            <form onSubmit={saveMeal}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(mt => (
                  <button key={mt.id} type="button"
                    onClick={() => setMealForm(f => ({ ...f, meal_type: mt.id }))}
                    style={{
                      padding: '6px 12px', borderRadius: 'var(--radius-full)',
                      fontSize: 'var(--text-xs)', fontWeight: 600,
                      border: mealForm.meal_type === mt.id ? '1.5px solid var(--primary)' : '1.5px solid var(--border-bright)',
                      background: mealForm.meal_type === mt.id ? 'var(--primary-light)' : 'var(--bg-elevated)',
                      color: mealForm.meal_type === mt.id ? 'var(--primary)' : 'var(--text-secondary)',
                    }}>
                    <span className="emoji-bw">{mt.icon}</span> {mt.label}
                  </button>
                ))}
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>¿Qué comiste?</label>
                <input type="text" placeholder="Ej: Pechuga a la plancha con arroz"
                  value={mealForm.meal_name} onChange={e => setMealForm(f => ({ ...f, meal_name: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
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
              <button type="submit" className="btn-primary btn-full">Agregar comida</button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">📋 Comidas del día</div>
            {nutrition.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="empty-state-icon">🍽️</div>
                <p>No hay comidas registradas.</p>
              </div>
            ) : (
              mealsByType.filter(mt => mt.meals.length > 0).map(mt => (
                <div key={mt.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    <span className="emoji-bw">{mt.icon}</span> {mt.label}
                  </div>
                  {mt.meals.map(meal => (
                    <div key={meal.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: 6,
                      border: '1px solid var(--border)',
                    }}>
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>{meal.meal_name || 'Sin nombre'}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          🥩 {meal.protein_g}g {meal.calories ? `· 🔥 ${meal.calories} kcal` : ''}
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
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: IA */}
      {tab === 'ia' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">🤖 Analizar comida con IA</div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
              Describí lo que comiste y la IA calculará los macronutrientes aproximados.
            </p>

            {iaMsg.text && (
              <div className={iaMsg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 12 }}>
                {iaMsg.text}
              </div>
            )}

            <form onSubmit={analyzeWithIA}>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Descripción de la comida</label>
                <textarea
                  placeholder="Ej: 200g de pechuga de pollo a la plancha, 1 taza de arroz integral cocido, ensalada de tomate y lechuga con aceite de oliva"
                  value={iaInput}
                  onChange={e => setIaInput(e.target.value)}
                  style={{ minHeight: 100 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div className="form-group">
                  <label>Tipo de comida</label>
                  <select value={iaMealType} onChange={e => setIaMealType(e.target.value)}>
                    {MEAL_TYPES.map(mt => <option key={mt.id} value={mt.id}>{mt.icon} {mt.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={iaDate} onChange={e => setIaDate(e.target.value)} />
                </div>
              </div>

              <button type="submit" className="btn-primary btn-full" disabled={iaLoading}>
                {iaLoading ? '⏳ Analizando...' : '🔍 Analizar con IA'}
              </button>
            </form>
          </div>

          <div className="card">
            {!iaResult ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <div className="empty-state-icon">🤖</div>
                <p>Los macros aparecerán aquí después de analizar.</p>
                <p style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', maxWidth: 220, margin: '8px auto 0' }}>
                  Sé específico con cantidades y formas de cocción para mejores resultados.
                </p>
              </div>
            ) : (
              <>
                <div className="card-title">📊 Resultado del análisis</div>
                {iaEditing && (
                  <>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 16, fontStyle: 'italic' }}>
                      {iaEditing.descripcion_normalizada}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      {[
                        { key: 'calorias',    label: '🔥 Calorías', unit: 'kcal' },
                        { key: 'proteinas_g', label: '🥩 Proteínas', unit: 'g' },
                        { key: 'carbos_g',    label: '🌾 Carbos',    unit: 'g' },
                        { key: 'grasas_g',    label: '🫒 Grasas',    unit: 'g' },
                        { key: 'fibra_g',     label: '🌿 Fibra',     unit: 'g' },
                      ].map(({ key, label, unit }) => (
                        <div key={key} style={{
                          padding: 12, borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        }}>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="number" step="0.1" min="0"
                              value={iaEditing[key] ?? ''}
                              onChange={e => setIaEditing(ed => ({ ...ed, [key]: e.target.value }))}
                              style={{ width: 70, padding: '4px 8px', borderRadius: 6, fontSize: 'var(--text-sm)', fontWeight: 700 }}
                            />
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <MacroBar label="Proteínas" value={parseFloat(iaEditing.proteinas_g) || 0} color="var(--secondary)" max={100} />
                      <div style={{ marginTop: 6 }}>
                        <MacroBar label="Carbos" value={parseFloat(iaEditing.carbos_g) || 0} color="var(--accent)" max={200} />
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <MacroBar label="Grasas" value={parseFloat(iaEditing.grasas_g) || 0} color="var(--primary)" max={80} />
                      </div>
                    </div>

                    <button className="btn-primary btn-full" onClick={saveIAResult}>
                      💾 Guardar en mi registro
                    </button>
                    <button className="btn-secondary btn-full" style={{ marginTop: 8 }}
                      onClick={() => { setIaResult(null); setIaEditing(null) }}>
                      Descartar
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB: Agua */}
      {tab === 'agua' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">💧 Registrar agua</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {WATER_AMOUNTS.map(amt => (
                <button key={amt} type="button" onClick={() => setWaterAmount(amt)}
                  style={{
                    padding: '8px 14px', borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--text-sm)', fontWeight: 600,
                    border: waterAmount === amt ? '1.5px solid var(--info)' : '1.5px solid var(--border-bright)',
                    background: waterAmount === amt ? 'var(--info-light)' : 'var(--bg-elevated)',
                    color: waterAmount === amt ? 'var(--info)' : 'var(--text-secondary)',
                  }}>
                  {amt >= 1000 ? `${amt / 1000}L` : `${amt}ml`}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
              <input type="number" min="1" max="5000" value={waterAmount}
                onChange={e => setWaterAmount(parseInt(e.target.value) || 250)}
                style={{ width: 90 }} />
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>ml</span>
              <button className="btn-primary" onClick={logWater}>💧 Agregar</button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 8, color: 'var(--text-secondary)' }}>Registros de hoy</div>
              {water.length === 0 ? (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Aún no tomaste agua hoy.</p>
              ) : (
                water.map(w => (
                  <div key={w.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>💧 {w.amount_ml} ml</span>
                    <button className="btn-icon" onClick={() => deleteWater(w.id)}>🗑️</button>
                  </div>
                ))
              )}
              {water.length > 0 && (
                <div style={{ marginTop: 10, fontWeight: 700, color: 'var(--info)', fontSize: 'var(--text-sm)' }}>
                  Total: {(totalWater / 1000).toFixed(2)} L / {goalWater / 1000} L meta
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">💧 Progreso</div>
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
                <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="80" cy="80" r="65" fill="none" stroke="var(--border)" strokeWidth="10" />
                  <circle cx="80" cy="80" r="65" fill="none" stroke="var(--info)" strokeWidth="10"
                    strokeDasharray={`${2 * Math.PI * 65 * waterPct / 100} ${2 * Math.PI * 65}`}
                    strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--info)' }}>{waterPct}%</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{(totalWater / 1000).toFixed(1)}L</div>
                </div>
              </div>
              <p style={{ marginTop: 16, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Meta: <strong style={{ color: 'var(--text-secondary)' }}>{goalWater / 1000} litros</strong>
              </p>
            </div>
            <div style={{ padding: 12, background: 'var(--info-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--info)', lineHeight: 1.7, border: '1px solid rgba(90,168,240,0.2)' }}>
              <strong>💡 Tirzepatida e hidratación:</strong><br />
              Mantente muy hidratado, especialmente los primeros días después de cada inyección. Mínimo 2.5L/día ayuda a reducir náuseas.
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="g" />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 8, color: 'var(--text-primary)' }}
                  formatter={(v) => [`${v}g`, 'Proteína']} labelStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
                <ReferenceLine y={goalProtein} stroke="var(--secondary)" strokeDasharray="4 4"
                  label={{ value: `${goalProtein}g`, position: 'right', fontSize: 10, fill: 'var(--secondary)' }} />
                <Bar dataKey="proteina" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-title">💧 Agua esta semana</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="L" />
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', borderRadius: 8, color: 'var(--text-primary)' }}
                  formatter={(v) => [`${v}L`, 'Agua']} labelStyle={{ color: 'var(--text-secondary)', fontSize: 11 }} />
                <ReferenceLine y={goalWater / 1000} stroke="var(--secondary)" strokeDasharray="4 4"
                  label={{ value: `${goalWater / 1000}L`, position: 'right', fontSize: 10, fill: 'var(--secondary)' }} />
                <Bar dataKey="agua" fill="var(--info)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
