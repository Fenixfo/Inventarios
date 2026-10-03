import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LineaCompraEditor } from '@/components/compras/LineaCompraEditor'
import { calcularLineas, lineaVacia, type LineaEditable } from '@/lib/compras-cliente'
import type { ProductoParaCompra } from '@/lib/compras-clasificar'

// La subida de imágenes tiene su propia lógica; aquí basta con saber si el botón se ve.
vi.mock('@/components/ImageUploader', () => ({
  ImageUploader: () => <button type="button">Subir imagen</button>,
}))

const PRODUCTO: ProductoParaCompra = {
  id: 'prod-1',
  sku: 'BAL-2',
  nombre: 'Baldosa 2',
  categoria: 'Pisos',
  dimensiones: null,
  color: 'Blanco',
  acabado: null,
  espesorMm: null,
  m2PorCaja: null,
  precioUnitario: 25000,
  precioBodega: null,
  costo: 1000,
  stockActual: 5,
  stockMinimo: 0,
  proveedor: null,
  descripcion: null,
  imagenUrl: null,
}

const nueva = (parche: Partial<LineaEditable> = {}): LineaEditable => ({
  ...lineaVacia(),
  sku: 'NUE-1',
  estado: 'nuevo',
  skuVerificado: 'NUE-1',
  ...parche,
})

const existente = (parche: Partial<LineaEditable> = {}): LineaEditable => ({
  ...lineaVacia(),
  sku: 'BAL-2',
  estado: 'existente',
  producto: PRODUCTO,
  skuVerificado: 'BAL-2',
  ...parche,
})

function dibujar(linea: LineaEditable, onCambiar = vi.fn()) {
  render(
    <LineaCompraEditor
      indice={0}
      linea={linea}
      calculo={calcularLineas([linea], [], 'valor')[0]}
      problema={null}
      categorias={['Pisos']}
      puedeCrearProductos
      onCambiar={onCambiar}
      onVerificar={vi.fn()}
      onEscogerParecido={vi.fn()}
      onCrearNuevo={vi.fn()}
      onSubidaImagen={vi.fn()}
    />
  )
  return onCambiar
}

const alternar = () => screen.getByRole('button', { name: /Más datos del producto/ })

describe('línea de compra: lo opcional va plegado', () => {
  it('lo obligatorio de un producto nuevo se ve siempre', () => {
    dibujar(nueva())

    for (const rotulo of ['SKU *', 'Cantidad *', 'Precio de factura (por unidad) *', 'Nombre del producto *', 'Precio al público *']) {
      expect(screen.getByLabelText(rotulo)).toBeVisible()
    }
    expect(screen.getByPlaceholderText('Escribe o elige una categoría')).toBeVisible()
    expect(screen.getByLabelText('Costo final por unidad')).toBeVisible()
  })

  it('lo opcional empieza oculto', () => {
    dibujar(nueva())

    expect(alternar()).toHaveAttribute('aria-expanded', 'false')
    for (const rotulo of ['Dimensiones', 'Color', 'Acabado', 'Espesor (mm)', 'm² por caja', 'Precio de bodega', 'Descripción', 'Stock mínimo']) {
      expect(screen.getByLabelText(rotulo), rotulo).not.toBeVisible()
    }
    expect(screen.getByRole('button', { name: 'Subir imagen', hidden: true })).not.toBeVisible()
  })

  it('al abrir aparece todo, y al cerrar vuelve a ocultarse', async () => {
    dibujar(nueva())

    await userEvent.click(alternar())
    expect(alternar()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Color')).toBeVisible()
    expect(screen.getByLabelText('Stock mínimo')).toBeVisible()
    expect(screen.getByLabelText('Descripción')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Subir imagen' })).toBeVisible()

    await userEvent.click(alternar())
    expect(alternar()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Color')).not.toBeVisible()
  })

  it('lo que se escribe dentro llega a onCambiar', async () => {
    const onCambiar = dibujar(nueva())

    await userEvent.click(alternar())
    await userEvent.type(screen.getByLabelText('Color'), 'G')

    expect(onCambiar).toHaveBeenCalledWith({ color: 'G' })
  })

  it('sin datos escritos, el encabezado no muestra ningún resumen', () => {
    dibujar(nueva())
    expect(alternar()).not.toHaveTextContent(/completado/)
  })

  it('el resumen cuenta los datos escritos y concuerda el singular y el plural', () => {
    dibujar(nueva({ color: 'Gris', acabado: 'Mate', stockMinimo: '5' }))

    expect(alternar()).toHaveTextContent('3 completados')
    // Lo escrito no se pierde por estar oculto.
    expect(screen.getByLabelText('Color')).toHaveValue('Gris')
  })

  it('un solo dato se resume en singular', () => {
    dibujar(nueva({ descripcion: 'Brillante' }))
    expect(alternar()).toHaveTextContent('1 completado')
    expect(alternar()).not.toHaveTextContent('1 completados')
  })

  it('una imagen escrita también cuenta, y los espacios en blanco no', () => {
    dibujar(nueva({ imagenUrl: 'https://x.co/a.png', color: '   ' }))
    expect(alternar()).toHaveTextContent('1 completado')
  })

  it('con la sección abierta ya no muestra el resumen', async () => {
    dibujar(nueva({ color: 'Gris' }))

    await userEvent.click(alternar())
    expect(alternar()).not.toHaveTextContent(/completado/)
  })
})

describe('línea de un producto existente', () => {
  it('lo obligatorio se ve y el stock mínimo no existe (no se completa desde una compra)', () => {
    dibujar(existente())

    expect(screen.getByLabelText('SKU *')).toBeVisible()
    expect(screen.getByLabelText('Cantidad *')).toBeVisible()
    expect(screen.queryByLabelText('Stock mínimo')).toBeNull()
    expect(screen.queryByLabelText('Nombre del producto *')).toBeNull()
    expect(screen.getByText(/Stock actual 5/)).toBeVisible()
  })

  it('con la sección cerrada avisa que hay una diferencia con lo que el producto ya tiene', () => {
    dibujar(existente({ color: 'Gris' }))

    expect(alternar()).toHaveTextContent('1 completado')
    expect(alternar()).toHaveTextContent('⚠ 1 diferencia')
    expect(screen.getByText(/ya tiene «Blanco»; no se cambiará/)).not.toBeVisible()
  })

  it('al abrir se ve la diferencia en detalle', async () => {
    dibujar(existente({ color: 'Gris' }))

    await userEvent.click(alternar())
    expect(screen.getByText(/ya tiene «Blanco»; no se cambiará/)).toBeVisible()
    expect(alternar()).not.toHaveTextContent('diferencia')
  })

  it('sin diferencias no muestra el aviso', () => {
    dibujar(existente({ acabado: 'Mate' }))

    expect(alternar()).toHaveTextContent('1 completado')
    expect(alternar()).not.toHaveTextContent('diferencia')
  })

  it('si el producto ya tiene imagen lo dice, dentro de la sección plegada', async () => {
    dibujar(existente({ producto: { ...PRODUCTO, imagenUrl: 'https://x.co/p.png' } }))

    expect(screen.getByText(/ya tiene imagen/)).not.toBeVisible()
    await userEvent.click(alternar())
    expect(screen.getByText(/ya tiene imagen/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Subir imagen' })).toBeNull()
  })
})
