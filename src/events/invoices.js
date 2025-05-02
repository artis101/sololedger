import { saveInvoice, getInvoiceWithItems, deleteInvoice, listClients, listInvoices, getBusinessSettings, toggleInvoicePaid, toggleInvoiceLocked, generateNextInvoiceNumber, isInvoiceNumberUnique } from '../db.js';
import { renderInvoices, toggle, $, addItemRow } from '../ui.js';
import { buildPdf } from '../pdf.js';
import { buildHtmlPdf } from '../html-pdf.js';
import { updateInvoicePreview } from './preview.js';
import { updateDashboardStats } from './tabs.js';

// Initialize invoice-related event handlers
export function initInvoiceHandlers() {
  // Tab switching functionality for invoice modal
  const setupInvoiceTabs = () => {
    const formTab = $('#invoice-form-tab');
    const previewTab = $('#invoice-preview-tab');
    const formContent = $('#invoice-form-content');
    const previewContent = $('#invoice-preview-content');
    
    formTab.onclick = () => {
      // Update tab styling
      formTab.classList.add('tab-active', 'border-blue-600');
      formTab.classList.remove('border-transparent');
      previewTab.classList.remove('tab-active', 'border-blue-600');
      previewTab.classList.add('border-transparent');
      
      // Show/hide content
      formContent.classList.remove('hidden');
      previewContent.classList.add('hidden');
    };
    
    previewTab.onclick = () => {
      // Update tab styling
      previewTab.classList.add('tab-active', 'border-blue-600');
      previewTab.classList.remove('border-transparent');
      formTab.classList.remove('tab-active', 'border-blue-600');
      formTab.classList.add('border-transparent');
      
      // Show/hide content
      formContent.classList.add('hidden');
      previewContent.classList.remove('hidden');
      
      // Ensure preview is updated
      updateInvoicePreview();
    };
  };
  
  // Initialize tabs
  setupInvoiceTabs();
  
  // New Invoice
  $('#new-invoice-btn').onclick = async () => {
    $('#invoice-modal-title').textContent = 'New Invoice';
    $('#edit-invoice-id').value = '';
    $('#invoice-form').reset();
    $('#invoice-paid').checked = false; // Ensure payment status is reset
    $('#invoice-locked').checked = false; // Ensure locked status is reset
    $('#items-table tbody').innerHTML = '';
    $('#delete-invoice-btn').classList.add('hidden');
    addItemRow();
    
    // Reset to form tab view
    $('#invoice-form-tab').click();
    
    // Generate and set the next invoice number
    try {
      const nextNumber = await generateNextInvoiceNumber();
      $('#invoice-form').elements.number.value = nextNumber;
    } catch (error) {
      console.error("Error generating next invoice number:", error);
      // Just let the user enter their own number if auto-generation fails
    }
    
    toggle($('#invoice-modal'), true);
    updateInvoicePreview();
  };

  // Cancel modal
  $('#cancel-invoice').onclick = () => {
    toggle($('#invoice-modal'), false);
    $('#invoice-form').reset();
    $('#items-table tbody').innerHTML = '';
    
    // Remove audit trail popup if it exists
    const auditPopup = $('#audit-trail-popup');
    if (auditPopup) {
      auditPopup.remove();
    }
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
    } else if (e.target.matches('.toggle-locked')) {
      const id = Number(e.target.dataset.id);
      try {
        // Toggle the locked status
        await toggleInvoiceLocked(id);
        
        // Refresh the invoices list
        const clients = await listClients();
        const invoices = await listInvoices();
        await renderInvoices();
        await updateDashboardStats(clients, invoices);
      } catch (error) {
        console.error('Error toggling invoice locked status:', error);
        alert(`Error updating invoice lock status: ${error.message}`);
      }
    } else if (e.target.matches('.edit-invoice')) {
      const id = Number(e.target.dataset.id);
      const invoice = await getInvoiceWithItems(id);
      if (invoice) {
        // Check if invoice is locked and show warning
        if (invoice.header.locked === 1) {
          const warningMessage = "This invoice is locked. You can view it, but changes won't be saved unless you unlock it first or specifically override the lock. Continue opening the invoice?";
          if (!confirm(warningMessage)) {
            return; // User chose not to proceed
          }
        }
        
        $('#invoice-modal-title').textContent = 'Edit Invoice';
        $('#edit-invoice-id').value = id;
        $('#invoice-form').elements.number.value = invoice.header.number;
        $('#invoice-form').elements.date.value = invoice.header.date;
        
        // Set paid status
        $('#invoice-paid').checked = invoice.header.paid === 1;
        // Set locked status
        $('#invoice-locked').checked = invoice.header.locked === 1;
        
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
        
        // Reset to form tab view
        $('#invoice-form-tab').click();
        
        // Add visual indicator if locked
        if (invoice.header.locked === 1) {
          const modalTitle = $('#invoice-modal-title');
          modalTitle.innerHTML = 'Edit Invoice <span class="ml-2 text-red-600 text-sm">🔒 Locked</span>';
          
          // Check for audit trail
          try {
            const auditTrail = await getInvoiceAudit(id);
            if (auditTrail && auditTrail.length > 0) {
              // Add audit trail link - it will display in a small popup when clicked
              const extraNotes = document.createElement('div');
              extraNotes.className = 'text-xs text-gray-500 mt-1 italic';
              extraNotes.innerHTML = `<span class="cursor-pointer text-blue-600 hover:underline" id="show-audit-trail">
                Show edit history (${auditTrail.length} entries)
              </span>`;
              modalTitle.parentNode.appendChild(extraNotes);
              
              // Create popup for audit trail
              const popup = document.createElement('div');
              popup.id = 'audit-trail-popup';
              popup.className = 'hidden fixed top-1/4 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg z-50 max-w-md w-full';
              popup.innerHTML = `
                <div class="flex justify-between items-center mb-3">
                  <h3 class="font-medium">Invoice Edit History</h3>
                  <button id="close-audit-popup" class="text-gray-500 hover:text-gray-700">✕</button>
                </div>
                <div class="max-h-64 overflow-y-auto">
                  <ul class="divide-y divide-gray-200">
                    ${auditTrail.map(entry => `
                      <li class="py-2">
                        <div class="flex justify-between">
                          <span class="font-medium">${entry.action}</span>
                          <span class="text-gray-500 text-xs">${new Date(entry.timestamp).toLocaleString()}</span>
                        </div>
                        ${entry.details ? `<p class="text-sm text-gray-600 mt-1">${JSON.stringify(entry.details)}</p>` : ''}
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `;
              document.body.appendChild(popup);
              
              // Add event listeners for popup
              $('#show-audit-trail').addEventListener('click', () => {
                $('#audit-trail-popup').classList.remove('hidden');
              });
              
              $('#close-audit-popup').addEventListener('click', () => {
                $('#audit-trail-popup').classList.add('hidden');
              });
            }
          } catch (error) {
            console.error('Error loading audit trail:', error);
          }
        }
        
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
      
      // Get the invoice number and check if it's unique
      const invoiceNumber = fd.get('number');
      const invoiceId = fd.get('invoiceId') ? Number(fd.get('invoiceId')) : null;
      
      // Check for uniqueness (only if not empty)
      if (invoiceNumber && invoiceNumber.trim()) {
        const isUnique = await isInvoiceNumberUnique(invoiceNumber, invoiceId);
        if (!isUnique) {
          alert(`Invoice number "${invoiceNumber}" is already in use. Please use a different number.`);
          return;
        }
      } else {
        alert('Please enter an invoice number.');
        return;
      }
      
      // Get the paid status from the checkbox (0 if not checked, 1 if checked)
      const isPaid = $('#invoice-paid').checked ? 1 : 0;
      // Get the locked status from the checkbox (0 if not checked, 1 if checked)
      const isLocked = $('#invoice-locked').checked ? 1 : 0;
      const header = { id: invoiceId,
        number: invoiceNumber, date: fd.get('date'), clientId: Number(fd.get('clientId')), total, paid: isPaid, locked: isLocked };
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
      
      // Get the invoice number and check if it's unique
      const invoiceNumber = fd.get('number');
      const invoiceId = fd.get('invoiceId') ? Number(fd.get('invoiceId')) : null;
      
      // Check for uniqueness (only if not empty)
      if (invoiceNumber && invoiceNumber.trim()) {
        const isUnique = await isInvoiceNumberUnique(invoiceNumber, invoiceId);
        if (!isUnique) {
          alert(`Invoice number "${invoiceNumber}" is already in use. Please use a different number.`);
          return;
        }
      } else {
        alert('Please enter an invoice number.');
        return;
      }
      
      // Get the paid status from the checkbox (0 if not checked, 1 if checked)
      const isPaid = $('#invoice-paid').checked ? 1 : 0;
      // Get the locked status from the checkbox (0 if not checked, 1 if checked)
      const isLocked = $('#invoice-locked').checked ? 1 : 0;
      const header = { id: invoiceId,
        number: invoiceNumber, date: fd.get('date'), clientId: Number(fd.get('clientId')), total, paid: isPaid, locked: isLocked };
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