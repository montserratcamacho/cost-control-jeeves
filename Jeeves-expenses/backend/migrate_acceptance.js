const db = require('./database');

console.log('🚀 Iniciando migración para Aceptación de Gastos...');

try {
  // 1. Añadir columnas de aceptación a la tabla de transacciones
  const columns = [
    { name: 'accepted_status', type: 'INTEGER DEFAULT 0' }, // 0: pendiente, 1: aceptado, 2: rechazado
    { name: 'rejection_reason', type: 'TEXT' }
  ];

  for (const col of columns) {
    try {
      db.exec(`ALTER TABLE transactions ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Columna ${col.name} añadida a transactions.`);
    } catch (e) {
      if (e.message.includes('duplicate column name')) {
        console.log(`ℹ️ La columna ${col.name} ya existe.`);
      } else {
        throw e;
      }
    }
  }

  console.log('🎉 Migración de aceptación completada.');
} catch (error) {
  console.error('❌ Error en la migración:', error.message);
  process.exit(1);
}
