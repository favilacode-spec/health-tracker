import { useEffect, useState, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── PDF.js loader ──────────────────────────────────────────────────────────────
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(window.pdfjsLib)
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function extractPdfText(file) {
  const pdfjsLib = await loadPdfJs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map(item => item.str).join(' ') + '\n'
  }
  return text
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  fecha: format(new Date(), 'yyyy-MM-dd'),
  peso: '', imc: '', masa_grasa: '', masa_libre_grasa: '',
  masa_muscular: '', masa_muscular_esqueletica: '', agua_corporal: '',
  porcentaje_grasa: '', grasa_visceral: '', indice_apendicular: '',
  metabolismo_basal: '', peso_ideal: '',
  control_peso: '', control_grasa: '', control_masa_magra: '',
  magra_brazo_der: '', magra_brazo_izq: '', magra_tronco: '',
  magra_pierna_der: '', magra_pierna_izq: '',
  grasa_brazo_der: '', grasa_brazo_izq: '', grasa_tronco: '',
  grasa_pierna_der: '', grasa_pierna_izq: '',
  notas: '', fuente: 'manual'
}

function StatDiff({ curr, prev, unit = '', lowerIsBetter = false }) {
  if (!curr) return <span style={{ color: 'var(--gray-400)' }}>—</span>
  const diff = prev != null ? (curr - prev).toFixed(1) : null
  const positive = diff !== null && (lowerIsBetter ? parseFloat(diff) < 0 : parseFloat(diff) > 0)
  const negative = diff !== null && (lowerIsBetter ? parseFloat(diff) > 0 : parseFloat(diff) < 0)
  return (
    <span>
      <strong>{curr}{unit}</strong>
      {diff !== null && diff !== '0.0' && (
        <span style={{
          fontSize: 'var(--text-xs)', marginLeft: 4,
          color: positive ? 'var(--secondary)' : negative ? 'var(--danger)' : 'var(--gray-500)'
        }}>
          {parseFloat(diff) > 0 ? '↑' : '↓'} {Math.abs(diff)}{unit}
        </span>
      )}
    </span>
  )
}

// ── Segmental Body Map ─────────────────────────────────────────────────────────
function BodyMap({ magra, grasa }) {
  const seg = [
    { label: 'Brazo D', magra: magra?.brazo_der, grasa: grasa?.brazo_der, pos: 'top: 22%; left: 12%' },
    { label: 'Brazo I', magra: magra?.brazo_izq, grasa: grasa?.brazo_izq, pos: 'top: 22%; right: 12%' },
    { label: 'Tronco',  magra: magra?.tronco,    grasa: grasa?.tronco,    pos: 'top: 35%; left: 50%; transform: translateX(-50%)' },
    { label: 'Pierna D', magra: magra?.pierna_der, grasa: grasa?.pierna_der, pos: 'top: 62%; left: 20%' },
    { label: 'Pierna I', magra: magra?.pierna_izq, grasa: grasa?.pierna_izq, pos: 'top: 62%; right: 20%' },
  ]
  return (
    <div style={{ position: 'relative', minHeight: 260, background: 'var(--gray-50)', borderRadius: 12, padding: 16 }}>
      {/* Simple body silhouette via divs */}
      <div style={{ position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-200)', border: '2px solid var(--gray-300)' }} />
      <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 60, height: 70, borderRadius: 8, background: 'var(--gray-200)', border: '2px solid var(--gray-300)' }} />
      <div style={{ position: 'absolute', top: '58%', left: 'calc(50% - 16px)', width: 28, height: 80, borderRadius: 8, background: 'var(--gray-200)', border: '2px solid var(--gray-300)' }} />
      <div style={{ position: 'absolute', top: '58%', left: 'calc(50% + 4px)', width: 28, height: 80, borderRadius: 8, background: 'var(--gray-200)', border: '2px solid var(--gray-300)' }} />

      {seg.map(s => (
        <div key={s.label} style={{
          position: 'absolute', ...(Object.fromEntries(s.pos.split(';').map(p => {
            const [k, v] = p.trim().split(':').map(x => x.trim())
            const camel = k.replace(/-([a-z])/g, g => g[1].toUpperCase())
            return [camel, v]
          }))),
          background: 'white', borderRadius: 8, padding: '4px 8px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)', fontSize: 11, minWidth: 70, textAlign: 'center'
        }}>
          <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 2 }}>{s.label}</div>
          {s.magra != null && <div style={{ color: 'var(--secondary)' }}>💪 {s.magra}kg</div>}
          {s.grasa != null && <div style={{ color: 'var(--danger)' }}>🔴 {s.grasa}kg</div>}
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Biopedancia() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [tab, setTab] = useState('registrar')
  const [form, setForm] = useState(EMPTY_FORM)
  const [pdfState, setPdfState] = useState('idle') // idle | extracting | parsing | done | error
  const [pdfMsg, setPdfMsg] = useState('')
  const [showAllFields, setShowAllFields] = useState(false)
  const fileRef = useRef()

  useEffect(() => { loadRecords() }, [user])

  async function loadRecords() {
    const { data } = await supabase.from('bioimpedance_readings').select('*')
      .eq('user_id', user.id).order('fecha', { ascending: false }).limit(24)
    setRecords(data || [])
  }

  function showMsg(type, text) { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }
  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  // ── PDF upload handler ───────────────────────────────────────────────────────
  async function handlePdfUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      setPdfState('error'); setPdfMsg('Solo se aceptan archivos PDF'); return
    }
    try {
      setPdfState('extracting'); setPdfMsg('Extrayendo texto del PDF...')
      const text = await extractPdfText(file)
      if (!text.trim()) throw new Error('No se pudo extraer texto del PDF')

      setPdfState('parsing'); setPdfMsg('🤖 Analizando con IA...')
      const { data, error } = await supabase.functions.invoke('parse-bioimpedance', {
        body: { pdf_text: text }
      })
      if (error) throw new Error(error.message)
      if (data.error) throw new Error(data.error)

      // Map parsed data to form
      setForm({
        fecha:                  data.fecha || format(new Date(), 'yyyy-MM-dd'),
        peso:                   data.peso ?? '',
        imc:                    data.imc ?? '',
        masa_grasa:             data.masa_grasa ?? '',
        masa_libre_grasa:       data.masa_libre_grasa ?? '',
        masa_muscular:          data.masa_muscular ?? '',
        masa_muscular_esqueletica: data.masa_muscular_esqueletica ?? '',
        agua_corporal:          data.agua_corporal ?? '',
        porcentaje_grasa:       data.porcentaje_grasa ?? '',
        grasa_visceral:         data.grasa_visceral ?? '',
        indice_apendicular:     data.indice_apendicular ?? '',
        metabolismo_basal:      data.metabolismo_basal ?? '',
        peso_ideal:             data.peso_ideal ?? '',
        control_peso:           data.control_peso ?? '',
        control_grasa:          data.control_grasa ?? '',
        control_masa_magra:     data.control_masa_magra ?? '',
        magra_brazo_der:        data.magra_brazo_der ?? '',
        magra_brazo_izq:        data.magra_brazo_izq ?? '',
        magra_tronco:           data.magra_tronco ?? '',
        magra_pierna_der:       data.magra_pierna_der ?? '',
        magra_pierna_izq:       data.magra_pierna_izq ?? '',
        grasa_brazo_der:        data.grasa_brazo_der ?? '',
        grasa_brazo_izq:        data.grasa_brazo_izq ?? '',
        grasa_tronco:           data.grasa_tronco ?? '',
        grasa_pierna_der:       data.grasa_pierna_der ?? '',
        grasa_pierna_izq:       data.grasa_pierna_izq ?? '',
        notas: '', fuente: 'pdf'
      })
      setPdfState('done')
      setPdfMsg('✅ PDF procesado. Revisá los datos y guardá.')
      setShowAllFields(true)
    } catch (e) {
      setPdfState('error')
      setPdfMsg('❌ ' + e.message)
    }
  }

  // ── Save record ──────────────────────────────────────────────────────────────
  async function saveRecord(e) {
    e.preventDefault()
    const numFields = [
      'peso','imc','masa_grasa','masa_libre_grasa','masa_muscular',
      'masa_muscular_esqueletica','agua_corporal','porcentaje_grasa',
      'grasa_visceral','indice_apendicular','metabolismo_basal','peso_ideal',
      'control_peso','control_grasa','control_masa_magra',
      'magra_brazo_der','magra_brazo_izq','magra_tronco','magra_pierna_der','magra_pierna_izq',
      'grasa_brazo_der','grasa_brazo_izq','grasa_tronco','grasa_pierna_der','grasa_pierna_izq',
    ]
    const payload = { user_id: user.id, fecha: form.fecha, notas: form.notas, fuente: form.fuente }
    numFields.forEach(f => { if (form[f] !== '' && form[f] != null) payload[f] = parseFloat(form[f]) })

    const { error } = await supabase.from('bioimpedance_readings').insert(payload)
    if (error) { showMsg('error', '❌ Error: ' + error.message); return }
    showMsg('success', '✅ Biopedancia guardada')
    setForm(EMPTY_FORM)
    setPdfState('idle')
    setPdfMsg('')
    setShowAllFields(false)
    loadRecords()
  }

  async function deleteRecord(id) {
    await supabase.from('bioimpedance_readings').delete().eq('id', id)
    loadRecords()
  }

  const last = records[0]
  const prev = records[1]

  const chartData = [...records].reverse().map(r => ({
    fecha: format(parseISO(r.fecha), 'MMM yy', { locale: es }),
    grasa: r.porcentaje_grasa,
    musculo: r.masa_muscular_esqueletica,
    visceral: r.grasa_visceral,
    peso: r.peso,
  }))

  // ── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1>🔬 Biopedancia</h1>
        <p>Composición corporal completa — subí tu PDF de SmartFit o ingresá manualmente</p>
      </div>

      {/* ── KPI cards último registro ── */}
      {last && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: '⚖️ Peso', val: last.peso, unit: 'kg', prev: prev?.peso, lower: true },
            { label: '🔴 % Grasa', val: last.porcentaje_grasa, unit: '%', prev: prev?.porcentaje_grasa, lower: true },
            { label: '💪 Músculo esq.', val: last.masa_muscular_esqueletica, unit: 'kg', prev: prev?.masa_muscular_esqueletica, lower: false },
            { label: '💧 Agua', val: last.agua_corporal, unit: 'L', prev: prev?.agua_corporal, lower: false },
            { label: '🔶 Gr. Visceral', val: last.grasa_visceral, unit: '', prev: prev?.grasa_visceral, lower: true },
            { label: '🔥 Meta. Basal', val: last.metabolismo_basal, unit: 'kcal', prev: null, lower: false },
          ].filter(s => s.val).map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-card-label">{s.label}</div>
              <div className="stat-card-value">
                <StatDiff curr={s.val} prev={s.prev} unit={s.unit} lowerIsBetter={s.lower} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24, gap: 0 }}>
        {[['registrar','➕ Registrar'],['historial','📊 Historial'],['graficos','📈 Gráficos'],['segmental','🧍 Segmental']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 20px', fontSize: 'var(--text-sm)', fontWeight: 500,
            borderBottom: tab === k ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === k ? 'var(--primary)' : 'var(--gray-500)', marginBottom: -1
          }}>{l}</button>
        ))}
      </div>

      {msg.text && (
        <div className={msg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: REGISTRAR
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'registrar' && (
        <div>
          {/* PDF Upload Card */}
          <div className="card" style={{ marginBottom: 24, border: '2px dashed var(--primary)', background: 'var(--primary-light, #eff6ff)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>📄</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--primary)' }}>
                  Subir PDF de SmartFit
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-500)' }}>
                  La IA extrae todos los datos automáticamente — gratis
                </div>
              </div>
            </div>

            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && handlePdfUpload(e.target.files[0])} />

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handlePdfUpload(f) }}
              onClick={() => pdfState === 'idle' || pdfState === 'error' || pdfState === 'done' ? fileRef.current?.click() : null}
              style={{
                border: '2px dashed var(--gray-300)', borderRadius: 12, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', background: 'white',
                transition: 'border-color 0.2s'
              }}>
              {pdfState === 'idle' && (
                <>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>⬆️</div>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>
                    Arrastrá tu PDF o hacé click para seleccionar
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    Solo archivos PDF del sistema SmartFit / InBody
                  </div>
                </>
              )}
              {(pdfState === 'extracting' || pdfState === 'parsing') && (
                <div style={{ color: 'var(--primary)' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>
                    {pdfState === 'extracting' ? '📖' : '🤖'}
                  </div>
                  <div style={{ fontWeight: 600 }}>{pdfMsg}</div>
                </div>
              )}
              {pdfState === 'done' && (
                <div style={{ color: 'var(--secondary)', fontWeight: 600 }}>
                  ✅ PDF procesado — datos cargados abajo. Revisá y guardá.
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                    Hacé click para subir otro PDF
                  </div>
                </div>
              )}
              {pdfState === 'error' && (
                <div style={{ color: 'var(--danger)', fontWeight: 600 }}>
                  {pdfMsg}
                  <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--gray-500)' }}>
                    Hacé click para intentar de nuevo
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0 }}>
                {form.fuente === 'pdf' ? '📋 Datos extraídos del PDF' : '✏️ Ingreso manual'}
              </div>
              {form.fuente === 'pdf' && (
                <span style={{ fontSize: 'var(--text-xs)', background: 'var(--secondary)', color: 'white', padding: '2px 10px', borderRadius: 20 }}>
                  IA auto-completado
                </span>
              )}
            </div>

            <form onSubmit={saveRecord}>
              {/* Fecha */}
              <div className="form-group" style={{ marginBottom: 20, maxWidth: 200 }}>
                <label>Fecha del estudio</label>
                <input type="date" value={form.fecha} onChange={e => setF('fecha', e.target.value)} required />
              </div>

              {/* Principales */}
              <div style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                📊 Composición global
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { k: 'peso',             l: '⚖️ Peso',            u: 'kg',   s: '0.1' },
                  { k: 'imc',              l: '📐 IMC',             u: 'kg/m²', s: '0.1' },
                  { k: 'porcentaje_grasa', l: '🔴 % Grasa',         u: '%',    s: '0.1' },
                  { k: 'masa_grasa',       l: '🔴 Masa grasa',      u: 'kg',   s: '0.1' },
                  { k: 'masa_libre_grasa', l: '💚 Masa libre grasa', u: 'kg',  s: '0.1' },
                  { k: 'masa_muscular_esqueletica', l: '💪 Músculo esquelético', u: 'kg', s: '0.1' },
                  { k: 'agua_corporal',    l: '💧 Agua corporal',   u: 'L',    s: '0.1' },
                  { k: 'grasa_visceral',   l: '🔶 Grasa visceral',  u: 'niv.', s: '1' },
                  { k: 'metabolismo_basal', l: '🔥 Meta. basal',    u: 'kcal', s: '1' },
                  { k: 'peso_ideal',       l: '🎯 Peso ideal',      u: 'kg',   s: '0.1' },
                ].map(f => (
                  <div className="form-group" key={f.k}>
                    <label>{f.l} <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>({f.u})</span></label>
                    <input type="number" step={f.s} min="0" value={form[f.k]}
                      onChange={e => setF(f.k, e.target.value)}
                      style={form[f.k] !== '' && form.fuente === 'pdf' ? { borderColor: 'var(--secondary)', background: '#f0fdf4' } : {}} />
                  </div>
                ))}
              </div>

              {/* Toggle campos avanzados */}
              <button type="button" onClick={() => setShowAllFields(v => !v)}
                style={{ fontSize: 'var(--text-sm)', color: 'var(--primary)', fontWeight: 500, marginBottom: 16 }}>
                {showAllFields ? '▲ Ocultar' : '▼ Ver'} análisis segmental y control de peso
              </button>

              {showAllFields && (
                <>
                  {/* Control de peso */}
                  <div style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                    🎯 Control de peso objetivo
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                      { k: 'control_peso',       l: 'Control peso',     u: 'kg' },
                      { k: 'control_grasa',      l: 'Control grasa',    u: 'kg' },
                      { k: 'control_masa_magra', l: 'Control masa magra', u: 'kg' },
                      { k: 'indice_apendicular', l: 'Índice apendicular', u: 'kg/m²' },
                    ].map(f => (
                      <div className="form-group" key={f.k}>
                        <label>{f.l} <span style={{ color: 'var(--gray-400)', fontSize: 11 }}>({f.u})</span></label>
                        <input type="number" step="0.01" value={form[f.k]}
                          onChange={e => setF(f.k, e.target.value)}
                          style={form[f.k] !== '' && form.fuente === 'pdf' ? { borderColor: 'var(--secondary)', background: '#f0fdf4' } : {}} />
                      </div>
                    ))}
                  </div>

                  {/* Masa magra segmentar */}
                  <div style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                    💪 Masa magra segmentar (kg)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { k: 'magra_brazo_der', l: 'Brazo Der.' },
                      { k: 'magra_brazo_izq', l: 'Brazo Izq.' },
                      { k: 'magra_tronco',    l: 'Tronco' },
                      { k: 'magra_pierna_der', l: 'Pierna Der.' },
                      { k: 'magra_pierna_izq', l: 'Pierna Izq.' },
                    ].map(f => (
                      <div className="form-group" key={f.k}>
                        <label style={{ fontSize: 11 }}>{f.l}</label>
                        <input type="number" step="0.01" value={form[f.k]}
                          onChange={e => setF(f.k, e.target.value)}
                          style={form[f.k] !== '' && form.fuente === 'pdf' ? { borderColor: 'var(--secondary)', background: '#f0fdf4' } : {}} />
                      </div>
                    ))}
                  </div>

                  {/* Grasa segmentar */}
                  <div style={{ fontWeight: 600, color: 'var(--gray-600)', fontSize: 'var(--text-sm)', marginBottom: 12 }}>
                    🔴 Grasa segmentar (kg)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { k: 'grasa_brazo_der', l: 'Brazo Der.' },
                      { k: 'grasa_brazo_izq', l: 'Brazo Izq.' },
                      { k: 'grasa_tronco',    l: 'Tronco' },
                      { k: 'grasa_pierna_der', l: 'Pierna Der.' },
                      { k: 'grasa_pierna_izq', l: 'Pierna Izq.' },
                    ].map(f => (
                      <div className="form-group" key={f.k}>
                        <label style={{ fontSize: 11 }}>{f.l}</label>
                        <input type="number" step="0.01" value={form[f.k]}
                          onChange={e => setF(f.k, e.target.value)}
                          style={form[f.k] !== '' && form.fuente === 'pdf' ? { borderColor: 'var(--secondary)', background: '#f0fdf4' } : {}} />
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Notas</label>
                <textarea placeholder="Observaciones del estudio..."
                  value={form.notas} onChange={e => setF('notas', e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button type="submit" className="btn-primary">
                  💾 Guardar biopedancia
                </button>
                <button type="button" onClick={() => { setForm(EMPTY_FORM); setPdfState('idle'); setPdfMsg(''); setShowAllFields(false) }}
                  style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>
                  Limpiar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORIAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'historial' && (
        records.length === 0
          ? <div className="empty-state card"><div className="empty-state-icon">🔬</div><p>No hay biopedancias registradas aún.</p></div>
          : (
            <div className="card">
              <div className="card-title">📊 Historial completo</div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Fuente</th>
                      <th>Peso</th>
                      <th>% Grasa</th>
                      <th>Músculo esq.</th>
                      <th>Agua (L)</th>
                      <th>Gr. Visceral</th>
                      <th>IMC</th>
                      <th>Meta. Basal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => {
                      const p = records[i + 1]
                      return (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {format(parseISO(r.fecha), 'd MMM yyyy', { locale: es })}
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 12,
                              background: r.fuente === 'pdf' ? '#dcfce7' : '#f1f5f9',
                              color: r.fuente === 'pdf' ? '#166534' : '#475569'
                            }}>
                              {r.fuente === 'pdf' ? '📄 PDF' : '✏️ Manual'}
                            </span>
                          </td>
                          <td><StatDiff curr={r.peso} prev={p?.peso} unit="kg" lowerIsBetter /></td>
                          <td><StatDiff curr={r.porcentaje_grasa} prev={p?.porcentaje_grasa} unit="%" lowerIsBetter /></td>
                          <td><StatDiff curr={r.masa_muscular_esqueletica} prev={p?.masa_muscular_esqueletica} unit="kg" /></td>
                          <td>{r.agua_corporal ?? '—'}</td>
                          <td>{r.grasa_visceral ? `Niv. ${r.grasa_visceral}` : '—'}</td>
                          <td>{r.imc ?? '—'}</td>
                          <td>{r.metabolismo_basal ? `${r.metabolismo_basal} kcal` : '—'}</td>
                          <td>
                            <button className="btn-icon" onClick={() => deleteRecord(r.id)}>🗑️</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: GRÁFICOS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'graficos' && (
        <div className="section-grid">
          <div className="card">
            <div className="card-title">📈 Evolución — Peso y composición</div>
            {chartData.length < 2
              ? <div className="empty-state"><p>Necesitás al menos 2 registros.</p></div>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="peso" name="Peso (kg)" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="grasa" name="% Grasa" stroke="var(--danger)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="musculo" name="Músculo esq. (kg)" stroke="var(--secondary)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="visceral" name="Gr. Visceral" stroke="var(--accent)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </div>

          <div className="card">
            <div className="card-title">📖 Guía de rangos saludables</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { l: '% Grasa (hombres sanos)', v: '10–20%' },
                { l: '% Grasa (mujeres sanas)', v: '20–30%' },
                { l: 'Grasa visceral normal', v: 'Nivel 1–9' },
                { l: 'Grasa visceral alta', v: 'Nivel 10+' },
                { l: 'Agua corporal ideal', v: '50–65%' },
                { l: 'IMC saludable', v: '18.5–24.9' },
              ].map(item => (
                <div key={item.l} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
                  background: 'var(--gray-50)', borderRadius: 8, fontSize: 'var(--text-sm)'
                }}>
                  <span style={{ color: 'var(--gray-600)' }}>{item.l}</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{item.v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, padding: 12, background: '#fff7ed', borderRadius: 8, fontSize: 'var(--text-xs)', color: '#92400e', lineHeight: 1.7 }}>
              <strong>⚠️ Con tirzepatida:</strong> La pérdida de peso puede incluir masa muscular.
              Mantené alta ingesta proteica y hacé fuerza para preservar músculo.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SEGMENTAL
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'segmental' && (
        last
          ? (
            <div className="section-grid">
              <div className="card">
                <div className="card-title">💪 Masa magra segmentar</div>
                <BodyMap
                  magra={{ brazo_der: last.magra_brazo_der, brazo_izq: last.magra_brazo_izq, tronco: last.magra_tronco, pierna_der: last.magra_pierna_der, pierna_izq: last.magra_pierna_izq }}
                  grasa={null}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
                  {[
                    ['Brazo D', last.magra_brazo_der], ['Brazo I', last.magra_brazo_izq],
                    ['Tronco', last.magra_tronco], ['Pierna D', last.magra_pierna_der], ['Pierna I', last.magra_pierna_izq]
                  ].map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', padding: 8, background: '#f0fdf4', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{l}</div>
                      <div style={{ fontWeight: 700, color: 'var(--secondary)' }}>{v ?? '—'} {v ? 'kg' : ''}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-title">🔴 Grasa segmentar</div>
                <BodyMap
                  magra={null}
                  grasa={{ brazo_der: last.grasa_brazo_der, brazo_izq: last.grasa_brazo_izq, tronco: last.grasa_tronco, pierna_der: last.grasa_pierna_der, pierna_izq: last.grasa_pierna_izq }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginTop: 16 }}>
                  {[
                    ['Brazo D', last.grasa_brazo_der], ['Brazo I', last.grasa_brazo_izq],
                    ['Tronco', last.grasa_tronco], ['Pierna D', last.grasa_pierna_der], ['Pierna I', last.grasa_pierna_izq]
                  ].map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', padding: 8, background: '#fef2f2', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{l}</div>
                      <div style={{ fontWeight: 700, color: 'var(--danger)' }}>{v ?? '—'} {v ? 'kg' : ''}</div>
                    </div>
                  ))}
                </div>
                {last.grasa_tronco && (
                  <div style={{ marginTop: 12, padding: 10, background: '#fff7ed', borderRadius: 8, fontSize: 'var(--text-xs)', color: '#92400e' }}>
                    <strong>Tronco:</strong> {last.grasa_tronco}kg — representa {last.masa_grasa ? `${((last.grasa_tronco / last.masa_grasa) * 100).toFixed(0)}% de tu grasa total` : 'mayor concentración de riesgo cardiovascular'}
                  </div>
                )}
              </div>

              {/* Control de peso */}
              {last.peso_ideal && (
                <div className="card">
                  <div className="card-title">🎯 Objetivos de composición</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { l: 'Peso actual', v: `${last.peso} kg`, color: 'var(--gray-700)' },
                      { l: 'Peso ideal', v: `${last.peso_ideal} kg`, color: 'var(--secondary)' },
                      { l: 'Control peso', v: `${last.control_peso} kg`, color: last.control_peso < 0 ? 'var(--danger)' : 'var(--secondary)' },
                      { l: 'Control grasa', v: `${last.control_grasa} kg`, color: 'var(--danger)' },
                      { l: 'Control masa magra', v: `${last.control_masa_magra} kg `, color: 'var(--secondary)' },
                      { l: 'Índice apendicular', v: `${last.indice_apendicular} kg/m2`, color: 'var(--gray-700)' },
                    ].filter(i => i.v && !i.v.includes('null')).map(item => (
                      <div key={item.l} style={{ padding: '10px 14px', background: 'var(--gray-50)', borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{item.l}</div>
                        <div style={{ fontWeight: 700, color: item.color }}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
          : <div className="empty-state card"><div className="empty-state-icon">🧍</div><p>Registrá una biopedancia para ver el análisis segmental.</p></div>
      )}
    </div>
  )
}
