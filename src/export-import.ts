// src/export-import.ts
// Functions for exporting and importing the database

import { exportDb } from './db.ts';

// Add declaration for global importDb function
declare global {
  interface Window {
    importDb: (data: Uint8Array) => Promise<void>;
  }
}

interface ExportResult {
  success: boolean;
  filename: string;
}

/**
 * Export the database to a downloadable file
 * @returns {Promise<ExportResult>} Result object with success status and filename
 */
export async function exportDatabase(): Promise<ExportResult> {
  try {
    // Get the database as a Uint8Array
    const dbData = await exportDb();

    // Create a blob from the data
    const blob = new Blob([dbData], { type: 'application/x-sqlite3' });

    // Generate a filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sololedger-backup-${timestamp}.sqlite3`;

    // Create a download link and trigger it
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    return { success: true, filename };
  } catch (error: any) {
    console.error('Error exporting database:', error);
    throw new Error(`Failed to export database: ${error.message}`);
  }
}

/**
 * Import a database from a file
 * @param {File} file The SQLite database file to import
 * @returns {Promise<boolean>} True if successful
 */
export async function importDatabase(file: File): Promise<boolean> {
  try {
    // Validate the file type
    if (!file.name.endsWith('.sqlite3') && !file.name.endsWith('.db')) {
      throw new Error('Invalid file type. Please select a SQLite database file (.sqlite3 or .db)');
    }

    // Read the file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Import the database
    await window.importDb(uint8Array);

    return true;
  } catch (error: any) {
    console.error('Error importing database:', error);
    throw new Error(`Failed to import database: ${error.message}`);
  }
}

/**
 * Create a file input element for importing a database file
 * @param {Function} onFileSelected Callback function to handle the selected file
 * @returns {HTMLInputElement} The file input element
 */
export function createFileInput(onFileSelected: (file: File) => void): HTMLInputElement {
  // Create a file input element
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.sqlite3,.db';
  fileInput.style.display = 'none';

  // Set up the change event handler
  fileInput.addEventListener('change', (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      onFileSelected(file);
    }
    // Clean up to allow selecting the same file again
    fileInput.value = '';
  });

  document.body.appendChild(fileInput);
  return fileInput;
}