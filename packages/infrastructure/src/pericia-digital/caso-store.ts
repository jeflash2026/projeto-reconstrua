// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · CASO (persistência). Agrega o estado do caso: dados
// âncora, fichas, achados, documentos, quesitos, versões da minuta e a aprovação
// do perito. Store sobre o JsonStore homologado (ns 'pericia-caso').
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Achado,
  DadosAprovacaoPerito,
  DadosDoCaso,
  FichaContrato,
  Quesito,
  StatusPericia,
} from '@reconstrua/application';
import type { JsonStore } from '../production/json-store.js';
import type { DocumentoPericial } from './documento-pericial.js';

export interface VersaoMinuta {
  readonly versao: number;
  readonly geradoEm: string;
  readonly texto: string;
  readonly hash: string;
}

export interface AprovacaoPericial {
  readonly perito: DadosAprovacaoPerito;
  readonly aprovadoEm: string;
  /** Hash SHA-256 da versão da minuta que foi aprovada/assinada. */
  readonly hashVersao: string;
  readonly assinadoEm: string | null;
}

export interface CasoPericial {
  readonly id: string;
  readonly numeroCaso: string;
  readonly chatId: string;
  readonly status: StatusPericia;
  readonly dados: DadosDoCaso;
  readonly fichas: readonly FichaContrato[];
  readonly achados: readonly Achado[];
  readonly documentos: readonly DocumentoPericial[];
  readonly quesitos: readonly Quesito[];
  readonly minutaVersoes: readonly VersaoMinuta[];
  readonly aprovacao: AprovacaoPericial | null;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
}

const NS = 'pericia-caso';

export interface CasoStore {
  salvar(caso: CasoPericial): Promise<void>;
  porId(id: string): Promise<CasoPericial | null>;
  porChat(chatId: string): Promise<CasoPericial | null>;
  todos(): Promise<readonly CasoPericial[]>;
}

export class JsonCasoStore implements CasoStore {
  constructor(private readonly json: JsonStore) {}
  salvar(caso: CasoPericial): Promise<void> {
    return this.json.put(NS, caso.id, caso);
  }
  async porId(id: string): Promise<CasoPericial | null> {
    return (await this.json.get(NS, id)) as CasoPericial | null;
  }
  async porChat(chatId: string): Promise<CasoPericial | null> {
    const todos = await this.todos();
    return todos.find((c) => c.chatId === chatId) ?? null;
  }
  async todos(): Promise<readonly CasoPericial[]> {
    return (await this.json.list(NS)) as CasoPericial[];
  }
}
