import initSqlJs from 'sql.js';

let SQL, db;

export async function initSql() {
  try {
    SQL = await initSqlJs({
      locateFile: file => `${import.meta.env.BASE_URL}${file}`
    });
    
    db = new SQL.Database();
    db.run(`PRAGMA foreign_keys = ON;`);
    db.run(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      address TEXT
    );`);
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL,
      date TEXT NOT NULL,
      client_id INTEGER NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );`);
    db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT,
      qty REAL,
      unit REAL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );`);
    
    return true;
  } catch (error) {
    console.error('Error initializing SQL database:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

export function loadDb(data) {
  db = new SQL.Database(data);
}

export function saveClient(obj) {
  if (obj.id) {
    // Update existing client
    const stmt = db.prepare(
      "UPDATE clients SET name = ?, email = ?, address = ? WHERE id = ?"
    );
    stmt.run([obj.name, obj.email, obj.address, obj.id]);
    stmt.free();
  } else {
    // Insert new client
    const stmt = db.prepare(
      "INSERT INTO clients (name,email,address) VALUES (?,?,?)"
    );
    stmt.run([obj.name, obj.email, obj.address]);
    stmt.free();
  }
  // Persist changes locally
  persistLocal().catch(err => console.error('persistLocal error:', err));
}

export function getClient(id) {
  const result = db.exec(`SELECT id, name, email, address FROM clients WHERE id = ${id}`);
  if (result.length === 0 || result[0].values.length === 0) {
    return null;
  }
  const row = result[0].values[0];
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    address: row[3]
  };
}

export function deleteClient(id) {
  // Check if client has invoices
  const invoicesCheck = db.exec(`SELECT COUNT(*) FROM invoices WHERE client_id = ${id}`);
  const count = invoicesCheck[0].values[0][0];
  
  if (count > 0) {
    throw new Error(`Cannot delete client with ID ${id} because it has associated invoices.`);
  }
  
  const stmt = db.prepare("DELETE FROM clients WHERE id = ?");
  stmt.run([id]);
  stmt.free();
  // Persist changes locally
  persistLocal().catch(err => console.error('persistLocal error:', err));
}

export function listClients() {
  const res = db.exec(
    "SELECT id,name,email,address FROM clients ORDER BY name"
  );
  return res.length ? res[0].values : [];
}

export function saveInvoice(header, items) {
  let invoiceId;
  
  if (header.id) {
    // Update existing invoice
    const stmt = db.prepare(
      "UPDATE invoices SET number = ?, date = ?, client_id = ?, total = ? WHERE id = ?"
    );
    stmt.run([header.number, header.date, header.clientId, header.total, header.id]);
    stmt.free();
    
    // Delete existing items
    const deleteStmt = db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
    deleteStmt.run([header.id]);
    deleteStmt.free();
    
    invoiceId = header.id;
  } else {
    // Insert new invoice
    const stmt = db.prepare(
      "INSERT INTO invoices (number,date,client_id,total) VALUES (?,?,?,?)"
    );
    stmt.run([header.number, header.date, header.clientId, header.total]);
    invoiceId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
  }
  
  // Insert new items
  const itemStmt = db.prepare(
    "INSERT INTO invoice_items (invoice_id,description,qty,unit) VALUES (?,?,?,?)"
  );
  for (const it of items) {
    itemStmt.run([invoiceId, it.description, it.qty, it.unit]);
  }
  itemStmt.free();
  // Persist changes locally
  persistLocal().catch(err => console.error('persistLocal error:', err));
  return invoiceId;
}

export function deleteInvoice(id) {
  // First delete invoice items
  const deleteItemsStmt = db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
  deleteItemsStmt.run([id]);
  deleteItemsStmt.free();
  
  // Then delete the invoice
  const deleteInvoiceStmt = db.prepare("DELETE FROM invoices WHERE id = ?");
  deleteInvoiceStmt.run([id]);
  deleteInvoiceStmt.free();
  // Persist changes locally
  persistLocal().catch(err => console.error('persistLocal error:', err));
}

export function listInvoices() {
  const sql = `SELECT inv.id, inv.number, inv.date, c.name, inv.total
               FROM invoices inv JOIN clients c ON c.id = inv.client_id
               ORDER BY inv.date DESC`;
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

export function getInvoiceWithItems(id) {
  const head = db.exec(`SELECT inv.number, inv.date, c.name, inv.total
                        FROM invoices inv JOIN clients c ON c.id=inv.client_id WHERE inv.id=${id}`)[0]
    .values[0];
  const itemsRows = db.exec(
    `SELECT description, qty, unit FROM invoice_items WHERE invoice_id=${id}`
  );
  const items = itemsRows.length
    ? itemsRows[0].values.map((r) => ({
        description: r[0],
        qty: r[1],
        unit: r[2],
      }))
    : [];
  return {
    header: {
      number: head[0],
      date: head[1],
      client: head[2],
      total: head[3],
    },
    items,
  };
}

export async function exportDb() {
  return db.export();
}

export async function syncDbToDrive(driveFileId) {
  if (!driveFileId) return;
  
  try {
    const blob = new Blob([await exportDb()], {
      type: "application/x-sqlite3",
    });
    
    await gapi.client.request({
      path: `upload/drive/v3/files/${driveFileId}`,
      method: "PATCH",
      params: { uploadType: "media" },
      headers: { "Content-Type": "application/x-sqlite3" },
      body: blob,
    });
    
    return true;
  } catch (error) {
    console.error('Error syncing to Google Drive:', error);
    // Don't show alert here since this is called from other functions
    return false;
  }
}