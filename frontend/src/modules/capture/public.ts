import type {InterpreterInput, InterpreterProvider} from '../../../../datos/contracts/interpreter/public';
import {validateInterpreter} from '../../../../datos/contracts/interpreter/validation';
import type {VoiceInput, VoiceProvider} from '../../../../datos/contracts/voice/public';
import {assert, localClock, validDate} from '../../../../datos/domain/activities/public';
export {CaptureScreen, CaptureResult} from './ui';

export class CaptureService {
  constructor(private readonly interpreter: InterpreterProvider, private readonly voice: VoiceProvider) {}
  async text(input: InterpreterInput) {
    assert(typeof input.text === 'string' && input.text.trim().length > 0 && input.text.length <= 20000 &&
      validDate(input.localDate) && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(input.localTime) &&
      Number.isFinite(Date.parse(input.capturedAt)), 'INVALID_CAPTURE', 'Entrada/contexto inválido.');
    const clock = localClock(input.capturedAt, input.timeZone);
    assert(clock.date === input.localDate && clock.time === input.localTime.slice(0, 5), 'INVALID_CAPTURE', 'Contexto temporal incoherente.');
    const batch = validateInterpreter(await this.interpreter.interpret(input));
    assert(batch.inputId === input.inputId, 'INVALID_CAPTURE', 'El proveedor devolvió otra entrada.');
    return batch;
  }
  async audio(input: VoiceInput, candidates: InterpreterInput['candidates']) {
    const transcript = await this.voice.transcribe(input);
    assert(typeof transcript.text === 'string' && transcript.context.inputId === input.context.inputId &&
      JSON.stringify(transcript.context) === JSON.stringify(input.context), 'INVALID_TRANSCRIPT', 'La transcripción debe conservar el contexto.');
    return this.text({...transcript.context, text: transcript.text, candidates});
  }
}
