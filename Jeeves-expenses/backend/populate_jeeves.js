const axios = require('axios');
const https = require('https');
const fs = require('fs');
const db = require('./database');
require('dotenv').config();

const httpsAgent = new https.Agent({
  cert: fs.existsSync(process.env.JEEVES_CERT_PATH) ? fs.readFileSync(process.env.JEEVES_CERT_PATH) : undefined,
  key: fs.existsSync(process.env.JEEVES_KEY_PATH) ? fs.readFileSync(process.env.JEEVES_KEY_PATH) : undefined,
  rejectUnauthorized: false
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getJeevesToken() {
  const { JEEVES_CLIENT_ID, JEEVES_CLIENT_SECRET } = process.env;
  const auth = Buffer.from(`${JEEVES_CLIENT_ID}:${JEEVES_CLIENT_SECRET}`).toString('base64');
  const response = await axios.post('https://public-api.jeev.es/oauth/token', 
    'grant_type=client_credentials&scope=transactions:read', 
    { httpsAgent, headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return response.data.access_token;
}

function parseUserName(user) {
  if (!user) return 'Usuario Desconocido';
  const full = (user.name || '').trim();
  if (full) return full;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || user.email || 'Usuario Desconocido';
}

async function populate() {
  console.log("🚀 Iniciando población masiva de datos...");
  try {
    const token = await getJeevesToken();
    const endpoints = ['/v1/cards/transactions', '/v1/payments/transactions'];
    
    const insert = db.prepare(`
      INSERT OR REPLACE INTO transactions (
        unique_id, created_at_utc, user_name, user_email, payee, payment_description, 
        amount_destination, local_currency, jeeves_category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const endpoint of endpoints) {
      let nextCursor = null;
      let page = 1;

      do {
        console.log(`📡 Pidiendo página ${page} de ${endpoint}...`);
        let url = `https://public-api.jeev.es${endpoint}?pageSize=100&startDate=2020-01-01`;
        if (nextCursor) url += `&pageCursor=${nextCursor}`;

        try {
          const response = await axios.get(url, {
            httpsAgent, headers: { 'Authorization': `Bearer ${token}` }
          });

          const items = response.data.data || [];
          if (items.length === 0) break;

          const syncBatch = db.transaction((batchItems) => {
            for (const txn of batchItems) {
              const userName = parseUserName(txn.user);
              const amount = txn.transactionCurrency === 'MXN' ? txn.transactionAmount : (txn.localAmount || txn.transactionAmount);
              const payee = txn.merchant?.name || txn.vendor?.name || 'Comercio';
              const desc = txn.merchant?.name || txn.vendor?.name || txn.paymentPurpose || 'Gasto';

              insert.run(
                txn.id,
                txn.transactionDate || new Date().toISOString(),
                userName,
                txn.user?.email || '',
                payee,
                desc,
                amount,
                'MXN',
                txn.merchant?.merchantCategoryCodeDescription || 'Other'
              );
            }
          });

          syncBatch(items);
          console.log(`✅ Página ${page} guardada (${items.length} transacciones)`);
          
          nextCursor = response.data.pagination?.nextCursor;
          page++;
          
          // Pausa generosa para no recibir 429
          await sleep(2000);

        } catch (err) {
          if (err.response && err.response.status === 429) {
            console.log("⚠️ Error 429: Jeeves nos bloqueó. Esperando 15 segundos...");
            await sleep(15000); // Espera larga
            // No incrementamos página ni cursor para reintentar la misma
          } else {
            console.error("❌ Error en página:", err.message);
            break;
          }
        }
      } while (nextCursor);
    }

    console.log("🏁 ¡Población masiva completada!");
  } catch (error) {
    console.error("💥 Error fatal:", error.message);
  }
}

populate();
