import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
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
    const supabase = crearClienteAdmin()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Faltan variables de entorno de Supabase en el servidor' },
        { status: 500 }
      )
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'user',
      },
    })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // 2. Crear usuario en BD de Prisma
    try {
      const usuario = await prisma.usuario.create({
        data: {
          id: authData.user!.id,
          email,
        },
      })

      // 3. Asignar rol por defecto (user)
      await prisma.usuarioRol.create({
        data: {
          usuarioId: usuario.id,
          rol: 'user',
        },
      })

      return NextResponse.json(
        {
          message: 'Usuario registrado exitosamente',
          user: {
            id: usuario.id,
            email: usuario.email,
          },
        },
        { status: 201 }
      )
    } catch (dbError: any) {
      // Si falla la creación en BD, eliminar el usuario de Auth
      await supabase.auth.admin.deleteUser(authData.user!.id)

      return NextResponse.json(
        { error: 'Error al crear usuario en la base de datos: ' + dbError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error en registro:', error)
    return NextResponse.json(
      { error: error.message || 'Error al registrarse' },
      { status: 500 }
    )
  }
}
