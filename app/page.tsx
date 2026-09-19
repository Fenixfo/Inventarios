'use client'

import { Header } from '@/components/Layout/Header'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

export default function Home() {
  const router = useRouter()

  return (
    <>
      <Header compact={true} showLogo={false} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Catálogo de Productos
          </h1>
          <p className="text-xl text-gray-600">
            Baldosas, cerámicas y porcelanatos de alta calidad
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Los productos se cargarán aquí dinámicamente */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="bg-gray-200 h-48 rounded mb-4"></div>
            <h3 className="font-semibold text-lg mb-2">Producto Ejemplo</h3>
            <p className="text-gray-600 mb-4">Descripción del producto</p>
            <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
              Ver Detalles
            </button>
          </div>
        </div>

      </main>
    </>
  )
}
