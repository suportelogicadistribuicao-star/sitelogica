# Lógica Distribuição — Site Institucional

Site institucional B2B da **Lógica Distribuição**, empresa de distribuição de alimentos e bebidas que conecta grandes indústrias ao varejo no Sul de Minas Gerais. O site permite que lojistas e compradores naveguem pelo portfólio de marcas distribuídas, visualizem catálogos de produtos e entrem em contato comercial via WhatsApp.

---

## Visão Geral

| Item | Detalhe |
|---|---|
| **Empresa** | Lógica Distribuição |
| **Tagline** | O elo perfeito entre a indústria e o varejo |
| **Região de Atuação** | Sul de Minas Gerais — Pouso Alegre / MG |
| **Endereço** | `https://www.logicadistribuicao.com.br/` (KingHost, pasta `/www/`) |
| **Tecnologia** | HTML, CSS e JavaScript vanilla; animação de abertura em TypeScript + GSAP, empacotada com Vite |
| **Público-Alvo** | Donos de varejo, compradores de supermercado, food service |

Entre outubro e novembro de 2026 o site foi mantido dentro do repositório
`Front-End-Froneri-Site`, junto com o Portal RGV, e lá ganhou as imagens em
`.webp`, a animação de abertura e o botão do portal. Em 24/11/2026 os dois
foram separados e essa versão voltou para cá.

---

## Funcionalidades

- **Intro animada** — Splash screen com logo e tagline, encerrada automaticamente após 2,6s ou por interação do usuário
- **História de abertura** — Animação guiada por scroll: as marcas chegam ao celular do vendedor, o pedido é criado, vai para o caminhão e segue a rota até a loja
- **Navegação responsiva** — Menu fixo no desktop e menu hambúrguer deslizante no mobile
- **Acesso ao Portal RGV** — Botão "Acessar portal" no cabeçalho e no menu mobile, que abre `https://logicargv.logicadistribuicao.com.br/` (outro projeto: repositório `Front-End-Froneri-Site`)
- **Grid de marcas** — Exibe as 23 marcas do portfólio com logo e nome
- **Catálogo interativo** — Ao clicar em uma marca, abre um carrossel com as páginas do catálogo daquela marca (suporte a swipe em dispositivos touch)
- **Lightbox de imagens** — Clique em qualquer página do catálogo para visualizá-la em tamanho real
- **Seção sobre** — Apresenta os diferenciais da distribuidora para indústria, varejo e ponto de venda
- **Contato e localização** — Cards de contato comercial e RH via WhatsApp, mapas interativos dos dois endereços
- **Links sociais** — Instagram, LinkedIn, Facebook e WhatsApp

---

## Estrutura de Arquivos

```
sitelogica/
├── index.html                    # Página principal (única página)
├── public/                       # Vai para o servidor como está, sem passar pelo Vite
│   ├── .htaccess                 # Regras do Apache em /www/ (ver "Hospedagem")
│   └── assets/
│       ├── css/
│       │   └── style.css         # Estilos globais
│       ├── js/
│       │   ├── script.js         # Entry point — importa e inicializa o app
│       │   └── modules/
│       │       ├── main.js           # Orquestração — chama todos os módulos
│       │       ├── intro.js          # Animação da splash screen
│       │       ├── mobile-menu.js    # Menu hambúrguer mobile
│       │       ├── catalog.js        # Carrossel de catálogos por marca
│       │       ├── catalog-modal.js  # Lightbox para visualização de imagens
│       │       └── catalog-data.js   # Base de dados de marcas e páginas de catálogo
│       └── images/
│           ├── logo/
│           │   └── logo-logica.png   # Logo principal da empresa
│           ├── marcas/               # 23 logos das marcas distribuídas (.webp)
│           └── catalogos/            # Imagens de páginas de catálogos (.webp)
├── src/site/                     # Animação de abertura — empacotada pelo Vite
│   ├── story.ts / story.css      # Roteiro da história guiada por scroll
│   └── palco.ts / palco.css      # Cena (celular, pedido, caminhão, rota)
├── package.json                  # Vite, TypeScript e GSAP
└── .github/workflows/
    └── deploy-kinghost.yml       # Build + envio por FTPS para a KingHost
```

O Git não converte fim de linha neste repositório (`.gitattributes`): os
arquivos de `public/assets` vão para o servidor byte a byte.

---

## Marcas Distribuídas

O site exibe o portfólio completo de 23 marcas, organizadas em grid responsivo:

| Com catálogo disponível | Em preparação |
|---|---|
| Ana Maria | Melhor Bocado |
| Bacio di Latte | Santa Helena |
| Bom Destino | Danúbio |
| Crocantíssimo | Faixa Azul |
| Da Terrinha | Froneri |
| Dadinho | |
| Erlan | |
| MUAI | |
| Nutrella | |
| Pratic Leve | |
| Pullman | |
| Rap10 | |
| Reserva One | |
| Shamara | |
| Spres | |
| Verde Campo | |
| Vigor | |
| Vovó Clara | |

---

## Arquitetura JavaScript

O JavaScript do site (`public/assets/js`) é modular, usando ES6 `import/export` sem bundler.

```
script.js
  └── main.js (initApp)
        ├── intro.js          → initIntro()
        ├── catalog.js        → initCatalogSection()
        ├── mobile-menu.js    → initMobileMenu()
        └── catalog-modal.js  → initCatalogModal()
```

O `main.js` também gerencia eventos globais (tecla `Escape` para fechar modal e menu, links âncora que abrem a seção de catálogo).

A animação de abertura (`src/site`) é a única parte em TypeScript: o
`index.html` carrega `/src/site/story.ts`, que usa GSAP, e o Vite gera para
ela um `.js` e um `.css` com hash no nome.

---

## Design & Estilo

**Paleta de cores (variáveis CSS):**

| Variável | Cor |
|---|---|
| `--orange` | `#f5821f` |
| `--purple` | `#9f279b` |
| `--green` | `#8cc63f` |
| `--black` | `#080808` |
| `--cream` | `#fbf7f1` |

**Recursos visuais:**
- Efeitos glassmorphism (`backdrop-filter: blur`)
- Gradientes com as cores da marca
- Animações CSS (flutuação, transições suaves)
- Sombras em camadas para profundidade

**Breakpoints responsivos:**

| Breakpoint | Comportamento |
|---|---|
| `> 1100px` | Grid de marcas com 5 colunas |
| `≤ 1100px` | Grid com 3 colunas |
| `≤ 860px` | Menu hambúrguer, grid com 2 colunas |
| `≤ 520px` | Layout em coluna única |

---

## Seções da Página

1. **Intro** — Splash screen animada
2. **Header** — Navegação fixa com logo, CTA "Fale conosco" e botão "Acessar portal"
3. **História** — Abertura guiada por scroll (marcas → pedido → caminhão → loja)
4. **Indústrias** — Grid de 23 marcas clicáveis
5. **Catálogo** — Carrossel dinâmico gerado ao selecionar uma marca
6. **Sobre** — Diferenciais da empresa para cada elo da cadeia
7. **Contato** — WhatsApp comercial, WhatsApp RH e mapas dos endereços
8. **Footer** — Copyright e redes sociais

---

## Contato & Endereços

**Escritório Administrativo**
Av. Mal. Castelo Branco, 310 — Centro, Pouso Alegre - MG, 37550-000

**Centro de Distribuição (CD)**
Av. Pinto Cobra, 1106 — Guanabara, Pouso Alegre - MG, 37554-330

**WhatsApp Comercial:** +55 35 99139-0916

**Redes Sociais:** Instagram · LinkedIn · Facebook · WhatsApp

---

## Como Executar

Desde 24/11/2026 o projeto usa o Vite (por causa da animação de abertura),
então precisa do Node.js instalado:

```bash
npm install
npm run dev       # http://localhost:5173/
npm run build     # dist/, o que vai para a KingHost
```

Abrir o `index.html` direto, ou com Live Server, não carrega a animação.

---

## Deploy

Push na branch `prod` → [deploy-kinghost.yml](.github/workflows/deploy-kinghost.yml)
builda e envia `dist/` por FTPS para `/www/`. Também dá para disparar à mão em
Actions → "Run workflow".

O trabalho do dia a dia fica na `main`; publicar é levar a `main` para a
`prod`:

```bash
git push origin main:prod
```

**Antes do primeiro deploy** (uma vez): em Settings → Environments, criar o
environment `producao` e, dentro dele, o secret `KINGHOST_FTP_PASSWORD` com a
senha do usuário FTP `logicadistribuicao` (a mesma que o
`Front-End-Froneri-Site` usa). Sem o secret o workflow falha no envio.

---

## Hospedagem compartilhada com os subdomínios

A KingHost guarda cada subdomínio numa subpasta de `/www/`
(`/www/logicargv/` é o Portal RGV; há pastas de outros projetos da empresa).
Dois cuidados mantêm este site sem interferir neles:

- **Arquivos.** A action de FTP só apaga o que ela mesma publicou (a lista
  fica em `/www/.ftp-deploy-sync-state.json`). Nunca ligar a opção
  `dangerous-clean-slate` no workflow, e nunca criar em `public/` uma pasta
  com o nome de um subdomínio.
- **`.htaccess`.** O Apache aplica o `.htaccess` de `/www/` a todas as
  subpastas. Por isso as regras de reescrita e os cabeçalhos de
  [public/.htaccess](public/.htaccess) só valem quando o endereço é
  `logicadistribuicao.com.br` ou `www.logicadistribuicao.com.br`. Regra nova
  nesse arquivo tem de vir depois da condição do domínio (reescrita) ou
  levar `env=SITE_PRINCIPAL` (cabeçalho).

`/portal.html`, o endereço antigo do portal, redireciona para o subdomínio.

### Conferir depois de um deploy que mexeu no `.htaccess`

```bash
curl -sI https://www.logicadistribuicao.com.br/                    # 200, com X-Frame-Options
curl -sI https://www.logicadistribuicao.com.br/portal.html         # 302 para logicargv...
curl -sI https://logicargv.logicadistribuicao.com.br/              # 200
curl -sI https://logicargv.logicadistribuicao.com.br/nao-existe    # não pode ser 500
```

Se o site principal responder 500 logo depois de um deploy, a causa é o
`.htaccess`: volte o arquivo no Git para a versão anterior e publique de
novo. Se precisar do site no ar antes disso, sobrescreva `/www/.htaccess`
por FTP com a versão anterior.

---

## Licença
Logica Distribuição LTDA


Projeto proprietário — Lógica Distribuição. Todos os direitos reservados.
