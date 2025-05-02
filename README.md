# SoloLedger

SoloLedger is a 100% client-side invoicing app designed for freelancers and small businesses. Create, manage, and export professional invoices without relying on external services. All data stays local in your browser - no server required.

![SoloLedger Screenshot](https://placeholder.pics/svg/800x450/DEDEDE/555555/SoloLedger%20Screenshot)

## Features

- **Private & Secure**: All data is stored locally in your browser using IndexedDB
- **Create and manage clients**: Store client contact information
- **Create, edit, and delete invoices**: Full invoice management
- **Professional PDF generation**: Generate beautiful, professional invoices
- **Invoice tracking**: Track paid, unpaid, and locked invoices
- **Customizable settings**: Configure your business information, payment details, and tax settings
- **Invoice numbering system**: Automatic sequential numbering with customizable formats
- **Data export & import**: Backup and restore your data
- **Works entirely in the browser**: No server required, ensuring complete privacy

## Getting Started

### Installation & Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Using SoloLedger

### Setup

1. Navigate to the **Settings** tab to configure your business information
2. Enter your company details, banking information, and tax settings
3. Customize your invoice preferences and numbering format
4. Start creating clients and invoices

### Managing Clients

- Click **New Client** to add a client
- Enter client name, email, and address information
- Edit or delete clients via the actions menu in the clients table

### Creating Invoices

1. Click **New Invoice** to create a new invoice
2. Select a client from the dropdown
3. Set the invoice number (automatic if configured) and date
4. Add line items with descriptions, quantities, and unit prices
5. Preview the invoice in the Preview tab
6. Save the invoice or use "Save & PDF" to generate a PDF document

### Invoice Management

- Toggle between paid and unpaid status with the "Mark as Paid" button
- Lock invoices to prevent accidental edits with the "Lock Invoice" button
- Mark invoices as sent to track which have been delivered to clients
- View invoice history and audit trail
- Generate PDF documents for sending to clients

### Data Backup

- Export your data for backup using the "Export Data" button in Settings
- Import previously exported data to restore your database

## Technology Stack

- TypeScript
- SQL.js (SQLite in the browser)
- PDF-lib & html2canvas for PDF generation
- IndexedDB for local storage
- TailwindCSS
- Vite build system

## Deployment

This is a static web application that can be deployed to any web server or static hosting service like GitHub Pages, Netlify, Vercel, etc.

## Privacy

SoloLedger respects your privacy by keeping all your data on your device. No data is ever sent to a server unless you explicitly choose to back it up.

## License

This project is licensed under the GNU Affero General Public License version 3 (AGPLv3). See the [LICENSE](LICENSE) file for details.

---

**SoloLedger - Community Edition**
