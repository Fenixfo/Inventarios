#!/usr/bin/env node

/**
 * Script de inicialización de Supabase
 * Ejecuta: node scripts/init-supabase.js
 *
 * Este script crea todas las tablas, índices y RLS policies
 * en tu proyecto Supabase usando las credenciales de .env
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

// Crear cliente Supabase con service role (permite ejecutar SQL sin restricciones RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function initSupabase() {
  console.log('🚀 Iniciando configuración de Supabase...\n');

  try {
    // Leer el script SQL
    const schemaPath = path.join(__dirname, '..', 'docs', 'specs', 'plataforma_inventarios_beraca', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Dividir por punto y coma para ejecutar cada sentencia
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--')); // Ignorar comentarios y vacías

    let successCount = 0;
    let errorCount = 0;

    console.log(`📝 Encontradas ${statements.length} sentencias SQL\n`);

    // Ejecutar cada sentencia
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Mostrar progreso
      const displayStatement = statement.substring(0, 50).replace(/\n/g, ' ') + '...';
      process.stdout.write(`[${i + 1}/${statements.length}] ${displayStatement}`);

      try {
        const { error } = await supabase.rpc('exec', { sql: statement });

        if (error) {
          // Algunos errores son esperados (ej: IF NOT EXISTS)
          if (error.message.includes('already exists')) {
            console.log(' ⚠️  (ya existe)');
          } else {
            console.log(' ❌');
            console.error(`       Error: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(' ✓');
          successCount++;
        }
      } catch (err) {
        // Intentar ejecutar directamente si rpc no funciona
        try {
          await supabase.rpc('sql', { query: statement });
          console.log(' ✓');
          successCount++;
        } catch (fallbackErr) {
          console.log(' ❌');
          console.error(`       Error: ${fallbackErr.message}`);
          errorCount++;
        }
      }
    }

    console.log(`\n📊 Resultados: ${successCount} exitosas, ${errorCount} con advertencias\n`);

    // Verificar que las tablas se crearon
    console.log('✓ Verificando tablas creadas...\n');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tablesError) {
      console.log('⚠️  No se pudo verificar tablas automáticamente');
      console.log('   (Verifica manualmente en Supabase Dashboard → Table Editor)\n');
    } else {
      const tableNames = tables.map(t => t.table_name).sort();
      console.log('Tablas en la BD:');
      tableNames.forEach(name => console.log(`  ✓ ${name}`));
      console.log();
    }

    console.log('🎉 ¡Configuración completada!\n');
    console.log('Próximos pasos:');
    console.log('1. Crear usuario admin en Supabase Dashboard (Authentication → Users)');
    console.log('2. Ejecutar: node scripts/create-admin.js <UUID> <email>');
    console.log('3. Continuar con TASK-3 (Setup Prisma)\n');

  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
}

initSupabase();
