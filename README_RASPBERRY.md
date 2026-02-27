# 🍓 Guia de Instalação: Planka + WhatsApp Bridge no Raspberry Pi

Este guia detalha como configurar o ecossistema Planka com a Bridge de WhatsApp em um Raspberry Pi (especialmente testado em Pi 4/5 com 4GB+ RAM).

## 🚀 Requisitos Mínimos

- Raspberry Pi 4 ou superior.
- MicroSD de pelo menos 16GB (Classe 10 recomendado).
- Sistema Operacional: Raspberry Pi OS (64-bit recomendado).
- Conexão com a internet.

---

## 🛠️ Passo 1: Preparação Automática (Recomendado)

O projeto inclui um script de `setup.sh` que automatiza a instalação de dependências, configuração de Swap (essencial para builds no Pi) e Docker.

1. **Dê permissão de execução ao script:**

    ```bash
    chmod +x setup.sh
    ```

2. **Execute o setup:**

    ```bash
    ./setup.sh
    ```

> **O que este script faz?**
>
> - Atualiza o sistema (`apt update`).
> - Cria um arquivo de **Swap de 2GB** (evita erros de memória durante o `docker build`).
> - Instala **Docker** e **Docker Compose**.
> - Cria as pastas necessárias para persistência de dados em `./data`.
> - Clona o código fonte do Planka para builds customizados.
> - Gera um `.env` inicial.

---

## ⚙️ Passo 2: Configuração de Variáveis (.env)

Após o setup, você **deve** configurar suas credenciais no arquivo `.env`:

```bash
nano .env
```

Campos críticos para configurar:

- `PLANKA_SECRET_KEY`: Gere uma string aleatória longa.
- `BASE_URL`: O IP do seu Raspberry Pi (ex: `http://192.168.1.50:3001`).
- `BOARD_ID` e `LIST_ID`: IDs do Kanban onde as tarefas do WhatsApp cairão.
- `USER_WHITELIST_MAPPING`: Mapeamento de números de telefone permitidos.

---

## 📦 Passo 3: Inicialização

Com tudo configurado, suba os containers. A primeira execução pode demorar no Raspberry Pi devido à compilação das imagens:

```bash
docker compose up --build -d
```

### Serviços Iniciados

- **Planka (Kanban):** Porta `3001`
- **Bridge API (WhatsApp):** Porta `3000`
- **Postgres (Banco de Dados):** Interno
- **Backup Service:** Realiza backups automáticos a cada 10 minutos em `./data/backups`.

---

## 📱 Passo 4: Conectando o WhatsApp

1. Acompanhe os logs da Bridge para ver o QR Code:

    ```bash
    docker logs -f planka-bridge
    ```

2. Abra o WhatsApp no seu celular -> Aparelhos Conectados -> Conectar um Aparelho.
3. Escaneie o QR Code que aparecerá no terminal.

---

## 🛠️ Comandos Úteis

- **Ver status dos containers:** `docker ps`
- **Reiniciar tudo:** `docker compose restart`
- **Ver logs em tempo real:** `docker compose logs -f`
- **Espaço em disco:** Se o build falhar por falta de espaço, use `docker system prune -a` para limpar cache antigo.

---

## 🛡️ Dicas de Performance (Raspberry Pi)

- **Swap:** O `setup.sh` ativa 2GB de swap. Se você notar travamentos, certifique-se que o swap está ativo com `free -h`.
- **Cartão SD:** Use cartões de boa qualidade. Para performance máxima, considere rodar o sistema a partir de um SSD USB 3.0.
- **Limites de CPU/Memória:** No `docker-compose.yml`, já configuramos limites (ex: 512MB para Planka) para evitar que um serviço derrube o sistema inteiro.

---
*Mantido pelo Agente #2: Engenheiro de Infra & DevOps.*
