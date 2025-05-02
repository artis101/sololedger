// src/db.js
// RPC Web Worker interface for database operations
let worker;

// Feature detection for module web worker support
try {
  worker = new Worker(new URL("./db.worker.js", import.meta.url), {
    type: "module",
  });
} catch (e) {
  // Fallback for browsers without module worker support (Safari ≤ 15, old Edge)
  console.warn("Module workers not supported, using classic worker instead");
  // For a full fallback, you would need a build step to create a bundled worker
  // This is a basic fallback that will at least not crash the app
  worker = new Worker(new URL("./db.worker.js", import.meta.url).toString());
}
const callbacks = new Map();
let rpcId = 0;
worker.onmessage = ({ data }) => {
  const { id, result, error } = data;
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);
  if (error) cb.reject(new Error(error));
  else cb.resolve(result);
};

function rpc(method, ...params) {
  const id = ++rpcId;
  return new Promise((resolve, reject) => {
    callbacks.set(id, { resolve, reject });
    worker.postMessage({ id, method, params });
  });
}

export function initSql() {
  return rpc("initSql");
}
export function loadDb(data) {
  return rpc("loadDb", data);
}
export function listClients() {
  return rpc("listClients");
}
export function listInvoices() {
  return rpc("listInvoices");
}
export function getClient(id) {
  return rpc("getClient", id);
}
export function deleteClient(id) {
  return rpc("deleteClient", id);
}
export function saveClient(obj) {
  return rpc("saveClient", obj);
}
export function exportDb() {
  return rpc("exportDb");
}
export function deleteInvoice(id) {
  return rpc("deleteInvoice", id);
}
export function saveInvoice(header, items) {
  return rpc("saveInvoice", header, items);
}
export function getInvoiceWithItems(id) {
  return rpc("getInvoiceWithItems", id);
}

export function wipeDatabase() {
  return rpc("wipeDatabase");
}

export function importDb(data) {
  return rpc("loadDb", data);
}

export function getBusinessSettings() {
  return rpc("getBusinessSettings");
}

export function saveBusinessSettings(settings) {
  return rpc("saveBusinessSettings", settings);
}

// Make importDb available globally for the import function
window.importDb = importDb;

// Debounce utility to limit function calls
function debounce(fn, ms) {
  let timeout = null;
  let pendingCalls = [];
  return function (...args) {
    return new Promise((resolve) => {
      // Store both the resolver and the arguments
      pendingCalls.push({ resolve, args });
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        timeout = null;
        const calls = pendingCalls;
        pendingCalls = [];
        
        // Group by argument signature to make sure each unique request gets its own result
        const uniqueCalls = {};
        calls.forEach(call => {
          // Create a signature for the arguments
          const signature = JSON.stringify(call.args);
          if (!uniqueCalls[signature]) {
            uniqueCalls[signature] = { args: call.args, resolvers: [] };
          }
          uniqueCalls[signature].resolvers.push(call.resolve);
        });
        
        // Process each unique set of arguments
        for (const key in uniqueCalls) {
          const { args, resolvers } = uniqueCalls[key];
          try {
            const result = await fn(...args);
            resolvers.forEach(r => r(result));
          } catch (error) {
            resolvers.forEach(r => r(false));
          }
        }
      }, ms);
    });
  };
}

