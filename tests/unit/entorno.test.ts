import { describe, it, expect } from 'vitest'
import { variablesFaltantes } from '@/lib/entorno'

// Auditoría ECC, punto 16: comprobar al arrancar que existen las variables.
describe('variablesFaltantes', () => {
  const completas = {
    DATABASE_URL: 'postgresql://x',
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x',
    SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  }

  it('no avisa nada con todas puestas', () => {
    expect(variablesFaltantes(completas)).toEqual([])
  })

  it('dice cuáles faltan y para qué sirven, también si están vacías', () => {
    const faltan = variablesFaltantes({ ...completas, DATABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: '  ' })
    expect(faltan.map((f) => f.nombre)).toEqual(['DATABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
    expect(faltan[0].para).toMatch(/base de datos/)
  })
})
