import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
// GET: Obtener todos los roles personalizados (excepto Owner)
export async function GET(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.ver')
    if (sinPermiso) return sinPermiso

    const roles = await prisma.rolPersonalizado.findMany({
      where: {
        activo: true,
        nombre: { not: 'Owner' }
      },
      include: {
        permisos: {
          include: { modulo: true }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    return NextResponse.json(roles)
  } catch (error: any) {
    console.error('Error obteniendo roles:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener roles' },
      { status: 500 }
    )
  }
}

// POST: Crear nuevo rol personalizado
export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'usuarios.gestionar')
    if (sinPermiso) return sinPermiso

    const { nombre, descripcion, permisoIds } = await request.json()

    if (!nombre) {
      return NextResponse.json(
        { error: 'Nombre es requerido' },
        { status: 400 }
      )
    }

    // Verificar que el nombre sea único
    const existe = await prisma.rolPersonalizado.findUnique({
      where: { nombre }
    })

    if (existe) {
      return NextResponse.json(
        { error: 'Ya existe un rol con este nombre' },
        { status: 400 }
      )
    }

    // Crear rol
    const rol = await prisma.rolPersonalizado.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        esAdmin: false,
        activo: true,
      },
      include: {
        permisos: { include: { modulo: true } }
      }
    })

    // Asignar permisos si se pasan
    if (permisoIds && Array.isArray(permisoIds)) {
      for (const moduloId of permisoIds) {
        await prisma.permisoRolPersonalizado.create({
          data: {
            rolId: rol.id,
            moduloId
          }
        })
      }
    }

    // Obtener rol actualizado
    const rolActualizado = await prisma.rolPersonalizado.findUnique({
      where: { id: rol.id },
      include: {
        permisos: { include: { modulo: true } }
      }
    })

    return NextResponse.json(rolActualizado, { status: 201 })
  } catch (error: any) {
    console.error('Error creando rol:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear rol' },
      { status: 500 }
    )
  }
}
