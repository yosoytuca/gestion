import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
async function worker() {
  const handlers: Record<string, (event: any) => void> = {};
  let skipped = 0, fetched = 0;
  const shell = {version: 'actual'};
  const cache = {addAll: async () => {}, match: async () => shell};
  runInNewContext(await readFile('frontend/public/sw.js', 'utf8'), {
    self: {location: {origin: 'https://example.test'}, clients: {claim: async () => {}},
      skipWaiting() {skipped++;}, addEventListener: (name: string, fn: (e: any) => void) => {handlers[name] = fn;}},
    caches: {open: async () => cache, keys: async () => [], delete: async () => true}, URL,
    fetch: async () => {fetched++; throw new Error('offline');}
  });
  return {handlers, shell, skipped: () => skipped, fetched: () => fetched};
}
test('PWA instala caché sin activar actualización hasta aprobación explícita', async () => {
  const w = await worker(); let install: Promise<void> | undefined;
  w.handlers.install!({waitUntil: (p: Promise<void>) => {install = p;}}); await install;
  assert.equal(w.skipped(), 0);
  w.handlers.message!({data: {type: 'OTHER'}}); assert.equal(w.skipped(), 0);
  w.handlers.message!({data: {type: 'ACTIVATE_UPDATE'}}); assert.equal(w.skipped(), 1);
});
test('PWA navegación profunda offline conserva shell de versión activa', async () => {
  const w = await worker(); let result: Promise<unknown> | undefined;
  w.handlers.fetch!({request: {url: 'https://example.test/activity/id', method: 'GET', mode: 'navigate'}, respondWith: (p: Promise<unknown>) => {result = p;}});
  assert.equal(await result, w.shell); assert.equal(w.fetched(), 0);
});
