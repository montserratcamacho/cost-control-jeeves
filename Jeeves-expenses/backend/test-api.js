const axios = require('axios');
const https = require('https');
const fs = require('fs');

const certPath = "C:/Users/compu/Documents/Jeeves-expenses/keys/prima-production.pem";
const keyPath = "C:/Users/compu/Documents/Jeeves-expenses/keys/prima-production-key.pem";

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(certPath),
  key: fs.readFileSync(keyPath),
  rejectUnauthorized: false
});

async function test() {
  try {
    const response = await axios.get('https://public-api.jeev.es/oas.json', { httpsAgent });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) console.error('Data:', error.response.data);
  }
}

test();
