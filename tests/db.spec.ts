import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// Mock global Worker before importing db module
const mockResponses: Record<string, any> = {};
class MockWorker {
  static lastMessage: any;
  onmessage: (e: any) => void = () => {};
  constructor() {}
  postMessage(msg: any) {
    MockWorker.lastMessage = msg;
    const res = mockResponses[msg.method];
    setTimeout(() => {
      this.onmessage({ data: { id: msg.id, result: res, error: null } });
    }, 0);
  }
}
// @ts-ignore
global.Worker = MockWorker;

import * as db from '../src/db';

describe('db RPC wrappers', () => {
  beforeEach(() => {
    // Clear any previous lastMessage and responses
    (MockWorker as any).lastMessage = null;
    for (const key in mockResponses) delete mockResponses[key];
  });

  const tests: Array<{ fn: keyof typeof db; method: string; args?: any[]; response?: any }> = [
    { fn: 'initSql', method: 'initSql', args: [], response: undefined },
    { fn: 'loadDb', method: 'loadDb', args: [new Uint8Array([1])], response: undefined },
    { fn: 'listClients', method: 'listClients', args: [], response: [[1, 'A', '', '']] },
    { fn: 'listInvoices', method: 'listInvoices', args: [], response: [[1, 'INV-1', '2021-01-01', 'Test', 100, 0, 0, null, null, null]] },
    { fn: 'getClient', method: 'getClient', args: [5], response: { id: 5, name: 'Foo' } },
    { fn: 'deleteClient', method: 'deleteClient', args: [5], response: undefined },
    { fn: 'saveClient', method: 'saveClient', args: [{ name: 'X' }], response: 42 },
    { fn: 'exportDb', method: 'exportDb', args: [], response: new Uint8Array([9,9]) },
    { fn: 'deleteInvoice', method: 'deleteInvoice', args: [7], response: undefined },
    { fn: 'saveInvoice', method: 'saveInvoice', args: [{ id: 1 }, [{ description: '', qty: 1, unit: 1 }]], response: 88 },
    { fn: 'getInvoiceWithItems', method: 'getInvoiceWithItems', args: [3], response: { invoice: { id: 3 }, items: [] } },
    { fn: 'wipeDatabase', method: 'wipeDatabase', args: [], response: undefined },
    { fn: 'importDb', method: 'loadDb', args: [new Uint8Array([2])], response: undefined },
    { fn: 'getBusinessSettings', method: 'getBusinessSettings', args: [], response: { currency: 'USD' } },
    { fn: 'saveBusinessSettings', method: 'saveBusinessSettings', args: [{ currency: 'EUR' }], response: undefined },
    { fn: 'toggleInvoicePaid', method: 'toggleInvoicePaid', args: [10], response: undefined },
    { fn: 'toggleInvoiceLocked', method: 'toggleInvoiceLocked', args: [11], response: undefined },
    { fn: 'getInvoiceAudit', method: 'getInvoiceAudit', args: [12], response: [['audit1']] },
    { fn: 'markInvoiceSent', method: 'markInvoiceSent', args: [13], response: undefined },
    { fn: 'generateNextInvoiceNumber', method: 'generateNextInvoiceNumber', args: [], response: 'INV-002' },
    { fn: 'isInvoiceNumberUnique', method: 'isInvoiceNumberUnique', args: ['X', null], response: true },
  ];

  for (const { fn, method, args = [], response } of tests) {
    it(`${fn} calls RPC method '${method}' and resolves`, async () => {
      mockResponses[method] = response;
      // @ts-ignore
      const result = await (db[fn] as any)(...args);
      expect(MockWorker.lastMessage.method).toBe(method);
      expect(MockWorker.lastMessage.params).toEqual(args);
      expect(result).toEqual(response);
    });
  }
});