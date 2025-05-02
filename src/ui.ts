import {
  listClients,
  listInvoices,
  getBusinessSettings,
  markInvoiceSent,
} from "./db";

export const $ = (sel: string): HTMLElement =>
  document.querySelector(sel) as HTMLElement;
export const $$ = (sel: string): NodeListOf<Element> =>
  document.querySelectorAll(sel);

// Helper function to get currency symbol
export function getCurrencySymbol(currencyCode: string): string {
  switch (currencyCode) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    default:
      return currencyCode;
  }
}

export function toggle(el: HTMLElement, show: boolean): void {
  el.classList[show ? "remove" : "add"]("hidden");
}

export async function renderClients(): Promise<void> {
  const clients = await listClients(); // Keep as any[] type
  const tbody = $("#client-rows") as HTMLTableElement;
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
  const sel = $("#client-select") as HTMLSelectElement;
  sel.innerHTML = '<option value="" disabled selected hidden>Select…</option>';
  const optFrag = document.createDocumentFragment();
  for (const row of clients) {
    const option = document.createElement("option");
    option.value = row[0].toString();
    option.textContent = row[1];
    optFrag.appendChild(option);
  }
  sel.appendChild(optFrag);
}

export async function renderInvoices(): Promise<void> {
  // Get business settings for currency
  let currencySymbol = "€"; // Default
  try {
    const businessSettings = await getBusinessSettings();
    if (businessSettings?.currency) {
      currencySymbol = getCurrencySymbol(businessSettings.currency);
    }
  } catch (error) {
    console.error("Error getting currency from business settings:", error);
  }

  const invoices = await listInvoices(); // Keep as any[] type
  const tbody = $("#invoice-rows") as HTMLTableSectionElement;
  tbody.innerHTML = "";
  const fragment = document.createDocumentFragment();

  // Function to format dates in a friendly way
  const formatDate = (isoString: string | null): string => {
    if (!isoString) return "";
    const date = new Date(isoString);

    // Check if the date is today
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    // If today, show the time
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    // If within last 7 days, show day name and time
    const daysDiff = Math.floor(
      (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 7) {
      return `${date.toLocaleDateString([], {
        weekday: "short",
      })} at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    // Otherwise show date
    return date.toLocaleDateString();
  };

  for (const row of invoices) {
    const isPaid = row[5] === 1;
    const isLocked = row[6] === 1;
    const lockedAt = row[7]; // Index 7 is locked_at
    const paidAt = row[8]; // Index 8 is paid_at
    const sentAt = row[9]; // Index 9 is sent_at

    // Determine row color based on status
    let rowClass = "odd:bg-gray-50";
    if (isPaid) rowClass += " bg-green-50";
    if (isLocked) rowClass += " border-l-4 border-red-400";

    const tr = document.createElement("tr");
    tr.className = rowClass;

    tr.innerHTML = `
      <td class="px-3 py-2">
        ${row[1]}
        ${isLocked ? '<span class="ml-1 text-red-600 text-xs">🔒</span>' : ""}
      </td>
      <td class="px-3 py-2">${row[2]}</td>
      <td class="px-3 py-2">${row[3]}</td>
      <td class="px-3 py-2 text-right">${currencySymbol}${row[4].toFixed(
      2
    )}</td>
      <!-- Dates Column -->
      <td class="px-3 py-2 text-xs">
        ${
          isPaid && paidAt
            ? `<div class="mb-1"><span class="font-semibold text-green-700">Paid:</span> ${formatDate(
                paidAt
              )}</div>`
            : ""
        }
        ${
          isLocked && lockedAt
            ? `<div class="mb-1"><span class="font-semibold text-red-700">Locked:</span> ${formatDate(
                lockedAt
              )}</div>`
            : ""
        }
        ${
          sentAt
            ? `<div><span class="font-semibold text-blue-700">Sent:</span> ${formatDate(
                sentAt
              )}</div>`
            : ""
        }
      </td>
      <td class="px-3 py-2 text-center">
        <span class="inline-flex items-center">
          <button data-id="${
            row[0]
          }" class="text-blue-600 hover:underline view-pdf mr-2">PDF</button>
          <span class="status-badge ${
            isPaid
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          } text-xs px-2 py-1 rounded-full">
            ${isPaid ? "PAID" : "UNPAID"}
          </span>
          ${
            isLocked
              ? '<span class="status-badge bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full ml-1">LOCKED</span>'
              : ""
          }
        </span>
      </td>
      <td class="px-3 py-2 text-right">
        <div class="relative inline-block text-left" data-invoice-id="${
          row[0]
        }">
          <button 
            type="button" 
            class="invoice-actions-btn inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none"
          >
            Actions 
            <svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div 
            class="invoice-actions-popover origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 hidden z-10"
          >
            <div class="py-1" role="menu" aria-orientation="vertical">
              <!-- Send Action -->
              <button data-id="${
                row[0]
              }" class="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 invoice-send-btn ${
      sentAt ? "opacity-50" : ""
    }" ${sentAt ? 'disabled title="Already sent"' : ""}>
                <svg class="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                Mark as Sent
              </button>
              
              <!-- Pay Status -->
              <button data-id="${
                row[0]
              }" class="w-full text-left block px-4 py-2 text-sm ${
      isPaid
        ? "text-red-700 hover:bg-red-100"
        : "text-green-700 hover:bg-green-100"
    } toggle-paid">
                <svg class="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                ${isPaid ? "Mark as Unpaid" : "Mark as Paid"}
              </button>
              
              <!-- Lock Status -->
              <button data-id="${
                row[0]
              }" class="w-full text-left block px-4 py-2 text-sm ${
      isLocked
        ? "text-green-700 hover:bg-green-100"
        : "text-red-700 hover:bg-red-100"
    } toggle-locked">
                <svg class="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${
                    isLocked
                      ? "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                      : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  }"></path>
                </svg>
                ${isLocked ? "Unlock Invoice" : "Lock Invoice"}
              </button>
              
              <hr class="my-1">
              
              <!-- Edit -->
              <button data-id="${
                row[0]
              }" class="w-full text-left block px-4 py-2 text-sm text-blue-700 hover:bg-blue-100 edit-invoice">
                <svg class="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
                Edit Invoice
              </button>
              
              <!-- Delete -->
              <button data-id="${
                row[0]
              }" class="w-full text-left block px-4 py-2 text-sm text-red-700 hover:bg-red-100 delete-invoice">
                <svg class="inline-block w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      </td>`;
    fragment.appendChild(tr);
  }
  tbody.appendChild(fragment);

  // Also update invoice table header to show currency
  const invoiceTableHeader = $(
    "#invoice-table thead tr th:nth-child(4)"
  ) as HTMLTableCellElement;
  if (invoiceTableHeader) {
    invoiceTableHeader.textContent = `Total (${currencySymbol})`;
  }

  // Set up popover functionality
  setupInvoiceActionPopovers();
}

// Set up the invoice actions popover functionality
function setupInvoiceActionPopovers(): void {
  // Close all open popovers
  function closeAllPopovers(): void {
    document.querySelectorAll(".invoice-actions-popover").forEach((popover) => {
      popover.classList.add("hidden");
    });
  }

  // Handle clicking outside to close popovers
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      !target.closest(".invoice-actions-btn") &&
      !target.closest(".invoice-actions-popover")
    ) {
      closeAllPopovers();
    }
  });

  // Toggle popover when clicking the button
  document.querySelectorAll(".invoice-actions-btn").forEach((button) => {
    button.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      // Use currentTarget instead of target to handle clicks on the SVG or other child elements
      const buttonElement = e.currentTarget as HTMLElement;
      const container = buttonElement.closest("[data-invoice-id]") as HTMLElement;
      if (!container) return;

      const invoiceId = container.dataset.invoiceId;
      const popover = container.querySelector(
        ".invoice-actions-popover"
      ) as HTMLElement;
      if (!popover) return;

      // Close all other popovers
      document.querySelectorAll(".invoice-actions-popover").forEach((p) => {
        if (p !== popover) {
          p.classList.add("hidden");
        }
      });

      // Toggle this popover
      popover.classList.toggle("hidden");
    });
  });

  // Setup the "Mark as Sent" button handler
  document.querySelectorAll(".invoice-send-btn").forEach((button) => {
    if (!(button as HTMLButtonElement).disabled) {
      button.addEventListener("click", async (e: Event) => {
        e.stopPropagation();
        // Use currentTarget to get the button that was clicked, not a child element
        const buttonElement = e.currentTarget as HTMLElement;
        if (!buttonElement) return;

        const invoiceId = Number(buttonElement.dataset.id);
        if (!invoiceId) {
          console.error("No invoice ID found on button", buttonElement);
          return;
        }
        
        try {
          await markInvoiceSent(invoiceId);

          // Refresh the invoices list
          await renderInvoices();

          // Close all popovers
          closeAllPopovers();

          // Show confirmation
          alert("Invoice marked as sent!");
        } catch (error) {
          const err = error as Error;
          console.error("Error marking invoice as sent:", error);
          alert(`Error marking invoice as sent: ${err.message}`);
        }
      });
    }
  });
}

export function addItemRow(desc = "", qty = "", unit = ""): void {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td class="border-t"><input class="w-full p-2" name="description" value="${desc}" required></td>
    <td class="border-t"><input type="number" step="0.01" name="qty" value="${qty}" class="w-full p-2" required></td>
    <td class="border-t"><input type="number" step="0.01" name="unit" value="${unit}" class="w-full p-2" required></td>
    <td class="border-t text-center"><button type="button" class="remove-item text-red-600">✕</button></td>`;
  $("#items-table tbody").appendChild(tr);
}
