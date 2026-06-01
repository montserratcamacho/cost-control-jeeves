const { fetchJeevesTransactions } = require('./jeevesService');
const db = require('./database');
require('dotenv').config();

async function syncRecent() {
  console.log("🚀 Iniciando Sincronización Rápida (Últimos 2 días)...");
  
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const startDate = yesterday.toISOString().split('T')[0];
  const endDate = tomorrow.toISOString().split('T')[0];

  const insertStmt = db.prepare(`
    INSERT INTO transactions (
      unique_id, created_at_utc, user_name, user_email, payee, payment_description, 
      amount_destination, local_currency, jeeves_category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(unique_id) DO UPDATE SET
      created_at_utc = excluded.created_at_utc,
      user_name = excluded.user_name,
      user_email = excluded.user_email,
      payee = excluded.payee,
      payment_description = excluded.payment_description,
      amount_destination = excluded.amount_destination,
      local_currency = excluded.local_currency,
      jeeves_category = excluded.jeeves_category
  `);

  const processBatch = (txns, source) => {
    db.transaction(() => {
      for (const txn of txns) {
        const uniqueId = `${source}_${txn.id}`;
        const amount = txn.transactionCurrency === 'MXN' ? txn.transactionAmount : (txn.localAmount || txn.transactionAmount);
        const payee = (txn.merchant?.name || txn.vendor?.name || 'Comercio').trim();
        const desc = (txn.merchant?.name || txn.vendor?.name || txn.paymentPurpose || 'Gasto').trim();
        
        insertStmt.run(
          uniqueId,
          txn.transactionDate || new Date().toISOString(),
          txn.user?.name || 'Usuario',
          txn.user?.email || '',
          payee,
          desc,
          amount,
          'MXN',
          txn.merchant?.merchantCategoryCodeDescription || 'Otros'
        );
      }
    })();
    console.log(`✅ Procesado lote de ${txns.length} transacciones de ${source}`);
  };

  // Mocking fetchJeevesTransactions behavior for specific dates
  const endpoints = ['/v1/cards/transactions', '/v1/payments/transactions'];
  for (const endpoint of endpoints) {
    const source = endpoint.includes('cards') ? 'card' : 'payment';
    let url = `https://public-api.jeev.es${endpoint}?pageSize=100&startDate=${startDate}&endDate=${endDate}`;
    console.log(`📡 Consultando ${url}`);
    // We'll use a simplified version of the fetch logic here
  }
  
  console.log("Esta es una prueba de concepto. Ejecutando sync real...");
}

// Re-using the logic but only for the current month
async function run() {
  // We'll modify jeevesService temporarily or just call it and let it run
  // But to be fast, I'll just run the actual performSync but I'll limit the months in a copy
}
