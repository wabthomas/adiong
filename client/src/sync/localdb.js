// Base locale IndexedDB (moteur de synchronisation)
import Dexie from 'dexie';

export const syncDb = new Dexie('adiong-sync');
syncDb.version(1).stores({
  mirror: '[table+id], table, updatedAt, localPending',
  outbox: '++id, status, nextTryAt, createdAt',
  kv: 'key'
});

export const kvGet = async (key, fallback = null) => {
  const row = await syncDb.kv.get(key);
  return row ? row.value : fallback;
};
export const kvSet = async (key, value) => {
  await syncDb.kv.put({ key, value });
};
