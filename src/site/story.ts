// História de abertura do site institucional (index.html): as marcas em
// espiral caem no celular do vendedor, o pedido é criado, segue para o
// caminhão e o caminhão percorre a rota até a loja. A linha do tempo é do
// GSAP e quem a move é o scroll (ver "scroll" no fim de iniciar()); nada
// aqui depende do React do portal.
import { gsap } from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { iniciarPalco, type Palco } from './palco';

gsap.registerPlugin(MotionPathPlugin);

// Mesmos arquivos da grade "Nossas indústrias".
const MARCAS: [arquivo: string, nome: string][] = [
  ['froneri', 'Froneri'],
  ['vigor', 'Vigor'],
  ['pullman', 'Pullman'],
  ['ana-maria', 'Ana Maria'],
  ['santa-helena', 'Santa Helena'],
  ['dadinho', 'Dadinho'],
  ['nutrella', 'Nutrella'],
  ['rap10', 'Rap10'],
  ['bacio-di-latte', 'Bacio di Latte'],
  ['danubio', 'Danubio'],
  ['verde-campo', 'Verde Campo'],
  ['erlan', 'Erlan'],
  ['melhor-bocado', 'Melhor Bocado'],
  ['bom-destino', 'Bom Destino'],
  ['crocantissimo', 'Crocantíssimo'],
  ['da-terrinha', 'Da Terrinha'],
  ['faixa-azul', 'Faixa Azul'],
  ['muai', 'MUAI'],
  ['pratic-leve', 'Pratic Leve'],
  ['reserva-one', 'Reserva One'],
  ['shamara', 'Shamara'],
  ['spres', 'Spres'],
  ['vovo-clara', 'Vovó Clara'],
];

const TILES = 12;
// Ponta do indicador dentro do SVG da mão (200x300).
const DEDO = { x: 58, y: 8 };

// Mapa, nas unidades do desenho (o SVG em index.html).
const CD = { x: 130, y: 540 };
const LOJA = { x: 860, y: 150 };
const CENTRO_ROTA = { x: 495, y: 345 };
// Trecho do desenho que aparece nas telas largas: um cartão. No celular o
// trecho é calculado para cada tela (ver construir) e só não pode passar
// do que está desenhado.
const CARTAO = { x: 0, y: 0, w: 1000, h: 620 };
const ARTE = { x: -1200, y: -1900, w: 3400, h: 4100 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function montarMarcas(scene: HTMLElement, tiles: HTMLElement) {
  const chips = MARCAS.map(([arquivo, nome]) => {
    const chip = document.createElement('div');
    chip.className = 'story-chip';
    const img = document.createElement('img');
    img.src = `/assets/images/marcas/${arquivo}.webp`;
    img.alt = nome;
    img.decoding = 'async';
    chip.append(img);
    return chip;
  });
  // Antes do celular no DOM não importa: a ordem visual vem do z-index.
  scene.append(...chips);

  const tileEls = MARCAS.slice(0, TILES).map(([arquivo]) => {
    const tile = document.createElement('div');
    tile.className = 'story-tile';
    const img = document.createElement('img');
    img.src = `/assets/images/marcas/${arquivo}.webp`;
    img.alt = '';
    tile.append(img);
    return tile;
  });
  tiles.append(...tileEls);

  return { chips, tileEls };
}

function iniciar() {
  const story = document.querySelector<HTMLElement>('.story');
  const stage = story?.querySelector<HTMLElement>('.story-stage');
  const scene = story?.querySelector<HTMLElement>('.story-scene');
  const tilesBox = story?.querySelector<HTMLElement>('.story-tiles');
  if (!story || !stage || !scene || !tilesBox) return;

  const $ = <T extends Element = HTMLElement>(sel: string) =>
    story.querySelector<T>(sel)!;

  const caixa = $('.story-captions');
  const captions = gsap.utils.toArray<HTMLElement>('.story-caption', story);
  const scrim = $('.story-scrim');
  const phone = $('.story-phone');
  const hand = $('.story-hand');
  const truck = $('.story-truck');
  const map = $('.story-map');
  // Dois desenhos do mesmo tamanho: o mapa e, por cima, a rota.
  const mapSvgs = Array.from(story.querySelectorAll<SVGSVGElement>('.story-map > svg'));
  const pin = $('.story-pin');
  const pulse = $<SVGCircleElement>('.story-pulse');
  const route = $<SVGPathElement>('.story-route');
  const mapTruck = $<SVGGElement>('.story-map-truck');
  const mapTruckBody = $<SVGGElement>('.story-map-truck-body');
  const rotuloCd = $('.story-map-label.is-cd');
  const rotuloLoja = $('.story-map-label.is-store');
  const count = $('.story-count strong');
  const button = $('.story-order-button');
  const labelCreate = $('.story-order-button .is-create');
  const labelSent = $('.story-order-button .is-sent');
  const parcels = gsap.utils.toArray<HTMLElement>('.story-parcel', story);
  const header = document.querySelector<HTMLElement>('.header');

  const { chips, tileEls } = montarMarcas(scene, tilesBox);
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Mesmo corte do CSS: tela estreita e em pé. Nela o texto fica em cima
  // e a cena ocupa a tela inteira.
  const celular = window.matchMedia('(max-width: 860px) and (orientation: portrait)');

  story.classList.add('is-live');
  story.classList.toggle('is-static', reduzido);
  if (reduzido) story.classList.remove('is-live');
  // A cena só existe com JS; sem a classe is-live o CSS a esconde.
  scene.style.visibility = 'visible';

  // ---- estado do scroll (explicado em "scroll", mais abaixo) ----
  let estado: 'armada' | 'concluida' = 'armada';
  let recolhida = false;
  let reiniciada = false;
  // Depois que a história termina, quem conduz é o palco (palco.ts): o
  // scroll não mexe mais nela.
  let suspensa = false;
  // Sobra de scroll depois do último quadro (--story-pista no CSS). Só
  // existe com o palco ligado e enquanto a seção não foi recolhida.
  let pista = 0;

  // Distância de scroll que a história ocupa.
  const curso = () => story.offsetHeight - stage.offsetHeight - (recolhida ? 0 : pista);

  // Quanto da história o scroll já percorreu, de 0 a 1.
  const medir = () => {
    const r = story.getBoundingClientRect();
    const c = r.height - stage.offsetHeight - (recolhida ? 0 : pista);
    return { r, p: c > 1 ? gsap.utils.clamp(0, 1, -r.top / c) : 0 };
  };

  // Pela cadeia de offsetTop, que ignora transform: logo depois da
  // abertura o conteúdo do site ainda está deslocado pela transição de
  // entrada e o getBoundingClientRect daria uma posição errada.
  const topoNaPagina = () => {
    let topo = 0;
    for (let el: HTMLElement | null = story; el; el = el.offsetParent as HTMLElement | null) {
      topo += el.offsetTop;
    }
    return topo;
  };

  // ---- montagem ----
  let ctx: gsap.Context | undefined;
  let medida = { w: 0, h: 0 };
  let tl!: gsap.core.Timeline;
  let suave: gsap.core.Tween | undefined;
  let marcar = () => {};

  const construir = () => {
    ctx?.revert();
    const W = scene.clientWidth;
    const H = scene.clientHeight;
    medida = { w: W, h: H };

    // No celular a cena é a tela inteira, e cada passo usa o espaço que
    // sobra abaixo do texto daquele passo. Nas telas largas a cena é a
    // coluna da direita e todos os passos usam a coluna toda.
    const empilhado = celular.matches;
    const folga = empilhado ? 14 : 0;
    const fimDoTexto = (i: number) =>
      caixa.offsetTop + captions[i].offsetTop + captions[i].offsetHeight;
    // y: quanto o centro da área fica abaixo do centro da cena. `pe` é o
    // que fica reservado embaixo.
    const area = (topo: number, pe = 0) => ({
      y: (topo - folga - pe) / 2,
      w: W,
      h: Math.max(H - topo - folga - pe, 160),
    });
    // No celular a barra de paradas do palco (palco.ts) aparece no pé da
    // tela a partir do último quadro: a rota já se desenha acima dela.
    const barra = empilhado && !reduzido ? 82 : 0;
    const livre = area(0);
    const aEspiral = empilhado ? area(fimDoTexto(0) + 4) : livre;
    const aCelular = empilhado
      ? area(Math.max(fimDoTexto(1), fimDoTexto(2)) + 10)
      : livre;
    // No celular o mapa passa por trás do texto; a rota fica abaixo da
    // faixa (scrim) que protege o texto.
    const aRota = empilhado ? area(fimDoTexto(3) + 42, barra) : livre;
    const aFinal = empilhado ? area(fimDoTexto(4) + 42, barra) : livre;
    const retrato = aCelular.w < 640 || aCelular.w / aCelular.h < 0.95;
    story.classList.toggle('is-fullmap', empilhado);

    ctx = gsap.context(() => {
      // ---- medidas ----
      const lado = Math.min(aEspiral.w, aEspiral.h);
      const chipBase = gsap.utils.clamp(0.5, 1.1, lado / (empilhado ? 540 : 620));
      const chipMenor = empilhado ? 0.58 : 0.62;
      const raioChip = 48 * chipBase * 1.2;
      // No celular a espiral encosta nas bordas sem cortar nenhuma marca
      // e se alonga na vertical para aproveitar a altura.
      const rx = empilhado ? aEspiral.w / 2 - raioChip - 6 : lado * 0.47;
      const ry = empilhado
        ? Math.max(Math.min(rx * 1.45, aEspiral.h / 2 - raioChip - 4), 40)
        : rx * 0.92;
      const rMin = empilhado ? rx * 0.32 : lado * 0.13;

      const ps = empilhado
        ? Math.min((aCelular.h * 0.96) / 510, (aCelular.w * 0.72) / 250, 1.15)
        : Math.min((H * 0.84) / 510, (W * 0.62) / 250, 1.05);
      const phoneY = empilhado ? aCelular.y : H * 0.04;
      // Destino das marcas: a grade de itens na tela do celular.
      const alvo = { x: 0, y: phoneY - 10 * ps };

      // Passo do caminhão: lado a lado, ou celular reduzido em cima e
      // caminhão embaixo quando a área é estreita.
      let ts: number;
      let phoneLado: { x: number; y: number; s: number };
      let truckPos: { x: number; y: number };
      if (retrato) {
        const uso = Math.min(aCelular.h, aCelular.w * 1.6);
        ts = Math.min((aCelular.w * 0.9) / 440, (uso * 0.42) / 230);
        const resto = uso - 230 * ts - 20;
        phoneLado = {
          x: 0,
          y: aCelular.y - uso / 2 + resto / 2,
          s: Math.min(ps * 0.62, (resto * 0.96) / 510),
        };
        truckPos = { x: 0, y: aCelular.y + uso / 2 - 115 * ts };
      } else {
        ts = Math.min((W * 0.5) / 440, (aCelular.h * 0.5) / 230, 1.1);
        phoneLado = { x: -W * 0.27, y: aCelular.y, s: ps * 0.74 };
        truckPos = { x: W * 0.2, y: aCelular.y + aCelular.h * 0.06 };
      }
      // Centro do baú, em relação ao centro do caminhão.
      const bau = { x: truckPos.x - 75 * ts, y: truckPos.y - 22 * ts };
      const arco = Math.min(aCelular.w, aCelular.h) * 0.16;

      // Mapa: cartão inclinado nas telas largas; no celular, o chão da
      // tela inteira, com a rota ocupando a largura.
      const ms = empilhado
        ? gsap.utils.clamp(
            0.3,
            1.1,
            Math.min(
              (aRota.w * 0.76) / (LOJA.x - CD.x),
              // a rota, o alfinete e o rótulo do CD precisam caber abaixo
              // do texto final
              (aFinal.h * 0.96 - 130) / 351,
            ),
          )
        : retrato
          ? W / 1000
          : Math.min((W * 0.86) / 1000, (H * 0.86) / 620);
      const mapX = empilhado || retrato ? 0 : W * 0.03;
      const mapY = empilhado ? aRota.y : retrato ? -H * 0.04 : H * 0.02;
      const mapYFinal = empilhado ? aFinal.y : mapY;
      const tilt = empilhado
        ? { de: 56, chega: 40, fim: 26 }
        : { de: 62, chega: 52, fim: retrato ? 24 : 30 };

      // No celular o mapa é um plano inclinado que tem de cobrir a tela da
      // faixa do texto até a borda de baixo. Quanto do desenho isso exige
      // depende da tela, então sai da própria projeção: a distância no
      // plano (d) que, vista em perspectiva, alcança cada borda. A conta
      // usa a inclinação de chegada, que é a mais forte com o mapa no
      // lugar e por isso a que mais encurta o plano.
      let recorte = CARTAO;
      if (empilhado) {
        const P = parseFloat(getComputedStyle(scene).perspective) || 1400;
        const rad = (tilt.chega * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        // alturas na tela, medidas a partir do centro da cena
        const yTopo = fimDoTexto(3) - 6 - H / 2; // acima disso a faixa do texto é opaca
        const yBase = H / 2 + 16;
        const acima = (P * (mapY - yTopo)) / (c * P + yTopo * s);
        const abaixo = (P * (yBase - mapY)) / (c * P + yBase * s);
        // lá no fundo o plano aparece menor, então precisa ser mais largo
        const meia = ((W / 2) * (P + acima * s)) / P;
        const sobra = 90; // unidades de folga em cada borda
        const x0 = Math.max(ARTE.x, CENTRO_ROTA.x - meia / ms - sobra);
        const x1 = Math.min(ARTE.x + ARTE.w, CENTRO_ROTA.x + meia / ms + sobra);
        const y0 = Math.max(ARTE.y, CENTRO_ROTA.y - acima / ms - sobra);
        const y1 = Math.min(ARTE.y + ARTE.h, CENTRO_ROTA.y + abaixo / ms + sobra);
        recorte = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      // Ponto do mapa que fica parado na tela e em torno do qual ele inclina.
      const origem = empilhado
        ? {
            x: (CENTRO_ROTA.x - recorte.x) / recorte.w,
            y: (CENTRO_ROTA.y - recorte.y) / recorte.h,
          }
        : { x: 0.5, y: 0.5 };

      // O mapa é desenhado maior do que aparece e reduzido na transformação
      // (q vezes): a perspectiva amplia a parte de baixo, e sem essa folga
      // ela sairia borrada. No celular a folga é menor para não pesar.
      const q = empilhado ? Math.min(1 / ms, 1.4) : 1 / ms;
      map.style.width = `${recorte.w * ms * q}px`;
      map.style.height = `${recorte.h * ms * q}px`;
      map.style.setProperty('--q', String(q));
      map.style.setProperty('--u', String(gsap.utils.clamp(1, 3, 1 / ms)));
      mapSvgs.forEach((svg) => {
        svg.setAttribute('viewBox', `${recorte.x} ${recorte.y} ${recorte.w} ${recorte.h}`);
      });
      const ponto = (p: { x: number; y: number }) => ({
        left: `${((p.x - recorte.x) / recorte.w) * 100}%`,
        top: `${((p.y - recorte.y) / recorte.h) * 100}%`,
      });
      Object.assign(rotuloCd.style, ponto(CD));
      Object.assign(rotuloLoja.style, ponto(LOJA));
      Object.assign(pin.style, ponto(LOJA));

      // Mão: nas telas largas sobe quase na vertical; no celular entra
      // mais deitada, pela lateral, para aparecer mais que a ponta do dedo.
      const hs = ps * 0.95;
      const toque = { x: 66 * ps - DEDO.x, y: phoneY + 205 * ps - DEDO.y };
      const mao = empilhado
        ? { fora: { x: W * 0.7, y: H * 0.3 }, giro: -46, giroFora: -58 }
        : { fora: { x: W * 0.5, y: H * 0.7 }, giro: -14, giroFora: -24 };

      // ---- estado inicial ----
      const voo = chips.map(() => ({ t: 0 }));
      // O que não muda com o voo sai da conta de cada quadro.
      const espiral = chips.map((_, i) => {
        const f = i / (chips.length - 1);
        return {
          raio: lerp(rMin, rx, Math.pow(f, 0.85)),
          escala: chipBase * lerp(chipMenor, 1.2, f),
        };
      });
      const achatado = ry / rx;
      // Escreve o estilo direto, sem passar pelo gsap.set: são 23 marcas a
      // cada quadro do scroll, e criar um tween para cada uma pesava no
      // celular. O resultado é o mesmo (posição, tamanho e autoAlpha).
      const posicionar = (i: number) => {
        const t = voo[i].t;
        const raio = espiral[i].raio * (1 - t);
        const ang = i * 0.62 + t * 2.6;
        const x = alvo.x * t + Math.cos(ang) * raio;
        const y = lerp(aEspiral.y, alvo.y, t) + Math.sin(ang) * raio * achatado;
        const escala = lerp(espiral[i].escala, 0.26 * ps, t);
        const alfa = t < 0.86 ? 1 : 1 - (t - 0.86) / 0.14;
        const estilo = chips[i].style;
        estilo.transform =
          `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${escala.toFixed(4)})`;
        estilo.opacity = alfa.toFixed(3);
        estilo.visibility = alfa > 0 ? 'inherit' : 'hidden';
      };
      chips.forEach((chip, i) => {
        chip.style.zIndex = String(10 + i);
        posicionar(i);
      });

      // yPercent explícito: nas telas largas o texto é centrado na
      // vertical pelo CSS (translateY(-50%)). Deixar o GSAP adivinhar essa
      // porcentagem falha em algumas alturas, por arredondamento, e o
      // texto desce meia altura.
      gsap.set(captions, { autoAlpha: 0, y: 0, yPercent: empilhado ? 0 : -50 });
      gsap.set(captions[0], { autoAlpha: 1 });
      gsap.set(scrim, { height: fimDoTexto(3) + 42, autoAlpha: 0 });
      gsap.set(phone, {
        x: 0, y: phoneY + H, scale: ps, rotationX: 30, rotationY: -26, zIndex: 5,
      });
      gsap.set(tileEls, { scale: 0, autoAlpha: 0 });
      gsap.set(labelSent, { autoAlpha: 0 });
      gsap.set(labelCreate, { autoAlpha: 1 });
      gsap.set(hand, {
        x: toque.x + mao.fora.x, y: toque.y + mao.fora.y,
        scale: hs, rotation: mao.giroFora, transformOrigin: `${DEDO.x}px ${DEDO.y}px`,
        zIndex: 60, autoAlpha: 0,
      });
      gsap.set(parcels, { x: phoneLado.x, y: phoneLado.y, scale: 0, autoAlpha: 0, zIndex: 40 });
      gsap.set(truck, { x: truckPos.x + W * 1.2, y: truckPos.y, scale: ts, zIndex: 30 });
      gsap.set(map, {
        xPercent: -origem.x * 100, yPercent: -origem.y * 100,
        transformOrigin: `${origem.x * 100}% ${origem.y * 100}%`,
        x: mapX, y: mapY + H * 1.1, scale: 1 / q, rotationX: tilt.de, autoAlpha: 0, zIndex: 20,
      });
      gsap.set([rotuloCd, rotuloLoja], { autoAlpha: 0 });
      gsap.set(pin, {
        xPercent: -50, yPercent: -100, y: -160 * q, rotationX: -tilt.fim,
        transformOrigin: '50% 100%', autoAlpha: 0,
      });
      gsap.set(pulse, { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%' });
      const comprimento = route.getTotalLength();
      gsap.set(route, { strokeDasharray: comprimento, strokeDashoffset: comprimento });
      // O grupo de fora anda pela rota; o de dentro só guarda o tamanho.
      mapTruckBody.setAttribute('transform', `scale(${gsap.utils.clamp(1, 1.7, 1 / ms)})`);
      gsap.set(mapTruck, { x: CD.x, y: CD.y, rotation: 0 });

      // ---- linha do tempo ----
      // Parada: quem dita o andamento é o scroll.
      tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
      const trocar = (de: number, para: number, em: number) => {
        tl.to(captions[de], { autoAlpha: 0, y: -14, duration: 0.35, ease: 'power1.in' }, em);
        tl.fromTo(captions[para],
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power1.out' }, em + 0.35);
      };

      // 1. as marcas caem no celular
      tl.to(phone, { y: phoneY, rotationX: 10, rotationY: -12, duration: 1.3, ease: 'power2.out' }, 0);
      trocar(0, 1, 0.7);
      voo.forEach((v, i) => {
        tl.to(v, {
          t: 1, duration: 1.4, ease: 'power1.inOut', onUpdate: () => posicionar(i),
        }, 0.3 + i * 0.065);
      });
      tileEls.forEach((tile, k) => {
        tl.to(tile, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)' }, 1.4 + k * 0.14);
      });

      // 2. a mão cria o pedido
      tl.to(phone, { rotationX: 0, rotationY: 0, duration: 0.6 }, 3.1);
      tl.to(hand, {
        x: toque.x, y: toque.y, rotation: mao.giro, autoAlpha: 1,
        duration: 0.7, ease: 'power2.out',
      }, 3.15);
      tl.to(hand, { scale: hs * 0.93, duration: 0.14, ease: 'power1.in' }, 3.9);
      tl.to(button, { scale: 0.95, duration: 0.14, ease: 'power1.in' }, 3.9);
      tl.to(labelCreate, { autoAlpha: 0, duration: 0.1 }, 4.04);
      tl.to(labelSent, { autoAlpha: 1, duration: 0.1 }, 4.04);
      tl.to(button, { scale: 1, backgroundColor: '#5f9a1c', duration: 0.2, ease: 'power1.out' }, 4.04);
      tl.to(hand, { scale: hs, duration: 0.2, ease: 'power1.out' }, 4.04);
      tl.to(hand, {
        x: toque.x + mao.fora.x, y: toque.y + mao.fora.y, rotation: mao.giroFora,
        autoAlpha: 0, duration: 0.6, ease: 'power2.in',
      }, 4.3);
      trocar(1, 2, 4.15);

      // 3. o pedido vai para o caminhão
      tl.to(phone, { x: phoneLado.x, y: phoneLado.y, scale: phoneLado.s, duration: 0.8 }, 4.5);
      tl.to(truck, { x: truckPos.x, duration: 0.9, ease: 'power2.out' }, 4.6);
      parcels.forEach((parcel, k) => {
        const em = 5.4 + k * 0.28;
        const topo = Math.min(phoneLado.y, bau.y) - arco;
        tl.set(parcel, { autoAlpha: 1 }, em);
        tl.to(parcel, { scale: ts * 1.1, duration: 0.2, ease: 'back.out(2)' }, em);
        tl.to(parcel, { x: bau.x, duration: 0.7, ease: 'none' }, em);
        tl.to(parcel, { y: topo, duration: 0.35, ease: 'power1.out' }, em);
        tl.to(parcel, { y: bau.y, duration: 0.35, ease: 'power1.in' }, em + 0.35);
        tl.to(parcel, { scale: 0, autoAlpha: 0, duration: 0.12 }, em + 0.66);
        tl.fromTo(truck, { y: truckPos.y },
          { y: truckPos.y + 5 * ts, duration: 0.08, yoyo: true, repeat: 1, ease: 'none', immediateRender: false },
          em + 0.68);
      });

      // 4. o caminhão sai e a rota aparece
      tl.to(truck, { x: truckPos.x + W * 1.3, duration: 0.9, ease: 'power2.in' }, 6.5);
      tl.to(phone, {
        x: retrato ? 0 : -W, y: retrato ? -H : phoneLado.y, autoAlpha: 0, duration: 0.8, ease: 'power2.in',
      }, 6.5);
      trocar(2, 3, 6.7);
      if (empilhado) tl.to(scrim, { autoAlpha: 1, duration: 0.6, ease: 'none' }, 6.9);
      tl.to(map, { y: mapY, autoAlpha: 1, rotationX: tilt.chega, duration: 1, ease: 'power2.out' }, 6.9);
      tl.to(rotuloCd, { autoAlpha: 1, duration: 0.3 }, 7.5);
      tl.to(route, { strokeDashoffset: 0, duration: 2, ease: 'none' }, 7.7);
      tl.to(mapTruck, {
        duration: 2, ease: 'none',
        motionPath: { path: route, autoRotate: true, end: 0.87 },
      }, 7.7);
      tl.to(map, { rotationX: tilt.fim, duration: 1.8, ease: 'none' }, 7.9);

      // 5. ponto de entrega e a frase da empresa
      tl.to(pin, { y: 0, autoAlpha: 1, duration: 0.45, ease: 'back.out(1.6)' }, 9.55);
      tl.to(pulse, { scale: 1, autoAlpha: 1, duration: 0.4, ease: 'power2.out' }, 9.75);
      tl.to(rotuloLoja, { autoAlpha: 1, duration: 0.3 }, 9.8);
      trocar(3, 4, 9.6);
      if (empilhado) {
        // O texto final é mais alto: a faixa cresce e o mapa desce junto.
        tl.to(scrim, { height: fimDoTexto(4) + 42, duration: 0.6 }, 9.7);
        tl.to(map, { y: mapYFinal, duration: 0.6 }, 9.7);
      }
      tl.to({}, { duration: 0.5 }, 10.4);

      // Só escreve quando o número muda: trocar o texto a cada quadro
      // refazia o layout do celular desenhado 60 vezes por segundo.
      let contagem = -1;
      marcar = () => {
        let n = 0;
        for (const v of voo) if (v.t > 0.9) n++;
        if (n === contagem) return;
        contagem = n;
        count.textContent = String(n);
      };
      tl.eventCallback('onUpdate', marcar);

      // Leva a linha do tempo até o ponto do scroll com um pequeno
      // atraso, para o movimento não ficar seco (ver seguir()).
      suave = reduzido
        ? undefined
        : gsap.to(tl, { progress: 0, duration: 0.6, ease: 'expo', paused: true });
    }, story);

    // Reconstruir (girar o aparelho, fonte que termina de carregar) não
    // pode devolver a animação ao começo.
    if (reduzido) {
      tl.progress(1);
      // O CSS (.is-static) decide quais textos ficam à mostra.
      gsap.set(captions, { clearProps: 'all' });
    } else if (estado === 'armada') {
      tl.progress(medir().p);
    } else if (!reiniciada) {
      tl.progress(1);
    }
    marcar();
  };

  construir();

  // Refaz as medidas quando elas deixam de valer: a tela muda de tamanho
  // ou a fonte termina de carregar (o que muda a quebra de linha dos
  // textos e, no celular, o espaço que sobra para a cena).
  const manterMedidas = (refazer: () => void) => {
    let espera = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => {
        // Só quando a cena muda de verdade — a barra de endereço do
        // celular some/aparece durante o scroll e altera a altura em
        // poucos px.
        const mudou =
          scene.clientWidth !== medida.w || Math.abs(scene.clientHeight - medida.h) > 120;
        if (mudou) refazer();
      }, 200);
    });
    document.fonts?.ready.then(refazer);
  };

  if (reduzido) {
    manterMedidas(construir);
    return;
  }

  // Indústrias, catálogo, sobre e contato abrem dentro deste mesmo palco
  // (palco.ts), que assume quando a história termina.
  const palco: Palco | undefined = iniciarPalco({
    story,
    stage,
    concluir: () => {
      if (estado !== 'concluida') {
        estado = 'concluida';
        reiniciada = false;
        suave?.pause();
        tl.progress(1);
        marcar();
      }
      suspensa = true;
      story.classList.add('is-concluida');
    },
    // Só com tudo parado (ver recolher, abaixo): tira a altura extra e
    // deixa a página no topo do palco.
    recolher: () => {
      if (recolhida || estado !== 'concluida') return;
      story.classList.add('is-collapsed');
      recolhida = true;
      window.scrollTo({ top: topoNaPagina(), behavior: 'instant' });
    },
    recolhida: () => recolhida,
    topoNaPagina,
  });

  // ---- scroll ----
  // O scroll só leva a animação para a frente.
  //
  // armada    A história acompanha o scroll, nos dois sentidos, até
  //           chegar ao fim pela primeira vez.
  // concluida Chegou ao fim: daqui em diante o scroll não mexe mais na
  //           animação. Duas coisas acontecem, cada uma no momento em que
  //           ninguém percebe:
  //           - reiniciar: quando a seção sai inteira da tela, a animação
  //             volta ao começo;
  //           - recolher: quando o scroll para, a seção perde a altura
  //             extra e passa a ter uma tela só, de modo que quem sobe
  //             encontra a abertura como uma seção comum, sem atravessar
  //             a animação de trás para a frente.
  //           Ao chegar ao topo com a animação já no começo, ela é
  //           rearmada: rolar para baixo conta a história de novo.
  const seguir = (p: number) => {
    if (!suave) return;
    suave.vars.progress = p;
    suave.invalidate().restart();
  };

  // Tira a altura extra e corrige o scroll na mesma hora, para a tela
  // não se mexer. Só é chamada com o scroll parado: mudar a posição no
  // meio do deslize do dedo trava ou é ignorado no iPhone.
  const recolher = () => {
    const antes = story.offsetHeight;
    const y = window.scrollY;
    const topo = story.getBoundingClientRect().top + y;
    story.classList.add('is-collapsed');
    recolhida = true;
    const sobra = antes - story.offsetHeight;
    if (y > topo && sobra > 0) {
      // 'instant' porque o site usa scroll-behavior: smooth.
      window.scrollTo({ top: Math.max(topo, y - sobra), behavior: 'instant' });
    }
  };

  // No celular o cabeçalho sai de cena enquanto a história ocupa a tela
  // e volta junto com o resto do site.
  const cabecalho = (r: DOMRect, p: number) => {
    const alto = header?.offsetHeight ?? 0;
    const quadro = estado === 'armada' ? p : reiniciada ? 0 : 1;
    const imersivo =
      !suspensa && celular.matches && quadro > 0.03 && r.top < alto && r.bottom > alto;
    if (imersivo) document.body.classList.add('story-solto');
    document.body.classList.toggle('story-imersivo', imersivo);
  };

  const avaliar = (parado = false) => {
    if (suspensa) {
      // O palco está no comando; a história só informa onde o scroll está
      // e quando ele parou.
      if (parado) palco?.paginaParou();
      else if (!recolhida) palco?.alemDoFim(-story.getBoundingClientRect().top - curso());
      return;
    }
    const { r, p } = medir();
    let caixaAtual = r;

    if (estado === 'armada') {
      seguir(p);
      if (p >= 0.999) {
        estado = 'concluida';
        if (palco) {
          // Fim da história: daqui em diante o palco conduz (inclusive o
          // cabeçalho e o momento de recolher a seção).
          suspensa = true;
          story.classList.add('is-concluida');
          palco.historiaConcluiu();
          return;
        }
      }
    }

    if (estado === 'concluida') {
      const noTopo = r.top >= -1;
      if (r.bottom <= 0 && !reiniciada) {
        suave?.pause();
        tl.progress(0);
        reiniciada = true;
      }
      if (noTopo && reiniciada) {
        story.classList.remove('is-collapsed');
        recolhida = false;
        reiniciada = false;
        estado = 'armada';
      } else if (!recolhida && (parado || noTopo)) {
        recolher();
        caixaAtual = story.getBoundingClientRect();
      }
    }

    cabecalho(caixaAtual, p);
    // O palco mostra a barra de paradas a partir do último quadro.
    story.classList.toggle('is-concluida', estado === 'concluida' && !reiniciada);
  };

  // "Parado" = sem evento de scroll há um instante e sem dedo na tela.
  // Um temporizador só por pausa (ele mesmo se reagenda se o scroll
  // continuou), em vez de cancelar e criar um a cada evento de scroll.
  let tocando = false;
  let pausa = 0;
  let ultimoMovimento = 0;
  const conferirPausa = () => {
    const falta = 160 - (performance.now() - ultimoMovimento);
    if (falta > 0) {
      pausa = window.setTimeout(conferirPausa, falta);
      return;
    }
    pausa = 0;
    if (!tocando) avaliar(true);
  };
  const aoParar = () => {
    ultimoMovimento = performance.now();
    if (!pausa) pausa = window.setTimeout(conferirPausa, 160);
  };
  let quadroPedido = 0;
  window.addEventListener('scroll', () => {
    if (!quadroPedido) {
      quadroPedido = requestAnimationFrame(() => {
        quadroPedido = 0;
        avaliar();
      });
    }
    aoParar();
  }, { passive: true });
  window.addEventListener('touchstart', () => { tocando = true; }, { passive: true });
  const aoSoltar = (e: TouchEvent) => {
    tocando = e.touches.length > 0;
    aoParar();
  };
  window.addEventListener('touchend', aoSoltar, { passive: true });
  window.addEventListener('touchcancel', aoSoltar, { passive: true });

  // Recarregar a página sempre começa do topo: a posição guardada pelo
  // navegador pode ser de quando a seção estava recolhida e cairia no
  // meio da animação.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  avaliar();
  // Quem abre a página já abaixo da história (um link para #contato, por
  // exemplo) não gera scroll: sem esta chamada a seção só recolheria
  // depois do primeiro movimento.
  aoParar();
  // A pista tem três telas: o que a inércia de um deslize forte percorre
  // depois do último quadro.
  const medirPista = () => {
    if (!palco || recolhida) return;
    pista = Math.round(stage.offsetHeight * 3);
    story.style.setProperty('--story-pista', `${pista}px`);
  };

  manterMedidas(() => {
    medirPista();
    construir();
    avaliar();
  });

  medirPista();

  // Só no `npm run dev`: /?p=0.5 abre a página já em 50% da história,
  // para conferir um quadro sem rolar.
  if (import.meta.env.DEV) {
    const p = new URLSearchParams(location.search).get('p');
    if (p !== null) {
      window.setTimeout(() => {
        window.scrollTo(0, topoNaPagina() + curso() * Number(p));
      }, 3400);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}
