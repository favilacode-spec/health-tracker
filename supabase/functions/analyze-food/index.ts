import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { food_description } = await req.json()

    if (!food_description?.trim()) {
      return new Response(JSON.stringify({ error: 'food_description requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = `Sos un nutricionista experto. Analizá esta descripción de comida y devolvé los macronutrientes aproximados.

Descripción: "${food_description}"

Respondé ÚNICAMENTE con un JSON válido con esta estructura exacta (sin texto adicional, sin markdown):
{
  "calorias": <número entero>,
  "proteinas_g": <número con hasta 1 decimal>,
  "carbos_g": <número con hasta 1 decimal>,
  "grasas_g": <número con hasta 1 decimal>,
  "fibra_g": <número con hasta 1 decimal>,
  "descripcion_normalizada": "<descripción clara y concisa de la comida>"
}

Considerá porciones típicas argentinas/latinoamericanas si no se especifica la cantidad. Si hay ingredientes múltiples, sumá todos los macros.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error('Anthropic API error: ' + err)
    }

    const anthropicData = await response.json()
    const rawText = anthropicData.content[0].text.trim()
    const jsonStr = rawText.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    const macros = JSON.parse(jsonStr)

    return new Response(JSON.stringify(macros), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
