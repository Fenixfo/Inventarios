'use client'

import { useState } from 'react'
import Link from 'next/link'
import InvoiceForm from '@/components/InvoiceForm'
import { PermissionProtector } from '@/components/PermissionProtector'
import { SelectorVendedor } from '@/components/factura/SelectorVendedor'

export default function NuevaFacturaPage() {
  // A nombre de quién se factura; vacío = de quien la registra.
  const [vendedorId, setVendedorId] = useState('')

  return (
    <PermissionProtector requiredPermission="facturas">
      <div style={{ maxWidth: 1000 }}>
        <div className="mb-4">
          <Link href="/admin/facturas" style={{ color: 'var(--gold-dark)', textDecoration: 'none' }}>
            ← Volver a Facturas
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--black-primary)' }}>Nueva Factura</h1>
          <SelectorVendedor valor={vendedorId} onCambio={setVendedorId} />
        </div>

        <InvoiceForm vendedorId={vendedorId} />
      </div>
    </PermissionProtector>
  )
}
