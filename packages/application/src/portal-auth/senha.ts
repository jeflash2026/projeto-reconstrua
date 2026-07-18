// ─────────────────────────────────────────────────────────────────────────────
// AUTH RUNTIME COMPARTILHADO (GO-LIVE-04) · SENHAS — hash forte (scrypt + salt
// aleatório) e verificação em tempo constante. NUNCA se armazena senha em claro;
// o formato versionado ('s1:salt:hash') permite evoluir o esquema sem migração
// destrutiva. Comum a QUALQUER portal com credencial própria (advogado, perito…).
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SENHA_MINIMA = 8;

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `s1:${salt}:${hash}`;
}

export function verificarSenha(senha: string, armazenada: string): boolean {
  const [versao, salt, hash] = armazenada.split(':');
  if (versao !== 's1' || salt === undefined || hash === undefined || senha === '') return false;
  const candidato = scryptSync(senha, salt, 64).toString('hex');
  const a = Buffer.from(candidato);
  const b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}
