import type {InterpreterBatch, InterpreterInput, InterpreterProvider} from '../../../../datos/contracts/interpreter/public';
import type {VoiceInput, VoiceProvider} from '../../../../datos/contracts/voice/public';
import {resolveCalendar} from '../../../../datos/domain/activities/calendar';

/** Controlled fixtures, never pretending to parse arbitrary user language. */
export class FixtureInterpreterProvider implements InterpreterProvider {
  constructor(private readonly scenario: 'clear' | 'mixed') {}
  async interpret(input: InterpreterInput): Promise<InterpreterBatch> {
    const tomorrow = resolveCalendar({kind: 'DAY_OFFSET', days: 1}, input.capturedAt, input.timeZone);
    const nextMonday = resolveCalendar({kind: 'NEXT_WEEK_WEEKDAY', weekday: 0}, input.capturedAt, input.timeZone);
    const dateOf = (value: ReturnType<typeof resolveCalendar>) => 'date' in value ? value.date : null;
    const batch: InterpreterBatch = {schemaVersion: '1.1', inputId: input.inputId, operations: [
      {opId: 'group', action: 'CREATE_GROUP', tempId: 'quotes', title: 'Cotizaciones para revisión', evidence: 'Escenario simulado'},
      ...['Acrílicos', 'Pintado', 'Instalación de letreros', 'Fabricación de letreros'].map((title, i) => ({opId: `quote-${i}`, action: 'CREATE' as const, evidence: 'Escenario simulado',
        fields: {title: `Cotización de ${title.toLowerCase()}`, category: 'WORK' as const, type: 'TASK' as const,
          dueDate: input.localDate, dueTime: null, reservedDurationMinutes: null, groupRef: 'quotes'}})),
      {opId: 'doctor', action: 'CREATE', evidence: 'Escenario simulado', fields: {title: 'Cita médica', category: 'HEALTH', type: 'COMMITMENT',
        dueDate: dateOf(tomorrow), dueTime: this.scenario === 'mixed' ? null : '16:00', reservedDurationMinutes: null, groupRef: null}},
      {opId: 'thesis', action: 'CREATE', evidence: 'Escenario simulado', fields: {title: 'Reunión con asesor de tesis', category: 'EDUCATION', type: 'COMMITMENT',
        dueDate: dateOf(nextMonday), dueTime: null, reservedDurationMinutes: null, groupRef: null}}
    ], clarifications: this.scenario === 'mixed' ? [{id: 'doctor-time', reason: 'AMBIGUOUS_TIME', question: '¿La cita es a las 04:00 o a las 16:00?',
      expression: 'a las cuatro', affectedOpIds: ['doctor'], candidateIds: [], options: ['04:00', '16:00'], dateRange: null}] : []};
    return batch;
  }
}
export class FixtureVoiceProvider implements VoiceProvider {
  async transcribe(input: VoiceInput) {return {text: 'Hoy tengo cuatro cotizaciones: acrílicos, pintado, instalación y fabricación de letreros. Mañana médico a las cuatro y el próximo lunes reunión de tesis.', language: 'es', context: input.context};}
}
