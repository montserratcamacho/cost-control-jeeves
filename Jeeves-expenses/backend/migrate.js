const Database = require('C:/Users/compu/Documents/Jeeves-expenses/Jeeves-expenses/backend/node_modules/better-sqlite3');
const db = new Database('C:/Users/compu/Documents/Jeeves-expenses/Jeeves-expenses/backend/jeeves.db');

try {
  db.exec("ALTER TABLE transactions ADD COLUMN needs_validation INTEGER DEFAULT 0;");
  console.log("Column needs_validation added successfully.");
} catch (error) {
  if (error.message.includes("duplicate column name")) {
    console.log("Column already exists.");
  } else {
    console.error("ERROR:", error.message);
  }
}
db.close();
