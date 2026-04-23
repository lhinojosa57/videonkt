import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { text } = await req.json()

  const systemPrompt = `Eres un parser de preguntas para una plataforma educativa de video interactivo.
Tu tarea: analizar el texto pegado por un docente y extraer preguntas estructuradas.

Responde ÚNICAMENTE con un JSON válido, sin markdown, sin backticks, sin texto adicional.

Formato de salida (array de objetos):
[
  {
    "question_text": "¿Texto de la pregunta?",
    "question_type": "multiple_choice" | "true_false" | "open",
    "options": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],
    "correct_answer": "a" | "b" | "c" | "d" | "true" | "false" | null,
    "points": 10,
    "timestamp_seconds": 60
  }
]

Reglas:
- Si el texto incluye [mm:ss] o mm:ss al inicio de la pregunta, úsalo como timestamp_seconds
- Si no hay timestamp, distribuye las preguntas equitativamente (primera en segundo 60, siguientes en incrementos de 120s)
- Si hay 4 opciones → multiple_choice
- Si solo hay 2 opciones que sean Verdadero/Falso, Sí/No, Cierto/Falso → true_false, correct_answer = "true" o "false"
- Si no hay opciones → open, correct_answer = null, options = []
- La respuesta correcta puede venir marcada con: *, →, (correcta), negrita, o "Respuesta: X" al final
- Si no se detecta respuesta correcta → correct_answer = "a" para multiple_choice
- points siempre = 10
- Normaliza el texto: quita numeración del inicio (1., 2., a), b), etc.)
- Para multiple_choice, options SIEMPRE debe tener exactamente los elementos con texto no vacío`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: text }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return new Response(JSON.stringify({ error: 'No text response' }), { status: 500 })
  }

 const clean = content.text.replace(/```json|```/g, '').trim()

  try {
    JSON.parse(clean)
  } catch {
    return new Response(
      JSON.stringify({ error: 'La IA no devolvió JSON válido. Intenta de nuevo.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response(clean, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config = { runtime: 'edge' }