import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

// IndexedDB persistence (works in Web Worker)
const IDB_DB_NAME = 'sololedger';
const IDB_STORE_NAME = 'sqlite';

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistLocal() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const data = db.export();
    const req = store.put(data, 'db');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadLocal() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get('db');
    req.onsuccess = () => {
      const data = req.result;
      if (data) {
        loadDb(data);
        resolve(true);
      } else {
        resolve(false);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

let SQL, db;

// Schema migrations using PRAGMA user_version
const migrations = [
  { version: 1, up: (db) => { /* initial schema created in initSql */ } },
];

function runMigrations() {
  const res = db.exec('PRAGMA user_version');
  const current = res[0]?.values[0][0] || 0;
  for (const m of migrations) {
    if (m.version > current) {
      m.up(db);
      db.run(`PRAGMA user_version = ${m.version}`);
    }
  }
}

// Initialize SQL.js and local database
async function initSql() {
  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl
  });
  let loaded = false;
  try {
    loaded = await loadLocal();
  } catch (e) {
    console.error('Error loading local DB:', e);
  }
  if (!loaded) {
    db = new SQL.Database();
  }
  db.run('PRAGMA foreign_keys = ON;');
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
  runMigrations();
  return true;
}

function loadDb(data) {
  db = new SQL.Database(data);
  db.run('PRAGMA foreign_keys = ON;');
  runMigrations();
  return true;
}

function withTransaction(fn) {
  db.run('BEGIN');
  try {
    const res = fn(db);
    db.run('COMMIT');
    return res;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

function listClients() {
  const res = db.exec('SELECT id, name, email, address FROM clients ORDER BY name');
  return res.length ? res[0].values : [];
}

function listInvoices() {
  const sql = `SELECT inv.id, inv.number, inv.date, c.name, inv.total
               FROM invoices inv JOIN clients c ON c.id = inv.client_id
               ORDER BY inv.date DESC`;
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

function getClient(id) {
  const stmt = db.prepare('SELECT id, name, email, address FROM clients WHERE id = ?');
  try {
    stmt.bind([id]);
    if (!stmt.step()) return null;
    const row = stmt.get();
    return { id: row[0], name: row[1], email: row[2], address: row[3] };
  } finally {
    stmt.free();
  }
}

function deleteClient(id) {
  // ensure no invoices
  const countStmt = db.prepare('SELECT COUNT(*) FROM invoices WHERE client_id = ?');
  try {
    countStmt.bind([id]);
    const count = countStmt.step() ? countStmt.get()[0] : 0;
    if (count > 0) throw new Error(`Cannot delete client ${id}: has invoices`);
  } finally { countStmt.free(); }
  return withTransaction(() => {
    const stmt = db.prepare('DELETE FROM clients WHERE id = ?');
    try { stmt.run([id]); } finally { stmt.free(); }
    persistLocal().catch(() => {});
  });
}

function saveClient(obj) {
  return withTransaction(() => {
    if (obj.id) {
      const stmt = db.prepare('UPDATE clients SET name=?, email=?, address=? WHERE id=?');
      try { stmt.run([obj.name, obj.email, obj.address, obj.id]); } finally { stmt.free(); }
    } else {
      const stmt = db.prepare('INSERT INTO clients (name,email,address) VALUES (?,?,?)');
      try { stmt.run([obj.name, obj.email, obj.address]); } finally { stmt.free(); }
    }
    persistLocal().catch(() => {});
  });
}

function exportDb() {
  return db.export();
}

function deleteInvoice(id) {
  return withTransaction(() => {
    const delItems = db.prepare('DELETE FROM invoice_items WHERE invoice_id=?');
    try { delItems.run([id]); } finally { delItems.free(); }
    const delInv = db.prepare('DELETE FROM invoices WHERE id=?');
    try { delInv.run([id]); } finally { delInv.free(); }
    persistLocal().catch(() => {});
  });
}

function saveInvoice(header, items) {
  return withTransaction(() => {
    let invoiceId;
    if (header.id) {
      const stmt = db.prepare('UPDATE invoices SET number=?, date=?, client_id=?, total=? WHERE id=?');
      try { stmt.run([header.number, header.date, header.clientId, header.total, header.id]); } finally { stmt.free(); }
      const del = db.prepare('DELETE FROM invoice_items WHERE invoice_id=?');
      try { del.run([header.id]); } finally { del.free(); }
      invoiceId = header.id;
    } else {
      const stmt = db.prepare('INSERT INTO invoices (number,date,client_id,total) VALUES (?,?,?,?)');
      try { stmt.run([header.number, header.date, header.clientId, header.total]); } finally { stmt.free(); }
      invoiceId = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
    }
    const itemStmt = db.prepare('INSERT INTO invoice_items (invoice_id,description,qty,unit) VALUES (?,?,?,?)');
    try { items.forEach(it => itemStmt.run([invoiceId, it.description, it.qty, it.unit])); } finally { itemStmt.free(); }
    persistLocal().catch(() => {});
    return invoiceId;
  });
}

function getInvoiceWithItems(id) {
  const headStmt = db.prepare(
    'SELECT inv.number, inv.date, c.name, inv.total FROM invoices inv JOIN clients c ON c.id=inv.client_id WHERE inv.id=?'
  );
  let header;
  try {
    headStmt.bind([id]); headStmt.step();
    const h = headStmt.get();
    header = { number: h[0], date: h[1], client: h[2], total: h[3] };
  } finally { headStmt.free(); }
  const itemsStmt = db.prepare('SELECT description, qty, unit FROM invoice_items WHERE invoice_id=?');
  const items = [];
  try { itemsStmt.bind([id]); while (itemsStmt.step()) items.push({ description: itemsStmt.get()[0], qty: itemsStmt.get()[1], unit: itemsStmt.get()[2] }); }
  finally { itemsStmt.free(); }
  return { header, items };
}

// RPC message handler
const methods = {
  initSql, loadDb, listClients, listInvoices, getClient, deleteClient,
  saveClient, exportDb, deleteInvoice, saveInvoice, getInvoiceWithItems
};

onmessage = async (e) => {
  const { id, method, params } = e.data;
  try {
    const result = await methods[method](...params);
    if (result instanceof Uint8Array) {
      postMessage({ id, result }, [result.buffer]);
    } else {
      postMessage({ id, result });
    }
  } catch (err) {
    postMessage({ id, error: err.message || err.toString() });
  }
};