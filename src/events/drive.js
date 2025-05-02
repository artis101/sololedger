import { CLIENT_ID, SCOPES, GDRIVE_FILE_NAME } from '../config.js';
import { exportDb, loadDb, syncDbToDrive } from '../db.js';
import { renderClients, renderInvoices, $ } from '../ui.js';

// Current Google Drive file ID (live-bound)
export let driveFileId = null;

// Initialize Google Drive integration
export function initDriveHandlers() {
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
          lastSyncEl.textContent = `Last sync: ${now.toLocaleString()}`;
          lastSyncEl.classList.remove('hidden');
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
      // Manual sync: if already connected, just sync on button click
      if (driveFileId) {
        const ok = await syncDbToDrive(driveFileId);
        console.log(ok ? 'Database synced to Google Drive' : 'Google Drive sync failed');
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
      }
      await renderClients();
      await renderInvoices();
      console.log('Google Drive linked ✔');
      // Update button to allow manual sync from now on
      $('#gdrive-btn').textContent = 'Sync to Google Drive';
      // Update connection status indicator
      statusEl.textContent = 'Connected';
      statusEl.classList.remove('text-gray-700', 'bg-gray-200');
      statusEl.classList.add('text-green-700', 'bg-green-200');
    } catch (error) {
      console.error('Google Drive error:', error);
      console.log(`Google Drive connection error: ${error.message}`);
    }
  };
}