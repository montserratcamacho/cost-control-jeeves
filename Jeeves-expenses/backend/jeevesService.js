const axios = require('axios');
const https = require('https');
const fs = require('fs');
require('dotenv').config();

const certPath = process.env.JEEVES_CERT_PATH;
const keyPath = process.env.JEEVES_KEY_PATH;

const httpsAgent = new https.Agent({
  cert: certPath && fs.existsSync(certPath) ? fs.readFileSync(certPath) : undefined,
  key: keyPath && fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : undefined,
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
      const retryAfter = parseInt(err.response.headers['retry-after']) || 30;
      const waitTime = retryAfter * 1000 + 5000; // Agregar 5s de margen
      console.log(`⚠️ 429 - Too Many Requests. Cloudflare solicita esperar ${retryAfter}s. Esperando ${waitTime/1000}s... (${retries} reintentos restantes)`);
      await sleep(waitTime);
      if (retries > 0) {
        return fetchWithRetry(url, tokenProvider, retries - 1);
      }
      return { data: { data: [] } };
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

async function fetchJeevesTransactions(onBatch) {
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
  const startYear = 2022; // Asegurar que cubrimos todo desde el inicio

  const months = [];
  for (let y = startYear; y <= currentYear; y++) {
    const endM = (y === currentYear) ? currentMonth : 12;
    for (let m = 1; m <= endM; m++) {
      const monthStr = m < 10 ? `0${m}` : `${m}`;
      const endOfMonth = new Date(y, m, 0);
      const lastDay = (y === currentYear && m === currentMonth) ? today.getDate() : endOfMonth.getDate();
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
      try {
        let nextCursor = null;
        const source = endpoint.includes('cards') ? 'card' : 'payment';
        
        // Para el mes actual, extendemos el endDate al día de hoy
        let endDate = month.end;
        const todayStr = today.toISOString().split('T')[0];
        if (month.end === todayStr || month.start.substring(0, 7) === todayStr.substring(0, 7)) {
          // No sumamos +1 día para evitar el error 400 del API de Jeeves
          endDate = todayStr;
        }

        console.log(`📅 Escaneando ${endpoint} - ${month.start} a ${endDate}...`);

        do {
          let url = `https://public-api.jeev.es${endpoint}?pageSize=100&startDate=${month.start}&endDate=${endDate}`;
          if (nextCursor) url += `&pageCursor=${nextCursor}`;

          const response = await fetchWithRetry(url, tokenProvider);
          const items = response.data.data || [];
          
          if (items.length > 0) {
            console.log(`   🔍 IDs: ${items.slice(0, 2).map(i => i.id).join(', ')}...`);
            if (onBatch) await onBatch(items, source);
            masterList = masterList.concat(items);
            console.log(`   ✅ Cargados ${items.length} de este bloque (Total acumulado: ${masterList.length})`);
          }

          nextCursor = response.data.pagination?.nextCursor;
          if (nextCursor) await sleep(2000); 
        } while (nextCursor);
        await sleep(1500);
      } catch (error) {
        console.error(`❌ Error en mes ${month.start} endpoint ${endpoint}:`, error.message);
        continue;
      }
    }
    await sleep(1500);
  }

  return masterList;
}

module.exports = { fetchJeevesTransactions };
