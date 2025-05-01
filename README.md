# SoloLedger

SoloLedger is a 100% client-side invoicing app that allows you to create, manage, and export invoices. All data is stored locally, with optional Google Drive integration for backup.

## Features

- Create and manage clients
- Create, edit, and delete invoices
- Generate PDF invoices
- Backup data to Google Drive (optional)
- Works entirely in the browser - no server required

## Environment Variables

This app uses environment variables for configuration. Create a `.env` file in the root directory based on the `.env.example` file:

```
# Required for Google Drive integration
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Getting a Google OAuth Client ID

To use the Google Drive integration:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Drive API
4. Configure the OAuth consent screen
5. Create OAuth credentials (Web application type)
6. Add authorized JavaScript origins for your domains (e.g., `http://localhost:5173` for development)
7. Copy the Client ID to your `.env` file

## Development

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

## Deployment

When deploying, make sure to set the `VITE_GOOGLE_CLIENT_ID` environment variable in your hosting platform.
