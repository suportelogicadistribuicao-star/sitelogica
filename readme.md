# Lógica Distribuição — Site Institucional

Site institucional B2B da **Lógica Distribuição**, empresa de distribuição de alimentos e bebidas que conecta grandes indústrias ao varejo no Sul de Minas Gerais. O site permite que lojistas e compradores naveguem pelo portfólio de marcas distribuídas, visualizem catálogos de produtos e entrem em contato comercial via WhatsApp.

---

## Visão Geral

| Item | Detalhe |
|---|---|
| **Empresa** | Lógica Distribuição |
| **Tagline** | O elo perfeito entre a indústria e o varejo |
| **Região de Atuação** | Sul de Minas Gerais — Pouso Alegre / MG |
| **Tecnologia** | HTML, CSS e JavaScript vanilla (sem frameworks) |
| **Público-Alvo** | Donos de varejo, compradores de supermercado, food service |

---

## Funcionalidades

- **Intro animada** — Splash screen com logo e tagline, encerrada automaticamente após 2,6s ou por interação do usuário
- **Navegação responsiva** — Menu fixo no desktop e menu hambúrguer deslizante no mobile
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
├── assets/
│   ├── css/
│   │   └── style.css             # Estilos globais (~1660 linhas)
│   ├── js/
│   │   ├── script.js             # Entry point — importa e inicializa o app
│   │   └── modules/
│   │       ├── main.js           # Orquestração — chama todos os módulos
│   │       ├── intro.js          # Animação da splash screen
│   │       ├── mobile-menu.js    # Menu hambúrguer mobile
│   │       ├── catalog.js        # Carrossel de catálogos por marca
│   │       ├── catalog-modal.js  # Lightbox para visualização de imagens
│   │       └── catalog-data.js   # Base de dados de marcas e páginas de catálogo
│   └── images/
│       ├── logo/
│       │   └── logo-logica.png   # Logo principal da empresa
│       ├── marcas/               # 23 logos das marcas distribuídas
│       └── catalogos/            # 80+ imagens de páginas de catálogos
```

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

O JavaScript é modular, usando ES6 `import/export` sem bundler.

```
script.js
  └── main.js (initApp)
        ├── intro.js          → initIntro()
        ├── catalog.js        → initCatalogSection()
        ├── mobile-menu.js    → initMobileMenu()
        └── catalog-modal.js  → initCatalogModal()
```

O `main.js` também gerencia eventos globais (tecla `Escape` para fechar modal e menu, links âncora que abrem a seção de catálogo).

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
2. **Header** — Navegação fixa com logo e CTA "Fale conosco"
3. **Hero** — Headline principal, proposta de valor e stats (Indústria / Varejo / Lógica)
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

O projeto é um site estático — não requer build, bundler ou servidor específico.

**Opção 1 — Live Server (VS Code):**
Instale a extensão [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) e clique em "Go Live" com o `index.html` aberto.

**Opção 2 — Servidor local simples:**
```bash
# Python 3
python -m http.server 5500

# Node.js (npx)
npx serve .
```

Abra `http://localhost:5500` no navegador.

> **Atenção:** O site usa ES6 modules (`type="module"`). Abrir o `index.html` diretamente como arquivo (`file://`) não funcionará — é necessário um servidor local.

---

## Licença
Logica Distribuição LTDA


Projeto proprietário — Lógica Distribuição. Todos os direitos reservados.
