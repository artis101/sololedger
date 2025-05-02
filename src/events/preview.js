import { buildPdf } from '../pdf.js';
import { $ } from '../ui.js';

// Live preview of invoice while editing
export async function updateInvoicePreview() {
  try {
    const form = $('#invoice-form');
    const fd = new FormData(form);
    const number = fd.get('number');
    const date = fd.get('date');
    const clientSelect = form.elements.clientId;
    const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || '';
    const rows = Array.from($('#items-table tbody').rows);
    const items = rows.map((r) => ({
      description: r.querySelector('[name="description"]').value,
      qty: Number(r.querySelector('[name="qty"]').value),
      unit: Number(r.querySelector('[name="unit"]').value),
    }));
    const total = items.reduce((sum, it) => sum + it.qty * it.unit, 0);
    const invoiceObj = { header: { number, date, client: clientName, total }, items };
    const previewEl = $('#invoice-preview');
    if (previewEl) {
      await buildPdf(invoiceObj, { previewEl, open: false });
    }
  } catch (error) {
    console.error('Error updating invoice preview:', error);
  }
}