import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
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
        costo: data.costo ? parseFloat(data.costo) : null,
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
      stockActual: parseFloat(data.stockActual || 0),
      stockMinimo: parseFloat(data.stockMinimo || 0),
    }

    if (data.dimensiones) updateData.dimensiones = data.dimensiones
    if (data.color) updateData.color = data.color
    if (data.acabado) updateData.acabado = data.acabado
    if (data.espesorMm) updateData.espesorMm = parseFloat(data.espesorMm)
    if (data.m2PorCaja) updateData.m2PorCaja = parseFloat(data.m2PorCaja)
    if (data.costo) updateData.costo = parseFloat(data.costo)
    if (data.proveedor) updateData.proveedor = data.proveedor
    if (data.descripcion) updateData.descripcion = data.descripcion
    if (data.imagenUrl) updateData.imagenUrl = data.imagenUrl

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
