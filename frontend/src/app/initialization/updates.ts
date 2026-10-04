export async function registerUpdates(root: HTMLElement): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const offer = () => {
      if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('#pwa-update')) return;
      const panel = document.createElement('aside'); panel.id = 'pwa-update'; panel.className = 'update-banner';
      panel.setAttribute('aria-label', 'Actualización disponible');
      const text = document.createElement('p'); text.textContent = 'Hay una versión nueva. Guarda tus cambios antes de actualizar.';
      const apply = document.createElement('button'); apply.textContent = 'Actualizar';
      const later = document.createElement('button'); later.textContent = 'Más tarde'; later.onclick = () => panel.remove();
      let confirmed = false;
      apply.onclick = () => {
        if (!confirmed) {
          confirmed = true; text.textContent = 'Se recargará la página. Confirma solo después de guardar lo que estabas escribiendo.';
          apply.textContent = 'Confirmar actualización'; later.textContent = 'Cancelar'; apply.focus(); return;
        }
        apply.disabled = true;
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {once: true});
        registration.waiting?.postMessage({type: 'ACTIVATE_UPDATE'});
      };
      panel.append(text, apply, later); root.after(panel);
    };
    offer();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', offer);
    });
  } catch {
    const warning = document.createElement('p'); warning.className = 'error-box';
    warning.textContent = 'No se pudo preparar el inicio sin conexión. Vuelve a abrir con conexión.';
    root.after(warning);
  }
}
