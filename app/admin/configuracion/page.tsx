'use client'

import { apiFetch } from '@/lib/api-client'
import { useEffect, useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import { ImageUploader } from '@/components/ImageUploader'
import { fechaYHora } from '@/lib/fechas'
import { supabase } from '@/lib/supabase-client'
import Link from 'next/link'

interface Config {
  whatsapp_pedidos: string
  nombre_empresa: string
  eslogan_empresa: string
  nit_empresa: string
  direccion_empresa: string
  telefono_empresa: string
  email_empresa: string
  logo_url: string
}

const CONFIG_VACIA: Config = {
  whatsapp_pedidos: '',
  nombre_empresa: '',
  eslogan_empresa: '',
  nit_empresa: '',
  direccion_empresa: '',
  telefono_empresa: '',
  email_empresa: '',
  logo_url: '',
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Config>(CONFIG_VACIA)
  const [original, setOriginal] = useState<Config>(CONFIG_VACIA)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [actualizadoEn, setActualizadoEn] = useState<string | null>(null)

  // El código solo llega si quien mira es dueño o administrador de la
  // tienda; el resto no lo ve y por tanto no puede repartir accesos.
  const [codigoTienda, setCodigoTienda] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  // Si los productos de esta tienda salen en el catálogo público.
  const [publica, setPublica] = useState(true)
  const [publicaOriginal, setPublicaOriginal] = useState(true)

  useEffect(() => {
    cargarConfig()
  }, [])

  const cargarConfig = async () => {
    setLoading(true)
    setError(null)

    try {
      const [res, tiendasRes] = await Promise.all([
        apiFetch('/api/configuracion'),
        apiFetch('/api/tiendas'),
      ])

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Error al cargar configuración')

      setConfig({ ...CONFIG_VACIA, ...data.config })
      setOriginal({ ...CONFIG_VACIA, ...data.config })
      setPublica(data.publica !== false)
      setPublicaOriginal(data.publica !== false)
      setActualizadoEn(data.actualizadoEn)

      if (tiendasRes.ok) {
        const tiendas = await tiendasRes.json()
        setCodigoTienda(tiendas.find((t: any) => t.codigo)?.codigo || null)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const copiarCodigo = async () => {
    if (!codigoTienda) return

    try {
      await navigator.clipboard.writeText(codigoTienda)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // Sin permiso para el portapapeles queda a la vista para copiarlo a mano.
    }
  }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    setExito(null)

    try {
      const res = await apiFetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, publica }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')

      setOriginal(config)
      setPublicaOriginal(publica)
      setExito('Configuración guardada correctamente')
      setActualizadoEn(new Date().toISOString())
      setTimeout(() => setExito(null), 4000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const actualizar = (campo: keyof Config, valor: string) => {
    setConfig((prev) => ({ ...prev, [campo]: valor }))
    setExito(null)
  }

  const hayCambios =
    JSON.stringify(config) !== JSON.stringify(original) || publica !== publicaOriginal

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    marginBottom: '6px',
    color: '#374151',
  }

  const ayudaStyle = {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '5px',
  }

  const cardStyle = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  }

  return (
    <PermissionProtector requiredPermission="administrador">
      <div style={{ padding: '20px', maxWidth: '800px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver al Dashboard
          </Link>
        </div>

        <h1 style={{ marginBottom: '8px' }}>Configuración</h1>
        <p style={{ color: '#6b7280', marginBottom: '30px', fontSize: '14px' }}>
          Estos datos se usan en el catálogo público y en las facturas.
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
            Cargando configuración...
          </div>
        ) : (
          <>
            {/* Código de la tienda */}
            {codigoTienda && (
              <div style={cardStyle}>
                <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '6px' }}>
                  🔑 Código de la tienda
                </h2>
                <p style={{ ...ayudaStyle, marginTop: 0, marginBottom: '14px' }}>
                  Compártelo con quien quieras que trabaje aquí: es lo que necesita para pedir
                  acceso. Tú decides si lo aceptas y qué puede hacer.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <code
                    style={{
                      fontSize: '26px',
                      fontWeight: 'bold',
                      letterSpacing: '6px',
                      backgroundColor: '#f3f4f6',
                      padding: '10px 18px',
                      borderRadius: '8px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {codigoTienda}
                  </code>

                  <button
                    onClick={copiarCodigo}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: copiado ? '#10b981' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                    }}
                  >
                    {copiado ? '✓ Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}

            {/* Visibilidad en el catálogo */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '6px' }}>
                🌎 Catálogo público
              </h2>
              <p style={{ ...ayudaStyle, marginTop: 0, marginBottom: '16px' }}>
                El catálogo de la página principal muestra los productos de las tiendas
                visibles. Hay quien lo quiere como vitrina y quien usa esto solo para llevar
                su inventario.
              </p>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '12px',
                  border: `1px solid ${publica ? '#bbf7d0' : '#e5e7eb'}`,
                  backgroundColor: publica ? '#f0fdf4' : '#f9fafb',
                  borderRadius: '8px',
                }}
              >
                <input
                  type="checkbox"
                  checked={publica}
                  onChange={(e) => {
                    setPublica(e.target.checked)
                    setExito(null)
                  }}
                  style={{ width: '17px', height: '17px', marginTop: '2px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '14px' }}>
                  <strong>Mostrar mis productos en el catálogo público</strong>
                  <span style={{ display: 'block', color: '#6b7280', fontSize: '13px', marginTop: '3px' }}>
                    {publica
                      ? 'Cualquiera puede ver tus productos y pedirte por WhatsApp.'
                      : 'Tus productos no aparecen para nadie fuera de la tienda.'}
                  </span>
                </span>
              </label>
            </div>

            {/* Pedidos */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '18px' }}>
                📱 Pedidos por WhatsApp
              </h2>

              <label style={labelStyle}>Número para recibir pedidos</label>
              <input
                type="tel"
                value={config.whatsapp_pedidos}
                onChange={(e) => actualizar('whatsapp_pedidos', e.target.value)}
                placeholder="573001234567"
                style={inputStyle}
              />
              <p style={ayudaStyle}>
                Con indicativo de país y sin espacios ni signos. Colombia es 57, así que un celular
                queda como <code>573001234567</code>.
              </p>

              {!config.whatsapp_pedidos && (
                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '6px', padding: '12px', marginTop: '12px', fontSize: '13px', color: '#92400e' }}>
                  Sin este número, el carrito le pide al cliente escribirlo a mano en cada pedido.
                </div>
              )}
            </div>

            {/* Empresa */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '18px' }}>
                🏢 Datos de la empresa
              </h2>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Nombre de la tienda</label>
                <input
                  type="text"
                  value={config.nombre_empresa}
                  onChange={(e) => actualizar('nombre_empresa', e.target.value)}
                  placeholder="Beraca"
                  style={inputStyle}
                />
                <small style={{ color: '#6b7280', fontSize: '12px' }}>
                  Sale en las facturas, en el PDF y en el catálogo.
                </small>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Eslogan</label>
                <input
                  type="text"
                  value={config.eslogan_empresa}
                  onChange={(e) => actualizar('eslogan_empresa', e.target.value)}
                  placeholder="Distribuidora de Cerámicas y Porcelanatos"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>NIT</label>
                  <input
                    type="text"
                    value={config.nit_empresa}
                    onChange={(e) => actualizar('nit_empresa', e.target.value)}
                    placeholder="900.123.456-7"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <input
                    type="tel"
                    value={config.telefono_empresa}
                    onChange={(e) => actualizar('telefono_empresa', e.target.value)}
                    placeholder="(604) 123 4567"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Dirección</label>
                <input
                  type="text"
                  value={config.direccion_empresa}
                  onChange={(e) => actualizar('direccion_empresa', e.target.value)}
                  placeholder="Calle 10 #20-30, Medellín"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={config.email_empresa}
                  onChange={(e) => actualizar('email_empresa', e.target.value)}
                  placeholder="contacto@beraca.com"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Logo */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', marginTop: 0, marginBottom: '18px' }}>🖼️ Logo</h2>

              <ImageUploader
                valor={config.logo_url}
                onChange={(url) => actualizar('logo_url', url)}
                carpeta="logos"
                ayuda="Aparece en el encabezado de tus facturas. Se recomienda PNG con fondo transparente."
              />
            </div>

            {error && (
              <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            {exito && (
              <div style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '14px' }}>
                ✅ {exito}
              </div>
            )}

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: '40px' }}>
              <button
                onClick={guardar}
                disabled={guardando || !hayCambios}
                style={{
                  padding: '11px 26px',
                  backgroundColor: guardando || !hayCambios ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: guardando || !hayCambios ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px',
                }}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>

              {hayCambios && (
                <button
                  onClick={() => setConfig(original)}
                  disabled={guardando}
                  style={{
                    padding: '11px 20px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Descartar
                </button>
              )}

              {!hayCambios && actualizadoEn && (
                <span style={{ fontSize: '13px', color: '#6b7280' }}>
                  Última actualización:{' '}
                  {fechaYHora(actualizadoEn)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
