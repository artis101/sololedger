// Database entity interfaces
export interface Client {
  id?: number;
  name: string;
  email?: string;
  address?: string;
}

export interface Invoice {
  id?: number;
  number: string;
  date: string;
  client_id: number;
  total: number;
  paid?: number;
  locked?: number;
  locked_at?: string;
  paid_at?: string;
  sent_at?: string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id: number;
  description: string;
  qty: number;
  unit: number;
}

export interface InvoiceAudit {
  id?: number;
  invoice_id: number;
  timestamp: string;
  action: string;
  details?: string;
}

export interface BusinessSettings {
  id?: number;
  businessName?: string;
  tradingName?: string;
  businessAddress?: string;
  businessEmail?: string;
  businessPhone?: string;
  taxId?: string;
  taxRate?: number;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  swiftCode?: string;
  currency?: string;
  paymentTerms?: string;
  invoiceNote?: string;
  lastUpdated?: string;
  invoice_number_format?: string;
  invoice_number_counter?: number;
  invoice_number_padding?: number;
  invoice_number_prefix?: string;
  invoice_number_reset?: string;
  invoice_number_last_reset?: string;
}

// Worker RPC interfaces
export interface RpcRequest {
  id: number;
  method: string;
  params: any[];
}

export interface RpcResponse {
  id: number;
  result?: any;
  error?: string;
}

export interface RpcCallback {
  resolve: (value: any) => void;
  reject: (reason: Error) => void;
}

// SQL.js module interface (basic)
export interface SqlModule {
  Database: new (data?: Uint8Array) => SqlDatabase;
}

export interface SqlDatabase {
  run: (sql: string, params?: any[]) => void;
  exec: (sql: string) => SqlExecResult[];
  prepare: (sql: string) => SqlStatement;
  export: () => Uint8Array;
  close: () => void;
}

export interface SqlStatement {
  bind: (params: any[]) => void;
  step: () => boolean;
  get: () => any;
  getAsObject: () => any;
  free: () => void;
  run: (params: any[]) => void;
}

export interface SqlExecResult {
  columns: string[];
  values: any[][];
}

// Invoice with Items combined type
export interface InvoiceWithItems {
  invoice: Invoice;
  items: InvoiceItem[];
}

// Array representation of database records
export type ClientRow = [number, string, string | null, string | null]; // [id, name, email, address]
export type InvoiceRow = [
  number,
  string,
  string,
  string,
  number,
  number | null,
  number | null,
  string | null,
  string | null,
  string | null
]; // [id, number, date, clientName, total, paid, locked, locked_at, paid_at, sent_at]
