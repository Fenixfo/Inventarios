import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey)

// No se lanza el error aquí: este módulo lo importa AdminProtector, y con él
// todas las páginas del panel. Un throw durante la evaluación del módulo
// aborta el prerenderizado y tumba el build entero, convirtiendo un problema
// de configuración en un deploy roto. Con marcadores, el fallo aparece al
// usar el cliente y se puede diagnosticar.
if (!supabaseConfigurado) {
  console.error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'La autenticación no va a funcionar hasta configurarlas.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://sin-configurar.supabase.co',
  supabaseAnonKey || 'sin-configurar'
)
