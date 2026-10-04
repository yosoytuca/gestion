import {render} from 'preact';
import {App} from '../app';
import {AppRouter} from '../router';
import {prepareApplication} from './prepare';
import {registerUpdates} from './updates';
export function startApplication(root: HTMLElement, dependencies = {prepareApplication, registerUpdates}) {
  let starting = false;
  const show = (label: string) => render(<div class="screen-main"><h1>Mis pendientes</h1><p role="status">{label}</p></div>, root);
  const start = async () => {
    if (starting) return;
    starting = true;
    let prepared: Awaited<ReturnType<typeof prepareApplication>> | undefined;
    try {
      prepared = await dependencies.prepareApplication(show);
      render(<App port={prepared.controller} router={new AppRouter(window)}/>, root);
      void dependencies.registerUpdates(root);
    } catch (error) {
      prepared?.close();
      render(<div class="screen-main"><h1>No pudimos abrir tus pendientes</h1><p role="alert">{error instanceof Error ? error.message : 'No se pudo preparar la aplicación.'}</p><p>Tus datos no se han restablecido. Puedes volver a intentar.</p><button class="primary" onClick={() => {void start();}}>Reintentar</button></div>, root);
    } finally {starting = false;}
  };
  void start();
}
