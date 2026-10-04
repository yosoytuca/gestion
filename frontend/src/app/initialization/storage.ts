import {IndexedDbUnitOfWork} from '../../infrastructure/storage/indexeddb';
export const openStorage = (name: string) => IndexedDbUnitOfWork.open(name);
export function deleteDemo(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra otras pestañas demo antes de restablecer.'));
  });
}
