import { initSql, listClients, listInvoices } from "./db";
import "./index.css";
import { renderClients, renderInvoices } from "./ui";
import { initClientHandlers } from "./events/clients";
import { initInvoiceHandlers } from "./events/invoices";
import { initTabHandlers, updateDashboardStats } from "./events/tabs";
import { initSettingsHandlers } from "./events/settings";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSql();

    // Get data first
    const clients = await listClients();
    const invoices = await listInvoices();

    // Render UI components
    await renderClients();
    await renderInvoices();

    // Update dashboard with actual data
    await updateDashboardStats(clients, invoices);
  } catch (error) {
    console.error("Application initialization error:", error);
    alert(
      `Failed to initialize application: ${(error as Error).message}\nPlease check the console for details.`
    );
  }

  // Initialize event handlers
  initClientHandlers();
  initInvoiceHandlers();
  initTabHandlers();
  initSettingsHandlers();
});