// Type declaration for importing WASM assets via Vite
declare module "*.wasm?url" {
  const url: string;
  export default url;
}

// SQL.js initialization module
declare module "sql.js" {
  const initSqlJs: any;
  export default initSqlJs;
}

// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  // more env vars can be added here
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
