import { $, toggle } from '../ui';
import { getBusinessSettings, listClients } from '../db';
import { BusinessSettings } from '../types';

// Check if business has required settings filled
async function hasRequiredBusinessSettings(): Promise<boolean> {
  try {
    const settings = await getBusinessSettings();
    
    // Check for required business details
    return !!(
      settings &&
      settings.businessName && 
      settings.businessName.trim() !== '' &&
      settings.paymentTerms && 
      settings.paymentTerms.trim() !== ''
    );
  } catch (error) {
    console.error('Error checking business settings:', error);
    return false;
  }
}

// Check if there are any clients in the database
async function hasClients(): Promise<boolean> {
  try {
    const clients = await listClients();
    return clients && clients.length > 0;
  } catch (error) {
    console.error('Error checking clients:', error);
    return false;
  }
}

// Create and show the onboarding modal
function showOnboardingModal(missingBusinessSettings: boolean, noClients: boolean): void {
  // Remove any existing onboarding modal
  const existingModal = $('#onboarding-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create the modal element
  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center';
  
  // Build modal content
  let content = `
    <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Welcome to SoloLedger!</h2>
      <p class="text-gray-700 mb-6">Before you can create invoices, please complete the following steps:</p>
      
      <div class="space-y-4">
  `;
  
  // Add step for business settings if missing
  if (missingBusinessSettings) {
    content += `
      <div class="flex items-start space-x-3">
        <span class="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-500">1</span>
        <div>
          <h3 class="font-medium text-gray-900">Complete Business Details</h3>
          <p class="text-sm text-gray-500">Add your business name and payment terms in Settings.</p>
          <button id="go-to-settings" class="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none">
            Go to Settings
          </button>
        </div>
      </div>
    `;
  }
  
  // Add step for clients if none exist
  if (noClients) {
    content += `
      <div class="flex items-start space-x-3">
        <span class="flex-shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full ${missingBusinessSettings ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-500'}">
          ${missingBusinessSettings ? '2' : '1'}
        </span>
        <div>
          <h3 class="font-medium text-gray-900">Add Your First Client</h3>
          <p class="text-sm text-gray-500">You need at least one client to create invoices.</p>
          <button id="go-to-clients" class="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${missingBusinessSettings ? 'bg-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none'}">
            Go to Clients
          </button>
        </div>
      </div>
    `;
  }
  
  // Close button
  content += `
      </div>
      <button id="close-onboarding" class="absolute top-4 right-4 text-gray-400 hover:text-gray-500">
        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;
  
  modal.innerHTML = content;
  document.body.appendChild(modal);
  
  // Add event listeners
  const closeBtn = $('#close-onboarding');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toggle(modal, false);
      // Remove modal after animation
      setTimeout(() => {
        modal.remove();
      }, 300);
    });
  }
  
  const settingsBtn = $('#go-to-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      // Navigate to settings tab using the router
      import('../router').then(({ router }) => {
        const routerInstance = router();
        routerInstance.navigateToSettings();
      });
      
      toggle(modal, false);
      setTimeout(() => {
        modal.remove();
      }, 300);
    });
  }
  
  const clientsBtn = $('#go-to-clients');
  if (clientsBtn && !missingBusinessSettings) {
    clientsBtn.addEventListener('click', () => {
      // Navigate to clients tab using the router
      import('../router').then(({ router }) => {
        const routerInstance = router();
        routerInstance.navigateToClients();
      });
      
      toggle(modal, false);
      setTimeout(() => {
        modal.remove();
      }, 300);
    });
  }
}

// Check onboarding requirements and show modal if needed
export async function checkOnboardingRequirements(): Promise<{
  hasBusinessSettings: boolean;
  hasClients: boolean;
}> {
  const businessSettingsComplete = await hasRequiredBusinessSettings();
  const clientsExist = await hasClients();
  
  if (!businessSettingsComplete || !clientsExist) {
    showOnboardingModal(!businessSettingsComplete, !clientsExist);
  }
  
  return {
    hasBusinessSettings: businessSettingsComplete,
    hasClients: clientsExist
  };
}

// Initialize onboarding
export function initOnboarding(): void {
  // Check if we're on an app route
  import('../router').then(({ router }) => {
    const routerInstance = router();
    const currentRoute = routerInstance.getCurrentRoute();
    
    // Only show onboarding if we're on an app route
    if (currentRoute && currentRoute.path.startsWith('/app/')) {
      // Check onboarding requirements only on app pages
      checkOnboardingRequirements();
    }
    
    // Add "Help me set up" button in header
    const header = $('.header-container');
    if (header) {
      const helpButton = document.createElement('button');
      helpButton.id = 'onboarding-help-btn';
      helpButton.className = 'ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500';
      helpButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
        </svg>
        Setup Guide
      `;
      
      helpButton.addEventListener('click', async () => {
        const { hasBusinessSettings, hasClients } = await checkOnboardingRequirements();
        
        // If everything is set up, show a success message
        if (hasBusinessSettings && hasClients) {
          alert('Your account is fully set up! You can now create invoices.');
        }
      });
      
      header.appendChild(helpButton);
    }
  });
}