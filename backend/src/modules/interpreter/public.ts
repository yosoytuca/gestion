import type {InterpreterInput, InterpreterProvider} from '../../../../datos/contracts/interpreter/public';
export {RealInterpreterProvider, OpenAIProvider, InterpreterError, validateRequest, validateProposal} from './real';
export type {AIProvider} from './real';
export {GeminiProvider,geminiJSON,geminiSchema} from './gemini';

/** Explicit fixture provider: no parsing, inference or external calls. */
export class MockInterpreterProvider implements InterpreterProvider {
  constructor(private readonly response: unknown) {}
  async interpret(_input: InterpreterInput): Promise<unknown> {return structuredClone(this.response);}
}

export {GroqProvider} from './groq';
