const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const db = require('./database');
const { fetchJeevesTransactions } = require('./jeevesService');
const { runHistoricalImport } = require('./historicalService');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const upload = multer({ storage: multer.memoryStorage() });
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads/receipts/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});
const uploadDisk = multer({ storage: storage });

function parseUserName(txn) {
  if (!txn) return 'Usuario Desconocido';
  const user = txn.user || txn.creator || txn.originUser;
  if (!user) {
    // Si no hay objeto user, intentamos buscar en campos de texto de la transacción
    if (txn.paymentPurpose?.includes(' - ')) return txn.paymentPurpose.split(' - ')[0];
    return 'Usuario Desconocido';
  }
  const full = (user.name || '').trim();
  if (full) return full;
  const parts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return parts || user.email || user.id || 'Usuario Desconocido';
}

app.get('/api/transactions', (req, res) => {
  const transactions = db.prepare("SELECT * FROM transactions WHERE unique_id NOT LIKE 'txn_%' ORDER BY created_at_utc DESC").all();
  res.json(transactions);
});

function categorizeTransaction(txn) {
  const mcc = (txn.merchant?.merchantCategoryCodeDescription || '').toLowerCase();
  const desc = (txn.merchant?.name || txn.vendor?.name || txn.paymentPurpose || '').toLowerCase();
  
  // 1. Mapeo por MCC de Jeeves (Prioridad)
  if (mcc.includes('eating places') || 
      mcc.includes('restaurants') || 
      mcc.includes('food stores') || 
      mcc.includes('grocery') || 
      mcc.includes('supermarket') || 
      mcc.includes('fast food') || 
      mcc.includes('miscellaneous food')) {
    return 'Alimentos';
  }
  
  if (mcc.includes('taxicabs') || 
      mcc.includes('limousines') || 
      mcc.includes('bus lines') || 
      mcc.includes('parking') || 
      mcc.includes('tolls') || 
      mcc.includes('bridge and road fees') || 
      mcc.includes('commuter transport') ||
      mcc.includes('peaje')) {
    return 'Transporte';
  }
  
  if (mcc.includes('computer') || 
      mcc.includes('software') || 
      mcc.includes('data processing') || 
      mcc.includes('information retrieval')) {
    return 'Software/IT';
  }
  
  if (mcc.includes('hotel') || 
      mcc.includes('lodging') || 
      mcc.includes('airline') || 
      mcc.includes('travel')) {
    return 'Viajes';
  }

  // 2. Fallback por palabras clave en descripción
  if (desc.includes('uber') || desc.includes('didi') || desc.includes('taxi') || desc.includes('peaje') || desc.includes('estacionamiento') || desc.includes('parking')) return 'Transporte';
  if (desc.includes('restaurante') || desc.includes('comida') || desc.includes('starbucks') || desc.includes('oxxo') || desc.includes('7-eleven') || desc.includes('walmart') || desc.includes('soriana') || desc.includes('costco')) return 'Alimentos';
  if (desc.includes('hotel') || desc.includes('airbnb') || desc.includes('vuelo') || desc.includes('aeromexico')) return 'Viajes';
  if (desc.includes('amazon') || desc.includes('mercadolibre')) return 'Compras/Suministros';
  if (desc.includes('aws') || desc.includes('google') || desc.includes('microsoft') || desc.includes('software') || desc.includes('github') || desc.includes('cursor')) return 'Software/IT';

  return txn.merchant?.merchantCategoryCodeDescription || 'Otros Gastos';
}

let isSyncing = false;

async function performSync() {
  if (isSyncing) {
    console.log("⚠️ Sincronización ya en curso. Ignorando solicitud.");
    return { success: false, message: "Sincronización ya en curso" };
  }
  isSyncing = true;
  try {
    // 1. Limpieza de transacciones de prueba
    db.prepare("DELETE FROM transactions WHERE unique_id LIKE 'txn_%'").run();

    console.log("🚀 Iniciando Sincronización Multi-Periodo Automática (2024-2026)...");
    
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

    const updateReceiptStmt = db.prepare(`
      UPDATE transactions SET 
        sat_uuid = COALESCE(sat_uuid, ?),
        archivo_factura_url = COALESCE(archivo_factura_url, ?),
        archivo_factura_nombre = COALESCE(archivo_factura_nombre, ?)
      WHERE unique_id = ?
    `);

    const processBatch = (txns, source) => {
      db.transaction(() => {
        for (const txn of txns) {
          const userName = parseUserName(txn);
          const amount = txn.transactionCurrency === 'MXN' ? txn.transactionAmount : (txn.localAmount || txn.transactionAmount);
          const payee = (txn.merchant?.name || txn.vendor?.name || 'Comercio').trim();
          const desc = (txn.merchant?.name || txn.vendor?.name || txn.paymentPurpose || 'Gasto').trim();
          const category = categorizeTransaction(txn);
          
          const satUuid = txn.receipt?.taxId || txn.receipt?.uuid || null;
          const receiptUrl = txn.receipt?.url || null;
          const receiptName = txn.receipt?.filename || (receiptUrl ? 'Factura_Jeeves.pdf' : null);

          // Usar el ID original de Jeeves para evitar duplicados si se consulta desde distintos endpoints
          const uniqueId = txn.id;

          insertStmt.run(
            uniqueId,
            txn.transactionDate || new Date().toISOString(),
            userName,
            txn.user?.email || '',
            payee,
            desc,
            amount,
            'MXN',
            category
          );

          if (satUuid || receiptUrl) {
            updateReceiptStmt.run(satUuid, receiptUrl, receiptName, uniqueId);
          }
        }
      })();
    };

    const rawTransactions = await fetchJeevesTransactions(processBatch);
    
    const totalCount = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE unique_id NOT LIKE 'txn_%'").get().count;
    console.log(`✅ Sincronización automática terminada. Total en DB: ${totalCount}`);
    return { count: rawTransactions.length, totalInDb: totalCount };
  } catch (error) {
    console.error('❌ Error en sincronización automática:', error);
    throw error;
  } finally {
    isSyncing = false;
  }
}

app.post('/api/sync-jeeves', async (req, res) => {
  try {
    const result = await performSync();
    res.json({ 
      success: true, 
      count: result.count, 
      totalInDb: result.totalInDb,
      message: `Se procesaron ${result.count} transacciones de los periodos 2024, 2025 y 2026.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/import-historical', async (req, res) => {
  try {
    const stats = await runHistoricalImport(db);
    res.json({ 
      success: true, 
      ...stats,
      message: `Importación finalizada: ${stats.updatedCount} exactos, ${stats.aiMatchedCount} por IA, ${stats.pendingCount} pendientes.`
    });
  } catch (error) {
    console.error('Error en importación histórica:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/init', async (req, res) => {
  console.log("📥 Solicitud /api/init recibida");
  // Eliminado el límite para mostrar todas las transacciones
  const transactions = db.prepare("SELECT * FROM transactions WHERE unique_id NOT LIKE 'txn_%' ORDER BY created_at_utc DESC").all();
  console.log(`📊 Enviando ${transactions.length} transacciones`);
  
  // Integración Real con Apolo
  let projects = [];
  try {
    // Usar caché simple de 5 minutos para POs
    const lastProject = db.prepare('SELECT MAX(created_at) as last FROM projects').get();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    if (lastProject.last && lastProject.last > fiveMinutesAgo) {
      console.log("📦 Usando POs desde caché local");
      projects = db.prepare('SELECT * FROM projects').all();
    } else {
      console.log("📡 Consultando POs desde Apolo...");
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

      const response = await axios.post('https://api.ichigo.prima.ai/graphql', {
        query: apoloQuery
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.APOLO_TOKEN.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos timeout
      });

    if (response.data?.data?.purchaseOrders?.data && response.data.data.purchaseOrders.data.length > 0) {
      projects = response.data.data.purchaseOrders.data
        .filter(po => !po.cancelledAt)
        .map(po => ({
          id: po.id.toString(),
          nombre: `${po.id} - ${po.name}`
        }));
      
      // Guardar en DB local para persistencia y fallback
      const insertProject = db.prepare('INSERT OR REPLACE INTO projects (id, nombre, created_at) VALUES (?, ?, ?)');
      const deleteOld = db.prepare('DELETE FROM projects');
      
      db.transaction((projs) => {
        deleteOld.run();
        for (const p of projs) {
          insertProject.run(p.id, p.nombre, new Date().toISOString());
        }
      })(projects);
      
      console.log(`✅ ${projects.length} POs sincronizadas.`);
    } else {
      console.log("⚠️ Apolo devolvió datos vacíos, usando caché local");
      projects = db.prepare('SELECT * FROM projects').all();
    }
    }
  } catch (error) {
    console.error("❌ Error con Apolo:", error.message);
    projects = db.prepare('SELECT * FROM projects').all();
  }
  
  res.json({ userEmail: 'usuario@prima.ai', isAdmin: true, transactions, projects });
});

app.get('/api/purchase-orders', async (req, res) => {
  let apoloProjects = [];
  try {
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

    const response = await axios.post('https://api.ichigo.prima.ai/graphql', {
      query: apoloQuery
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.APOLO_TOKEN.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    if (response.data?.data?.purchaseOrders?.data && response.data.data.purchaseOrders.data.length > 0) {
      apoloProjects = response.data.data.purchaseOrders.data
        .filter(po => !po.cancelledAt)
        .map(po => ({
          id: po.id.toString(),
          nombre: `${po.id} - ${po.name}`
        }));
      
      // Actualizar caché local si recibimos datos válidos
      const insertProject = db.prepare('INSERT OR REPLACE INTO projects (id, nombre, created_at) VALUES (?, ?, ?)');
      db.transaction((projs) => {
        for (const p of projs) {
          insertProject.run(p.id, p.nombre, new Date().toISOString());
        }
      })(apoloProjects);
    } else {
      throw new Error('Apolo returned empty or invalid data');
    }
  } catch (error) {
    console.error("❌ Error fetching POs from Apolo, using local cache:", error.message);
    apoloProjects = db.prepare('SELECT id, nombre FROM projects').all();
  }

  try {
    // Fetch budgets and actual spend from local database
    const budgets = db.prepare('SELECT po_id, budget_indirectos, status FROM project_budgets').all();
    const spend = db.prepare('SELECT po_id, SUM(amount_destination) as total FROM transactions WHERE po_id IS NOT NULL GROUP BY po_id').all();
    
    const budgetMap = new Map(budgets.map(b => [b.po_id, b]));
    const spendMap = new Map(spend.map(s => [s.po_id, s.total]));

    // Merge projects with local budget data and actual spend
    const projectsWithBudgets = apoloProjects.map(project => ({
      ...project,
      budget_indirectos: budgetMap.get(project.id)?.budget_indirectos || 0,
      budget_status: budgetMap.get(project.id)?.status || 'pending',
      monto_po: 0, // Placeholder
      budget_gastado: spendMap.get(project.id) || 0
    }));

    res.json({ success: true, projects: projectsWithBudgets });
  } catch (error) {
    console.error("❌ Error merging PO data:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions/:id/update', (req, res) => {
  const { id } = req.params;
  const { field, value, updated_by } = req.body;
  const stmt = db.prepare(`UPDATE transactions SET ${field} = ?, updated_at = ?, updated_by = ? WHERE unique_id = ?`);
  stmt.run(value, new Date().toISOString(), updated_by || 'system', id);
  res.json({ success: true });
});

app.post('/api/project-budget', (req, res) => {
  const { po_id, budget_indirectos, updated_by } = req.body;
  try {
    const stmt = db.prepare('INSERT OR REPLACE INTO project_budgets (po_id, budget_indirectos, updated_at, updated_by) VALUES (?, ?, ?, ?)');
    stmt.run(po_id, budget_indirectos, new Date().toISOString(), updated_by || 'system');
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving project budget:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project-budgets/pending', (req, res) => {
  try {
    const pendingBudgets = db.prepare("SELECT pb.po_id, pb.budget_indirectos, pb.status, pb.updated_at, pb.updated_by, p.nombre FROM project_budgets pb JOIN projects p ON pb.po_id = p.id WHERE pb.status = 'pending'").all();
    res.json({ success: true, pendingBudgets });
  } catch (error) {
    console.error("Error fetching pending project budgets:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ... existing code ...
app.post('/api/project-budgets/authorize', (req, res) => {
  const { po_ids, status, updated_by } = req.body;
  try {
    const stmt = db.prepare('UPDATE project_budgets SET status = ?, updated_at = ?, updated_by = ? WHERE po_id = ?');
    db.transaction((ids) => {
      for (const id of ids) {
        stmt.run(status, new Date().toISOString(), updated_by || 'admin', id);
      }
    })(po_ids);
    res.json({ success: true });
  } catch (error) {
    console.error("Error authorizing project budgets:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post('/api/transactions/:id/invoice', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  const { manualText } = req.body;
  let text = manualText || '';

  try {
    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        text = result.text;
        await parser.destroy();
      } else {
        text = req.file.buffer.toString('utf-8');
      }
    }

    // Regex para UUID (Folio Fiscal)
    const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    const uuidMatch = text.match(uuidRegex);
    const uuid = uuidMatch ? uuidMatch[0].toUpperCase() : null;

    // Regex para RFC (Aproximado)
    const rfcRegex = /[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[012])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]/g;
    const rfcMatches = text.match(rfcRegex) || [];
    const uniqueRfcs = [...new Set(rfcMatches)];
    
    // Intentar identificar emisor y receptor (muy simplificado)
    const rfcEmisor = uniqueRfcs[0] || null;
    const rfcReceptor = uniqueRfcs[1] || null;

    if (uuid) {
      const stmt = db.prepare(`
        UPDATE transactions SET 
          factura_uuid = ?, 
          sat_uuid = ?,
          rfc_emisor = ?, 
          rfc_receptor = ?,
          updated_at = ?
        WHERE unique_id = ?
      `);
      stmt.run(uuid, uuid, rfcEmisor, rfcReceptor, new Date().toISOString(), id);
      
      res.json({ success: true, uuid, rfcEmisor, rfcReceptor });
    } else {
      res.status(400).json({ success: false, error: 'No se encontró un UUID válido en el archivo o texto. Asegúrate de que el contenido incluya el folio fiscal.' });
    }
  } catch (error) {
    console.error('❌ Error procesando factura:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions/:id/receipt-photo', uploadDisk.single('photo'), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

  const photoUrl = `http://localhost:3001/uploads/receipts/${req.file.filename}`;
  
  try {
    const stmt = db.prepare('UPDATE transactions SET archivo_factura_url = ?, archivo_factura_nombre = ?, updated_at = ? WHERE unique_id = ?');
    stmt.run(photoUrl, req.file.originalname, new Date().toISOString(), id);
    res.json({ success: true, url: photoUrl });
  } catch (error) {
    console.error("Error saving receipt photo:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- Endpoints de Contabilidad y Usuarios ---

app.get('/api/users-accounting', (req, res) => {
  const { month } = req.query; // Formato YYYY-MM
  try {
    let query = `
      SELECT 
        user_email, 
        user_name, 
        SUM(amount_destination) as total_spent,
        (SELECT default_clasificacion_contable FROM user_configs WHERE user_email = t.user_email) as default_classification
      FROM transactions t
      WHERE unique_id NOT LIKE 'txn_%'
    `;
    
    const params = [];
    if (month) {
      query += ` AND strftime('%Y-%m', created_at_utc) = ?`;
      params.push(month);
    }
    
    query += ` GROUP BY user_email ORDER BY total_spent DESC`;
    
    const users = db.prepare(query).all(...params);
    res.json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users accounting:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/user-config', (req, res) => {
  const { user_email, user_name, default_clasificacion_contable } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO user_configs (user_email, user_name, default_clasificacion_contable, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        default_clasificacion_contable = excluded.default_clasificacion_contable,
        updated_at = excluded.updated_at
    `);
    stmt.run(user_email, user_name, default_clasificacion_contable, new Date().toISOString());
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating user config:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/:email/transactions', (req, res) => {
  const { email } = req.params;
  try {
    const transactions = db.prepare(`
      SELECT t.*, uc.default_clasificacion_contable
      FROM transactions t
      LEFT JOIN user_configs uc ON t.user_email = uc.user_email
      WHERE t.user_email = ? AND t.unique_id NOT LIKE 'txn_%'
      ORDER BY t.created_at_utc DESC
    `).all(email);
    res.json({ success: true, transactions });
  } catch (error) {
    console.error("Error fetching user transactions:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/transactions/:id/accounting', (req, res) => {
  const { id } = req.params;
  const { clasificacion_contable } = req.body;
  try {
    const stmt = db.prepare('UPDATE transactions SET clasificacion_contable = ?, updated_at = ? WHERE unique_id = ?');
    stmt.run(clasificacion_contable, new Date().toISOString(), id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating transaction accounting:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/export-accounting', (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT 
        t.created_at_utc as Fecha,
        t.user_name as Usuario,
        t.user_email as Correo,
        t.payee as Establecimiento,
        t.payment_description as Descripcion,
        t.amount_destination as Monto,
        t.local_currency as Moneda,
        COALESCE(t.clasificacion_contable, uc.default_clasificacion_contable, 'Sin Clasificar') as Clasificacion_Contable
      FROM transactions t
      LEFT JOIN user_configs uc ON t.user_email = uc.user_email
      WHERE t.unique_id NOT LIKE 'txn_%'
      ORDER BY t.created_at_utc DESC
    `).all();
    
    res.json({ success: true, transactions });
  } catch (error) {
    console.error("Error exporting accounting:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Server running on 3001');
  // La sincronización se puede disparar manualmente o por polling si se desea
  // performSync().catch(err => console.error('Error en sincronización inicial:', err.message));
});
