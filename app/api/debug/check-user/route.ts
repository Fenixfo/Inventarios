import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { exigirPermiso } from '@/lib/permisos'

// Se crea dentro del handler: un throw al importar el módulo tumbaría el
// build entero si faltara una variable, en vez de fallar solo esta ruta.
function crearClienteAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) return null

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'administrador')
    if (sinPermiso) return sinPermiso

    const { userId, email } = await request.json()

    const supabase = crearClienteAdmin()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase en el servidor' },
        { status: 500 }
      )
    }

    console.log(`\n🔍 DEBUG: Verificando usuario ${email} (ID: ${userId})`)

    // 1. Verificar en Supabase Auth
    console.log('1️⃣  Verificando en Supabase Auth...')
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const supabaseUser = authUsers?.users.find((u) => u.id === userId)
    console.log(`   Resultado: ${supabaseUser ? '✅ Encontrado' : '❌ NO encontrado'}`)
    if (supabaseUser) {
      console.log(`   Email: ${supabaseUser.email}`)
      console.log(`   user_metadata: ${JSON.stringify(supabaseUser.user_metadata)}`)
    }

    // 2. Verificar en tabla Usuario
    console.log('\n2️⃣  Verificando en tabla Usuario...')
    const usuarioEnBD = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { roles: true },
    })
    console.log(`   Resultado: ${usuarioEnBD ? '✅ Encontrado' : '❌ NO encontrado'}`)
    if (usuarioEnBD) {
      console.log(`   ID: ${usuarioEnBD.id}`)
      console.log(`   Email: ${usuarioEnBD.email}`)
      console.log(`   Roles: ${usuarioEnBD.roles.map((r) => r.rol).join(', ') || 'NINGUNO'}`)
    }

    // 3. Respuesta de debug
    const response = {
      debug: {
        supabaseAuth: supabaseUser ? { id: supabaseUser.id, email: supabaseUser.email } : null,
        baseDatos: usuarioEnBD ? {
          id: usuarioEnBD.id,
          email: usuarioEnBD.email,
          roles: usuarioEnBD.roles.map((r) => r.rol),
        } : null,
      },
    }

    console.log('\n📋 Resumen:')
    console.log(JSON.stringify(response, null, 2))

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('❌ Error en debug:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
