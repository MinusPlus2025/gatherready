import { AsyncLocalStorage } from 'node:async_hooks';
import type { Client, Transaction, InValue } from '@libsql/client';

/** Prototype only: callers must await EVERY query, mutation and transaction.
 * Do not perform PayPal/network calls inside a database transaction.
 * A transaction-bound executor is per async request, never mutable global state.
 */
export class AsyncSql {
  private readonly scope = new AsyncLocalStorage<Transaction>();
  constructor(readonly client: Client) {}
  async one<T = Record<string, unknown>>(sql: string, ...args: InValue[]): Promise<T | null> {
    const result = await (this.scope.getStore() ?? this.client).execute({ sql, args });
    return (result.rows[0] as unknown as T) ?? null;
  }
  async all<T = Record<string, unknown>>(sql: string, ...args: InValue[]): Promise<T[]> {
    const result = await (this.scope.getStore() ?? this.client).execute({ sql, args });
    return result.rows as unknown as T[];
  }
  async run(sql: string, ...args: InValue[]): Promise<{ changes: number }> {
    const result = await (this.scope.getStore() ?? this.client).execute({ sql, args });
    return { changes: result.rowsAffected };
  }
  async tx<T>(fn: () => Promise<T>): Promise<T> {
    if (this.scope.getStore()) throw new Error('Nested transactions are not supported');
    const transaction = await this.client.transaction('write');
    try {
      const result = await this.scope.run(transaction, fn);
      await transaction.commit();
      return result;
    } catch (error) {
      try { await transaction.rollback(); } catch { /* retain original error */ }
      throw error;
    } finally { transaction.close(); }
  }
}
