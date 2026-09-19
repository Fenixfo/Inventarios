#!/usr/bin/env node

/**
 * Script para migrar todas las tablas de schema beraca a public
 * Ejecuta: node scripts/migrate-to-public.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  console.error('❌ Error: Falta DIRECT_URL en .env');
  process.exit(1);
}

console.log('🔗 Conectando a Supabase...');

const client = new Client({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false }
});

async function migrateToPUBLIC() {
  try {
    await client.connect();
    console.log('✓ Conectado a Supabase\n');

    const sqlFile = path.join(__dirname, '..', 'docs', 'specs', 'plataforma_inventarios_beraca', 'migrate_to_public.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Dividir por sentencias correctamente
    function splitSqlStatements(sqlText) {
      const statements = [];
      let current = '';
      const lines = sqlText.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('--') || trimmed === '') continue;

        current += line + '\n';
        if (trimmed.endsWith(';')) {
          const stmt = current.trim().slice(0, -1).trim();
          if (stmt) statements.push(stmt);
          current = '';
        }
      }

      return statements;
    }

    const statements = splitSqlStatements(sql);

    console.log(`📋 Ejecutando ${statements.length} statements...\n`);

    let executed = 0;
    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
        if (executed % 5 === 0 || executed === statements.length) {
          process.stdout.write(`  ✓ Ejecutados ${executed}/${statements.length}\r`);
        }
      } catch (err) {
        console.error(`\n❌ Error en statement ${executed + 1}:`);
        console.error('Mensaje:', err.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
        throw err;
      }
    }

    console.log('\n✓ Migración completada exitosamente\n');

    // Verificar tablas en public
    console.log('✓ Verificando tablas en public...\n');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Tablas en public:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    console.log(`\n🎉 ¡Migración completada! ${result.rows.length} tablas en public\n`);
    console.log('Próximos pasos:');
    console.log('1. Hacer login en http://localhost:3000/login');
    console.log('2. Ir a http://localhost:3000/admin/productos\n');

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrateToPUBLIC();
