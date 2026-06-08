const db = require('./database');

console.log('🚀 Iniciando migración para Clasificación Contable...');

try {
  // 1. Añadir columna a la tabla de transacciones
  try {
    db.exec('ALTER TABLE transactions ADD COLUMN clasificacion_contable TEXT');
    console.log('✅ Columna clasificacion_contable añadida a transactions.');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️ La columna clasificacion_contable ya existe en transactions.');
    } else {
      throw e;
    }
  }

  // 2. Crear tabla de configuraciones de usuario
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_configs (
      user_email TEXT PRIMARY KEY,
      user_name TEXT,
      default_clasificacion_contable TEXT,
      updated_at TEXT
    )
  `);
  console.log('✅ Tabla user_configs creada/verificada.');

  console.log('🎉 Migración completada con éxito.');
} catch (error) {
  console.error('❌ Error en la migración:', error.message);
  process.exit(1);
}
