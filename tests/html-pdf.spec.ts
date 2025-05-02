import { describe, it, expect } from 'vitest';
import { getCurrencySymbol as pdfGetCurrency, createInvoiceHTML } from '../src/html-pdf';
import { getCurrencySymbol as uiGetCurrency } from '../src/ui';

describe('html-pdf utilities', () => {
  describe('getCurrencySymbol', () => {
    it('matches UI currency symbols', () => {
      ['USD', 'EUR', 'GBP', 'JPY'].forEach(code => {
        expect(pdfGetCurrency(code)).toBe(uiGetCurrency(code));
      });
    });
  });

  describe('createInvoiceHTML', () => {
    const sampleInvoice = {
      header: {
        number: 'INV-001',
        date: '2021-05-03',
        client: 'Test Client',
        total: 120,
      },
      items: [
        { description: 'Item A', qty: 2, unit: 30 },
        { description: 'Item B', qty: 1, unit: 60 },
      ],
    };

    it('creates a container with correct id and styles', () => {
      const el = createInvoiceHTML(sampleInvoice, null);
      expect(el).toBeInstanceOf(HTMLDivElement);
      expect(el.id).toBe('invoice-html-template');
      expect(el.className).toContain('bg-white');
      expect(el.style.position).toBe('fixed');
      expect(el.style.left).toBe('-9999px');
    });

    it('formats date as DD/MM/YYYY', () => {
      const el = createInvoiceHTML(sampleInvoice, null);
      expect(el.innerHTML).toContain('03/05/2021');
    });

    it('uses default € symbol when no settings', () => {
      const el = createInvoiceHTML(sampleInvoice, null);
      expect(el.innerHTML).toContain('€');
    });

    it('uses provided currency symbol from settings', () => {
      const settings = { currency: 'USD' } as any;
      const el = createInvoiceHTML(sampleInvoice, settings);
      expect(el.innerHTML).toContain('$');
    });

    it('calculates tax and subtotal when taxRate is provided', () => {
      const settings = { currency: 'EUR', taxRate: 20 } as any;
      const el = createInvoiceHTML(sampleInvoice, settings);
      // Tax line should appear: subtotal ~100, tax ~20
      expect(el.innerHTML).toMatch(/20%/);
      expect(el.innerHTML).toMatch(/20(?:\.0)?/);
    });
  });
});