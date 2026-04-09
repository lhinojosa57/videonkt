// supabase/functions/get-transcript/index.ts
// Edge Function — transcripción + generación de preguntas con Claude

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, contexto } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL requerida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'No se pudo extraer el ID del video' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supadataKey = Deno.env.get('SUPADATA_API_KEY')
    if (!supadataKey) {
      return new Response(JSON.stringify({ error: 'API key de transcripcion no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Transcripcion
    let supadataRes = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&lang=es`,
      { headers: { 'x-api-key': supadataKey } }
    )
    if (!supadataRes.ok) {
      supadataRes = await fetch(
        `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}`,
        { headers: { 'x-api-key': supadataKey } }
      )
    }
    if (!supadataRes.ok) {
      return new Response(JSON.stringify({
        error: 'Este video no tiene subtitulos disponibles.'
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supadataData = await supadataRes.json()
    console.log('Supadata OK videoId:', videoId)

    const segments = (supadataData.content ?? []).map((s: any) => ({
      text: s.text,
      start: Math.round((s.offset ?? 0) / 1000),
    }))
    const transcript = segments.length > 0
      ? segments.map((s: any) => s.text).join(' ')
      : (supadataData.transcript ?? '')

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'No se pudo extraer texto del video.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Generar preguntas con Claude
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'API key de IA no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transcriptForClaude = segments.length > 0
      ? segments.slice(0, 150).map((s: any) => `${s.start}|${s.text}`).join('\n')
      : transcript.substring(0, 4000)

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: `Eres experto en diseno de actividades para educacion secundaria en Mexico (NEM).

Contexto pedagogico:
${contexto || 'Sin contexto adicional'}

Transcripcion del video (formato "segundos|texto"):
${transcriptForClaude}

Genera 4 preguntas interactivas basadas en el contenido REAL del video:
- 2 opcion multiple, 1 verdadero/falso, 1 pregunta abierta
- Ancladas a timestamps reales de la transcripcion
- En espanol claro para secundaria

Responde SOLO con JSON valido, sin markdown:
{"preguntas":[{"tipo":"multiple_choice","timestamp_segundos":45,"texto":"...","opciones":[{"id":"a","texto":"..."},{"id":"b","texto":"..."},{"id":"c","texto":"..."},{"id":"d","texto":"..."}],"respuesta_correcta":"a","puntos":10},{"tipo":"multiple_choice","timestamp_segundos":120,"texto":"...","opciones":[{"id":"a","texto":"..."},{"id":"b","texto":"..."},{"id":"c","texto":"..."},{"id":"d","texto":"..."}],"respuesta_correcta":"b","puntos":10},{"tipo":"true_false","timestamp_segundos":180,"texto":"...","respuesta_correcta":"true","puntos":10},{"tipo":"open","timestamp_segundos":240,"texto":"...","puntos":20}]}`
        }]
      })
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('Claude error:', errText)
      return new Response(JSON.stringify({ error: 'Error al generar preguntas con IA' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const claudeData = await claudeRes.json()
    const raw = claudeData.content?.[0]?.text ?? ''
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    console.log('Preguntas generadas:', parsed.preguntas?.length)

    return new Response(JSON.stringify({ preguntas: parsed.preguntas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Error:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
