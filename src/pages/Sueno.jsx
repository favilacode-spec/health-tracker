import { useEffect, useState, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// âââ Apple Health XML parser ââââââââââââââââââââââââââââââââââââââââââââââââââ
function parseAppleHealthSleep(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const records = Array.from(
    doc.querySelectorAll('Record[type="HKCategoryTypeIdentifierSleepAnalysis"]')
  )

  const sessions = {}

  records.forEach(r => {
    const start = new Date(r.getAttribute('startDate'))
    const end   = new Date(r.getAttribute('endDate'))
    const value = r.getAttribute('value') || ''

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return
    const durationH = (end - start) / 3600000
    if (durationH <= 0 || durationH > 16) return

    // Assign to "morning date" â if wakeup is before 14:00, use that date; else next day
    const wakeDate = new Date(end)
    if (wakeDate.getHours() >= 14) wakeDate.setDate(wakeDate.getDate() + 1)
    const key = format(wakeDate, 'yyyy-MM-dd')

    if (!sessions[key]) {
      sessions[key] = {
        fecha: key,
        hora_inicio: start.toISOString(),
        hora_fin: end.toISOString(),
        duracion_rem: 0, duracion_profundo: 0, duracion_ligero: 0,
        duracion_en_cama: 0, duracion_despierto: 0,
      }
    }
    if (start < new Date(sessions[key].hora_inicio)) sessions[key].hora_inicio = start.toISOString()
    if (end   > new Date(sessions[key].hora_fin))   sessions[key].hora_fin   = end.toISOString()

    if (value.includes('AsleepREM'))                                          sessions[key].duracion_rem       += durationH
    else if (value.includes('AsleepDeep') || value.includes('Deep'))          sessions[key].duracion_profundo  += durationH
    else if (value.includes('AsleepCore') || (value.includes('Asleep') && !value.includes('REM') && !value.includes('Deep')))
                                                                               sessions[key].duracion_ligero    += durationH
    else if (value.includes('InBed'))                                          sessions[key].duracion_en_cama   += durationH
    else if (value.includes('Awake'))                                          sessions[key].duracion_despierto += durationH
  })

  return Object.values(sessions)
    .map(s => ({
      ...s,
      duracion_total:     +( s.duracion_rem + s.duracion_profundo + s.duracion_ligero).toFixed(2),
      duracion_rem:       +s.duracion_rem.toFixed(2),
      duracion_profundo:  +s.duracion_profundo.toFixed(2),
      duracion_ligero:    +s.duracion_ligero.toFixed(2),
      duracion_en_cama:   +s.duracion_en_cama.toFixed(2),
      duracion_despierto: +s.duracion_despierto.toFixed(2),
      fuente: 'apple_health',
    }))
    .filter(s => s.duracion_total > 0.5)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

// âââ Helpers ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function hhmm(hours) {
  if (!hours || isNaN(hours)) return 'â'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}h ${m}m`
}

function SleepBar({ value, max, color, label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--gray-600)', marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontWeight: 600 }}>{hhmm(value)}</span>
      </div>
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  fecha: format(new Date(), 'yyyy-MM-dd'),
  hora_inicio: '', hora_fin: '',
  duracion_rem: '', duracion_profundo: '', duracion_ligero: '',
  duracion_en_cama: '', duracion_despierto: '',
  calidad: '', notas: '',
}

// âââ Component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function Sueno() {
  const { user } = useAuth()
  const [tab, setTab]               = useState('registrar')
  const [records, setRecords]       = useState([])
  const [form, setForm]             = useState(EMPTY_FORM)
  const [xmlState, setXmlState]     = useState('idle')
  const [xmlMsg, setXmlMsg]         = useState('')
  const [msg, setMsg]               = useState({ type: '', text: '' })
  const fileRef = useRef()

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function showMsg(type, text) {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4500)
  }

  async function loadRecords() {
    const { data } = await supabase
      .from('sleep_records')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(120)
    setRecords(data || [])
  }

  useEffect(() => { loadRecords() }, [user])

  // âââ XML Upload âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  async function handleXmlUpload(file) {
    if (!file) return
    setXmlState('parsing')
    setXmlMsg('Leyendo export.xml de Apple Health...')
    try {
      const text = await file.text()
      setXmlMsg('Analizando fases de sueÃ±o...')
      const parsed = parseAppleHealthSleep(text)

      if (parsed.length === 0) {
        setXmlState('error')
        setXmlMsg('No se encontraron datos de sueÃ±o en el archivo.')
        return
      }

      setXmlState('saving')
      setXmlMsg(`Guardando ${parsed.length} noches...`)

      const batchSize = 50
      let saved = 0
      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize).map(s => ({ ...s, user_id: user.id }))
        const { error } = await supabase
          .from('sleep_records')
          .upsert(batch, { onConflict: 'user_id,fecha' })
        if (error) throw error
        saved += batch.length
        setXmlMsg(`Guardando... ${saved}/${parsed.length} noches`)
      }

      setXmlState('done')
      setXmlMsg(`â ${parsed.length} noches importadas correctamente.`)
      loadRecords()
    } catch (e) {
      setXmlState('error')
      setXmlMsg('â ' + e.message)
    }
  }

  // âââ Manual save ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  async function saveRecord(e) {
    e.preventDefault()
    const stages = ['duracion_rem','duracion_profundo','duracion_ligero']
    const sumStages = stages.reduce((s, k) => s + (parseFloat(form[k]) || 0), 0)

    let total = sumStages || null
    if (!total && form.hora_inicio && form.hora_fin) {
      const d = (new Date(`${form.fecha}T${form.hora_fin}`) - new Date(`${form.fecha}T${form.hora_inicio}`)) / 3600000
      if (d > 0 && d < 24) total = +d.toFixed(2)
    }

    const payload = {
      user_id: user.id,
      fecha: form.fecha,
      hora_inicio:       form.hora_inicio ? new Date(`${form.fecha}T${form.hora_inicio}`).toISOString() : null,
      hora_fin:          form.hora_fin    ? new Date(`${form.fecha}T${form.hora_fin}`).toISOString()    : null,
      duracion_total:    total,
      duracion_rem:      parseFloat(form.duracion_rem)       || null,
      duracion_profundo: parseFloat(form.duracion_profundo)  || null,
      duracion_ligero:   parseFloat(form.duracion_ligero)    || null,
      duracion_en_cama:  parseFloat(form.duracion_en_cama)   || null,
      duracion_despierto:parseFloat(form.duracion_despierto) || null,
      calidad:           form.calidad ? parseInt(form.calidad) : null,
      notas:             form.notas || null,
      fuente: 'manual',
    }

    const { error } = await supabase.from('sleep_records').insert(payload)
    if (error) { showMsg('error', 'â ' + error.message); return }
    showMsg('success', 'â Noche guardada')
    setForm(EMPTY_FORM)
    loadRecords()
  }

  async function deleteRecord(id) {
    await supabase.from('sleep_records').delete().eq('id', id)
    loadRecords()
  }

  // âââ Stats âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  const last  = records[0]
  const last30 = records.slice(0, 30)
  const avg = key => last30.length > 0
    ? last30.reduce((s, r) => s + (r[key] || 0), 0) / last30.length
    : 0

  const last14 = [...records].reverse().slice(-14)
  const chartData = last14.map(r => ({
    fecha:    format(parseISO(r.fecha), 'dd/MM'),
    Profundo: +(r.duracion_profundo || 0).toFixed(1),
    REM:      +(r.duracion_rem      || 0).toFixed(1),
    Ligero:   +(r.duracion_ligero   || 0).toFixed(1),
  }))

  return (
    <div>
      <div className="page-header">
        <h1>ð SueÃ±o</h1>
        <p>Importa Apple Health o registra manualmente â tirzepatida mejora el sueÃ±o al reducir apnea y grasa visceral</p>
      </div>

      {/* KPIs */}
      {last && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'ð Ãltima noche', val: hhmm(last.duracion_total), sub: format(parseISO(last.fecha), 'd MMM', { locale: es }) },
            { label: 'ð Promedio 30d',  val: hhmm(avg('duracion_total')),    sub: 'total sueÃ±o' },
            { label: 'ð§  REM prom.',     val: hhmm(avg('duracion_rem')),       sub: '~20% ideal' },
            { label: 'ðª Profundo prom.',val: hhmm(avg('duracion_profundo')), sub: '~15% ideal' },
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value" style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24 }}>
        {[['registrar','â¬ï¸ Registrar'],['historial','ð Historial'],['graficos','ð GrÃ¡ficos']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: -1,
            borderBottom: tab === k ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === k ? 'var(--primary)' : 'var(--gray-500)',
          }}>{l}</button>
        ))}
      </div>

      {msg.text && (
        <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>{msg.text}</div>
      )}

      {/* âââ REGISTRAR âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      {tab === 'registrar' && (
        <div>
          {/* Apple Health Import Card */}
          <div className="card" style={{ marginBottom: 24, border: '2px dashed var(--primary)', background: 'var(--primary-light, #eff6ff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>ð</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--primary)' }}>Importar Apple Health</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                  iPhone â Health â tu foto â Export All Health Data â abre el ZIP â sube export.xml
                </div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xml" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && handleXmlUpload(e.target.files[0])} />
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleXmlUpload(f) }}
              onClick={() => ['idle','error','done'].includes(xmlState) ? fileRef.current?.click() : null}
              style={{
                border: '2px dashed var(--gray-300)', borderRadius: 12, padding: '28px 16px',
                textAlign: 'center', cursor: 'pointer', background: 'white',
              }}>
              {xmlState === 'idle' && (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>ð</div>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>Arrastra export.xml o haz click para seleccionar</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Solo archivos .xml â puede tardar varios segundos si es grande</div>
                </>
              )}
              {(xmlState === 'parsing' || xmlState === 'saving') && (
                <div style={{ color: 'var(--primary)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>â³</div>
                  <div style={{ fontWeight: 600 }}>{xmlMsg}</div>
                </div>
              )}
              {xmlState === 'done' && (
                <div style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>â</div>
                  {xmlMsg}
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Haz click para importar otro archivo</div>
                </div>
              )}
              {xmlState === 'error' && (
                <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>â</div>
                  {xmlMsg}
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>Haz click para intentar de nuevo</div>
                </div>
              )}
            </div>
          </div>

          {/* Manual Entry */}
          <div className="card">
            <div className="card-title">ð Registro manual</div>
            <form onSubmit={saveRecord}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Me dormÃ­ a</label>
                  <input type="time" value={form.hora_inicio} onChange={e => setF('hora_inicio', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Me despertÃ© a</label>
                  <input type="time" value={form.hora_fin} onChange={e => setF('hora_fin', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Calidad <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>(1-10)</span></label>
                  <input type="number" min="1" max="10" value={form.calidad}
                    onChange={e => setF('calidad', e.target.value)} placeholder="7" />
                </div>
              </div>

              <div style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                â± Fases de sueÃ±o en horas (opcional â Apple Watch las detecta automÃ¡ticamente)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { k: 'duracion_rem',        l: 'ð§  REM' },
                  { k: 'duracion_profundo',    l: 'ðª Profundo' },
                  { k: 'duracion_ligero',      l: 'ð¤ Ligero' },
                  { k: 'duracion_en_cama',     l: 'ð En cama' },
                  { k: 'duracion_despierto',   l: 'ð Despierto' },
                ].map(f => (
                  <div className="form-group" key={f.k}>
                    <label style={{ fontSize: 11 }}>{f.l}</label>
                    <input type="number" step="0.25" min="0" max="12" value={form[f.k]}
                      onChange={e => setF(f.k, e.target.value)} placeholder="0.0" />
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Notas</label>
                <textarea value={form.notas} onChange={e => setF('notas', e.target.value)}
                  placeholder="Â¿SueÃ±o reparador? Â¿Veces que te despertaste?..." />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="submit" className="btn-primary">ð¾ Guardar noche</button>
                <button type="button" onClick={() => setForm(EMPTY_FORM)}
                  style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>Limpiar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* âââ HISTORIAL âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      {tab === 'historial' && (
        records.length === 0
          ? <div className="empty-state card"><div className="empty-state-icon">ð</div><p>No hay noches registradas aÃºn. Importa tu Apple Health o agrega una manualmente.</p></div>
          : (
            <div className="card">
              <div className="card-title">ð Historial ({records.length} noches)</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Total</th><th>Profundo</th><th>REM</th><th>Ligero</th><th>Calidad</th><th>Fuente</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{format(parseISO(r.fecha), 'd MMM yyyy', { locale: es })}</td>
                        <td style={{
                          fontWeight: 700,
                          color: (r.duracion_total||0) >= 7 ? 'var(--secondary)'
                               : (r.duracion_total||0) >= 6 ? 'var(--accent)'
                               : 'var(--danger)'
                        }}>{hhmm(r.duracion_total)}</td>
                        <td style={{ color: '#0ea5e9' }}>{hhmm(r.duracion_profundo)}</td>
                        <td style={{ color: '#8b5cf6' }}>{hhmm(r.duracion_rem)}</td>
                        <td>{hhmm(r.duracion_ligero)}</td>
                        <td>{r.calidad ? `${r.calidad}/10` : 'â'}</td>
                        <td>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12,
                            background: r.fuente === 'apple_health' ? '#dcfce7' : '#f1f5f9',
                            color:      r.fuente === 'apple_health' ? '#166534' : '#475569' }}>
                            {r.fuente === 'apple_health' ? 'ð Apple' : 'âï¸ Manual'}
                          </span>
                        </td>
                        <td><button className="btn-icon" onClick={() => deleteRecord(r.id)}>ðï¸</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {/* âââ GRÃFICOS ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      {tab === 'graficos' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">ð Ãltimas 14 noches â fases apiladas</div>
            {chartData.length < 2
              ? <div className="empty-state"><p>Necesitas al menos 2 registros.</p></div>
              : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="h" />
                    <Tooltip formatter={(v, n) => [`${v}h`, n]} />
                    <Legend />
                    <Bar dataKey="Profundo" stackId="a" fill="#0ea5e9" name="Profundo" />
                    <Bar dataKey="REM"      stackId="a" fill="#8b5cf6" name="REM" />
                    <Bar dataKey="Ligero"   stackId="a" fill="#6366f1" name="Ligero" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          <div className="card">
            <div className="card-title">ð Promedio Ãºltimas 30 noches</div>
            {records.length === 0
              ? <div className="empty-state"><p>Sin datos aÃºn.</p></div>
              : (
                <>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary)', marginBottom: 4 }}>
                      {hhmm(avg('duracion_total'))}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>promedio de sueÃ±o total Â· OMS recomienda 7-9h</div>
                  </div>
                  <SleepBar value={avg('duracion_profundo')} max={2}   color="#0ea5e9" label="ðª Profundo (ideal â¥1.5h)" />
                  <SleepBar value={avg('duracion_rem')}      max={2}   color="#8b5cf6" label="ð§  REM (ideal â¥1.5h)" />
                  <SleepBar value={avg('duracion_ligero')}   max={4.5} color="#6366f1" label="ð¤ Ligero" />

                  <div style={{ marginTop: 20, padding: 12, background: '#fff7ed', borderRadius: 8, fontSize: 'var(--text-xs)', color: '#92400e', lineHeight: 1.7 }}>
                    <strong>â¡ Tirzepatida y sueÃ±o:</strong> Reducir grasa visceral mejora la apnea del sueÃ±o, aumenta
                    el sueÃ±o profundo (que libera hormona de crecimiento para preservar mÃºsculo) y mejora
                    la sensibilidad a la insulina al dormir. Intenta acostarte a la misma hora cada noche.
                  </div>
                </>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
