import { saveInvoice, getInvoiceWithItems, deleteInvoice, listClients, listInvoices, getBusinessSettings, toggleInvoicePaid } from '../db.js';
import { renderInvoices, toggle, $, addItemRow } from '../ui.js';
import { buildPdf } from '../pdf.js';
import { buildHtmlPdf } from '../html-pdf.js';
import { updateInvoicePreview } from './preview.js';
import { updateDashboardStats } from './tabs.js';

// Initialize invoice-related event handlers
export function initInvoiceHandlers() {
  // New Invoice
  $('#new-invoice-btn').onclick = () => {
    $('#invoice-modal-title').textContent = 'New Invoice';
    $('#edit-invoice-id').value = '';
    $('#invoice-form').reset();
    $('#invoice-paid').checked = false; // Ensure payment status is reset
    $('#items-table tbody').innerHTML = '';
    $('#delete-invoice-btn').classList.add('hidden');
    addItemRow();
    toggle($('#invoice-modal'), true);
    updateInvoicePreview();
  };

  // Cancel modal
  $('#cancel-invoice').onclick = () => {
    toggle($('#invoice-modal'), false);
    $('#invoice-form').reset();
    $('#items-table tbody').innerHTML = '';
  };

  // Add item
  $('#add-item-btn').onclick = () => {
    addItemRow();
    updateInvoicePreview();
  };

  // Remove item
  $('#items-table').addEventListener('click', (e) => {
    if (e.target.matches('.remove-item')) {
      e.target.closest('tr').remove();
      updateInvoicePreview();
    }
  });

  // Edit/Delete/Toggle Paid from table
  $('#invoice-table').addEventListener('click', async (e) => {
    if (e.target.matches('.view-pdf')) {
      const id = Number(e.target.dataset.id);
      const invoice = await getInvoiceWithItems(id);
      if (invoice) {
        // Get business settings to include in the PDF
        const businessSettings = await getBusinessSettings();
        
        // Generate and open PDF using HTML renderer
        buildHtmlPdf(invoice, { businessSettings });
      }
    } else if (e.target.matches('.toggle-paid')) {
      const id = Number(e.target.dataset.id);
      try {
        // Toggle the paid status
        await toggleInvoicePaid(id);
        
        // Refresh the invoices list
        const clients = await listClients();
        const invoices = await listInvoices();
        await renderInvoices();
        await updateDashboardStats(clients, invoices);
      } catch (error) {
        console.error('Error toggling invoice paid status:', error);
        alert(`Error updating invoice status: ${error.message}`);
      }
    } else if (e.target.matches('.edit-invoice')) {
      const id = Number(e.target.dataset.id);
      const invoice = await getInvoiceWithItems(id);
      if (invoice) {
        $('#invoice-modal-title').textContent = 'Edit Invoice';
        $('#edit-invoice-id').value = id;
        $('#invoice-form').elements.number.value = invoice.header.number;
        $('#invoice-form').elements.date.value = invoice.header.date;
        
        // Set paid status
        $('#invoice-paid').checked = invoice.header.paid === 1;
        
        const clientsList = await listClients();
        for (const [cid, name] of clientsList) {
          if (name === invoice.header.client) {
            $('#client-select').value = cid;
            break;
          }
        }
        $('#items-table tbody').innerHTML = '';
        invoice.items.forEach(it => addItemRow(it.description, it.qty, it.unit));
        $('#delete-invoice-btn').classList.remove('hidden');
        toggle($('#invoice-modal'), true);
        updateInvoicePreview();
      }
    } else if (e.target.matches('.delete-invoice')) {
      const id = Number(e.target.dataset.id);
      if (confirm('Are you sure you want to delete this invoice?')) {
        try {
          await deleteInvoice(id);
          await renderInvoices();
        } catch (error) {
          console.error('Error deleting invoice:', error);
          alert(`Error deleting invoice: ${error.message}`);
        }
      }
    }
  });

  // Delete in modal
  $('#delete-invoice-btn').onclick = async () => {
    const id = Number($('#edit-invoice-id').value);
    if (id && confirm('Are you sure you want to delete this invoice?')) {
      try {
        await deleteInvoice(id);
        await renderInvoices();
        toggle($('#invoice-modal'), false);
      } catch (error) {
        console.error('Error deleting invoice:', error);
        alert(`Error deleting invoice: ${error.message}`);
      }
    }
  };

  // Save-only
  $('#save-invoice-btn').onclick = async () => {
    try {
      const form = $('#invoice-form');
      const items = Array.from($('#items-table tbody').rows).map(r => ({
        description: r.querySelector('[name="description"]').value,
        qty: Number(r.querySelector('[name="qty"]').value),
        unit: Number(r.querySelector('[name="unit"]').value),
      }));
      if (!items.length) { alert('Please add at least one item to the invoice'); return; }
      const total = items.reduce((s,i) => s+i.qty*i.unit, 0);
      const fd = new FormData(form);
      // Get the paid status from the checkbox (0 if not checked, 1 if checked)
      const isPaid = $('#invoice-paid').checked ? 1 : 0;
      const header = { id: fd.get('invoiceId')?Number(fd.get('invoiceId')):null,
        number: fd.get('number'), date: fd.get('date'), clientId: Number(fd.get('clientId')), total, paid: isPaid };
      await saveInvoice(header, items);
      
      // Update invoices and dashboard
      const clients = await listClients();
      const invoices = await listInvoices();
      await renderInvoices();
      await updateDashboardStats(clients, invoices);
      
      toggle($('#invoice-modal'), false);
      form.reset(); $('#items-table tbody').innerHTML = '';
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert(`Error saving invoice: ${error.message}`);
    }
  };

  // Save & PDF
  $('#invoice-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const form = $('#invoice-form');
      const items = Array.from($('#items-table tbody').rows).map(r => ({
        description: r.querySelector('[name="description"]').value,
        qty: Number(r.querySelector('[name="qty"]').value),
        unit: Number(r.querySelector('[name="unit"]').value),
      }));
      if (!items.length) { alert('Please add at least one item to the invoice'); return; }
      const total = items.reduce((s,i) => s+i.qty*i.unit, 0);
      const fd = new FormData(form);
      // Get the paid status from the checkbox (0 if not checked, 1 if checked)
      const isPaid = $('#invoice-paid').checked ? 1 : 0;
      const header = { id: fd.get('invoiceId')?Number(fd.get('invoiceId')):null,
        number: fd.get('number'), date: fd.get('date'), clientId: Number(fd.get('clientId')), total, paid: isPaid };
      const saved = await saveInvoice(header, items);
      
      // Update invoices and dashboard
      const clients = await listClients();
      const invoices = await listInvoices();
      await renderInvoices();
      await updateDashboardStats(clients, invoices);
      
      // Get business settings to include in the PDF
      const businessSettings = await getBusinessSettings();
      
      const full = await getInvoiceWithItems(saved);
      buildHtmlPdf(full, { businessSettings });
      toggle($('#invoice-modal'), false);
      form.reset(); $('#items-table tbody').innerHTML = '';
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert(`Error saving invoice: ${error.message}`);
    }
  };

  // Live preview
  $('#invoice-form').addEventListener('input', updateInvoicePreview);
  $('#invoice-form').addEventListener('change', updateInvoicePreview);
}