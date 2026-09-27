'use client'

import Link from 'next/link'
import InvoiceForm from '@/components/InvoiceForm'
import { PermissionProtector } from '@/components/PermissionProtector'

export default function NuevaFacturaPage() {
  return (
    <PermissionProtector requiredPermission="facturas">
      <div style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/facturas" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Facturas
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>Nueva Factura</h1>

        <InvoiceForm />
      </div>
    </PermissionProtector>
  )
}
