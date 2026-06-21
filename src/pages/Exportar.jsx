import { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── Load SheetJS from CDN ────────────────────────────────────────────────────
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    script.onload  = () => resolve(window.XLSX)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// ─── Sheet builders ───────────────────────────────────────────────────────────
function makeSheet(XLSX, rows, headers) {
  if (!rows || rows.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([headers, ['Sin datos']])
    ws['!cols'] = headers.map(() => ({ wch: 18 }))
    return ws
  }
  const data = [headers, ...rows]
  const ws   = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = headers.map(() => ({ wch: 18 }))
  return ws
}

function n(v) { return v ?? '' }

export default function Exportar() {
  const { user } = useAuth()
  const [status, setStatus] = useState('idle')   // idle | loading | done | error
  const [progress, setProgress] = useState('')
  const [counts, setCounts] = useState(null)

  // ─── Count records on load ─────────────────────────────────────────────────
  async function loadCounts() {
    setStatus('counting')
    const tables = [
      { key: 'bio',  table: 'bioimpedance_readings', label: 'Biopedancias' },
      { key: 'peso', table: 'peso_medidas',          label: 'Peso y Medidas' },
      { key: 'tirz', table: 'tirzepatida_dosis',     label: 'Tirzepatida' },
      { key: 'ali',  table: 'alimentos',             label: 'Alimentos' },
      { key: 'eje',  table: 'ejercicios',            label: 'Ejercicios' },
      { key: 'sue',  table: 'sleep_records',         label: 'Sueño' },
    ]
    const results = {}
    for (const t of tables) {
      const { count } = await supabase
        .from(t.table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
      results[t.key] = { label: t.label, count: count || 0 }
    }
    setCounts(results)
    setStatus('idle')
  }

  // ─── Export all data ───────────────────────────────────────────────────────
  async function exportAll() {
    setStatus('loading')
    try {
      setProgress('Cargando librería Excel...')
      const XLSX = await loadXLSX()

      const wb = XLSX.utils.book_new()

      // ── 1. Biopedancia ──────────────────────────────────────────────────────
      setProgress('Exportando biopedancia...')
      const { data: bio } = await supabase.from('bioimpedance_readings')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const bioSheet = makeSheet(XLSX,
        (bio || []).map(r => [
          n(r.fecha), n(r.peso), n(r.imc), n(r.porcentaje_grasa), n(r.masa_grasa),
          n(r.masa_libre_grasa), n(r.masa_muscular_esqueletica), n(r.agua_corporal),
          n(r.grasa_visceral), n(r.metabolismo_basal), n(r.peso_ideal),
          n(r.magra_brazo_der), n(r.magra_brazo_izq), n(r.magra_tronco),
          n(r.magra_pierna_der), n(r.magra_pierna_izq),
          n(r.grasa_brazo_der), n(r.grasa_brazo_izq), n(r.grasa_tronco),
          n(r.grasa_pierna_der), n(r.grasa_pierna_izq),
          n(r.fuente), n(r.notas),
        ]),
        ['Fecha','Peso(kg)','IMC','%Grasa','Masa Grasa','Masa Libre Grasa','Músculo Esq.',
         'Agua(L)','Gr.Visceral','Meta.Basal','Peso Ideal',
         'Magra Brazo D','Magra Brazo I','Magra Tronco','Magra Pierna D','Magra Pierna I',
         'Grasa Brazo D','Grasa Brazo I','Grasa Tronco','Grasa Pierna D','Grasa Pierna I',
         'Fuente','Notas']
      )
      XLSX.utils.book_append_sheet(wb, bioSheet, 'Biopedancia')

      // ── 2. Peso y Medidas ────────────────────────────────────────────────────
      setProgress('Exportando peso y medidas...')
      const { data: peso } = await supabase.from('peso_medidas')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const pesoSheet = makeSheet(XLSX,
        (peso || []).map(r => [
          n(r.fecha), n(r.peso), n(r.imc), n(r.cintura), n(r.cadera),
          n(r.pecho), n(r.brazo_der), n(r.brazo_izq), n(r.muslo_der), n(r.muslo_izq),
          n(r.pantorrilla_der), n(r.pantorrilla_izq), n(r.notas),
        ]),
        ['Fecha','Peso(kg)','IMC','Cintura','Cadera','Pecho',
         'Brazo D','Brazo I','Muslo D','Muslo I','Pantorrilla D','Pantorrilla I','Notas']
      )
      XLSX.utils.book_append_sheet(wb, pesoSheet, 'Peso y Medidas')

      // ── 3. Tirzepatida ────────────────────────────────────────────────────────
      setProgress('Exportando tirzepatida...')
      const { data: tirz } = await supabase.from('tirzepatida_dosis')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const tirzSheet = makeSheet(XLSX,
        (tirz || []).map(r => [
          n(r.fecha), n(r.dosis_mg), n(r.hora), n(r.zona_inyeccion),
          n(r.reacciones), n(r.notas),
        ]),
        ['Fecha','Dosis(mg)','Hora','Zona','Reacciones','Notas']
      )
      XLSX.utils.book_append_sheet(wb, tirzSheet, 'Tirzepatida')

      // ── 4. Alimentos ──────────────────────────────────────────────────────────
      setProgress('Exportando alimentos...')
      const { data: ali } = await supabase.from('alimentos')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const aliSheet = makeSheet(XLSX,
        (ali || []).map(r => [
          n(r.fecha), n(r.nombre), n(r.cantidad_g), n(r.calorias),
          n(r.proteinas_g), n(r.carbohidratos_g), n(r.grasas_g), n(r.fibra_g),
          n(r.tiempo_comida), n(r.notas),
        ]),
        ['Fecha','Alimento','Cantidad(g)','Calorías','Proteínas(g)','Carbs(g)','Grasas(g)','Fibra(g)','Tiempo','Notas']
      )
      XLSX.utils.book_append_sheet(wb, aliSheet, 'Alimentos')

      // ── 5. Ejercicios ─────────────────────────────────────────────────────────
      setProgress('Exportando ejercicios...')
      const { data: eje } = await supabase.from('ejercicios')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const ejeSheet = makeSheet(XLSX,
        (eje || []).map(r => [
          n(r.fecha), n(r.tipo), n(r.nombre), n(r.duracion_min),
          n(r.series), n(r.repeticiones), n(r.peso_kg), n(r.distancia_km),
          n(r.calorias_quemadas), n(r.intensidad), n(r.notas),
        ]),
        ['Fecha','Tipo','Ejercicio','Duración(min)','Series','Reps','Peso(kg)','Distancia(km)','Calorías','Intensidad','Notas']
      )
      XLSX.utils.book_append_sheet(wb, ejeSheet, 'Ejercicios')

      // ── 6. Sueño ──────────────────────────────────────────────────────────────
      setProgress('Exportando sueño...')
      const { data: sue } = await supabase.from('sleep_records')
        .select('*').eq('user_id', user.id).order('fecha', { ascending: true })
      const sueSheet = makeSheet(XLSX,
        (sue || []).map(r => [
          n(r.fecha), n(r.duracion_total), n(r.duracion_profundo),
          n(r.duracion_rem), n(r.duracion_ligero), n(r.duracion_en_cama),
          n(r.duracion_despierto), n(r.calidad), n(r.fuente), n(r.notas),
        ]),
        ['Fecha','Total(h)','Profundo(h)','REM(h)','Ligero(h)','En Cama(h)','Despierto(h)','Calidad(1-10)','Fuente','Notas']
      )
      XLSX.utils.book_append_sheet(wb, sueSheet, 'Sueño')

      // ── Download ───────────────────────────────────────────────────────────────
      setProgress('Generando archivo...')
      const dateStr = format(new Date(), 'yyyy-MM-dd')
      XLSX.writeFile(wb, `health-tracker-${dateStr}.xlsx`)

      setStatus('done')
      setProgress('')
    } catch (e) {
      setStatus('error')
      setProgress('Error: ' + e.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>📥 Exportar Datos</h1>
        <p>Descarga todos tus datos como archivo Excel con múltiples hojas</p>
      </div>

      {/* Main export card */}
      <div className="card" style={{ marginBottom: 24, maxWidth: 640 }}>
        <div className="card-title">📊 Exportar todo en un archivo Excel</div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginBottom: 20, lineHeight: 1.6 }}>
          Genera un archivo <strong>.xlsx</strong> con 6 hojas: Biopedancia, Peso y Medidas,
          Tirzepatida, Alimentos, Ejercicios y Sueño. Incluye todos tus registros históricos.
        </p>

        {status === 'idle' && !counts && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={exportAll}>
              ⬇️ Descargar Excel completo
            </button>
            <button onClick={loadCounts}
              style={{ color: 'var(--primary)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Ver resumen de datos
            </button>
          </div>
        )}

        {status === 'counting' && (
          <div style={{ color: 'var(--gray-500)', fontSize: 'var(--text-sm)' }}>⏳ Contando registros...</div>
        )}

        {status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="spinner" style={{ width: 20, height: 20 }} />
            <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{progress}</span>
          </div>
        )}

        {status === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-success" style={{ margin: 0 }}>
              ✅ Excel descargado correctamente.
            </div>
            <button className="btn-primary" onClick={() => { setStatus('idle'); setProgress('') }}>
              ⬇️ Descargar de nuevo
            </button>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-error" style={{ margin: 0 }}>❌ {progress}</div>
            <button className="btn-primary" onClick={() => { setStatus('idle'); setProgress('') }}>
              Reintentar
            </button>
          </div>
        )}

        {counts && status === 'idle' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              {Object.values(counts).map(({ label, count }) => (
                <div key={label} style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--primary)' }}>{count}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>registros</div>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={exportAll}>
              ⬇️ Descargar Excel ({Object.values(counts).reduce((s, { count }) => s + count, 0)} registros)
            </button>
          </>
        )}
      </div>

      {/* Info cards */}
      <div className="section-grid">
        <div className="card">
          <div className="card-title">📋 ¿Qué incluye el Excel?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['📊 Biopedancia', 'Composición corporal, datos segmentales, fechas'],
              ['⚖️ Peso y Medidas', 'Peso, IMC, circunferencias corporales'],
              ['💉 Tirzepatida', 'Dosis, horarios, zonas de inyección, reacciones'],
              ['🛒 Alimentos', 'Macros, calorías, tiempos de comida'],
              ['🏃 Ejercicios', 'Series, repeticiones, duración, intensidad'],
              ['🌙 Sueño', 'Fases, duración, calidad, fuente'],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">💡 Consejos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 'var(--text-sm)', color: 'var(--gray-700)', lineHeight: 1.6 }}>
            <p>
              📱 <strong>Google Sheets:</strong> Abre el .xlsx directamente en Google Sheets para
              visualizar y compartir tus datos desde cualquier dispositivo.
            </p>
            <p>
              📈 <strong>Análisis propio:</strong> Usa las columnas de macros y biopedancia para
              identificar correlaciones entre alimentación y composición corporal.
            </p>
            <p>
              🩺 <strong>Para tu médico:</strong> Exporta y muestra el historial completo de
              biopedancias a tu endocrinólogo para ajustar el tratamiento con tirzepatida.
            </p>
            <p>
              🔄 <strong>Exporta regularmente:</strong> Guarda una copia mensual como respaldo
              de seguridad de tu progreso.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
