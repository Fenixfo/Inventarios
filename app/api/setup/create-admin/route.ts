import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// El cliente se crea dentro del handler, no al importar el módulo: si
// faltara una variable de entorno, un throw a nivel de módulo tumbaría el
// build entero en vez de fallar solo esta ruta al usarla.
function crearClienteAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) return null

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  try {
    // Verificar token de setup (en producción, usar algo más seguro)
    const token = request.headers.get('x-setup-token')
    if (token !== process.env.SETUP_TOKEN) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

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

    // Crear usuario
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'admin',
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        message: 'Usuario admin creado exitosamente',
        user: data.user,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creando admin:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear usuario' },
      { status: 500 }
    )
  }
}
