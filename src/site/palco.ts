// Navegação do site dentro do palco da história (index.html).
//
// Ideia: o mapa do fim da história é o "mundo" do site. Cada seção mora
// num lugar desse mapa e navegar é mover a câmera até lá:
//   Indústrias  o centro de distribuição; as marcas são caixas numa
//               prateleira que sobe do chão. Escolher uma abre o catálogo.
//   Sobre       a câmera sobe e mostra a rede: a rota que chega da
//               indústria ao CD e se espalha para várias lojas.
//   Contato     os dois endereços (escritório e CD) em pé sobre o mapa.
//
// Como se move: as paradas ficam numa linha, 0 = Início, 1 = Indústrias e
// assim por diante. A posição nessa linha (`u`, com fração) decide tudo o
// que está na tela — é uma linha do tempo do GSAP percorrida por `u`, do
// mesmo jeito que o scroll percorre a história. O dedo, a roda, o teclado
// e o menu só dizem aonde `u` deve ir; uma mola amortecida leva até lá.
// Por isso arrastar acompanha o dedo, soltar continua na velocidade em que
// estava e nada dá tranco.
//
// No celular (tela estreita, em pé) nada rola dentro das salas: cada
// parada cabe na tela. Sobre e Contato têm dois tempos (texto, depois o
// mapa em tela cheia) e a prateleira vira um corredor que desliza de lado.
//
// O conteúdo é o das seções do index.html, MOVIDO para dentro do palco
// (nada é copiado): ids, classes e os listeners do catalog.js/main.js
// continuam valendo. Sem JS ou com movimento reduzido este módulo não roda
// e o site fica com as seções normais, uma abaixo da outra.
import { gsap } from 'gsap';

type Secao = 'inicio' | 'industrias' | 'sobre' | 'contato';

/** O que a história (story.ts) oferece ao palco. */
export interface Historia {
  story: HTMLElement;
  stage: HTMLElement;
  /** Leva a história ao último quadro e para de ouvir o scroll. */
  concluir(): void;
  /** Tira a altura extra da seção e põe a página no topo do palco. */
  recolher(): void;
  recolhida(): boolean;
  topoNaPagina(): number;
}

/** O que o palco oferece à história. */
export interface Palco {
  /** A história chegou ao último quadro pelo scroll. */
  historiaConcluiu(): void;
  /** O scroll continua depois do último quadro: `px` além dele. */
  alemDoFim(px: number): void;
  /** A página parou de rolar e não há dedo na tela. */
  paginaParou(): void;
}

// ---- mundo, nas unidades do desenho do mapa (o SVG da história) ----
// Trecho do desenho usado como chão. Cabe dentro do que o index.html
// desenha (x -1200 a 2200, y -1900 a 2200).
const MUNDO = { x: -1200, y: -850, w: 2950, h: 2300 };
const P = {
  cd: { x: 130, y: 540 },
  loja: { x: 860, y: 150 },
  lojaB: { x: 860, y: 680 },
  lojaC: { x: 420, y: 820 },
  fabrica: { x: -240, y: 260 },
  escritorio: { x: 420, y: 120 },
  centroRota: { x: 495, y: 345 },
};
// Seguem as ruas do desenho (horizontais a cada 140, verticais a cada 220).
const TRILHAS = {
  entrada: 'M-240 260 V516 Q-240 540 -216 540 H130',
  ramoB: 'M130 540 H836 Q860 540 860 564 V680',
  ramoC: 'M130 540 H396 Q420 540 420 564 V820',
};
// Retângulo que contém as três trilhas, com folga para a espessura.
const CAIXA_TRILHAS = { x: -256, y: 244, w: 1132, h: 592 };

const ANCORAS: Record<string, Secao | 'catalogo'> = {
  '#historia': 'inicio',
  '#industrias': 'industrias',
  '#catalogo': 'catalogo',
  '#sobre': 'sobre',
  '#contato': 'contato',
};
const NOMES: Record<Secao, string> = {
  inicio: 'Início',
  industrias: 'Indústrias',
  sobre: 'Sobre',
  contato: 'Contato',
};
const SECOES: Secao[] = ['inicio', 'industrias', 'sobre', 'contato'];

// ---- a linha do tempo entre duas paradas ----
// Em cada trecho (de uma parada até a seguinte, duração 1): primeiro sai
// o que estava na tela, no meio a câmera voa, no fim a parada seguinte se
// monta. Andar para trás desfaz na ordem inversa.
const SAIDA = { de: 0.015, ate: 0.3 };
const VOO = { de: 0.08, ate: 0.8 };
const ENTRADA = { de: 0.5, ate: 0.94 };

// Quanto a mola "puxa" (maior = mais rápida): colada no dedo enquanto ele
// arrasta, solta ao completar o gesto, calma nos passos da roda, do
// teclado e do menu.
const MOLA = { dedo: 30, solta: 8.5, passo: 5.4 };
// Fração da altura do palco que o dedo percorre para ir de uma parada à
// outra arrastando devagar.
const CURSO_TOQUE = 0.78;
// O mesmo para o trackpad, em px de scroll.
const CURSO_RODA = 700;

/**
 * PONTO DE AJUSTE — decide, quando o dedo solta, em que parada o palco vai
 * assentar. É aqui que se regula se o site é "leve" (qualquer deslize troca
 * de parada) ou "firme" (precisa arrastar bastante).
 *
 * @param u          onde o arrasto deixou o palco (2.4 = 40% do caminho
 *                   entre a parada 2 e a 3)
 * @param base       a parada em que o gesto começou
 * @param velocidade velocidade do dedo ao soltar, em paradas por segundo
 *                   (positiva = avançando)
 */
function decidirParada(u: number, base: number, velocidade: number): number {
  // Um peteleco decide pelo sentido, mesmo com pouco deslocamento. 0.4
  // parada por segundo é um deslize de uns 260px/s num celular comum:
  // qualquer movimento de polegar com intenção passa disso.
  const PETELECO = 0.4;
  // Sem peteleco (arrastou devagar e soltou), vale a distância: passou
  // de 30% do caminho, completa; menos que isso, volta.
  const DISTANCIA = 0.3;

  if (velocidade > PETELECO) return Math.ceil(u - 0.001);
  if (velocidade < -PETELECO) return Math.floor(u + 0.001);
  const d = u - base;
  return Math.abs(d) > DISTANCIA ? base + Math.sign(d) : base;
}

// ---- desenhos dos marcos (ficam em pé sobre o mapa) ----
const DESENHO = {
  cd: `<svg viewBox="0 0 92 70" width="92" height="70" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="46" cy="66" rx="40" ry="4" fill="#24102a" opacity=".22"/>
    <path d="M8 28 L46 9 L84 28 V64 H8 Z" fill="#fbf7f1" stroke="#24102a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M4 29 L46 7 L88 29" fill="none" stroke="#9f279b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="34" y="34" width="24" height="30" fill="#3a1b42"/>
    <path d="M34 41 H58 M34 48 H58 M34 55 H58" stroke="#5b2f63" stroke-width="2"/>
    <rect x="8" y="46" width="26" height="5" fill="#f5821f"/><rect x="58" y="46" width="26" height="5" fill="#f5821f"/>
    <rect x="8" y="51" width="26" height="5" fill="#9f279b"/><rect x="58" y="51" width="26" height="5" fill="#9f279b"/>
    <rect x="8" y="56" width="26" height="5" fill="#8cc63f"/><rect x="58" y="56" width="26" height="5" fill="#8cc63f"/>
  </svg>`,
  fabrica: `<svg viewBox="0 0 84 76" width="84" height="76" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="42" cy="72" rx="38" ry="4" fill="#24102a" opacity=".22"/>
    <rect x="58" y="6" width="12" height="62" rx="2" fill="#3a1b42" stroke="#24102a" stroke-width="3"/>
    <rect x="58" y="10" width="12" height="6" fill="#f5821f"/>
    <path d="M6 70 V36 L22 26 V36 L38 26 V36 L54 26 V36 L62 36 V70 Z" fill="#3a1b42" stroke="#24102a" stroke-width="3" stroke-linejoin="round"/>
    <rect x="13" y="46" width="10" height="9" rx="2" fill="#f5821f"/><rect x="29" y="46" width="10" height="9" rx="2" fill="#f5821f"/>
    <rect x="45" y="46" width="10" height="9" rx="2" fill="#fbf7f1"/>
    <rect x="21" y="58" width="18" height="12" fill="#8cc63f"/>
  </svg>`,
  escritorio: `<svg viewBox="0 0 60 92" width="60" height="92" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="88" rx="27" ry="4" fill="#24102a" opacity=".22"/>
    <rect x="8" y="6" width="44" height="80" rx="4" fill="#3a1b42" stroke="#24102a" stroke-width="3"/>
    <rect x="8" y="6" width="44" height="8" rx="3" fill="#9f279b"/>
    <g fill="#fbf7f1"><rect x="15" y="22" width="9" height="8" rx="1.5"/><rect x="36" y="22" width="9" height="8" rx="1.5"/>
    <rect x="15" y="37" width="9" height="8" rx="1.5"/><rect x="36" y="52" width="9" height="8" rx="1.5"/></g>
    <g fill="#f5821f"><rect x="36" y="37" width="9" height="8" rx="1.5"/><rect x="15" y="52" width="9" height="8" rx="1.5"/></g>
    <rect x="23" y="68" width="14" height="18" fill="#8cc63f"/>
  </svg>`,
  pino: `<svg viewBox="0 0 46 60" width="40" height="52" xmlns="http://www.w3.org/2000/svg">
    <path d="M23 59 C 23 59 3 36 3 22 A 20 20 0 0 1 43 22 C 43 36 23 59 23 59 Z" fill="#e5332a" stroke="#ffffff" stroke-width="3"/>
    <circle cx="23" cy="22" r="8" fill="#ffffff"/>
  </svg>`,
  caminhao: `<svg viewBox="0 0 34 18" width="34" height="18" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="21" height="12" rx="2" fill="#fbf7f1"/>
    <rect x="1" y="10" width="21" height="3" fill="#f5821f"/>
    <path d="M23 4 h5 q2 0 3 2 l2 4 v3 h-10 z" fill="#9f279b"/>
    <circle cx="7" cy="15" r="2.6" fill="#fbf7f1" stroke="#24102a" stroke-width="1.4"/>
    <circle cx="27" cy="15" r="2.6" fill="#fbf7f1" stroke="#24102a" stroke-width="1.4"/>
  </svg>`,
  voltar: `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 L5 8 L10 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

interface Camera {
  x: number; // ponto do mapa no centro da cena
  y: number;
  t: number; // inclinação (graus)
  s: number; // giro (graus)
  z: number; // aproximação
  fx: number; // centro da cena na tela (px, em relação ao palco)
  fy: number;
}

interface Parada {
  id: string;
  secao: Secao;
  pose: () => Camera;
}

interface Marco {
  el: HTMLElement; // posição na tela (palco.ts projeta o ponto do mapa)
  corpo: HTMLElement; // o que a linha do tempo anima (entra e sai)
  caixa: HTMLElement; // posição em relação ao ponto: acima dele, centrado
  p: { x: number; y: number };
  naTela: number; // altura na tela, no último quadro
  ordem: number; // z-index já escrito (quem está mais perto fica na frente)
}

interface SalaDom {
  el: HTMLElement;
  texto: HTMLElement;
  cena: HTMLElement;
}

const NS = 'http://www.w3.org/2000/svg';
const rad = Math.PI / 180;
const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

const criar = <K extends keyof HTMLElementTagNameMap>(tag: K, classe = '', html = '') => {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (html) el.innerHTML = html;
  return el;
};

export function iniciarPalco(historia: Historia): Palco | undefined {
  const { story, stage } = historia;
  const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

  // As seções de origem. Se alguma faltar, o site segue como sempre foi.
  const industrias = $('#industrias');
  const catalogo = $('#catalogo');
  const sobre = $('#sobre');
  const contato = $('#contato');
  const quadro = story.querySelector<HTMLElement>('.story-quadro');
  // Dois desenhos em .story-map: o mapa e, por cima, a rota.
  const mapas = story.querySelectorAll<SVGSVGElement>('.story-map > svg');
  if (!industrias || !catalogo || !sobre || !contato || !quadro || mapas.length < 2) return undefined;

  const celular = window.matchMedia('(max-width: 860px) and (orientation: portrait)');

  // =================================================================== DOM
  const palco = criar('div', 'palco');
  const mundo = criar('div', 'palco-mundo');
  mundo.setAttribute('aria-hidden', 'true');

  // ---- chão ----
  // O mapa é pintado uma vez num canvas e daí em diante só se move: a
  // câmera é o transform deste elemento. Um SVG no lugar seria redesenhado
  // pelo navegador a cada mudança de aproximação, e era isso que travava
  // os voos no celular.
  const chao = criar('div', 'palco-chao');
  const arte = document.createElement('canvas');
  arte.className = 'palco-chao-arte';
  // As trilhas (que se desenham em Sobre) ficam num SVG pequeno, só do
  // tamanho delas: animar o traço repinta esse pedaço, não o mapa.
  const trilhasSvg = document.createElementNS(NS, 'svg');
  trilhasSvg.setAttribute('class', 'palco-trilhas');
  trilhasSvg.setAttribute(
    'viewBox',
    `${CAIXA_TRILHAS.x} ${CAIXA_TRILHAS.y} ${CAIXA_TRILHAS.w} ${CAIXA_TRILHAS.h}`,
  );
  trilhasSvg.innerHTML = `<defs><linearGradient id="palcoRamoGradiente" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#9f279b"/><stop offset="1" stop-color="#f5821f"/>
    </linearGradient></defs>`;
  const trilhas = Object.entries(TRILHAS).map(([nome, d]) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', 'palco-trilha');
    p.setAttribute('stroke', nome === 'entrada' ? '#8cc63f' : 'url(#palcoRamoGradiente)');
    trilhasSvg.append(p);
    return p;
  });
  chao.append(arte, trilhasSvg);

  // O foco é o ponto da tela para onde a câmera olha. A perspectiva mora
  // nele: mover o foco é só um translate, que o navegador resolve sem
  // refazer camadas (mudar perspective-origin a cada quadro refazia).
  const foco = criar('div', 'palco-foco');
  foco.append(chao);

  // O que fica em pé no mapa não entra na cena 3D: fica numa camada plana
  // por cima, cada um no ponto da tela onde a câmera mostra o seu lugar
  // (ver projetar). Dentro da cena o Chrome desenhava o chão por cima.
  const camadaMarcos = criar('div', 'palco-marcos');
  mundo.append(foco, camadaMarcos);
  palco.append(mundo);

  // px de CSS por unidade do mapa (definido em pintarChao).
  let rho = 1;
  let dprPintado = 0;
  const pintarChao = () => {
    // Quantos pontos da tela por unidade do mapa. Mais que isso gasta
    // memória de vídeo sem ganho visível; no celular o limite é menor.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const toque = window.matchMedia('(pointer: coarse)').matches;
    let densidade = toque ? 1.15 : dpr >= 1.5 ? 1.5 : 1.25;
    const memoria = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (memoria && memoria <= 2) densidade = Math.min(densidade, 0.9);
    dprPintado = window.devicePixelRatio || 1;
    rho = densidade / dpr;

    arte.width = Math.round(MUNDO.w * densidade);
    arte.height = Math.round(MUNDO.h * densidade);
    chao.style.width = `${MUNDO.w * rho}px`;
    chao.style.height = `${MUNDO.h * rho}px`;
    Object.assign(trilhasSvg.style, {
      left: `${(CAIXA_TRILHAS.x - MUNDO.x) * rho}px`,
      top: `${(CAIXA_TRILHAS.y - MUNDO.y) * rho}px`,
      width: `${CAIXA_TRILHAS.w * rho}px`,
      height: `${CAIXA_TRILHAS.h * rho}px`,
    });

    // O mesmo desenho do mapa da história, com a rota principal já feita.
    const svg = mapas[0].cloneNode(true) as SVGSVGElement;
    svg.removeAttribute('style');
    svg.removeAttribute('class');
    svg.setAttribute('xmlns', NS);
    svg.setAttribute('viewBox', `${MUNDO.x} ${MUNDO.y} ${MUNDO.w} ${MUNDO.h}`);
    svg.setAttribute('width', String(arte.width));
    svg.setAttribute('height', String(arte.height));
    svg.setAttribute('preserveAspectRatio', 'none');
    // Fora da página o CSS não vale: a espessura vai no próprio traço.
    const tracejada = svg.querySelector('.story-route-ghost');
    tracejada?.setAttribute('stroke-width', '4');
    tracejada?.setAttribute('stroke-dasharray', '4 12');
    const gradiente = mapas[1].querySelector('defs')?.cloneNode(true);
    const rota = mapas[1].querySelector('.story-route')?.cloneNode(true) as SVGPathElement | undefined;
    const partida = mapas[1].querySelector('circle:not(.story-pulse)')?.cloneNode(true);
    if (gradiente) svg.prepend(gradiente);
    if (rota) {
      rota.removeAttribute('style'); // o story.ts deixa a rota "por desenhar"
      rota.setAttribute('stroke-width', '9');
      svg.append(rota);
    }
    if (partida) svg.append(partida);

    const img = new Image();
    img.onload = () => {
      const ctx = arte.getContext('2d');
      if (!ctx) return;
      const { width: w, height: h } = arte;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      // As bordas somem aos poucos, para o fim do desenho não aparecer
      // quando a câmera se afasta.
      const b = Math.round(Math.min(w, h) * 0.1);
      const apagar = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, rw, rh);
      };
      ctx.globalCompositeOperation = 'destination-out';
      apagar(0, 0, b, 0, 0, 0, b, h);
      apagar(w, 0, w - b, 0, w - b, 0, b, h);
      apagar(0, 0, 0, b, 0, 0, w, b);
      apagar(0, h, 0, h - b, 0, h - b, w, b);
      ctx.globalCompositeOperation = 'source-over';
      // Ler um ponto obriga o navegador a executar o desenho agora, com a
      // abertura do site ainda na tela. Sem isso ele adia o trabalho para
      // a primeira vez que o chão aparece — no meio do primeiro voo.
      ctx.getImageData(0, 0, 1, 1);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  };

  // ---- marcos ----
  const marcos: Marco[] = [];
  const marco = (p: { x: number; y: number }, conteudo: string | Node, classe = '') => {
    const el = criar('div', `palco-marco ${classe}`.trim());
    const corpo = criar('div', 'palco-marco-corpo');
    const caixa = criar('div', 'palco-marco-caixa');
    if (typeof conteudo === 'string') caixa.innerHTML = conteudo;
    else caixa.append(conteudo);
    corpo.append(caixa);
    el.append(corpo);
    camadaMarcos.append(el);
    const m: Marco = { el, corpo, caixa, p, naTela: 0, ordem: -1 };
    marcos.push(m);
    return m;
  };
  const mCd = marco(P.cd, DESENHO.cd, 'is-glifo');
  const mFabrica = marco(P.fabrica, DESENHO.fabrica, 'is-glifo');
  const mLojas = [P.loja, P.lojaB, P.lojaC].map((p) => marco(p, DESENHO.pino, 'is-glifo is-pino'));
  const mEscritorio = marco(P.escritorio, DESENHO.escritorio, 'is-glifo');

  // ---- salas ----
  const salaDom = (nome: string, rotulo: string, pai: HTMLElement): SalaDom => {
    const el = criar('section', 'palco-sala');
    el.dataset.sala = nome;
    el.setAttribute('aria-label', rotulo);
    const texto = criar('div', 'palco-texto');
    const cena = criar('div', 'palco-cena');
    el.append(texto, cena);
    pai.append(el);
    return { el, texto, cena };
  };

  // Indústrias e catálogo dividem a mesma parada: o catálogo é o que a
  // prateleira mostra depois que se escolhe uma marca.
  const grupoInd = criar('div', 'palco-grupo');
  palco.append(grupoInd);
  const sIndustrias = salaDom('industrias', 'Indústrias', grupoInd);
  industrias
    .querySelectorAll('.section-heading h2, .section-heading p')
    .forEach((n) => sIndustrias.texto.append(n));
  const grade = industrias.querySelector<HTMLElement>('.industry-grid');
  const prateleira = criar('div', 'palco-prateleira');
  const postes = [criar('div', 'palco-poste is-esq'), criar('div', 'palco-poste is-dir')];
  const sombra = criar('div', 'palco-prateleira-sombra');
  // Só no celular, onde a prateleira desliza de lado.
  const dica = criar('p', 'palco-dica', 'Arraste para o lado para ver todas as marcas');
  let caixas: HTMLElement[] = [];
  if (grade) {
    // 23 marcas: uma vaga vazia (só a viga) fecha a conta em 24, que
    // divide em 2, 3, 4 ou 6 fileiras.
    const n = grade.querySelectorAll('.industry-card').length;
    for (let i = n; i % 6; i++) {
      const vaga = criar('div', 'palco-vaga');
      vaga.setAttribute('aria-hidden', 'true');
      grade.append(vaga);
    }
    caixas = Array.from(grade.querySelectorAll<HTMLElement>('.industry-card, .palco-vaga'));
    prateleira.append(sombra, ...postes, grade);
  }
  sIndustrias.cena.append(prateleira, dica);

  // O catalog.js continua preenchendo o cabeçalho e as páginas pelos ids.
  const sCatalogo = salaDom('catalogo', 'Catálogo', grupoInd);
  const voltar = criar('button', 'palco-voltar', `${DESENHO.voltar}<span>Ver todas as indústrias</span>`);
  voltar.type = 'button';
  sCatalogo.texto.append(voltar);
  const cabecaCat = catalogo.querySelector('.catalog-head');
  if (cabecaCat) sCatalogo.texto.append(cabecaCat);
  const paginas = catalogo.querySelector('#productGrid');
  if (paginas) sCatalogo.cena.append(paginas);

  // Sobre: título e texto; os três cartões vão para os lugares do mapa.
  const sSobre = salaDom('sobre', 'Sobre a Lógica', palco);
  sobre.querySelectorAll(':scope > h2, :scope > p').forEach((n) => sSobre.texto.append(n));
  const lugaresSobre = [P.fabrica, P.loja, P.lojaB];
  const mCartoesSobre = Array.from(sobre.querySelectorAll<HTMLElement>('.about-cards article')).map(
    (art, i) => {
      art.classList.add('palco-cartao-sobre');
      return marco(lugaresSobre[i] ?? P.cd, art, 'is-cartao');
    },
  );

  // Contato: título, texto e canais; os endereços ficam em pé no mapa.
  const sContato = salaDom('contato', 'Contato', palco);
  contato
    .querySelectorAll(':scope > h2, :scope > p, :scope > .contact-options')
    .forEach((n) => sContato.texto.append(n));
  const lugaresContato = [P.escritorio, P.cd];
  const mEnderecos = Array.from(contato.querySelectorAll<HTMLElement>('.location-card')).map(
    (card, i) => marco(lugaresContato[i] ?? P.cd, card, 'is-cartao is-endereco'),
  );

  // O rodapé do site (redes sociais e direitos) vem para dentro da parada
  // do Contato, a última: é a assinatura do site. A página deixa de ter
  // rodapé abaixo do palco. (Sem o palco ele continua no fim da página.)
  const assinatura = $('.footer');
  if (assinatura) {
    assinatura.classList.add('palco-assinatura');
    sContato.el.append(assinatura);
  }

  // ---- barra de paradas ----
  const rota = criar('nav', 'palco-rota');
  rota.setAttribute('aria-label', 'Seções do site');
  const lista = criar('ol');
  const caminhao = criar('span', 'palco-rota-caminhao', DESENHO.caminhao);
  caminhao.setAttribute('aria-hidden', 'true');
  const linksParada = SECOES.map((secao) => {
    const li = criar('li');
    const a = criar('a', '', `<span class="palco-parada" aria-hidden="true"></span><span>${NOMES[secao]}</span>`);
    a.href = secao === 'inicio' ? '#historia' : `#${secao}`;
    a.dataset.secao = secao;
    li.append(a);
    lista.append(li);
    return a;
  });
  lista.append(caminhao);
  rota.append(lista);
  palco.append(rota);

  // "Role para seguir até ...": diz o que o próximo scroll faz (só onde há
  // mouse; no toque a barra de paradas já mostra o caminho).
  const proximo = criar('p', 'palco-proximo');
  proximo.setAttribute('aria-hidden', 'true');
  palco.append(proximo);

  stage.append(palco);
  document.body.classList.add('palco-ativo');
  pintarChao();

  // ================================================================ câmera
  const cam: Camera = { x: P.centroRota.x, y: P.centroRota.y, t: 30, s: 0, z: 1, fx: 0, fy: 0 };
  // O catálogo aproxima um pouco a câmera sem sair da parada.
  const extra = { z: 1, t: 0 };
  const PERSPECTIVA = 1100; // a mesma do .palco-mundo no CSS

  // Onde um ponto do mapa aparece na tela: a mesma conta que o navegador
  // faz com o transform do chão (aproxima, gira, inclina) e a perspectiva,
  // que tem a origem no centro da cena.
  const projetar = (p: { x: number; y: number }, c: Camera = cam, mais = extra) => {
    const z = c.z * mais.z;
    const t = (c.t + mais.t) * rad;
    let x = (p.x - c.x) * z;
    let y = (p.y - c.y) * z;
    const cs = Math.cos(c.s * rad);
    const sn = Math.sin(c.s * rad);
    [x, y] = [x * cs - y * sn, x * sn + y * cs];
    const prof = y * Math.sin(t); // positivo = mais perto
    y *= Math.cos(t);
    const k = PERSPECTIVA / (PERSPECTIVA - prof);
    return { x: c.fx + x * k, y: c.fy + y * k };
  };

  // Só transform (e só quando muda): é o que o navegador move sem repintar
  // nem refazer camadas.
  let focoEscrito = '';
  const aVista: Marco[] = [];
  const render = () => {
    const ondeFoco = `translate3d(${cam.fx.toFixed(1)}px, ${cam.fy.toFixed(1)}px, 0)`;
    if (ondeFoco !== focoEscrito) {
      focoEscrito = ondeFoco;
      foco.style.transform = ondeFoco;
    }
    const z = (cam.z * extra.z) / rho;
    chao.style.transform =
      `rotateX(${(cam.t + extra.t).toFixed(2)}deg) rotateZ(${cam.s.toFixed(2)}deg) scale(${z.toFixed(4)}) ` +
      `translate(${((MUNDO.x - cam.x) * rho).toFixed(1)}px, ${((MUNDO.y - cam.y) * rho).toFixed(1)}px)`;
    aVista.length = 0;
    for (const m of marcos) {
      // Quem está escondido não precisa de posição.
      if (m.corpo.style.visibility === 'hidden') continue;
      const { x, y } = projetar(m.p);
      m.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      m.naTela = y;
      aVista.push(m);
    }
    // Quem está mais embaixo na tela está mais perto e fica na frente. A
    // ordem quase nunca muda; o z-index só é escrito quando muda.
    aVista.sort((a, b) => a.naTela - b.naTela);
    for (let i = 0; i < aVista.length; i++) {
      const m = aVista[i];
      if (m.ordem === i) continue;
      m.ordem = i;
      m.el.style.zIndex = String(i + 1);
    }
  };

  // Caixa de um elemento em relação ao palco, pelo layout (offset*): não
  // muda com os transforms que a animação aplica.
  const caixaDe = (el: HTMLElement) => {
    let x = 0;
    let y = 0;
    for (let e: HTMLElement | null = el; e && e !== stage; e = e.offsetParent as HTMLElement | null) {
      x += e.offsetLeft;
      y += e.offsetTop;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  };

  // ============================================================== paradas
  const cosDe = (graus: number) => Math.cos(graus * rad);

  // Quantos px da tela separam o foco de um ponto do chão que está `d` px
  // acima (d < 0) ou abaixo (d > 0) dele, já com a inclinação `t` e a
  // perspectiva: o que está embaixo fica mais perto e cresce.
  const alturaNaTela = (d: number, t: number) =>
    (Math.abs(d) * cosDe(t) * PERSPECTIVA) / (PERSPECTIVA - d * Math.sin(t * rad));

  // A maior aproximação, entre `min` e `max`, em que `ocupa(z)` ainda cabe
  // em `limite` px. (`ocupa` cresce com z; a busca é por bisseção.)
  const caber = (ocupa: (z: number) => number, limite: number, min: number, max: number) => {
    if (ocupa(max) <= limite) return max;
    let a = min;
    let b = max;
    for (let i = 0; i < 16; i++) {
      const m = (a + b) / 2;
      if (ocupa(m) <= limite) a = m;
      else b = m;
    }
    return a;
  };

  // Medidas de um cartão preso a um lugar: quanto ele sobe acima do ponto.
  const pilhaDe = (m: Marco | undefined, padrao: number) => {
    if (!m) return padrao;
    const sobe = parseFloat(getComputedStyle(m.caixa).bottom) || 0;
    return sobe + m.caixa.offsetHeight || padrao;
  };

  // Mais ou menos onde o cartão do mapa está no último quadro da história,
  // para a câmera sair dali.
  const poseHistoria = (): Camera => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (celular.matches) {
      return { x: P.centroRota.x, y: P.centroRota.y, t: 26, s: 0, z: Math.min(W / 760, 0.9), fx: W / 2, fy: H * 0.66 };
    }
    return {
      x: P.centroRota.x, y: P.centroRota.y, t: 30, s: 0,
      z: Math.min((W * 0.55 * 0.86) / 1000, ((H - 92) * 0.86) / 620),
      fx: W * 0.725, fy: 92 + (H - 92) / 2,
    };
  };

  // ---- telas largas: texto à esquerda, cena à direita ----
  const paradasLargas = (): Parada[] => [
    { id: 'inicio', secao: 'inicio', pose: poseHistoria },
    {
      id: 'industrias', secao: 'industrias',
      pose: () => {
        const a = caixaDe(sIndustrias.cena);
        return { x: P.cd.x + 60, y: P.cd.y - 40, t: 58, s: -10, z: 1.1, fx: a.cx, fy: a.cy };
      },
    },
    {
      id: 'sobre', secao: 'sobre',
      pose: () => {
        // A rede vai da fábrica (à esquerda) às lojas (à direita), 550
        // unidades para cada lado; de cima a baixo, 335 para cada lado,
        // mais o cartão que sobe acima da loja mais alta.
        const a = caixaDe(sSobre.cena);
        const t = 24;
        const pilha = Math.max(...mCartoesSobre.map((m) => pilhaDe(m, 180)));
        const cartao = mCartoesSobre[0]?.caixa.offsetWidth || 232;
        const ocupa = (z: number) => 12 + pilha + alturaNaTela(-335 * z, t) + alturaNaTela(335 * z, t) + 34;
        // Nunca menos que 0.3: mais longe que isso o chão não cobre a
        // cena. Numa janela muito baixa a rede passa um pouco do pé.
        const z = Math.max(0.3, Math.min(caber(ocupa, a.h, 0.3, 1.2), (a.w - cartao - 18) / 1100));
        // O que sobrar de altura fica metade em cima, metade embaixo.
        const folga = Math.max(0, a.h - ocupa(z)) / 2;
        return { x: 310, y: 485, t, s: 0, z, fx: a.cx, fy: a.y + folga + 12 + pilha + alturaNaTela(-335 * z, t) };
      },
    },
    {
      id: 'contato', secao: 'contato',
      pose: () => {
        // O escritório fica 210 unidades acima do centro e o CD, 210
        // abaixo; o cartão do escritório ainda sobe acima do ponto dele.
        const a = caixaDe(sContato.cena);
        const t = 32;
        const pilha = pilhaDe(mEnderecos[0], 270);
        const cartao = mEnderecos[0]?.caixa.offsetWidth || 262;
        if (a.h < pilha * 2 + 130) {
          // Janela baixa (notebook, tela deitada): um cartão não cabe
          // acima do outro. A câmera gira até os dois endereços ficarem
          // lado a lado, a 510 unidades um do outro.
          const z = limitar((a.w - cartao - 36) / 510, 0.45, 1.1);
          const folga = Math.max(0, a.h - pilha - 40) * 0.4;
          return { x: 275, y: 330, t, s: 55.4, z, fx: a.cx, fy: a.y + 14 + pilha + folga };
        }
        const ocupa = (z: number) => 14 + pilha + alturaNaTela(-210 * z, t) + alturaNaTela(210 * z, t) + 22;
        const z = Math.min(caber(ocupa, a.h, 0.3, 1.5), Math.max(0.3, (a.w - 120) / 300));
        const folga = Math.max(0, a.h - ocupa(z)) / 2;
        return { x: 275, y: 330, t, s: 6, z, fx: a.cx, fy: a.y + folga + 14 + pilha + alturaNaTela(-210 * z, t) };
      },
    },
  ];

  // ---- celular: texto em cima; Sobre e Contato em dois tempos ----
  const paradasEmpilhadas = (): Parada[] => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const estilo = getComputedStyle(palco);
    const topo = parseFloat(estilo.getPropertyValue('--palco-topo')) || 84;
    const pe = parseFloat(estilo.getPropertyValue('--palco-pe')) || 88;
    // A tela inteira entre o cabeçalho e a barra de paradas.
    const cheia = { h: H - topo - pe };

    // Contato: a câmera gira até o escritório ficar exatamente acima do CD
    // (510 unidades entre os dois), um cartão sobre o outro.
    const poseEnderecos = (): Camera => {
      const t = 32;
      const pilha = pilhaDe(mEnderecos[0], 250);
      const separa = (z: number) => alturaNaTela(-255 * z, t) + alturaNaTela(255 * z, t);
      const ocupa = (z: number) => 12 + pilha + separa(z) + 20;
      // O cartão do CD não pode cobrir o desenho do escritório: os dois
      // pontos ficam a pelo menos uma pilha de distância (menor z possível).
      let pouco = 0.2;
      let minimo = 1.4;
      for (let i = 0; i < 16; i++) {
        const m = (pouco + minimo) / 2;
        if (separa(m) >= pilha + 6) minimo = m;
        else pouco = m;
      }
      const z = Math.max(caber(ocupa, cheia.h, 0.2, 1), minimo);
      return { x: 275, y: 330, t, s: -34.6, z, fx: W / 2, fy: topo + 12 + pilha + alturaNaTela(-255 * z, t) };
    };

    return [
      { id: 'inicio', secao: 'inicio', pose: poseHistoria },
      {
        // A prateleira cobre a cena; o chão é só o fundo.
        id: 'industrias', secao: 'industrias',
        pose: () => ({ x: P.cd.x + 40, y: P.cd.y - 30, t: 52, s: -10, z: 0.85, fx: W / 2, fy: H * 0.62 }),
      },
      {
        // 1º tempo: o texto, com a rede inteira deitada no espaço que sobra.
        id: 'sobre', secao: 'sobre',
        pose: () => {
          const a = caixaDe(sSobre.cena);
          const t = 24;
          const z = limitar(Math.min((a.w - 24) / 1290, (a.h - 56) / (700 * cosDe(t))), 0.14, 0.6);
          return { x: 310, y: 485, t, s: 0, z, fx: a.cx, fy: a.cy + 14 };
        },
      },
      {
        // 2º tempo: o mapa gira 90° e fica em pé, como a tela; a fábrica
        // em cima, as lojas embaixo, com os cartões presos aos lugares.
        id: 'sobre-mapa', secao: 'sobre',
        pose: () => {
          // Em pé: a fábrica 550 unidades acima do centro (com o cartão
          // dela mais acima ainda), as lojas 550 abaixo.
          const t = 24;
          const pilha = pilhaDe(mCartoesSobre[0], 170);
          const ocupa = (z: number) => 10 + pilha + alturaNaTela(-550 * z, t) + alturaNaTela(550 * z, t) + 16;
          // De lado: as lojas de baixo, a 335 unidades do centro, são as
          // que mais se afastam (a perspectiva as aproxima da câmera).
          const abre = (z: number) => (335 * z * PERSPECTIVA) / (PERSPECTIVA - 550 * z * Math.sin(t * rad));
          const z = Math.min(caber(ocupa, cheia.h, 0.16, 0.62), caber(abre, W / 2 - 30, 0.16, 0.62));
          return { x: 310, y: 485, t, s: 90, z, fx: W / 2, fy: topo + 10 + pilha + alturaNaTela(-550 * z, t) };
        },
      },
      {
        // 1º tempo: os canais, que ocupam quase a tela toda. O mapa já
        // fica na posição do 2º tempo, só como fundo, sem os desenhos.
        id: 'contato', secao: 'contato',
        pose: poseEnderecos,
      },
      {
        // 2º tempo: saem os canais, entram os dois endereços.
        id: 'contato-mapa', secao: 'contato',
        pose: poseEnderecos,
      },
    ];
  };

  let paradas: Parada[] = [];
  let poses: Camera[] = [];
  let ultima = 0;
  const indice = (id: string) => paradas.findIndex((p) => p.id === id);
  const primeiraDa = (secao: Secao) => paradas.findIndex((p) => p.secao === secao);
  const ultimaDa = (secao: Secao) => paradas.reduce((r, p, i) => (p.secao === secao ? i : r), -1);

  // ====================================================== linha do tempo
  let tlCam: gsap.core.Timeline | undefined;
  let tlCont: gsap.core.Timeline | undefined;
  // Posição da barra de paradas (px) para cada parada.
  let xBarra: number[] = [];
  // Tudo o que a linha do tempo anima, para limpar ao refazer.
  const animados = new Set<Element>();

  const construir = () => {
    tlCam?.kill();
    tlCont?.kill();
    if (animados.size) {
      gsap.set([...animados], { clearProps: 'transform,opacity,visibility,strokeDashoffset' });
    }
    animados.clear();

    const empilhado = celular.matches;
    palco.classList.toggle('is-empilhado', empilhado);
    paradas = empilhado ? paradasEmpilhadas() : paradasLargas();
    ultima = paradas.length - 1;

    poses = paradas.map((p) => p.pose());

    // Cartões presos aos lugares: a ponta fica no meio do cartão (--ancora
    // 50), a menos que ele fosse sair da tela ou cobrir o vizinho — aí o
    // cartão desliza para o lado e a ponta continua no lugar. Acontece no
    // celular, com o mapa em pé e as duas lojas lado a lado, perto das
    // bordas.
    const largura = stage.clientWidth;
    type Preso = { m: Marco; x: number; y: number; w: number; h: number; de: number; ate: number; ancora: number };
    const prender = (grupo: Marco[], pose: Camera | undefined) => {
      const presos: Preso[] = [];
      for (const m of grupo) {
        const w = m.caixa.offsetWidth;
        if (!pose || !w) {
          m.caixa.style.setProperty('--ancora', '50');
          continue;
        }
        const { x, y } = projetar(m.p, pose, { z: 1, t: 0 });
        // Limites da âncora para o cartão não passar da direita nem da esquerda.
        const de = limitar((1 - (largura - 12 - x) / w) * 100, 12, 88);
        const ate = Math.max(de, limitar(((x - 12) / w) * 100, 12, 88));
        presos.push({ m, x, y, w, h: m.caixa.offsetHeight, de, ate, ancora: limitar(50, de, ate) });
      }
      // Dois cartões na mesma altura: o da esquerda cede para a esquerda e
      // o da direita para a direita, cada um até onde a tela deixa.
      for (let i = 0; i < presos.length; i++) {
        for (let j = i + 1; j < presos.length; j++) {
          const [e, d] = presos[i].x <= presos[j].x ? [presos[i], presos[j]] : [presos[j], presos[i]];
          if (Math.abs(e.y - d.y) >= Math.max(e.h, d.h)) continue;
          let sobra = e.x + (1 - e.ancora / 100) * e.w + 8 - (d.x - (d.ancora / 100) * d.w);
          if (sobra <= 0) continue;
          const ceder = (p: Preso, px: number, sentido: 1 | -1) => {
            const livre = ((sentido > 0 ? p.ate - p.ancora : p.ancora - p.de) / 100) * p.w;
            const cede = Math.max(0, Math.min(px, livre));
            p.ancora += sentido * (cede / p.w) * 100;
            return cede;
          };
          // Metade para cada um; o que um não puder ceder, o outro tenta.
          const metade = sobra / 2;
          sobra -= ceder(e, metade, 1) + ceder(d, metade, -1);
          if (sobra > 0) sobra -= ceder(e, sobra, 1);
          if (sobra > 0) ceder(d, sobra, -1);
        }
      }
      presos.forEach((p) => p.m.caixa.style.setProperty('--ancora', p.ancora.toFixed(1)));
    };
    const poseDe = (id: string) => poses[indice(id)];
    prender(mCartoesSobre, poseDe(empilhado ? 'sobre-mapa' : 'sobre'));
    prender(mEnderecos, poseDe(empilhado ? 'contato-mapa' : 'contato'));

    const base = lista.getBoundingClientRect();
    const centro = (secao: Secao) => {
      const a = linksParada.find((l) => l.dataset.secao === secao);
      const r = a?.querySelector('.palco-parada')?.getBoundingClientRect();
      return r ? r.left - base.left + r.width / 2 : 0;
    };
    xBarra = paradas.map((p) => centro(p.secao));

    // ---- câmera ----
    const k = gsap.timeline({ paused: true });
    const dur = VOO.ate - VOO.de;
    for (let i = 0; i < ultima; i++) {
      const A = poses[i];
      const B = poses[i + 1];
      k.fromTo(cam,
        { x: A.x, y: A.y, t: A.t, s: A.s, fx: A.fx, fy: A.fy },
        { x: B.x, y: B.y, t: B.t, s: B.s, fx: B.fx, fy: B.fy, duration: dur, ease: 'power2.inOut', immediateRender: false },
        i + VOO.de);
      // Voo: afasta no meio do caminho e aproxima na chegada.
      const longe = Math.hypot(B.x - A.x, B.y - A.y) > 260;
      const meio = Math.min(A.z, B.z) * (longe ? 0.72 : 0.95);
      k.fromTo(cam, { z: A.z }, { z: meio, duration: dur / 2, ease: 'sine.inOut', immediateRender: false }, i + VOO.de);
      k.fromTo(cam, { z: meio }, { z: B.z, duration: dur / 2, ease: 'sine.inOut', immediateRender: false }, i + VOO.de + dur / 2);
    }
    k.set({}, {}, ultima);
    tlCam = k;

    // ---- conteúdo ----
    const c = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    // De cada alvo, só o primeiro tween (o mais antigo na linha do tempo)
    // desenha ao ser criado: é ele que define como o alvo começa.
    const par = (alvo: Element | Element[], de: gsap.TweenVars, para: gsap.TweenVars, em: number) => {
      const els = Array.isArray(alvo) ? alvo : [alvo];
      if (!els.length) return;
      const primeiro = !animados.has(els[0]);
      els.forEach((el) => animados.add(el));
      // force3D: o transform fica sempre em 3D. No automático o GSAP troca
      // entre 2D e 3D no começo e no fim de cada tween, e cada troca faz o
      // navegador refazer camadas no meio do movimento.
      c.fromTo(els, de, { ...para, force3D: true, lazy: false, immediateRender: primeiro }, em);
    };
    const E = (parada: number) => parada - 1 + ENTRADA.de; // começo da entrada
    const S = (parada: number) => parada + SAIDA.de; // começo da saída
    const wE = ENTRADA.ate - ENTRADA.de;
    const wS = SAIDA.ate - SAIDA.de;

    // Um bloco de texto presente das paradas `a` até `b`: as linhas entram
    // uma a uma, o bloco assenta na chegada e sai inteiro.
    //
    // O bloco usa autoAlpha (some também da leitura de tela, do teclado e
    // do toque quando está fora de cena); as linhas dentro dele usam só
    // opacity, que o navegador anima sem repintar.
    const texto = (el: HTMLElement, a: number, b: number, sai = true) => {
      const linhas = Array.from(el.children);
      // (o y: 12 fica parado aqui; quem o leva a zero é o assentamento)
      par(el, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 12, duration: 0.14 }, E(a));
      const d = wE * 0.6;
      const passo = linhas.length > 1 ? (wE - d) / (linhas.length - 1) : 0;
      linhas.forEach((l, i) => {
        par(l, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: d, ease: 'power2.out' }, E(a) + i * passo);
      });
      // Assentamento: os últimos 12px da chegada. Também é o que responde
      // primeiro quando se arrasta de volta.
      par(el, { y: 12 }, { y: 0, duration: 0.12, ease: 'power1.out' }, a - 0.12);
      if (sai && b < ultima) par(el, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -18, duration: wS, ease: 'power1.in' }, S(b));
    };
    // Um marco presente das paradas `a` até `b`.
    const marcoEm = (m: Marco, a: number, b: number, atraso: number) => {
      par(m.corpo, { autoAlpha: 0, y: -34 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: 'back.out(1.8)' }, E(a) + atraso);
      if (b < ultima) par(m.corpo, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -10, duration: 0.2, ease: 'power1.in' }, S(b));
    };

    // História: sai o último quadro, aparece o mundo.
    par(quadro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 26, duration: wS, ease: 'power2.in' }, S(0));
    par(mundo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 0.05);
    // O CD fica à vista em todas as paradas; só sai no 1º tempo do Contato
    // no celular, onde os canais cobrem o mapa.
    if (empilhado) {
      marcoEm(mCd, 1, ultimaDa('sobre'), 0.04);
      marcoEm(mCd, indice('contato-mapa'), ultima, 0.04);
    } else {
      marcoEm(mCd, 1, ultima, 0.04);
    }

    // Indústrias: a prateleira sobe e as caixas são estocadas. O grupo tem
    // mais de cem elementos: aqui ele só muda de opacity; quem o esconde
    // de verdade (visibility) é mostrarGrupo, com o palco parado.
    const iInd = indice('industrias');
    par(grupoInd, { opacity: 0 }, { opacity: 1, duration: 0.1 }, E(iInd));
    texto(sIndustrias.texto, iInd, iInd, false);
    par(postes, { scaleY: 0 }, { scaleY: 1, duration: 0.2, ease: 'power3.out' }, E(iInd));
    par(sombra, { autoAlpha: 0, scaleX: 0.3 }, { autoAlpha: 1, scaleX: 1, duration: 0.22, ease: 'power2.out' }, E(iInd));
    // Ordem de estoque: nas telas largas, de baixo para cima; no corredor
    // do celular, coluna por coluna, da esquerda para a direita.
    const ordem = caixas
      .map((el) => ({ el, x: el.offsetLeft, y: el.offsetTop }))
      .sort((p, q) => (empilhado ? p.x - q.x || q.y - p.y : q.y - p.y || p.x - q.x));
    const dc = 0.16;
    const pc = ordem.length > 1 ? (wE - 0.05 - dc) / (ordem.length - 1) : 0;
    ordem.forEach(({ el }, i) => {
      par(el, { opacity: 0, y: -46 }, {
        opacity: 1, y: 0, duration: dc, ease: 'back.out(1.5)',
        // No fim a caixa volta a ser do CSS (que a puxa para a frente no hover).
        clearProps: 'transform',
      }, E(iInd) + 0.05 + i * pc);
    });
    par(dica, { opacity: 0 }, { opacity: 1, duration: 0.14 }, E(iInd) + 0.28);
    par(grupoInd, { opacity: 1, y: 0 }, { opacity: 0, y: -18, duration: wS, ease: 'power1.in' }, S(iInd));

    // Sobre: a rota chega da fábrica e se espalha para as lojas.
    const aSobre = primeiraDa('sobre');
    const bSobre = ultimaDa('sobre');
    // No celular os cartões só entram no 2º tempo, com o mapa em pé.
    const cartoesEm = empilhado ? indice('sobre-mapa') : aSobre;
    texto(sSobre.texto, aSobre, empilhado ? aSobre : bSobre);
    const [entrada, ...ramos] = trilhas;
    const tracar = (p: SVGPathElement, em: number, d: number) => {
      const L = p.getTotalLength();
      p.style.strokeDasharray = String(L);
      par(p, { strokeDashoffset: L }, { strokeDashoffset: 0, duration: d, ease: 'power1.inOut' }, em);
    };
    tracar(entrada, E(aSobre), 0.2);
    ramos.forEach((p) => tracar(p, E(aSobre) + 0.17, 0.24));
    if (bSobre < ultima) par(trilhas, { opacity: 1 }, { opacity: 0, duration: 0.2 }, S(bSobre));
    marcoEm(mFabrica, aSobre, bSobre, 0);
    mLojas.forEach((m, i) => marcoEm(m, aSobre, bSobre, 0.2 + i * 0.03));
    mCartoesSobre.forEach((m, i) => marcoEm(m, cartoesEm, bSobre, (empilhado ? 0.06 : 0.14) + i * 0.06));

    // Contato: os canais na coluna de texto, os endereços em pé no mapa.
    const aContato = primeiraDa('contato');
    const bContato = ultimaDa('contato');
    const enderecosEm = empilhado ? indice('contato-mapa') : aContato;
    texto(sContato.texto, aContato, empilhado ? aContato : bContato);
    marcoEm(mEscritorio, enderecosEm, bContato, 0.04);
    mEnderecos.forEach((m, i) => marcoEm(m, enderecosEm, bContato, 0.1 + i * 0.08));
    // A assinatura chega por último. No celular ela fica só no primeiro
    // tempo (os canais): no segundo, os endereços ocupam a tela inteira.
    if (assinatura) {
      par(assinatura, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' }, E(aContato) + 0.22);
      if (empilhado) {
        par(assinatura, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -12, duration: wS, ease: 'power1.in' }, S(aContato));
      }
    }

    c.set({}, {}, ultima);
    tlCont = c;

    // Prepara todos os tweens agora (ida até o fim e volta). O GSAP lê o
    // estilo de cada alvo na primeira vez que um tween roda; deixado para
    // depois, isso acontecia no meio do movimento, um alvo de cada vez.
    c.progress(1).progress(0);
    k.progress(1).progress(0);
    Object.assign(cam, poses[0]);
    grupoInd.style.visibility = 'hidden';
  };

  // O grupo das indústrias some de verdade (teclado, toque, leitura de
  // tela) quando o palco repousa em outra parada, e volta antes de
  // qualquer movimento, enquanto nada está animando.
  const mostrarGrupo = (visivel: boolean) => {
    const valor = visivel ? 'visible' : 'hidden';
    if (grupoInd.style.visibility !== valor) grupoInd.style.visibility = valor;
  };

  // ================================================================= mola
  // `u` vai até `alvo` como uma mola criticamente amortecida: parte suave
  // do repouso, não passa do ponto e pode trocar de alvo a qualquer
  // instante sem perder a velocidade que tinha.
  let u = 0;
  let vel = 0;
  let alvo = 0;
  let forca = MOLA.passo;
  let rodando = false;
  let ultimoQuadro = 0;
  let emPalco = false; // a história já terminou: o palco conduz
  let voo: gsap.core.Timeline | undefined; // voo direto do menu, em andamento
  let perto = -1; // parada mais próxima de u
  let focoPendente = false;
  let catalogoAberto = false;
  let marcaEscolhida = false;

  const barra = (pos: number) => {
    const i = limitar(Math.floor(pos), 0, Math.max(0, ultima - 1));
    const f = limitar(pos - i, 0, 1);
    const x = xBarra[i] + ((xBarra[i + 1] ?? xBarra[i]) - xBarra[i]) * f;
    caminhao.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
  };

  // Desenha o palco na posição `pos` da linha. No voo direto (`emVoo`) a
  // câmera e o caminhão da barra têm animação própria.
  const desenhar = (pos: number, emVoo = false) => {
    // O conteúdo vem primeiro: é ele que decide quais marcos estão à vista.
    tlCont?.time(pos);
    if (!emVoo) {
      tlCam?.time(pos);
      barra(pos);
    }
    render();
    const p = limitar(Math.round(pos), 0, ultima);
    if (p !== perto) mudarParada(p);
  };

  const quadroDaMola = (agora: number) => {
    if (!rodando) return; // um voo direto assumiu
    // Um quadro atrasado não vira um salto: o passo é limitado.
    const dt = Math.min(0.034, (agora - ultimoQuadro) / 1000);
    ultimoQuadro = agora;
    // Euler implícito: estável com qualquer força.
    const w = forca;
    const hoo = dt * w * w;
    const det = 1 / (1 + 2 * dt * w + dt * hoo);
    const novoU = ((1 + 2 * dt * w) * u + dt * vel + dt * hoo * alvo) * det;
    vel = (vel + hoo * (alvo - u)) * det;
    u = novoU;
    if (Math.abs(alvo - u) < 0.0007 && Math.abs(vel) < 0.015) {
      u = alvo;
      vel = 0;
    }
    desenhar(u);
    if (u !== alvo) {
      requestAnimationFrame(quadroDaMola);
    } else {
      rodando = false;
      aoRepousar();
    }
  };

  const irAte = (destino: number, comForca: number) => {
    alvo = limitar(destino, 0, ultima);
    forca = comForca;
    if (rodando || u === alvo) return;
    mostrarGrupo(true);
    rodando = true;
    ultimoQuadro = performance.now();
    requestAnimationFrame(quadroDaMola);
  };

  // ============================================================== estado
  const hashDa = (secao: Secao) => (secao === 'industrias' && catalogoAberto ? '#catalogo' : `#${secao}`);

  // Marca no menu do cabeçalho a seção aberta. (Quem tira as salas fora
  // de cena do teclado, do toque e da leitura de tela é o autoAlpha da
  // linha do tempo: bloco invisível fica com visibility: hidden.)
  const linksDoMenu = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav a, .mobile-nav a'));
  const marcarSalas = () => {
    const secao = paradas[perto]?.secao;
    const noInd = secao === 'industrias';
    linksDoMenu.forEach((a) => {
      const destino = ANCORAS[a.hash];
      const ativo = destino === 'catalogo' ? noInd && catalogoAberto : destino === secao && !(noInd && catalogoAberto);
      if (ativo) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };

  const mudarParada = (p: number) => {
    perto = p;
    const secao = paradas[p].secao;
    palco.classList.toggle('is-aberto', p > 0);
    linksParada.forEach((a) => {
      if (a.dataset.secao === secao) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    marcarSalas();
    const seguinte = paradas.slice(p + 1).find((q) => q.secao !== secao);
    proximo.hidden = !seguinte;
    if (seguinte) proximo.innerHTML = `<span>Role para seguir até <strong>${NOMES[seguinte.secao]}</strong></span>`;
    // No celular o cabeçalho fica fora de cena no Início (como durante a
    // história) e volta nas salas.
    if (emPalco) {
      document.body.classList.add('story-solto');
      document.body.classList.toggle('story-imersivo', celular.matches && p === 0);
    }
  };

  // Recolher a seção da história muda a posição da página; só pode
  // acontecer com tudo parado (o iPhone ignora, ou trava, se a posição
  // muda no meio do deslize). `paginaParada`: quem chama já sabe que a
  // página parou.
  let ultimoScrollDaPagina = 0;
  const tentarRecolher = (paginaParada = false) => {
    if (!emPalco || historia.recolhida() || rodando || voo || toque) return;
    if (!paginaParada && performance.now() - ultimoScrollDaPagina < 180) return;
    historia.recolher();
  };

  const aoRepousar = () => {
    const secao = paradas[perto].secao;
    // Fora das indústrias, a prateleira volta a ser a vista da parada.
    if (catalogoAberto && secao !== 'industrias') mostrarCatalogo(false, { imediato: true });
    mostrarGrupo(secao === 'industrias');
    // O endereço acompanha a parada (sem criar entradas no histórico: o
    // voltar do navegador fica para as escolhas feitas no menu).
    const url = secao === 'inicio' ? location.pathname + location.search : hashDa(secao);
    const jaEsta = secao === 'inicio' ? !location.hash : location.hash === url;
    if (!jaEsta) history.replaceState({ secao }, '', url);
    if (focoPendente) {
      focoPendente = false;
      const sala = secao === 'industrias' ? (catalogoAberto ? sCatalogo : sIndustrias) : secao === 'sobre' ? sSobre : secao === 'contato' ? sContato : undefined;
      // No Início o título à vista é o do último quadro da história.
      const titulo = sala
        ? sala.texto.querySelector<HTMLElement>('h2')
        : story.querySelector<HTMLElement>('.story-caption:last-child h2');
      if (titulo) {
        titulo.tabIndex = -1;
        titulo.focus({ preventScroll: true });
      }
    }
    // Recolher a seção da história refaz o layout da página: só um
    // instante depois de tudo parar, para não pesar nos últimos quadros.
    window.setTimeout(() => tentarRecolher(), 350);
  };

  // ============================================================= catálogo
  // O catálogo é a outra vista da parada das indústrias: a caixa escolhida
  // sai da prateleira e abre nas páginas.
  let tlCat: gsap.core.Timeline | undefined;
  let fantasma: HTMLElement | undefined;
  gsap.set(sCatalogo.el, { autoAlpha: 0 });

  const mostrarCatalogo = (aberto: boolean, opcoes: { imediato?: boolean; origem?: HTMLElement } = {}) => {
    if (aberto === catalogoAberto && !opcoes.origem) return;
    catalogoAberto = aberto;
    tlCat?.progress(1).kill();
    fantasma?.remove();
    fantasma = undefined;
    const sai = aberto ? sIndustrias : sCatalogo;
    const entra = aberto ? sCatalogo : sIndustrias;
    const tl = gsap.timeline();
    tlCat = tl;
    tl.to(sai.el, { autoAlpha: 0, y: -16, duration: 0.26, ease: 'power1.in' }, 0);
    // A prateleira volta subindo um pouco; o catálogo entra por partes.
    tl.fromTo(entra.el,
      { autoAlpha: 0, y: aberto ? 0 : 16 },
      { autoAlpha: 1, y: 0, duration: aberto ? 0.2 : 0.45, ease: aberto ? 'none' : 'power2.out' },
      0.2);
    tl.to(extra, { z: aberto ? 1.2 : 1, t: aberto ? 5 : 0, duration: 0.8, ease: 'power2.inOut', onUpdate: render }, 0);
    if (aberto) {
      tl.fromTo(Array.from(sCatalogo.texto.children), { autoAlpha: 0, y: 22 }, {
        autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out', clearProps: 'transform',
      }, 0.22);
      tl.fromTo(sCatalogo.cena, { autoAlpha: 0, y: 30 }, {
        autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', clearProps: 'transform',
      }, opcoes.origem ? 0.5 : 0.28);
    }
    const origem = opcoes.origem;
    if (aberto && origem && !opcoes.imediato) {
      // A etiqueta da marca sai da caixa e cresce até o lugar das páginas.
      const r = origem.getBoundingClientRect();
      const img = origem.querySelector('img');
      const g = criar('div', 'palco-fantasma');
      fantasma = g;
      if (img) g.append(img.cloneNode());
      document.body.append(g);
      const cena = sCatalogo.cena.getBoundingClientRect();
      const escala = Math.min(cena.width * 0.6, 340) / r.width;
      // Só transform (e na mesma proporção): o voo não mexe no layout.
      gsap.set(g, { left: r.left, top: r.top, width: r.width, height: r.height, transformOrigin: '0 0' });
      tl.to(g, {
        x: cena.left + (cena.width - r.width * escala) / 2 - r.left,
        y: cena.top + (cena.height - r.height * escala) / 2 - r.top,
        scale: escala, duration: 0.6, ease: 'power3.inOut',
      }, 0.02);
      tl.to(g, { autoAlpha: 0, duration: 0.3, ease: 'power1.in' }, 0.56);
      tl.call(() => g.remove(), [], 0.9);
    }
    if (opcoes.imediato) tl.progress(1);
    marcarSalas();
    // O endereço acompanha a vista (quando a troca não veio de um clique
    // que já o mudou: fechar arrastando ou pela roda, por exemplo).
    if (emPalco && paradas[perto]?.secao === 'industrias' && !rodando && !voo) {
      const url = hashDa('industrias');
      if (location.hash !== url) history.replaceState({ secao: 'industrias' }, '', url);
    }
  };

  // ============================================================ navegação
  const naTela = () => emPalco && Math.abs(stage.getBoundingClientRect().top) <= 2;

  // A página pode estar no rodapé: volta ao topo do palco.
  const alinharPagina = () => {
    if (Math.abs(stage.getBoundingClientRect().top) > 2) {
      window.scrollTo({ top: historia.topoNaPagina(), behavior: 'instant' });
    }
  };

  // A primeira sala é desenhada quase invisível por alguns quadros: o
  // navegador pinta as camadas dela agora, com a tela parada, e não no
  // meio do primeiro voo.
  const aquecer = () => {
    palco.classList.add('is-aquecendo');
    let quadros = 0;
    const esfriar = () => {
      if (++quadros < 4) {
        requestAnimationFrame(esfriar);
        return;
      }
      palco.classList.remove('is-aquecendo');
    };
    requestAnimationFrame(esfriar);
  };

  const entrar = () => {
    if (emPalco) return;
    emPalco = true;
    // Liga as camadas próprias do que o palco anima (will-change no CSS).
    // Durante a história elas só pesariam.
    palco.classList.add('is-vivo');
    aquecer();
    u = 0;
    vel = 0;
    alvo = 0;
    armarEntradas();
    perto = -1;
    desenhar(0);
  };

  // Voo direto, para os saltos do menu entre paradas distantes: o que
  // está na tela sai, a câmera vai de onde está até o destino sem passar
  // pelas paradas do meio, e o destino se monta na chegada.
  const voarDireto = (k: number, deHistoria = false) => {
    voo?.kill();
    rodando = false; // a mola para (quadroDaMola confere)
    mostrarGrupo(true);
    alvo = k;
    const a = u;
    const frente = k > a;
    const seg = Math.floor(a + 1e-6);
    const fr = a - seg;
    // Onde o conteúdo fica vazio, saindo de `a`...
    let cSaida: number;
    if (fr < SAIDA.ate) cSaida = frente || seg < 1 ? seg + SAIDA.ate : seg - 1 + ENTRADA.de;
    else cSaida = fr <= ENTRADA.de ? a : seg + ENTRADA.de;
    // ...e chegando em `k`.
    const cChegada = frente ? k - 1 + ENTRADA.de : k + SAIDA.ate;

    // c: posição do conteúdo na linha; b: posição do caminhão na barra.
    const rel = { c: deHistoria ? 0.05 : a, b: a };
    const pintar = () => {
      u = rel.c;
      desenhar(rel.c, true);
    };
    const B = poses[k];
    const d = Math.hypot(B.x - cam.x, B.y - cam.y);
    const dur = limitar(0.75 + d / 900 + Math.abs(B.s - cam.s) / 220, 0.9, 1.5);
    const tl = gsap.timeline({
      onComplete: () => {
        voo = undefined;
        u = k;
        vel = 0;
        alvo = k;
        tlCam?.time(k);
        desenhar(k);
        aoRepousar();
      },
    });
    voo = tl;
    tl.to(rel, { c: cSaida, duration: 0.28, ease: 'power1.in', onUpdate: pintar }, 0);
    // Os marcos mudam de uma parada para outra: a camada some na troca.
    tl.to(camadaMarcos, { opacity: 0, duration: 0.2, ease: 'none' }, 0);
    tl.call(() => {
      stage.classList.remove('is-saindo');
      rel.c = cChegada;
      pintar();
    }, [], 0.3);
    tl.to(camadaMarcos, { opacity: 1, duration: 0.25, ease: 'none' }, 0.34);
    tl.to(cam, { x: B.x, y: B.y, t: B.t, s: B.s, fx: B.fx, fy: B.fy, duration: dur, ease: 'power2.inOut', onUpdate: render }, 0.1);
    const meio = Math.min(cam.z, B.z) * (d > 260 ? 0.72 : 0.95);
    tl.to(cam, { z: meio, duration: dur / 2, ease: 'sine.inOut' }, 0.1);
    tl.to(cam, { z: B.z, duration: dur / 2, ease: 'sine.inOut' }, 0.1 + dur / 2);
    tl.to(rel, { b: k, duration: dur, ease: 'power2.inOut', onUpdate: () => barra(rel.b) }, 0.1);
    tl.to(rel, { c: k, duration: 0.85, ease: 'power2.out', onUpdate: pintar }, Math.max(0.32, 0.1 + dur * 0.55));
  };

  // Saída da história pedida pelo menu, ainda por acontecer: o
  // temporizador e a parada de destino.
  let saida = 0;
  let destinoDaSaida = 0;
  const cancelarSaida = () => {
    if (!saida) return;
    window.clearTimeout(saida);
    saida = 0;
    stage.classList.remove('is-saindo');
  };

  /** Leva o palco até a parada `k` (menu, barra de paradas, teclado). */
  const irPara = (k: number, opcoes: { foco?: boolean } = {}) => {
    if (k < 0) return;
    focoPendente = !!opcoes.foco;
    if (!emPalco) {
      // No meio da história: o que está na tela some, a história vai ao
      // último quadro por baixo do pano e o voo parte dali. Outro clique
      // no menu antes disso só troca o destino.
      destinoDaSaida = k;
      if (saida) return;
      stage.classList.add('is-saindo');
      saida = window.setTimeout(() => {
        saida = 0;
        historia.concluir();
        entrar();
        if (destinoDaSaida === 0) {
          // Direto ao último quadro da história (a parada Início).
          stage.classList.remove('is-saindo');
          gsap.from(Array.from(quadro.children), { opacity: 0, duration: 0.35, ease: 'none', clearProps: 'opacity' });
          aoRepousar();
        } else {
          voarDireto(destinoDaSaida, true);
        }
      }, 230);
      return;
    }
    alinharPagina();
    if (catalogoAberto && k !== primeiraDa('industrias')) mostrarCatalogo(false, { imediato: k < 1 });
    if (voo || Math.abs(k - u) > 1.15) {
      voarDireto(k);
    } else if (k === u && !rodando) {
      aoRepousar();
    } else {
      irAte(k, MOLA.passo);
    }
  };

  const irParaSecao = (destino: Secao | 'catalogo', opcoes: { empurrar?: boolean } = {}) => {
    const secao: Secao = destino === 'catalogo' ? 'industrias' : destino;
    if (secao === 'inicio' && !emPalco) {
      // A história ainda não terminou: o Início é o começo dela. Ela
      // acompanha o scroll, então voltar ao topo a devolve ao primeiro
      // quadro. (Depois de vista, o Início passa a ser o último quadro: a
      // parada de onde a câmera parte para as outras seções.)
      cancelarSaida();
      focoPendente = false;
      // Um clique anterior no menu pode ter deixado outra seção no endereço.
      if (location.hash && ANCORAS[location.hash] !== 'inicio') {
        history.replaceState({ secao: 'inicio' }, '', location.pathname + location.search);
      }
      window.scrollTo({ top: historia.topoNaPagina(), behavior: 'smooth' });
      return;
    }
    const querCatalogo = destino === 'catalogo' && marcaEscolhida;
    const k = primeiraDa(secao);
    if (secao === 'industrias' && emPalco) {
      // Já na parada: troca a vista com animação; senão, por baixo do pano.
      const jaAqui = perto === k && Math.abs(u - k) < 0.2;
      if (querCatalogo !== catalogoAberto) mostrarCatalogo(querCatalogo, { imediato: !jaAqui });
    }
    if (opcoes.empurrar) {
      const url = secao === 'inicio' ? location.pathname + location.search : querCatalogo ? '#catalogo' : `#${secao}`;
      if (location.hash !== url && !(secao === 'inicio' && !location.hash)) {
        history.pushState({ secao }, '', url);
      }
    }
    irPara(k, { foco: true });
  };

  // ============================================================== entradas
  const ocupado = () => !!document.querySelector('.catalog-modal.open, .mobile-menu.open');

  // Algo dentro do palco (um texto que não coube, em telas muito baixas)
  // ainda rola nesse sentido? Então o gesto é dele.
  const podeRolar = (el0: EventTarget | null, dir: number) => {
    for (
      let el = el0 instanceof Element ? el0 : null;
      el && el !== palco && el !== document.body;
      el = el.parentElement
    ) {
      if (el.scrollHeight <= el.clientHeight + 1) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    return false;
  };

  // Nas pontas o gesto é da página: para cima no Início, e para baixo na
  // última parada (o rodapé).
  const naPonta = (dir: number) =>
    (dir < 0 && alvo <= 0 && u < 0.02) || (dir > 0 && alvo >= ultima && u > ultima - 0.02);

  // ---- roda do mouse e trackpad ----
  // Gesto = eventos sem pausa maior que 200ms; a inércia do trackpad é o
  // mesmo gesto e não dá um segundo passo. Um movimento novo no meio da
  // inércia aparece como um salto no tamanho dos eventos.
  let roda = { ultimo: 0, soma: 0, base: 0, usado: false, media: 0, quando: 0 };
  let voltaDaRoda = 0;
  const aoRodar = (e: WheelEvent) => {
    if (e.ctrlKey || ocupado()) return; // ctrl + roda = zoom do navegador
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.offsetHeight : 1);
    if (!delta) return;
    const agora = performance.now();
    const tamanho = Math.abs(delta);
    const novo =
      agora - roda.ultimo > 200 ||
      (roda.usado && agora - roda.quando > 320 && tamanho > 30 && tamanho > roda.media * 3);
    if (novo) roda = { ultimo: agora, soma: 0, base: Math.round(alvo), usado: false, media: tamanho, quando: 0 };
    else roda.media = roda.media * 0.8 + tamanho * 0.2;
    roda.ultimo = agora;
    const dir = delta > 0 ? 1 : -1;

    if (!naTela()) {
      roda.usado = true; // o gesto começou na página: termina na página
      return;
    }
    if (voo) {
      e.preventDefault();
      roda.usado = true;
      return;
    }
    if (podeRolar(e.target, dir)) {
      roda.usado = true;
      return;
    }
    if (naPonta(dir)) {
      // A sobra de inércia do passo que trouxe até aqui não vaza para a página.
      if (roda.usado) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (roda.usado) return;
    if (catalogoAberto && dir < 0) {
      roda.usado = true;
      roda.quando = agora;
      mostrarCatalogo(false);
      return;
    }
    roda.soma += delta;
    // Um "clique" da roda do mouse já decide; no trackpad, 90px.
    if (tamanho >= 50 || Math.abs(roda.soma) >= 90) {
      roda.usado = true;
      roda.quando = agora;
      window.clearTimeout(voltaDaRoda);
      irAte(roda.base + dir, MOLA.passo);
      return;
    }
    // Trackpad, antes de decidir: o palco acompanha os dedos.
    irAte(limitar(roda.base + roda.soma / CURSO_RODA, roda.base - 1, roda.base + 1), MOLA.dedo);
    window.clearTimeout(voltaDaRoda);
    voltaDaRoda = window.setTimeout(() => {
      if (!roda.usado) irAte(roda.base, MOLA.solta);
    }, 180);
  };

  // ---- toque ----
  // O gesto é decidido no primeiro movimento. De lado é do corredor de
  // marcas ou do carrossel; nas pontas é da página; o resto é do palco,
  // que segue o dedo e decide a parada quando ele solta.
  let toque: {
    x0: number; y0: number; alvo: EventTarget | null;
    tipo: 'indefinido' | 'palco' | 'fechar' | 'outro';
    u0: number; base: number;
    y: number; quando: number; velocidade: number;
  } | null = null;

  const aoTocar = (e: TouchEvent) => {
    if (e.touches.length !== 1 || ocupado()) {
      toque = null;
      return;
    }
    const t = e.touches[0];
    toque = {
      x0: t.clientX, y0: t.clientY, alvo: e.target,
      tipo: naTela() && !voo ? 'indefinido' : 'outro',
      u0: u, base: Math.round(u),
      y: t.clientY, quando: performance.now(), velocidade: 0,
    };
  };

  const aoArrastar = (e: TouchEvent) => {
    if (!toque || toque.tipo === 'outro') return;
    const t = e.touches[0];
    const dy = toque.y0 - t.clientY; // > 0: o dedo sobe, próxima parada
    if (toque.tipo === 'indefinido') {
      const dx = toque.x0 - t.clientX;
      if (!dx && !dy) return;
      const dir = dy > 0 ? 1 : -1;
      if (Math.abs(dx) > Math.abs(dy) || podeRolar(toque.alvo, dir) || naPonta(dir)) {
        toque.tipo = 'outro';
        return;
      }
      toque.tipo = catalogoAberto && dir < 0 ? 'fechar' : 'palco';
      // Pega o palco onde ele está, mesmo no meio de um movimento.
      toque.u0 = u;
      toque.base = Math.round(u);
    }
    if (e.cancelable) e.preventDefault();
    const agora = performance.now();
    const curso = stage.offsetHeight * CURSO_TOQUE;
    if (toque.tipo === 'palco') {
      const dt = agora - toque.quando;
      if (dt > 4) {
        // Velocidade do dedo em paradas por segundo, suavizada.
        const v = ((toque.y - t.clientY) / curso / dt) * 1000;
        toque.velocidade = toque.velocidade * 0.6 + v * 0.4;
        toque.y = t.clientY;
        toque.quando = agora;
      }
      irAte(limitar(toque.u0 + dy / curso, toque.base - 1, toque.base + 1), MOLA.dedo);
    } else {
      // Fechando o catálogo: ele cede um pouco sob o dedo.
      toque.y = t.clientY;
      gsap.set(sCatalogo.el, { y: Math.min(60, -dy * 0.3) });
    }
  };

  const aoSoltar = () => {
    const t = toque;
    toque = null;
    if (!t) return;
    if (t.tipo === 'palco') {
      // Dedo parado antes de soltar não é peteleco.
      const velocidade = performance.now() - t.quando > 90 ? 0 : t.velocidade;
      const destino = limitar(decidirParada(alvo, t.base, velocidade), t.base - 1, t.base + 1);
      irAte(destino, MOLA.solta);
    } else if (t.tipo === 'fechar') {
      if (t.y - t.y0 > 50) mostrarCatalogo(false);
      else gsap.to(sCatalogo.el, { y: 0, duration: 0.3, ease: 'power2.out' });
    }
    window.setTimeout(() => tentarRecolher(), 200);
  };

  // ---- teclado ----
  const aoTeclar = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || ocupado()) return;
    const el = e.target as HTMLElement;
    if (el.closest?.('input, textarea, select, [contenteditable]')) return;
    const espaco = e.key === ' ' && !el.closest?.('a, button');
    const dir =
      e.key === 'ArrowDown' || e.key === 'PageDown' || (espaco && !e.shiftKey) ? 1
        : e.key === 'ArrowUp' || e.key === 'PageUp' || (espaco && e.shiftKey) ? -1
          : 0;
    if (!dir || !naTela() || naPonta(dir) || podeRolar(el, dir)) return;
    e.preventDefault();
    if (e.repeat || voo) return;
    if (catalogoAberto && dir < 0) {
      mostrarCatalogo(false);
      return;
    }
    focoPendente = true;
    irAte(Math.round(alvo) + dir, MOLA.passo);
  };

  // Só depois que a história termina: antes disso a página rola livre e
  // nada aqui fica no caminho do scroll.
  let armadas = false;
  const armarEntradas = () => {
    if (armadas) return;
    armadas = true;
    window.addEventListener('wheel', aoRodar, { passive: false });
    window.addEventListener('touchstart', aoTocar, { passive: true });
    window.addEventListener('touchmove', aoArrastar, { passive: false });
    window.addEventListener('touchend', aoSoltar, { passive: true });
    window.addEventListener('touchcancel', aoSoltar, { passive: true });
    window.addEventListener('keydown', aoTeclar);
  };

  // ---- cliques ----
  // Links internos (menu, menu do celular, barra de paradas, botões da
  // história): o main.js e o mobile-menu.js continuam recebendo o clique
  // (para fechar o menu, por exemplo); aqui só se evita o salto da página.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a) return;
    const destino = ANCORAS[a.hash];
    if (!destino) return;
    e.preventDefault();
    irParaSecao(destino, { empurrar: true });
  }, true);

  // Escolher uma marca na prateleira. O catalog.js já preencheu o catálogo
  // no próprio clique (o listener dele fica no botão; este, no documento,
  // roda depois).
  document.addEventListener('click', (e) => {
    const card = (e.target as Element | null)?.closest<HTMLElement>('.palco .industry-card');
    if (!card) return;
    marcaEscolhida = true;
    if (location.hash !== '#catalogo') history.pushState({ secao: 'industrias' }, '', '#catalogo');
    mostrarCatalogo(true, { origem: card.querySelector<HTMLElement>('.industry-card-media') ?? card });
  });

  voltar.addEventListener('click', () => {
    if (location.hash !== '#industrias') history.pushState({ secao: 'industrias' }, '', '#industrias');
    mostrarCatalogo(false);
  });

  window.addEventListener('popstate', () => irParaSecao(ANCORAS[location.hash] ?? 'inicio'));

  // ---- medidas ----
  let medida = { w: 0, h: 0 };
  const refazer = () => {
    medida = { w: stage.clientWidth, h: stage.clientHeight };
    if ((window.devicePixelRatio || 1) !== dprPintado) pintarChao();
    const secao = paradas[perto]?.secao ?? 'inicio';
    const eraSegundoTempo = perto > 0 && paradas[perto - 1]?.secao === secao;
    voo?.progress(1);
    construir();
    // A mesma seção pode ter mudado de lugar na linha (celular x largo).
    let k = primeiraDa(secao);
    if (eraSegundoTempo && paradas[k + 1]?.secao === secao) k += 1;
    u = k;
    alvo = k;
    vel = 0;
    perto = -1;
    desenhar(u);
    mostrarGrupo(paradas[perto]?.secao === 'industrias');
  };
  let espera = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(espera);
    espera = window.setTimeout(() => {
      // Só quando o palco muda de verdade: a barra de endereço do celular
      // some e aparece, e altera a altura em poucos px.
      const mudou = stage.clientWidth !== medida.w || Math.abs(stage.clientHeight - medida.h) > 120;
      if (mudou && !toque) refazer();
    }, 200);
  });
  document.fonts?.ready.then(refazer);

  // ---- estado inicial ----
  refazer();

  // Quem chega por um link direto (/#contato) vai para a seção depois da
  // abertura do site.
  const inicial = ANCORAS[location.hash];
  if (inicial && inicial !== 'inicio') {
    const abrir = () => irParaSecao(inicial);
    if (document.body.classList.contains('entered')) abrir();
    else {
      const obs = new MutationObserver(() => {
        if (!document.body.classList.contains('entered')) return;
        obs.disconnect();
        window.setTimeout(abrir, 900);
      });
      obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  } else if (inicial === 'inicio') {
    // /#historia: o navegador rola sozinho até a seção, mas mede a página
    // ainda deslocada pela abertura do site e para 40px abaixo do topo.
    const aoTopo = () => requestAnimationFrame(() => {
      if (!emPalco && window.scrollY > 0 && window.scrollY < 120) {
        window.scrollTo({ top: historia.topoNaPagina(), behavior: 'instant' });
      }
    });
    if (document.readyState === 'complete') aoTopo();
    else window.addEventListener('load', aoTopo, { once: true });
  }

  // Só no `npm run dev`: window.__palco.estado() mostra onde o palco está,
  // para conferir no console (e nos testes automáticos).
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__palco = {
      estado: () => ({
        u: Number(u.toFixed(3)), alvo, parada: paradas[perto]?.id, emPalco, voando: !!voo, catalogoAberto,
        paradas: paradas.map((p) => p.id),
      }),
      // Pula a história e vai direto a uma parada (pelo número).
      ir: (k: number) => irPara(k),
    };
  }

  // ============================================================= contrato
  let passouDoFim = false;
  return {
    historiaConcluiu: entrar,
    alemDoFim(px) {
      ultimoScrollDaPagina = performance.now();
      // "Ao passar do primeiro, pula para o próximo": o scroll que segue
      // depois do último quadro leva às indústrias.
      if (passouDoFim || !emPalco || voo || toque?.tipo === 'palco') return;
      if (px > stage.offsetHeight * 0.06 && alvo < 1) {
        passouDoFim = true;
        irAte(1, MOLA.passo);
      }
    },
    paginaParou: () => tentarRecolher(true),
  };
}
