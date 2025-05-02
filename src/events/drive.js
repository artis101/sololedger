import { CLIENT_ID, SCOPES, GDRIVE_FILE_NAME } from '../config.js';
import { exportDb, loadDb, syncDbToDrive } from '../db.js';
import { renderClients, renderInvoices, $ } from '../ui.js';

// Current Google Drive file ID (live-bound)
// Try to restore from localStorage if available
export let driveFileId = localStorage.getItem('driveFileId') || null;

// Update Drive connection status in UI
function updateDriveStatus() {
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
function disconnectFromDrive() {
  // Clear storage
  localStorage.removeItem('driveFileId');
  localStorage.removeItem('lastDriveSync');
  
  // Reset state
  driveFileId = null;
  
  // Update UI
  updateDriveStatus();
}

// Initialize Google Drive integration
export function initDriveHandlers() {
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
    disconnectBtn.addEventListener('click', (e) => {
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
      if (!CLIENT_ID) {
        console.error('Missing environment variable: VITE_GOOGLE_CLIENT_ID');
        return;
      }
      // Load gapi client
      await new Promise((resolve) => {
        gapi.load('client', resolve);
      });
      await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      // Initialize the OAuth2 token client
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        // callback handled per-request
        callback: () => {}
      });
      // Expose for later silent refresh
      window.tokenClient = tokenClient;
      // Request user consent and obtain token
      const tokenResp = await new Promise((resolve, reject) => {
        tokenClient.requestAccessToken({
          prompt: 'consent',
          callback: (resp) => {
            if (resp.error) return reject(new Error(resp.error));
            resolve(resp);
          }
        });
      });
      // Set the token for gapi client
      gapi.client.setToken(tokenResp);
      const accessToken = tokenResp.access_token;
      const list = await gapi.client.drive.files.list({
        q: `name='${GDRIVE_FILE_NAME}' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
      });
      if (list.result.files.length) {
        driveFileId = list.result.files[0].id;
        // Save to localStorage
        localStorage.setItem('driveFileId', driveFileId);
        
        const file = await gapi.client.drive.files.get({ fileId: driveFileId, alt: 'media' });
        const data = new Uint8Array(file.body.split('').map((c) => c.charCodeAt(0)));
        loadDb(data);
      } else {
        const blob = new Blob([await exportDb()], { type: 'application/x-sqlite3' });
        const meta = new Blob([JSON.stringify({ name: GDRIVE_FILE_NAME, mimeType: 'application/x-sqlite3' })], { type: 'application/json' });
        const form = new FormData(); form.append('metadata', meta); form.append('file', blob);
        const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST', headers: { Authorization: 'Bearer ' + accessToken }, body: form,
        });
        if (!resp.ok) throw new Error(`API error: ${resp.status} ${await resp.text()}`);
        driveFileId = (await resp.json()).id;
        // Save to localStorage
        localStorage.setItem('driveFileId', driveFileId);
      }
      await renderClients();
      await renderInvoices();
      console.log('Google Drive linked ✔');
      
      // Update UI status indicators
      updateDriveStatus();
      
      // Set last sync time
      const now = new Date();
      const syncTime = now.toLocaleString();
      lastSyncEl.textContent = `Last sync: ${syncTime}`;
      lastSyncEl.classList.remove('hidden');
      
      // Save last sync time to localStorage
      localStorage.setItem('lastDriveSync', syncTime);
    } catch (error) {
      console.error('Google Drive error:', error);
      console.log(`Google Drive connection error: ${error.message}`);
    }
  };
}