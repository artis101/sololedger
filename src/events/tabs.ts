import { $, $$ } from '../ui';
import { getBusinessSettings } from '../db';
import { BusinessSettings } from '../types';
import { router } from '../router';

// Helper function to get currency symbol from currency code
function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currencyCode;
  }
}

// Initialize tab navigation functionality
export function initTabHandlers(): void {
  // The router now handles tab switching, so this function primarily
  // initializes the router and sets up any additional tab-related functionality
  
  // Initialize the router
  router();
  
  // Any additional tab functionality not handled by the router can go here
}

// Update dashboard stats with real data
export async function updateDashboardStats(clients: any[], invoices: any[]): Promise<void> {
  // Get business settings
  try {
    const settings = await getBusinessSettings();

    // Update header business name
    const headerBusinessName = $('#header-business-name');
    if (headerBusinessName && settings && settings.businessName) {
      headerBusinessName.textContent = settings.businessName;
    }

    // Update currency display based on settings
    const currencySymbol = settings && settings.currency ?
      getCurrencySymbol(settings.currency) :
      '€';

    // Update client count
    const clientCount = $('#client-count');
    if (clientCount) {
      clientCount.textContent = clients.length.toString();
    }

    // Update invoice count and total revenue
    const invoiceCount = $('#invoice-count');
    const totalRevenue = $('#total-revenue');
    if (invoiceCount && totalRevenue) {
      invoiceCount.textContent = invoices.length.toString();

      // Calculate total revenue
      const total = invoices.reduce((sum, invoice) => {
        // Invoices are stored as arrays where total is at index 4
        return sum + invoice[4];
      }, 0);

      totalRevenue.textContent = `${currencySymbol}${total.toFixed(2)}`;
    }
  } catch (error) {
    console.error("Error loading business settings for dashboard:", error);

    // Default values if settings can't be loaded
    const clientCount = $('#client-count');
    if (clientCount) {
      clientCount.textContent = clients.length.toString();
    }

    const invoiceCount = $('#invoice-count');
    const totalRevenue = $('#total-revenue');
    if (invoiceCount && totalRevenue) {
      invoiceCount.textContent = invoices.length.toString();

      const total = invoices.reduce((sum, invoice) => {
        return sum + invoice[4];
      }, 0);

      totalRevenue.textContent = `€${total.toFixed(2)}`;
    }
  }

  // Update recent invoices table
  const recentInvoicesTable = $('#recent-invoices') as HTMLTableElement;
  if (recentInvoicesTable && invoices.length) {
    recentInvoicesTable.innerHTML = '';
    const fragment = document.createDocumentFragment();

    // Show up to 5 most recent invoices
    const recentInvoices = [...invoices].sort((a, b) => {
      // Sort by date (index 2) in descending order
      return new Date(b[2]).getTime() - new Date(a[2]).getTime();
    }).slice(0, 5);

    for (const invoice of recentInvoices) {
      const tr = document.createElement('tr');
      tr.className = 'odd:bg-gray-50';
      tr.innerHTML = `
        <td class="px-3 py-2">${invoice[1]}</td>
        <td class="px-3 py-2">${invoice[2]}</td>
        <td class="px-3 py-2">${invoice[3]}</td>
        <td class="px-3 py-2 text-right">${invoice[4].toFixed(2)}</td>
      `;
      fragment.appendChild(tr);
    }

    recentInvoicesTable.appendChild(fragment);
  }

  // Update recent activity (can be used to track recent actions)
  const recentActivity = $('#recent-activity');
  if (recentActivity) {
    // For now, just show the most recent invoices as activity
    if (invoices.length > 0) {
      recentActivity.innerHTML = '';
      const fragment = document.createDocumentFragment();

      const recentInvoices = [...invoices].sort((a, b) => {
        return new Date(b[2]).getTime() - new Date(a[2]).getTime();
      }).slice(0, 3);

      for (const invoice of recentInvoices) {
        const li = document.createElement('li');
        li.innerHTML = `<span class="font-medium">Invoice #${invoice[1]}</span> - ${invoice[3]} (${invoice[2]})`;
        fragment.appendChild(li);
      }

      recentActivity.appendChild(fragment);
    }
  }
}