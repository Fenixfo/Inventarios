'use client'

import { Header } from '@/components/Layout/Header'
import { Cart } from '@/components/Cart'
import { useCart } from '@/hooks/useCart'

export default function CarritoPage() {
  const { carrito, quitarDelCarrito, actualizarCantidad, vaciarCarrito } = useCart()

  return (
    <>
      <Header compact={true} showLogo={false} />
      <main className="min-h-screen bg-gray-50 py-6 sm:py-12">
        <div className="max-w-2xl mx-auto px-4">
          <Cart
            carrito={carrito}
            onQuitarItem={quitarDelCarrito}
            onActualizarCantidad={actualizarCantidad}
            onVaciarCarrito={vaciarCarrito}
          />
        </div>
      </main>
    </>
  )
}
