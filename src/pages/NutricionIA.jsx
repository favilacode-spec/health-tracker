import { useState, useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const MEAL_TYPES = [
  { id: 'desayuno',   label: 'Desayuno',   icon: '🌅' },
  { id: 'almuerzo',   label: 'Almuerzo',   icon: '☀️' },
  { id: 'merienda',   label: 'Merienda',   icon: '🍎' },
  { id: 'cena',       label: 'Cena',       icon: '🌙' },
  { id: 'snack',      label: 'Snack',      icon: '🥜' },
]

export default function NutricionIA() {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const [mealType, setMealType] = useState('almuerzo')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const textareaRef = useRef(null)

  // Editable macros after AI analysis
  const [macros, setMacros] = useState({
    calorias: '',
    proteinas_g: '',
    carbos_g: '',
    grasas_g: '',
    fibra_g: '',
    descripcion_normalizada: '',
  })

  async function analyzeFood() {
    if (!input.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSaved(false)

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/analyze-food`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ food_description: input }),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error || 'Error al analizar')
      }

      const data = await resp.json()
      setResult(data)
      setMacros({
        calorias: data.calorias ?? '',
        proteinas_g: data.proteinas_g ?? '',
        carbos_g: data.carbos_g ?? '',
        grasas_g: data.grasas_g ?? '',
        fibra_g: data.fibra_g ?? '',
        descripcion_normalizada: data.descripcion_normalizada ?? input,
      })
    } catch (e) {
      setError('❌ ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function saveToLog() {
    const { error: dbError } = await supabase.from('nutrition_logs').insert({
      user_id: user.id,
      date,
      meal_type: mealType,
      description: macros.descripcion_normalizada || input,
      calories: macros.calorias ? parseInt(macros.calorias) : null,
      protein_g: macros.proteinas_g ? parseFloat(macros.proteinas_g) : null,
      carbs_g: macros.carbos_g ? parseFloat(macros.carbos_g) : null,
      fat_g: macros.grasas_g ? parseFloat(macros.grasas_g) : null,
      fiber_g: macros.fibra_g ? parseFloat(macros.fibra_g) : null,
      notes: `Analizado con IA — descripción original: "${input}"`,
    })
    if (dbError) { setError('❌ Error al guardar: ' + dbError.message); return }
    setSaved(true)
    setInput('')
    setResult(null)
    setMacros({ calorias: '', proteinas_g: '', carbos_g: '', grasas_g: '', fibra_g: '', descripcion_normalizada: '' })
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase.from('nutrition_logs')
      .select('*').eq('user_id', user.id)
      .order('date', { ascending: false }).order('created_at', { ascending: false })
      .limit(30)
    setHistory(data || [])
    setHistoryLoading(false)
    setShowHistory(true)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) analyzeFood()
  }

  const macroFields = [
    { key: 'calorias',    label: 'Calorías',   unit: 'kcal', color: '#e74c3c', icon: '🔥' },
    { key: 'proteinas_g', label: 'Proteínas',  unit: 'g',    color: '#2ecc71', icon: '💪' },
    { key: 'carbos_g',    label: 'Carbos',     unit: 'g',    color: '#f39c12', icon: '🌾' },
    { key: 'grasas_g',    label: 'Grasas',     unit: 'g',    color: '#9b59b6', icon: '🥑' },
    { key: 'fibra_g',     label: 'Fibra',      unit: 'g',    color: '#1abc9c', icon: '🥦' },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>🤖 IA Nutricional</h1>
        <p>Describí lo que comiste y la IA calcula los macros automáticamente</p>
      </div>

      {/* Input de comida */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">🍽️ ¿Qué comiste?</div>

        {/* Selector de tipo de comida */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {MEAL_TYPES.map(m => (
            <button key={m.id} type="button"
              onClick={() => setMealType(m.id)}
              style={{
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-xs)', fontWeight: 600,
                border: mealType === m.id ? '2px solid var(--primary)' : '2px solid var(--gray-300)',
                background: mealType === m.id ? 'var(--primary-light)' : 'white',
                color: mealType === m.id ? 'var(--primary-dark)' : 'var(--gray-600)',
              }}>
              {m.icon} {m.label}
            </button>
          ))}
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ marginLeft: 'auto', padding: '6px 10px', border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }} />
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Describí lo que comiste con el mayor detalle posible...\n\nEjemplos:\n• "Almorcé una milanesa de ternera mediana con ensalada mixta y un vaso de agua"\n• "Desayuné 2 huevos revueltos, 2 tostadas de pan integral con palta y café con leche descremada"\n• "Comí un plato de arroz integral con pollo a la plancha y brócoli al vapor"`}
          style={{
            width: '100%', minHeight: 120, padding: '12px 14px',
            border: '1.5px solid var(--gray-300)', borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-sm)', resize: 'vertical', fontFamily: 'inherit',
            lineHeight: 1.6, boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
            Ctrl+Enter para analizar
          </span>
          <button
            onClick={analyzeFood}
            disabled={loading || !input.trim()}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Analizando...
              </>
            ) : (
              <>🤖 Analizar con IA</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>
      )}

      {/* Saved */}
      {saved && (
        <div className="form-success" style={{ marginBottom: 16 }}>
          ✅ Guardado en tu registro nutricional
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">
            📊 Análisis nutricional
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--gray-500)', marginLeft: 8 }}>
              Podés editar los valores si querés ajustar
            </span>
          </div>

          {/* Descripción normalizada */}
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Descripción (como la entendió la IA)</label>
            <input type="text"
              value={macros.descripcion_normalizada}
              onChange={e => setMacros(m => ({ ...m, descripcion_normalizada: e.target.value }))}
            />
          </div>

          {/* Macros en cards editables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {macroFields.map(f => (
              <div key={f.key} style={{
                border: `2px solid ${f.color}20`,
                borderRadius: 'var(--radius)',
                padding: '14px 12px',
                background: `${f.color}08`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{f.icon}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 6 }}>{f.label}</div>
                <input
                  type="number"
                  value={macros[f.key]}
                  onChange={e => setMacros(m => ({ ...m, [f.key]: e.target.value }))}
                  style={{
                    width: '100%', textAlign: 'center', border: 'none',
                    borderBottom: `2px solid ${f.color}`,
                    background: 'transparent', fontSize: '1.1rem', fontWeight: 700,
                    color: f.color, padding: '2px 0',
                  }}
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)', marginTop: 4 }}>{f.unit}</div>
              </div>
            ))}
          </div>

          {/* Barra de macros visual */}
          {(macros.proteinas_g || macros.carbos_g || macros.grasas_g) && (
            <MacroBar proteinas={+macros.proteinas_g} carbos={+macros.carbos_g} grasas={+macros.grasas_g} />
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button onClick={saveToLog} className="btn-primary">
              💾 Guardar en mi registro
            </button>
            <button onClick={() => { setResult(null); setInput('') }} className="btn-secondary">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      <div style={{ marginTop: 8 }}>
        <button onClick={showHistory ? () => setShowHistory(false) : loadHistory} className="btn-secondary">
          {showHistory ? 'Ocultar historial' : '📋 Ver historial de hoy'}
        </button>
      </div>

      {showHistory && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">📋 Últimos registros</div>
          {historyLoading ? (
            <div className="spinner" style={{ margin: '20px auto' }} />
          ) : history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🍽️</div>
              <p>No hay registros aún. ¡Empezá a registrar tu alimentación!</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Comida</th>
                  <th>Descripción</th>
                  <th>Cal</th>
                  <th>Prot</th>
                  <th>Carbos</th>
                  <th>Grasas</th>
                </tr>
              </thead>
              <tbody>
                {history.map(log => {
                  const meal = MEAL_TYPES.find(m => m.id === log.meal_type)
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                        {format(new Date(log.date + 'T12:00:00'), 'd MMM', { locale: es })}
                      </td>
                      <td>{meal?.icon} {meal?.label || log.meal_type}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.description}
                      </td>
                      <td style={{ color: '#e74c3c', fontWeight: 600 }}>{log.calories ?? '—'}</td>
                      <td style={{ color: '#2ecc71', fontWeight: 600 }}>{log.protein_g ? `${log.protein_g}g` : '—'}</td>
                      <td style={{ color: '#f39c12', fontWeight: 600 }}>{log.carbs_g ? `${log.carbs_g}g` : '—'}</td>
                      <td style={{ color: '#9b59b6', fontWeight: 600 }}>{log.fat_g ? `${log.fat_g}g` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function MacroBar({ proteinas, carbos, grasas }) {
  const total = proteinas + carbos + grasas
  if (!total) return null
  const pProt = Math.round((proteinas / total) * 100)
  const pCarb = Math.round((carbos / total) * 100)
  const pGras = Math.round((grasas / total) * 100)

  return (
    <div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)', marginBottom: 6 }}>
        Distribución de macros (sin contar fibra)
      </div>
      <div style={{ display: 'flex', height: 20, borderRadius: 999, overflow: 'hidden', gap: 2 }}>
        <div style={{ width: `${pProt}%`, background: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>
          {pProt > 8 ? `${pProt}%` : ''}
        </div>
        <div style={{ width: `${pCarb}%`, background: '#f39c12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>
          {pCarb > 8 ? `${pCarb}%` : ''}
        </div>
        <div style={{ width: `${pGras}%`, background: '#9b59b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>
          {pGras > 8 ? `${pGras}%` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
        {[['💪 Proteínas', '#2ecc71', pProt], ['🌾 Carbos', '#f39c12', pCarb], ['🥑 Grasas', '#9b59b6', pGras]].map(([label, color, pct]) => (
          <span key={label} style={{ fontSize: 'var(--text-xs)', color }}>{label} {pct}%</span>
        ))}
      </div>
    </div>
  )
}
