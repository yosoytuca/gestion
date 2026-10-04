import type {TranscriptionResult, VoiceInput, VoiceProvider} from '../../../../datos/contracts/voice/public';
export class MockVoiceProvider implements VoiceProvider {
  constructor(private readonly text: string) {}
  async transcribe(input: VoiceInput): Promise<TranscriptionResult> {
    return {text: this.text, language: 'es', context: structuredClone(input.context)};
  }
}
