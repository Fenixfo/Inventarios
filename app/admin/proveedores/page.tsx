'use client'

import { useState } from 'react'
import { PermissionProtector } from '@/components/PermissionProtector'
import { usePermisos } from '@/components/PermisosProvider'
import { BuscadorEnter } from '@/components/Common/BuscadorEnter'
import { VerMas } from '@/components/Common/VerMas'
import { useListaPaginada } from '@/lib/use-lista-paginada'
import { FormularioProveedor, type Proveedor } from '@/components/compras/FormularioProveedor'

export default function ProveedoresPage() {
  const { puede } = usePermisos()
  const puedeCrear = puede('compras.crear')

  const [busqueda, setBusqueda] = useState('')
  // 'nuevo' abre el formulario vacío; un proveedor, para editarlo; null lo cierra.
  const [editando, setEditando] = useState<'nuevo' | Proveedor | null>(null)

  const { items: proveedores, total, cargando, cargandoMas, error, verMas, hayMas, recargar } =
    useListaPaginada<Proveedor>('/api/proveedores', 'proveedores', { busqueda })

  const alGuardar = () => {
    setEditando(null)
    recargar()
  }

  return (
    <PermissionProtector requiredPermission="compras">
      <div className="card">
        <div className="card-header">
          <h1 className="card-title" style={{ fontSize: 20 }}>Proveedores</h1>
          {puedeCrear && !editando && (
            <button type="button" onClick={() => setEditando('nuevo')} className="btn-primary">
              + Nuevo proveedor
            </button>
          )}
        </div>

        {puedeCrear && editando && (
          <div
            className="mb-5"
            style={{ border: '1px solid var(--gray-light)', borderRadius: 8, padding: 16, maxWidth: 600, backgroundColor: 'var(--white-off)' }}
          >
            <h2 className="card-title mb-3" style={{ fontSize: 16 }}>
              {editando === 'nuevo' ? 'Nuevo proveedor' : 'Editar proveedor'}
            </h2>
            <FormularioProveedor
              // La clave reinicia el formulario al pasar de un proveedor a otro.
              key={editando === 'nuevo' ? 'nuevo' : editando.id}
              proveedor={editando === 'nuevo' ? null : editando}
              onGuardado={alGuardar}
              onCancelar={() => setEditando(null)}
            />
          </div>
        )}

        <div className="mb-5" style={{ maxWidth: 500 }}>
          <BuscadorEnter onBuscar={setBusqueda} etiqueta="Buscar" placeholder="Nombre o NIT" />
        </div>

        {error && <p style={{ color: 'var(--status-red-solid)' }}>Error: {error}</p>}

        {cargando ? (
          <p style={{ color: 'var(--gray-secondary)' }}>Cargando...</p>
        ) : proveedores.length === 0 ? (
          <p style={{ color: 'var(--gray-secondary)' }}>
            {busqueda ? 'No se encontraron proveedores con ese criterio de búsqueda' : 'No hay proveedores registrados'}
          </p>
        ) : (
          <>
            <p className="text-sm mb-2" style={{ color: 'var(--gray-secondary)' }}>
              {busqueda
                ? `Mostrando ${proveedores.length} de ${total} que coinciden`
                : `Mostrando ${proveedores.length} de ${total}`}
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-luxe">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>NIT</th>
                    <th>Teléfono</th>
                    <th>Correo</th>
                    {puedeCrear && <th style={{ textAlign: 'center' }}>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre}</td>
                      <td>{p.nit || '-'}</td>
                      <td>{p.telefono || '-'}</td>
                      <td>{p.email || '-'}</td>
                      {puedeCrear && (
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" onClick={() => setEditando(p)} className="btn-action">
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hayMas && <VerMas restantes={total - proveedores.length} cargando={cargandoMas} onClick={verMas} />}
          </>
        )}
      </div>
    </PermissionProtector>
  )
}
