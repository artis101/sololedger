import { initSql } from "./db.js";
import "./index.css";
import { renderClients, renderInvoices } from "./ui.js";
import { initClientHandlers } from "./events/clients.js";
import { initInvoiceHandlers } from "./events/invoices.js";
import { initDriveHandlers } from "./events/drive.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSql();
    await renderClients();
    await renderInvoices();
  } catch (error) {
    console.error("Application initialization error:", error);
    alert(
      `Failed to initialize application: ${error.message}\nPlease check the console for details.`
    );
  }

  initClientHandlers();
  initInvoiceHandlers();
  initDriveHandlers();
});