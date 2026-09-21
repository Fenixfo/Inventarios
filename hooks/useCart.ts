import { useState, useEffect } from 'react'

export interface ItemCarrito {
  id: string
  sku: string
  nombre: string
  precioUnitario: number
  cantidad: number
  subtotal: number
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

  return {
    carrito,
    agregarAlCarrito,
    quitarDelCarrito,
    actualizarCantidad,
    vaciarCarrito,
  }
}
