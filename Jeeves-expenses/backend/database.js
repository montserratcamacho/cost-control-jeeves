const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'jeeves.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    unique_id TEXT PRIMARY KEY,
    posted_at_utc TEXT,
    created_at_utc TEXT,
    user_name TEXT,
    user_email TEXT,
    user_department TEXT,
    user_location TEXT,
    transaction_type TEXT,
    sub_transaction_type TEXT,
    transaction_status TEXT,
    credit_or_debit TEXT,
    amount_origin REAL,
    currency TEXT,
    amount_destination REAL,
    local_currency TEXT,
    exchange_rate REAL,
    fx_fees REAL,
    ir_fees REAL,
    transaction_fees REAL,
    payment_description TEXT,
    memo TEXT,
    payee TEXT,
    jeeves_category TEXT,
    card_name TEXT,
    card_last4 TEXT,
    sat_uuid TEXT,
    sat_status TEXT,
    expense_type TEXT,
    descripcion_gasto TEXT,
    folio_factura TEXT,
    archivo_factura_url TEXT,
    archivo_factura_nombre TEXT,
    po_id TEXT,
    tipo_gasto_interno TEXT,
    descripcion_interna TEXT,
    factura_uuid TEXT,
    rfc_emisor TEXT,
    rfc_receptor TEXT,
    updated_at TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    codigo_po TEXT,
    nombre TEXT,
    descripcion TEXT,
    activo INTEGER DEFAULT 1,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS project_budgets (
    po_id TEXT PRIMARY KEY,
    budget_indirectos REAL,
    status TEXT DEFAULT 'pending',
    updated_at TEXT,
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY,
    nombre TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS limits (
    id TEXT PRIMARY KEY,
    user_email TEXT,
    jeeves_category TEXT,
    monthly_limit_mxn REAL
  );
`);

module.exports = db;
