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

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    if (!GEMINI_API_KEY) {
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Gemini API error: ${err}`)
    }

    const geminiData = await response.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    if (!rawText) throw new Error('Respuesta vacía de Gemini')

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
