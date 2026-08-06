// Tipos mínimos do opus-recorder (o pacote não publica declarações). Só o que
// o chat usa: gravar do microfone e receber o OGG/Opus pronto no dataAvailable.
declare module 'opus-recorder' {
  interface RecorderOptions {
    encoderPath?: string;
    encoderApplication?: number;
    encoderSampleRate?: number;
    numberOfChannels?: number;
    streamPages?: boolean;
  }
  export default class Recorder {
    constructor(options?: RecorderOptions);
    /** O runtime entrega um typed array; declarado como ArrayBuffer para o
     *  Blob([data]) tipar limpo (o Blob aceita os dois em runtime). */
    ondataavailable: (data: ArrayBuffer) => void;
    start(): Promise<void>;
    stop(): Promise<void>;
    close(): void;
  }
}
