import { TablesDB } from 'node-appwrite';

export async function runTransaction<T>(
  tablesDB: TablesDB,
  run: (transactionId: string) => Promise<T>,
): Promise<T> {
  const transaction = await tablesDB.createTransaction();
  let shouldRollback = true;

  try {
    const result = await run(transaction.$id);
    await tablesDB.updateTransaction({
      transactionId: transaction.$id,
      commit: true,
    });
    shouldRollback = false;

    return result;
  } catch (error) {
    if (shouldRollback) {
      try {
        await tablesDB.updateTransaction({
          transactionId: transaction.$id,
          rollback: true,
        });
      } catch {
        // Ignore rollback failures and preserve the original error.
      }
    }

    throw error;
  }
}
