'use client'

import { Header } from '@/components/Layout/Header'
import { Cart } from '@/components/Cart'
import { useCart } from '@/hooks/useCart'

export default function CarritoPage() {
  const { carrito, quitarDelCarrito, actualizarCantidad, vaciarCarrito } = useCart()

  return (
    <>
      <Header compact={true} showLogo={false} />
      <main className="min-h-screen py-6 sm:py-12" style={{ backgroundColor: 'var(--beige-light)' }}>
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
