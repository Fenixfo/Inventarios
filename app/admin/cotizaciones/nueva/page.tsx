'use client'

import Link from 'next/link'
import InvoiceForm from '@/components/InvoiceForm'
import { PermissionProtector } from '@/components/PermissionProtector'

export default function NuevaCotizacionPage() {
  return (
    <PermissionProtector requiredPermission="cotizaciones.crear">
      <div style={{ padding: '20px', maxWidth: '1000px' }}>
        <div style={{ marginBottom: '20px' }}>
          <Link href="/admin/cotizaciones" style={{ color: '#2563eb', textDecoration: 'none' }}>
            ← Volver a Cotizaciones
          </Link>
        </div>

        <h1 style={{ marginBottom: '8px' }}>Nueva Cotización</h1>
        <p style={{ marginTop: 0, marginBottom: '30px', color: '#6b7280', fontSize: '14px' }}>
          Igual que una factura, pero no descuenta inventario ni registra pagos.
        </p>

        <InvoiceForm modo="cotizacion" />
      </div>
    </PermissionProtector>
  )
}
