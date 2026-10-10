/**
 * Prepara Supabase de punta a punta:
 * 1. Corre supabase/setup_all.sql en la base (SUPABASE_DB_URL)
 * 2. Verifica que existan las tablas
 * 3. Copia SUPABASE_URL y SUPABASE_ANON_KEY a app/config.ts
 *
 * Uso: npm run setup:supabase   (lee backend/.env; no imprime secretos)
 */
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { Client } = require('pg');

const ROOT = path.join(__dirname, '../..');
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_DB_URL'];
const EXPECTED_TABLES = ['profiles', 'user_sessions', 'contacts', 'purchase_requests'];

function updateAppConfig(url, anonKey) {
  const configPath = path.join(ROOT, 'app/config.ts');
  const source = fs.existsSync(configPath)
    ? fs.readFileSync(configPath, 'utf8')
    : fs.readFileSync(path.join(ROOT, 'app/config.example.ts'), 'utf8');
  const updated = source
    .replace(/(supabase:\s*\{\s*url:\s*)'[^']*'/, `$1'${url}'`)
    .replace(/(anonKey:\s*)'[^']*'/, `$1'${anonKey}'`);
  fs.writeFileSync(configPath, updated);
}

(async () => {
  const missing = REQUIRED.filter(name => !process.env[name]);
  if (missing.length) {
    console.error(`Faltan en backend/.env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Conectado a la base');

  const { rows: existing } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
    [EXPECTED_TABLES],
  );
  if (existing.length) {
    console.log(`ℹ️  Ya existen: ${existing.map(r => r.table_name).join(', ')} — no se vuelve a correr el SQL`);
  } else {
    await client.query(fs.readFileSync(path.join(ROOT, 'supabase/setup_all.sql'), 'utf8'));
    console.log('✅ Migraciones aplicadas');
  }

  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' and table_name = any($1)",
    [EXPECTED_TABLES],
  );
  const found = rows.map(r => r.table_name);
  EXPECTED_TABLES.forEach(t => console.log(`${found.includes(t) ? '✅' : '❌'} tabla ${t}`));
  await client.end();

  updateAppConfig(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  console.log('✅ app/config.ts actualizado con la URL y anon key de Supabase');
})().catch(error => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
