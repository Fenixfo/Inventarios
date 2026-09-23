import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirPermiso } from '@/lib/permisos'
export async function GET(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, ['productos.ver', 'facturas.crear'])
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')

    if (sku) {
      const productos = await prisma.producto.findMany({
        where: {
          sku: sku,
          activo: true
        }
      })
      return NextResponse.json(productos)
    }

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    })
    return NextResponse.json(productos)
  } catch (error) {
    return NextResponse.json(
      { error: 'Error fetching productos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'productos.crear')
    if (sinPermiso) return sinPermiso

    const data = await request.json()
    const producto = await prisma.producto.create({
      data: {
        sku: data.sku,
        nombre: data.nombre,
        categoria: data.categoria,
        dimensiones: data.dimensiones,
        color: data.color,
        acabado: data.acabado,
        espesorMm: data.espesorMm ? parseFloat(data.espesorMm) : null,
        m2PorCaja: data.m2PorCaja ? parseFloat(data.m2PorCaja) : null,
        precioUnitario: parseFloat(data.precioUnitario),
        precioUnitarioUpdatedAt: new Date(),
        // Sin precio de bodega se cobra el del público: es preferible a
        // dejarlo en cero y vender regalado.
        precioBodega: data.precioBodega ? parseFloat(data.precioBodega) : null,
        precioBodegaUpdatedAt: data.precioBodega ? new Date() : null,
        costo: data.costo ? parseFloat(data.costo) : null,
        costoUpdatedAt: data.costo ? new Date() : null,
        stockActual: parseFloat(data.stockActual || 0),
        stockMinimo: parseFloat(data.stockMinimo || 0),
        proveedor: data.proveedor,
        descripcion: data.descripcion,
        imagenUrl: data.imagenUrl,
        activo: true,
      },
    })
    return NextResponse.json(producto, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error creating producto' },
      { status: 400 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { error: sinPermiso } = await exigirPermiso(request, 'productos.editar')
    if (sinPermiso) return sinPermiso

    const data = await request.json()
    const { id } = data

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    const updateData: any = {
      sku: data.sku,
      nombre: data.nombre,
      categoria: data.categoria,
      precioUnitario: parseFloat(data.precioUnitario),
      precioUnitarioUpdatedAt: new Date(),
      stockActual: parseFloat(data.stockActual || 0),
      stockMinimo: parseFloat(data.stockMinimo || 0),
    }

    if (data.dimensiones) updateData.dimensiones = data.dimensiones
    if (data.color) updateData.color = data.color
    if (data.acabado) updateData.acabado = data.acabado
    if (data.espesorMm) updateData.espesorMm = parseFloat(data.espesorMm)
    if (data.m2PorCaja) updateData.m2PorCaja = parseFloat(data.m2PorCaja)

    // Cadena vacía significa "sin precio de bodega", que no es lo mismo que
    // no haber tocado el campo; por eso se compara contra undefined.
    if (data.precioBodega !== undefined) {
      updateData.precioBodega = data.precioBodega === '' || data.precioBodega === null
        ? null
        : parseFloat(data.precioBodega)
      updateData.precioBodegaUpdatedAt = updateData.precioBodega === null ? null : new Date()
    }

    if (data.costo) {
      updateData.costo = parseFloat(data.costo)
      updateData.costoUpdatedAt = new Date()
    }
    if (data.proveedor) updateData.proveedor = data.proveedor
    if (data.descripcion) updateData.descripcion = data.descripcion

    // Se compara contra undefined y no por valor: una cadena vacía significa
    // que el usuario quitó la imagen, y con `if (data.imagenUrl)` ese borrado
    // se perdía silenciosamente.
    if (data.imagenUrl !== undefined) updateData.imagenUrl = data.imagenUrl || null

    const producto = await prisma.producto.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(producto)
  } catch (error: any) {
    console.error('PUT error:', error)
    return NextResponse.json(
      { error: error.message || 'Error updating producto' },
      { status: 400 }
    )
  }
}
