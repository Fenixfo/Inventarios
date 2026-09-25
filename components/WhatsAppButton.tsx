'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Carrito } from '@/hooks/useCart'

const telefonoSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa tu número de teléfono')
  .regex(/^[0-9+\s()-]+$/, 'El teléfono solo puede contener números')
  .refine((v) => v.replace(/\D/g, '').length >= 10, 'El teléfono debe tener al menos 10 dígitos')

const destinoSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa el número de WhatsApp destino')
  .refine(
    (v) => v.replace(/\D/g, '').length >= 10,
    'Incluye el indicativo del país (ej: 573001234567)'
  )

interface WhatsAppButtonProps {
  carrito: Carrito
  onPedidoEnviado?: () => void
}

export function WhatsAppButton({ carrito, onPedidoEnviado }: WhatsAppButtonProps) {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [telefono, setTelefono] = useState('')
  const [nombre, setNombre] = useState('')
  const [errorTelefono, setErrorTelefono] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const [destinoConfigurado, setDestinoConfigurado] = useState<string | null>(null)
  const [destinoManual, setDestinoManual] = useState('')
  const [errorDestino, setErrorDestino] = useState<string | null>(null)
  const [cargandoConfig, setCargandoConfig] = useState(false)

  useEffect(() => {
    if (!modalAbierto) return

    // El pedido va al WhatsApp de la tienda que vende, no a uno común: en
    // el catálogo conviven varias y cada una atiende los suyos.
    const tiendaId = carrito.items[0]?.tiendaId
    const url = tiendaId
      ? `/api/configuracion/publica?tienda=${encodeURIComponent(tiendaId)}`
      : '/api/configuracion/publica'

    setCargandoConfig(true)
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => setDestinoConfigurado(config?.whatsappPedidos || null))
      .catch(() => setDestinoConfigurado(null))
      .finally(() => setCargandoConfig(false))
  }, [modalAbierto, carrito.items])

  const formatearPrecio = (precio: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(precio)

  const construirMensaje = (nombreCliente: string, telefonoCliente: string) => {
    const lineas = [
      '*NUEVO PEDIDO*',
      '',
      // La tienda va en el mensaje por si el número lo atiende alguien que
      // maneja más de un negocio.
      ...(carrito.items[0]?.tiendaNombre ? [`*Tienda:* ${carrito.items[0].tiendaNombre}`] : []),
      `*Cliente:* ${nombreCliente || 'No especificado'}`,
      `*Teléfono:* ${telefonoCliente}`,
      '',
      '*Productos:*',
    ]

    carrito.items.forEach((item, i) => {
      lineas.push(
        `${i + 1}. ${item.nombre} (${item.sku})`,
        `   ${item.cantidad} m² × ${formatearPrecio(item.precioUnitario)} = ${formatearPrecio(item.subtotal)}`
      )
    })

    lineas.push(
      '',
      `*Total m²:* ${carrito.totalM2.toFixed(2)}`,
      `*TOTAL:* ${formatearPrecio(carrito.totalPrecio)}`
    )

    return lineas.join('\n')
  }

  const handleEnviar = () => {
    setErrorTelefono(null)
    setErrorDestino(null)
    setErrorGeneral(null)

    const resultadoTelefono = telefonoSchema.safeParse(telefono)
    if (!resultadoTelefono.success) {
      setErrorTelefono(resultadoTelefono.error.issues[0].message)
      return
    }

    let numeroDestino = destinoConfigurado
    if (!numeroDestino) {
      const resultadoDestino = destinoSchema.safeParse(destinoManual)
      if (!resultadoDestino.success) {
        setErrorDestino(resultadoDestino.error.issues[0].message)
        return
      }
      numeroDestino = resultadoDestino.data
    }

    setEnviando(true)

    try {
      const mensaje = construirMensaje(nombre, resultadoTelefono.data)
      const url = `https://wa.me/${numeroDestino.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`

      window.open(url, '_blank', 'noopener,noreferrer')

      // El carrito se vacía al cerrar la confirmación, no aquí: vaciarlo
      // ahora desmontaría este modal junto con el resto del carrito.
      setEnviado(true)
    } catch (err: any) {
      setErrorGeneral(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const cerrarModal = () => {
    const sePudoEnviar = enviado

    setModalAbierto(false)
    setEnviado(false)
    setErrorTelefono(null)
    setErrorGeneral(null)

    if (sePudoEnviar) onPedidoEnviado?.()
  }

  return (
    <>
      <button
        onClick={() => setModalAbierto(true)}
        disabled={carrito.items.length === 0}
        className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold mb-3 transition"
      >
        📞 Enviar por WhatsApp
      </button>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            {enviado ? (
              <div className="text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido enviado</h2>
                <p className="text-gray-600 mb-6">
                  Se abrió WhatsApp con tu pedido. Envía el mensaje para confirmarlo.
                </p>
                <button
                  onClick={cerrarModal}
                  className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-900 font-medium transition"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Enviar pedido</h2>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tu nombre (opcional)
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Juan Pérez"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tu teléfono <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => {
                      setTelefono(e.target.value)
                      setErrorTelefono(null)
                    }}
                    placeholder="300 123 4567"
                    autoFocus
                    className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      errorTelefono
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-green-600'
                    }`}
                  />
                  {errorTelefono && (
                    <p className="text-sm text-red-600 mt-1">{errorTelefono}</p>
                  )}
                </div>

                {!cargandoConfig && !destinoConfigurado && (
                  <div className="mb-4 border border-amber-300 bg-amber-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Número de WhatsApp destino <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      value={destinoManual}
                      onChange={(e) => {
                        setDestinoManual(e.target.value)
                        setErrorDestino(null)
                      }}
                      placeholder="573001234567"
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        errorDestino
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-600'
                      }`}
                    />
                    {errorDestino ? (
                      <p className="text-sm text-red-600 mt-1">{errorDestino}</p>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">
                        Aún no hay un número configurado en el sistema. Escribe uno con indicativo
                        para esta prueba.
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Productos:</span>
                    <span className="font-medium">{carrito.totalCantidad}</span>
                  </div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-600">Total m²:</span>
                    <span className="font-medium">{carrito.totalM2.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-red-600">
                      {formatearPrecio(carrito.totalPrecio)}
                    </span>
                  </div>
                </div>

                {errorGeneral && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
                    {errorGeneral}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={cerrarModal}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleEnviar}
                    disabled={enviando}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium transition"
                  >
                    {enviando ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
