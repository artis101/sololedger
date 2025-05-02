import { initSql, listClients, listInvoices } from "./db";
import "./index.css";
import "./styles-fix.css"; // Import custom fixes for dropdown menu
import { renderClients, renderInvoices } from "./ui";
import { initClientHandlers } from "./events/clients";
import { initInvoiceHandlers } from "./events/invoices";
import { initTabHandlers, updateDashboardStats } from "./events/tabs";
import { initSettingsHandlers } from "./events/settings";
import { initOnboarding } from "./events/onboarding";
import { router } from "./router";

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
      `Failed to initialize application: ${
        (error as Error).message
      }\nPlease check the console for details.`
    );
  }

  // Initialize event handlers
  initClientHandlers();
  initInvoiceHandlers();
  initTabHandlers();
  initSettingsHandlers();

  // Initialize the router
  router();

  // Initialize onboarding flow
  setTimeout(() => {
    initOnboarding();
  }, 1000); // Delay a bit to ensure UI is fully loaded
});
