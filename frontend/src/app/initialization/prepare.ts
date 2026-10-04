import type {LocalUnitOfWork} from '../../../../datos/contracts/repositories/public';
import {configuration} from './configuration';
import {openStorage} from './storage';
import {composeServices} from './services';
import {seedDemo} from '../application/demo-data';
export async function prepareApplication(onStep: (label: string) => void,
  dependencies = {configuration, openStorage, composeServices, seedDemo}) {
  let storage: LocalUnitOfWork | undefined;
  try {
    onStep('Preparando configuración…');
    const config = dependencies.configuration();
    onStep('Abriendo tus datos…');
    storage = await dependencies.openStorage(config.databaseName);
    onStep('Preparando servicios…');
    const services = dependencies.composeServices(storage, config);
    if (config.mode === 'demo') {onStep('Preparando ejemplos…'); await dependencies.seedDemo(services.kernel);}
    onStep('Comprobando tus pendientes…');
    await services.controller.snapshot();
    return {...services, close: () => storage?.close()};
  } catch (error) {storage?.close(); throw error;}
}
