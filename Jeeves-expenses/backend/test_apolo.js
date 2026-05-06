const axios = require('axios');
require('dotenv').config();

async function testApolo() {
  console.log("🔍 PROBANDO NUEVO QUERY DE APOLO...");
  
  const apoloQuery = `
    query PurchaseOrders {
      purchaseOrders {
        data {
          id
          name
          cancelledAt
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://api.ichigo.prima.ai/graphql/', {
      query: apoloQuery
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.APOLO_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response.data?.errors) {
      console.error("❌ APOLO RESPONDIÓ CON ERRORES:");
      console.error(JSON.stringify(response.data.errors, null, 2));
    } else if (response.data?.data?.purchaseOrders?.data) {
      const pos = response.data.data.purchaseOrders.data;
      const activePos = pos.filter(p => !p.cancelledAt);
      console.log(`✅ ÉXITO: Se encontraron ${pos.length} POs en total.`);
      console.log(`✅ POs activas: ${activePos.length}`);
      if (activePos.length > 0) {
        console.log("Ejemplo de PO activa:");
        console.log(`- ID: ${activePos[0].id}`);
        console.log(`- Nombre: ${activePos[0].name}`);
      }
    } else {
      console.log("⚠️ Respuesta inesperada:", response.data);
    }
  } catch (error) {
    console.error("❌ ERROR:", error.message);
  }
}

testApolo();
