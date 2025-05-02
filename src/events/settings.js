import { $, toggle } from '../ui.js';
import { wipeDatabase, listClients, listInvoices, getBusinessSettings, saveBusinessSettings, generateNextInvoiceNumber } from '../db.js';
import { renderClients, renderInvoices } from '../ui.js';
import { updateDashboardStats } from './tabs.js';
import { exportDatabase, importDatabase, createFileInput } from '../export-import.js';

// Form fields mapping for business settings
const businessSettingsFields = [
  "businessName",
  "tradingName",
  "businessAddress",
  "businessEmail",
  "businessPhone",
  "taxId",
  "taxRate",
  "bankName",
  "accountName",
  "accountNumber",
  "swiftCode",
  "currency",
  "paymentTerms",
  "invoiceNote",
  "invoice_number_format",
  "invoice_number_counter",
  "invoice_number_padding",
  "invoice_number_prefix",
  "invoice_number_reset"
];

// Initialize settings-related event handlers
export function initSettingsHandlers() {
  const wipeDbBtn = $('#wipe-db-btn');
  const wipeConfirmModal = $('#wipe-confirm-modal');
  const confirmWipeBtn = $('#confirm-wipe-btn');
  const cancelWipeBtn = $('#cancel-wipe');
  const wipeConfirmInput = $('#wipe-confirm-input');
  const businessSettingsForm = $('#business-settings-form');
  
  // Load business settings
  loadBusinessSettings();
  
  // Handle business settings form submission
  if (businessSettingsForm) {
    businessSettingsForm.addEventListener('submit', handleSaveSettings);
    
    // Add live preview for invoice number format
    setupInvoiceNumberPreview();
  }
  
  // Show wipe confirmation modal
  if (wipeDbBtn) {
    wipeDbBtn.addEventListener('click', () => {
      if (wipeConfirmModal) {
        toggle(wipeConfirmModal, true);
        // Clear input field
        if (wipeConfirmInput) {
          wipeConfirmInput.value = '';
          updateWipeButtonState();
        }
      }
    });
  }
  
  // Cancel wipe action
  if (cancelWipeBtn) {
    cancelWipeBtn.addEventListener('click', () => {
      if (wipeConfirmModal) {
        toggle(wipeConfirmModal, false);
      }
    });
  }
  
  // Check input field to enable/disable confirm button
  if (wipeConfirmInput) {
    wipeConfirmInput.addEventListener('input', updateWipeButtonState);
  }
  
  // Confirm and execute wipe
  if (confirmWipeBtn) {
    confirmWipeBtn.addEventListener('click', async () => {
      if (wipeConfirmInput && wipeConfirmInput.value === 'WIPE') {
        try {
          // Show wiping status
          const originalText = confirmWipeBtn.textContent;
          confirmWipeBtn.textContent = 'Wiping database...';
          confirmWipeBtn.disabled = true;
          confirmWipeBtn.classList.add('opacity-50', 'cursor-not-allowed');
          
          await wipeDatabase();
          
          // Reset UI
          const clients = await listClients();
          const invoices = await listInvoices();
          await renderClients();
          await renderInvoices();
          
          // Update dashboard with empty data
          await updateDashboardStats(clients, invoices);
          
          // Close modal
          toggle(wipeConfirmModal, false);
          
          // Reset button
          confirmWipeBtn.textContent = originalText;
          
          // Show success message
          alert('Database has been successfully wiped. The structure has been recreated with no data.');
        } catch (error) {
          console.error('Error wiping database:', error);
          alert(`Error wiping database: ${error.message}`);
          confirmWipeBtn.disabled = false;
          confirmWipeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      }
    });
  }
  
  // Export data functionality
  const exportDataBtn = $('#export-data-btn');
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', async () => {
      try {
        exportDataBtn.disabled = true;
        exportDataBtn.textContent = 'Exporting...';
        
        const result = await exportDatabase();
        
        if (result.success) {
          alert(`Database exported successfully as:\n${result.filename}`);
        }
      } catch (error) {
        console.error('Export error:', error);
        alert(`Error exporting database: ${error.message}`);
      } finally {
        exportDataBtn.disabled = false;
        exportDataBtn.textContent = 'Export Data';
      }
    });
  }
  
  // Import data functionality
  const importDataBtn = $('#import-data-btn');
  if (importDataBtn) {
    // Create a hidden file input for importing
    let fileInput = null;
    
    importDataBtn.addEventListener('click', () => {
      // Create the file input if it doesn't exist
      if (!fileInput) {
        fileInput = createFileInput(async (file) => {
          try {
            importDataBtn.disabled = true;
            importDataBtn.textContent = 'Importing...';
            
            // Ask for confirmation
            if (!confirm(`Are you sure you want to import the database from "${file.name}"?\n\nThis will replace all current data. This action cannot be undone.`)) {
              return;
            }
            
            // Import the database
            await importDatabase(file);
            
            // Refresh the UI
            const clients = await listClients();
            const invoices = await listInvoices();
            
            await renderClients();
            await renderInvoices();
            await updateDashboardStats(clients, invoices);
            
            alert('Database imported successfully!');
          } catch (error) {
            console.error('Import error:', error);
            alert(`Error importing database: ${error.message}`);
          } finally {
            importDataBtn.disabled = false;
            importDataBtn.textContent = 'Import Data';
          }
        });
      }
      
      // Trigger the file input
      fileInput.click();
    });
  }
  
  // Helper function to update wipe button state
  function updateWipeButtonState() {
    if (confirmWipeBtn && wipeConfirmInput) {
      if (wipeConfirmInput.value === 'WIPE') {
        confirmWipeBtn.disabled = false;
        confirmWipeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      } else {
        confirmWipeBtn.disabled = true;
        confirmWipeBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  }
}

// Load business settings from database
async function loadBusinessSettings() {
  try {
    const settings = await getBusinessSettings();
    
    if (settings) {
      // Populate form fields with settings values
      businessSettingsFields.forEach(field => {
        // Convert camelCase to kebab-case for HTML IDs
        const elementId = field.replace(/([A-Z])/g, "-$1").toLowerCase();
        const el = $(`#${elementId}`);
        
        if (el && settings[field] !== null && settings[field] !== undefined) {
          el.value = settings[field];
        }
      });
      
      // Display last updated time if available
      if (settings.lastUpdated) {
        const lastUpdated = new Date(settings.lastUpdated);
        const formattedDate = lastUpdated.toLocaleString();
        
        // Create or update a last updated element
        let lastUpdatedEl = $('#settings-last-updated');
        if (!lastUpdatedEl) {
          lastUpdatedEl = document.createElement("p");
          lastUpdatedEl.id = "settings-last-updated";
          lastUpdatedEl.className = "text-xs text-gray-500 mt-1";
          const saveSettingsBtn = $('#save-settings-btn');
          if (saveSettingsBtn) {
            saveSettingsBtn.insertAdjacentElement("afterend", lastUpdatedEl);
          }
        }
        lastUpdatedEl.textContent = `Last updated: ${formattedDate}`;
      }
    }
  } catch (error) {
    console.error("Error loading business settings:", error);
    showNotification("Failed to load business settings", "error");
  }
}

// Handle the saving of business settings
async function handleSaveSettings(event) {
  event.preventDefault();
  
  try {
    const saveSettingsBtn = $('#save-settings-btn');
    if (saveSettingsBtn) {
      const originalText = saveSettingsBtn.textContent;
      saveSettingsBtn.textContent = 'Saving...';
      saveSettingsBtn.disabled = true;
    }
    
    // Create settings object from form data
    const settings = {};
    
    businessSettingsFields.forEach(field => {
      // Convert camelCase to kebab-case for HTML IDs
      const elementId = field.replace(/([A-Z])/g, "-$1").toLowerCase();
      const el = $(`#${elementId}`);
      
      if (el) {
        settings[field] = el.value || null;
        
        // Convert taxRate to number if it exists
        if (field === "taxRate" && settings[field]) {
          settings[field] = parseFloat(settings[field]);
        }
      } else {
        settings[field] = null;
      }
    });
    
    // Save settings to database
    await saveBusinessSettings(settings);
    
    // Reload settings to update any derived values (like last updated time)
    await loadBusinessSettings();
    
    // Show success notification
    showNotification("Business settings saved successfully!");
    
    // Update UI if needed
    const headerBusinessName = $('#header-business-name');
    if (headerBusinessName && settings.businessName) {
      headerBusinessName.textContent = settings.businessName;
    }
    
    if (saveSettingsBtn) {
      saveSettingsBtn.textContent = 'Save Settings';
      saveSettingsBtn.disabled = false;
    }
  } catch (error) {
    console.error("Error saving business settings:", error);
    showNotification("Failed to save business settings", "error");
    
    const saveSettingsBtn = $('#save-settings-btn');
    if (saveSettingsBtn) {
      saveSettingsBtn.textContent = 'Save Settings';
      saveSettingsBtn.disabled = false;
    }
  }
}

// Show notification message
// Set up the live preview for invoice number format
function setupInvoiceNumberPreview() {
  // Get all the invoice number related fields
  const formatField = $('#invoice-number-format');
  const prefixField = $('#invoice-number-prefix');
  const paddingField = $('#invoice-number-padding');
  const counterField = $('#invoice-number-counter');
  const resetField = $('#invoice-number-reset');
  const previewEl = $('#invoice-number-preview');
  
  // Function to update the preview
  const updatePreview = async () => {
    try {
      // Generate a preview based on current form values
      // This is a client-side preview that simulates what the server would do
      const now = new Date();
      const year = now.getFullYear().toString();
      const shortYear = year.slice(2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      
      const format = formatField.value || 'INV-{YEAR}-{SEQ}';
      const prefix = prefixField.value || '';
      const padding = parseInt(paddingField.value) || 4;
      let counter = parseInt(counterField.value) || 1;
      
      // Format the counter with padding
      const paddedCounter = counter.toString().padStart(padding, '0');
      
      // Parse the format string
      let previewNumber = format
        .replace('{YEAR}', year)
        .replace('{YY}', shortYear)
        .replace('{MONTH}', month)
        .replace('{SEQ}', paddedCounter)
        .replace('{PREFIX}', prefix);
      
      // Update the preview element
      if (previewEl) {
        previewEl.textContent = previewNumber;
      }
    } catch (error) {
      console.error("Error updating invoice number preview:", error);
      if (previewEl) {
        previewEl.textContent = "Error generating preview";
      }
    }
  };
  
  // Update preview on any change to the invoice numbering fields
  [formatField, prefixField, paddingField, counterField, resetField].forEach(field => {
    if (field) {
      ['input', 'change'].forEach(event => {
        field.addEventListener(event, updatePreview);
      });
    }
  });
  
  // Initial preview update
  updatePreview();
}

function showNotification(message, type = "success") {
  // Check if notification container exists, if not create it
  let notificationContainer = $('#notification-container');
  
  if (!notificationContainer) {
    notificationContainer = document.createElement("div");
    notificationContainer.id = "notification-container";
    notificationContainer.className = "fixed bottom-4 right-4 z-50";
    document.body.appendChild(notificationContainer);
  }
  
  // Create notification element
  const notification = document.createElement("div");
  notification.className = `p-3 rounded-lg shadow-lg mb-2 transition-opacity duration-300 ${
    type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
  }`;
  notification.textContent = message;
  
  // Add to container
  notificationContainer.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.add("opacity-0");
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}