import initSqlJs from "sql.js";

// --------------------
// IndexedDB persistence
const IDB_DB_NAME = "sololedger";
const IDB_STORE_NAME = "sqlite";

// Cache IndexedDB connection promise for reuse
let idbPromise;

function openIdb() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const dbid = req.result;
        if (!dbid.objectStoreNames.contains(IDB_STORE_NAME)) {
          dbid.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return idbPromise;
}

async function persistLocal() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const data = db.export();
    const req = store.put(data, "db");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadLocal() {
  const idb = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get("db");
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
// --------------------

let SQL, db;

// Schema migrations using PRAGMA user_version
const migrations = [
  {
    version: 1,
    up: (db) => {
      // Initial schema creation is handled via CREATE TABLE IF NOT EXISTS above
    },
  },
  // Future migrations: add { version: X, up: (db) => { ... } }
];

/**
 * Apply pending migrations based on PRAGMA user_version
 */
function runMigrations() {
  const result = db.exec("PRAGMA user_version");
  const currentVersion = result[0]?.values[0][0] || 0;
  for (const m of migrations) {
    if (m.version > currentVersion) {
      m.up(db);
      db.run(`PRAGMA user_version = ${m.version}`);
    }
  }
}

export async function initSql() {
  try {
    SQL = await initSqlJs({
      locateFile: (file) => `${import.meta.env.BASE_URL}${file}`,
    });
    // Try to load a cached DB from IndexedDB, otherwise create new
    let loaded = false;
    try {
      loaded = await loadLocal();
    } catch (e) {
      console.error("Error loading local DB:", e);
    }
    if (!loaded) {
      db = new SQL.Database();
    }
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

    // Apply schema migrations based on PRAGMA user_version
    runMigrations();

    return true;
  } catch (error) {
    console.error("Error initializing SQL database:", error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

export function loadDb(data) {
  db = new SQL.Database(data);
}
// Execute the given function within a transaction, committing on success and rolling back on error
export function withTransaction(fn) {
  db.run("BEGIN");
  try {
    const result = fn(db);
    db.run("COMMIT");
    return result;
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

export function saveClient(obj) {
  withTransaction(() => {
    if (obj.id) {
      // Update existing client
      const stmt = db.prepare(
        "UPDATE clients SET name = ?, email = ?, address = ? WHERE id = ?"
      );
      try {
        stmt.run([obj.name, obj.email, obj.address, obj.id]);
      } finally {
        stmt.free();
      }
    } else {
      // Insert new client
      const stmt = db.prepare(
        "INSERT INTO clients (name,email,address) VALUES (?,?,?)"
      );
      try {
        stmt.run([obj.name, obj.email, obj.address]);
      } finally {
        stmt.free();
      }
    }
  });
  // Persist changes locally
  persistLocal().catch((err) => console.error("persistLocal error:", err));
}

export function getClient(id) {
  const stmt = db.prepare(
    "SELECT id, name, email, address FROM clients WHERE id = ?"
  );
  try {
    stmt.bind([id]);
    if (!stmt.step()) {
      return null;
    }
    const row = stmt.get();
    return {
      id: row[0],
      name: row[1],
      email: row[2],
      address: row[3],
    };
  } finally {
    stmt.free();
  }
}

export function deleteClient(id) {
  // Check if client has invoices
  const countStmt = db.prepare(
    "SELECT COUNT(*) FROM invoices WHERE client_id = ?"
  );
  try {
    countStmt.bind([id]);
    let count = 0;
    if (countStmt.step()) {
      count = countStmt.get()[0];
    }
    if (count > 0) {
      throw new Error(
        `Cannot delete client with ID ${id} because it has associated invoices.`
      );
    }
  } finally {
    countStmt.free();
  }

  return withTransaction(() => {
    const stmt = db.prepare("DELETE FROM clients WHERE id = ?");
    try {
      stmt.run([id]);
    } finally {
      stmt.free();
    }
    // Persist changes locally
    persistLocal().catch((err) => console.error("persistLocal error:", err));
  });
}

export function listClients() {
  const res = db.exec(
    "SELECT id,name,email,address FROM clients ORDER BY name"
  );
  return res.length ? res[0].values : [];
}

export function saveInvoice(header, items) {
  return withTransaction(() => {
    let invoiceId;

    if (header.id) {
      // Update existing invoice
      const stmt = db.prepare(
        "UPDATE invoices SET number = ?, date = ?, client_id = ?, total = ? WHERE id = ?"
      );
      try {
        stmt.run([
          header.number,
          header.date,
          header.clientId,
          header.total,
          header.id,
        ]);
      } finally {
        stmt.free();
      }

      // Delete existing items
      const deleteStmt = db.prepare(
        "DELETE FROM invoice_items WHERE invoice_id = ?"
      );
      try {
        deleteStmt.run([header.id]);
      } finally {
        deleteStmt.free();
      }

      invoiceId = header.id;
    } else {
      // Insert new invoice
      const stmt = db.prepare(
        "INSERT INTO invoices (number,date,client_id,total) VALUES (?,?,?,?)"
      );
      try {
        stmt.run([header.number, header.date, header.clientId, header.total]);
      } finally {
        stmt.free();
      }
      invoiceId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
    }

    // Insert new items
    const itemStmt = db.prepare(
      "INSERT INTO invoice_items (invoice_id,description,qty,unit) VALUES (?,?,?,?)"
    );
    try {
      for (const it of items) {
        itemStmt.run([invoiceId, it.description, it.qty, it.unit]);
      }
    } finally {
      itemStmt.free();
    }

    // Persist changes locally
    persistLocal().catch((err) => console.error("persistLocal error:", err));
    return invoiceId;
  });
}

export function deleteInvoice(id) {
  return withTransaction(() => {
    // First delete invoice items
    const deleteItemsStmt = db.prepare(
      "DELETE FROM invoice_items WHERE invoice_id = ?"
    );
    try {
      deleteItemsStmt.run([id]);
    } finally {
      deleteItemsStmt.free();
    }

    // Then delete the invoice
    const deleteInvoiceStmt = db.prepare(
      "DELETE FROM invoices WHERE id = ?"
    );
    try {
      deleteInvoiceStmt.run([id]);
    } finally {
      deleteInvoiceStmt.free();
    }

    // Persist changes locally
    persistLocal().catch((err) => console.error("persistLocal error:", err));
  });
}

export function listInvoices() {
  const sql = `SELECT inv.id, inv.number, inv.date, c.name, inv.total
               FROM invoices inv JOIN clients c ON c.id = inv.client_id
               ORDER BY inv.date DESC`;
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

export function getInvoiceWithItems(id) {
  // Get invoice header
  const headStmt = db.prepare(
    "SELECT inv.number, inv.date, c.name, inv.total\n" +
      "FROM invoices inv JOIN clients c ON c.id = inv.client_id WHERE inv.id = ?"
  );
  let headRow;
  try {
    headStmt.bind([id]);
    if (!headStmt.step()) {
      return null;
    }
    headRow = headStmt.get();
  } finally {
    headStmt.free();
  }

  // Get invoice items
  const itemsStmt = db.prepare(
    "SELECT description, qty, unit FROM invoice_items WHERE invoice_id = ?"
  );
  const items = [];
  try {
    itemsStmt.bind([id]);
    while (itemsStmt.step()) {
      const row = itemsStmt.get();
      items.push({
        description: row[0],
        qty: row[1],
        unit: row[2],
      });
    }
  } finally {
    itemsStmt.free();
  }

  return {
    header: {
      number: headRow[0],
      date: headRow[1],
      client: headRow[2],
      total: headRow[3],
    },
    items,
  };
}

export async function exportDb() {
  return db.export();
}

// Debounce utility to limit function calls
function debounce(fn, ms) {
  let timeout = null;
  let pendingResolvers = [];
  return function(...args) {
    return new Promise((resolve) => {
      pendingResolvers.push(resolve);
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(async () => {
        timeout = null;
        const resolvers = pendingResolvers;
        pendingResolvers = [];
        let result;
        try {
          result = await fn(...args);
        } catch (err) {
          resolvers.forEach((r) => r(false));
          return;
        }
        resolvers.forEach((r) => r(result));
      }, ms);
    });
  };
}

// Refresh the access token silently if possible
async function refreshAccessTokenIfNeeded() {
  if (window.tokenClient) {
    return new Promise((resolve) => {
      window.tokenClient.requestAccessToken({ prompt: 'none' });
      const interval = setInterval(() => {
        if (gapi.client.getToken()) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }
}

// Actual sync implementation using Drive v3 client API
async function syncDbToDriveImpl(driveFileId) {
  if (!driveFileId) return false;

  await refreshAccessTokenIfNeeded();

  try {
    const blob = new Blob([await exportDb()], { type: 'application/x-sqlite3' });
    await gapi.client.drive.files.update({
      fileId: driveFileId,
      uploadType: 'media',
      media: { mimeType: 'application/x-sqlite3', body: blob },
    });
    return true;
  } catch (error) {
    console.error('Error syncing to Google Drive:', error);
    // If unauthorized, request a new token with consent and retry once
    if (error.status === 401 && window.tokenClient) {
      try {
        window.tokenClient.requestAccessToken({ prompt: 'consent' });
        await refreshAccessTokenIfNeeded();
        await gapi.client.drive.files.update({
          fileId: driveFileId,
          uploadType: 'media',
          media: { mimeType: 'application/x-sqlite3', body: blob },
        });
        return true;
      } catch (retryError) {
        console.error('Retry syncing to Google Drive failed:', retryError);
      }
    }
    return false;
  }
}

// Debounced export for use in event handlers (2-second delay)
export const syncDbToDrive = debounce(syncDbToDriveImpl, 2000);
