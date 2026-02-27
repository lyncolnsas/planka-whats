# 🚀 Planka + WhatsApp Bridge (Monorepo)

Este projeto integra o gerenciador de tarefas **Planka (Kanban)** com o **WhatsApp**, permitindo criar e gerenciar cards através de comandos de chat. Estruturado como um monorepo utilizando **Turborepo** e **Docker**, otimizado para rodar em **Raspberry Pi** ou VPS.

---

## 🏗️ Arquitetura do Projeto

- **`Planka Core`**: Utiliza a imagem oficial otimizada (`ghcr.io/plankanban/planka`).
- **`apps/bridge-api`**: Backend em **NestJS** que processa mensagens do WhatsApp.
- **`packages/shared-types`**: Tipagem compartilhada para consistência total.
- **`docker-compose.yml`**: Orquestrador de serviços (Postgres, Planka, Bridge, Backup).

---

## 🍎 Guia de Instalação Rápida (Recomendado)

Para uma instalação totalmente autônoma que configura Docker, Rede, Banco de Dados e IP automaticamente:

```bash
git clone https://github.com/lyncolnsas/planka-whats.git
cd planka-whats
chmod +x install.sh
./install.sh
```

### O que o `install.sh` faz por você

1. **Limpeza Total**: Remove qualquer instalação falha anterior.
2. **Configuração de Sistema**: Instala Docker e configura Swap (vital para o Raspberry Pi).
3. **IP Automático**: Detecta o IP do roteador (DHCP) e configura o acesso web.
4. **Segurança**: Gera senhas de banco de dados e chaves secretas únicas.
5. **Performance**: Usa a imagem oficial do Planka, subindo o sistema em segundos.

---

## ⚠️ Deu algo errado? (Limpeza Radical)

Se a instalação travar ou você quiser começar do zero absoluto, use este comando para limpar todos os containers, volumes e configurações:

```bash
# Para resetar TUDO (CUIDADO: apaga banco de dados e arquivos)
sudo docker compose down -v --remove-orphans && sudo rm -rf ./data/* .env
```

Depois disso, basta rodar o `./install.sh` novamente.

---

## 📱 Primeiros Passos

### 1. Acesso Web

Acesse `http://IP_DO_SEU_PI:3001` no seu navegador.

- **Usuário Padrão**: `admin@example.com`
- **Senha Padrão**: `password`
*(Você deve criar sua conta de administrador no primeiro acesso com esses dados)*

### 2. Conectar WhatsApp

Para ver o QR Code e conectar seu celular:

```bash
sudo docker logs -f planka-bridge
```

### 3. Configurar Alvo (IDs)

Após acessar o Planka Web, pegue o `BOARD_ID` e `LIST_ID` na URL do seu quadro e atualize o arquivo `.env`. Depois, reinicie:

```bash
sudo docker compose up -d
```

---

## 📱 Comandos do WhatsApp

Uma vez conectado, use comandos de um número autorizado:

- `!add Título da Tarefa` - Cria um card no Kanban.
- `#ajuda` - Lista todos os comandos.

---

## 🏁 Guia Avançado

- [Passo a Passo Detalhado de Configuração](./PASSO_A_PASSO.md)
- [Guia de Performance (Raspberry Pi)](./README_RASPBERRY.md)

---
*Mantido pelo Agente #2: O Engenheiro de Infra.*
