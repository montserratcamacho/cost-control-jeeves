// ============================================================
// JEEVES COST CONTROL - Backend (Google Apps Script)
// Dominio: @prima.ai — Fase 2
// ============================================================

var SPREADSHEET_ID_KEY = 'SPREADSHEET_ID';
var DRIVE_FOLDER_KEY = 'DRIVE_FOLDER_ID';
var TRANSACTIONS_SHEET = 'transactions';
var PROJECTS_SHEET = 'projects';
var ADMINS_SHEET = 'admins';
var LIMITS_SHEET = 'limits';
var PO_LIMITS_SHEET = 'po_limits';

var ALLOWED_DOMAIN = '@prima.ai';
var PO_LIMITS_COLS = ['id', 'po_id', 'limit_mxn', 'created_at'];

// Column name variations in historical Excels -> our manual field names
var HIST_MAP = {
    'Tipo de Gasto': 'expense_type', 'Tipo Gasto': 'expense_type', 'expense_type': 'expense_type',
    'Gasto': 'expense_type', 'Type': 'expense_type',
    'Descripcion Interna': 'descripcion_gasto', 'Descripcion interna': 'descripcion_gasto',
    'descripcion_gasto': 'descripcion_gasto', 'Descripcion': 'descripcion_gasto',
    'Folio Factura': 'folio_factura', 'UUID': 'folio_factura', 'folio_factura': 'folio_factura',
    'SAT Uuid': 'folio_factura', 'sat_uuid': 'folio_factura', 'UUID Factura': 'folio_factura',
    'PO': 'po_id', 'po_id': 'po_id', 'PO ID': 'po_id', 'Purchase Order': 'po_id'
};

var TXN_COLS = [
    'unique_id', 'posted_at_utc', 'created_at_utc', 'user_name', 'user_email',
    'user_department', 'user_location', 'transaction_type', 'sub_transaction_type',
    'transaction_status', 'credit_or_debit', 'amount_origin', 'currency',
    'amount_destination', 'local_currency', 'exchange_rate', 'fx_fees', 'ir_fees',
    'transaction_fees', 'payment_description', 'memo', 'payee', 'jeeves_category',
    'card_name', 'card_last4', 'sat_uuid', 'sat_status',
    'expense_type', 'descripcion_gasto', 'folio_factura',
    'archivo_factura_url', 'archivo_factura_nombre', 'po_id',
    'updated_at', 'updated_by'
];

var MANUAL_FIELDS = [
    'expense_type', 'descripcion_gasto', 'folio_factura',
    'archivo_factura_url', 'archivo_factura_nombre', 'po_id'
];

var PROJECT_COLS = ['id', 'codigo_po', 'nombre', 'descripcion', 'activo', 'created_at'];
var ADMIN_COLS = ['email', 'nombre', 'created_at'];
var LIMITS_COLS = ['id', 'user_email', 'jeeves_category', 'monthly_limit_mxn'];

// -- Entry point -----------------------------------------------
function doGet() {
    return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('Jeeves Cost Control - prima.ai')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// -- Init ------------------------------------------------------
function initApp() {
    try {
        var email = Session.getActiveUser().getEmail();
        if (!email) throw new Error('No se pudo obtener el correo @prima.ai.');
        var ss = getOrCreateSpreadsheet(email);
        var admin = isAdminEmail(ss, email);
        return { userEmail: email, isAdmin: admin, spreadsheetUrl: ss.getUrl() };
    } catch (e) {
        throw new Error('Error al iniciar: ' + e.message);
    }
}

// Batch init: returns user info + transactions + limits + po_limits in ONE call
// Projects load separately (async) because Metabase is slow
function initAppBatch() {
    try {
        var email = Session.getActiveUser().getEmail();
        if (!email) throw new Error('No se pudo obtener tu correo. Asegurate de que la app tenga acceso a tu cuenta Google @prima.ai y que el despliegue sea "Cualquier persona dentro de prima.ai".');
        if (!email.endsWith(ALLOWED_DOMAIN)) throw new Error('Acceso restringido a cuentas ' + ALLOWED_DOMAIN + '. Tu correo actual es: ' + email);

        var ss = getOrCreateSpreadsheet(email);
        var admin = isAdminEmail(ss, email);

        // Cache for regular users (5 min). Admins skip cache — they see everyone's data.
        if (!admin) {
            try {
                var hit = CacheService.getUserCache().get('batch_v1');
                if (hit) return JSON.parse(hit);
            } catch (e) { }
        }

        // Read all sheets upfront in one pass
        var sheetsMap = {};
        ss.getSheets().forEach(function (s) { sheetsMap[s.getName()] = s; });

        var txns = [];
        try {
            var txnSheet = sheetsMap[TRANSACTIONS_SHEET];
            if (txnSheet) {
                var txnData = txnSheet.getDataRange().getValues();
                if (txnData.length > 1) {
                    var hdrs = txnData[0];
                    var eIdx = hdrs.indexOf('user_email');
                    // Only the fields the UI actually needs (keeps JSON small for cache)
                    var keep = ['unique_id', 'posted_at_utc', 'user_name', 'user_email', 'user_department',
                        'amount_origin', 'currency', 'amount_destination', 'local_currency',
                        'payee', 'payment_description', 'jeeves_category', 'transaction_status',
                        'expense_type', 'descripcion_gasto', 'folio_factura',
                        'archivo_factura_url', 'archivo_factura_nombre', 'po_id', 'sat_uuid'];
                    var keepIdx = keep.map(function (k) { return hdrs.indexOf(k); });
                    txns = txnData.slice(1)
                        .filter(function (r) { return r[0] && (admin || r[eIdx] === email); })
                        .map(function (r) {
                            var obj = {};
                            keep.forEach(function (k, i) {
                                var v = r[keepIdx[i]];
                                obj[k] = v instanceof Date ? v.toISOString() : (v === undefined ? '' : v);
                            });
                            return obj;
                        });
                }
            }
        } catch (e) { txns = []; }

        var limits = [];
        try {
            var limSheet = sheetsMap[LIMITS_SHEET];
            if (limSheet) {
                var limData = limSheet.getDataRange().getValues();
                if (limData.length > 1) {
                    var lhdrs = limData[0];
                    limits = limData.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
                        var o = {}; lhdrs.forEach(function (h, i) { o[h] = r[i]; }); return o;
                    });
                }
            }
        } catch (e) { limits = []; }

        var poLimits = [];
        try {
            var plSheet = sheetsMap[PO_LIMITS_SHEET];
            if (plSheet) {
                var plData = plSheet.getDataRange().getValues();
                if (plData.length > 1) {
                    var plHdrs = plData[0];
                    poLimits = plData.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
                        var o = {}; plHdrs.forEach(function (h, i) { o[h] = r[i]; }); return o;
                    });
                }
            }
        } catch (e) { poLimits = []; }

        var result = {
            userEmail: email, isAdmin: admin, spreadsheetUrl: ss.getUrl(),
            transactions: txns, limits: limits, poLimits: poLimits
        };

        // Cache for non-admins: 5 minutes (invalidated on updateTransaction)
        if (!admin) {
            try { CacheService.getUserCache().put('batch_v1', JSON.stringify(result), 300); } catch (e) { }
        }

        return result;
    } catch (e) {
        throw new Error('Error al iniciar: ' + e.message);
    }
}

function getOrCreateSpreadsheet(email) {
    var props = PropertiesService.getScriptProperties();
    var ssId = props.getProperty(SPREADSHEET_ID_KEY);
    if (ssId) { try { return SpreadsheetApp.openById(ssId); } catch (e) { } }

    var ss = SpreadsheetApp.create('Jeeves Cost Control - prima.ai');
    props.setProperty(SPREADSHEET_ID_KEY, ss.getId());

    var txnSheet = ss.getSheets()[0].setName(TRANSACTIONS_SHEET);
    txnSheet.appendRow(TXN_COLS);
    styleHeader(txnSheet, TXN_COLS.length);

    var admSheet = ss.insertSheet(ADMINS_SHEET);
    admSheet.appendRow(ADMIN_COLS);
    styleHeader(admSheet, ADMIN_COLS.length);
    var userEmail = email || Session.getActiveUser().getEmail();
    admSheet.appendRow([userEmail, 'Admin', new Date().toISOString()]);

    var limSheet = ss.insertSheet(LIMITS_SHEET);
    limSheet.appendRow(LIMITS_COLS);
    styleHeader(limSheet, LIMITS_COLS.length);

    var plSheet = ss.insertSheet(PO_LIMITS_SHEET);
    plSheet.appendRow(PO_LIMITS_COLS);
    styleHeader(plSheet, PO_LIMITS_COLS.length);

    return ss;
}

function styleHeader(sheet, cols) {
    var r = sheet.getRange(1, 1, 1, cols);
    r.setBackground('#0f172a').setFontColor('#38bdf8').setFontWeight('bold');
    sheet.setFrozenRows(1);
}

// -- Auth ------------------------------------------------------
function isAdminEmail(ss, email) {
    try {
        var data = ss.getSheetByName(ADMINS_SHEET).getDataRange().getValues();
        return data.slice(1).some(function (r) { return r[0] === email; });
    } catch (e) { return false; }
}

function checkIsAdmin(email) {
    try {
        var data = getOrCreateSpreadsheet(email)
            .getSheetByName(ADMINS_SHEET).getDataRange().getValues();
        return data.slice(1).some(function (r) { return r[0] === email; });
    } catch (e) { return false; }
}

// -- Transactions ----------------------------------------------
function getTransactions() {
    var email = Session.getActiveUser().getEmail();
    var admin = checkIsAdmin(email);
    var data = getOrCreateSpreadsheet(email)
        .getSheetByName(TRANSACTIONS_SHEET).getDataRange().getValues();
    if (data.length <= 1) return [];
    var headers = data[0];
    var emailIdx = headers.indexOf('user_email');
    return data.slice(1)
        .filter(function (r) { return r[0] && (admin || r[emailIdx] === email); })
        .map(function (r) {
            var obj = {};
            headers.forEach(function (h, i) {
                obj[h] = r[i] instanceof Date ? r[i].toISOString() : r[i];
            });
            return obj;
        });
}

function updateTransaction(uniqueId, field, value) {
    var email = Session.getActiveUser().getEmail();
    var admin = checkIsAdmin(email);
    var sheet = getOrCreateSpreadsheet(email).getSheetByName(TRANSACTIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    var hdrs = data[0];
    var uidIdx = hdrs.indexOf('unique_id');
    var fIdx = hdrs.indexOf(field);
    var eIdx = hdrs.indexOf('user_email');
    var uatIdx = hdrs.indexOf('updated_at');
    var ubyIdx = hdrs.indexOf('updated_by');
    if (fIdx === -1) return { success: false, error: 'Campo no encontrado: ' + field };
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][uidIdx]) === String(uniqueId)) {
            if (!admin && data[i][eIdx] !== email) return { success: false, error: 'Sin permiso' };
            sheet.getRange(i + 1, fIdx + 1).setValue(value);
            sheet.getRange(i + 1, uatIdx + 1).setValue(new Date().toISOString());
            sheet.getRange(i + 1, ubyIdx + 1).setValue(email);
            // Invalidate user cache so next load reflects the change
            try { CacheService.getUserCache().remove('batch_v1'); } catch (e) { }
            // Secondary backup in UserProperties
            if (MANUAL_FIELDS.indexOf(field) >= 0) _backupManualField(uniqueId, field, value);
            return { success: true };
        }
    }
    return { success: false, error: 'No encontrada' };
}

function importJeevesData(rows) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Solo admins pueden importar.' };
    var sheet = getOrCreateSpreadsheet(email).getSheetByName(TRANSACTIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var uidIdx = headers.indexOf('unique_id');
    var existing = {};
    data.slice(1).forEach(function (r, i) {
        if (r[uidIdx]) existing[r[uidIdx]] = { rowIdx: i + 2, row: r };
    });
    var inserted = 0, updated = 0;
    for (var k = 0; k < rows.length; k++) {
        var row = rows[k];
        if (!row.unique_id) continue;
        var jeevesVals = TXN_COLS.map(function (col) {
            return MANUAL_FIELDS.indexOf(col) >= 0 ? '' : (row[col] !== undefined ? row[col] : '');
        });
        if (existing[row.unique_id]) {
            var sheetRow = existing[row.unique_id].rowIdx;
            TXN_COLS.forEach(function (col, idx) {
                if (MANUAL_FIELDS.indexOf(col) < 0 && col !== 'unique_id' && row[col] !== undefined && row[col] !== '') {
                    sheet.getRange(sheetRow, idx + 1).setValue(row[col]);
                }
            });
            updated++;
        } else {
            sheet.appendRow(jeevesVals);
            inserted++;
        }
    }
    // Clear admin cache after import so next load shows new data
    try { CacheService.getUserCache().remove('batch_v1'); } catch (e) { }
    return { success: true, inserted: inserted, updated: updated, total: rows.length };
}

function getUsers() {
    var email = Session.getActiveUser().getEmail();
    var data = getOrCreateSpreadsheet(email)
        .getSheetByName(TRANSACTIONS_SHEET).getDataRange().getValues();
    if (data.length <= 1) return [];
    var eIdx = data[0].indexOf('user_email');
    var nIdx = data[0].indexOf('user_name');
    var map = {};
    data.slice(1).forEach(function (r) { if (r[eIdx]) map[r[eIdx]] = r[nIdx]; });
    return Object.keys(map).map(function (e) { return { email: e, name: map[e] }; });
}

// -- Projects from Metabase ------------------------------------
function getProjects() {
    try {
        var data = Metabasebot.fetchMetabaseQuestion(18514);
        if (!data || !data.length) return [];
        return data.map(function (row) {
            return {
                id: String(row.id),
                nombre: row.name || row.search_name || '',
                category: row.category || '',
                status: row.status || '',
                currency: row.currency || '',
                erp_id: row.erp_id || ''
            };
        });
    } catch (e) {
        Logger.log('Error Metabasebot: ' + e.message);
        return [];
    }
}

// -- Admins ----------------------------------------------------
function getAdmins() {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Sin permiso' };
    var data = getOrCreateSpreadsheet(email)
        .getSheetByName(ADMINS_SHEET).getDataRange().getValues();
    var hdrs = data[0];
    return {
        success: true, admins: data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
            var o = {}; hdrs.forEach(function (h, i) { o[h] = r[i]; }); return o;
        })
    };
}

function addAdmin(adminEmail, nombre) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Sin permiso' };
    getOrCreateSpreadsheet(email).getSheetByName(ADMINS_SHEET)
        .appendRow([adminEmail, nombre || '', new Date().toISOString()]);
    return { success: true };
}

// -- Spending Limits -------------------------------------------
function getLimits() {
    var email = Session.getActiveUser().getEmail();
    var ss = getOrCreateSpreadsheet(email);
    var sheet = ss.getSheetByName(LIMITS_SHEET);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var hdrs = data[0];
    return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
        var o = {}; hdrs.forEach(function (h, i) { o[h] = r[i]; }); return o;
    });
}

function setLimit(limitData) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Solo admins.' };
    var ss = getOrCreateSpreadsheet(email);
    var sheet = ss.getSheetByName(LIMITS_SHEET);
    if (!sheet) {
        sheet = ss.insertSheet(LIMITS_SHEET);
        sheet.appendRow(LIMITS_COLS);
        styleHeader(sheet, LIMITS_COLS.length);
    }
    if (limitData.id) {
        var values = sheet.getDataRange().getValues();
        for (var i = 1; i < values.length; i++) {
            if (String(values[i][0]) === String(limitData.id)) {
                sheet.getRange(i + 1, 2).setValue(limitData.user_email);
                sheet.getRange(i + 1, 3).setValue(limitData.jeeves_category);
                sheet.getRange(i + 1, 4).setValue(parseFloat(limitData.monthly_limit_mxn) || 0);
                return { success: true };
            }
        }
    }
    var id = Utilities.getUuid();
    sheet.appendRow([id, limitData.user_email, limitData.jeeves_category, parseFloat(limitData.monthly_limit_mxn) || 0]);
    return { success: true, id: id };
}

function deleteLimit(limitId) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Sin permiso' };
    var sheet = getOrCreateSpreadsheet(email).getSheetByName(LIMITS_SHEET);
    if (!sheet) return { success: false, error: 'No existe hoja de limites' };
    var values = sheet.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(limitId)) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }
    return { success: false, error: 'Limite no encontrado' };
}

// -- AI-Assisted Historical Matching ---------------------------
// Uses GPT-4o-mini to find transaction matches for rows that fuzzy-matching missed.
// histRows:    [{_date, _amount, _user, _merchant, _descriptor, ...}]
// txnSummaries:[{unique_id, posted_at_utc, amount_origin, amount_destination, user_name, payee, payment_description}]
function matchHistoricalWithAI(histRows, txnSummaries) {
    var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) return { success: false, error: 'Falta OPENAI_API_KEY en Script Properties.' };
    if (!histRows || !histRows.length) return { success: true, matches: [] };

    var maxH = Math.min(histRows.length, 50);
    var maxT = Math.min((txnSummaries || []).length, 300);

    var hLines = histRows.slice(0, maxH).map(function (h, i) {
        return i + ': fecha=' + h._date +
            ' monto=' + String(h._amount || '').replace(/,/g, '') +
            ' usuario="' + (h._user || '') + '"' +
            ' comercio="' + (h._merchant || '') + '"' +
            ' desc="' + (h._descriptor || '') + '"';
    }).join('\n');

    var tLines = (txnSummaries || []).slice(0, maxT).map(function (t) {
        return t.unique_id +
            ': fecha=' + (t.posted_at_utc || '').substring(0, 10) +
            ' orig=' + (t.amount_origin || '') +
            ' dest=' + (t.amount_destination || '') +
            ' usuario="' + (t.user_name || '') + '"' +
            ' pagador="' + (t.payee || '') + '"' +
            ' desc="' + String(t.payment_description || '').substring(0, 60) + '"';
    }).join('\n');

    var prompt =
        'Eres un sistema de conciliacion de gastos corporativos.\n' +
        'Tu tarea: para cada registro historico encuentra la transaccion que mejor coincide.\n\n' +
        'REGLAS:\n' +
        '- La fecha del historico (Swipe Date) puede ser 1-3 dias ANTES del Post Date de la transaccion.\n' +
        '- El monto del historico puede coincidir con "orig" (moneda original, ej. USD) O con "dest" (MXN).\n' +
        '- El nombre de usuario puede estar en distinto formato (mayusculas, con punto, etc.).\n' +
        '- Si no hay coincidencia razonable, usa null.\n\n' +
        'REGISTROS HISTORICOS (idx: campos):\n' + hLines + '\n\n' +
        'TRANSACCIONES ACTUALES (unique_id: campos):\n' + tLines + '\n\n' +
        'Responde UNICAMENTE con JSON valido, sin ningun texto adicional:\n' +
        '[{"idx":0,"id":"unique_id_o_null"},{"idx":1,"id":null},...]\n' +
        'Incluye un objeto por cada idx del 0 al ' + (maxH - 1) + '.';

    try {
        var resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
            method: 'post',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            payload: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Eres un sistema de conciliacion financiera. Responde siempre con JSON valido y nada mas, sin markdown.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0,
                max_tokens: 2000
            }),
            muteHttpExceptions: true
        });

        var json = JSON.parse(resp.getContentText());
        if (!json.choices || !json.choices[0]) return { success: false, error: 'Sin respuesta de GPT' };

        var text = json.choices[0].message.content.trim();
        // Strip markdown code fences if present
        text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
        var arrMatch = text.match(/\[[\s\S]*\]/);
        if (!arrMatch) return { success: false, error: 'GPT no devolvio JSON array: ' + text.substring(0, 120) };

        var matches = JSON.parse(arrMatch[0]);
        return { success: true, matches: matches };
    } catch (e) {
        return { success: false, error: 'Error llamando GPT: ' + e.message };
    }
}

// -- Historical Manual Import ----------------------------------
// Fills empty manual fields from historical Excel (user's previously filled data)
function importHistoricalManual(rows) {
    var email = Session.getActiveUser().getEmail();
    var sheet = getOrCreateSpreadsheet(email).getSheetByName(TRANSACTIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    var hdrs = data[0];
    var uidIdx = hdrs.indexOf('unique_id');
    var eIdx = hdrs.indexOf('user_email');
    var admin = checkIsAdmin(email);

    var existing = {};
    data.slice(1).forEach(function (r, i) {
        if (r[uidIdx]) existing[String(r[uidIdx])] = { rowIdx: i + 2, row: r };
    });

    var updated = 0, skipped = 0;
    rows.forEach(function (row) {
        if (!row.unique_id) return;
        var found = existing[String(row.unique_id)];
        if (!found) { skipped++; return; }
        if (!admin && String(found.row[eIdx]) !== email) return;

        var changed = false;
        MANUAL_FIELDS.forEach(function (field) {
            if (!row[field] && row[field] !== 0) return;
            var fIdx = hdrs.indexOf(field);
            if (fIdx < 0) return;
            if (found.row[fIdx]) return; // never overwrite existing data
            sheet.getRange(found.rowIdx, fIdx + 1).setValue(row[field]);
            changed = true;
        });
        if (changed) updated++;
    });

    try { CacheService.getUserCache().remove('batch_v1'); } catch (e) { }
    return { success: true, updated: updated, skipped: skipped, total: rows.length };
}

// -- Admin: User Transaction Status ----------------------------
// filterMonth: optional 'YYYY-MM' string; defaults to current month
function getUserTransactionStatus(filterMonth) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Sin permiso' };

    var sheet = getOrCreateSpreadsheet(email).getSheetByName(TRANSACTIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, users: [], month: '' };

    var hdrs = data[0];
    var eIdx = hdrs.indexOf('user_email');
    var nIdx = hdrs.indexOf('user_name');
    var etIdx = hdrs.indexOf('expense_type');
    var poIdx = hdrs.indexOf('po_id');
    var ffIdx = hdrs.indexOf('folio_factura');
    var afIdx = hdrs.indexOf('archivo_factura_url');
    var dateIdx = hdrs.indexOf('posted_at_utc');
    var amtIdx = hdrs.indexOf('amount_origin');

    var now = new Date();
    var defaultMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    // Use provided filterMonth if it looks like 'YYYY-MM', otherwise use current month
    var curMonth = (filterMonth && /^\d{4}-\d{2}$/.test(String(filterMonth).trim()))
        ? String(filterMonth).trim()
        : defaultMonth;

    var map = {};
    data.slice(1).forEach(function (r) {
        if (!r[eIdx]) return;
        var em = String(r[eIdx]);
        var month = String(r[dateIdx] || '').substring(0, 7);
        if (!map[em]) map[em] = {
            email: em, name: String(r[nIdx] || em),
            total: 0, completed: 0, pending: 0, totalAmount: 0,
            thisMonth: 0, thisMonthCompleted: 0, thisMonthPending: 0
        };
        map[em].total++;
        map[em].totalAmount += parseFloat(r[amtIdx]) || 0;
        var done = r[etIdx] && r[poIdx] && (r[ffIdx] || r[afIdx]);
        if (done) map[em].completed++; else map[em].pending++;
        if (month === curMonth) {
            map[em].thisMonth++;
            if (done) map[em].thisMonthCompleted++; else map[em].thisMonthPending++;
        }
    });

    var users = Object.keys(map).map(function (k) { return map[k]; })
        .sort(function (a, b) { return b.thisMonthPending - a.thisMonthPending; });
    return { success: true, users: users, month: curMonth };
}

// -- PO Limits -------------------------------------------------
function getPoLimits() {
    var email = Session.getActiveUser().getEmail();
    var ss = getOrCreateSpreadsheet(email);
    var sheet = ss.getSheetByName(PO_LIMITS_SHEET);
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    var hdrs = data[0];
    return data.slice(1).filter(function (r) { return r[0]; }).map(function (r) {
        var o = {}; hdrs.forEach(function (h, i) { o[h] = r[i]; }); return o;
    });
}

function setPoLimit(data) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Solo admins.' };
    var ss = getOrCreateSpreadsheet(email);
    var sheet = ss.getSheetByName(PO_LIMITS_SHEET);
    if (!sheet) {
        sheet = ss.insertSheet(PO_LIMITS_SHEET);
        sheet.appendRow(PO_LIMITS_COLS);
        styleHeader(sheet, PO_LIMITS_COLS.length);
    }
    if (data.id) {
        var vals = sheet.getDataRange().getValues();
        for (var i = 1; i < vals.length; i++) {
            if (String(vals[i][0]) === String(data.id)) {
                sheet.getRange(i + 1, 2).setValue(data.po_id);
                sheet.getRange(i + 1, 3).setValue(parseFloat(data.limit_mxn) || 0);
                return { success: true };
            }
        }
    }
    var id = Utilities.getUuid();
    sheet.appendRow([id, data.po_id, parseFloat(data.limit_mxn) || 0, new Date().toISOString()]);
    return { success: true, id: id };
}

function deletePoLimit(limitId) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Sin permiso' };
    var sheet = getOrCreateSpreadsheet(email).getSheetByName(PO_LIMITS_SHEET);
    if (!sheet) return { success: false, error: 'No existe hoja po_limits' };
    var vals = sheet.getDataRange().getValues();
    for (var i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(limitId)) {
            sheet.deleteRow(i + 1);
            return { success: true };
        }
    }
    return { success: false, error: 'No encontrado' };
}

// -- Monthly Reset ---------------------------------------------
function resetMonthlyTransactions(month, userEmails) {
    // month: 'YYYY-MM'  |  userEmails: string[] or ['*'] for all
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Solo admins.' };

    var sheet = getOrCreateSpreadsheet(email).getSheetByName(TRANSACTIONS_SHEET);
    var data = sheet.getDataRange().getValues();
    var hdrs = data[0];
    var dateIdx = hdrs.indexOf('posted_at_utc');
    var emailIdx = hdrs.indexOf('user_email');

    var fieldsToReset = ['expense_type', 'descripcion_gasto', 'folio_factura',
        'archivo_factura_url', 'archivo_factura_nombre', 'po_id'];
    var fieldIdxs = fieldsToReset
        .map(function (f) { return hdrs.indexOf(f); })
        .filter(function (i) { return i >= 0; });

    var allUsers = userEmails.length === 1 && userEmails[0] === '*';
    var count = 0;

    for (var i = 1; i < data.length; i++) {
        var rowMonth = String(data[i][dateIdx] || '').substring(0, 7);
        var rowEmail = String(data[i][emailIdx] || '');
        if (rowMonth !== month) continue;
        if (!allUsers && userEmails.indexOf(rowEmail) < 0) continue;
        fieldIdxs.forEach(function (idx) { sheet.getRange(i + 1, idx + 1).setValue(''); });
        count++;
    }
    return { success: true, count: count };
}

// -- Manual Field Backup (UserProperties) ---------------------
// Secondary persistence layer — survives if Sheet is corrupted/deleted
function _backupManualField(uniqueId, field, value) {
    try {
        var props = PropertiesService.getUserProperties();
        var key = 'mb_' + uniqueId;
        var obj = {};
        try { obj = JSON.parse(props.getProperty(key) || '{}'); } catch (e) { }
        obj[field] = value;
        props.setProperty(key, JSON.stringify(obj));
    } catch (e) { /* silently ignore — Sheet is primary */ }
}

// -- AI Spending Analysis (OpenAI API) ------------------------
// spendData is pre-aggregated on the frontend — no need to re-read the sheet
function analyzeSpendingWithAI(spendData, viaticoPolicy) {
    var email = Session.getActiveUser().getEmail();
    if (!checkIsAdmin(email)) return { success: false, error: 'Solo admins.' };

    var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) return {
        success: false,
        error: 'Falta OPENAI_API_KEY. Ve a: Apps Script → Configuracion del proyecto → Propiedades de secuencia de comandos.'
    };

    var policySection = viaticoPolicy
        ? '\n\nPOLITICA DE VIATICOS DE LA EMPRESA (usa esto para detectar incumplimientos):\n' + viaticoPolicy + '\n'
        : '';

    var prompt = 'Eres un analista financiero corporativo para una fintech latinoamericana (prima.ai). ' +
        'Analiza el siguiente resumen de gastos con tarjeta corporativa y responde en JSON con este formato exacto:\n' +
        '{\n' +
        '  "salud": <numero 1-10>,\n' +
        '  "resumen": "<2 oraciones sobre el estado general>",\n' +
        '  "areas_criticas": [{"nombre":"...","monto":0,"pct_del_total":0,"observacion":"..."}],\n' +
        '  "anomalias": ["<observacion breve>"],\n' +
        '  "recomendaciones": ["<accion concreta para reducir gasto>"]\n' +
        '}\n\n' +
        'Datos de gasto (MXN):\n' + JSON.stringify(spendData) + policySection;

    try {
        var resp = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
            method: 'post',
            headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
            payload: JSON.stringify({
                model: 'gpt-4o-mini',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }]
            }),
            muteHttpExceptions: true
        });

        var body = JSON.parse(resp.getContentText());
        if (body.error) return { success: false, error: body.error.message };

        var text = (body.choices && body.choices[0] && body.choices[0].message.content) || '';
        var match = text.match(/\{[\s\S]*\}/);
        if (!match) return { success: false, error: 'Respuesta inesperada: ' + text.substring(0, 200) };

        return { success: true, insights: JSON.parse(match[0]) };
    } catch (e) {
        return { success: false, error: e.toString() };
    }
}

// -- File Upload -----------------------------------------------
function saveInvoiceFile(uniqueId, fileName, base64Data, mimeType) {
    try {
        var props = PropertiesService.getScriptProperties();
        var folder;
        var fid = props.getProperty(DRIVE_FOLDER_KEY);
        if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { } }
        if (!folder) {
            folder = DriveApp.createFolder('Jeeves Facturas - prima.ai');
            props.setProperty(DRIVE_FOLDER_KEY, folder.getId());
        }
        var subs = folder.getFoldersByName(uniqueId);
        var sub = subs.hasNext() ? subs.next() : folder.createFolder(uniqueId);
        var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
        var file = sub.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var url = file.getUrl();
        updateTransaction(uniqueId, 'archivo_factura_url', url);
        updateTransaction(uniqueId, 'archivo_factura_nombre', fileName);
        return { success: true, fileUrl: url, fileName: fileName };
    } catch (e) { return { success: false, error: e.toString() }; }
}
