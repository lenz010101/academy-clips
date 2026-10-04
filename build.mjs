// academy-clips: VO de 90s + visuales del take.
// young-on-camera y pantallas explicativas ocupan TODO el cuadro 9:16.
// Tramos en los que el take muestra solo pared/vacío no se usan.
import fs from "fs";
const TOTAL = 90.0;
const tr = JSON.parse(fs.readFileSync("./transcript.json", "utf8"));
const words = Array.isArray(tr) ? tr : tr.words;
const lastEnd = words[words.length - 1].end;
const S = TOTAL / lastEnd;
const SRC_RATIO = 92.35 / TOTAL; // timeline -> tiempo del take original

// Palabras clave del discurso -> serif cursiva (como en la referencia de edicion)
const HLRE = /^(guion|guiones|guión|guia|guía|clientes|potenciales|automatización|automatizaciones|administrador|anuncios|whatsapp|gratis|extra|irresistibles|irresistible|chau|pasos|paso|diferencian|diferencia|mes|sistema|academia|captación|difícil|sola|frío|inscripción|inscribir|contacto|inteligencia artificial|herramienta|campaña|formulario|formularios)$/i;
const isHL = (w) => HLRE.test(w.replace(/[.,!?¿¡]/g, ""));

// ---- Segmentos visuales: del take, solo donde se ve al joven o la pantalla ----
// type: "face" (joven a cámara) | "screen" (explica un tema mirando la compu)
// off/end = tiempo EN EL TAKE (base.mp4 / clip base 1)
const SEGMENTS = [
  { type: "face", off: 0.0, end: 8.6 },
  { type: "screen", off: 8.6, end: 31.5 },
  { type: "face", off: 31.5, end: 36.5 },
  { type: "screen", off: 36.5, end: 68.5 },
  { type: "face", off: 68.5, end: 92.465 },
];

// ---- beats -> captions (1 frase corta por vez) ----
const beats = [];
let cur = [];
const flush = () => { if (cur.length) beats.push(cur); cur = []; };
for (const w of words) {
  cur.push(w);
  const nx = words[words.indexOf(w) + 1];
  const gap = nx ? nx.start - w.end : 0;
  if (cur.length >= 3 || /[.!?,:;]$/.test(w.text) || gap > 0.55) flush();
}
flush();
for (let i = beats.length - 1; i > 0; i--) {
  const b = beats[i];
  const d = (b[b.length - 1].end + 0.12 - b[0].start) * S;
  if (d < 0.6) { beats[i - 1] = beats[i - 1].concat(b); beats.splice(i, 1); }
}
beats.forEach((b) => {
  b._t0 = +(b[0].start * S).toFixed(2);
  b._t1 = Math.min(TOTAL, +((b[b.length - 1].end + 0.12) * S).toFixed(2));
  b._txt = b.map((w) => w.text).join(" ");
  b._paso = /\bpaso\b/.test(b._txt.toLowerCase());
});
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// timeline -> segmento de take
const segAt = (t) => SEGMENTS.find((s) => t * SRC_RATIO >= s.off && t * SRC_RATIO < s.end) || null;

// ---- ventanas de video (una por segmento) ----
let clips = "", tweens = "";
const usable = [];
SEGMENTS.forEach((sg, i) => {
  const tl0 = sg.off / SRC_RATIO;
  const tl1 = Math.min(TOTAL, sg.end / SRC_RATIO);
  if (tl1 - tl0 < 1.2) return;
  const span = +(tl1 - tl0).toFixed(2);
  usable.push({ i, tl0, span, type: sg.type });
  const off = +sg.off.toFixed(2);
  if (sg.type === "screen") {
    // lienzo borroso PRIMERO (detras): la pantalla se ve completa y el fondo se rellena solo
    clips += `      <video id="sg${i}b" class="clip take blurbg" src="assets/vid/take.mp4#t=${off.toFixed(2)}" data-media-start="${off.toFixed(2)}" muted playsinline preload="auto" data-start="${tl0.toFixed(2)}" data-duration="${span}" data-playback-rate="${SRC_RATIO.toFixed(5)}"></video>\n`;
  }
  clips += `      <video id="sg${i}" class="clip take ${sg.type}" src="assets/vid/take.mp4#t=${off.toFixed(2)}" data-media-start="${off.toFixed(2)}" muted playsinline preload="auto" data-start="${tl0.toFixed(2)}" data-duration="${span}" data-playback-rate="${SRC_RATIO.toFixed(5)}"></video>\n`;
  tweens += `      tl.fromTo("#sg${i}", { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: .22, ease: "power2.out", immediateRender: false }, ${tl0.toFixed(2)});\n`;
  tweens += `      tl.to("#sg${i}", { opacity: 0, scale: 1.03, duration: .14, ease: "power2.in" }, ${+(tl1 - 0.14).toFixed(2)});\n`;
  if (sg.type === "screen") {
    tweens += `      tl.fromTo("#sg${i}b", { opacity: 0 }, { opacity: 1, duration: .22, ease: "power2.out", immediateRender: false }, ${tl0.toFixed(2)});\n`;
    tweens += `      tl.to("#sg${i}b", { opacity: 0, duration: .14, ease: "power2.in" }, ${+(tl1 - 0.14).toFixed(2)});\n`;
  }
  // scrim suave arriba para legibilidad de captions
  clips += `      <div id="sc${i}" class="clip scrim" data-start="${tl0.toFixed(2)}" data-duration="${span}"></div>\n`;
  tweens += `      tl.fromTo("#sc${i}", { opacity: 0 }, { opacity: 1, duration: .22, ease: "power2.out", immediateRender: false }, ${tl0.toFixed(2)});\n`;
  tweens += `      tl.to("#sc${i}", { opacity: 0, duration: .14, ease: "power2.in" }, ${+(tl1 - 0.14).toFixed(2)});\n`;
  console.log(`sg${i} ${sg.type} take[${sg.off}-${sg.end}] -> tl[${tl0.toFixed(2)}-${tl1.toFixed(2)}] span=${span}`);
});

// ---- captions (las 3 "Paso" van a placa negra; despues de 84.6 manda el cartel) ----
const ctaT = 84.6;
let capClips = "";
const capTweens = [];
const kartelBeats = [];
beats.forEach((b, i) => { if (kartelBeats.length < 3 && b._paso) kartelBeats.push(i); });
beats.forEach((b, i) => {
  if (kartelBeats.includes(i)) return;
  const t0 = b._t0;
  if (t0 < 1.44 || t0 >= ctaT) return;
  const nextStart = (() => { for (let j = i + 1; j < beats.length; j++) { if (!kartelBeats.includes(j)) return beats[j]._t0; } return TOTAL; })();
  const end = +Math.min(ctaT - 0.03, b._t1 + 0.28, nextStart - 0.03).toFixed(2);
  if (end - t0 < 0.2) return;
  const totch = b.reduce((a, w) => a + w.text.length, 0);
  const fs = totch <= 12 ? 112 : totch <= 20 ? 92 : totch <= 28 ? 76 : 62;
  const inner = b.map((w) => isHL(w.text) ? `<em>${esc(w.text)}</em>` : `<span>${esc(w.text)}</span>`).join(" ");
  const sg = segAt(t0);
  const isScreen = sg && sg.type === "screen";
  const cls = isScreen ? " cc screen-cap" : " cc";
  capClips += `      <div id="cap${i}" class="clip" data-start="${t0}" data-duration="${+(end - t0).toFixed(2)}"><div class="group${cls}" data-layout-allow-overlap>\n        <div class="lne" id="cpl${i}" style="font-size:${fs}px">${inner}</div>\n      </div></div>\n`;
  capTweens.push(`      tl.fromTo("#cpl${i}", { opacity: 0, scale: .82, y: 24 }, { opacity: 1, scale: 1, y: 0, duration: .2, ease: "back.out(2.2)", immediateRender: false }, ${t0});`);
  capTweens.push(`      tl.to("#cap${i}", { opacity: 0, y: -14, duration: .1, ease: "power2.in" }, ${+(end - 0.1).toFixed(2)});`);
});
clips += capClips;
tweens += capTweens.join("\n");

// ---- placas negras "Paso N" + cartel final GUÍA ----
let blackClips = "";
let sfxClips = "";
{
  const paso = beats.filter((_, i) => kartelBeats.includes(i)).slice(0, 3);
  paso.forEach((b, k) => {
    const t0 = +Math.max(0, b._t0 - 0.25).toFixed(2);
    const dur = +Math.min(2.0, b._t1 + 0.4 - t0).toFixed(2);
    blackClips += `      <div id="blk${k}" class="clip blk" data-layout-allow-overlap data-start="${t0}" data-duration="${dur}"><div class="bgroup" data-layout-allow-overlap><div class="bnum grot" data-layout-allow-overlap>0${k + 1}</div><div class="bword grot" data-layout-allow-overlap>Paso ${k + 1}</div><div class="brule"></div></div><div class="bflash"></div></div>\n`;
    tweens += `      tl.fromTo("#blk${k} .bflash", { opacity: .95 }, { opacity: 0, duration: .26, ease: "power2.out", immediateRender: false }, ${t0});\n`;
    tweens += `      tl.fromTo("#blk${k} .bnum", { opacity: 0, scale: 1.28 }, { opacity: 1, scale: 1, duration: .7, ease: "power3.out", immediateRender: false }, ${+(t0 + 0.02).toFixed(2)});\n`;
    tweens += `      tl.fromTo("#blk${k} .bword", { opacity: 0, scale: .8 }, { opacity: 1, scale: 1, duration: .22, ease: "back.out(1.6)", immediateRender: false }, ${+(t0 + 0.05).toFixed(2)});\n`;
    tweens += `      tl.fromTo("#blk${k} .brule", { opacity: 0, scaleX: 0 }, { opacity: 1, scaleX: 1, duration: .3, ease: "power3.out" }, ${+(t0 + 0.3).toFixed(2)});\n`;
    // zoom suave del conjunto (nítido: solo escala, sin blur)
    tweens += `      tl.fromTo("#blk${k} .bgroup", { scale: 1 }, { scale: 1.07, duration: ${dur}, ease: "power1.out", immediateRender: false }, ${t0});\n`;
    tweens += `      tl.to("#blk${k} .bword", { opacity: 0, duration: .12, ease: "power2.in" }, ${+(t0 + dur - 0.13).toFixed(2)});\n`;
    tweens += `      tl.to("#blk${k} .bnum", { opacity: 0, duration: .12, ease: "power2.in" }, ${+(t0 + dur - 0.13).toFixed(2)});\n`;
    tweens += `      tl.to("#blk${k} .brule", { opacity: 0, duration: .12, ease: "power2.in" }, ${+(t0 + dur - 0.13).toFixed(2)});\n`;
    sfxClips += `      <audio id="sfxp${k}" src="assets/sfx/whoosh-big.mp3" data-start="${t0}" data-duration="1.6" data-volume="0.8"></audio>\n`;
  });
}
const ctaClip = `      <div id="cta" class="clip" data-start="${ctaT}" data-duration="${+(TOTAL - ctaT).toFixed(2)}"><div class="endcard"><div class="end-kick">comentá la palabra</div><div class="end-big">GUÍA</div><div class="end-sub">y te la mando para recibirla</div></div></div>\n`;
tweens += `      tl.fromTo("#cta .endcard", { opacity: 0 }, { opacity: 1, duration: .3, ease: "power2.out", immediateRender: false }, ${ctaT});\n`;
tweens += `      tl.fromTo("#cta .end-big", { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .4, ease: "back.out(1.8)", immediateRender: false }, ${+(ctaT + 0.05).toFixed(2)});\n`;
sfxClips += `      <audio id="sfxcta" src="assets/sfx/pop.mp3" data-start="${ctaT}" data-duration="0.62" data-volume="0.8"></audio>\n`;

// ---- whoosh en cada corte de plano ----
usable.forEach((u, k) => {
  if (k === 0) return;
  sfxClips += `      <audio id="sfxw${k}" src="assets/sfx/whoosh.mp3" data-start="${u.tl0.toFixed(2)}" data-duration="0.51" data-volume="0.75"></audio>\n`;
});

// ---- voz (idéntica al reel-90: arranca con el joven, calzada a captions) ----
const VO_T0 = 1.44;
const VO_OFF = beats.flat()[0].start;
const VO_RATE = +((lastEnd - VO_OFF) / (TOTAL - VO_T0)).toFixed(5);
const VO_DUR = +(TOTAL - VO_T0).toFixed(2);
console.log(`voice t0=${VO_T0} off=${VO_OFF} rate=${VO_RATE} dur=${VO_DUR}`);

const html = `<!doctype html>
<html lang="es" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="assets/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Archivo"; src: url("assets/fonts/ArchivoBlack.woff2") format("woff2"); font-weight: 900; }
      @font-face { font-family: "Playfair"; src: url("assets/fonts/PlayfairDisplay.woff2") format("woff2"); font-weight: 700; font-style: italic; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      .clip { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; overflow: hidden; }
      /* joven a camara: full-bleed 9:16 */
      .take.face { object-fit: cover; }
      /* pantalla: completa y grande, fondo rellenado con lienzo borroso */
      .take.screen { object-fit: contain; object-position: center center; background: #000; }
      .take.blurbg { left: -110px; top: -110px; width: 1300px; height: 2140px; object-fit: cover;
        filter: blur(62px) brightness(.5) saturate(1.3); border-radius: 0; }
      .scrim { background: linear-gradient(180deg, rgba(5,5,8,.66) 0%, rgba(5,5,8,.30) 30%, rgba(5,5,8,0) 50%); }
      .group { position: absolute; left: 0; width: 1080px; display: flex; flex-direction: column;
        align-items: center; justify-content: flex-end; will-change: transform, opacity; }
      .group.cc { top: 0; height: 700px; padding: 0 44px 40px; }
      /* captions arriba del todo: la pantalla queda libre abajo (piso 800-1500) */
      .group.cc.screen-cap { height: 300px; justify-content: flex-start; padding: 34px 44px 0; }
      .lne { opacity: 0; text-align: center; line-height: 1.16; color: #F6F3EC;
        font-family: "Archivo", sans-serif; font-weight: 900; letter-spacing: -1px;
        text-shadow: 0 2px 10px rgba(0,0,0,.5); max-width: 992px; will-change: transform, opacity; }
      .lne em { font-family: "Playfair", serif; font-style: italic; font-weight: 700; letter-spacing: -1px; }
      /* captions sobre pantalla: sin pastilla (el pedido) — solo sombra suave */
      .group.cc.screen-cap .lne { background: none; border-radius: 0; padding: 0; }
      /* placas Paso N */
      .clip.blk { background: #101010; }
      .grot { font-family: "Archivo", sans-serif; font-weight: 900; }
      .bgroup { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; display: flex;
        flex-direction: column; align-items: center; justify-content: center; gap: 30px; }
      .bword { color: #F6F3EC; font-size: 168px; letter-spacing: -4px; opacity: 0; position: relative; z-index: 1; will-change: transform, opacity; }
      .bnum { position: absolute; left: 0; top: 50%; margin-top: -320px; width: 1080px; text-align: center;
        font-size: 640px; line-height: 1; letter-spacing: -18px; color: transparent;
        -webkit-text-stroke: 5px rgba(246,243,236,.15); opacity: 0; z-index: 0; will-change: transform, opacity; }
      .brule { position: relative; z-index: 1; width: 220px; height: 12px; border-radius: 6px;
        background: #D2401F; opacity: 0; transform-origin: center center; }
      .bflash { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; background: #D2401F; opacity: 0; z-index: 2; }
      /* cartel final GUÍA */
      .endcard { position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; background: rgba(6,8,14,.88);
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; opacity: 0; }
      .end-kick { font-family: "Archivo", sans-serif; font-weight: 900; font-size: 40px; letter-spacing: 10px; color: #F6F3EC; }
      .end-big { font-family: "Archivo", sans-serif; font-weight: 900; font-size: 290px; letter-spacing: -8px; color: #F6F3EC;
        text-shadow: 0 6px 40px rgba(0,0,0,.6); }
      .end-sub { font-family: "Archivo", sans-serif; font-weight: 900; font-size: 44px; color: #F6F3EC; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1080" data-height="1920">
      <audio id="voice" src="assets/vo90.m4a" data-start="${VO_T0}" data-duration="${VO_DUR}" data-media-start="${VO_OFF.toFixed(2)}" data-playback-rate="${VO_RATE}"></audio>
${sfxClips}${clips}${blackClips}${ctaClip}    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
${tweens}      tl.seek(0);
    </script>
  </body>
</html>
`;
fs.writeFileSync("index.html", html);
console.log("wrote index.html total=" + TOTAL);