import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCart } from '@/hooks/useCart'

const PRODUCTO_A = {
  id: 'prod-a',
  sku: 'BAL-001',
  nombre: 'Baldosa Blanca',
  precioUnitario: 40000,
}

const PRODUCTO_B = {
  id: 'prod-b',
  sku: 'POR-002',
  nombre: 'Porcelanato Gris',
  precioUnitario: 65000,
}

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('estado inicial', () => {
    it('arranca vacío y con totales en cero', () => {
      const { result } = renderHook(() => useCart())

      expect(result.current.carrito.items).toEqual([])
      expect(result.current.carrito.totalCantidad).toBe(0)
      expect(result.current.carrito.totalM2).toBe(0)
      expect(result.current.carrito.totalPrecio).toBe(0)
    })
  })

  describe('agregarAlCarrito', () => {
    it('agrega un producto con su subtotal calculado', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 2.5))

      expect(result.current.carrito.items).toHaveLength(1)
      expect(result.current.carrito.items[0]).toMatchObject({
        id: 'prod-a',
        sku: 'BAL-001',
        cantidad: 2.5,
        subtotal: 100000,
      })
    })

    it('usa cantidad 1 cuando no se especifica', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A))

      expect(result.current.carrito.items[0].cantidad).toBe(1)
      expect(result.current.carrito.items[0].subtotal).toBe(40000)
    })

    it('suma la cantidad si el producto ya está en el carrito', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 2))
      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 3))

      expect(result.current.carrito.items).toHaveLength(1)
      expect(result.current.carrito.items[0].cantidad).toBe(5)
      expect(result.current.carrito.items[0].subtotal).toBe(200000)
    })

    it('mantiene productos distintos como líneas separadas', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.agregarAlCarrito(PRODUCTO_B, 1))

      expect(result.current.carrito.items).toHaveLength(2)
      expect(result.current.carrito.totalPrecio).toBe(105000)
    })

    it('maneja cantidades decimales sin perder precisión en el total', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito({ ...PRODUCTO_A, precioUnitario: 100 }, 0.5))

      expect(result.current.carrito.items[0].subtotal).toBe(50)
      expect(result.current.carrito.totalM2).toBe(0.5)
    })
  })

  describe('totales', () => {
    it('totalCantidad cuenta líneas, no metros', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 10))
      act(() => result.current.agregarAlCarrito(PRODUCTO_B, 20))

      expect(result.current.carrito.totalCantidad).toBe(2)
      expect(result.current.carrito.totalM2).toBe(30)
    })

    it('totalPrecio suma los subtotales de todas las líneas', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 2)) // 80000
      act(() => result.current.agregarAlCarrito(PRODUCTO_B, 1)) // 65000

      expect(result.current.carrito.totalPrecio).toBe(145000)
    })
  })

  describe('actualizarCantidad', () => {
    it('recalcula el subtotal al cambiar la cantidad', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.actualizarCantidad('prod-a', 4))

      expect(result.current.carrito.items[0].cantidad).toBe(4)
      expect(result.current.carrito.items[0].subtotal).toBe(160000)
    })

    it('quita el item si la cantidad baja a cero', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.actualizarCantidad('prod-a', 0))

      expect(result.current.carrito.items).toHaveLength(0)
    })

    it('quita el item si la cantidad es negativa', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.actualizarCantidad('prod-a', -5))

      expect(result.current.carrito.items).toHaveLength(0)
    })

    it('ignora ids que no están en el carrito', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.actualizarCantidad('no-existe', 99))

      expect(result.current.carrito.items).toHaveLength(1)
      expect(result.current.carrito.items[0].cantidad).toBe(1)
    })
  })

  describe('quitarDelCarrito', () => {
    it('elimina solo el producto indicado', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 1))
      act(() => result.current.agregarAlCarrito(PRODUCTO_B, 1))
      act(() => result.current.quitarDelCarrito('prod-a'))

      expect(result.current.carrito.items).toHaveLength(1)
      expect(result.current.carrito.items[0].id).toBe('prod-b')
      expect(result.current.carrito.totalPrecio).toBe(65000)
    })
  })

  describe('vaciarCarrito', () => {
    it('deja el carrito vacío y los totales en cero', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 5))
      act(() => result.current.agregarAlCarrito(PRODUCTO_B, 5))
      act(() => result.current.vaciarCarrito())

      expect(result.current.carrito.items).toEqual([])
      expect(result.current.carrito.totalCantidad).toBe(0)
      expect(result.current.carrito.totalM2).toBe(0)
      expect(result.current.carrito.totalPrecio).toBe(0)
    })
  })

  describe('persistencia en localStorage', () => {
    it('guarda el carrito al agregar productos', () => {
      const { result } = renderHook(() => useCart())

      act(() => result.current.agregarAlCarrito(PRODUCTO_A, 3))

      const guardado = JSON.parse(localStorage.getItem('inventarios-beraca-carrito') || '{}')
      expect(guardado.items).toHaveLength(1)
      expect(guardado.items[0].cantidad).toBe(3)
    })

    it('recupera un carrito guardado al montar', () => {
      localStorage.setItem(
        'inventarios-beraca-carrito',
        JSON.stringify({
          items: [{ ...PRODUCTO_A, cantidad: 7, subtotal: 280000 }],
          totalCantidad: 1,
          totalM2: 7,
          totalPrecio: 280000,
        })
      )

      const { result } = renderHook(() => useCart())

      expect(result.current.carrito.items).toHaveLength(1)
      expect(result.current.carrito.totalPrecio).toBe(280000)
    })

    it('no rompe si el localStorage tiene datos corruptos', () => {
      localStorage.setItem('inventarios-beraca-carrito', 'esto no es json')

      const { result } = renderHook(() => useCart())

      expect(result.current.carrito.items).toEqual([])
    })
  })
})
