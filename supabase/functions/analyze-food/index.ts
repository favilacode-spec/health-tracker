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

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY no configurada' }), {
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

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 400,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: 'Sos un nutricionista experto. Respondés SIEMPRE con JSON válido y nada más. Sin markdown, sin explicaciones, solo el JSON.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Groq API error: ${err}`)
    }

    const groqData = await response.json()
    const rawText = groqData.choices[0].message.content.trim()

    // Parse JSON — eliminar posibles bloques de markdown
    const jsonStr = rawText
      .replace(/^```json?\n?/i, '')
      .replace(/\n?```$/,       '')
      .trim()

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
