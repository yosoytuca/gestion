export const databaseNames = {demo: 'gestor-ui-demo', personal: 'gestor-ui-personal'} as const;
export function configuration(storage: Storage = localStorage) {
  const mode = storage.getItem('gestor-ui-mode') === 'demo' ? 'demo' : 'personal';
  const deviceId = storage.getItem('gestor-device') ?? crypto.randomUUID();
  storage.setItem('gestor-device', deviceId);
  return {mode, databaseName: databaseNames[mode], deviceId,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone} as const;
}
