import { NextRequest, NextResponse } from 'next/server'
import { usuarioDePeticion, puedeAlguno } from '@/lib/permisos'

const BUCKET = 'productos'
const TAMANO_MAXIMO = 2 * 1024 * 1024
const TIPOS = ['image/webp', 'image/jpeg', 'image/png']

// Cada carpeta exige la acción correspondiente: subir la foto de un producto
// es parte de crearlo o editarlo, y el logo es configuración de la tienda.
const PERMISO_POR_CARPETA: Record<string, string[]> = {
  productos: ['productos.crear', 'productos.editar'],
  logos: ['configuracion.editar'],
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await usuarioDePeticion(request)
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
    }

    const form = await request.formData()
    const archivo = form.get('archivo')
    const carpeta = String(form.get('carpeta') || '')

    const permisoNecesario = PERMISO_POR_CARPETA[carpeta]
    if (!permisoNecesario) {
      return NextResponse.json({ error: 'Destino no válido' }, { status: 400 })
    }

    if (!puedeAlguno(usuario, permisoNecesario)) {
      return NextResponse.json(
        { error: `No tienes permiso para subir imágenes de ${carpeta}` },
        { status: 403 }
      )
    }

    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    if (!TIPOS.includes(archivo.type)) {
      return NextResponse.json(
        { error: 'Formato no permitido. Usa JPG, PNG o WebP.' },
        { status: 400 }
      )
    }

    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        { error: 'La imagen supera los 2 MB incluso después de comprimirla' },
        { status: 400 }
      )
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !servicio) {
      return NextResponse.json(
        { error: 'Almacenamiento no configurado en el servidor' },
        { status: 500 }
      )
    }

    const extension = archivo.type.split('/')[1].replace('jpeg', 'jpg')
    const ruta = `${carpeta}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`

    const subida = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${servicio}`,
        apikey: servicio,
        'Content-Type': archivo.type,
      },
      body: Buffer.from(await archivo.arrayBuffer()),
    })

    if (!subida.ok) {
      const detalle = await subida.text()
      console.error('Error subiendo a Storage:', detalle)
      return NextResponse.json({ error: 'No se pudo guardar la imagen' }, { status: 502 })
    }

    return NextResponse.json({
      url: `${url}/storage/v1/object/public/${BUCKET}/${ruta}`,
      ruta,
    })
  } catch (error: any) {
    console.error('Error en subida de imagen:', error)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const usuario = await usuarioDePeticion(request)
    if (!usuario) {
      return NextResponse.json({ error: 'Sesión no válida' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ruta = searchParams.get('ruta') || ''
    const carpeta = ruta.split('/')[0]

    const permisoNecesario = PERMISO_POR_CARPETA[carpeta]
    if (!permisoNecesario || !puedeAlguno(usuario, permisoNecesario)) {
      return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const servicio = process.env.SUPABASE_SERVICE_ROLE_KEY

    await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${servicio}`, apikey: servicio! },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error al borrar la imagen' }, { status: 500 })
  }
}
