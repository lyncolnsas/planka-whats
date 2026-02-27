# 🚀 Planka + WhatsApp Bridge (Monorepo)

Este projeto integra o gerenciador de tarefas **Planka (Kanban)** com o **WhatsApp**, permitindo criar e gerenciar cards através de comandos de chat. Estruturado como um monorepo utilizando **Turborepo** e **Docker**.

---

## 🏗️ Arquitetura do Projeto

O sistema é dividido em componentes modulares para facilitar a manutenção e escalabilidade:

- **`apps/planka`**: Instância customizada do Planka Kanban.
- **`apps/bridge-api`**: Backend em **NestJS** que processa mensagens do WhatsApp e as converte em ações no Planka.
- **`packages/shared-types`**: Tipagem compartilhada em TypeScript para garantir consistência entre os serviços.
- **`docker-compose.yml`**: Orquestrador que gerencia containers de banco de dados (Postgres), a API principal, o Planka e serviços de backup.

---

## 🛠️ Tecnologias Utilizadas

- **Backend:** NestJS, BullMQ (Fila de processamento), TypeScript.
- **Frontend:** Planka (React/Redux).
- **Infraestrutura:** Docker, Docker Compose, Turborepo, pnpm.
- **Integração:** Evolution API / WhatsApp-Web.js.

---

## 🚀 Como Começar

### 1. Pré-requisitos

- Docker e Docker Compose instalados.
- [pnpm](https://pnpm.io/) instalado (opcional para desenvolvimento local).

### 2. Configuração

1. Clone este repositório.
2. Crie um arquivo `.env` na raiz baseado no `.env.example`.
3. Configure as credenciais do Planka e as permissões de números de WhatsApp.

### 3. Rodando o Projeto

Para subir todo o ecossistema:

```bash
docker compose up --build -d
```

---

## 📱 Funcionalidades da Bridge

A Bridge permite interagir com o Kanban via comandos no WhatsApp:

- `!add <titulo>`: Adiciona um novo card à lista configurada.
- *Em desenvolvimento:* Comandos para listar cards do dia, mover colunas e ajuda.

---

## 🍓 Instalação no Raspberry Pi

Para usuários de Raspberry Pi, siga o guia detalhado e utilize o script de automação:
👉 **[Guia Raspberry Pi](./README_RASPBERRY.md)**

---

## 📄 Licença

Este projeto é desenvolvido para uso privado e integração de ferramentas open-source. Verifique as licenças individuais do Planka e das bibliotecas utilizadas.

---
*Gerenciado pelo time de Agentes AI (Arquiteto, Infra, Backend e QA).*
