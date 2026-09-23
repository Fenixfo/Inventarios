import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cart } from '@/components/Cart'
import type { Carrito } from '@/hooks/useCart'

// El botón de WhatsApp consulta la configuración al montarse; no es
// el objeto de estas pruebas, así que se sustituye por un marcador.
vi.mock('@/components/WhatsAppButton', () => ({
  WhatsAppButton: () => <div data-testid="whatsapp-button" />,
}))

const CARRITO_VACIO: Carrito = {
  items: [],
  totalCantidad: 0,
  totalM2: 0,
  totalPrecio: 0,
}

const CARRITO_CON_ITEMS: Carrito = {
  items: [
    {
      id: 'prod-a',
      sku: 'BAL-001',
      nombre: 'Baldosa Blanca',
      precioUnitario: 40000,
      cantidad: 2,
      subtotal: 80000,
    },
    {
      id: 'prod-b',
      sku: 'POR-002',
      nombre: 'Porcelanato Gris',
      precioUnitario: 65000,
      cantidad: 1,
      subtotal: 65000,
    },
  ],
  totalCantidad: 2,
  totalM2: 3,
  totalPrecio: 145000,
}

function renderCart(carrito: Carrito) {
  const props = {
    carrito,
    onQuitarItem: vi.fn(),
    onActualizarCantidad: vi.fn(),
    onVaciarCarrito: vi.fn(),
  }
  render(<Cart {...props} />)
  return props
}

describe('Cart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('carrito vacío', () => {
    it('muestra el mensaje de vacío', () => {
      renderCart(CARRITO_VACIO)
      expect(screen.getByText(/el carrito está vacío/i)).toBeInTheDocument()
    })

    it('ofrece volver al catálogo', () => {
      renderCart(CARRITO_VACIO)
      expect(screen.getByRole('link', { name: /volver al catálogo/i })).toHaveAttribute('href', '/')
    })

    it('no muestra el botón de envío', () => {
      renderCart(CARRITO_VACIO)
      expect(screen.queryByTestId('whatsapp-button')).not.toBeInTheDocument()
    })
  })

  describe('carrito con productos', () => {
    it('lista cada producto con su SKU', () => {
      renderCart(CARRITO_CON_ITEMS)

      expect(screen.getByText('Baldosa Blanca')).toBeInTheDocument()
      expect(screen.getByText(/BAL-001/)).toBeInTheDocument()
      expect(screen.getByText('Porcelanato Gris')).toBeInTheDocument()
      expect(screen.getByText(/POR-002/)).toBeInTheDocument()
    })

    it('muestra los totales del resumen', () => {
      renderCart(CARRITO_CON_ITEMS)

      expect(screen.getByText('2')).toBeInTheDocument() // productos
      expect(screen.getByText('3.00')).toBeInTheDocument() // m²
    })

    it('muestra el botón de envío por WhatsApp', () => {
      renderCart(CARRITO_CON_ITEMS)
      expect(screen.getByTestId('whatsapp-button')).toBeInTheDocument()
    })

    it('permite editar la cantidad escribiendo', () => {
      const { onActualizarCantidad } = renderCart(CARRITO_CON_ITEMS)

      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '7' } })

      expect(onActualizarCantidad).toHaveBeenCalledWith('prod-a', 7)
    })

    it('acepta decimales al escribir la cantidad', () => {
      const { onActualizarCantidad } = renderCart(CARRITO_CON_ITEMS)

      fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2.75' } })

      expect(onActualizarCantidad).toHaveBeenCalledWith('prod-a', 2.75)
    })

    it('ignora un valor vacío o no numérico', () => {
      const { onActualizarCantidad } = renderCart(CARRITO_CON_ITEMS)

      fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '' } })

      expect(onActualizarCantidad).not.toHaveBeenCalled()
    })

    // Los botones se buscan por su aria-label: para quien usa lector de
    // pantalla, "+" o "✕" no dicen nada, así que llevan nombre propio.
    it('el botón + suma 0.5 m²', async () => {
      const { onActualizarCantidad } = renderCart(CARRITO_CON_ITEMS)

      await userEvent.click(screen.getAllByRole('button', { name: /añadir medio metro/i })[0])

      expect(onActualizarCantidad).toHaveBeenCalledWith('prod-a', 2.5)
    })

    it('el botón − resta 0.5 m²', async () => {
      const { onActualizarCantidad } = renderCart(CARRITO_CON_ITEMS)

      await userEvent.click(screen.getAllByRole('button', { name: /quitar medio metro/i })[0])

      expect(onActualizarCantidad).toHaveBeenCalledWith('prod-a', 1.5)
    })

    it('la ✕ quita el producto correcto', async () => {
      const { onQuitarItem } = renderCart(CARRITO_CON_ITEMS)

      // Cada ✕ nombra su producto, así que no hace falta acertar el índice.
      await userEvent.click(
        screen.getByRole('button', { name: /quitar porcelanato gris del carrito/i })
      )

      expect(onQuitarItem).toHaveBeenCalledWith('prod-b')
    })

    it('no dispara cambios de cantidad al renderizar', () => {
      const { onActualizarCantidad, onQuitarItem } = renderCart(CARRITO_CON_ITEMS)

      expect(onActualizarCantidad).not.toHaveBeenCalled()
      expect(onQuitarItem).not.toHaveBeenCalled()
    })
  })
})
