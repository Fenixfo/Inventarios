import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCatalogo } from '@/components/catalogo/useCatalogo'

/**
 * La tienda que la portada muestra por defecto. Antes se elegía buscando
 * "beraca" en el nombre, y lo contienen dos tiendas: la portada tomaba la
 * primera que devolvía el filtro, que no era LAMINADOS Y CERAMICAS BERACA JJ.
 */

const PRINCIPAL = { id: '4fdb5356-4b10-4120-a183-c2a59979878f', nombre: 'LAMINADOS Y CERAMICAS BERACA JJ' }
const OTRA_BERACA = { id: 'cc86aa84-eca6-4e83-886e-cf60abd428b4', nombre: 'Beraca tienda de Don Jairo' }
const AJENA = { id: '63a97dec-9c95-4cfb-a26e-455b78737020', nombre: 'Test3' }

/** Las direcciones que pidió el hook, para ver con qué filtros consultó. */
let pedidos: string[] = []

function simularRed(tiendas: { id: string; nombre: string }[]) {
  pedidos = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      pedidos.push(url)
      const cuerpo = url.startsWith('/api/productos/catalogo/filtros')
        ? { categorias: ['Pisos'], tiendas }
        : { productos: [], total: 0 }
      return { ok: true, status: 200, json: async () => cuerpo }
    })
  )
}

const productosPedidos = () => pedidos.filter((u) => u.startsWith('/api/productos/catalogo?'))
const ultimoPedido = () => new URLSearchParams(productosPedidos().at(-1)!.split('?')[1])

beforeEach(() => {
  pedidos = []
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('tienda por defecto de la portada', () => {
  it('elige la tienda principal por su id, aunque otra tienda tenga "beraca" en el nombre y salga antes', async () => {
    // La otra Beraca va primero: con la búsqueda por nombre se habría elegido ella.
    simularRed([OTRA_BERACA, PRINCIPAL, AJENA])
    const { result } = renderHook(() => useCatalogo())

    await waitFor(() => expect(result.current.tiendaFiltro).toBe(PRINCIPAL.id))
    expect(result.current.esMuestra).toBe(false)
  })

  it('pide los productos de esa tienda, por tandas, y no la muestra de todas', async () => {
    simularRed([OTRA_BERACA, PRINCIPAL, AJENA])
    renderHook(() => useCatalogo())

    await waitFor(() => expect(productosPedidos().some((u) => u.includes(`tienda=${PRINCIPAL.id}`))).toBe(true))

    const params = ultimoPedido()
    expect(params.get('tienda')).toBe(PRINCIPAL.id)
    expect(params.get('limite')).toBe('9')
    expect(params.has('limitePorTienda')).toBe(false)
  })

  it('si la tienda principal no está entre las públicas, no se impone ninguna y sale la muestra de todas', async () => {
    simularRed([OTRA_BERACA, AJENA])
    const { result } = renderHook(() => useCatalogo())

    await waitFor(() => expect(result.current.tiendas).toHaveLength(2))
    expect(result.current.tiendaFiltro).toBe('')
    expect(result.current.esMuestra).toBe(true)
    expect(ultimoPedido().get('limitePorTienda')).toBe('5')
  })

  it('si el visitante elige "Todas las tiendas", no se le vuelve a imponer la principal', async () => {
    simularRed([OTRA_BERACA, PRINCIPAL, AJENA])
    const { result } = renderHook(() => useCatalogo())
    await waitFor(() => expect(result.current.tiendaFiltro).toBe(PRINCIPAL.id))

    act(() => result.current.setTiendaFiltro(''))

    await waitFor(() => expect(result.current.esMuestra).toBe(true))
    // Se dejan pasar las consultas de filtros que siguen al cambio y se comprueba que sigue en "todas".
    await new Promise((r) => setTimeout(r, 100))
    expect(result.current.tiendaFiltro).toBe('')
    expect(ultimoPedido().get('limitePorTienda')).toBe('5')
  })

  it('si el visitante elige otra tienda, se respeta', async () => {
    simularRed([OTRA_BERACA, PRINCIPAL, AJENA])
    const { result } = renderHook(() => useCatalogo())
    await waitFor(() => expect(result.current.tiendaFiltro).toBe(PRINCIPAL.id))

    act(() => result.current.setTiendaFiltro(OTRA_BERACA.id))

    await waitFor(() => expect(ultimoPedido().get('tienda')).toBe(OTRA_BERACA.id))
    expect(result.current.tiendaFiltro).toBe(OTRA_BERACA.id)
  })
})
