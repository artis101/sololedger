import { listClients, listInvoices, getBusinessSettings } from "./db.js";

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

// Helper function to get currency symbol
export function getCurrencySymbol(currencyCode) {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currencyCode;
  }
}

export function toggle(el, show) {
  el.classList[show ? "remove" : "add"]("hidden");
}

export async function renderClients() {
  const clients = await listClients();
  const tbody = $("#client-rows");
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const row of clients) {
    const tr = document.createElement("tr");
    tr.className = "odd:bg-gray-50";
    tr.innerHTML = `
      <td class="px-3 py-2">${row[1]}</td>
      <td class="px-3 py-2">${row[2] ?? ""}</td>
      <td class="px-3 py-2">${row[3] ?? ""}</td>
      <td class="px-3 py-2 text-right">
        <button data-id="${
          row[0]
        }" class="text-blue-600 hover:underline edit-client">Edit</button>
        <button data-id="${
          row[0]
        }" class="text-red-600 hover:underline ml-2 delete-client">Delete</button>
      </td>`;
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  // Populate client select
  const sel = $("#client-select");
  sel.innerHTML = '<option value="" disabled selected hidden>Select…</option>';
  const optFrag = document.createDocumentFragment();
  for (const row of clients) {
    const option = document.createElement("option");
    option.value = row[0];
    option.textContent = row[1];
    optFrag.appendChild(option);
  }
  sel.appendChild(optFrag);
}

export async function renderInvoices() {
  // Get business settings for currency
  let currencySymbol = '€'; // Default
  try {
    const businessSettings = await getBusinessSettings();
    if (businessSettings?.currency) {
      currencySymbol = getCurrencySymbol(businessSettings.currency);
    }
  } catch (error) {
    console.error("Error getting currency from business settings:", error);
  }
  
  const invoices = await listInvoices();
  const tbody = $("#invoice-rows");
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  
  for (const row of invoices) {
    const isPaid = row[5] === 1;
    const tr = document.createElement("tr");
    tr.className = isPaid ? "odd:bg-gray-50 bg-green-50" : "odd:bg-gray-50";
    tr.innerHTML = `
      <td class="px-3 py-2">${row[1]}</td>
      <td class="px-3 py-2">${row[2]}</td>
      <td class="px-3 py-2">${row[3]}</td>
      <td class="px-3 py-2 text-right">${currencySymbol}${row[4].toFixed(2)}</td>
      <td class="px-3 py-2 text-center">
        <span class="inline-flex items-center">
          <button data-id="${row[0]}" class="text-blue-600 hover:underline view-pdf mr-2">PDF</button>
          <span class="status-badge ${isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} text-xs px-2 py-1 rounded-full">
            ${isPaid ? 'PAID' : 'UNPAID'}
          </span>
        </span>
      </td>
      <td class="px-3 py-2 text-right">
        <button data-id="${row[0]}" class="px-2 py-1 text-xs rounded ${
          isPaid ? 'bg-gray-200 text-gray-800' : 'bg-green-600 text-white'
        } toggle-paid mr-1">${isPaid ? 'Mark Unpaid' : 'Mark Paid'}</button>
        <button data-id="${row[0]}" class="text-blue-600 hover:underline edit-invoice">Edit</button>
        <button data-id="${row[0]}" class="text-red-600 hover:underline ml-2 delete-invoice">Delete</button>
      </td>`;
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
  
  // Also update invoice table header to show currency
  const invoiceTableHeader = $("#invoice-table thead tr th:nth-child(4)");
  if (invoiceTableHeader) {
    invoiceTableHeader.textContent = `Total (${currencySymbol})`;
  }
}

export function addItemRow(desc = "", qty = "", unit = "") {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="border-t"><input class="w-full p-2" name="description" value="${desc}" required></td>
    <td class="border-t"><input type="number" step="0.01" name="qty" value="${qty}" class="w-full p-2" required></td>
    <td class="border-t"><input type="number" step="0.01" name="unit" value="${unit}" class="w-full p-2" required></td>
    <td class="border-t text-center"><button type="button" class="remove-item text-red-600">✕</button></td>`;
  $("#items-table tbody").appendChild(tr);
}