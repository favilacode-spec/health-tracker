import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const HEVY_BASE = 'https://api.hevyapp.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const action = body.action || 'sync'

    // ── ACCIÓN: guardar API key ──────────────────────────────
    if (action === 'save_key') {
      const api_key = (body.api_key || '').trim()
      if (!api_key) {
        return new Response(JSON.stringify({ error: 'api_key requerida' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Validar que la key funciona
      const testResp = await fetch(`${HEVY_BASE}/v1/user/info`, {
        headers: { 'api-key': api_key }
      })
      if (!testResp.ok) {
        return new Response(JSON.stringify({ error: 'API key inválida. Verificá en hevy.com/settings?developer' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const userInfo = await testResp.json()

      await supabase.from('hevy_config').upsert({
        user_id: user.id,
        api_key,
        last_sync_at: '1970-01-01T00:00:00Z',
        updated_at: new Date().toISOString()
      })

      return new Response(JSON.stringify({ ok: true, hevy_user: userInfo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── ACCIÓN: desconectar ──────────────────────────────────
    if (action === 'disconnect') {
      await supabase.from('hevy_config').delete().eq('user_id', user.id)
      await supabase.from('hevy_workouts').delete().eq('user_id', user.id)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── ACCIÓN: sync (default) ───────────────────────────────
    const { data: config, error: configError } = await supabase
      .from('hevy_config').select('*').eq('user_id', user.id).single()

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'no_key', message: 'No hay API key configurada' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const since = config.last_sync_at || '1970-01-01T00:00:00Z'
    let page = 1
    let synced = 0
    let deleted = 0
    let hasMore = true

    while (hasMore) {
      const url = `${HEVY_BASE}/v1/workouts/events?page=${page}&pageSize=10&since=${encodeURIComponent(since)}`
      const resp = await fetch(url, { headers: { 'api-key': config.api_key } })

      if (!resp.ok) {
        const errText = await resp.text()
        throw new Error(`Hevy API error ${resp.status}: ${errText}`)
      }

      const data = await resp.json()
      const events: any[] = data.events || []

      for (const event of events) {
        if (event.type === 'deleted') {
          await supabase.from('hevy_workouts')
            .delete()
            .eq('hevy_id', event.workout_id)
            .eq('user_id', user.id)
          deleted++
        } else if (event.workout) {
          const w = event.workout
          const exercises: any[] = w.exercises || []

          // Calcular volumen total (kg × reps por cada set)
          const totalVolume = exercises.reduce((sum: number, ex: any) =>
            sum + (ex.sets || []).reduce((s: number, set: any) =>
              s + ((set.weight_kg || 0) * (set.reps || 0)), 0), 0)

          const totalSets = exercises.reduce((sum: number, ex: any) =>
            sum + (ex.sets || []).length, 0)

          const durationMin = w.start_time && w.end_time
            ? Math.round((new Date(w.end_time).getTime() - new Date(w.start_time).getTime()) / 60000)
            : null

          await supabase.from('hevy_workouts').upsert({
            hevy_id: w.id,
            user_id: user.id,
            title: w.title || 'Entrenamiento',
            start_time: w.start_time,
            end_time: w.end_time,
            duration_min: durationMin,
            exercises: exercises,
            total_sets: totalSets,
            total_volume_kg: Math.round(totalVolume * 100) / 100,
            hevy_updated_at: w.updated_at,
            synced_at: new Date().toISOString()
          }, { onConflict: 'hevy_id,user_id' })

          synced++
        }
      }

      hasMore = page < (data.page_count || 1)
      page++
    }

    // Actualizar last_sync_at y total_synced
    const { data: currentConfig } = await supabase
      .from('hevy_config').select('total_synced').eq('user_id', user.id).single()

    await supabase.from('hevy_config').update({
      last_sync_at: new Date().toISOString(),
      total_synced: (currentConfig?.total_synced || 0) + synced,
      updated_at: new Date().toISOString()
    }).eq('user_id', user.id)

    return new Response(JSON.stringify({ synced, deleted, since, last_sync: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
