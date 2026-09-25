import { useState, useEffect } from 'react'

export interface ItemCarrito {
  id: string
  sku: string
  nombre: string
  precioUnitario: number
  cantidad: number
  subtotal: number
  /** A qué tienda se le compra. El pedido va a su WhatsApp, no a uno común. */
  tiendaId?: string
  tiendaNombre?: string
}

export interface Carrito {
  items: ItemCarrito[]
  totalCantidad: number
  totalM2: number
  totalPrecio: number
}

const STORAGE_KEY = 'inventarios-beraca-carrito'

export function useCart() {
  const [carrito, setCarrito] = useState<Carrito>({
    items: [],
    totalCantidad: 0,
    totalM2: 0,
    totalPrecio: 0,
  })

  const [montado, setMontado] = useState(false)

  // Cargar carrito del localStorage al montar
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) {
        setCarrito(JSON.parse(guardado))
      }
    } catch (error) {
      console.error('Error al cargar carrito:', error)
    }
    setMontado(true)
  }, [])

  // Guardar carrito en localStorage cuando cambia
  useEffect(() => {
    if (montado) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito))
      } catch (error) {
        console.error('Error al guardar carrito:', error)
      }
    }
  }, [carrito, montado])

  const calcularTotales = (items: ItemCarrito[]): Carrito => {
    const totalCantidad = items.length
    const totalM2 = items.reduce((sum, item) => sum + (item.cantidad || 0), 0)
    const totalPrecio = items.reduce((sum, item) => sum + item.subtotal, 0)

    return {
      items,
      totalCantidad,
      totalM2,
      totalPrecio,
    }
  }

  const agregarAlCarrito = (producto: {
    id: string
    sku: string
    nombre: string
    precioUnitario: number
    tiendaId?: string
    tiendaNombre?: string
  }, cantidad: number = 1) => {
    setCarrito((prev) => {
      const itemExistente = prev.items.find((item) => item.id === producto.id)

      let nuevosItems: ItemCarrito[]
      if (itemExistente) {
        // Si existe, sumar cantidad
        nuevosItems = prev.items.map((item) =>
          item.id === producto.id
            ? {
                ...item,
                cantidad: item.cantidad + cantidad,
                subtotal: (item.cantidad + cantidad) * item.precioUnitario,
              }
            : item
        )
      } else {
        // Si no existe, agregar nuevo
        nuevosItems = [
          ...prev.items,
          {
            id: producto.id,
            sku: producto.sku,
            nombre: producto.nombre,
            precioUnitario: producto.precioUnitario,
            cantidad,
            subtotal: cantidad * producto.precioUnitario,
            tiendaId: producto.tiendaId,
            tiendaNombre: producto.tiendaNombre,
          },
        ]
      }

      return calcularTotales(nuevosItems)
    })
  }

  const quitarDelCarrito = (productoId: string) => {
    setCarrito((prev) => {
      const nuevosItems = prev.items.filter((item) => item.id !== productoId)
      return calcularTotales(nuevosItems)
    })
  }

  const actualizarCantidad = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      quitarDelCarrito(productoId)
      return
    }

    setCarrito((prev) => {
      const nuevosItems = prev.items.map((item) =>
        item.id === productoId
          ? {
              ...item,
              cantidad,
              subtotal: cantidad * item.precioUnitario,
            }
          : item
      )
      return calcularTotales(nuevosItems)
    })
  }

  const vaciarCarrito = () => {
    setCarrito({
      items: [],
      totalCantidad: 0,
      totalM2: 0,
      totalPrecio: 0,
    })
  }

  /**
   * Tienda a la que pertenece el pedido.
   *
   * El carrito es de una sola tienda: cada una recibe los pedidos en su
   * propio WhatsApp, así que un carrito con productos de dos negocios no
   * se podría enviar a ninguna parte.
   */
  const tiendaDelCarrito = carrito.items[0]
    ? { id: carrito.items[0].tiendaId, nombre: carrito.items[0].tiendaNombre }
    : null

  /** ¿Este producto es de otra tienda distinta a la del carrito? */
  const esDeOtraTienda = (tiendaId?: string) =>
    Boolean(carrito.items.length > 0 && tiendaId && tiendaDelCarrito?.id !== tiendaId)

  return {
    carrito,
    agregarAlCarrito,
    quitarDelCarrito,
    actualizarCantidad,
    vaciarCarrito,
    tiendaDelCarrito,
    esDeOtraTienda,
  }
}
