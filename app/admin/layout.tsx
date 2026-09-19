'use client'

import { Header } from '@/components/Layout/Header'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // TODO: Reactivar autenticación cuando las pruebas terminen
  // Por ahora desactivado para testing

  return (
    <>
      <Header />
      <div className="flex">
        <aside className="w-64 bg-gray-900 text-white min-h-screen p-4">
          <nav className="space-y-2">
            <a href="/admin" className="block px-4 py-2 rounded hover:bg-gray-800">
              Dashboard
            </a>
            <a href="/admin/productos" className="block px-4 py-2 rounded hover:bg-gray-800">
              Productos
            </a>
            <a href="/admin/clientes" className="block px-4 py-2 rounded hover:bg-gray-800">
              Clientes
            </a>
            <a href="/admin/facturas" className="block px-4 py-2 rounded hover:bg-gray-800">
              Facturas
            </a>
            <a href="/admin/reportes" className="block px-4 py-2 rounded hover:bg-gray-800">
              Reportes
            </a>
            <a href="/admin/configuracion" className="block px-4 py-2 rounded hover:bg-gray-800">
              Configuración
            </a>
          </nav>
        </aside>
        <main className="flex-1 bg-gray-50 p-8">
          {children}
        </main>
      </div>
    </>
  )
}
