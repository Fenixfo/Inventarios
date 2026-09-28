import { variablesFaltantes } from '@/lib/entorno'

/**
 * Next.js lo llama una vez al arrancar el servidor (Next.js 16,
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
 *
 * Solo avisa: no detiene el arranque. Un throw aquí tumbaría también el
 * build por una variable que solo se usa en una ruta, que es lo que el
 * proyecto ya evita en lib/supabase-client.ts.
 */
export function register() {
  const faltan = variablesFaltantes()
  if (faltan.length === 0) return

  console.error(
    'Faltan variables de entorno:\n' +
      faltan.map(({ nombre, para }) => `  - ${nombre} (para ${para})`).join('\n')
  )
}
