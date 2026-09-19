'use client'

import Link from 'next/link'
import InvoiceForm from '@/components/InvoiceForm'
import { PermissionProtector } from '@/components/PermissionProtector'

export default function NuevaFacturaPage() {
  return (
    <PermissionProtector requiredPermission="facturas">
      <div style={{ padding: '20px', maxWidth: '1000px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link href="/admin/facturas" style={{ color: '#2563eb', textDecoration: 'none' }}>
          ← Volver a Facturas
        </Link>
      </div>

      <h1 style={{ marginBottom: '30px' }}>Nueva Factura</h1>

      <InvoiceForm />
      </div>
    </PermissionProtector>
  )
}
