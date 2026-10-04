import type {LocalUnitOfWork, Repositories, Repository} from '../../../../datos/contracts/repositories/public';
import {databaseVersion, storeNames, type StoreName} from '../../../../datos/local/schema/public';

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error);});
}
class IndexedRepository<T extends {id: string}> implements Repository<T> {
  constructor(private readonly store: IDBObjectStore) {}
  get(id: string): Promise<T | undefined> {return request(this.store.get(id)) as Promise<T | undefined>;}
  list(): Promise<T[]> {return request(this.store.getAll()) as Promise<T[]>;}
  async put(value: T): Promise<void> {await request(this.store.put(value));}
}
export class IndexedDbUnitOfWork implements LocalUnitOfWork {
  private constructor(private readonly database: IDBDatabase) {}
  static async open(name: string, factory: IDBFactory = indexedDB): Promise<IndexedDbUnitOfWork> {
    const opening = factory.open(name, databaseVersion);
    opening.onupgradeneeded = () => {
      for (const name of storeNames) {
        if (opening.result.objectStoreNames.contains(name)) continue;
        const store = opening.result.createObjectStore(name, {keyPath: 'id'});
        store.createIndex('userId', 'userId', {unique: false});
      }
    };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      let failed = false;
      opening.onsuccess = () => {if (failed) opening.result.close(); else resolve(opening.result);};
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => {failed = true; reject(new Error('Cierra otras pestañas para actualizar el almacenamiento.'));};
    });
    database.onversionchange = () => database.close();
    return new IndexedDbUnitOfWork(database);
  }
  read<T>(work: (r: Repositories) => Promise<T>): Promise<T> {return this.run('readonly', work);}
  write<T>(work: (r: Repositories) => Promise<T>): Promise<T> {return this.run('readwrite', work);}
  private async run<T>(mode: IDBTransactionMode, work: (r: Repositories) => Promise<T>): Promise<T> {
    const tx = this.database.transaction([...storeNames], mode);
    const finished = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Transacción abortada.'));
      tx.onerror = () => {}; // Abort carries the error and rolls back all stores.
    });
    // Attach immediately: work may fail before transaction completion.
    void finished.catch(() => {});
    const repositories = Object.fromEntries(storeNames.map((name: StoreName) =>
      [name, new IndexedRepository(tx.objectStore(name))])) as unknown as Repositories;
    try {
      const result = await work(repositories);
      await finished;
      return result;
    } catch (error) {
      try {tx.abort();} catch { /* Already aborted or completed. */ }
      await finished.catch(() => {});
      throw error;
    }
  }
  close(): void {this.database.close();}
}
