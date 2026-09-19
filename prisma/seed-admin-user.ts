import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Faltan variables de entorno de Supabase')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const prisma = new PrismaClient()

async function main() {
  try {
    const email = 'admin@beraca.com'

    console.log(`\n🔍 Buscando usuario ${email} en Supabase Auth...\n`)

    // Obtener usuario de Supabase Auth
    const { data: users, error: searchError } = await supabase.auth.admin.listUsers()

    if (searchError) {
      console.error('Error buscando usuarios:', searchError)
      return
    }

    const supabaseUser = users.users.find((u) => u.email === email)

    if (!supabaseUser) {
      console.log(`❌ No se encontró usuario ${email} en Supabase Auth`)
      console.log('Por favor, regístrate primero en /signup con ese email')
      return
    }

    console.log(`✅ Usuario encontrado en Supabase Auth (ID: ${supabaseUser.id})`)

    // Verificar si ya existe en BD
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { id: supabaseUser.id },
      include: { roles: true },
    })

    if (usuarioExistente) {
      console.log(`✅ Usuario ya existe en BD`)

      // Verificar si tiene rol admin
      const tieneRolAdmin = usuarioExistente.roles.some((r) => r.rol === 'admin')

      if (tieneRolAdmin) {
        console.log(`✅ Usuario ya tiene rol "admin"`)
      } else {
        // Agregar rol admin
        await prisma.usuarioRol.create({
          data: {
            usuarioId: supabaseUser.id,
            rol: 'admin',
          },
        })
        console.log(`✅ Rol "admin" asignado al usuario`)
      }
    } else {
      // Crear usuario en BD y asignar rol admin
      const usuario = await prisma.usuario.create({
        data: {
          id: supabaseUser.id,
          email,
        },
      })

      await prisma.usuarioRol.create({
        data: {
          usuarioId: usuario.id,
          rol: 'admin',
        },
      })

      console.log(`✅ Usuario creado en BD con rol "admin"`)
    }

    console.log(`\n✅ Listo! Ahora puedes ingresar con:`)
    console.log(`   Email: ${email}`)
    console.log(`   Contraseña: test@test`)
    console.log(`\n👉 Ve a http://localhost:3000/login e ingresa\n`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
