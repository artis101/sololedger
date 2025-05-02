# Invoice Numbering System Design

## Overview
A flexible invoice numbering system that balances simplicity with power, allowing users to customize their invoice numbers while maintaining organization and compliance.

## Key Features

### 1. Format Templates with Variables
Allow users to define format templates with variables:
- `{YEAR}` - Four-digit year (2025)
- `{YY}` - Two-digit year (25)
- `{MONTH}` - Two-digit month (01-12)
- `{SEQ}` - Sequential counter with padding
- `{PREFIX}` - User-defined prefix

Examples:
- `INV-{YEAR}-{SEQ}` → INV-2025-0001
- `{PREFIX}{YY}{MONTH}-{SEQ}` → ABC2501-0043
- `{YEAR}/{SEQ}` → 2025/0001

### 2. Counter Management
- **Auto-increment**: Automatically track and increment the sequence number
- **Padding**: Configure leading zeros (001, 0001, etc.)
- **Reset options**: Reset counter annually, monthly, or never
- **Counter preview**: Show the next invoice number when creating new invoices

### 3. Implementation Components

#### Database Changes
- Add to `business_settings` table:
  ```sql
  invoice_number_format TEXT DEFAULT 'INV-{YEAR}-{SEQ}',
  invoice_number_counter INTEGER DEFAULT 1,
  invoice_number_padding INTEGER DEFAULT 4,
  invoice_number_prefix TEXT DEFAULT '',
  invoice_number_reset TEXT DEFAULT 'yearly'
  ```

#### UI Components
- Settings section for number format configuration
- Live preview of generated numbers
- Format validation to ensure uniqueness
- Counter management tools

#### Functionality
- Parse format strings and substitute variables
- Check for uniqueness before saving
- Auto-increment logic with reset handling
- Suggestion system for available formats

## Technical Implementation

### Format Parsing Function
```javascript
function parseInvoiceNumberFormat(format, counter, settings) {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  // Format the sequence number with configured padding
  const paddedCounter = counter.toString().padStart(settings.invoice_number_padding, '0');
  
  // Replace all variables in the format string
  return format
    .replace('{YEAR}', year)
    .replace('{YY}', year.slice(2))
    .replace('{MONTH}', month)
    .replace('{SEQ}', paddedCounter)
    .replace('{PREFIX}', settings.invoice_number_prefix || '');
}
```

### Counter Management
- Track a reset date to handle annual/monthly resets
- When creating a new invoice, check if reset is needed
- Store last used number in settings
- Validate to prevent duplicates even with manual edits

### Migration Path
1. Add new fields to database schema
2. Provide sensible defaults
3. Introduce UI in settings page
4. Enhance invoice creation with auto-numbering
5. Add duplicate prevention system

## User Experience
- Simple form in settings for format configuration
- Live preview while typing
- "Generate Next Number" button for new invoices
- Format explanation and examples
- Validation feedback for invalid formats

## Edge Cases
- Handle duplicate prevention
- Support number format changes mid-year
- Provide backwards compatibility
- Allow manual overrides with warnings