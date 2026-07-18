// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — AUTH RUNTIME COMPARTILHADO (GO-LIVE-04): o único
// comportamento de autenticação da plataforma (tokens assinados por USO, senhas
// scrypt, provider do advogado). Cada portal define APENAS quem autentica, qual
// provider usa e quais permissões possui — todo o resto é comum (Lei 12).
// ─────────────────────────────────────────────────────────────────────────────
export * from './auth-tokens.js';
export * from './senha.js';
export * from './advogado-auth.js';
