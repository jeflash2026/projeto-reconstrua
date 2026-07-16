# Checklist de configuração da VPS

Feito **uma vez**. Objetivo: permitir que o GitHub Actions faça SSH sem senha e rode `deploy.sh`.
Nenhum segredo é gerado ou guardado no repositório — as chaves ficam na VPS e no GitHub Secrets.

> Comandos abaixo assumem `root`. Se usar um usuário `deploy` dedicado, ajuste os caminhos de `~`.

## 1. Pré-requisitos na VPS
- [ ] Docker + Docker Compose v2 instalados (`docker --version`, `docker compose version`).
- [ ] Repositório clonado em `/opt/reconstrua` com o `deploy.sh` presente e o `.env` já configurado
      (o `deploy.sh` exige `.env`; ele **não** é versionado).
- [ ] Porta SSH acessível a partir da internet (default 22) ou porta customizada liberada no firewall.

## 2. Criar o par de chaves de deploy (sem senha)
Gere um par **dedicado** ao CI (não reutilize sua chave pessoal). Rode **na VPS** (ou local):
```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/.ssh/gha_deploy
```
Isso cria:
- `~/.ssh/gha_deploy`      → **chave PRIVADA** (vai para o GitHub Secret `VPS_SSH_KEY`).
- `~/.ssh/gha_deploy.pub`  → **chave PÚBLICA** (autorizada na VPS, passo 3).

## 3. Autorizar a chave pública na VPS
```bash
cat ~/.ssh/gha_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys && chmod 700 ~/.ssh
```
- [ ] Chave pública em `authorized_keys` do usuário que o CI usará (`VPS_SSH_USER`).

## 4. Capturar a host key (para StrictHostKeyChecking)
Fixe a identidade do host (recomendado). Rode em qualquer máquina com acesso:
```bash
ssh-keyscan -p 22 SEU_IP_OU_HOST 2>/dev/null
```
- [ ] Copie a(s) linha(s) de saída → GitHub Secret `VPS_SSH_KNOWN_HOSTS` (passo do checklist do GitHub).

## 5. Verificar o acesso não-interativo
Do seu computador, teste que a chave privada loga sem senha e roda o deploy:
```bash
ssh -i ~/.ssh/gha_deploy USER@HOST "cd /opt/reconstrua && git rev-parse --short HEAD && docker ps --format '{{.Names}}' | head"
```
- [ ] Loga **sem pedir senha** e lista o commit + containers.

## 6. Hardening recomendado (opcional, mas profissional)
- [ ] `PasswordAuthentication no` no `sshd_config` (só chave).
- [ ] Usuário `deploy` dedicado com permissão de `docker` (grupo `docker`), em vez de `root`.
- [ ] Restringir a chave a um comando (`command="..."` em `authorized_keys`) se quiser blindar ainda mais.
- [ ] Firewall permitindo SSH apenas do necessário.

## Resultado
Ao final você tem, para levar ao GitHub Secrets:
| Secret | De onde vem |
|---|---|
| `VPS_SSH_HOST` | IP/host da VPS |
| `VPS_SSH_USER` | usuário do passo 3 (ex.: `root` ou `deploy`) |
| `VPS_SSH_KEY` | conteúdo de `~/.ssh/gha_deploy` (chave **privada**, com `-----BEGIN...`) |
| `VPS_SSH_KNOWN_HOSTS` | saída do `ssh-keyscan` (passo 4) |
| `VPS_SSH_PORT` | porta SSH (só se ≠ 22) |
