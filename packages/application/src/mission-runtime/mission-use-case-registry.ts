// ─────────────────────────────────────────────────────────────────────────────
// MISSION USE CASE REGISTRY — mapeia o NOME do Use Case/pipeline (vindo da intenção
// do Brain) para a MissionPipeline que o executa. Um Use Case isolado é um pipeline
// de um passo. Descoberta explícita: intenção desconhecida → não resolve (o runtime
// registra falha, nunca inventa comportamento).
// ─────────────────────────────────────────────────────────────────────────────
import type { MissionPipeline } from './mission-pipeline.js';

export class MissionUseCaseRegistry {
  private readonly pipelines = new Map<string, MissionPipeline>();

  register(pipeline: MissionPipeline): this {
    this.pipelines.set(pipeline.name, pipeline);
    return this;
  }

  resolve(name: string): MissionPipeline | null {
    return this.pipelines.get(name) ?? null;
  }

  names(): readonly string[] {
    return [...this.pipelines.keys()];
  }
}
