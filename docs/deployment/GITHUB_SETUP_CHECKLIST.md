# Checklist de configuração do GitHub

Feito **uma vez**. Objetivo: dar ao workflow os segredos de acesso à VPS. **Nenhum segredo
fica no repositório** — apenas em *GitHub Secrets* (criptografados, nunca impressos nos logs).

## 1. Cadastrar os Secrets
`Settings → Secrets and variables → Actions → New repository secret`. Crie:

| Secret | Obrigatório | Valor |
|---|---|---|
| `VPS_SSH_HOST` | ✅ | IP ou hostname da VPS |
| `VPS_SSH_USER` | ✅ | usuário SSH (ex.: `root` ou `deploy`) |
| `VPS_SSH_KEY` | ✅ | **chave privada** completa (`-----BEGIN OPENSSH PRIVATE KEY-----` … `-----END…-----`) |
| `VPS_SSH_KNOWN_HOSTS` | ⚠ recomendado | saída do `ssh-keyscan` (fixa a host key = conexão estrita) |
| `VPS_SSH_PORT` | opcional | porta SSH, só se **≠ 22** |

- [ ] Todos os secrets acima criados. **Sem** aspas extras; cole o conteúdo bruto (multi-linha para a chave).
- [ ] Se `VPS_SSH_KNOWN_HOSTS` não for definido, o workflow usa `accept-new` (TOFU no 1º contato) — funciona, mas fixar a host key é mais seguro.

## 2. Habilitar Actions
- [ ] `Settings → Actions → General → Allow all actions and reusable workflows`.
- [ ] `Workflow permissions`: **Read repository contents** é suficiente (o workflow não escreve no repo).

## 3. (Opcional) Aprovação manual para produção
Para exigir clique humano antes de publicar:
- [ ] `Settings → Environments → New environment: production` → *Required reviewers*.
- [ ] Descomente `environment: production` em `.github/workflows/deploy.yml`.

## 4. (Recomendado) Proteção da branch
- [ ] `Settings → Branches → Add rule` para `master`: exigir PR + checks verdes antes do merge.
      Assim todo deploy nasce de um merge revisado.

## 5. Reutilizar em outros projetos AHRIOS
Em outro repositório, crie `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on: { push: { branches: [master] }, workflow_dispatch: {} }
permissions: { contents: read }
jobs:
  deploy:
    uses: jeflash2026/projeto-reconstrua/.github/workflows/deploy-reusable.yml@master
    with:
      app_dir: /opt/OUTRO_PROJETO
      branch: master
      deploy_script: deploy.sh
    secrets:
      SSH_HOST: ${{ secrets.VPS_SSH_HOST }}
      SSH_USER: ${{ secrets.VPS_SSH_USER }}
      SSH_PRIVATE_KEY: ${{ secrets.VPS_SSH_KEY }}
      SSH_KNOWN_HOSTS: ${{ secrets.VPS_SSH_KNOWN_HOSTS }}
      SSH_PORT: ${{ secrets.VPS_SSH_PORT }}
```
- [ ] Cada projeto precisa do seu próprio `deploy.sh` em `app_dir` na VPS.
