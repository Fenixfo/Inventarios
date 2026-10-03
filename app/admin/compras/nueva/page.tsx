'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { borrarImagen } from '@/lib/storage'
import { diaColombiano } from '@/lib/fechas'
import { pesos } from '@/lib/formato'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { SelectorProveedor } from '@/components/compras/SelectorProveedor'
import type { Proveedor } from '@/components/compras/FormularioProveedor'
import { LineaCompraEditor } from '@/components/compras/LineaCompraEditor'
import type { MetodoReparto } from '@/lib/compras'
import type { Parecido } from '@/lib/compras-clasificar'
import {
  calcularLineas,
  construirCuerpo,
  esNueva,
  extraVacio,
  lineaVacia,
  motivoNoLista,
  resumenDeCompra,
  skusRepetidos,
  type ExtraEditable,
  type LineaEditable,
} from '@/lib/compras-cliente'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Lo que devuelve POST /api/compras cuando algo falla. */
interface RespuestaDeError {
  error?: string
  /** La compra ya registrada, si el error es por una factura repetida. */
  compraId?: string
  /** La línea (empezando en 1) a la que se refiere el error. */
  linea?: number
  tipo?: 'sku_existe' | 'producto_inexistente' | 'parecidos' | 'producto_repetido'
  parecidos?: Parecido[]
}

export default function NuevaCompraPage() {
  const router = useRouter()
  const { puede } = usePermisos()
  const puedeCrearProductos = puede('productos.crear')

  // --- Encabezado ---
  const [proveedor, setProveedor] = useState<Proveedor | null>(null)
  const [fecha, setFecha] = useState(() => diaColombiano(new Date()))
  const [numeroFactura, setNumeroFactura] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // --- Costos adicionales ---
  const [metodo, setMetodo] = useState<MetodoReparto>('valor')
  const [extras, setExtras] = useState<ExtraEditable[]>([])

  // --- Líneas ---
  // La referencia es la fuente de verdad y el estado solo la refleja para
  // dibujar: así, al guardar, se lee siempre lo último aunque una verificación
  // acabe de terminar y React todavía no haya vuelto a pintar.
  const [lineas, setLineas] = useState<LineaEditable[]>(() => [lineaVacia()])
  const lineasRef = useRef<LineaEditable[]>(lineas)
  const [categorias, setCategorias] = useState<string[]>([])

  // Las imágenes que esta pantalla subió y todavía no pertenecen a ningún producto.
  const subidasRef = useRef<Set<string>>(new Set())
  const guardadaRef = useRef(false)
  // Las verificaciones de SKU en curso, por línea: guardar espera a que terminen.
  const verificacionesRef = useRef<Map<string, Promise<void>>>(new Map())

  const [guardando, setGuardando] = useState(false)
  const [mostrarProblemas, setMostrarProblemas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enlaceCompra, setEnlaceCompra] = useState<string | null>(null)

  const fijarLineas = useCallback((siguiente: LineaEditable[]) => {
    lineasRef.current = siguiente
    setLineas(siguiente)
  }, [])

  const actualizarLinea = useCallback(
    (clave: string, cambio: (l: LineaEditable) => LineaEditable) => {
      fijarLineas(lineasRef.current.map((l) => (l.clave === clave ? cambio(l) : l)))
    },
    [fijarLineas]
  )

  // Las categorías para sugerir; quien solo registra compras puede no tener
  // permiso de verlas, y entonces la categoría se escribe a mano.
  useEffect(() => {
    apiFetch('/api/productos/categorias')
      .then((res) => (res.ok ? res.json() : []))
      .then((lista: string[]) => setCategorias([...lista].sort((a, b) => a.localeCompare(b, 'es'))))
      .catch(() => {})
  }, [])

  // Si se sale de la pantalla sin guardar, las imágenes subidas quedarían
  // huérfanas en el almacenamiento: se borran.
  useEffect(() => {
    const subidas = subidasRef.current
    return () => {
      if (guardadaRef.current) return
      const enUso = new Set(lineasRef.current.map((l) => l.imagenUrl))
      for (const url of subidas) if (enUso.has(url)) borrarImagen(url).catch(() => {})
    }
  }, [])

  /** Borra las imágenes subidas aquí y las quita de las líneas. */
  const descartarImagenesSubidas = () => {
    const subidas = new Set(subidasRef.current)
    for (const url of subidas) borrarImagen(url).catch(() => {})
    subidasRef.current.clear()
    fijarLineas(lineasRef.current.map((l) => (subidas.has(l.imagenUrl) ? { ...l, imagenUrl: '' } : l)))
  }

  // --- Clasificar las líneas ---
  const ejecutarClasificacion = useCallback(
    async (clave: string, sku: string, nombre: string) => {
      const skuLimpio = sku.trim()
      if (!skuLimpio) return

      let nombreUsado = nombre

      // Si el nombre se edita mientras se verifica el SKU, esa respuesta se pidió
      // con el nombre viejo y no dice nada de los parecidos al nuevo: se vuelve a
      // verificar con el nombre actual (como mucho tres veces).
      for (let intento = 0; intento < 3; intento++) {
        actualizarLinea(clave, (l) => ({ ...l, estado: 'verificando' }))

        try {
          const res = await apiFetch('/api/compras/verificar', {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ lineas: [{ sku: skuLimpio, nombre: nombreUsado }] }),
          })
          const datos = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(datos.error || 'No se pudo verificar el SKU')

          const r = datos.resultados[0]
          actualizarLinea(clave, (l) => {
            // Si mientras tanto se cambió el SKU, la respuesta ya no corresponde.
            if (l.sku.trim() !== skuLimpio) return l.estado === 'verificando' ? { ...l, estado: 'sin_verificar' } : l

            if (r.estado === 'existente') {
              return { ...l, sku: r.producto.sku, estado: 'existente', producto: r.producto, parecidos: [], confirmadoNuevo: false, skuVerificado: r.producto.sku }
            }
            if (r.estado === 'nuevo_con_parecidos') {
              return { ...l, estado: 'parecidos', producto: null, parecidos: r.parecidos, confirmadoNuevo: false, skuVerificado: skuLimpio }
            }
            return { ...l, estado: 'nuevo', producto: null, parecidos: [], confirmadoNuevo: false, skuVerificado: skuLimpio }
          })
        } catch (err) {
          actualizarLinea(clave, (l) => ({ ...l, estado: 'sin_verificar' }))
          setError(err instanceof Error ? err.message : 'No se pudo verificar el SKU')
          return
        }

        // ¿Cambió el nombre mientras tanto? Entonces hay que volver a preguntar.
        const actual = lineasRef.current.find((l) => l.clave === clave)
        if (!actual || actual.sku.trim() !== skuLimpio || actual.estado === 'existente' || actual.nombre === nombreUsado) return
        nombreUsado = actual.nombre
      }
    },
    [actualizarLinea]
  )

  // Igual que la anterior, pero recuerda que la línea se está verificando para
  // que "Registrar compra" pueda esperar: pulsarlo con una verificación en
  // curso no debe fallar por una línea que está a punto de resolverse.
  const clasificar = useCallback(
    (clave: string, sku: string, nombre: string) => {
      const promesa = ejecutarClasificacion(clave, sku, nombre)
      verificacionesRef.current.set(clave, promesa)
      promesa.finally(() => {
        if (verificacionesRef.current.get(clave) === promesa) verificacionesRef.current.delete(clave)
      })
      return promesa
    },
    [ejecutarClasificacion]
  )

  const cambiarLinea =(clave: string, parche: Partial<LineaEditable>) => {
    actualizarLinea(clave, (l) => {
      const siguiente = { ...l, ...parche }
      const cambioElSku = parche.sku !== undefined && parche.sku.trim() !== l.skuVerificado
      const cambioElNombre = parche.nombre !== undefined && (l.estado === 'nuevo' || l.estado === 'parecidos')

      // Tras editar el SKU o el nombre, lo verificado ya no vale.
      if (cambioElSku || cambioElNombre) {
        return { ...siguiente, estado: 'sin_verificar', producto: null, parecidos: [], confirmadoNuevo: false }
      }
      return siguiente
    })
  }

  // Se verifica al salir del campo, solo si hay algo sin verificar.
  const verificarLinea = (clave: string) => {
    const l = lineasRef.current.find((x) => x.clave === clave)
    if (l && l.estado === 'sin_verificar' && l.sku.trim()) clasificar(clave, l.sku, l.nombre)
  }

  // "Es este producto": la línea pasa a ser la de ese producto.
  const escogerParecido = (clave: string, parecido: Parecido) => {
    actualizarLinea(clave, (l) => ({ ...l, sku: parecido.sku, estado: 'sin_verificar', producto: null, parecidos: [], confirmadoNuevo: false }))
    clasificar(clave, parecido.sku, '')
  }

  // "No, crear uno nuevo": se descarta el aviso de parecidos.
  const crearNuevo = (clave: string) => {
    actualizarLinea(clave, (l) => ({ ...l, estado: 'nuevo', parecidos: [], confirmadoNuevo: true }))
  }

  const agregarLinea = () => fijarLineas([...lineasRef.current, lineaVacia()])

  const quitarLinea = (clave: string) => {
    const l = lineasRef.current.find((x) => x.clave === clave)
    // Una imagen que esta pantalla subió y ya no se usará.
    if (l && subidasRef.current.has(l.imagenUrl)) {
      borrarImagen(l.imagenUrl).catch(() => {})
      subidasRef.current.delete(l.imagenUrl)
    }
    fijarLineas(lineasRef.current.filter((x) => x.clave !== clave))
  }

  // --- Costos adicionales ---
  const cambiarExtra = (clave: string, parche: Partial<ExtraEditable>) =>
    setExtras((prev) => prev.map((e) => (e.clave === clave ? { ...e, ...parche } : e)))

  // --- Cálculos para mostrar ---
  const repetidos = skusRepetidos(lineas)
  const calculos = calcularLineas(lineas, extras, metodo)
  const resumen = resumenDeCompra(lineas, extras, metodo)

  // --- Guardar ---
  const manejarFallo = (estado: number, cuerpo: RespuestaDeError) => {
    setError(cuerpo.error || 'No se pudo registrar la compra')
    if (cuerpo.compraId) setEnlaceCompra(`/admin/compras/${cuerpo.compraId}`)

    const linea = typeof cuerpo.linea === 'number' ? lineasRef.current[cuerpo.linea - 1] : undefined
    if (linea) {
      if (cuerpo.tipo === 'sku_existe' || cuerpo.tipo === 'producto_inexistente') {
        // El SKU cambió de estado mientras se escribía: se vuelve a clasificar la línea.
        actualizarLinea(linea.clave, (l) => ({ ...l, estado: 'sin_verificar', producto: null }))
        clasificar(linea.clave, linea.sku, linea.nombre)
      } else if (cuerpo.tipo === 'parecidos') {
        actualizarLinea(linea.clave, (l) => ({ ...l, estado: 'parecidos', parecidos: cuerpo.parecidos ?? [], confirmadoNuevo: false }))
      }
    }

    // Un error del servidor no se arregla corrigiendo líneas: las imágenes
    // subidas en este intento se borran. Un error de datos (400, 409) sí se
    // corrige y se vuelve a intentar, y entonces se conservan.
    if (estado >= 500) descartarImagenesSubidas()
  }

  const guardar = async () => {
    if (guardando) return

    setError(null)
    setEnlaceCompra(null)
    setMostrarProblemas(true)

    if (!proveedor) return setError('Elige el proveedor de la compra.')
    if (!fecha) return setError('Indica la fecha de la compra.')

    setGuardando(true)
    let guardada = false

    try {
      // Las líneas se verifican al salir del SKU o del nombre, pero se pudo pulsar
      // Guardar antes de salir de un campo o con una verificación aún en curso.
      // Se espera a todas; una respuesta puede dejar otra sin verificar (si se
      // editó mientras tanto), así que se repite hasta que no quede ninguna.
      for (let vuelta = 0; vuelta < 3; vuelta++) {
        for (const l of lineasRef.current) {
          if (l.estado === 'sin_verificar' && l.sku.trim() && !verificacionesRef.current.has(l.clave)) {
            clasificar(l.clave, l.sku, l.nombre)
          }
        }
        if (verificacionesRef.current.size === 0) break
        await Promise.all([...verificacionesRef.current.values()])
      }

      const actuales = lineasRef.current
      if (actuales.length === 0) return setError('Agrega al menos una línea.')

      const sinResolver = skusRepetidos(actuales)
      if (actuales.some((l) => motivoNoLista(l, sinResolver))) {
        return setError('Revisa las líneas marcadas antes de guardar.')
      }
      if (actuales.some(esNueva) && !puedeCrearProductos) {
        return setError('Hay productos nuevos y crear productos exige un permiso que no tienes.')
      }

      const r = resumenDeCompra(actuales, extras, metodo)
      const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
      if (
        !window.confirm(
          `¿Registrar la compra por ${pesos(r.total)}?\n\n` +
            `Se crearán ${plural(r.productosNuevos, 'producto nuevo', 'productos nuevos')}, ` +
            `se actualizarán ${plural(r.productosExistentes, 'existente', 'existentes')} ` +
            `y se sumarán ${r.unidades} unidades al inventario.`
        )
      ) {
        return
      }

      const res = await apiFetch('/api/compras', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(
          construirCuerpo({
            proveedorId: proveedor.id,
            fecha,
            numeroFacturaProveedor: numeroFactura,
            observaciones,
            metodoReparto: metodo,
            extras,
            lineas: actuales,
          })
        ),
      })
      const cuerpo = await res.json().catch(() => ({}))

      if (res.ok) {
        guardada = true
        guardadaRef.current = true
        router.push(`/admin/compras/${cuerpo.id}`)
        return
      }

      manejarFallo(res.status, cuerpo)
    } catch (err) {
      // Sin respuesta del servidor: no se sabe si se guardó. Las imágenes se
      // descartan y se pide revisar la lista de compras antes de repetir.
      descartarImagenesSubidas()
      setError(
        (err instanceof Error && err.message ? err.message + '. ' : '') +
          'No se pudo confirmar si la compra se guardó: revisa la lista de compras antes de volver a intentarlo.'
      )
    } finally {
      if (!guardada) setGuardando(false)
    }
  }

  return (
    <PermissionProtector requiredPermission="compras.crear">
      <div className="card" style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/compras" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Compras
          </Link>
        </div>

        <h1 className="card-title mb-1" style={{ fontSize: 20 }}>Nueva compra</h1>
        <p className="mb-5 text-sm" style={{ color: 'var(--gray-secondary)' }}>
          Registra la factura de compra a un proveedor. Cada línea es un producto: si el SKU ya existe se
          usa ese producto y se completan sus datos vacíos; si no, se crea uno nuevo. La compra suma el
          stock y deja el costo de cada producto.
        </p>

        {error && (
          <div className="alert-box error">
            {error}
            {enlaceCompra && (
              <>
                {' '}
                <Link href={enlaceCompra} style={{ color: 'inherit', textDecoration: 'underline' }}>Ver esa compra</Link>
              </>
            )}
          </div>
        )}

        {/* --- Encabezado --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="sm:col-span-2">
            <SelectorProveedor valor={proveedor} onChange={setProveedor} />
          </div>
          <div>
            <label htmlFor="compra-fecha" className="field-label">Fecha *</label>
            <input
              id="compra-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="compra-factura" className="field-label">Número de factura del proveedor</label>
            <input
              id="compra-factura"
              type="text"
              value={numeroFactura}
              onChange={(e) => setNumeroFactura(e.target.value)}
              maxLength={100}
              className="field-input"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="compra-observaciones" className="field-label">Observaciones</label>
            <textarea
              id="compra-observaciones"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              maxLength={2000}
              className="field-textarea"
            />
          </div>
        </div>

        {/* --- Líneas --- */}
        <h2 className="card-title mb-3" style={{ fontSize: 16 }}>Productos de la factura</h2>

        {lineas.map((l, i) => {
          const motivo = motivoNoLista(l, repetidos)
          // Un SKU repetido se avisa de inmediato; lo demás, tras intentar guardar.
          const problema = motivo && (mostrarProblemas || repetidos.has(l.sku.trim().toUpperCase())) ? motivo : null

          return (
            <LineaCompraEditor
              key={l.clave}
              indice={i}
              linea={l}
              calculo={calculos[i]}
              problema={problema}
              categorias={categorias}
              puedeCrearProductos={puedeCrearProductos}
              onCambiar={(parche) => cambiarLinea(l.clave, parche)}
              onVerificar={() => verificarLinea(l.clave)}
              onEscogerParecido={(p) => escogerParecido(l.clave, p)}
              onCrearNuevo={() => crearNuevo(l.clave)}
              onSubidaImagen={(url) => subidasRef.current.add(url)}
              onQuitar={lineas.length > 1 ? () => quitarLinea(l.clave) : undefined}
            />
          )
        })}

        <button type="button" onClick={agregarLinea} className="btn-secondary mb-5">
          + Agregar línea
        </button>

        {/* --- Costos adicionales --- */}
        <h2 className="card-title mb-1" style={{ fontSize: 16 }}>Costos adicionales</h2>
        <p className="mb-3 text-sm" style={{ color: 'var(--gray-secondary)' }}>
          Flete, descargue u otros costos de la factura. Se reparten entre las líneas y suben el costo final de cada producto.
        </p>

        {extras.map((e) => (
          <div key={e.clave} className="flex gap-3 flex-wrap mb-2" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor={`extra-concepto-${e.clave}`} className="field-label">Concepto</label>
              <input
                id={`extra-concepto-${e.clave}`}
                type="text"
                value={e.concepto}
                onChange={(ev) => cambiarExtra(e.clave, { concepto: ev.target.value })}
                placeholder="Flete, descargue…"
                maxLength={255}
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor={`extra-valor-${e.clave}`} className="field-label">Valor</label>
              <input
                id={`extra-valor-${e.clave}`}
                type="number"
                step="0.01"
                min="0"
                value={e.valor}
                onChange={(ev) => cambiarExtra(e.clave, { valor: ev.target.value })}
                onWheel={(ev) => ev.currentTarget.blur()}
                className="field-input"
                style={{ width: 160 }}
              />
            </div>
            <button type="button" onClick={() => setExtras((prev) => prev.filter((x) => x.clave !== e.clave))} className="btn-action danger">
              Quitar
            </button>
          </div>
        ))}

        <div className="flex gap-4 flex-wrap mb-5" style={{ alignItems: 'center' }}>
          <button type="button" onClick={() => setExtras((prev) => [...prev, extraVacio()])} className="btn-secondary">
            + Agregar costo adicional
          </button>

          {extras.length > 0 && (
            <div>
              <label htmlFor="compra-reparto" className="field-label">Repartir entre las líneas</label>
              <select
                id="compra-reparto"
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoReparto)}
                className="field-select"
              >
                <option value="valor">Por el valor de cada línea</option>
                <option value="cantidad">Por la cantidad de cada línea</option>
              </select>
            </div>
          )}
        </div>

        {/* --- Resumen --- */}
        <div
          style={{
            backgroundColor: 'var(--status-green-bg)',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          {/* Dos columnas en el celular (antes salía una sola y alargaba la página), más en pantallas grandes. */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Subtotal de la factura</div><strong>{pesos(resumen.subtotal)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Costos adicionales</div><strong>{pesos(resumen.totalExtras)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Total de la compra</div><strong style={{ fontSize: 18 }}>{pesos(resumen.total)}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Entra al inventario</div><strong>{resumen.unidades}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Productos nuevos</div><strong>{resumen.productosNuevos}</strong></div>
            <div><div style={{ fontSize: 12, color: 'var(--gray-secondary)' }}>Productos existentes</div><strong>{resumen.productosExistentes}</strong></div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button type="button" onClick={guardar} disabled={guardando} className="btn-primary">
            {guardando ? 'Guardando...' : 'Registrar compra'}
          </button>
          <Link href="/admin/compras" className="btn-secondary">Cancelar</Link>
        </div>
      </div>
    </PermissionProtector>
  )
}
