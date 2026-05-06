const axios = require('axios');
const https = require('https');
const fs = require('fs');
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

async function fetchWithRetry(url, tokenProvider, retries = 3) {
  try {
    const token = await tokenProvider.getToken();
    return await axios.get(url, {
      httpsAgent, headers: { 'Authorization': `Bearer ${token}` }
    });
  } catch (err) {
    if (err.response?.status === 401) {
      console.log("🔄 401 - Token expirado, refrescando...");
      await tokenProvider.refreshToken();
      return fetchWithRetry(url, tokenProvider, retries);
    }
    if (err.response?.status === 429) {
      console.log("⚠️ 429 - Esperando 15s...");
      await sleep(15000);
      return fetchWithRetry(url, tokenProvider, retries);
    }
    
    // Reintentar en errores de red (ECONNRESET, ETIMEDOUT, etc.)
    if (retries > 0 && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || !err.response)) {
      console.log(`⚠️ Error de red (${err.code || 'unknown'}). Reintentando... (${retries} restantes)`);
      await sleep(5000);
      return fetchWithRetry(url, tokenProvider, retries - 1);
    }

    // Si es 400 (Bad Request), es probable que el rango de fechas sea inválido para el API
    if (err.response?.status === 400) {
      console.error(`❌ Error 400 en URL: ${url}`);
      return { data: { data: [] } };
    }
    throw err;
  }
}

async function fetchJeevesTransactions() {
  let currentToken = await getJeevesToken();
  const tokenProvider = {
    getToken: async () => currentToken,
    refreshToken: async () => {
      currentToken = await getJeevesToken();
      return currentToken;
    }
  };

  const endpoints = ['/v1/cards/transactions', '/v1/payments/transactions'];
  let masterList = [];
  
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  // Generar lista de meses desde Enero 2024 hasta el mes actual
  const months = [];
  for (let y = 2024; y <= currentYear; y++) {
    const startMonth = (y === 2024) ? 1 : 1;
    const endMonth = (y === currentYear) ? currentMonth : 12;
    for (let m = startMonth; m <= endMonth; m++) {
      const monthStr = m < 10 ? `0${m}` : `${m}`;
      const isCurrentMonth = (y === currentYear && m === currentMonth);
      const lastDay = isCurrentMonth ? today.getDate() : new Date(y, m, 0).getDate();
      const lastDayStr = lastDay < 10 ? `0${lastDay}` : `${lastDay}`;

      months.push({
        start: `${y}-${monthStr}-01`,
        end: `${y}-${monthStr}-${lastDayStr}`
      });
    }
  }

  months.reverse();

  for (const month of months) {
    for (const endpoint of endpoints) {
      let nextCursor = null;
      console.log(`📅 Escaneando ${endpoint} - ${month.start} a ${month.end}...`);

      do {
        let url = `https://public-api.jeev.es${endpoint}?pageSize=100&startDate=${month.start}&endDate=${month.end}`;
        if (nextCursor) url += `&pageCursor=${nextCursor}`;

        const response = await fetchWithRetry(url, tokenProvider);
        const items = response.data.data || [];
        
        if (items.length > 0) {
          masterList = masterList.concat(items);
          console.log(`   ✅ Cargados ${items.length} de este bloque (Total acumulado: ${masterList.length})`);
        }

        nextCursor = response.data.pagination?.nextCursor;
        if (nextCursor) await sleep(1500);
      } while (nextCursor);
      await sleep(3000); // Add a delay after each endpoint for a given month
    }
    await sleep(3000); // Add a delay after each month's iteration
  }

  return masterList;
}

module.exports = { fetchJeevesTransactions };
