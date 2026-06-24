import { useEffect, useState, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Biopedancia() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('registrar')
  const [pdfState, setPdfState] = useState('idle')
  const [pdfMsg, setPdfMsg] = useState('')
  const fileRef = useRef()

  useEffect(() => { loadRecords() }, [user])

  async function loadRecords() {
    const { data } = await supabase.from('bioimpedance_records').select('*')
      .eq('user_id', user.id).order('date', { ascending: false }).limit(24)
    setRecords(data || [])
  }

  function showMsg(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 3000) }

  async function handlePdfUpload(file) {
    if (!file) return
    setPdfState('parsing')
    setPdfMsg('Leyendo PDF de biopedancia...')
    try {
      const reader = new FileReader()
      const base64 = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      setPdfMsg('Analizando datos con IA (Groq)...')
      const { data, error } = await supabase.functions.invoke('parse-bioimpedance', {
        body: { pdf_base64: base64, filename: file.name }
      })

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      const payload = { user_id: user.id, ...data }
      const { error: saveErr } = await supabase.from('bioimpedance_records').insert(payload)
      if (saveErr) throw new Error(saveErr.message)

      setPdfState('done')
      setPdfMsg(`✅ Biopedancia del ${data?.date || 'nuevo registro'} guardada correctamente.`)
      loadRecords()
    } catch (e) {
      setPdfState('error')
      setPdfMsg('❌ ' + e.message)
    }
  }

  async function deleteRecord(id) {
    await supabase.from('bioimpedance_records').delete().eq('id', id)
    loadRecords()
  }

  const last = records[0]
  const prev = records[1]

  const chartData = [...records].reverse().map(r => ({
    fecha: format(parseISO(r.date), 'MMM yy', { locale: es }),
    grasa: r.body_fat_pct,
    musculo: r.muscle_mass_kg,
    agua: r.water_pct,
  }))

  const StatDiff = ({ curr, prev, unit = '', lowerIsBetter = false }) => {
    if (!curr) return <span style={{ color: 'var(--gray-400)' }}>—</span>
    const diff = prev ? (curr - prev).toFixed(1) : null
    const positive = diff !== null && (lowerIsBetter ? parseFloat(diff) < 0 : parseFloat(diff) > 0)
    const negative = diff !== null && (lowerIsBetter ? parseFloat(diff) > 0 : parseFloat(diff) < 0)
    return (
      <span>
        <strong>{curr}{unit}</strong>
        {diff !== null && diff !== '0.0' && (
          <span style={{ fontSize: 'var(--text-xs)', marginLeft: 4, color: positive ? 'var(--secondary)' : negative ? 'var(--danger)' : 'var(--gray-500)' }}>
            {parseFloat(diff) > 0 ? '↑' : '↓'} {Math.abs(diff)}{unit}
          </span>
        )}
      </span>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1>🔬 Biopedancia</h1>
        <p>Registro mensual de composición corporal</p>
      </div>

      {/* Último registro */}
      {last && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {last.body_fat_pct && (
            <div className="stat-card">
              <div className="stat-card-label">🔴 % Grasa corporal</div>
              <div className="stat-card-value" style={{ color: last.body_fat_pct > 30 ? 'var(--danger)' : last.body_fat_pct > 25 ? 'var(--accent)' : 'var(--secondary)' }}>
                {last.body_fat_pct}<span className="stat-card-unit">%</span>
              </div>
              {prev?.body_fat_pct && (
                <div className={`stat-card-change ${last.body_fat_pct < prev.body_fat_pct ? 'positive' : 'negative'}`}>
                  {last.body_fat_pct < prev.body_fat_pct ? '↓' : '↑'} {Math.abs(last.body_fat_pct - prev.body_fat_pct).toFixed(1)}%
                </div>
              )}
            </div>
          )}
          {last.muscle_mass_kg && (
            <div className="stat-card">
              <div className="stat-card-label">💪 Masa muscular</div>
              <div className="stat-card-value">{last.muscle_mass_kg}<span className="stat-card-unit">kg</span></div>
              {prev?.muscle_mass_kg && (
                <div className={`stat-card-change ${last.muscle_mass_kg > prev.muscle_mass_kg ? 'positive' : 'negative'}`}>
                  {last.muscle_mass_kg > prev.muscle_mass_kg ? '↑' : '↓'} {Math.abs(last.muscle_mass_kg - prev.muscle_mass_kg).toFixed(1)}kg
                </div>
              )}
            </div>
          )}
          {last.water_pct && (
            <div className="stat-card">
              <div className="stat-card-label">💧 % Agua corporal</div>
              <div className="stat-card-value">{last.water_pct}<span className="stat-card-unit">%</span></div>
            </div>
          )}
          {last.visceral_fat && (
            <div className="stat-card">
              <div className="stat-card-label">🔶 Grasa visceral</div>
              <div className="stat-card-value" style={{ color: last.visceral_fat > 12 ? 'var(--danger)' : last.visceral_fat > 9 ? 'var(--accent)' : 'var(--secondary)' }}>
                Niv. {last.visceral_fat}
              </div>
              <div className="stat-card-change neutral">
                {last.visceral_fat <= 9 ? 'Normal' : last.visceral_fat <= 14 ? 'Alto' : 'Muy alto'}
              </div>
            </div>
          )}
          {last.metabolic_age && (
            <div className="stat-card">
              <div className="stat-card-label">⏳ Edad metabólica</div>
              <div className="stat-card-value">{last.metabolic_age}<span className="stat-card-unit">años</span></div>
            </div>
          )}
          {last.bmi && (
            <div className="stat-card">
              <div className="stat-card-label">⚖️ IMC</div>
              <div className="stat-card-value">{last.bmi}</div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['registrar', '➕ Registrar'], ['comparar', '📊 Comparativa'], ['grafico', '📈 Gráficos']].map(([key, label]) => (
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
        <div className="card" style={{ border: '2px dashed var(--primary)', background: 'var(--primary-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 32 }}>🔬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--primary)' }}>Subir PDF de biopedancia</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                La IA extrae automáticamente todos los valores del reporte PDF de tu báscula
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && handlePdfUpload(e.target.files[0])} />
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePdfUpload(f) }}
            onClick={() => ['idle','error','done'].includes(pdfState) ? fileRef.current?.click() : null}
            style={{
              border: '2px dashed var(--gray-300)', borderRadius: 12, padding: '32px 16px',
              textAlign: 'center', cursor: 'pointer', background: 'var(--bg-base)',
            }}>
            {pdfState === 'idle' && (
              <>
                <div style={{ fontSize: 44, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Arrastrá el PDF o hacé click para seleccionar</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Solo archivos .pdf — la IA detecta % grasa, músculo, agua, IMC y más</div>
              </>
            )}
            {(pdfState === 'parsing') && (
              <div style={{ color: 'var(--primary)' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
                <div style={{ fontWeight: 600 }}>{pdfMsg}</div>
              </div>
            )}
            {pdfState === 'done' && (
              <div style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                {pdfMsg}
                <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Hacé click para subir otro PDF</div>
              </div>
            )}
            {pdfState === 'error' && (
              <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
                {pdfMsg}
                <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Hacé click para intentar de nuevo</div>
              </div>
            )}
          </div>
          <div style={{ marginTop: 16, padding: 12, background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <strong>💡 Cómo obtener el PDF:</strong> Tu báscula InBody, Tanita, u otra marca suele generar un reporte PDF. También podés escanear el ticket impreso con tu celular.
          </div>
        </div>
      )}

      {/* TAB: Comparativa */}
      {tab === 'comparar' && (
        <div>
          {records.length === 0
            ? <div className="empty-state card"><div className="empty-state-icon">🔬</div><p>No hay biopedancias registradas aún.</p></div>
            : (
              <div className="card">
                <div className="card-title">📊 Histórico de biopedancias</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>% Grasa</th>
                        <th>Músculo (kg)</th>
                        <th>% Agua</th>
                        <th>Gr. Visceral</th>
                        <th>Edad Met.</th>
                        <th>IMC</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => {
                        const p = records[i + 1]
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 500 }}>{format(parseISO(r.date), "d MMM yyyy", { locale: es })}</td>
                            <td><StatDiff curr={r.body_fat_pct} prev={p?.body_fat_pct} unit="%" lowerIsBetter /></td>
                            <td><StatDiff curr={r.muscle_mass_kg} prev={p?.muscle_mass_kg} unit="kg" /></td>
                            <td>{r.water_pct ? `${r.water_pct}%` : '—'}</td>
                            <td>{r.visceral_fat ? `Niv. ${r.visceral_fat}` : '—'}</td>
                            <td>{r.metabolic_age ? `${r.metabolic_age} años` : '—'}</td>
                            <td>{r.bmi || '—'}</td>
                            <td><button className="btn-icon" onClick={() => deleteRecord(r.id)}>🗑️</button></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
        </div>
      )}

      {/* TAB: Gráficos */}
      {tab === 'grafico' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">📈 Evolución de grasa y músculo</div>
            {chartData.length < 2
              ? <div className="empty-state"><p>Necesitás al menos 2 registros para ver el gráfico.</p></div>
              : (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="grasa" name="% Grasa" stroke="var(--danger)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="musculo" name="Músculo (kg)" stroke="var(--secondary)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="agua" name="% Agua" stroke="var(--info)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </div>
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 12 }}>📖 Guía de interpretación</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '% Grasa corporal saludable (hombres)', value: '10-20%' },
                { label: '% Grasa corporal saludable (mujeres)', value: '20-30%' },
                { label: '% Agua corporal ideal', value: '50-65%' },
                { label: 'Grasa visceral nivel normal', value: '1-9' },
                { label: 'Masa muscular (objetivo con tirzepatida)', value: 'Mantener o aumentar' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--gray-600)' }}>{item.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 12, background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)', color: '#92400e', lineHeight: 1.7 }}>
              <strong>⚠️ Importante con tirzepatida:</strong><br />
              La pérdida de peso puede incluir masa muscular. Es crucial mantener alta ingesta de proteína y hacer entrenamiento de fuerza para preservar el músculo.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
