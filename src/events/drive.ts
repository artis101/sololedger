import { renderClients, renderInvoices, $ } from '../ui.ts';
import { exportDb, loadDb, syncDbToDrive } from '../db.ts';
import '../config.ts';

// Current Google Drive file ID (live-bound)
// Try to restore from localStorage if available
export let driveFileId: string | null = localStorage.getItem('driveFileId') || null;

// Update Drive connection status in UI
function updateDriveStatus(): void {
  const statusEl = $('#gdrive-status');
  const lastSyncEl = $('#gdrive-last-sync');

  if (driveFileId) {
    statusEl.textContent = 'Connected';
    statusEl.classList.remove('text-gray-700', 'bg-gray-200', 'text-red-700', 'bg-red-200');
    statusEl.classList.add('text-green-700', 'bg-green-200');
    $('#gdrive-btn').textContent = 'Sync to Google Drive';

    // Show disconnect UI if it exists
    if ($('#gdrive-disconnect-btn')) {
      $('#gdrive-disconnect-btn').classList.remove('hidden');
    }

    // Restore last sync time if available
    const lastSync = localStorage.getItem('lastDriveSync');
    if (lastSync) {
      lastSyncEl.textContent = `Last sync: ${lastSync}`;
      lastSyncEl.classList.remove('hidden');
    }
  } else {
    statusEl.textContent = 'Not connected';
    statusEl.classList.remove('text-green-700', 'bg-green-200', 'text-red-700', 'bg-red-200');
    statusEl.classList.add('text-gray-700', 'bg-gray-200');
    $('#gdrive-btn').textContent = 'Connect Google Drive';
    lastSyncEl.classList.add('hidden');

    // Hide disconnect UI if it exists
    if ($('#gdrive-disconnect-btn')) {
      $('#gdrive-disconnect-btn').classList.add('hidden');
    }
  }
}

// Disconnect from Google Drive
function disconnectFromDrive(): void {
  // Clear storage
  localStorage.removeItem('driveFileId');
  localStorage.removeItem('lastDriveSync');

  // Reset state
  driveFileId = null;

  // Update UI
  updateDriveStatus();
}

// Initialize Google Drive integration
export function initDriveHandlers(): void {
  // Check initial connection status
  updateDriveStatus();

  // Add disconnect button if it doesn't exist
  if (!$('#gdrive-disconnect-btn')) {
    const disconnectBtn = document.createElement('button');
    disconnectBtn.id = 'gdrive-disconnect-btn';
    disconnectBtn.classList.add('text-sm', 'text-red-600', 'ml-2', 'cursor-pointer');
    disconnectBtn.textContent = 'Disconnect';
    if (!driveFileId) {
      disconnectBtn.classList.add('hidden');
    }

    // Insert after the last sync element
    $('#gdrive-last-sync').after(disconnectBtn);

    // Add click handler
    disconnectBtn.addEventListener('click', (e: Event) => {
      e.preventDefault();
      if (confirm('Are you sure you want to disconnect from Google Drive? Your local data will remain intact.')) {
        disconnectFromDrive();
      }
    });
  }

  $('#gdrive-btn').onclick = async () => {
    // Elements for displaying connection status and last sync
    const statusEl = $('#gdrive-status');
    const lastSyncEl = $('#gdrive-last-sync');
    try {
      // If already connected, perform manual sync
      if (driveFileId) {
        statusEl.textContent = 'Syncing...';
        statusEl.classList.remove('text-gray-700', 'bg-gray-200', 'text-red-700', 'bg-red-200');
        statusEl.classList.add('text-blue-700', 'bg-blue-200');
        const ok = await syncDbToDrive(driveFileId);
        if (ok) {
          // Update last sync timestamp
          const now = new Date();
          const syncTime = now.toLocaleString();
          lastSyncEl.textContent = `Last sync: ${syncTime}`;
          lastSyncEl.classList.remove('hidden');

          // Save last sync time to localStorage
          localStorage.setItem('lastDriveSync', syncTime);
          statusEl.textContent = 'Connected';
          statusEl.classList.remove('text-blue-700', 'bg-blue-200');
          statusEl.classList.add('text-green-700', 'bg-green-200');
        } else {
          statusEl.textContent = 'Sync failed';
          statusEl.classList.remove('text-blue-700', 'bg-blue-200');
          statusEl.classList.add('text-red-700', 'bg-red-200');
        }
        return;
      }
      
      // The Google Drive API code has been removed as it appears to no longer be used
      // based on commit message "gdrive begone" and the empty config.js file
      console.log('Google Drive integration has been removed');
    } catch (error: any) {
      console.error('Google Drive error:', error);
      console.log(`Google Drive connection error: ${error.message}`);
    }
  };
}