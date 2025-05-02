import { saveClient, getClient, deleteClient, listClients, listInvoices } from '../db';
import { renderClients, toggle, $ } from '../ui';
import { updateDashboardStats } from './tabs';
import { Client } from '../types';

// Initialize client-related event handlers
export function initClientHandlers(): void {
  // New client
  $('#new-client-btn').addEventListener('click', () => {
    $('#client-modal-title').textContent = 'New Client';
    ($('#edit-client-id') as HTMLInputElement).value = '';
    ($('#client-form') as HTMLFormElement).reset();
    $('#delete-client-btn').classList.add('hidden');
    toggle($('#client-modal'), true);
  });

  // Cancel modal
  $('#cancel-client').addEventListener('click', () => toggle($('#client-modal'), false));

  // Edit/Delete in client table
  $('#client-table').addEventListener('click', async (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.matches('.edit-client')) {
      const id = Number(target.dataset.id);
      const client = await getClient(id);
      if (client) {
        $('#client-modal-title').textContent = 'Edit Client';
        ($('#edit-client-id') as HTMLInputElement).value = client.id?.toString() || '';
        const form = $('#client-form') as HTMLFormElement;
        (form.elements.namedItem('name') as HTMLInputElement).value = client.name;
        (form.elements.namedItem('email') as HTMLInputElement).value = client.email || '';
        (form.elements.namedItem('taxId') as HTMLInputElement).value = client.taxId || '';
        (form.elements.namedItem('address') as HTMLTextAreaElement).value = client.address || '';
        $('#delete-client-btn').classList.remove('hidden');
        toggle($('#client-modal'), true);
      }
    } else if (target.matches('.delete-client')) {
      const id = Number(target.dataset.id);
      if (confirm('Are you sure you want to delete this client?')) {
        try {
          await deleteClient(id);
          await renderClients();
        } catch (error) {
          console.error('Error deleting client:', error);
          alert(`Error deleting client: ${(error as Error).message}`);
        }
      }
    }
  });

  // Delete button in modal
  $('#delete-client-btn').addEventListener('click', async () => {
    const id = Number(($('#edit-client-id') as HTMLInputElement).value);
    if (id && confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(id);
        await renderClients();
        toggle($('#client-modal'), false);
      } catch (error) {
        console.error('Error deleting client:', error);
        alert(`Error deleting client: ${(error as Error).message}`);
      }
    }
  });

  // Save client
  ($('#client-form') as HTMLFormElement).addEventListener('submit', async (e: SubmitEvent) => {
    e.preventDefault();
    try {
      const form = e.target as HTMLFormElement;
      const fd = new FormData(form);
      const clientId = fd.get('clientId');

      const clientData: Client = {
        id: clientId ? Number(clientId) : undefined,
        name: fd.get('name') as string,
        email: fd.get('email') as string,
        taxId: fd.get('taxId') as string,
        address: fd.get('address') as string,
      };

      await saveClient(clientData);

      // Update both clients and dashboard
      const clients = await listClients();
      const invoices = await listInvoices();
      await renderClients();
      await updateDashboardStats(clients, invoices);

      toggle($('#client-modal'), false);
      form.reset();
    } catch (error) {
      console.error('Error saving client:', error);
      alert(`Error saving client: ${(error as Error).message}`);
    }
  });
}