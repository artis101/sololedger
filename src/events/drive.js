import { CLIENT_ID, SCOPES, GDRIVE_FILE_NAME } from '../config.js';
import { exportDb, loadDb, syncDbToDrive } from '../db.js';
import { renderClients, renderInvoices, $ } from '../ui.js';

// Current Google Drive file ID (live-bound)
export let driveFileId = null;

// Initialize Google Drive integration
export function initDriveHandlers() {
  $('#gdrive-btn').onclick = async () => {
    try {
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
      let accessToken = '';
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResp) => {
          if (tokenResp.error) throw new Error(tokenResp.error);
          accessToken = tokenResp.access_token;
          gapi.client.setToken({ access_token: accessToken });
        },
      });
      await new Promise((resolve) => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
        const ck = setInterval(() => {
          if (gapi.client.getToken()) { clearInterval(ck); resolve(); }
        }, 100);
      });
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
      renderClients(); renderInvoices();
      console.log('Google Drive linked ✔');
    } catch (error) {
      console.error('Google Drive error:', error);
      console.log(`Google Drive connection error: ${error.message}`);
    }
  };
}