import { buildPdf } from '../pdf.js';
import { buildHtmlPdf } from '../html-pdf.js';
import { $ } from '../ui.js';
import { getBusinessSettings } from '../db.js';

// Live preview of invoice while editing
export async function updateInvoicePreview() {
  try {
    // Get business settings
    const businessSettings = await getBusinessSettings();
    
    const form = $('#invoice-form');
    const fd = new FormData(form);
    const number = fd.get('number');
    const date = fd.get('date');
    const clientSelect = form.elements.clientId;
    const clientName = clientSelect.options[clientSelect.selectedIndex]?.text || '';
    const rows = Array.from($('#items-table tbody').rows);
    const items = rows.map((r) => ({
      description: r.querySelector('[name="description"]').value || '',
      qty: Number(r.querySelector('[name="qty"]').value || 0),
      unit: Number(r.querySelector('[name="unit"]').value || 0),
    }));
    const total = items.reduce((sum, it) => sum + it.qty * it.unit, 0);
    const invoiceObj = { 
      header: { 
        number, 
        date: date || new Date().toISOString().split('T')[0], 
        client: clientName, 
        total 
      }, 
      items 
    };
    
    const previewEl = $('#invoice-preview');
    if (previewEl) {
      // Add a timestamp to prevent caching issues with the iframe
      previewEl.onload = () => {
        // Make sure the iframe content is centered properly
        try {
          const iframeDoc = previewEl.contentDocument || previewEl.contentWindow.document;
          if (iframeDoc && iframeDoc.body) {
            iframeDoc.body.style.margin = '0';
            iframeDoc.body.style.padding = '0';
            iframeDoc.body.style.display = 'flex';
            iframeDoc.body.style.justifyContent = 'center';
            iframeDoc.body.style.alignItems = 'flex-start';
          }
        } catch (e) {
          console.error('Unable to style iframe body:', e);
        }
      };
      
      await buildHtmlPdf(invoiceObj, { 
        previewEl, 
        open: false, 
        businessSettings,
        previewMode: true 
      });
    }
  } catch (error) {
    console.error('Error updating invoice preview:', error);
  }
}