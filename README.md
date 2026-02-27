# 🚀 Planka + WhatsApp Bridge (Raspberry Pi Edition)

Este projeto transforma seu Raspberry Pi em uma central de produtividade, integrando o **Planka Kanban** com comandos de **WhatsApp**.

---

## 🛠️ Ferramentas de Manutenção (As Chaves do Reino)

Para garantir que sua instalação funcione sempre de forma limpa, criamos dois scripts mestres:

### 1. 🌟 `install.sh` (Instalação e Atualização)

Use este script para instalar o sistema pela primeira vez ou para atualizar após um reset.

- **O que ele faz:** Libera a porta 80, instala Docker, configura IP DHCP automaticamente, gera senhas seguras e sobe os containers.
- **Como rodar:**

  ```bash
  chmod +x install.sh && ./install.sh
  ```

### 2. ☢️ `reset_total.sh` (Limpeza de Fábrica)

Use este script se algo der errado ou se quiser mudar o Raspberry Pi de rede/localidade.

- **O que ele faz:** Apaga TODOS os dados, remove o banco de dados, deleta configurações (`.env`) e limpa o cache do Docker. Deixa a pasta "virgem".
- **Como rodar:**

  ```bash
  chmod +x reset_total.sh && ./reset_total.sh
  ```

---

## 🍎 Guia de Instalação Rápida

Se você acabou de clonar o repositório ou quer reinstalar do zero:

```bash
# Se a pasta já existir, remova-a antes
sudo rm -rf planka-whats

# Clone e Instale
git clone https://github.com/lyncolnsas/planka-whats.git
cd planka-whats
chmod +x install.sh
./install.sh
```

---

## 📱 Primeiros Passos Pós-Instalação

1. **Acesso Web**: Acesse `http://IP_DO_SEU_PI` (Sem porta, direto no IP).
2. **Login**:
   - 📧 `admin@example.com`
   - 🔑 `password`
3. **WhatsApp**: Escaneie o QR Code rodando:

   ```bash
   sudo docker logs -f planka-bridge
   ```

4. **Configuração Final**: Após criar seu Quadro no Planka, pegue os IDs na URL e coloque no seu arquivo `.env`, depois rode `./install.sh` novamente para aplicar.

---
*Mantido pelos Agentes de Sistemas (Arquiteto & Infra).*
