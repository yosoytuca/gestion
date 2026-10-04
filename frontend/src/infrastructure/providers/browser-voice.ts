import type {VoiceRecorder,VoiceInput,VoiceProvider,TranscriptionResult} from '../../../../datos/contracts/voice/public';
import type {CaptureContext} from '../../../../datos/contracts/interpreter/public';
export class BrowserVoiceRecorder implements VoiceRecorder {
  private stream?:MediaStream;
  private recorder?:MediaRecorder;
  private chunks:Blob[]=[];
  private context?:CaptureContext;
  private generation=0;
  async start(context:CaptureContext) {
    this.cancel();const generation=this.generation;
    if(!globalThis.isSecureContext) throw new Error('El micrófono necesita HTTPS o localhost. Usa el enlace HTTPS del túnel.');
    if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined') throw new Error('Este navegador no permite grabar audio. Usa Chrome, Edge o Escribir.');
    let stream:MediaStream;
    try {stream=await navigator.mediaDevices.getUserMedia({audio:true});} catch(e) {
      throw new Error((e as Error).name==='NotAllowedError' ? 'Permite el micrófono en los permisos de este sitio y vuelve a tocarlo.' : 'No se pudo abrir el micrófono. Comprueba que esté conectado y disponible.');
    }
    if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new Error('Grabación cancelada.');}
    this.stream=stream;this.context=structuredClone(context);this.chunks=[];
    try {
      const mimeType=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
      this.recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined);
      this.recorder.ondataavailable=e=>{if(generation===this.generation && e.data.size)this.chunks.push(e.data);};
      this.recorder.onerror=()=>this.cancel();
      this.recorder.start(1000);
    } catch {this.cancel();throw new Error('No se pudo comenzar la grabación. Prueba otro navegador.');}
  }
  async stop():Promise<VoiceInput> {
    const recorder=this.recorder,context=this.context;
    if(!recorder || recorder.state==='inactive' || !context)throw new Error('No hay una grabación activa.');
    const generation=this.generation;
    return new Promise((resolve,reject)=>{
      recorder.onerror=()=>{this.cancel();reject(new Error('La grabación falló. Vuelve a intentarlo.'));};
      recorder.onstop=()=>{
        if(generation!==this.generation){reject(new Error('Grabación cancelada.'));return;}
        const audio=new Blob(this.chunks,{type:recorder.mimeType});this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.recorder=undefined;this.chunks=[];
        if(!audio.size || audio.size>10*1024*1024){reject(new Error('Audio vacío o demasiado grande. Graba una entrada más corta.'));return;}
        resolve({audio,context});
      };
      recorder.stop();
    });
  }
  cancel() {this.generation++;if(this.recorder?.state==='recording')this.recorder.stop();this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.recorder=undefined;this.chunks=[];}
}
export class HttpVoiceProvider implements VoiceProvider {
  constructor(private readonly transport:typeof fetch=globalThis.fetch.bind(globalThis)){}
  async transcribe(input:VoiceInput):Promise<TranscriptionResult> {
    if(typeof navigator!=='undefined' && navigator.onLine===false)throw new Error('Necesitas conexión para transcribir. Puedes escribir o crear manualmente.');
    let response:Response;
    try {response=await this.transport('/api/v1/voice/transcribe',{method:'POST',headers:{'Content-Type':input.audio.type,'X-Capture-Context':encodeURIComponent(JSON.stringify(input.context))},body:input.audio,signal:AbortSignal.timeout(75000)});} catch {throw new Error('No se pudo conectar para transcribir. Reintenta.');}
    let value:any;try {value=await response.json();} catch {throw new Error('El servicio de voz devolvió una respuesta inválida.');}
    if(!response.ok)throw new Error(value?.code==='ACCESS_DENIED' ? 'Gemini denegó acceso al proyecto. Revisa el acceso en Google AI Studio.' : value?.code==='NOT_CONFIGURED' ? 'Falta configurar AI_API_KEY en el servidor para transcribir e interpretar.' : value?.code==='RATE_LIMIT' ? 'El servicio de voz está ocupado. Reintenta en un momento.' : 'No se pudo transcribir el audio. Reintenta.');
    if(typeof value?.text!=='string' || !value.text.trim() || value.text.length>20000 || JSON.stringify(value.context)!==JSON.stringify(input.context))throw new Error('No se obtuvo una transcripción válida. Vuelve a hablar.');
    return {text:value.text,language:'es',context:input.context};
  }
}
