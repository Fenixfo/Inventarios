import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormularioProveedor, type Proveedor } from '@/components/compras/FormularioProveedor'

// El formulario llama a la API; aquí se sustituye para probar solo su comportamiento.
const apiFetch = vi.fn()
vi.mock('@/lib/api-client', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

const respuesta = (ok: boolean, cuerpo: unknown) => ({ ok, json: async () => cuerpo })

const EXISTENTE: Proveedor = {
  id: 'p1',
  nombre: 'Cerámicas del Norte',
  nit: '900123',
  telefono: null,
  email: null,
  direccion: null,
}

beforeEach(() => {
  apiFetch.mockReset()
})

describe('FormularioProveedor', () => {
  it('no guarda sin nombre y no llama a la API', async () => {
    const onGuardado = vi.fn()
    render(<FormularioProveedor onGuardado={onGuardado} />)

    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))

    expect(screen.getByText('Escribe el nombre del proveedor')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
    expect(onGuardado).not.toHaveBeenCalled()
  })

  it('crea con solo el nombre y avisa con el proveedor devuelto', async () => {
    const creado = { ...EXISTENTE, id: 'nuevo', nombre: 'Solo nombre', nit: null }
    apiFetch.mockResolvedValue(respuesta(true, creado))
    const onGuardado = vi.fn()
    render(<FormularioProveedor onGuardado={onGuardado} />)

    await userEvent.type(screen.getByLabelText('Nombre *'), 'Solo nombre')
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith(creado))
    const [ruta, opciones] = apiFetch.mock.calls[0]
    expect(ruta).toBe('/api/proveedores')
    expect(opciones.method).toBe('POST')
    expect(JSON.parse(opciones.body)).toMatchObject({ nombre: 'Solo nombre', nit: '' })
  })

  it('al editar parte de los datos del proveedor y usa PATCH', async () => {
    apiFetch.mockResolvedValue(respuesta(true, { ...EXISTENTE, telefono: '300' }))
    const onGuardado = vi.fn()
    render(<FormularioProveedor proveedor={EXISTENTE} onGuardado={onGuardado} />)

    expect(screen.getByLabelText('Nombre *')).toHaveValue('Cerámicas del Norte')
    expect(screen.getByLabelText('NIT')).toHaveValue('900123')

    await userEvent.type(screen.getByLabelText('Teléfono'), '300')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
    const [ruta, opciones] = apiFetch.mock.calls[0]
    expect(ruta).toBe('/api/proveedores/p1')
    expect(opciones.method).toBe('PATCH')
  })

  it('muestra el mensaje del servidor, como el de un NIT repetido, y no avisa de guardado', async () => {
    apiFetch.mockResolvedValue(respuesta(false, { error: 'Ya hay un proveedor con ese NIT en esta tienda' }))
    const onGuardado = vi.fn()
    render(<FormularioProveedor onGuardado={onGuardado} />)

    await userEvent.type(screen.getByLabelText('Nombre *'), 'Otro')
    await userEvent.click(screen.getByRole('button', { name: 'Crear proveedor' }))

    expect(await screen.findByText('Ya hay un proveedor con ese NIT en esta tienda')).toBeInTheDocument()
    expect(onGuardado).not.toHaveBeenCalled()
  })

  it('Enter en un campo guarda, y no es un <form> para poder ir dentro de otro formulario', async () => {
    apiFetch.mockResolvedValue(respuesta(true, EXISTENTE))
    const onGuardado = vi.fn()
    const { container } = render(<FormularioProveedor onGuardado={onGuardado} />)

    expect(container.querySelector('form')).toBeNull()

    await userEvent.type(screen.getByLabelText('Nombre *'), 'Con Enter{Enter}')
    await waitFor(() => expect(onGuardado).toHaveBeenCalled())
  })

  it('arranca con el nombre inicial y Cancelar solo aparece si hay manejador', async () => {
    const onCancelar = vi.fn()
    const { rerender } = render(<FormularioProveedor nombreInicial="Lo que se buscó" onGuardado={vi.fn()} />)

    expect(screen.getByLabelText('Nombre *')).toHaveValue('Lo que se buscó')
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull()

    rerender(<FormularioProveedor onGuardado={vi.fn()} onCancelar={onCancelar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancelar).toHaveBeenCalled()
  })
})
