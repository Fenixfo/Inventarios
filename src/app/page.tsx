export default function Home() {
  return (
    <>
      <Header />
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

        <div className="mt-12 bg-blue-50 p-8 rounded-lg text-center">
          <p className="text-gray-600 mb-4">
            ¿Eres distribuidor? Accede a tu panel de administración
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Panel de Administración
          </a>
        </div>
      </main>
    </>
  )
}
