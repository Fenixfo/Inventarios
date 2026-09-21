import { PrismaClient } from '@prisma/client'

// Una sola instancia para toda la app. Sin esto, cada ruta crea su propio
// cliente —y en desarrollo el hot-reload crea uno nuevo en cada recarga—,
// lo que abre conexiones de más contra Supabase y agota el pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
