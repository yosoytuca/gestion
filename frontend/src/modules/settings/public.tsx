import {useState} from 'preact/hooks';
import type {UiPort} from '../../shared/ui-contract';
export function SettingsScreen({port, run}: {port: UiPort; run(work: () => Promise<unknown>): void}) {
  const [file, setFile] = useState<File | null>(null), [storageStatus, setStorageStatus] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const download = async () => {
    const text = await port.exportBackup(), url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `pendientes-${port.mode}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'Respaldo preparado para descargar. Guarda el archivo en un lugar seguro.';
  };
  return <div class="settings-screen"><section class="settings-section"><span class="eyebrow">EN ESTE DISPOSITIVO</span><h2>{port.mode === 'demo' ? 'Espacio de demostración' : 'Espacio personal'}</h2><p>Los cambios se guardan localmente. No hay una cuenta ni un servidor remoto conectado.</p></section>
    <section class="settings-section"><h2>Probar con ejemplos</h2><p>Una base separada con cotizaciones, compromisos y distintos vencimientos. Tus datos personales quedan intactos.</p>
      {port.mode === 'personal' ? <button class="primary" onClick={() => run(() => port.useDemo())}>Abrir demostración</button> : <><button onClick={() => run(() => port.usePersonal())}>Volver a mis datos</button><button onClick={() => run(() => port.useDemo(true))}>Restablecer datos demo</button></>}
    </section><section class="settings-section"><h2>Respaldo y recuperación</h2><p>Descarga tus datos para conservar una copia fuera del navegador. Restaurar solo funciona en un espacio vacío del mismo tipo; no reemplaza datos existentes.</p>
      <button onClick={() => run(download)}>Descargar respaldo</button>
      <label>Archivo de respaldo<input type="file" accept="application/json,.json" onChange={e => {setFile(e.currentTarget.files?.[0] ?? null); setConfirmRestore(false);}}/></label>
      <button disabled={!file} onClick={() => setConfirmRestore(true)}>Restaurar respaldo</button>
      {confirmRestore && <div class="restore-confirm"><p>Se restaurará el respaldo en este espacio vacío y se recargará la aplicación. Los datos existentes no se reemplazan.</p><button onClick={() => {
        if (!file) return;
        run(async () => {if (file.size > 20 * 1024 * 1024) throw new Error('El respaldo supera 20 MB.'); return port.restoreBackup(await file.text());});
      }}>Confirmar restauración</button><button onClick={() => setConfirmRestore(false)}>Cancelar restauración</button></div>}
    </section><section class="settings-section"><h2>Almacenamiento del navegador</h2><p>Borrar los datos del sitio elimina tus pendientes locales. Conserva respaldos; la permanencia del almacenamiento no está garantizada.</p>
      <button onClick={() => run(async () => {
        if (!navigator.storage?.persist) return setStorageStatus('Este navegador no ofrece almacenamiento persistente.');
        const granted = await navigator.storage.persist(); setStorageStatus(granted ? 'El navegador concedió almacenamiento persistente. Conserva tus respaldos.' : 'El navegador no lo concedió. Conserva tus respaldos.');
      })}>Solicitar almacenamiento persistente</button><p role="status">{storageStatus}</p>
    </section><section class="settings-section"><h2>Conexión e instalación</h2><p>La aplicación funciona directamente en el navegador. Instalarla es opcional. Se puede abrir sin conexión después de la primera carga.</p><p>Hablar y Escribir utilizan ejemplos simulados en esta etapa.</p></section>
  </div>;
}
