import type {InterpreterProvider, InterpreterInput} from '../../../../datos/contracts/interpreter/public';
import type {InterpreterRequest} from '../../../../datos/contracts/interpreter/transport';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
export class RealInterpreterProvider implements InterpreterProvider {
  constructor(private readonly enrich: (input:InterpreterInput)=>InterpreterRequest, private readonly transport:typeof fetch = globalThis.fetch.bind(globalThis)) {}
  async interpret(input: InterpreterInput): Promise<unknown> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Necesitas conexión para interpretar este texto. Puedes crear actividades manualmente.');
    let response: Response;
    try {response = await this.transport('/api/v1/interpreter/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(this.enrich(input)),signal:AbortSignal.timeout(45000)});}
    catch {throw new Error('No se pudo conectar con la IA. Reintenta o crea la actividad manualmente.');}
    let value: any;try {value = await response.json();} catch {throw new Error('El servicio de IA devolvió una respuesta inválida. Reintenta.');}
    if (!response.ok) {
      const messages:Record<string,string>={ACCESS_DENIED:'Gemini denegó acceso al proyecto. Revisa el acceso en Google AI Studio.',NOT_CONFIGURED:'Falta configurar la IA en el servidor. Puedes crear actividades manualmente.',RATE_LIMIT:'La IA está ocupada. Espera un momento y reintenta.',TIMEOUT:'La IA tardó demasiado. Reintenta.',INVALID_OUTPUT:'La propuesta de IA no es válida. Reintenta; no se guardó nada.'};
      throw new Error(messages[value?.code] ?? 'El servicio de IA no está disponible. Reintenta o crea la actividad manualmente.');
    }
    try {return validateInterpreter(value);} catch {throw new Error('La propuesta de IA no es válida. Reintenta; no se guardó nada.');}
  }
}
