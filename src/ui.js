import { listClients, listInvoices } from "./db.js";

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

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
  const invoices = await listInvoices();
  const tbody = $("#invoice-rows");
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (const row of invoices) {
    const tr = document.createElement("tr");
    tr.className = "odd:bg-gray-50";
    tr.innerHTML = `
      <td class="px-3 py-2">${row[1]}</td>
      <td class="px-3 py-2">${row[2]}</td>
      <td class="px-3 py-2">${row[3]}</td>
      <td class="px-3 py-2 text-right">${row[4].toFixed(2)}</td>
      <td class="px-3 py-2 text-center"><button data-id="${
        row[0]
      }" class="text-blue-600 hover:underline view-pdf">PDF</button></td>
      <td class="px-3 py-2 text-right">
        <button data-id="${
          row[0]
        }" class="text-blue-600 hover:underline edit-invoice">Edit</button>
        <button data-id="${
          row[0]
        }" class="text-red-600 hover:underline ml-2 delete-invoice">Delete</button>
      </td>`;
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);
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
