import type {LocalUnitOfWork} from '../../../../datos/contracts/repositories/public';
import {LocalKernel} from '../application/local-kernel';
import {UiController, type UiEnvironment} from '../application/ui-controller';
import {CaptureService} from '../../modules/capture/public';
import {FixtureInterpreterProvider, FixtureVoiceProvider} from '../../infrastructure/providers/mock-capture';
import {configuration, databaseNames} from './configuration';
import {deleteDemo} from './storage';
import {RealInterpreterProvider} from '../../infrastructure/providers/real-interpreter';
import {CaptureContextStore} from '../../infrastructure/providers/capture-context-store';
import {BrowserVoiceRecorder,HttpVoiceProvider} from '../../infrastructure/providers/browser-voice';
export function composeServices(uow: LocalUnitOfWork, config: ReturnType<typeof configuration>) {
  const kernel = new LocalKernel(uow, {userId: config.mode === 'demo' ? 'demo' : 'local', deviceId: config.deviceId,
    timeZone: config.timeZone, now: () => new Date().toISOString(), id: () => crypto.randomUUID()});
  const voice = config.mode==='demo' ? new FixtureVoiceProvider() : new HttpVoiceProvider();
  const environment:UiEnvironment = {mode: config.mode, voice,debug:false,
    recorder:config.mode==='demo'?undefined:new BrowserVoiceRecorder(),
    interpreterMode:config.mode === 'demo' ? 'mock' : 'real',
    contextStore:typeof localStorage === 'undefined' ? undefined : new CaptureContextStore(localStorage,`gestor-captures-${config.mode}`),
    restoredDevice(deviceId) {localStorage.setItem('gestor-device', deviceId); window.location.reload();},
    capture: (scenario,request) => new CaptureService(config.mode === 'demo' ? new FixtureInterpreterProvider(scenario) : new RealInterpreterProvider(input=>request ?? {input,candidateDetails:[],recentIds:[]}), voice),
    async switchMode(nextMode, reset) {
      if (reset && nextMode === 'demo') {
        if (config.mode === 'demo') uow.close();
        try {await deleteDemo(databaseNames.demo);} catch (error) {window.location.reload(); throw error;}
      }
      localStorage.setItem('gestor-ui-mode', nextMode);
      uow.close(); window.location.assign('/settings');
      await new Promise<void>(() => {});
    }};
  const controller = new UiController(kernel,environment);
  if (typeof window !== 'undefined' && typeof fetch === 'function') void fetch('/api/v1/interpreter/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{environment.debug=value?.debug===true;}).catch(()=>{});
  return {kernel, controller};
}
