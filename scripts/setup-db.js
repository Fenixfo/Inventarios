#!/usr/bin/env node

/**
 * Script para inicializar la BD de Supabase
 * Ejecuta: node scripts/setup-db.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  console.error('❌ Error: Falta DIRECT_URL en .env');
  console.error('   Actualiza tu .env con la connection string de Supabase');
  console.error('   Obtén los valores de: Supabase Dashboard → Settings → Database → Connection string');
  process.exit(1);
}

if (directUrl.includes('[YOUR-PASSWORD]')) {
  console.error('❌ Error: DIRECT_URL contiene [YOUR-PASSWORD]');
  console.error('   Reemplaza [YOUR-PASSWORD] con tu contraseña real de PostgreSQL en Supabase');
  process.exit(1);
}

console.log('🔗 Conectando a Supabase...');

// Configurar cliente PostgreSQL usando DIRECT_URL
const client = new Client({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false }
});

async function setupDatabase() {
  try {
    // Conectar
    await client.connect();
    console.log('✓ Conectado a Supabase\n');

    // Leer schema SQL
    const schemaPath = path.join(
      __dirname,
      '..',
      'docs',
      'specs',
      'plataforma_inventarios_beraca',
      'schema.sql'
    );

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📝 Ejecutando schema SQL...\n');

    // Función para dividir SQL respetando comentarios y estructura
    function splitSqlStatements(sql) {
      const statements = [];
      let current = '';
      let inComment = false;

      const lines = sql.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        // Saltar líneas de comentarios puras
        if (trimmed.startsWith('--') || trimmed === '') {
          continue;
        }

        current += line + '\n';

        // Si la línea termina con ;, hemos encontrado el final de un statement
        if (trimmed.endsWith(';')) {
          const stmt = current.trim();
          if (stmt && !stmt.startsWith('--')) {
            // Remover el punto y coma final
            statements.push(stmt.slice(0, -1).trim());
          }
          current = '';
        }
      }

      // Si queda algo sin procesar (no debería pasar)
      if (current.trim()) {
        statements.push(current.trim());
      }

      return statements;
    }

    // Primero, limpiar cualquier tabla existente
    console.log('🧹 Limpiando tablas existentes...\n');
    const cleanup = `
      DROP SCHEMA IF EXISTS beraca CASCADE;
      CREATE SCHEMA beraca;
    `;

    const cleanupStatements = splitSqlStatements(cleanup);
    for (const stmt of cleanupStatements) {
      try {
        await client.query(stmt);
      } catch (err) {
        // Ignorar errores de tablas que no existen
        if (!err.message.includes('does not exist')) {
          throw err;
        }
      }
    }
    console.log('✓ Limpieza completada\n');

    const statements = splitSqlStatements(schemaSql);
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
        console.error('Código de error:', err.code);
        console.error('Statement (primeras 150 chars):', statement.substring(0, 150) + '...');
        throw err;
      }
    }

    console.log('\n✓ Schema ejecutado exitosamente\n');

    // Verificar tablas
    console.log('✓ Verificando tablas creadas...\n');
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'beraca'
      ORDER BY table_name
    `);

    console.log('Tablas en la BD:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    console.log(`\n🎉 ¡Base de datos configurada exitosamente!\n`);
    console.log('Próximos pasos:');
    console.log('1. Crear usuario admin en Supabase (Authentication → Users)');
    console.log('2. Continuar con TASK-3 (Setup Prisma)\n');

    await client.end();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetalles:', error.code || error);

    // Dar sugerencias según el error
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Sugerencia: Verifica que tu conexión de Supabase sea correcta');
    } else if (error.code === '28P01') {
      console.log('\n💡 Sugerencia: La contraseña/service key podría ser incorrecta');
    }

    process.exit(1);
  }
}

setupDatabase();
