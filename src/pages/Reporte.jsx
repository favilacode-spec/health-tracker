import { useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const GROQ_KEY = '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'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function hhmm(h) {
  if (!h) return '—'
  const hrs = Math.floor(h), min = Math.round((h - hrs) * 60)
  return `${hrs}h ${min}m`
}

function StatRow({ label, value, unit = '' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ color: '#64748b', fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{value ? `${value}${unit}` : '—'}</span>
    </div>
  )
}

export default function Reporte() {
  const { user, profile } = useAuth()
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState('')
  const [reportData, setReportData] = useState(null)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  // ─── Fetch all data ─────────────────────────────────────────────────────────
  async function generateReport() {
    setStatus('loading')
    setAiAnalysis('')
    try {
      setProgress('Cargando biopedancia...')
      const { data: bio } = await supabase.from('bioimpedance_readings')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(20)

      setProgress('Cargando peso y medidas...')
      const { data: peso } = await supabase.from('peso_medidas')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(20)

      setProgress('Cargando tirzepatida...')
      const { data: tirz } = await supabase.from('tirzepatida_dosis')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(20)

      setProgress('Cargando nutrición...')
      const { data: ali } = await supabase.from('alimentos')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(60)

      setProgress('Cargando ejercicio...')
      const { data: eje } = await supabase.from('ejercicios')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(30)

      setProgress('Cargando sueño...')
      const { data: sue } = await supabase.from('sleep_records')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: false }).limit(30)

      // ── Compute averages ────────────────────────────────────────────────────
      const avg = (arr, key) => {
        const vals = arr?.filter(r => r[key] != null).map(r => r[key]) || []
        return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null
      }

      const last30days = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

      const aliLast30 = (ali || []).filter(r => r.fecha >= last30days)
      const ejeLast30 = (eje || []).filter(r => r.fecha >= last30days)
      const sueLast30 = (sue || []).filter(r => r.fecha >= last30days)

      const data = {
        generado: format(new Date(), "d 'de' MMMM yyyy", { locale: es }),
        usuario: profile?.name || 'Usuario',
        // Biopedancia
        bio_last:  bio?.[0]  || null,
        bio_first: bio?.[bio.length - 1] || null,
        bio_count: bio?.length || 0,
        // Peso
        peso_last:  peso?.[0]  || null,
        peso_first: peso?.[peso.length - 1] || null,
        peso_count: peso?.length || 0,
        // Tirzepatida
        tirz_last:   tirz?.[0] || null,
        tirz_count:  tirz?.length || 0,
        tirz_dosis_actual: tirz?.[0]?.dosis_mg || null,
        // Nutrición (últimos 30 días)
        nut_prom_calorias:  avg(aliLast30, 'calorias'),
        nut_prom_proteinas: avg(aliLast30, 'proteinas_g'),
        nut_prom_carbs:     avg(aliLast30, 'carbohidratos_g'),
        nut_prom_grasas:    avg(aliLast30, 'grasas_g'),
        // Ejercicio (últimos 30 días)
        eje_sesiones: ejeLast30.length,
        eje_prom_duracion: avg(ejeLast30, 'duracion_min'),
        // Sueño (últimos 30 días)
        sue_count: sueLast30.length,
        sue_prom_total:    avg(sueLast30, 'duracion_total'),
        sue_prom_profundo: avg(sueLast30, 'duracion_profundo'),
        sue_prom_rem:      avg(sueLast30, 'duracion_rem'),
      }

      setReportData(data)
      setStatus('done')
      setProgress('')

      // Auto-generate AI analysis
      generateAI(data)
    } catch (e) {
      setStatus('error')
      setProgress('Error: ' + e.message)
    }
  }

  // ─── Groq AI Analysis ──────────────────────────────────────────────────────
  async function generateAI(data) {
    setAiLoading(true)
    setAiAnalysis('')
    try {
      const bio  = data.bio_last
      const bioF = data.bio_first

      const prompt = `Eres un experto en nutrición, composición corporal, tirzepatida (Mounjaro/Zepbound) y fisiología del ejercicio.
Analiza los siguientes datos de salud de ${data.usuario} y genera un análisis personalizado, conciso y motivador en español.

DATOS MÁS RECIENTES:
- Fecha del reporte: ${data.generado}
- Tirzepatida: ${data.tirz_dosis_actual ? `${data.tirz_dosis_actual}mg (${data.tirz_count} dosis registradas)` : 'No registrada'}
${bio ? `
BIOPEDANCIA ÚLTIMA (${bio.fecha}):
- Peso: ${bio.peso}kg | IMC: ${bio.imc}
- % Grasa: ${bio.porcentaje_grasa}% | Masa grasa: ${bio.masa_grasa}kg
- Músculo esquelético: ${bio.masa_muscular_esqueletica}kg
- Agua corporal: ${bio.agua_corporal}L
- Grasa visceral: ${bio.grasa_visceral}
- Metabolismo basal: ${bio.metabolismo_basal}kcal` : ''}
${bioF && bioF.fecha !== bio?.fecha ? `
BIOPEDANCIA INICIAL (${bioF.fecha}):
- Peso inicial: ${bioF.peso}kg | % Grasa inicial: ${bioF.porcentaje_grasa}%
- Músculo inicial: ${bioF.masa_muscular_esqueletica}kg
CAMBIOS: Peso ${bio?.peso && bioF?.peso ? (bio.peso - bioF.peso).toFixed(1) : '?'}kg | Grasa ${bio?.porcentaje_grasa && bioF?.porcentaje_grasa ? (bio.porcentaje_grasa - bioF.porcentaje_grasa).toFixed(1) : '?'}% | Músculo ${bio?.masa_muscular_esqueletica && bioF?.masa_muscular_esqueletica ? (bio.masa_muscular_esqueletica - bioF.masa_muscular_esqueletica).toFixed(1) : '?'}kg` : ''}
${data.nut_prom_calorias ? `
NUTRICIÓN (promedio últimos 30 días):
- Calorías: ${data.nut_prom_calorias}kcal/día
- Proteínas: ${data.nut_prom_proteinas}g | Carbs: ${data.nut_prom_carbs}g | Grasas: ${data.nut_prom_grasas}g` : ''}
${data.eje_sesiones ? `
EJERCICIO (últimos 30 días):
- ${data.eje_sesiones} sesiones | Promedio: ${data.eje_prom_duracion}min/sesión` : ''}
${data.sue_count ? `
SUEÑO (promedio últimas 30 noches):
- Total: ${hhmm(data.sue_prom_total)} | Profundo: ${hhmm(data.sue_prom_profundo)} | REM: ${hhmm(data.sue_prom_rem)}` : ''}

Genera un análisis estructurado con estas secciones (usa emojis y formato claro):
1. 🎯 PROGRESO GENERAL (2-3 oraciones sobre evolución y logros)
2. 💪 COMPOSICIÓN CORPORAL (análisis de músculo vs grasa, ratio saludable)
3. 🥗 NUTRICIÓN Y ENERGÍA (evaluación de macros según objetivos con tirzepatida)
4. 🏃 ACTIVIDAD FÍSICA (evaluación de ejercicio y recomendaciones)
5. 🌙 CALIDAD DE SUEÑO (análisis y su relación con pérdida de peso/tirzepatida)
6. ⚡ RECOMENDACIONES PRIORITARIAS (3 acciones concretas para las próximas 2 semanas)

Sé específico con los números. Máximo 400 palabras total.`

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 900,
          temperature: 0.6,
        })
      })
      const json = await res.json()
      setAiAnalysis(json.choices?.[0]?.message?.content || 'No se pudo generar el análisis.')
    } catch (e) {
      setAiAnalysis('Error al generar análisis: ' + e.message)
    }
    setAiLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  const rd = reportData

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>📋 Reporte de Salud</h1>
          <p>Resumen completo con análisis de IA — imprime o guarda como PDF</p>
        </div>
        {status === 'done' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePrint} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              🖨️ Imprimir / PDF
            </button>
            <button onClick={() => { setStatus('idle'); setReportData(null); setAiAnalysis('') }}
              style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)', padding: '8px 14px', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
              Nuevo reporte
            </button>
          </div>
        )}
      </div>

      {/* ─── Generate button ──────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <div className="card" style={{ maxWidth: 520 }}>
          <div className="card-title">📊 Generar reporte completo</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: 20 }}>
            Compila todos tus datos: biopedancia, peso, tirzepatida, nutrición, ejercicio y sueño.
            La IA de Groq genera un análisis personalizado.
          </p>
          <button className="btn-primary" onClick={generateReport} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🤖 Generar reporte + análisis IA
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 36, height: 36 }} />
          <div style={{ color: 'var(--primary)', fontWeight: 500 }}>{progress}</div>
        </div>
      )}

      {status === 'error' && (
        <div className="card" style={{ maxWidth: 400 }}>
          <div className="form-error">{progress}</div>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => setStatus('idle')}>Reintentar</button>
        </div>
      )}

      {/* ─── REPORT ──────────────────────────────────────────────────────────── */}
      {status === 'done' && rd && (
        <div id="reporte-contenido">
          {/* Header */}
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', color: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, marginBottom: 4 }}>
                  💉 Reporte de Salud — {rd.usuario}
                </div>
                <div style={{ opacity: 0.85, fontSize: 'var(--text-sm)' }}>Generado el {rd.generado}</div>
              </div>
              <div style={{ textAlign: 'right', opacity: 0.9 }}>
                <div style={{ fontSize: 'var(--text-sm)' }}>Tirzepatida</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
                  {rd.tirz_dosis_actual ? `${rd.tirz_dosis_actual}mg` : 'No registrada'}
                </div>
              </div>
            </div>
          </div>

          <div className="section-grid">
            {/* ── Biopedancia ── */}
            {rd.bio_last && (
              <div className="card">
                <div className="card-title">🔬 Biopedancia actual <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>({rd.bio_last.fecha})</span></div>
                <StatRow label="Peso"               value={rd.bio_last.peso}              unit=" kg" />
                <StatRow label="IMC"                value={rd.bio_last.imc}               unit=" kg/m²" />
                <StatRow label="% Grasa"            value={rd.bio_last.porcentaje_grasa}  unit="%" />
                <StatRow label="Masa grasa"         value={rd.bio_last.masa_grasa}        unit=" kg" />
                <StatRow label="Músculo esquelético" value={rd.bio_last.masa_muscular_esqueletica} unit=" kg" />
                <StatRow label="Agua corporal"      value={rd.bio_last.agua_corporal}     unit=" L" />
                <StatRow label="Grasa visceral"     value={rd.bio_last.grasa_visceral}    unit="" />
                <StatRow label="Metabolismo basal"  value={rd.bio_last.metabolismo_basal} unit=" kcal" />

                {rd.bio_first && rd.bio_first.fecha !== rd.bio_last.fecha && (
                  <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdf4', borderRadius: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: '#166534', marginBottom: 8 }}>
                      📈 Cambios desde {rd.bio_first.fecha}
                    </div>
                    {[
                      ['Peso', rd.bio_last.peso, rd.bio_first.peso, 'kg', true],
                      ['% Grasa', rd.bio_last.porcentaje_grasa, rd.bio_first.porcentaje_grasa, '%', true],
                      ['Músculo', rd.bio_last.masa_muscular_esqueletica, rd.bio_first.masa_muscular_esqueletica, 'kg', false],
                    ].map(([label, curr, init, unit, lowerBetter]) => {
                      if (!curr || !init) return null
                      const diff = +(curr - init).toFixed(1)
                      const good = lowerBetter ? diff < 0 : diff > 0
                      return (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ color: '#64748b' }}>{label}</span>
                          <span style={{ fontWeight: 700, color: good ? '#16a34a' : diff === 0 ? '#64748b' : '#dc2626' }}>
                            {diff > 0 ? '+' : ''}{diff}{unit}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Peso ── */}
            {rd.peso_last && (
              <div className="card">
                <div className="card-title">⚖️ Peso y Medidas <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>({rd.peso_last.fecha})</span></div>
                <StatRow label="Peso"      value={rd.peso_last.peso}    unit=" kg" />
                <StatRow label="IMC"       value={rd.peso_last.imc}     unit=" kg/m²" />
                <StatRow label="Cintura"   value={rd.peso_last.cintura} unit=" cm" />
                <StatRow label="Cadera"    value={rd.peso_last.cadera}  unit=" cm" />
                <StatRow label="Pecho"     value={rd.peso_last.pecho}   unit=" cm" />
                <StatRow label="Brazo D."  value={rd.peso_last.brazo_der} unit=" cm" />
                <StatRow label="Muslo D."  value={rd.peso_last.muslo_der} unit=" cm" />
                {rd.peso_first && rd.peso_first.fecha !== rd.peso_last.fecha && rd.peso_first.peso && rd.peso_last.peso && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: '#166534' }}>Pérdida de peso total</span>
                    <span style={{ fontWeight: 800, fontSize: 'var(--text-xl)', color: '#16a34a' }}>
                      {(rd.peso_first.peso - rd.peso_last.peso).toFixed(1)}kg
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Nutrición ── */}
            {rd.nut_prom_calorias && (
              <div className="card">
                <div className="card-title">🥗 Nutrición <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>(promedio 30 días)</span></div>
                <StatRow label="Calorías/día"  value={rd.nut_prom_calorias}  unit=" kcal" />
                <StatRow label="Proteínas/día" value={rd.nut_prom_proteinas} unit=" g" />
                <StatRow label="Carbs/día"     value={rd.nut_prom_carbs}     unit=" g" />
                <StatRow label="Grasas/día"    value={rd.nut_prom_grasas}    unit=" g" />

                {rd.nut_prom_proteinas && rd.bio_last?.masa_muscular_esqueletica && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fff7ed', borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                    <strong>Proteína/kg músculo:</strong>{' '}
                    {(rd.nut_prom_proteinas / rd.bio_last.masa_muscular_esqueletica).toFixed(1)}g/kg
                    {' '}(objetivo ≥2.0g/kg para preservar músculo con tirzepatida)
                  </div>
                )}
              </div>
            )}

            {/* ── Ejercicio ── */}
            {rd.eje_sesiones > 0 && (
              <div className="card">
                <div className="card-title">🏃 Ejercicio <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>(últimos 30 días)</span></div>
                <StatRow label="Sesiones"         value={rd.eje_sesiones}      unit="" />
                <StatRow label="Promedio duración" value={rd.eje_prom_duracion} unit=" min" />
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                  {rd.eje_sesiones >= 12 ? '✅ Excelente consistencia de ejercicio (≥3x/semana)' :
                   rd.eje_sesiones >= 8  ? '👍 Buen ritmo de ejercicio (2-3x/semana)' :
                                           '⚠️ Intenta aumentar la frecuencia a 3-4 sesiones/semana'}
                </div>
              </div>
            )}

            {/* ── Sueño ── */}
            {rd.sue_count > 0 && (
              <div className="card">
                <div className="card-title">🌙 Sueño <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--gray-400)' }}>(promedio 30 noches)</span></div>
                <StatRow label="Sueño total"  value={hhmm(rd.sue_prom_total)}    unit="" />
                <StatRow label="Sueño profundo" value={hhmm(rd.sue_prom_profundo)} unit="" />
                <StatRow label="Sueño REM"    value={hhmm(rd.sue_prom_rem)}      unit="" />
                <div style={{ marginTop: 12, padding: '10px 14px', background: (rd.sue_prom_total || 0) >= 7 ? '#f0fdf4' : '#fef2f2', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                  color: (rd.sue_prom_total || 0) >= 7 ? '#166534' : '#991b1b' }}>
                  {(rd.sue_prom_total || 0) >= 7 ? '✅ Buen promedio de sueño (≥7h)' :
                   (rd.sue_prom_total || 0) >= 6 ? '⚠️ Sueño en límite inferior (6-7h)' :
                                                    '❌ Sueño insuficiente (<6h) — afecta pérdida de grasa'}
                </div>
              </div>
            )}
          </div>

          {/* ── AI Analysis ──────────────────────────────────────────────────────── */}
          <div className="card" style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ margin: 0 }}>🤖 Análisis de IA Personalizado</div>
              {!aiLoading && aiAnalysis && (
                <button onClick={() => generateAI(rd)}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 500 }}>
                  🔄 Regenerar
                </button>
              )}
            </div>
            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)', padding: '8px 0' }}>
                <div className="spinner" style={{ width: 20, height: 20 }} />
                <span style={{ fontWeight: 500 }}>Generando análisis con IA (Groq)...</span>
              </div>
            )}
            {!aiLoading && aiAnalysis && (
              <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.8, color: 'var(--gray-700)', whiteSpace: 'pre-wrap' }}>
                {aiAnalysis}
              </div>
            )}
          </div>

          {/* ── Print footer ─────────────────────────────────────────────────────── */}
          <div style={{ marginTop: 24, padding: '16px 24px', background: 'var(--gray-50)', borderRadius: 12, fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
            Reporte generado por Health Tracker el {rd.generado} · Este análisis es informativo, no reemplaza la consulta médica.
          </div>
        </div>
      )}

      {/* ─── Print Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .sidebar, .topbar, .page-header button, .btn-icon { display: none !important; }
          .main-wrapper { margin: 0 !important; }
          .main-content { padding: 0 !important; }
          .card { break-inside: avoid; box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
