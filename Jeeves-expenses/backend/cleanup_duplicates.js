const db = require('./database');
const duplicates = db.prepare("SELECT unique_id FROM transactions WHERE unique_id LIKE 'card_%' OR unique_id LIKE 'payment_%'").all();
console.log(`Encontrados ${duplicates.length} duplicados.`);
if (duplicates.length > 0) {
    const deleteStmt = db.prepare('DELETE FROM transactions WHERE unique_id = ?');
    db.transaction((ids) => {
        for (const row of ids) deleteStmt.run(row.unique_id);
    })(duplicates);
    console.log('Duplicados eliminados correctamente.');
}
db.close();