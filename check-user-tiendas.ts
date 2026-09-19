import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const userId = '544ccacf-c14a-4459-9a1e-01a95fe63b06'

  console.log('\n🔍 Verificando usuario...\n')

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { tiendas: true }
  })

  if (!usuario) {
    console.log('❌ Usuario no encontrado')
    return
  }

  console.log(`✅ Usuario: ${usuario.email}`)
  console.log(`   Tiendas asociadas: ${usuario.tiendas.length}`)

  usuario.tiendas.forEach(ut => {
    console.log(`   - tiendaId: ${ut.tiendaId}`)
  })

  // También verificar directamente en usuarioTienda
  console.log('\n📋 Verificando tabla UsuarioTienda...\n')

  const usuarioTiendas = await prisma.usuarioTienda.findMany({
    where: { usuarioId: userId },
    include: { tienda: true }
  })

  console.log(`Registros encontrados: ${usuarioTiendas.length}`)
  usuarioTiendas.forEach(ut => {
    console.log(`- Tienda: ${ut.tienda.nombre}`)
  })

  await prisma.$disconnect()
}

check()
