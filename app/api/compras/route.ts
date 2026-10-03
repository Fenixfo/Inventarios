import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { exigirTienda, puede } from '@/lib/permisos'
import { compraNueva, leerCuerpo } from '@/lib/esquemas'
import { camposACompletar, costoFinalUnitario, repartirCostosExtra, type DatosProducto } from '@/lib/compras'
import { clasificarLineas } from '@/lib/compras-clasificar'
import { leerPagina } from '@/lib/paginacion'

/**
 * Compras a proveedores: la factura de compra de uno o varios productos.
 *
 * Al guardarla, en UNA transacción: se crean los productos nuevos, se completan
 * los vacíos de los existentes, se suma el stock, se fija el costo y queda un
 * movimiento de inventario por línea. Si algo falla, no se guarda nada.
 *
 * Todo se recalcula aquí (reparto, costos, qué línea es nueva o existente): la
 * pantalla ayuda a quien escribe, pero no es de fiar.
 */

const redondear = (valor: number) => Math.round(valor * 100) / 100

/** Un error que se devuelve tal cual al navegador, con su estado. */
class ErrorCompra extends Error {
  constructor(readonly estado: number, readonly cuerpo: Record<string, unknown>) {
    super(String(cuerpo.error))
  }
}

/** Una fecha YYYY-MM-DD de la URL, o null si no viene o no es válida. */
function fechaDeUrl(valor: string | null): string | null {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null
}

/**
 * Lista de compras de la tienda, las más recientes primero, incluidas las
 * anuladas. Filtros: ?proveedorId=, ?fechaDesde=YYYY-MM-DD, ?fechaHasta=YYYY-MM-DD.
 */
export async function GET(request: NextRequest) {
  try {
    const { tiendaId, error: sinPermiso } = await exigirTienda(request, 'compras.ver')
    if (sinPermiso) return sinPermiso

    const { searchParams } = new URL(request.url)
    const { limite, desde } = leerPagina(searchParams)

    const where: Prisma.CompraWhereInput = { tiendaId }

    const proveedorId = searchParams.get('proveedorId')
    if (proveedorId) {
      // Un identificador inventado no debe dar error de base: simplemente no hay compras.
      if (!/^[0-9a-f-]{36}$/i.test(proveedorId)) return NextResponse.json({ compras: [], total: 0 })
      where.proveedorId = proveedorId
    }

    // Las compras con fecha sin hora se guardan a mediodía UTC, así que los
    // extremos del día cubren cualquier zona horaria. Se llaman fechaDesde y
    // fechaHasta porque `desde` ya es el desplazamiento de la paginación.
    const fechaDesde = fechaDeUrl(searchParams.get('fechaDesde'))
    const fechaHasta = fechaDeUrl(searchParams.get('fechaHasta'))
    if (fechaDesde || fechaHasta) {
      where.fecha = {
        ...(fechaDesde ? { gte: new Date(`${fechaDesde}T00:00:00Z`) } : {}),
        ...(fechaHasta ? { lte: new Date(`${fechaHasta}T23:59:59.999Z`) } : {}),
      }
    }

    const [compras, total] = await Promise.all([
      prisma.compra.findMany({
        where,
        select: {
          id: true,
          fecha: true,
          numeroFacturaProveedor: true,
          estado: true,
          subtotal: true,
          totalExtras: true,
          total: true,
          proveedor: { select: { id: true, nombre: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: limite,
        skip: desde,
      }),
      prisma.compra.count({ where }),
    ])

    return NextResponse.json({
      total,
      compras: compras.map((c) => ({
        id: c.id,
        fecha: c.fecha,
        numeroFacturaProveedor: c.numeroFacturaProveedor,
        estado: c.estado,
        proveedor: c.proveedor,
        lineas: c._count.items,
        subtotal: Number(c.subtotal),
        totalExtras: Number(c.totalExtras),
        total: Number(c.total),
      })),
    })
  } catch (error) {
    console.error('Error listando compras:', error)
    return NextResponse.json({ error: 'No se pudieron obtener las compras' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Fuera del try para que el catch pueda volver a clasificar tras una carrera.
  let tiendaId: string | null = null
  let lineasSinProducto: { indice: number; sku: string; nombre?: string }[] = []

  try {
    const sesion = await exigirTienda(request, 'compras.crear')
    if (sesion.error) return sesion.error
    const { usuario } = sesion
    tiendaId = sesion.tiendaId

    const { datos, error: invalido } = await leerCuerpo(request, compraNueva)
    if (invalido) return invalido

    const items = datos.items

    // Crear productos desde una compra exige además poder crear productos: si no,
    // la compra sería una puerta trasera para saltarse ese permiso.
    if (items.some((l) => !l.productoId) && !puede(usuario, 'productos.crear', tiendaId)) {
      return NextResponse.json(
        { error: 'Para crear productos nuevos desde una compra necesitas además el permiso de crear productos' },
        { status: 403 }
      )
    }

    // El proveedor tiene que ser de esta tienda.
    const proveedor = await prisma.proveedor.findFirst({
      where: { id: datos.proveedorId, tiendaId },
      select: { id: true, nombre: true },
    })
    if (!proveedor) return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })

    // La misma factura de un proveedor no se registra dos veces, salvo que la
    // anterior esté anulada. (El índice único parcial lo garantiza también ante una carrera.)
    if (datos.numeroFacturaProveedor) {
      const repetida = await prisma.compra.findFirst({
        where: {
          tiendaId,
          proveedorId: proveedor.id,
          numeroFacturaProveedor: datos.numeroFacturaProveedor,
          estado: { not: 'anulada' },
        },
        select: { id: true },
      })
      if (repetida) {
        return NextResponse.json(
          { error: 'Esa factura ya está registrada para este proveedor', compraId: repetida.id },
          { status: 409 }
        )
      }
    }

    // Líneas de productos que ya existen: deben ser de la tienda y estar activos.
    const idsExistentes = [...new Set(items.flatMap((l) => (l.productoId ? [l.productoId] : [])))]
    const productos = idsExistentes.length
      ? await prisma.producto.findMany({ where: { id: { in: idsExistentes }, tiendaId, activo: true } })
      : []
    const porId = new Map(productos.map((p) => [p.id, p]))

    const vistos = new Map<string, number>()
    for (const [i, l] of items.entries()) {
      if (!l.productoId) continue
      if (!porId.has(l.productoId)) {
        return NextResponse.json(
          { error: `Línea ${i + 1}: el producto ya no existe en esta tienda`, linea: i + 1, tipo: 'producto_inexistente' },
          { status: 409 }
        )
      }
      const antes = vistos.get(l.productoId)
      if (antes !== undefined) {
        return NextResponse.json(
          { error: `Línea ${i + 1}: ese producto ya está en la línea ${antes + 1}`, linea: i + 1, tipo: 'producto_repetido' },
          { status: 400 }
        )
      }
      vistos.set(l.productoId, i)
    }

    // Líneas sin productoId: se crean como productos nuevos, salvo que su SKU
    // exista ya (otra persona lo creó mientras tanto) o el nombre se parezca a
    // otro producto y no se haya confirmado que es nuevo.
    lineasSinProducto = items.flatMap((l, indice) => (l.productoId ? [] : [{ indice, sku: l.sku, nombre: l.nombre }]))
    if (lineasSinProducto.length > 0) {
      const estados = await clasificarLineas(tiendaId, lineasSinProducto)

      for (const [k, estado] of estados.entries()) {
        const { indice, sku } = lineasSinProducto[k]
        if (estado.estado === 'existente') {
          return NextResponse.json(
            {
              error: `Línea ${indice + 1}: el SKU ${sku} ya existe; revisa la línea y confirma`,
              linea: indice + 1,
              tipo: 'sku_existe',
              producto: estado.producto,
            },
            { status: 409 }
          )
        }
        if (estado.estado === 'nuevo_con_parecidos' && !items[indice].confirmadoNuevo) {
          return NextResponse.json(
            {
              error: `Línea ${indice + 1}: elige si es uno de los productos parecidos o uno nuevo`,
              linea: indice + 1,
              tipo: 'parecidos',
              parecidos: estado.parecidos,
            },
            { status: 409 }
          )
        }
      }
    }

    // --- Cálculo de costos (siempre en el servidor) ---
    const totalExtras = redondear(datos.costosExtra.reduce((suma, e) => suma + e.valor, 0))
    const repartos = repartirCostosExtra(
      items.map((l) => ({ cantidad: l.cantidad, precioFactura: l.precioFactura })),
      totalExtras,
      datos.metodoReparto
    )

    const lineas = items.map((l, i) => {
      const existente = l.productoId ? porId.get(l.productoId)! : null
      return {
        ...l,
        existente,
        productoId: existente ? existente.id : randomUUID(),
        costoExtra: repartos[i],
        costoFinal: costoFinalUnitario(l.precioFactura, l.cantidad, repartos[i], l.costoFinalManual ?? null),
        costoEditado: l.costoFinalManual !== undefined && l.costoFinalManual !== null,
      }
    })

    const subtotal = redondear(items.reduce((suma, l) => suma + l.cantidad * l.precioFactura, 0))
    const total = redondear(subtotal + totalExtras)
    const ahora = new Date()

    // --- Una sola transacción ---
    const resultado = await prisma.$transaction(
      async (tx) => {
        let compra: { id: string }
        try {
          compra = await tx.compra.create({
            data: {
              tiendaId: tiendaId!,
              proveedorId: proveedor.id,
              numeroFacturaProveedor: datos.numeroFacturaProveedor,
              fecha: datos.fecha,
              subtotal,
              totalExtras,
              total,
              metodoReparto: datos.metodoReparto,
              observaciones: datos.observaciones,
              creadaPor: usuario.id,
            },
            select: { id: true },
          })
        } catch (error: any) {
          // El índice único parcial: otra persona registró esa factura mientras tanto.
          if (error?.code === 'P2002') {
            throw new ErrorCompra(409, { error: 'Esa factura ya está registrada para este proveedor' })
          }
          throw error
        }

        if (datos.costosExtra.length > 0) {
          await tx.compraCostoExtra.createMany({
            data: datos.costosExtra.map((e) => ({ compraId: compra.id, concepto: e.concepto, valor: e.valor })),
          })
        }

        // Productos nuevos: un solo createMany, con el id ya decidido.
        const nuevas = lineas.filter((l) => !l.existente)
        if (nuevas.length > 0) {
          await tx.producto.createMany({
            data: nuevas.map((l) => ({
              id: l.productoId,
              tiendaId: tiendaId!,
              createdBy: usuario.id,
              sku: l.sku,
              nombre: l.nombre!,
              categoria: l.categoria!,
              dimensiones: l.dimensiones,
              color: l.color,
              acabado: l.acabado,
              espesorMm: l.espesorMm ?? null,
              m2PorCaja: l.m2PorCaja ?? null,
              precioUnitario: l.precioUnitario!,
              precioUnitarioUpdatedAt: ahora,
              precioBodega: l.precioBodega ?? null,
              precioBodegaUpdatedAt: l.precioBodega ? ahora : null,
              stockActual: 0,
              stockMinimo: l.stockMinimo ?? 0,
              proveedor: proveedor.nombre,
              descripcion: l.descripcion,
              imagenUrl: l.imagenUrl,
              activo: true,
            })),
          })
        }

        // Productos existentes: solo se completa lo vacío; lo que ya tienen no se toca.
        const diferencias: { linea: number; sku: string; diferencias: unknown[] }[] = []
        for (const [i, l] of lineas.entries()) {
          if (!l.existente) continue
          const p = l.existente

          const actual: DatosProducto = {
            dimensiones: p.dimensiones,
            color: p.color,
            acabado: p.acabado,
            espesorMm: p.espesorMm === null ? null : Number(p.espesorMm),
            m2PorCaja: p.m2PorCaja === null ? null : Number(p.m2PorCaja),
            precioBodega: p.precioBodega === null ? null : Number(p.precioBodega),
            descripcion: p.descripcion,
            imagenUrl: p.imagenUrl,
            proveedor: p.proveedor,
          }
          const escrito: DatosProducto = {
            dimensiones: l.dimensiones,
            color: l.color,
            acabado: l.acabado,
            espesorMm: l.espesorMm,
            m2PorCaja: l.m2PorCaja,
            precioBodega: l.precioBodega,
            descripcion: l.descripcion,
            imagenUrl: l.imagenUrl,
            proveedor: proveedor.nombre,
          }

          const { completar, diferencias: difs } = camposACompletar(actual, escrito)
          // Que el producto tenga otro proveedor escrito no es una diferencia que avisar.
          const relevantes = difs.filter((d) => d.campo !== 'proveedor')
          if (relevantes.length > 0) diferencias.push({ linea: i + 1, sku: p.sku, diferencias: relevantes })

          if (Object.keys(completar).length > 0) {
            await tx.producto.update({
              where: { id: p.id },
              data: {
                ...completar,
                ...(completar.precioBodega ? { precioBodegaUpdatedAt: ahora } : {}),
              } as Prisma.ProductoUpdateInput,
            })
          }
        }

        // Stock y costo de TODOS los productos en una sola sentencia atómica: suma
        // sobre el valor que haya en la base en ese instante (no lee y reescribe).
        const valores = lineas.map(
          (l) => Prisma.sql`(${l.productoId}::uuid, ${l.cantidad}::numeric, ${l.costoFinal}::numeric)`
        )
        const filas = await tx.$queryRaw<{ id: string; stock_actual: unknown }[]>(Prisma.sql`
          UPDATE productos AS p
             SET stock_actual = p.stock_actual + v.cantidad,
                 costo = v.costo,
                 costo_updated_at = now(),
                 updated_at = now()
            FROM (VALUES ${Prisma.join(valores)}) AS v(id, cantidad, costo)
           WHERE p.id = v.id AND p.tienda_id = ${tiendaId}::uuid
          RETURNING p.id, p.stock_actual
        `)
        if (filas.length !== lineas.length) {
          throw new ErrorCompra(409, { error: 'Algún producto de la compra ya no está disponible. Revisa las líneas.' })
        }
        const stockDespues = new Map(filas.map((f) => [f.id, Number(f.stock_actual)]))

        const referencia = datos.numeroFacturaProveedor ? ` - Factura ${datos.numeroFacturaProveedor}` : ''
        await tx.inventarioMovimiento.createMany({
          data: lineas.map((l) => {
            const despues = stockDespues.get(l.productoId)!
            return {
              productoId: l.productoId,
              tipo: 'entrada',
              cantidad: l.cantidad,
              stockAntes: redondear(despues - l.cantidad),
              stockDespues: despues,
              referenciaTipo: 'compra',
              referenciaId: compra.id,
              motivo: `Compra a ${proveedor.nombre}${referencia}`,
              usuarioId: usuario.id,
            }
          }),
        })

        await tx.compraItem.createMany({
          data: lineas.map((l) => ({
            compraId: compra.id,
            productoId: l.productoId,
            productoNombre: l.existente ? l.existente.nombre : l.nombre!,
            productoCreado: !l.existente,
            cantidad: l.cantidad,
            precioFactura: l.precioFactura,
            costoExtra: l.costoExtra,
            costoFinal: l.costoFinal,
            costoEditado: l.costoEditado,
          })),
        })

        return { id: compra.id, diferencias }
      },
      { timeout: 20000 }
    )

    const creados = lineas.filter((l) => !l.existente).length

    // Auditoría fuera de la transacción: si falla, la compra ya es válida.
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: usuario.id,
          tiendaId,
          tablaAfectada: 'compras',
          registroId: resultado.id,
          accion: 'CREATE',
          datosDespues: {
            proveedorId: proveedor.id,
            numeroFacturaProveedor: datos.numeroFacturaProveedor,
            lineas: lineas.length,
            productosCreados: creados,
            subtotal,
            totalExtras,
            total,
          },
        },
      })
    } catch (auditError) {
      console.error('Error registrando auditoría de la compra:', auditError)
    }

    return NextResponse.json(
      {
        id: resultado.id,
        subtotal,
        totalExtras,
        total,
        productosCreados: creados,
        productosActualizados: lineas.length - creados,
        // Lo que la línea trajo distinto de lo que el producto ya tenía: no se aplicó.
        diferencias: resultado.diferencias,
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof ErrorCompra) return NextResponse.json(error.cuerpo, { status: error.estado })

    // Choque de índice único dentro de la transacción: otra persona creó un SKU
    // de esta compra mientras tanto. Se vuelve a clasificar para decir en qué línea.
    if (error?.code === 'P2002' && tiendaId) {
      try {
        const estados = await clasificarLineas(tiendaId, lineasSinProducto)
        const k = estados.findIndex((e) => e.estado === 'existente')
        if (k >= 0) {
          const { indice, sku } = lineasSinProducto[k]
          return NextResponse.json(
            { error: `Línea ${indice + 1}: el SKU ${sku} acaba de crearse; revisa la línea y confirma`, linea: indice + 1, tipo: 'sku_existe' },
            { status: 409 }
          )
        }
      } catch {
        // Si tampoco se puede clasificar, cae en el 409 genérico de abajo.
      }
      return NextResponse.json(
        { error: 'Algo de la compra se acaba de crear por otra persona (un SKU o la factura). Revisa las líneas y vuelve a guardar.' },
        { status: 409 }
      )
    }

    console.error('Error creando compra:', error)
    return NextResponse.json({ error: 'No se pudo registrar la compra' }, { status: 500 })
  }
}
