interface ViteTypeOptions {
  // 添加这行代码，你就可以将 ImportMetaEnv 的类型设为严格模式，
  // 这样就不允许有未知的键值了。
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_URL: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_URL: string;
  readonly VITE_APPWRITE_DATABASE_ID: string;
  readonly VITE_APPWRITE_STORAGE_ID: string;
  readonly VITE_APPWRITE_USERS_TABLE_ID: string;
  readonly VITE_APPWRITE_POSTS_TABLE_ID: string;
  readonly VITE_APPWRITE_SAVES_TABLE_ID: string;
  // 更多环境变量...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
