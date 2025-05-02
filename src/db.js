// src/db.js
// RPC Web Worker interface for database operations
const worker = new Worker(new URL('./db.worker.js', import.meta.url), { type: 'module' });
const callbacks = new Map();
let rpcId = 0;
worker.onmessage = ({ data }) => {
  const { id, result, error } = data;
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);
  if (error) cb.reject(new Error(error)); else cb.resolve(result);
};

function rpc(method, ...params) {
  const id = ++rpcId;
  return new Promise((resolve, reject) => {
    callbacks.set(id, { resolve, reject });
    worker.postMessage({ id, method, params });
  });
}

export function initSql() { return rpc('initSql'); }
export function loadDb(data) { return rpc('loadDb', data); }
export function listClients() { return rpc('listClients'); }
export function listInvoices() { return rpc('listInvoices'); }
export function getClient(id) { return rpc('getClient', id); }
export function deleteClient(id) { return rpc('deleteClient', id); }
export function saveClient(obj) { return rpc('saveClient', obj); }
export function exportDb() { return rpc('exportDb'); }
export function deleteInvoice(id) { return rpc('deleteInvoice', id); }
export function saveInvoice(header, items) { return rpc('saveInvoice', header, items); }
export function getInvoiceWithItems(id) { return rpc('getInvoiceWithItems', id); }

// Debounce utility to limit function calls
function debounce(fn, ms) {
  let timeout = null;
  let pending = [];
  return function(...args) {
    return new Promise((resolve) => {
      pending.push(resolve);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        timeout = null;
        const resolvers = pending;
        pending = [];
        let result;
        try { result = await fn(...args); }
        catch { resolvers.forEach(r => r(false)); return; }
        resolvers.forEach(r => r(result));
      }, ms);
    });
  };
}

// NOTE: silent token refresh has been removed to avoid COOP popup blocking errors

// Drive sync implementation
async function syncDbToDriveImpl(driveFileId) {
  if (!driveFileId) return false;
  // Use existing token; skip silent refresh to avoid COOP issues
  try {
    const blob = new Blob([await exportDb()], { type: 'application/x-sqlite3' });
    await gapi.client.drive.files.update({
      fileId: driveFileId,
      uploadType: 'media',
      media: { mimeType: 'application/x-sqlite3', body: blob }
    });
    return true;
  } catch (error) {
    console.error('Error syncing to Google Drive:', error);
    if (error.status === 401 && window.tokenClient) {
      try {
        // Prompt for consent again and get new token
        const retryResp = await new Promise((resolve, reject) => {
          window.tokenClient.requestAccessToken({
            prompt: 'consent',
            callback: (resp) => {
              if (resp.error) return reject(resp.error);
              resolve(resp);
            }
          });
        });
        // Set new token
        gapi.client.setToken(retryResp);
        // Retry the update
        await gapi.client.drive.files.update({
          fileId: driveFileId,
          uploadType: 'media',
          media: { type: 'application/x-sqlite3', body: new Blob([await exportDb()], { type: 'application/x-sqlite3' }) }
        });
        return true;
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }
    return false;
  }
}

// Sync database to Google Drive (manual invocation)
export const syncDbToDrive = syncDbToDriveImpl;