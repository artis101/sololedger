import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import {
  Client,
  Invoice,
  InvoiceItem,
  BusinessSettings,
  RpcRequest,
  RpcResponse,
  SqlModule,
  SqlDatabase,
} from "./types";

// IndexedDB persistence (works in Web Worker)
const IDB_DB_NAME = "sololedger";
const IDB_STORE_NAME = "sqlite";

function openIdb(): Promise<IDBDatabase> {
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

async function persistLocal(): Promise<void> {
  const idb = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const data = db.export();
    const req = store.put(data, "db");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function loadLocal(): Promise<boolean> {
  const idb = await openIdb();
  return new Promise<boolean>((resolve, reject) => {
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

let SQL: SqlModule;
let db: SqlDatabase;

interface Migration {
  version: number;
  up: (db: SqlDatabase) => void;
}

// Schema migrations using PRAGMA user_version
const migrations: Migration[] = [
  {
    version: 1,
    up: (db: SqlDatabase) => {
      /* initial schema created in initSql */
    },
  },
  {
    version: 2,
    up: (db: SqlDatabase) => {
      // Add tax_id column to clients table
      db.run(`ALTER TABLE clients ADD COLUMN tax_id TEXT;`);
    },
  },
];

function runMigrations(): void {
  const res = db.exec("PRAGMA user_version");
  const current = res[0]?.values[0][0] || 0;
  for (const m of migrations) {
    if (m.version > current) {
      m.up(db);
      db.run(`PRAGMA user_version = ${m.version}`);
    }
  }
}

// Initialize SQL.js and local database
async function initSql(): Promise<boolean> {
  SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });
  let loaded = false;
  try {
    loaded = await loadLocal();
  } catch (e) {
    console.error("Error loading local DB:", e);
  }
  if (!loaded) {
    db = new SQL.Database();
  }
  db.run("PRAGMA foreign_keys = ON;");
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
      paid INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      locked_at TEXT,
      paid_at TEXT,
      sent_at TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id)
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      description TEXT,
      qty REAL,
      unit REAL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS invoice_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY,
      businessName TEXT,
      tradingName TEXT,
      businessAddress TEXT,
      businessEmail TEXT,
      businessPhone TEXT,
      taxId TEXT,
      taxRate REAL,
      bankName TEXT,
      accountName TEXT,
      accountNumber TEXT,
      swiftCode TEXT,
      currency TEXT DEFAULT 'EUR',
      paymentTerms TEXT,
      invoiceNote TEXT,
      lastUpdated TEXT,
      invoice_number_format TEXT DEFAULT 'INV-{YEAR}-{SEQ}',
      invoice_number_counter INTEGER DEFAULT 1,
      invoice_number_padding INTEGER DEFAULT 4,
      invoice_number_prefix TEXT DEFAULT '',
      invoice_number_reset TEXT DEFAULT 'yearly',
      invoice_number_last_reset TEXT
  );`);
  runMigrations();
  return true;
}

function loadDb(data: Uint8Array): boolean {
  db = new SQL.Database(data);
  db.run("PRAGMA foreign_keys = ON;");
  runMigrations();
  return true;
}

function withTransaction<T>(fn: (db: SqlDatabase) => T): T {
  db.run("BEGIN");
  try {
    const res = fn(db);
    db.run("COMMIT");
    return res;
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

function listClients(): any[] {
  const res = db.exec(
    "SELECT id, name, email, address, tax_id FROM clients ORDER BY name"
  );
  return res.length ? res[0].values : [];
}

function listInvoices(): any[] {
  const sql = `SELECT inv.id, inv.number, inv.date, c.name, inv.total, inv.paid, inv.locked,
               inv.locked_at, inv.paid_at, inv.sent_at
               FROM invoices inv JOIN clients c ON c.id = inv.client_id
               ORDER BY inv.date DESC`;
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

function getClient(id: number): Client | null {
  const stmt = db.prepare(
    "SELECT id, name, email, address, tax_id FROM clients WHERE id = ?"
  );
  try {
    stmt.bind([id]);
    if (!stmt.step()) return null;
    const row = stmt.get();
    return { id: row[0], name: row[1], email: row[2], address: row[3], taxId: row[4] };
  } finally {
    stmt.free();
  }
}

function deleteClient(id: number): void {
  // ensure no invoices
  const countStmt = db.prepare(
    "SELECT COUNT(*) FROM invoices WHERE client_id = ?"
  );
  try {
    countStmt.bind([id]);
    const count = countStmt.step() ? countStmt.get()[0] : 0;
    if (count > 0) throw new Error(`Cannot delete client ${id}: has invoices`);
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
    persistLocal().catch(() => {});
  });
}

function saveClient(obj: Client): number {
  return withTransaction(() => {
    if (obj.id) {
      const stmt = db.prepare(
        "UPDATE clients SET name=?, email=?, address=?, tax_id=? WHERE id=?"
      );
      try {
        stmt.run([obj.name, obj.email, obj.address, obj.taxId, obj.id]);
      } finally {
        stmt.free();
      }
    } else {
      const stmt = db.prepare(
        "INSERT INTO clients (name,email,address,tax_id) VALUES (?,?,?,?)"
      );
      try {
        stmt.run([obj.name, obj.email, obj.address, obj.taxId]);
      } finally {
        stmt.free();
      }
    }
    persistLocal().catch(() => {});
    return obj.id || 0;
  });
}

function exportDb(): Uint8Array {
  return db.export();
}

function deleteInvoice(id: number): void {
  return withTransaction(() => {
    // With ON DELETE CASCADE, we only need to delete the invoice
    // and all related items will be automatically deleted
    const delInv = db.prepare("DELETE FROM invoices WHERE id=?");
    try {
      delInv.run([id]);
    } finally {
      delInv.free();
    }
    persistLocal().catch(() => {});
  });
}

interface InvoiceWithForceOption extends Invoice {
  forceSave?: boolean;
  forceSaveReason?: string;
}

function saveInvoice(
  header: InvoiceWithForceOption,
  items: InvoiceItem[]
): number {
  return withTransaction(() => {
    // Validate required fields
    if (!header.number) {
      throw new Error("Invoice number is required");
    }
    if (!header.date) {
      throw new Error("Invoice date is required");
    }
    if (!header.client_id || header.client_id <= 0) {
      throw new Error("Valid client selection is required");
    }
    
    // Calculate the total from items to ensure consistency
    const calculatedTotal = items.reduce(
      (sum, item) => sum + (item.qty || 0) * (item.unit || 0),
      0
    );

    let invoiceId: number;
    if (header.id) {
      // Check if invoice is locked before allowing updates
      const isLocked = getLockedStatus(header.id);
      if (isLocked) {
        if (header.forceSave) {
          // Log forced edit of locked invoice
          logInvoiceAudit(header.id, "forced_edit", {
            reason: header.forceSaveReason || "No reason provided",
            timestamp: new Date().toISOString(),
          });
        } else {
          throw new Error(
            "Invoice is locked. Unlock it first or use forceSave option to override."
          );
        }
      }

      // Preserve paid status when updating if not explicitly set
      const existingPaidStatus =
        header.paid !== undefined ? header.paid : getPaidStatus(header.id);
      // Preserve locked status when updating if not explicitly set
      const existingLockedStatus =
        header.locked !== undefined
          ? header.locked
          : getLockedStatus(header.id);

      const stmt = db.prepare(
        "UPDATE invoices SET number=?, date=?, client_id=?, total=?, paid=?, locked=? WHERE id=?"
      );
      try {
        stmt.run([
          header.number,
          header.date,
          header.client_id,
          calculatedTotal, // Use calculated total instead of header.total
          existingPaidStatus,
          existingLockedStatus,
          header.id,
        ]);
      } finally {
        stmt.free();
      }
      const del = db.prepare("DELETE FROM invoice_items WHERE invoice_id=?");
      try {
        del.run([header.id]);
      } finally {
        del.free();
      }
      invoiceId = header.id;
    } else {
      const stmt = db.prepare(
        "INSERT INTO invoices (number,date,client_id,total,paid,locked) VALUES (?,?,?,?,?,?)"
      );
      try {
        // For new invoices, use the provided paid status or default to 0 (unpaid)
        const paidStatus = header.paid !== undefined ? header.paid : 0;
        // For new invoices, use the provided locked status or default to 0 (unlocked)
        const lockedStatus = header.locked !== undefined ? header.locked : 0;
        stmt.run([
          header.number,
          header.date,
          header.client_id,
          calculatedTotal,
          paidStatus,
          lockedStatus,
        ]); // Use calculated total
      } finally {
        stmt.free();
      }
      invoiceId = db.exec("SELECT last_insert_rowid() AS id")[0].values[0][0];
    }
    const itemStmt = db.prepare(
      "INSERT INTO invoice_items (invoice_id,description,qty,unit) VALUES (?,?,?,?)"
    );
    try {
      items.forEach((it) => {
        // Validate and ensure values are not undefined
        const description = it.description || '';
        const qty = it.qty !== undefined && it.qty !== null ? it.qty : 0;
        const unit = it.unit !== undefined && it.unit !== null ? it.unit : 0;
        
        itemStmt.run([invoiceId, description, qty, unit]);
      });
    } finally {
      itemStmt.free();
    }
    persistLocal().catch(() => {});
    return invoiceId;
  });
}

interface InvoiceDetails {
  header: {
    number: string;
    date: string;
    client: string;
    clientTaxId: string | null;
    total: number;
    paid: number;
    locked: number;
    lockedAt: string | null;
    paidAt: string | null;
    sentAt: string | null;
  };
  items: {
    description: string;
    qty: number;
    unit: number;
  }[];
}

function getInvoiceWithItems(id: number): InvoiceDetails {
  const headStmt = db.prepare(
    `SELECT inv.number, inv.date, c.name, c.tax_id, inv.total, inv.paid, inv.locked,
     inv.locked_at, inv.paid_at, inv.sent_at 
     FROM invoices inv JOIN clients c ON c.id=inv.client_id WHERE inv.id=?`
  );
  let header;
  try {
    headStmt.bind([id]);
    headStmt.step();
    const h = headStmt.get();
    header = {
      number: h[0],
      date: h[1],
      client: h[2],
      clientTaxId: h[3],
      total: h[4],
      paid: h[5],
      locked: h[6],
      lockedAt: h[7],
      paidAt: h[8],
      sentAt: h[9],
    };
  } finally {
    headStmt.free();
  }
  const itemsStmt = db.prepare(
    "SELECT description, qty, unit FROM invoice_items WHERE invoice_id=?"
  );
  const items: { description: string; qty: number; unit: number }[] = [];
  try {
    itemsStmt.bind([id]);
    while (itemsStmt.step())
      items.push({
        description: itemsStmt.get()[0],
        qty: itemsStmt.get()[1],
        unit: itemsStmt.get()[2],
      });
  } finally {
    itemsStmt.free();
  }
  return { header, items };
}

function wipeDatabase(): boolean {
  return withTransaction(() => {
    // Drop existing tables to completely clean the database
    db.run("DROP TABLE IF EXISTS invoice_items");
    db.run("DROP TABLE IF EXISTS invoices");
    db.run("DROP TABLE IF EXISTS clients");
    db.run("DROP TABLE IF EXISTS business_settings");

    // Recreate the schema (copied from initSql)
    db.run("PRAGMA foreign_keys = ON;");
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
        paid INTEGER DEFAULT 0,
        locked INTEGER DEFAULT 0,
        locked_at TEXT,
        paid_at TEXT,
        sent_at TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
    );`);
    db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        description TEXT,
        qty REAL,
        unit REAL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );`);

    db.run(`CREATE TABLE IF NOT EXISTS invoice_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    );`);
    db.run(`CREATE TABLE IF NOT EXISTS business_settings (
        id INTEGER PRIMARY KEY,
        businessName TEXT,
        tradingName TEXT,
        businessAddress TEXT,
        businessEmail TEXT,
        businessPhone TEXT,
        taxId TEXT,
        taxRate REAL,
        bankName TEXT,
        accountName TEXT,
        accountNumber TEXT,
        swiftCode TEXT,
        currency TEXT DEFAULT 'EUR',
        paymentTerms TEXT,
        invoiceNote TEXT,
        lastUpdated TEXT,
        invoice_number_format TEXT DEFAULT 'INV-{YEAR}-{SEQ}',
        invoice_number_counter INTEGER DEFAULT 1,
        invoice_number_padding INTEGER DEFAULT 4,
        invoice_number_prefix TEXT DEFAULT '',
        invoice_number_reset TEXT DEFAULT 'yearly',
        invoice_number_last_reset TEXT
    );`);

    // Reset user_version to current migration level
    const latestMigration = migrations.reduce(
      (max, m) => Math.max(max, m.version),
      0
    );
    db.run(`PRAGMA user_version = ${latestMigration}`);

    // Persist the empty database with new structure
    persistLocal().catch(() => {});

    return true;
  });
}

// Get paid status for an invoice
function getPaidStatus(invoiceId: number): number {
  try {
    const stmt = db.prepare("SELECT paid FROM invoices WHERE id = ?");
    stmt.bind([invoiceId]);
    if (stmt.step()) {
      return stmt.get()[0];
    }
    return 0; // Default to unpaid if not found
  } catch (error) {
    console.error("Error getting paid status:", error);
    return 0;
  }
}

// Toggle the paid status of an invoice
function toggleInvoicePaid(id: number): {
  status: number;
  paidAt: string | null;
} {
  return withTransaction(() => {
    // Get current paid status
    const currentStatus = getPaidStatus(id);
    // Toggle it (1 becomes 0, 0 becomes 1)
    const newStatus = currentStatus ? 0 : 1;

    // If marking as paid, set the paid_at timestamp
    // If marking as unpaid, clear the paid_at timestamp
    const paidAt = newStatus ? new Date().toISOString() : null;

    const stmt = db.prepare(
      "UPDATE invoices SET paid = ?, paid_at = ? WHERE id = ?"
    );
    try {
      stmt.run([newStatus, paidAt, id]);
    } finally {
      stmt.free();
    }

    persistLocal().catch(() => {});
    return { status: newStatus, paidAt };
  });
}

// Get locked status for an invoice
function getLockedStatus(invoiceId: number): number {
  try {
    const stmt = db.prepare("SELECT locked FROM invoices WHERE id = ?");
    stmt.bind([invoiceId]);
    if (stmt.step()) {
      return stmt.get()[0];
    }
    return 0; // Default to unlocked if not found
  } catch (error) {
    console.error("Error getting locked status:", error);
    return 0;
  }
}

// Add an entry to the invoice audit log
function logInvoiceAudit(
  invoiceId: number,
  action: string,
  details: any = null
): boolean {
  try {
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(
      "INSERT INTO invoice_audit (invoice_id, timestamp, action, details) VALUES (?, ?, ?, ?)"
    );
    stmt.run([
      invoiceId,
      timestamp,
      action,
      details ? JSON.stringify(details) : null,
    ]);
    stmt.free();
    return true;
  } catch (error) {
    console.error("Error logging invoice audit:", error);
    return false;
  }
}

// Get audit records for an invoice
function getInvoiceAudit(invoiceId: number): any[] {
  try {
    const sql = `SELECT id, invoice_id, timestamp, action, details 
                 FROM invoice_audit 
                 WHERE invoice_id = ? 
                 ORDER BY timestamp DESC`;
    const stmt = db.prepare(sql);
    stmt.bind([invoiceId]);

    const results = [];
    while (stmt.step()) {
      const row = stmt.get();
      results.push({
        id: row[0],
        invoiceId: row[1],
        timestamp: row[2],
        action: row[3],
        details: row[4] ? JSON.parse(row[4]) : null,
      });
    }
    stmt.free();
    return results;
  } catch (error) {
    console.error("Error getting invoice audit:", error);
    return [];
  }
}

// Toggle the locked status of an invoice
function toggleInvoiceLocked(id: number): {
  status: number;
  lockedAt: string | null;
} {
  return withTransaction(() => {
    // Get current locked status
    const currentStatus = getLockedStatus(id);
    // Toggle it (1 becomes 0, 0 becomes 1)
    const newStatus = currentStatus ? 0 : 1;

    // If marking as locked, set the locked_at timestamp
    // If unlocking, clear the locked_at timestamp
    const lockedAt = newStatus ? new Date().toISOString() : null;

    const stmt = db.prepare(
      "UPDATE invoices SET locked = ?, locked_at = ? WHERE id = ?"
    );
    try {
      stmt.run([newStatus, lockedAt, id]);

      // Log the change to audit trail
      logInvoiceAudit(id, newStatus ? "locked" : "unlocked");
    } finally {
      stmt.free();
    }

    persistLocal().catch(() => {});
    return { status: newStatus, lockedAt };
  });
}

// Mark an invoice as sent
function markInvoiceSent(id: number): string {
  return withTransaction(() => {
    const now = new Date().toISOString();

    // Only update sent_at if it's not already set
    const stmt = db.prepare(`
      UPDATE invoices 
      SET sent_at = CASE WHEN sent_at IS NULL THEN ? ELSE sent_at END 
      WHERE id = ?
    `);

    try {
      stmt.run([now, id]);

      // Also log to audit trail
      logInvoiceAudit(id, "sent", { sentAt: now });
    } finally {
      stmt.free();
    }

    persistLocal().catch(() => {});
    return now;
  });
}

// Check if an invoice number is already in use
function isInvoiceNumberUnique(
  number: string,
  excludeId: number | null = null
): boolean {
  try {
    let sql = "SELECT COUNT(*) FROM invoices WHERE number = ?";
    const params: any[] = [number];

    // If excluding a specific invoice ID (for updates)
    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    const stmt = db.prepare(sql);
    stmt.bind(params);
    stmt.step();
    const count = stmt.get()[0];
    stmt.free();

    return count === 0; // Return true if unique (count is 0)
  } catch (error) {
    console.error("Error checking invoice number uniqueness:", error);
    return false; // Assume not unique on error (safer)
  }
}

// Parse invoice number format and generate the next invoice number
function generateNextInvoiceNumber(): string {
  return withTransaction(() => {
    // Get business settings for invoice numbering
    const settings = getBusinessSettings();
    if (!settings) {
      return "INV-0001"; // Default if no settings exist
    }

    // Extract numbering settings
    const format = settings.invoice_number_format || "INV-{YEAR}-{SEQ}";
    const prefix = settings.invoice_number_prefix || "";
    const padding = settings.invoice_number_padding || 4;
    let counter = settings.invoice_number_counter || 1;
    const resetOption = settings.invoice_number_reset || "yearly";
    let lastReset = settings.invoice_number_last_reset;

    // Check if counter needs to be reset
    const now = new Date();
    const currentDateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

    // Reset logic - for both with and without last reset date
    if (!lastReset) {
      // No last reset date, set it now
      lastReset = currentDateStr;
    } else {
      const lastResetDate = new Date(lastReset);

      if (resetOption === "yearly") {
        // Reset if the year has changed
        if (lastResetDate.getFullYear() < now.getFullYear()) {
          counter = 1;
          lastReset = currentDateStr;
        }
      } else if (resetOption === "monthly") {
        // Reset if the month or year has changed
        if (
          lastResetDate.getFullYear() < now.getFullYear() ||
          (lastResetDate.getFullYear() === now.getFullYear() &&
            lastResetDate.getMonth() < now.getMonth())
        ) {
          counter = 1;
          lastReset = currentDateStr;
        }
      }
      // If 'never', we don't reset the counter
    }

    // Format the variables
    const year = now.getFullYear().toString();
    const shortYear = year.slice(2); // Last two digits
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const paddedCounter = counter.toString().padStart(padding, "0");

    // Parse the format string
    let nextNumber = format
      .replace(/{YEAR}/g, year)
      .replace(/{YY}/g, shortYear)
      .replace(/{MONTH}/g, month)
      .replace(/{SEQ}/g, paddedCounter)
      .replace(/{PREFIX}/g, prefix);

    // Update the counter for next time
    const stmt = db.prepare(
      "UPDATE business_settings SET invoice_number_counter = ?, invoice_number_last_reset = ? WHERE id = 1"
    );
    try {
      stmt.run([counter + 1, lastReset]);
    } finally {
      stmt.free();
    }

    persistLocal().catch(() => {});
    return nextNumber;
  });
}

function getBusinessSettings(): BusinessSettings | null {
  const res = db.exec("SELECT * FROM business_settings WHERE id = 1");
  if (!res.length || !res[0].values.length) {
    return null; // No business settings found
  }

  const columns = res[0].columns;
  const values = res[0].values[0];

  // Convert the result to an object
  const settings: BusinessSettings = {};
  columns.forEach((col, index) => {
    (settings as any)[col] = values[index];
  });

  return settings;
}

function saveBusinessSettings(settings: BusinessSettings): boolean {
  return withTransaction(() => {
    // Add current timestamp for lastUpdated
    const now = new Date().toISOString();
    settings.lastUpdated = now;

    // Create column names and placeholders
    const columns = Object.keys(settings).filter((k) => k !== "id");
    const placeholders = columns.map(() => "?");
    const values = columns.map((col) => (settings as any)[col]);

    // Check if a record exists
    const existingRecord = db.exec(
      "SELECT COUNT(*) FROM business_settings WHERE id = 1"
    );
    const exists = existingRecord[0]?.values[0][0] > 0;

    if (exists) {
      // Update existing record
      const setClause = columns.map((col) => `${col} = ?`).join(", ");
      const stmt = db.prepare(
        `UPDATE business_settings SET ${setClause} WHERE id = 1`
      );
      try {
        stmt.run(values);
      } finally {
        stmt.free();
      }
    } else {
      // Insert new record with id=1
      const stmt = db.prepare(
        `INSERT INTO business_settings (id, ${columns.join(", ")}) 
         VALUES (1, ${placeholders.join(", ")})`
      );
      try {
        stmt.run(values);
      } finally {
        stmt.free();
      }
    }

    persistLocal().catch(() => {});
    return true;
  });
}

// RPC message handler
interface Methods {
  [key: string]: (...args: any[]) => any;
}

const methods: Methods = {
  initSql,
  loadDb,
  listClients,
  listInvoices,
  getClient,
  deleteClient,
  saveClient,
  exportDb,
  deleteInvoice,
  saveInvoice,
  getInvoiceWithItems,
  wipeDatabase,
  getBusinessSettings,
  saveBusinessSettings,
  toggleInvoicePaid,
  toggleInvoiceLocked,
  markInvoiceSent,
  generateNextInvoiceNumber,
  isInvoiceNumberUnique,
  getInvoiceAudit,
};

onmessage = async (e: MessageEvent<RpcRequest>) => {
  const { id, method, params } = e.data;
  try {
    const result = await methods[method](...params);
    if (result instanceof Uint8Array) {
      // Use a type assertion to tell TypeScript this is the correct signature
      (postMessage as (message: any, transfer: Transferable[]) => void)(
        { id, result } as RpcResponse,
        [result.buffer]
      );
    } else {
      postMessage({ id, result } as RpcResponse);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    postMessage({ id, error } as RpcResponse);
  }
};
