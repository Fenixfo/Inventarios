#!/usr/bin/env node

/**
 * Script para asignar rol admin a un usuario en Supabase
 * Ejecuta: node scripts/create-admin-user.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const directUrl = process.env.DIRECT_URL;
const userEmail = process.argv[2];
const userId = process.argv[3];

if (!directUrl) {
  console.error('❌ Error: Falta DIRECT_URL en .env');
  process.exit(1);
}

if (!userEmail || !userId) {
  console.error('❌ Uso: node scripts/create-admin-user.js <email> <user-id>');
  console.error('Ejemplo: node scripts/create-admin-user.js admin@beraca.com 12345678-1234-1234-1234-123456789012');
  console.error('\nEl user-id lo obtienes de Supabase Dashboard → Authentication → Users');
  process.exit(1);
}

console.log('🔗 Conectando a Supabase...');

const client = new Client({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false }
});

async function createAdminUser() {
  try {
    await client.connect();
    console.log('✓ Conectado a Supabase\n');

    // Insertar usuario en tabla usuarios
    console.log(`📝 Insertando usuario: ${userEmail}`);
    const insertUserResult = await client.query(
      `INSERT INTO beraca.usuarios (id, email, created_at, updated_at)
       VALUES ($1, $2, now(), now())
       ON CONFLICT (id) DO NOTHING
       RETURNING id, email`,
      [userId, userEmail]
    );

    if (insertUserResult.rows.length === 0) {
      console.log(`⚠️  Usuario ya existe: ${userEmail}`);
    } else {
      console.log(`✓ Usuario insertado: ${userEmail}`);
    }

    // Asignar rol admin
    console.log('📝 Asignando rol admin...');
    const assignRoleResult = await client.query(
      `INSERT INTO beraca.usuarios_roles (usuario_id, rol, created_at)
       VALUES ($1, 'admin', now())
       ON CONFLICT DO NOTHING
       RETURNING usuario_id, rol`,
      [userId]
    );

    if (assignRoleResult.rows.length === 0) {
      console.log('⚠️  Rol admin ya asignado');
    } else {
      console.log('✓ Rol admin asignado');
    }

    // Verificar
    console.log('\n✓ Verificando...');
    const verifyResult = await client.query(
      `SELECT u.id, u.email, ur.rol
       FROM beraca.usuarios u
       LEFT JOIN beraca.usuarios_roles ur ON u.id = ur.usuario_id
       WHERE u.id = $1`,
      [userId]
    );

    const user = verifyResult.rows[0];
    console.log(`  Email: ${user.email}`);
    console.log(`  Rol: ${user.rol || 'sin asignar'}`);

    console.log('\n🎉 ¡Usuario admin creado exitosamente!\n');
    console.log('Próximos pasos:');
    console.log('1. Instalar Prisma: npm install @prisma/client prisma --save-dev');
    console.log('2. Ejecutar: npx prisma init');
    console.log('3. Continuar con TASK-3\n');

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createAdminUser();
