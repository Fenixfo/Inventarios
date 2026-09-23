import { describe, it, expect, beforeEach } from 'vitest'
import {
  comprobarLimite,
  grupoDeRuta,
  identificarCliente,
  reiniciarLimites,
  LIMITES,
} from '@/lib/rate-limit'

describe('comprobarLimite', () => {
  beforeEach(() => {
    reiniciarLimites()
  })

  it('deja pasar mientras no se pase del máximo', () => {
    const limite = { maximo: 3, ventanaMs: 1000 }

    expect(comprobarLimite('1.1.1.1', limite).permitido).toBe(true)
    expect(comprobarLimite('1.1.1.1', limite).permitido).toBe(true)
    expect(comprobarLimite('1.1.1.1', limite).permitido).toBe(true)
  })

  it('corta a partir de la petición que sobra', () => {
    const limite = { maximo: 2, ventanaMs: 1000 }

    comprobarLimite('2.2.2.2', limite)
    comprobarLimite('2.2.2.2', limite)

    const tercera = comprobarLimite('2.2.2.2', limite)
    expect(tercera.permitido).toBe(false)
    expect(tercera.esperaSegundos).toBeGreaterThan(0)
  })

  it('va contando lo que queda', () => {
    const limite = { maximo: 3, ventanaMs: 1000 }

    expect(comprobarLimite('3.3.3.3', limite).restantes).toBe(2)
    expect(comprobarLimite('3.3.3.3', limite).restantes).toBe(1)
    expect(comprobarLimite('3.3.3.3', limite).restantes).toBe(0)
  })

  it('no mezcla clientes distintos', () => {
    const limite = { maximo: 1, ventanaMs: 1000 }

    expect(comprobarLimite('4.4.4.4', limite).permitido).toBe(true)
    expect(comprobarLimite('5.5.5.5', limite).permitido).toBe(true)
    expect(comprobarLimite('4.4.4.4', limite).permitido).toBe(false)
  })

  it('vuelve a permitir cuando la ventana caduca', () => {
    const limite = { maximo: 1, ventanaMs: 1000 }
    const inicio = 1_000_000

    expect(comprobarLimite('6.6.6.6', limite, inicio).permitido).toBe(true)
    expect(comprobarLimite('6.6.6.6', limite, inicio + 500).permitido).toBe(false)
    expect(comprobarLimite('6.6.6.6', limite, inicio + 1001).permitido).toBe(true)
  })

  // Un mismo cliente puede estar cerca del tope del catálogo sin que eso le
  // cierre el resto de la API.
  it('cuenta cada grupo por separado', () => {
    for (let i = 0; i < LIMITES.registro.maximo; i++) {
      comprobarLimite('7.7.7.7', 'registro')
    }

    expect(comprobarLimite('7.7.7.7', 'registro').permitido).toBe(false)
    expect(comprobarLimite('7.7.7.7', 'publico').permitido).toBe(true)
  })
})

describe('grupoDeRuta', () => {
  it('pone el registro en el grupo más estricto', () => {
    expect(grupoDeRuta('/api/auth/register')).toBe('registro')
  })

  // Toda la tienda puede salir por una sola IP: si el login compartiera el
  // cupo del registro, el sexto de la mañana se quedaría fuera.
  it('separa el inicio de sesión del registro', () => {
    expect(grupoDeRuta('/api/auth/sync-user')).toBe('sesion')
    expect(LIMITES.sesion.maximo).toBeGreaterThan(LIMITES.registro.maximo)
  })

  it('reconoce las rutas públicas', () => {
    expect(grupoDeRuta('/api/productos/catalogo')).toBe('publico')
    expect(grupoDeRuta('/api/configuracion/publica')).toBe('publico')
  })

  it('el resto de la API va al grupo general', () => {
    expect(grupoDeRuta('/api/facturas')).toBe('api')
    expect(grupoDeRuta('/api/productos')).toBe('api')
  })

  // El catálogo es público; /api/productos a secas no lo es, y confundirlos
  // le daría el límite equivocado.
  it('no confunde /api/productos con el catálogo', () => {
    expect(grupoDeRuta('/api/productos')).not.toBe('publico')
  })
})

describe('identificarCliente', () => {
  it('usa la primera IP de x-forwarded-for', () => {
    const cabeceras = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' })
    expect(identificarCliente(cabeceras)).toBe('203.0.113.5')
  })

  it('recurre a x-real-ip si no hay reenvío', () => {
    expect(identificarCliente(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('devuelve un valor fijo cuando no hay ninguna cabecera', () => {
    expect(identificarCliente(new Headers())).toBe('desconocido')
  })
})
