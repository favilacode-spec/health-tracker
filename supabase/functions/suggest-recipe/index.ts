import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ingredients } = await req.json()

    if (!ingredients || typeof ingredients !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Ingredientes requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = `Sos un chef nutricionista especializado en alimentación saludable para personas en tratamiento con tirzepatida (ozempic/mounjaro).

El usuario tiene los siguientes ingredientes disponibles: ${ingredients}

Creá UNA receta completa y saludable usando esos ingredientes. La receta debe ser:
- Alta en proteína
- Fácil de digerir (apta para náuseas leves)
- Simple de preparar (máximo 30 minutos)

Respondé EXCLUSIVAMENTE con un objeto JSON válido con esta estructura exacta, sin texto antes ni después:
{
  "titulo": "nombre de la receta",
  "descripcion": "descripción breve de 1-2 oraciones sobre la receta y sus beneficios",
  "tiempo_min": 20,
  "ingredientes": [
    { "nombre": "nombre del ingrediente", "gramos": 150, "cantidad": "150g" },
    { "nombre": "aceite de oliva", "gramos": null, "cantidad": "1 cucharada" }
  ],
  "instrucciones": [
    "Paso 1 detallado",
    "Paso 2 detallado"
  ],
  "macros_aproximados": {
    "proteinas_g": 35,
    "calorias": 420,
    "carbos_g": 30,
    "grasas_g": 12
  }
}`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'Sos un chef nutricionista. Respondés SIEMPRE con JSON puro y válido, sin markdown, sin texto adicional.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: 1200,
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      throw new Error(`Groq error: ${errText}`)
    }

    const groqData = await groqResponse.json()
    const rawContent = groqData.choices?.[0]?.message?.content || ''

    // Parse JSON — strip any accidental markdown fences
    const cleaned = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    let recipe
    try {
      recipe = JSON.parse(cleaned)
    } catch {
      throw new Error('La IA no devolvió un JSON válido. Intentá de nuevo.')
    }

    return new Response(
      JSON.stringify(recipe),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
