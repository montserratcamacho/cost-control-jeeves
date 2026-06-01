const axios = require('axios');
const https = require('https');
const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Cargar .env desde la ruta absoluta correcta
const envPath = path.resolve(__dirname, '.env');
require('dotenv').config({ path: envPath });

const db = new Database(path.resolve(__dirname, 'jeeves.db'));

const httpsAgent = new https.Agent({
  cert: fs.existsSync(process.env.JEEVES_CERT_PATH) ? fs.readFileSync(process.env.JEEVES_CERT_PATH) : undefined,
  key: fs.existsSync(process.env.JEEVES_KEY_PATH) ? fs.readFileSync(process.env.JEEVES_KEY_PATH) : undefined,
  rejectUnauthorized: false
});

async function getJeevesToken() {
  const { JEEVES_CLIENT_ID, JEEVES_CLIENT_SECRET } = process.env;
  if (!JEEVES_CLIENT_ID || !JEEVES_CLIENT_SECRET) {
    throw new Error("Faltan credenciales de Jeeves en el .env");
  }
  const auth = Buffer.from(`${JEEVES_CLIENT_ID}:${JEEVES_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://public-api.jeev.es/oauth/token', 
    'grant_type=client_credentials&scope=transactions:read', 
    { httpsAgent, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

async function run() {
  console.log("🚀 Iniciando Quick Sync...");
  const token = await getJeevesToken();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 15); // 15 días para cubrir desde el 24 de mayo
  
  const startDate = yesterday.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  const endpoints = ['/v1/cards/transactions', '/v1/payments/transactions'];
  
  for (const endpoint of endpoints) {
    const source = endpoint.includes('cards') ? 'card' : 'payment';
    const url = `https://public-api.jeev.es${endpoint}?pageSize=100&startDate=${startDate}&endDate=${endDate}`;
    console.log(`📡 Consultando ${url}`);
    
    const response = await axios.get(url, {
      httpsAgent, headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const items = response.data.data || [];
    console.log(`✅ Recibidos ${items.length} items de ${source}`);
    
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

    db.transaction(() => {
      for (const txn of items) {
        const uniqueId = txn.id; 
        const amount = txn.transactionCurrency === 'MXN' ? txn.transactionAmount : (txn.localAmount || txn.transactionAmount);
        const payee = (txn.merchant?.name || txn.vendor?.name || 'Comercio').trim();
        const desc = (txn.merchant?.name || txn.vendor?.name || txn.paymentPurpose || 'Gasto').trim();
        const date = txn.transactionDate || txn.postedDate || new Date().toISOString();
        
        insertStmt.run(
          uniqueId,
          date,
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
    console.log(`💾 Guardados ${items.length} items en la DB.`);
  }
  db.close();
}

run().catch(console.error);
