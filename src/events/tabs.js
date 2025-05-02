import { $, $$ } from '../ui.js';

// Initialize tab navigation functionality
export function initTabHandlers() {
  const tabButtons = $$('.tab-button');
  const tabContents = $$('.tab-content');
  const viewAllInvoicesLink = $('#view-all-invoices');

  // Switch tab when clicked
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.id;
      const targetId = tabId.replace('-tab', '-page');
      const targetContent = $('#' + targetId);
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('tab-active'));
      button.classList.add('tab-active');
      
      // Show selected tab content, hide others
      tabContents.forEach(content => content.classList.add('hidden'));
      if (targetContent) {
        targetContent.classList.remove('hidden');
      }
    });
  });
  
  // View All Invoices link
  if (viewAllInvoicesLink) {
    viewAllInvoicesLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Activate invoices tab
      $('#invoices-tab').click();
    });
  }
}

// Update dashboard stats with real data
export async function updateDashboardStats(clients, invoices) {
  // Update client count
  const clientCount = $('#client-count');
  if (clientCount) {
    clientCount.textContent = clients.length;
  }
  
  // Update invoice count and total revenue
  const invoiceCount = $('#invoice-count');
  const totalRevenue = $('#total-revenue');
  if (invoiceCount && totalRevenue && invoices.length) {
    invoiceCount.textContent = invoices.length;
    
    // Calculate total revenue
    const total = invoices.reduce((sum, invoice) => {
      // Invoices are stored as arrays where total is at index 4
      return sum + invoice[4];
    }, 0);
    
    totalRevenue.textContent = `€${total.toFixed(2)}`;
  }
  
  // Update recent invoices table
  const recentInvoicesTable = $('#recent-invoices');
  if (recentInvoicesTable && invoices.length) {
    recentInvoicesTable.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    // Show up to 5 most recent invoices
    const recentInvoices = [...invoices].sort((a, b) => {
      // Sort by date (index 2) in descending order
      return new Date(b[2]) - new Date(a[2]);
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
        return new Date(b[2]) - new Date(a[2]);
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