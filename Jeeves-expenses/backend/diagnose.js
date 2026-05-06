const db = require('./database');
const { fetchJeevesTransactions } = require('./jeevesService');
const fs = require('fs');

async function diagnose() {
  console.log('--- DIAGNÓSTICO ---');
  
  // 1. Verificar columnas
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  console.log('Columnas encontradas:', columns.map(c => c.name).join(', '));

  // 2. Verificar conteo
  const count = db.prepare('SELECT COUNT(*) as total FROM transactions').get();
  console.log('Total transacciones en DB:', count.total);

  // 3. Probar API de Jeeves y ver estructura real
  try {
    console.log('Llamando a API de Jeeves...');
    const txns = await fetchJeevesTransactions();
    console.log('Transacciones recibidas de la API:', txns.length);
    
    if (txns.length > 0) {
      fs.writeFileSync('api_response_sample.json', JSON.stringify(txns[0], null, 2));
      console.log('Ejemplo de transacción guardado en api_response_sample.json');
      
      // Ver campos de usuario
      console.log('Campos de usuario en el primer registro:', txns[0].user);
    }
  } catch (err) {
    console.error('Error al llamar a la API:', err.message);
  }
}

diagnose();
