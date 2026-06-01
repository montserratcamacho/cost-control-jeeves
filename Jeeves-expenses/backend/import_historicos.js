const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const db = new Database('C:/Users/compu/Documents/Jeeves-expenses/Jeeves-expenses/backend/jeeves.db');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to convert Excel date to JS date string (YYYY-MM-DD)
function excelDateToJSDate(serial) {
  if (!serial || isNaN(serial)) return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

// Extract PO from text using regex
function extractPO(text) {
  if (!text || text === 'undefined' || text === 'null') return null;
  const upperText = String(text).toUpperCase();
  if (upperText.includes('RFQ')) return null;
  
  // 1. Match PO followed by optional separator and numbers
  const match = upperText.match(/PO[- ]?(\d+)/i);
  if (match) return match[1];

  // 2. If the text is just a number (common in dedicated PO columns)
  if (/^\d+$/.test(String(text).trim())) return String(text).trim();

  return null;
}

async function askOpenAI(prompt) {
  if (!OPENAI_API_KEY) return null;
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: "Eres un experto contable que ayuda a conciliar transacciones de Jeeves con registros manuales de Excel." }, { role: "user", content: prompt }],
      response_format: { type: "json_object" }
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' }
    });
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error("OpenAI Error:", error.message);
    return null;
  }
}

async function processExcel(filePath) {
  console.log(`🚀 Procesando archivo: ${path.basename(filePath)}`);
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  for (const sheetName of sheetNames) {
    if (!/^#\d+\s+/.test(sheetName)) continue;

    console.log(`📄 Pestaña: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].includes('Swipe Date') && rows[i].includes('Amount')) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex === -1) continue;

    const headers = rows[headerIndex];
    const dataRows = rows.slice(headerIndex + 1);
    const colMap = {
      date: headers.indexOf('Swipe Date'),
      amount: headers.indexOf('Amount'),
      user: headers.indexOf('User'),
      descriptor: headers.indexOf('Descriptor'),
      expenseType: headers.indexOf('Expense Type'),
      descCargo: headers.indexOf('DESCRIPCION DEL CARGO'),
      folio: headers.indexOf('FOLIO DE FACTURA'),
      po: headers.indexOf('PO') // New column check
    };

    let updatedCount = 0;
    let aiMatchedCount = 0;
    let pendingCount = 0;

    for (const row of dataRows) {
      if (!row[colMap.date] || !row[colMap.amount]) continue;

      const excelDate = excelDateToJSDate(row[colMap.date]);
      const amount = parseFloat(row[colMap.amount]);
      const user = row[colMap.user];
      const descriptor = row[colMap.descriptor] || '';
      const expenseType = row[colMap.expenseType];
      const descCargo = row[colMap.descCargo] || '';
      const folio = row[colMap.folio];
      
      // Try to get PO from dedicated column first, then fallback to description extraction
      let poId = colMap.po !== -1 ? extractPO(String(row[colMap.po])) : null;
      if (!poId) poId = extractPO(descCargo);

      // 1. Intento Match Exacto Local
      const exactMatches = db.prepare(`
        SELECT * FROM transactions 
        WHERE amount_destination = ? 
          AND (user_name LIKE ? OR ? LIKE '%' || user_name || '%')
          AND ABS(strftime('%J', created_at_utc) - strftime('%J', ?)) <= 1
      `).all(amount, `%${user}%`, user, excelDate);

      if (exactMatches.length === 1) {
        updateTxn(exactMatches[0].unique_id, expenseType, descCargo, folio, poId, 0);
        updatedCount++;
        continue;
      }

      // 2. Si no hay match exacto, buscar candidatos para la IA
      // Ampliamos el rango de fecha a ±3 días y permitimos variaciones de monto de ±1%
      const candidates = db.prepare(`
        SELECT unique_id, created_at_utc, user_name, amount_destination, payment_description, jeeves_category 
        FROM transactions 
        WHERE amount_destination BETWEEN ? AND ?
          AND ABS(strftime('%J', created_at_utc) - strftime('%J', ?)) <= 3
        LIMIT 5
      `).all(amount * 0.99, amount * 1.01, excelDate);

      if (candidates.length > 0) {
        const prompt = `
          Tengo una transacción en Excel:
          - Usuario: ${user}
          - Fecha: ${excelDate}
          - Monto: ${amount}
          - Descriptor: ${descriptor}
          - Descripción Cargo: ${descCargo}

          Y estos candidatos en la base de datos de Jeeves:
          ${JSON.stringify(candidates, null, 2)}

          ¿Cuál es el mejor match? Responde en JSON con el formato:
          {"match_id": "unique_id_del_mejor_match", "confidence": 0.95, "reason": "explicación breve"}
          Si ninguno coincide razonablemente, pon "match_id": null.
        `;

        const aiResult = await askOpenAI(prompt);
        if (aiResult && aiResult.match_id && aiResult.confidence > 0.8) {
          updateTxn(aiResult.match_id, expenseType, descCargo, folio, poId, 0);
          aiMatchedCount++;
          console.log(`🤖 IA Match: ${user} -> ${aiResult.match_id} (${aiResult.confidence})`);
          await sleep(500); // Evitar rate limit
          continue;
        }
      }

      // 3. Si sigue sin match, marcar transacciones cercanas para validación manual
      if (candidates.length > 0) {
        for (const cand of candidates) {
          db.prepare("UPDATE transactions SET needs_validation = 1 WHERE unique_id = ?").run(cand.unique_id);
        }
      }
      pendingCount++;
    }
    console.log(`✅ ${sheetName}: ${updatedCount} exactos, ${aiMatchedCount} por IA, ${pendingCount} pendientes.`);
  }
}

function updateTxn(id, type, desc, folio, po, validation) {
  db.prepare(`
    UPDATE transactions SET 
      tipo_gasto_interno = COALESCE(?, tipo_gasto_interno), 
      descripcion_interna = COALESCE(?, descripcion_interna), 
      factura_uuid = COALESCE(factura_uuid, ?),
      po_id = COALESCE(po_id, ?),
      needs_validation = ?,
      updated_at = ?
    WHERE unique_id = ?
  `).run(type || null, desc || null, folio || null, po || null, validation, new Date().toISOString(), id);
}

async function run() {
  const files = [
    'C:/Users/compu/Documents/Jeeves-expenses/Historicos/______Jeeves - Prima______ enero.xlsx',
    'C:/Users/compu/Documents/Jeeves-expenses/Historicos/______Jeeves - Prima______ febrero.xlsx',
    'C:/Users/compu/Documents/Jeeves-expenses/Historicos/______Jeeves - Prima______ Marzo.xlsx'
  ];
  
  for (const file of files) {
    await processExcel(file);
  }
  
  console.log("🏁 Proceso de importación de todos los archivos finalizado.");
  db.close();
}

run();
