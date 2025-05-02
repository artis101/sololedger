// src/db.ts
import {
  Client,
  Invoice,
  InvoiceItem,
  BusinessSettings,
  RpcCallback,
  RpcResponse
} from './types';

// RPC Web Worker interface for database operations
let worker: Worker;

// Feature detection for module web worker support
try {
  worker = new Worker(new URL("./db.worker.ts", import.meta.url), {
    type: "module",
  });
} catch (e) {
  // Fallback for browsers without module worker support (Safari ≤ 15, old Edge)
  console.warn("Module workers not supported, using classic worker instead");
  // For a full fallback, you would need a build step to create a bundled worker
  // This is a basic fallback that will at least not crash the app
  worker = new Worker(new URL("./db.worker.ts", import.meta.url).toString());
}

const callbacks = new Map<number, RpcCallback>();
let rpcId = 0;

worker.onmessage = ({ data }: MessageEvent<RpcResponse>) => {
  const { id, result, error } = data;
  const cb = callbacks.get(id);
  if (!cb) return;
  callbacks.delete(id);
  if (error) cb.reject(new Error(error));
  else cb.resolve(result);
};

function rpc<T>(method: string, ...params: any[]): Promise<T> {
  const id = ++rpcId;
  return new Promise<T>((resolve, reject) => {
    callbacks.set(id, { resolve, reject });
    worker.postMessage({ id, method, params });
  });
}

export function initSql(): Promise<void> {
  return rpc<void>("initSql");
}

export function loadDb(data: Uint8Array): Promise<void> {
  return rpc<void>("loadDb", data);
}

export function listClients(): Promise<any[]> {
  return rpc<any[]>("listClients");
}

export function listInvoices(): Promise<any[]> {
  return rpc<any[]>("listInvoices");
}

export function getClient(id: number): Promise<Client> {
  return rpc<Client>("getClient", id);
}

export function deleteClient(id: number): Promise<void> {
  return rpc<void>("deleteClient", id);
}

export function saveClient(obj: Client): Promise<number> {
  return rpc<number>("saveClient", obj);
}

export function exportDb(): Promise<Uint8Array> {
  return rpc<Uint8Array>("exportDb");
}

export function deleteInvoice(id: number): Promise<void> {
  return rpc<void>("deleteInvoice", id);
}

export function saveInvoice(header: Invoice, items: InvoiceItem[]): Promise<number> {
  return rpc<number>("saveInvoice", header, items);
}

export function getInvoiceWithItems(id: number): Promise<{invoice: Invoice, items: InvoiceItem[]}> {
  return rpc<{invoice: Invoice, items: InvoiceItem[]}>("getInvoiceWithItems", id);
}

export function wipeDatabase(): Promise<void> {
  return rpc<void>("wipeDatabase");
}

export function importDb(data: Uint8Array): Promise<void> {
  return rpc<void>("loadDb", data);
}

export function getBusinessSettings(): Promise<BusinessSettings> {
  return rpc<BusinessSettings>("getBusinessSettings");
}

export function saveBusinessSettings(settings: BusinessSettings): Promise<void> {
  return rpc<void>("saveBusinessSettings", settings);
}

// Toggle the paid status of an invoice
export function toggleInvoicePaid(id: number): Promise<void> {
  return rpc<void>("toggleInvoicePaid", id);
}

// Toggle the locked status of an invoice
export function toggleInvoiceLocked(id: number): Promise<void> {
  return rpc<void>("toggleInvoiceLocked", id);
}

// Get audit history for an invoice
export function getInvoiceAudit(id: number): Promise<any[]> {
  return rpc<any[]>("getInvoiceAudit", id);
}

// Mark an invoice as sent
export function markInvoiceSent(id: number): Promise<void> {
  return rpc<void>("markInvoiceSent", id);
}

// Generate the next invoice number based on format settings
export function generateNextInvoiceNumber(): Promise<string> {
  return rpc<string>("generateNextInvoiceNumber");
}

// Check if an invoice number is unique
export function isInvoiceNumberUnique(number: string, excludeId: number | null = null): Promise<boolean> {
  return rpc<boolean>("isInvoiceNumberUnique", number, excludeId);
}

// Make importDb available globally for the import function
(window as any).importDb = importDb;

// Debounce utility to limit function calls
function debounce<T>(fn: (...args: any[]) => Promise<T>, ms: number): (...args: any[]) => Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  let pendingCalls: { resolve: (value: T) => void, args: any[] }[] = [];

  return function (...args: any[]): Promise<T> {
    return new Promise<T>((resolve) => {
      // Store both the resolver and the arguments
      pendingCalls.push({ resolve, args });
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        timeout = null;
        const calls = pendingCalls;
        pendingCalls = [];

        // Group by argument signature to make sure each unique request gets its own result
        const uniqueCalls: {[key: string]: { args: any[], resolvers: ((value: T) => void)[] }} = {};
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
            resolvers.forEach(r => r(false as any));
          }
        }
      }, ms);
    });
  };
}