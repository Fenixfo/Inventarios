'use client'

import Link from 'next/link'
import InvoiceForm from '@/components/InvoiceForm'
import { PermissionProtector } from '@/components/PermissionProtector'

export default function NuevaCotizacionPage() {
  return (
    <PermissionProtector requiredPermission="cotizaciones.crear">
      <div style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/cotizaciones" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Cotizaciones
          </Link>
        </div>

        <h1 className="mb-1 text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>Nueva Cotización</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--gray-secondary)' }}>
          Igual que una factura, pero no descuenta inventario ni registra pagos.
        </p>

        <InvoiceForm modo="cotizacion" />
      </div>
    </PermissionProtector>
  )
}
