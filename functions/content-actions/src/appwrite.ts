import { Client, Storage, TablesDB } from 'node-appwrite';
import type { AppwriteResourceConfig } from './config.js';

export type AppwriteClients = {
  tablesDB: TablesDB;
  storage: Storage;
};

export function createAppwriteClients(
  config: AppwriteResourceConfig,
  apiKey: string,
): AppwriteClients {
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(apiKey);

  return {
    tablesDB: new TablesDB(client),
    storage: new Storage(client),
  };
}
