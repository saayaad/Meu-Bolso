# Meu Bolso - Aplicativo Web de Gestão Financeira Pessoal e Familiar

O **Meu Bolso** é um aplicativo web completo, moderno e responsivo (mobile-first), instalável como PWA (Progressive Web App), voltado para a gestão financeira individual e familiar compartilhada (casal/família).

---

## 🚀 Funcionalidades Implementadas

1. **Autenticação e Contas (Firebase Auth):**
   - Login e cadastro com e-mail/senha ou Google One-Click (`signInWithPopup`).
   - Indicador de força de senha, confirmação de senha e consentimento obrigatório dos Termos de Uso e LGPD com data/hora.
   - Envio de e-mail de verificação e recuperação de senha.
   - Tradução completa de todos os erros do Firebase Auth para o português do Brasil.
   - Perfil com upload de foto com compressão automática no cliente para até 512px.
   - Preferência de moeda (BRL, USD, EUR) formatada via `Intl.NumberFormat`.
   - Idempotência no primeiro acesso: criação automática do usuário, workspace pessoal, categorias padrão com regra 50/30/20 e conta inicial "Carteira".

2. **Lançamentos (Entradas, Saídas e Transferências):**
   - Modal rápido e Bottom Sheet no mobile.
   - Máscara de moeda da direita para a esquerda (guardada estritamente como inteiro em centavos - `amountCents`).
   - Situação com data de vencimento obrigatória para contas pendentes ("Pagar depois" / "A receber").
   - Detecção automática de faturas de cartão de crédito: lançamentos em cartão nascem pendentes com vencimento calculado pelo ciclo de fechamento e vencimento do cartão.
   - Parcelamento inteligente em até 48x com sufixo `(1/N)`, IDs determinísticos e ajuste de arredondamento de centavos na primeira parcela.
   - Recorrências automáticas (semanal, mensal, anual) geradas para os próximos 3 meses com IDs determinísticos sem duplicidades.
   - Anexo de comprovantes e notas fiscais com compressão automática de imagem para até 1600px e limite de 5 MB.
   - Suporte a tags livres, observações, duplicar, editar e excluir (com escopo: somente esta, esta e as próximas, ou todas).

3. **Dashboard e Gráfico Geral de Gastos:**
   - Seletor de mês com navegação anterior/próximo e atalho para o mês atual.
   - Resumo geral em cards: Saldo Atual (patrimônio líquido sem cartões), Entradas, **TOTAL GASTO** em destaque (com divisão entre pago e a pagar), Saldo do Mês, A Pagar, A Receber, Maior Gasto, Média Diária de Gastos, Previsão de Saldo no Fim do Mês e Taxa de Poupança (%).
   - **Gráfico Geral de Gastos (Principal):** Gráfico de barras horizontais detalhado onde cada barra é uma despesa com a legenda da descrição, colorida pela categoria e tooltip com todas as informações. Alternância instantânea de visão: "Por lançamento", "Por categoria" (rosca) e "Por dia".
   - Gráfico de evolução de fluxo de caixa e patrimônio dos últimos 6 meses.
   - Próximos vencimentos, progresso dos orçamentos e últimos lançamentos.

4. **Contas a Pagar e a Receber & Calendário:**
   - Abas "A pagar" e "A receber".
   - Seções inteligentes: Vencidas (vermelho), Vencem hoje (amarelo), Próximos 7 dias, Este mês e Próximos meses, com totais por seção e botão de 1 clique para quitar.
   - Calendário mensal interativo com marcadores visuais (pontos vermelhos para contas a pagar e verdes para contas a receber) e visualização das contas do dia selecionado.
   - Central de notificações no app (ícone de sino com contador) para contas vencidas e a vencer.

5. **Contas, Carteiras e Cartões de Crédito:**
   - CRUD de contas bancárias, poupança, investimentos e cartões com cores e ícones.
   - Transferência entre contas com histórico vinculado.
   - Cartões de crédito com barra visual de uso de limite (utilizado vs disponível).
   - Navegação mês a mês das faturas do cartão de crédito agrupadas por ciclo.
   - Botão "Pagar fatura" para liquidar despesas do cartão debitando de uma conta à escolha.

6. **Orçamentos e Metas de Economia:**
   - 3 modos de orçamento selecionáveis:
     - **Por categoria:** limite mensal por categoria com barra de progresso colorida e alerta percentual configurável.
     - **Regra 50/30/20:** compara gastos reais por bucket (Necessidades 50%, Desejos 30%, Poupança 20%) com as receitas do mês.
     - **Base Zero:** distribui a renda total do mês entre tetos até zerar o valor não alocado.
   - Metas de economia com valor alvo, prazo, cálculo de aporte mensal necessário, histórico de aportes e celebração com confetes ao atingir 100%.

7. **Insights Locais e Previsão (Sem IA Paga):**
   - Previsão de saldo no fim do mês considerando pendências futuras.
   - Alertas inteligentes de variação de gastos (> 20% em relação ao mês anterior).
   - Identificação da categoria que mais pesa no orçamento e total de assinaturas recorrentes.
   - Sugestões de corte de gastos: economia potencial de 10% e 20% nas 3 maiores categorias de despesas variáveis.

8. **Importação e Exportação:**
   - Importador de extrato **OFX** nativo (compatível com SGML e XML dos bancos brasileiros).
   - Importador de **CSV** com suporte a formatos numéricos brasileiros (1.234,56), datas (DD/MM/AAAA) e mapeador visual de colunas.
   - Pré-visualização com detecção de lançamentos duplicados e sugestão inteligente de categorias por palavras-chave.
   - Exportação em **PDF** formatado com resumo e tabelas (jsPDF + autoTable).
   - Exportação em **Excel (.xlsx)** e **CSV** com separador ponto-e-vírgula e UTF-8 BOM (compatível diretamente com o Excel no Brasil).
   - Backup e Restauração completa em **JSON** validado.

9. **Compartilhamento Familiar / Casal:**
   - Dono do workspace gera códigos de convite com permissão "Editor" ou "Visualizador" com validade de 7 dias.
   - Entrada rápida por código de convite.
   - Gerenciamento de membros e identificação de quem registrou cada lançamento.

10. **Segurança, PIN e LGPD:**
    - Bloqueio por PIN de 4 a 6 dígitos com hash saltado via Web Crypto (`PBKDF2`). O PIN nunca trafega em texto puro.
    - Bloqueio por inatividade (1, 5 ou 15 min) e ao voltar do segundo plano.
    - Proteção contra força bruta (5 tentativas erradas desconectam a sessão).
    - Suporte a biometria WebAuthn.
    - Telas de Termos de Uso e Política de Privacidade compatíveis com a LGPD.
    - "Exportar meus dados" e "Excluir minha conta e meus dados" (com confirmação por digitação).

11. **PWA e Suporte Offline:**
    - Web App Manifest configurado com tema escuro (#0A0A0A) e laranja (#D97757).
    - Service Worker via `vite-plugin-pwa` para cache do shell.
    - Suporte a persistência local offline do Firestore.

---

## 🛠️ Como Configurar o Firebase e Rodar Localmente

### 1. Criar o Projeto no Firebase Console
1. Acesse [Firebase Console](https://console.firebase.google.com/) e crie um novo projeto.
2. No menu lateral, ative os seguintes serviços:
   - **Authentication**:
     - Ative o provedor **E-mail/senha**.
     - Ative o provedor **Google**.
     - Em *Configurações do Authentication > Domínios autorizados*, certifique-se de adicionar o domínio onde o aplicativo estiver rodando (ex: `localhost`, domínio do Cloud Run ou sua URL de hospedagem).
   - **Firestore Database**:
     - Crie um banco de dados no modo de produção.
   - **Storage**:
     - Ative o Firebase Storage para upload de anexos e fotos.

### 2. Publicar as Regras de Segurança
Copie o conteúdo dos arquivos incluídos neste projeto:
- Cole o conteúdo de `firestore.rules` na aba **Regras** do Cloud Firestore no Firebase Console e clique em **Publicar**.
- Cole o conteúdo de `storage.rules` na aba **Regras** do Storage no Firebase Console e clique em **Publicar**.

### 3. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (baseado em `.env.example`) com as credenciais da aplicação Web do seu Firebase Console:

```env
VITE_FIREBASE_API_KEY="sua_api_key_aqui"
VITE_FIREBASE_AUTH_DOMAIN="seu-projeto.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="seu-projeto-id"
VITE_FIREBASE_STORAGE_BUCKET="seu-projeto.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="seu_messaging_sender_id"
VITE_FIREBASE_APP_ID="seu_app_id"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"
```

*(Nota: No ambiente do AI Studio, essas credenciais são injetadas automaticamente no arquivo `firebase-applet-config.json`).*

### 4. Instalar Dependências e Executar

```bash
# Instalar dependências
npm install

# Executar testes unitários
npm run test

# Executar servidor de desenvolvimento
npm run dev
```

Abra `http://localhost:3000` no seu navegador.

### 5. Compilar para Produção

```bash
npm run build
```

---

## ⚠️ Limitações Conhecidas
- **Notificações com o app fechado (Push em segundo plano):** A Web Notification API do navegador funciona enquanto o aplicativo estiver aberto ou em segundo plano na mesma sessão. Notificações com o navegador totalmente fechado em dispositivos móveis exigiriam configuração de Firebase Cloud Messaging (FCM) integrada a Cloud Functions de backend agendadas, fora do escopo de um frontend SPA autônomo.
