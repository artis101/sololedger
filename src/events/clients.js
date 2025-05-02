import { saveClient, getClient, deleteClient } from '../db.js';
import { renderClients, toggle, $ } from '../ui.js';

// Initialize client-related event handlers
export function initClientHandlers() {
  // New client
  $('#new-client-btn').onclick = () => {
    $('#client-modal-title').textContent = 'New Client';
    $('#edit-client-id').value = '';
    $('#client-form').reset();
    $('#delete-client-btn').classList.add('hidden');
    toggle($('#client-modal'), true);
  };

  // Cancel modal
  $('#cancel-client').onclick = () => toggle($('#client-modal'), false);

  // Edit/Delete in client table
  $('#client-table').addEventListener('click', async (e) => {
    if (e.target.matches('.edit-client')) {
      const id = Number(e.target.dataset.id);
      const client = await getClient(id);
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
      if (confirm('Are you sure you want to delete this client?')) {
        try {
          await deleteClient(id);
          await renderClients();
        } catch (error) {
          console.error('Error deleting client:', error);
          alert(`Error deleting client: ${error.message}`);
        }
      }
    }
  });

  // Delete button in modal
  $('#delete-client-btn').onclick = async () => {
    const id = Number($('#edit-client-id').value);
    if (id && confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(id);
        await renderClients();
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
      await saveClient({
        id: clientId ? Number(clientId) : null,
        name: fd.get('name'),
        email: fd.get('email'),
        address: fd.get('address'),
      });
      await renderClients();
      toggle($('#client-modal'), false);
      e.target.reset();
    } catch (error) {
      console.error('Error saving client:', error);
      alert(`Error saving client: ${error.message}`);
    }
  };
}