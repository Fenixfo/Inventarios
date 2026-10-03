import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NuevaCompraPage from '@/app/admin/compras/nueva/page'

// --- Lo que rodea a la pantalla se sustituye: red, permisos, router, subida de imágenes ---

const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

const borrarImagen = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/storage', () => ({ borrarImagen: (...args: unknown[]) => borrarImagen(...args) }))

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))

vi.mock('@/components/PermissionProtector', () => ({
  PermissionProtector: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

let permisos = true
vi.mock('@/components/PermisosProvider', () => ({
  usePermisos: () => ({ puede: () => permisos }),
}))

// El selector de proveedor tiene su propia búsqueda; aquí basta con poder elegir uno.
vi.mock('@/components/compras/SelectorProveedor', () => ({
  SelectorProveedor: ({ valor, onChange }: { valor: unknown; onChange: (p: unknown) => void }) =>
    valor ? (
      <div>Proveedor elegido</div>
    ) : (
      <button type="button" onClick={() => onChange({ id: 'prov-1', nombre: 'Cerámicas del Norte', nit: null })}>
        Elegir proveedor
      </button>
    ),
}))

const URL_IMAGEN = 'https://x.supabase.co/storage/v1/object/public/productos/productos/abc-def.png'
vi.mock('@/components/ImageUploader', () => ({
  ImageUploader: ({ valor, onChange, onSubida }: { valor: string; onChange: (u: string) => void; onSubida?: (u: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        onChange(URL_IMAGEN)
        onSubida?.(URL_IMAGEN)
      }}
    >
      {valor ? 'Imagen subida' : 'Subir imagen'}
    </button>
  ),
}))

const respuesta = (ok: boolean, cuerpo: unknown, status = ok ? 200 : 400) => ({ ok, status, json: async () => cuerpo })

const PRODUCTO = {
  id: 'prod-1',
  sku: 'BAL-2',
  nombre: 'Baldosa 2',
  categoria: 'Pisos',
  dimensiones: '60x60',
  color: 'Gris',
  acabado: null,
  espesorMm: null,
  m2PorCaja: null,
  precioUnitario: 25000,
  precioBodega: null,
  costo: 1000,
  stockActual: 5,
  stockMinimo: 0,
  proveedor: null,
  descripcion: null,
  imagenUrl: null,
}

/** Responde a las rutas que usa la pantalla; `verificar` y `compras` se definen en cada prueba. */
function simularApi(opciones: {
  verificar?: (lineas: { sku: string; nombre?: string }[]) => unknown[]
  compras?: () => ReturnType<typeof respuesta>
}) {
  apiFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
    if (url.startsWith('/api/productos/categorias')) return respuesta(true, ['Pisos'])
    if (url === '/api/compras/verificar') {
      const { lineas } = JSON.parse(init!.body!)
      return respuesta(true, { resultados: opciones.verificar!(lineas) })
    }
    if (url === '/api/compras') return opciones.compras!()
    throw new Error(`Ruta no simulada: ${url}`)
  })
}

const existente = (lineas: { sku: string }[]) => lineas.map((l) => ({ sku: l.sku, estado: 'existente', producto: { ...PRODUCTO, sku: l.sku } }))
const nuevo = (lineas: { sku: string }[]) => lineas.map((l) => ({ sku: l.sku, estado: 'nuevo' }))

/** Escribe el SKU de la primera línea y sale del campo para que se verifique. */
async function escribirSku(sku: string) {
  const campo = screen.getByLabelText('SKU *')
  await userEvent.clear(campo)
  await userEvent.type(campo, sku)
  await userEvent.tab()
}

beforeEach(() => {
  apiFetch.mockReset()
  borrarImagen.mockClear()
  push.mockClear()
  permisos = true
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('pantalla de nueva compra', () => {
  it('se abre con una línea vacía y el resumen en cero', () => {
    simularApi({ verificar: nuevo })
    render(<NuevaCompraPage />)

    expect(screen.getByRole('heading', { name: 'Nueva compra' })).toBeInTheDocument()
    expect(screen.getByText('Línea 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar compra' })).toBeEnabled()
  })

  it('al salir del SKU lo verifica y marca la línea como existente', async () => {
    simularApi({ verificar: existente })
    render(<NuevaCompraPage />)

    await escribirSku('BAL-2')

    expect(await screen.findByText('Existente')).toBeInTheDocument()
    expect(screen.getByText(/Baldosa 2/)).toBeInTheDocument()
    expect(apiFetch).toHaveBeenCalledWith('/api/compras/verificar', expect.objectContaining({ method: 'POST' }))
  })

  it('un SKU nuevo se marca "Se creará" y pide los datos del producto', async () => {
    simularApi({ verificar: nuevo })
    render(<NuevaCompraPage />)

    await escribirSku('NUE-1')

    expect(await screen.findByText('Se creará')).toBeInTheDocument()
    expect(screen.getByLabelText('Nombre del producto *')).toBeInTheDocument()
  })

  it('con nombres parecidos pide elegir; "Es este producto" convierte la línea en la de ese producto', async () => {
    simularApi({
      verificar: (lineas) =>
        lineas.map((l) =>
          l.sku === 'BAL-2'
            ? { sku: l.sku, estado: 'existente', producto: PRODUCTO }
            : { sku: l.sku, estado: 'nuevo_con_parecidos', parecidos: [{ id: 'prod-1', sku: 'BAL-2', nombre: 'Baldosa 2' }] }
        ),
    })
    render(<NuevaCompraPage />)

    await escribirSku('OTRO-SKU')
    expect(await screen.findByText(/se parece al de productos que ya tienes/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Es este producto' }))

    expect(await screen.findByText('Existente')).toBeInTheDocument()
    expect(screen.getByLabelText('SKU *')).toHaveValue('BAL-2')
  })

  it('"No, crear uno nuevo" descarta el aviso y deja la línea como nueva', async () => {
    simularApi({
      verificar: (lineas) => lineas.map((l) => ({ sku: l.sku, estado: 'nuevo_con_parecidos', parecidos: [{ id: 'p', sku: 'X', nombre: 'Parecido' }] })),
    })
    render(<NuevaCompraPage />)

    await escribirSku('NUE-2')
    await userEvent.click(await screen.findByRole('button', { name: 'No, crear uno nuevo' }))

    expect(await screen.findByText('Se creará')).toBeInTheDocument()
    expect(screen.queryByText(/se parece al de productos/i)).toBeNull()
  })

  it('sin proveedor no guarda y no llama a la API de compras', async () => {
    simularApi({ verificar: nuevo, compras: () => respuesta(true, { id: 'c1' }, 201) })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(await screen.findByText('Elige el proveedor de la compra.')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras', expect.anything())
  })

  it('una línea incompleta impide guardar y se señala', async () => {
    simularApi({ verificar: existente, compras: () => respuesta(true, { id: 'c1' }, 201) })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('BAL-2')
    await screen.findByText('Existente')
    // Falta la cantidad y el precio de factura.
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(await screen.findByText('Revisa las líneas marcadas antes de guardar.')).toBeInTheDocument()
    expect(screen.getByText('La cantidad debe ser mayor que cero')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras', expect.anything())
  })

  it('registra la compra, muestra la confirmación y lleva al detalle', async () => {
    simularApi({ verificar: existente, compras: () => respuesta(true, { id: 'compra-9' }, 201) })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('BAL-2')
    await screen.findByText('Existente')
    await userEvent.type(screen.getByLabelText('Cantidad *'), '10')
    await userEvent.type(screen.getByLabelText('Precio de factura (por unidad) *'), '2000')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/compras/compra-9'))

    // La confirmación dijo cuántos productos se crean, se actualizan y cuánto stock entra.
    const pregunta = (window.confirm as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(pregunta).toContain('0 productos nuevos')
    expect(pregunta).toContain('1 existente')
    expect(pregunta).toContain('10 unidades')

    const [, opciones] = apiFetch.mock.calls.find(([url]) => url === '/api/compras')!
    expect(JSON.parse(opciones.body)).toMatchObject({
      proveedorId: 'prov-1',
      items: [{ productoId: 'prod-1', sku: 'BAL-2', cantidad: '10', precioFactura: '2000' }],
    })
  })

  it('si se cancela la confirmación no se guarda nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    simularApi({ verificar: existente, compras: () => respuesta(true, { id: 'c' }, 201) })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('BAL-2')
    await screen.findByText('Existente')
    await userEvent.type(screen.getByLabelText('Cantidad *'), '1')
    await userEvent.type(screen.getByLabelText('Precio de factura (por unidad) *'), '10')
    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras', expect.anything())
    expect(push).not.toHaveBeenCalled()
  })

  it('un 409 por nombres parecidos vuelve a marcar la línea para elegir, y conserva las imágenes', async () => {
    simularApi({
      verificar: nuevo,
      compras: () =>
        respuesta(
          false,
          { error: 'Línea 1: elige si es uno de los productos parecidos o uno nuevo', linea: 1, tipo: 'parecidos', parecidos: [{ id: 'p', sku: 'X', nombre: 'Parecido' }] },
          409
        ),
    })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('NUE-3')
    await screen.findByText('Se creará')
    await userEvent.type(screen.getByLabelText('Nombre del producto *'), 'Algo nuevo')
    await userEvent.type(screen.getByLabelText('Cantidad *'), '2')
    await userEvent.type(screen.getByLabelText('Precio de factura (por unidad) *'), '100')
    await userEvent.type(screen.getByLabelText('Precio al público *'), '500')
    // La imagen está en la sección plegada "Más datos del producto".
    await userEvent.click(screen.getByRole('button', { name: /Más datos del producto/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Subir imagen' }))
    // La categoría es un selector con búsqueda: se escribe y se confirma con Enter.
    const categoria = screen.getByPlaceholderText('Escribe o elige una categoría')
    await userEvent.type(categoria, 'Pisos{Enter}')

    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(await screen.findByText(/se parece al de productos que ya tienes/i)).toBeInTheDocument()
    // Un error de datos se corrige y se reintenta: la imagen subida no se borra.
    expect(borrarImagen).not.toHaveBeenCalled()
  })

  it('un error del servidor borra las imágenes que se subieron en ese intento', async () => {
    simularApi({ verificar: nuevo, compras: () => respuesta(false, { error: 'No se pudo registrar la compra' }, 500) })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('NUE-4')
    await screen.findByText('Se creará')
    await userEvent.type(screen.getByLabelText('Nombre del producto *'), 'Producto con foto')
    await userEvent.type(screen.getByLabelText('Cantidad *'), '2')
    await userEvent.type(screen.getByLabelText('Precio de factura (por unidad) *'), '100')
    await userEvent.type(screen.getByLabelText('Precio al público *'), '500')
    // La imagen está en la sección plegada "Más datos del producto".
    await userEvent.click(screen.getByRole('button', { name: /Más datos del producto/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Subir imagen' }))
    await userEvent.type(screen.getByPlaceholderText('Escribe o elige una categoría'), 'Pisos{Enter}')

    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))

    expect(await screen.findByText('No se pudo registrar la compra')).toBeInTheDocument()
    await waitFor(() => expect(borrarImagen).toHaveBeenCalledWith(URL_IMAGEN))
    // La línea ya no apunta a una imagen que no existe.
    expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeInTheDocument()
  })

  it('si se pulsa Registrar con una verificación en curso, espera a que termine y guarda sin fallar', async () => {
    // Pasaba al escribir el nombre de un producto nuevo y pulsar Registrar enseguida:
    // la línea seguía "Verificando…" y la pantalla paraba con "Revisa las líneas".
    let liberar!: () => void
    let verificaciones = 0

    apiFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
      if (url.startsWith('/api/productos/categorias')) return respuesta(true, ['Pisos'])
      if (url === '/api/compras/verificar') {
        verificaciones += 1
        const { lineas } = JSON.parse(init!.body!)
        const resultado = respuesta(true, { resultados: nuevo(lineas) })
        // La primera (al salir del SKU) responde ya; la segunda (al salir del nombre) queda en espera.
        if (verificaciones === 1) return resultado
        await new Promise<void>((r) => {
          liberar = r
        })
        return resultado
      }
      if (url === '/api/compras') return respuesta(true, { id: 'compra-5' }, 201)
      throw new Error(`Ruta no simulada: ${url}`)
    })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Elegir proveedor' }))
    await escribirSku('NUE-9')
    await screen.findByText('Se creará')

    await userEvent.type(screen.getByLabelText('Nombre del producto *'), 'Producto con nombre')
    await userEvent.type(screen.getByLabelText('Cantidad *'), '2')
    await userEvent.type(screen.getByLabelText('Precio de factura (por unidad) *'), '100')
    await userEvent.type(screen.getByLabelText('Precio al público *'), '500')
    await userEvent.type(screen.getByPlaceholderText('Escribe o elige una categoría'), 'Pisos{Enter}')

    // Al salir del nombre empezó la segunda verificación, y sigue en curso.
    await waitFor(() => expect(verificaciones).toBe(2))
    expect(screen.getByText('Verificando…')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Registrar compra' }))
    // Mientras la verificación no termina, no se guarda ni se muestra ningún error.
    expect(apiFetch).not.toHaveBeenCalledWith('/api/compras', expect.anything())
    expect(screen.queryByText('Revisa las líneas marcadas antes de guardar.')).toBeNull()

    liberar()

    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/compras/compra-5'))
    expect(screen.queryByText('Revisa las líneas marcadas antes de guardar.')).toBeNull()
  })

  it('si se escribe el nombre mientras se verifica el SKU, se vuelve a verificar con ese nombre', async () => {
    // La primera verificación se pidió sin nombre: su respuesta "nuevo" no dice nada de los
    // parecidos al nombre que se escribió después, y el aviso no aparecía nunca.
    const pedidos: { sku: string; nombre?: string }[] = []
    let liberarPrimera!: () => void

    apiFetch.mockImplementation(async (url: string, init?: { body?: string }) => {
      if (url.startsWith('/api/productos/categorias')) return respuesta(true, ['Pisos'])
      if (url === '/api/compras/verificar') {
        const { lineas } = JSON.parse(init!.body!)
        pedidos.push(lineas[0])
        if (pedidos.length === 1) {
          await new Promise<void>((r) => {
            liberarPrimera = r
          })
          return respuesta(true, { resultados: nuevo(lineas) })
        }
        return respuesta(true, {
          resultados: lineas.map((l: { sku: string }) => ({
            sku: l.sku,
            estado: 'nuevo_con_parecidos',
            parecidos: [{ id: 'p', sku: 'X', nombre: 'Mosaico parecido' }],
          })),
        })
      }
      throw new Error(`Ruta no simulada: ${url}`)
    })
    render(<NuevaCompraPage />)

    await escribirSku('NUE-7')
    await waitFor(() => expect(pedidos).toHaveLength(1))

    // Con la primera verificación todavía en curso, se escribe el nombre y se sale del campo.
    await userEvent.type(screen.getByLabelText('Nombre del producto *'), 'Mosaico verde')
    await userEvent.tab()
    expect(pedidos).toHaveLength(1)

    liberarPrimera()

    expect(await screen.findByText(/se parece al de productos que ya tienes/i)).toBeInTheDocument()
    expect(pedidos[1]).toMatchObject({ sku: 'NUE-7', nombre: 'Mosaico verde' })
  })

  it('agregar y quitar líneas, y los costos adicionales cambian el resumen', async () => {
    simularApi({ verificar: nuevo })
    render(<NuevaCompraPage />)

    await userEvent.click(screen.getByRole('button', { name: '+ Agregar línea' }))
    expect(screen.getByText('Línea 2')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'Quitar' })[0])
    expect(screen.queryByText('Línea 2')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '+ Agregar costo adicional' }))
    await userEvent.type(screen.getByLabelText('Valor'), '30000')
    expect(screen.getByText('Repartir entre las líneas')).toBeInTheDocument()
    // Los 30.000 salen en el resumen (costos adicionales y total) y en la nota de la línea.
    expect(screen.getAllByText(/30\.000/).length).toBeGreaterThanOrEqual(2)
  })
})
