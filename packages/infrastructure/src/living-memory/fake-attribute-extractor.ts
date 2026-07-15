// ─────────────────────────────────────────────────────────────────────────────
// PatternAttributeExtractor — extrator DETERMINÍSTICO de atributos (stand-in do LLM
// de percepção, para testes e modo offline). PROPÕE atributos (nome/profissão/
// cidade/familiar) a partir de padrões simples; nunca decide, nunca inventa Fato de
// domínio. Em produção, um LlmAttributeExtractor implementa o mesmo port.
// ─────────────────────────────────────────────────────────────────────────────
import type { MemoryAttributeExtractorPort, ProposedAttribute } from '@reconstrua/application';

const NAME = /(?:meu nome (?:é|e)|me chamo)\s+([a-zà-ú]+)/i;
const PROFESSION = /(?:sou|trabalho como|minha profiss(?:ã|a)o (?:é|e))\s+([a-zà-ú]+(?:\s+[a-zà-ú]+)?)/i;
const CITY = /(?:moro em|sou de|aqui em)\s+([a-zà-ú]+(?:\s+[a-zà-ú]+)?)/i;
const FAMILY = /\b(meu pai|minha m(?:ã|a)e|meu filho|minha filha|minha esposa|meu marido|meu irm(?:ã|a)o|minha irm(?:ã|a))\b/i;

export class PatternAttributeExtractor implements MemoryAttributeExtractorPort {
  extract(text: string): Promise<readonly ProposedAttribute[]> {
    const proposed: ProposedAttribute[] = [];
    const name = NAME.exec(text);
    if (name?.[1]) proposed.push({ key: 'name', value: name[1], confidence: 0.9 });
    const city = CITY.exec(text);
    if (city?.[1]) proposed.push({ key: 'city', value: city[1].trim(), confidence: 0.7 });
    const profession = PROFESSION.exec(text);
    if (profession?.[1] && !name) proposed.push({ key: 'profession', value: profession[1].trim(), confidence: 0.6 });
    const family = FAMILY.exec(text);
    if (family?.[1]) proposed.push({ key: 'family', value: family[1].toLowerCase(), confidence: 0.8 });
    return Promise.resolve(proposed);
  }
}
