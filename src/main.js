import { SCOPES, CLIENT_ID, GDRIVE_FILE_NAME } from './config.js';
import {
  initSql,
  saveClient,
  listClients,
  getClient,
  deleteClient,
  saveInvoice,
  listInvoices,
  getInvoiceWithItems,
  deleteInvoice,
  exportDb,
  syncDbToDrive,
  loadDb
} from './db.js';
import { buildPdf } from './pdf.js';
import { $, $$, toggle, renderClients, renderInvoices, addItemRow } from './ui.js';
import './index.css';

let driveFileId = null;
let gapiReady = false;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initSql();
    renderClients();
    renderInvoices();
  } catch (error) {
    console.error('Application initialization error:', error);
    alert(`Failed to initialize application: ${error.message}\nPlease check the console for details.`);
  }

  // Client modal
  $('#new-client-btn').onclick = () => {
    $('#client-modal-title').textContent = 'New Client';
    $('#edit-client-id').value = '';
    $('#client-form').reset();
    $('#delete-client-btn').classList.add('hidden');
    toggle($('#client-modal'), true);
  };
  
  $('#cancel-client').onclick = () => toggle($('#client-modal'), false);
  
  // Edit client
  $('#client-table').addEventListener('click', async (e) => {
    if (e.target.matches('.edit-client')) {
      const id = Number(e.target.dataset.id);
      const client = getClient(id);
      
      if (client) {
        $('#client-modal-title').textContent = 'Edit Client';
        $('#edit-client-id').value = client.id;
        $('#client-form').elements.name.value = client.name;
        $('#client-form').elements.email.value = client.email || '';
        $('#client-form').elements.address.value = client.address || '';
        $('#delete-client-btn').classList.remove('hidden');
        toggle($('#client-modal'), true);
      }
    } else if (e.target.matches('.delete-client')) {
      const id = Number(e.target.dataset.id);
      try {
        if (confirm('Are you sure you want to delete this client?')) {
          deleteClient(id);
          renderClients();
          if (driveFileId) {
            await syncDbToDrive(driveFileId);
          }
        }
      } catch (error) {
        console.error('Error deleting client:', error);
        alert(`Error deleting client: ${error.message}`);
      }
    }
  });
  
  // Delete client button in modal
  $('#delete-client-btn').onclick = async () => {
    const id = Number($('#edit-client-id').value);
    if (id && confirm('Are you sure you want to delete this client?')) {
      try {
        deleteClient(id);
        renderClients();
        if (driveFileId) {
          await syncDbToDrive(driveFileId);
        }
        toggle($('#client-modal'), false);
      } catch (error) {
        console.error('Error deleting client:', error);
        alert(`Error deleting client: ${error.message}`);
      }
    }
  };
  
  // Save client
  $('#client-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const clientId = fd.get('clientId');
      
      saveClient({
        id: clientId ? Number(clientId) : null,
        name: fd.get('name'),
        email: fd.get('email'),
        address: fd.get('address'),
      });
      
      renderClients();
      
      if (driveFileId) {
        const syncSuccess = await syncDbToDrive(driveFileId);
        if (!syncSuccess) {
          console.warn('Google Drive sync failed, but client was saved locally');
        }
      }
      
      toggle($('#client-modal'), false);
      e.target.reset();
    } catch (error) {
      console.error('Error saving client:', error);
      alert(`Error saving client: ${error.message}`);
    }
  };

  // Invoice modal
  $('#new-invoice-btn').onclick = () => {
    $('#invoice-modal-title').textContent = 'New Invoice';
    $('#edit-invoice-id').value = '';
    $('#invoice-form').reset();
    $('#items-table tbody').innerHTML = '';
    $('#delete-invoice-btn').classList.add('hidden');
    addItemRow();
    toggle($('#invoice-modal'), true);
  };
  
  $('#cancel-invoice').onclick = () => {
    toggle($('#invoice-modal'), false);
    $('#invoice-form').reset();
    $('#items-table tbody').innerHTML = '';
  };
  
  $('#add-item-btn').onclick = () => addItemRow();
  
  $('#items-table').addEventListener('click', (e) => {
    if (e.target.matches('.remove-item')) e.target.closest('tr').remove();
  });
  
  // Edit/Delete invoice
  $('#invoice-table').addEventListener('click', async (e) => {
    if (e.target.matches('.edit-invoice')) {
      const id = Number(e.target.dataset.id);
      const invoice = getInvoiceWithItems(id);
      
      if (invoice) {
        $('#invoice-modal-title').textContent = 'Edit Invoice';
        $('#edit-invoice-id').value = id;
        $('#invoice-form').elements.number.value = invoice.header.number;
        $('#invoice-form').elements.date.value = invoice.header.date;
        
        // Find client ID from client name
        const clients = listClients();
        for (const client of clients) {
          if (client[1] === invoice.header.client) {
            $('#client-select').value = client[0];
            break;
          }
        }
        
        // Clear items and add each invoice item
        $('#items-table tbody').innerHTML = '';
        for (const item of invoice.items) {
          addItemRow(item.description, item.qty, item.unit);
        }
        
        $('#delete-invoice-btn').classList.remove('hidden');
        toggle($('#invoice-modal'), true);
      }
    } else if (e.target.matches('.delete-invoice')) {
      const id = Number(e.target.dataset.id);
      if (confirm('Are you sure you want to delete this invoice?')) {
        try {
          deleteInvoice(id);
          renderInvoices();
          if (driveFileId) {
            await syncDbToDrive(driveFileId);
          }
        } catch (error) {
          console.error('Error deleting invoice:', error);
          alert(`Error deleting invoice: ${error.message}`);
        }
      }
    }
  });
  
  // Delete invoice button in modal
  $('#delete-invoice-btn').onclick = async () => {
    const id = Number($('#edit-invoice-id').value);
    if (id && confirm('Are you sure you want to delete this invoice?')) {
      try {
        deleteInvoice(id);
        renderInvoices();
        if (driveFileId) {
          await syncDbToDrive(driveFileId);
        }
        toggle($('#invoice-modal'), false);
      } catch (error) {
        console.error('Error deleting invoice:', error);
        alert(`Error deleting invoice: ${error.message}`);
      }
    }
  };
  
  // Save button - without PDF
  $('#save-invoice-btn').onclick = async () => {
    try {
      const form = $('#invoice-form');
      const fd = new FormData(form);
      const items = Array.from($('#items-table tbody').rows).map((r) => ({
        description: r.querySelector('[name="description"]').value,
        qty: Number(r.querySelector('[name="qty"]').value),
        unit: Number(r.querySelector('[name="unit"]').value),
      }));
      
      if (items.length === 0) {
        alert('Please add at least one item to the invoice');
        return;
      }
      
      const total = items.reduce((s, i) => s + i.qty * i.unit, 0);
      const invoiceId = fd.get('invoiceId');
      
      const header = {
        id: invoiceId ? Number(invoiceId) : null,
        number: fd.get('number'),
        date: fd.get('date'),
        clientId: Number(fd.get('clientId')),
        total,
      };
      
      saveInvoice(header, items);
      renderInvoices();
      
      if (driveFileId) {
        const syncSuccess = await syncDbToDrive(driveFileId);
        if (!syncSuccess) {
          console.warn('Google Drive sync failed, but invoice was saved locally');
        }
      }
      
      toggle($('#invoice-modal'), false);
      form.reset();
      $('#items-table tbody').innerHTML = '';
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert(`Error saving invoice: ${error.message}`);
    }
  };
  
  // Save & PDF button - form submit
  $('#invoice-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData(e.target);
      const items = Array.from($('#items-table tbody').rows).map((r) => ({
        description: r.querySelector('[name="description"]').value,
        qty: Number(r.querySelector('[name="qty"]').value),
        unit: Number(r.querySelector('[name="unit"]').value),
      }));
      
      if (items.length === 0) {
        alert('Please add at least one item to the invoice');
        return;
      }
      
      const total = items.reduce((s, i) => s + i.qty * i.unit, 0);
      const invoiceId = fd.get('invoiceId');
      
      const header = {
        id: invoiceId ? Number(invoiceId) : null,
        number: fd.get('number'),
        date: fd.get('date'),
        clientId: Number(fd.get('clientId')),
        total,
      };
      
      const savedInvoiceId = saveInvoice(header, items);
      renderInvoices();
      
      if (driveFileId) {
        const syncSuccess = await syncDbToDrive(driveFileId);
        if (!syncSuccess) {
          console.warn('Google Drive sync failed, but invoice was saved locally');
        }
      }
      
      const full = getInvoiceWithItems(savedInvoiceId);
      buildPdf(full);
      
      toggle($('#invoice-modal'), false);
      e.target.reset();
      $('#items-table tbody').innerHTML = '';
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert(`Error saving invoice: ${error.message}`);
    }
  };

  // PDF buttons
  $('#invoice-table').addEventListener('click', (e) => {
    if (e.target.matches('.view-pdf')) {
      const id = e.target.dataset.id;
      buildPdf(getInvoiceWithItems(id));
    }
  });

  // Google Drive
  $('#gdrive-btn').onclick = async () => {
    try {
      if (!CLIENT_ID) {
        alert('Please set your OAuth Client ID in the config.js file');
        return;
      }
      
      if (!gapiReady) {
        await gapi.load('client:auth2');
        await gapi.client.init({
          clientId: CLIENT_ID,
          scope: SCOPES,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        gapiReady = true;
      }
      
      await gapi.auth2.getAuthInstance().signIn();
      
      const list = await gapi.client.drive.files.list({
        q: `name='${GDRIVE_FILE_NAME}' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
      });
      
      if (list.result.files.length) {
        driveFileId = list.result.files[0].id;
        const file = await gapi.client.drive.files.get({
          fileId: driveFileId,
          alt: 'media',
        });
        const data = new Uint8Array(file.body.split('').map((c) => c.charCodeAt(0)));
        loadDb(data);
      } else {
        const blob = new Blob([await exportDb()], { type: 'application/x-sqlite3' });
        const form = new FormData();
        form.append(
          'metadata',
          new Blob(
            [
              JSON.stringify({
                name: GDRIVE_FILE_NAME,
                mimeType: 'application/x-sqlite3',
              }),
            ],
            { type: 'application/json' },
          ),
        );
        form.append('file', blob);
        
        const resp = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
          {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + gapi.auth.getToken().access_token },
            body: form,
          },
        );
        
        if (!resp.ok) {
          throw new Error(`API error: ${resp.status} ${await resp.text()}`);
        }
        
        driveFileId = (await resp.json()).id;
      }
      
      renderClients();
      renderInvoices();
      alert('Google Drive linked ✔');
    } catch (error) {
      console.error('Google Drive error:', error);
      alert(`Google Drive connection error: ${error.message}`);
    }
  };
});