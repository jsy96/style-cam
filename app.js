(() => {
  'use strict';

  const STYLES = [
    { id: 'yarn', name: '毛线旅行家', tagline: '把熟悉的人与物，织成掌心里的温柔。' },
    { id: 'blocks', name: '积木星球', tagline: '一块一块，搭出另一个宇宙。' },
    { id: 'mecha', name: '机甲模型盒', tagline: '把日常，装配成未来收藏品。' },
    { id: 'retro', name: '掌上像素梦', tagline: '把你的世界，装进一台小小掌机。' },
    { id: 'clay', name: '软陶盲盒', tagline: '捏一份柔软的、可以收藏的想象。' },
    { id: 'paper', name: '纸间剧场', tagline: '折叠光影，让画面站起来。' },
    { id: 'chrome', name: '液态银诗', tagline: '让轮廓流动，让光成为颜色。' },
    { id: 'jelly', name: '果冻宇宙', tagline: '给世界一点透明、轻盈和弹性。' },
    { id: 'terrarium', name: '口袋生态舱', tagline: '把一个小世界，藏进玻璃球。' },
    { id: 'risograph', name: '孔版夏日', tagline: '留住油墨颗粒里的夏天。' }
  ];

  const MODES = [
    { id: 'strength', name: '强度大小' },
    { id: 'style', name: '风格切换' },
    { id: 'radius', name: '圆圈大小' },
    { id: 'source', name: '轮换照片' },
    { id: 'view', name: '原图 / 效果' },
    { id: 'works', name: '查看作品' }
  ];

  const DEFAULT_PORTRAITS = Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      url: `./assets/portraits/${number}.png`,
      name: `默认肖像 ${number}.png`
    };
  });

  const MAX_RADIUS = 1.50;
  const FULL_COVER_RADIUS = 1.42;
  const MAX_SOURCES = 16;
  const MAX_WORKS = 24;

  const state = {
    mode: 'style',
    maskSide: 'inside',
    creativeDisplay: false,
    view: 'effect',
    radiusTarget: 0.25,
    radius: 0.25,
    centerXTarget: 0.50,
    centerYTarget: 0.48,
    centerX: 0.50,
    centerY: 0.48,
    strengthTarget: 0.82,
    strength: 0.82,
    styleIndex: 0,
    styleA: 0,
    styleB: 0,
    styleBlend: 0,
    styleBlendTarget: 0,
    sourceIndex: 0,
    dialAngle: 0,
    dialAngleTarget: 0,
    workBrowseIndex: 0
  };

  const hardware = {
    port: null,
    reader: null,
    reading: false,
    connected: false,
    connecting: false,
    simulated: false,
    mode: 'normal',
    lastEvent: '等待输入',
    lastEventAt: null
  };

  const elements = {
    canvas: document.getElementById('stage'),
    stageStack: document.getElementById('stage-stack'),
    originalPreview: document.getElementById('original-preview'),
    maskRing: document.getElementById('mask-ring'),
    styleTagline: document.getElementById('style-tagline'),
    maskStatus: document.getElementById('mask-status'),
    strengthStatus: document.getElementById('strength-status'),
    modeName: document.getElementById('mode-name'),
    modeValue: document.getElementById('mode-value'),
    dial: document.getElementById('dial'),
    functionGrid: document.getElementById('function-grid'),
    machinePanel: document.querySelector('.machine-panel'),
    homeworkMode: document.getElementById('homework-mode'),
    hardwareChip: document.getElementById('hardware-chip'),
    hardwareModule: document.querySelector('.hardware-module'),
    hardwareStateLine: document.getElementById('hardware-state-line'),
    hardwareEvent: document.getElementById('hardware-event'),
    hardwareConnect: document.getElementById('hardware-connect'),
    sourceSurface: document.getElementById('source-surface'),
    sourceEmpty: document.querySelector('.source-empty'),
    sourceCount: document.getElementById('source-count'),
    worksSurface: document.getElementById('works-surface'),
    worksEmpty: document.querySelector('.works-empty'),
    workCount: document.getElementById('work-count'),
    worksLabel: document.getElementById('works-label'),
    uploadButton: document.getElementById('upload-button'),
    organizeButton: document.getElementById('organize-button'),
    fileInput: document.getElementById('file-input'),
    aiResultLayer: document.getElementById('ai-result-layer'),
    aiResultImage: document.getElementById('ai-result-image'),
    aiResultBadge: document.getElementById('ai-result-badge'),
    toast: document.getElementById('toast'),
    workDialog: document.getElementById('work-dialog'),
    dialogTitle: document.getElementById('dialog-title'),
    dialogMeta: document.getElementById('dialog-meta'),
    dialogOriginal: document.getElementById('dialog-original'),
    dialogResult: document.getElementById('dialog-result'),
    dialogDownload: document.getElementById('dialog-download'),
    dialogSave: document.getElementById('dialog-save'),
    dialogCreative: document.getElementById('dialog-creative'),
    dialogClose: document.getElementById('dialog-close'),
    dialogResultLabel: document.getElementById('dialog-result-label')
  };

  const sources = [];
  const works = [];
  let sourcesOrganized = false;
  let worksOrganized = false;
  let inputCommandSerial = 0;
  const aiPipeline = {
    checking: true,
    available: false,
    configured: false,
    generating: false,
    current: null
  };
  let toastTimer = 0;
  let dialogContext = { work: null, saved: false };
  const savedEffectSignatures = new Set();
  const pendingSaveSignatures = new Set();

  function showTap(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 1800);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function modulo(index, delta, count) {
    if (count <= 0) return 0;
    return ((index + delta) % count + count) % count;
  }

  function shortestDelta(current, target, count) {
    const raw = ((target - current) % count + count) % count;
    return raw > count / 2 ? raw - count : raw;
  }

  function ease(current, target, dt, speed = 82) {
    const next = current + (target - current) * (1 - Math.exp(-dt * 1000 / speed));
    return Math.abs(target - next) < 0.0008 ? target : next;
  }

  /* ---------------- WebGL live renderer ---------------- */

  const vertexShaderSource = `
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main() {
      vUv = aPosition * 0.5 + 0.5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTexture;
    uniform vec2 uTexel;
    uniform float uAspect;
    uniform float uStyleA;
    uniform float uStyleB;
    uniform float uStyleMix;
    uniform float uStrength;
    uniform vec2 uMask;
    uniform float uRadius;
    uniform float uSide;
    uniform float uView;
    uniform float uTime;

    // One set of image features is shared by every style.  This avoids running
    // expensive classic filters twice while a style transition is blending.
    vec3 gOriginal;
    vec3 gSmooth;
    vec3 gAbstract;
    vec2 gGradient;
    float gEdge;
    vec3 gNormal;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    vec3 imageAt(vec2 uv) {
      vec2 factor = vec2(min(1.0 / uAspect, 1.0), min(uAspect, 1.0));
      vec2 texUv = clamp(0.5 + (uv - 0.5) * factor, 0.002, 0.998);
      return texture2D(uTexture, texUv).rgb;
    }

    float lum(vec3 color) {
      return dot(color, vec3(0.299, 0.587, 0.114));
    }

    vec2 rotate(vec2 p, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    }

    vec3 rgb2hsv(vec3 color) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(color.bg, K.wz), vec4(color.gb, K.xy), step(color.b, color.g));
      vec4 q = mix(vec4(p.xyw, color.r), vec4(color.r, p.yzx), step(p.x, color.r));
      float d = q.x - min(q.w, q.y);
      float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 color) {
      vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      vec3 p = abs(fract(color.xxx + K.xyz) * 6.0 - K.www);
      return color.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), color.y);
    }

    // A compact 3x3 bilateral filter: the classic fast local edge-preserving
    // pre-pass.  It removes camera noise while keeping eyes, hair and contours.
    vec3 bilateralSmooth(vec2 uv) {
      vec3 center = imageAt(uv);
      vec3 sum = center;
      float weightSum = 1.0;
      float spatial = 2.4;
      float range = 0.20;

      for (int y = -1; y <= 1; y += 1) {
        for (int x = -1; x <= 1; x += 1) {
          if (x == 0 && y == 0) continue;
          vec2 offset = vec2(float(x), float(y)) * uTexel * spatial;
          vec3 sampleColor = imageAt(uv + offset);
          vec3 delta = sampleColor - center;
          float spatialWeight = exp(-dot(offset, offset) / (2.0 * spatial * spatial * uTexel.x * uTexel.x));
          float rangeWeight = exp(-dot(delta, delta) / (2.0 * range * range));
          float weight = spatialWeight * rangeWeight;
          sum += sampleColor * weight;
          weightSum += weight;
        }
      }
      return sum / weightSum;
    }

    // Generalized Kuwahara: four quadrants compete by variance.  It is one of
    // the standard image-abstraction operators and creates coherent painterly
    // regions without destroying the subject boundary.
    vec4 kuwaharaQuadrant(vec2 uv, vec2 direction, float radius) {
      vec2 a = direction * uTexel * radius * vec2(0.22, 0.22);
      vec2 b = direction * uTexel * radius * vec2(1.00, 0.22);
      vec2 c = direction * uTexel * radius * vec2(0.22, 1.00);
      vec2 d = direction * uTexel * radius * vec2(1.00, 1.00);
      vec2 e = direction * uTexel * radius * vec2(0.60, 0.60);

      vec3 s0 = imageAt(uv + a);
      vec3 s1 = imageAt(uv + b);
      vec3 s2 = imageAt(uv + c);
      vec3 s3 = imageAt(uv + d);
      vec3 s4 = imageAt(uv + e);
      vec3 sum = s0 + s1 + s2 + s3 + s4;
      vec3 square = s0 * s0 + s1 * s1 + s2 * s2 + s3 * s3 + s4 * s4;
      vec3 mean = sum / 5.0;
      vec3 variance = max(square / 5.0 - mean * mean, vec3(0.0));
      return vec4(mean, dot(variance, vec3(0.3333333)));
    }

    vec3 compactKuwahara(vec2 uv, float radius) {
      vec4 q0 = kuwaharaQuadrant(uv, vec2(-1.0, -1.0), radius);
      vec4 q1 = kuwaharaQuadrant(uv, vec2( 1.0, -1.0), radius);
      vec4 q2 = kuwaharaQuadrant(uv, vec2(-1.0,  1.0), radius);
      vec4 q3 = kuwaharaQuadrant(uv, vec2( 1.0,  1.0), radius);

      vec4 chosen = q0;
      if (q1.w < chosen.w) chosen = q1;
      if (q2.w < chosen.w) chosen = q2;
      if (q3.w < chosen.w) chosen = q3;
      return chosen.rgb;
    }

    void buildFeatures(vec2 uv) {
      gOriginal = imageAt(uv);
      gSmooth = bilateralSmooth(uv);
      gAbstract = compactKuwahara(uv, max(4.0, min(9.0, 6.2 / max(uTexel.x, uTexel.y))));

      // Classic Sobel operator on luminance.  The result is shared by ink,
      // panel-line, normal-map, glass and metallic styles.
      float l00 = lum(imageAt(uv + uTexel * vec2(-1.0,  1.0)));
      float l10 = lum(imageAt(uv + uTexel * vec2( 0.0,  1.0)));
      float l20 = lum(imageAt(uv + uTexel * vec2( 1.0,  1.0)));
      float l01 = lum(imageAt(uv + uTexel * vec2(-1.0,  0.0)));
      float l21 = lum(imageAt(uv + uTexel * vec2( 1.0,  0.0)));
      float l02 = lum(imageAt(uv + uTexel * vec2(-1.0, -1.0)));
      float l12 = lum(imageAt(uv + uTexel * vec2( 0.0, -1.0)));
      float l22 = lum(imageAt(uv + uTexel * vec2( 1.0, -1.0)));

      float gx = (l20 + 2.0 * l21 + l22) - (l00 + 2.0 * l01 + l02);
      float gy = (l00 + 2.0 * l10 + l20) - (l02 + 2.0 * l12 + l22);
      gGradient = vec2(gx, gy) * 0.50;
      gEdge = clamp(length(gGradient) * 1.65, 0.0, 1.0);
      gNormal = normalize(vec3(-gGradient.x * 1.30, -gGradient.y * 1.30, 0.18));
    }

    vec3 toneMap(vec3 color, float saturation, float contrast) {
      float l = lum(color);
      vec3 result = mix(vec3(l), color, saturation);
      result = (result - 0.5) * contrast + 0.5;
      return clamp(result, 0.0, 1.0);
    }

    vec3 quantizeColor(vec3 color, float levels) {
      return floor(color * (levels - 1.0) + 0.5) / (levels - 1.0);
    }

    vec3 quantizeHsv(vec3 color, float hueSteps, float saturationSteps, float valueSteps) {
      vec3 hsv = rgb2hsv(clamp(color, 0.0, 1.0));
      hsv.x = floor(hsv.x * hueSteps + 0.5) / hueSteps;
      hsv.y = floor(hsv.y * saturationSteps + 0.5) / saturationSteps;
      hsv.z = floor(hsv.z * valueSteps + 0.5) / (valueSteps - 1.0);
      return hsv2rgb(clamp(hsv, 0.0, 1.0));
    }

    vec3 luminanceRamp(float value, vec3 dark, vec3 middle, vec3 light) {
      float v = clamp(value, 0.0, 1.0);
      return mix(mix(dark, middle, smoothstep(0.0, 0.54, v)), light, smoothstep(0.48, 1.0, v));
    }

    vec3 luminanceRamp4(float value, vec3 c0, vec3 c1, vec3 c2, vec3 c3) {
      float v = clamp(value, 0.0, 1.0);
      vec3 lower = mix(c0, c1, smoothstep(0.0, 0.36, v));
      vec3 upper = mix(c2, c3, smoothstep(0.62, 1.0, v));
      return mix(lower, upper, smoothstep(0.28, 0.74, v));
    }

    float bayer2(vec2 p) {
      vec2 q = mod(floor(p), 2.0);
      return mod(q.x * 3.0 + q.y * 2.0, 4.0) / 4.0;
    }

    float bayer4(vec2 p) {
      return bayer2(floor(p) * 0.5) * 0.25 + bayer2(floor(p));
    }

    float screenDot(vec2 uv, float angle, float frequency, float level) {
      vec2 p = rotate(uv, angle) * frequency;
      vec2 f = fract(p) - 0.5;
      float radius = clamp(level, 0.0, 1.0) * 0.82;
      return 1.0 - smoothstep(radius - 0.10, radius + 0.10, length(f) * 1.55);
    }

    vec3 yarnStyle(vec2 uv) {
      float l = lum(gAbstract);
      vec3 base = toneMap(gAbstract, 0.78, 1.04);
      vec3 ramp = luminanceRamp(l,
        vec3(0.085, 0.115, 0.205),
        vec3(0.760, 0.275, 0.310),
        vec3(0.985, 0.820, 0.590));
      vec3 wool = mix(ramp, base, 0.30);

      vec2 knitUv = uv / max(uTexel.x, uTexel.y);
      float thread = sin((knitUv.x * 0.72 + knitUv.y) * 122.0 + l * 13.0) * 0.5 + 0.5;
      float twist = sin((knitUv.x - knitUv.y * 0.45) * 71.0 + gAbstract.g * 10.0) * 0.5 + 0.5;
      float fiber = 0.83 + thread * 0.20 + twist * 0.10;
      wool *= fiber;
      wool += smoothstep(0.66, 1.0, l) * vec3(0.16, 0.13, 0.09);
      wool = mix(wool, wool * 0.55, smoothstep(0.36, 0.90, gEdge) * 0.55);
      return clamp(wool, 0.0, 1.0);
    }

    vec3 blockStyle(vec2 uv) {
      vec2 grid = vec2(27.0, 33.0);
      vec2 cell = floor(uv * grid);
      vec2 f = fract(uv * grid);
      vec3 quantized = quantizeHsv(gAbstract, 6.0, 3.0, 4.0);
      quantized = toneMap(quantized, 0.72, 1.05);
      quantized = mix(vec3(lum(quantized)), quantized, 0.76);

      float bevel = (0.5 - f.x) + (0.5 - f.y);
      float diffuse = clamp(0.72 + dot(gNormal, normalize(vec3(-0.35, 0.58, 0.72))) * 0.34 + bevel * 0.08, 0.0, 1.25);
      float specular = pow(clamp(dot(gNormal, normalize(vec3(-0.30, 0.72, 0.65))), 0.0, 1.0), 16.0);
      vec3 plastic = quantized * diffuse + specular * vec3(0.36, 0.36, 0.34);

      float distanceToEdge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
      float seam = smoothstep(0.435, 0.495, distanceToEdge);
      plastic *= 1.0 - seam * 0.36;
      plastic += hash(cell) * 0.025 - 0.012;
      return clamp(plastic, 0.0, 1.0);
    }

    vec3 mechaStyle() {
      float l = lum(gAbstract);
      vec3 quantized = quantizeHsv(gAbstract, 8.0, 2.0, 5.0);
      vec3 cool = luminanceRamp(l,
        vec3(0.055, 0.070, 0.100),
        vec3(0.270, 0.330, 0.420),
        vec3(0.760, 0.810, 0.870));
      vec3 accent = mix(quantized, vec3(0.980, 0.520, 0.210), smoothstep(0.55, 1.0, gAbstract.r - gAbstract.b) * 0.36);
      vec3 armor = mix(cool, accent, 0.22);

      float diffuse = clamp(0.60 + dot(gNormal, normalize(vec3(-0.25, 0.68, 0.70))) * 0.55, 0.0, 1.2);
      float hardSpec = pow(clamp(dot(gNormal, normalize(vec3(-0.42, 0.74, 0.55))), 0.0, 1.0), 28.0);
      armor *= diffuse;
      armor += hardSpec * vec3(0.72, 0.78, 0.86);
      armor *= 1.0 - smoothstep(0.22, 0.78, gEdge) * 0.66;
      return clamp(armor, 0.0, 1.0);
    }

    vec3 retroStyle(vec2 uv) {
      vec2 grid = vec2(144.0, 144.0);
      vec2 pixel = floor(uv * grid);
      vec2 pixelUv = (pixel + 0.5) / grid;
      vec3 pixelColor = imageAt(pixelUv);
      float value = lum(pixelColor);
      float dither = (bayer4(pixel) - 0.5) * 0.24;
      float tuned = clamp(value + dither, 0.0, 1.0);

      vec3 gameboy = luminanceRamp4(tuned,
        vec3(0.055, 0.220, 0.055),
        vec3(0.188, 0.385, 0.188),
        vec3(0.545, 0.675, 0.055),
        vec3(0.608, 0.737, 0.055));

      vec2 f = fract(uv * grid);
      float cellGap = smoothstep(0.40, 0.50, max(abs(f.x - 0.5), abs(f.y - 0.5)));
      gameboy *= 1.0 - cellGap * 0.16;
      gameboy += smoothstep(0.20, 0.90, value) * 0.10;
      return clamp(gameboy, 0.0, 1.0);
    }

    vec3 clayStyle() {
      vec3 quantized = quantizeHsv(gAbstract, 6.0, 3.0, 4.0);
      quantized = toneMap(quantized, 0.52, 0.94);
      quantized = mix(vec3(lum(quantized)), quantized, 0.76);
      quantized = mix(quantized, vec3(0.885, 0.755, 0.705), 0.13);

      float diffuse = clamp(0.68 + dot(gNormal, normalize(vec3(-0.22, 0.72, 0.68))) * 0.38, 0.0, 1.1);
      float matteSpec = pow(clamp(dot(gNormal, normalize(vec3(-0.18, 0.78, 0.62))), 0.0, 1.0), 10.0);
      vec3 clay = quantized * diffuse + matteSpec * vec3(0.28, 0.25, 0.24);
      clay = mix(clay, clay * 0.68, smoothstep(0.52, 1.0, gEdge) * 0.28);
      return clamp(clay, 0.0, 1.0);
    }

    vec3 paperStyle(vec2 uv) {
      vec3 paint = quantizeHsv(gSmooth, 7.0, 4.0, 5.0);
      paint = toneMap(paint, 0.68, 0.98);
      paint = mix(paint, vec3(0.975, 0.920, 0.820), 0.15);

      float line = smoothstep(0.34, 0.86, gEdge);
      vec3 ink = vec3(0.100, 0.095, 0.120);
      paint = mix(paint, ink, line * 0.72);

      float fold = sin((uv.x + uv.y * 0.62) * 18.0) * 0.5 + 0.5;
      paint *= 0.95 + fold * 0.05;
      paint += (noise(uv * 640.0) - 0.5) * 0.028;
      return clamp(paint, 0.0, 1.0);
    }

    vec3 chromeStyle(vec2 uv) {
      float l = lum(gAbstract);
      vec3 reflected = normalize(vec3(gNormal.xy * 2.35, 0.58));
      float flow = sin(reflected.x * 13.0 + reflected.y * 9.0 + l * 9.0) * 0.5 + 0.5;
      float sheet = sin((uv.x - uv.y * 0.58) * 27.0 + l * 11.0) * 0.5 + 0.5;

      vec3 silver = mix(vec3(0.340, 0.375, 0.430), vec3(0.920, 0.950, 1.000), smoothstep(0.08, 0.94, l * 0.72 + flow * 0.34));
      vec3 iridescent = mix(vec3(0.980, 0.730, 0.460), vec3(0.430, 0.730, 1.000), sheet);
      vec3 chrome = mix(silver, iridescent, 0.16 + flow * 0.15);

      float spec = pow(clamp(dot(gNormal, normalize(vec3(-0.35, 0.78, 0.52))), 0.0, 1.0), 22.0);
      chrome += spec * vec3(0.80, 0.86, 0.94);
      chrome *= 1.0 - smoothstep(0.38, 0.94, gEdge) * 0.32;
      return clamp(chrome, 0.0, 1.0);
    }

    vec3 jellyStyle(vec2 uv) {
      vec3 refracted = imageAt(uv + gNormal.xy * 0.012);
      vec3 candyBase = mix(gAbstract, refracted, 0.32);
      float l = lum(candyBase);
      vec3 candy = luminanceRamp(l,
        vec3(0.250, 0.130, 0.370),
        vec3(0.880, 0.270, 0.620),
        vec3(0.620, 0.930, 1.000));
      candy = mix(candy, toneMap(candyBase, 0.88, 1.04), 0.24);

      float subsurface = smoothstep(0.24, 0.88, l);
      float rim = smoothstep(0.24, 0.88, gEdge);
      float spec = pow(clamp(dot(gNormal, normalize(vec3(-0.25, 0.78, 0.58))), 0.0, 1.0), 18.0);
      candy *= 0.74 + subsurface * 0.50;
      candy += rim * vec3(0.240, 0.520, 0.660) + spec * vec3(0.68, 0.78, 0.88);
      return clamp(candy, 0.0, 1.0);
    }

    vec3 terrariumStyle(vec2 uv) {
      vec2 centered = uv - vec2(0.5, 0.5);
      float radius = length(centered);
      float orb = 1.0 - smoothstep(0.355, 0.405, radius);
      vec2 magnified = vec2(0.5, 0.5) + centered * 0.68 + gNormal.xy * 0.008;
      vec3 inside = imageAt(magnified);
      inside = mix(inside, gAbstract, 0.42);
      inside = toneMap(inside, 0.76, 1.03);
      inside = mix(inside, vec3(0.200, 0.460, 0.260), 0.10);

      vec3 outside = toneMap(gSmooth, 0.66, 0.96);
      outside = mix(outside, vec3(0.650, 0.720, 0.580), 0.22);
      outside *= 0.83 + smoothstep(0.0, 0.8, radius) * 0.12;

      float glassRim = smoothstep(0.315, 0.355, radius) * smoothstep(0.430, 0.370, radius);
      float highlight = 1.0 - smoothstep(0.0, 0.16, length(centered - vec2(-0.18, 0.16)));
      float dew = smoothstep(0.76, 1.0, noise(uv * 180.0)) * orb;

      vec3 result = mix(outside, inside, orb);
      result += glassRim * vec3(0.62, 0.72, 0.74) + highlight * vec3(0.22, 0.25, 0.24) + dew * 0.18;
      result *= 1.0 - smoothstep(0.36, 0.95, gEdge) * 0.18;
      return clamp(result, 0.0, 1.0);
    }

    vec3 risographStyle(vec2 uv) {
      vec3 base = gAbstract;
      float l = lum(base);
      float warm = clamp(base.r - base.b + 0.35, 0.0, 1.0);
      float cool = clamp(base.b - base.r + 0.35, 0.0, 1.0);
      float green = clamp(base.g + 0.20, 0.0, 1.0);

      float k = screenDot(uv + vec2(0.0015, -0.0010), 0.18, 88.0, clamp((1.0 - l) * 1.08, 0.0, 1.0));
      float c = screenDot(uv + vec2(-0.0022, 0.0012), -0.34, 94.0, cool * smoothstep(0.88, 0.18, l));
      float m = screenDot(uv + vec2(0.0020, 0.0016), 0.47, 90.0, warm * smoothstep(0.10, 0.78, l));
      float y = screenDot(uv + vec2(-0.0014, -0.0020), -0.12, 82.0, green * smoothstep(0.18, 0.86, l));

      vec3 paper = vec3(0.972, 0.928, 0.820);
      vec3 teal = vec3(0.070, 0.470, 0.520);
      vec3 apricot = vec3(0.960, 0.410, 0.220);
      vec3 violet = vec3(0.390, 0.240, 0.660);
      vec3 ink = vec3(0.075, 0.090, 0.135);

      vec3 riso = paper;
      riso = mix(riso, teal, c * 0.78);
      riso = mix(riso, apricot, m * 0.78);
      riso = mix(riso, violet, y * 0.46);
      riso = mix(riso, ink, k * 0.86);
      riso += (noise(uv * 760.0) - 0.5) * 0.035;
      return clamp(riso, 0.0, 1.0);
    }

    vec3 stylized(vec2 uv, float styleId) {
      if (styleId < 0.5) return yarnStyle(uv);
      if (styleId < 1.5) return blockStyle(uv);
      if (styleId < 2.5) return mechaStyle();
      if (styleId < 3.5) return retroStyle(uv);
      if (styleId < 4.5) return clayStyle();
      if (styleId < 5.5) return paperStyle(uv);
      if (styleId < 6.5) return chromeStyle(uv);
      if (styleId < 7.5) return jellyStyle(uv);
      if (styleId < 8.5) return terrariumStyle(uv);
      return risographStyle(uv);
    }

    void main() {
      buildFeatures(vUv);
      vec3 original = gOriginal;
      vec3 effect = mix(
        stylized(vUv, uStyleA),
        stylized(vUv, uStyleB),
        clamp(uStyleMix, 0.0, 1.0)
      );

      float dist = length(vUv - uMask);
      float edge = 2.5 / 1000.0;
      float inside = 1.0 - smoothstep(uRadius - edge, uRadius + edge, dist);
      float region = mix(inside, 1.0 - inside, uSide);

      // Radius 0 processes the complete outside; a radius beyond the image
      // diagonal processes the complete inside.
      region = mix(region, 1.0, step(uRadius, 0.002));
      region = mix(region, 1.0, step(1.42, uRadius));

      vec3 composed = mix(original, effect, clamp(uStrength * region, 0.0, 1.0));
      gl_FragColor = vec4(composed, 1.0);
    }
  `;

  function createRenderer(canvas) {
    const gl = canvas.getContext('webgl', {
      antialias: true,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false
    });
    if (!gl) throw new Error('当前浏览器不支持 WebGL');

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(error);
      }
      return shader;
    }

    const program = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, vertexShaderSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShaderSource);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([24, 25, 31, 255]));

    const uniforms = {
      texture: gl.getUniformLocation(program, 'uTexture'),
      aspect: gl.getUniformLocation(program, 'uAspect'),
      texel: gl.getUniformLocation(program, 'uTexel'),
      styleA: gl.getUniformLocation(program, 'uStyleA'),
      styleB: gl.getUniformLocation(program, 'uStyleB'),
      styleMix: gl.getUniformLocation(program, 'uStyleMix'),
      strength: gl.getUniformLocation(program, 'uStrength'),
      mask: gl.getUniformLocation(program, 'uMask'),
      radius: gl.getUniformLocation(program, 'uRadius'),
      side: gl.getUniformLocation(program, 'uSide'),
      view: gl.getUniformLocation(program, 'uView'),
      time: gl.getUniformLocation(program, 'uTime')
    };

    let aspect = 1;
    gl.uniform1i(uniforms.texture, 0);
    gl.viewport(0, 0, canvas.width, canvas.height);

    return {
      setImage(image) {
        aspect = Math.max(0.01, image.naturalWidth || image.width) / Math.max(1, image.naturalHeight || image.height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      },
      render(options = {}) {
        gl.useProgram(program);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1f(uniforms.aspect, aspect);
        gl.uniform2f(uniforms.texel, 1 / canvas.width, 1 / canvas.height);
        gl.uniform1f(uniforms.styleA, options.styleA ?? 0);
        gl.uniform1f(uniforms.styleB, options.styleB ?? 0);
        gl.uniform1f(uniforms.styleMix, options.styleMix ?? 0);
        gl.uniform1f(uniforms.strength, options.strength ?? 0.82);
        const maskY = 1 - (options.centerY ?? 0.5);
        gl.uniform2f(uniforms.mask, options.centerX ?? 0.5, maskY);
        gl.uniform1f(uniforms.radius, options.radius ?? 0.25);
        gl.uniform1f(uniforms.side, options.maskSide === 'outside' ? 1 : 0);
        gl.uniform1f(uniforms.view, options.view === 'original' ? 2 : 0);
        gl.uniform1f(uniforms.time, (performance.now() % 100000) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  let renderer;
  try {
    renderer = createRenderer(elements.canvas);
  } catch (error) {
    console.error(error);
    showTap('WebGL 初始化失败，请使用 Chrome / Edge / Safari 最新版本');
  }

  /* ---------------- Style switching ---------------- */

  function changeStyle(delta) {
    const previous = state.styleIndex;
    const next = modulo(previous, delta, STYLES.length);
    if (next === previous) return;
    if (state.styleBlend >= 1 || state.styleA === state.styleB) {
      state.styleA = previous;
      state.styleBlend = 0;
    }
    state.styleIndex = next;
    state.styleB = next;
    state.styleBlendTarget = 1;
    const style = STYLES[next];
    elements.styleTagline.textContent = style.tagline;
  }

  /* ---------------- Source portrait handling ---------------- */

  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('图片读取失败'));
      image.src = url;
    });
  }

  async function normalizeImageFile(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name || '文件'} 不是 JPEG / PNG / WebP`);
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImageFromUrl(url);
      const maxSide = 1600;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      return await loadImageFromUrl(dataUrl).then(loaded => ({ image: loaded, dataUrl, name: file.name || 'portrait.jpg' }));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function sourceBounds() {
    const rect = elements.sourceSurface.getBoundingClientRect();
    const first = sources[0]?.element;
    const width = first ? first.offsetWidth : 84;
    const height = first ? first.offsetHeight : 112;
    return {
      minX: 14,
      minY: Math.max(34, rect.height * 0.20),
      maxX: Math.max(20, rect.width - width - 14),
      maxY: Math.max(40, rect.height - height - 9),
      width,
      height
    };
  }

  function addSource({ image, dataUrl, name }, select = false) {
    if (sources.length >= MAX_SOURCES) {
      showTap(`最多保留 ${MAX_SOURCES} 张原始照片`);
      return;
    }
    const bounds = sourceBounds();
    const index = sources.length;
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'source-card';
    element.innerHTML = `
      <img alt="${name.replace(/[<>"]/g, '')}">
      <span class="card-index">${index + 1}</span>
    `;
    element.querySelector('img').src = dataUrl;
    elements.sourceSurface.append(element);

    const source = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      dataUrl,
      image,
      element,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: (Math.random() - 0.5) * 12,
      homeAngle: (Math.random() - 0.5) * 9,
      organized: false,
      targetX: null,
      targetY: null,
      dragging: false,
      moved: false
    };
    const lane = index % 5;
    source.x = bounds.minX + ((bounds.maxX - bounds.minX) * ((index % 7) / 6)) + (Math.random() - 0.5) * 22;
    source.y = bounds.minY + ((bounds.maxY - bounds.minY) * (lane / 4)) + (Math.random() - 0.5) * 9;
    source.x = clamp(source.x, bounds.minX, bounds.maxX);
    source.y = clamp(source.y, bounds.minY, bounds.maxY);
    sources.push(source);
    if (sourcesOrganized) organizeSources();
    installSourceDrag(source);
    elements.sourceEmpty.style.display = 'none';
    updateCounts();
    if (select || sources.length === 1) selectSource(sources.length - 1);
  }

  function selectSource(index) {
    if (index < 0 || index >= sources.length) return;
    state.sourceIndex = index;
    sources.forEach((source, i) => {
      source.element.classList.toggle('selected', i === index);
      source.element.style.zIndex = i === index ? 26 : 10 + i;
      source.element.querySelector('.card-index').textContent = String(i + 1);
    });
    renderer?.setImage(sources[index].image);
    elements.originalPreview.src = sources[index].dataUrl;
    updateUi();
  }

  function installSourceDrag(source) {
    let offsetX = 0;
    let offsetY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    source.element.addEventListener('pointerdown', event => {
      event.preventDefault();
      source.element.setPointerCapture(event.pointerId);
      source.dragging = true;
      source.organized = false;
      source.targetX = null;
      source.targetY = null;
      source.moved = false;
      source.element.classList.add('dragging');
      const rect = source.element.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = performance.now();
      source.vx = 0;
      source.vy = 0;
    });

    source.element.addEventListener('pointermove', event => {
      if (!source.dragging) return;
      const surface = elements.sourceSurface.getBoundingClientRect();
      let nextX = event.clientX - surface.left - offsetX;
      let nextY = event.clientY - surface.top - offsetY;
      if (Math.abs(nextX - source.x) > 3 || Math.abs(nextY - source.y) > 3) source.moved = true;
      const now = performance.now();
      const dt = Math.max(0.008, (now - lastTime) / 1000);
      source.vx = (event.clientX - lastX) / dt;
      source.vy = (event.clientY - lastY) / dt;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;
      source.x = nextX;
      source.y = nextY;
    });

    source.element.addEventListener('pointerup', event => {
      if (!source.dragging) return;
      source.dragging = false;
      source.element.classList.remove('dragging');
      if (!source.moved) {
        selectSource(sources.indexOf(source));
      } else {
        source.vx = clamp(source.vx, -1000, 1000) * 0.42;
        source.vy = clamp(source.vy, -1000, 1000) * 0.42;
      }
      event.preventDefault();
    });

    source.element.addEventListener('pointercancel', () => {
      source.dragging = false;
      source.element.classList.remove('dragging');
    });
  }

  function organizeSources() {
    if (!sources.length) return;
    const bounds = sourceBounds();
    const cardWidth = bounds.width || 72;
    const available = Math.max(0, bounds.maxX - bounds.minX);
    const naturalSpacing = cardWidth + 8;
    // Keep one left-to-right lane. When space is insufficient, cards compact
    // and overlap instead of wrapping; later cards naturally cover earlier ones.
    const spacing = sources.length > 1
      ? Math.max(cardWidth * 0.24, Math.min(naturalSpacing, available / (sources.length - 1)))
      : 0;
    const rowY = bounds.minY + ((bounds.maxY - bounds.minY) * 0.50);
    sources.forEach((source, index) => {
      source.organized = true;
      source.homeAngle = 0;
      source.targetX = bounds.minX + index * spacing;
      source.targetY = clamp(rowY, bounds.minY, bounds.maxY);
      source.vx = 0;
      source.vy = 0;
    });
  }

  function organizeWorks() {
    const cards = Array.from(elements.worksSurface.querySelectorAll('.work-card'));
    elements.worksSurface.classList.toggle('organized', Boolean(cards.length));
    if (!cards.length) return;

    const rect = elements.worksSurface.getBoundingClientRect();
    const cardWidth = cards[0].offsetWidth || 72;
    const available = Math.max(0, rect.width - 48);
    const naturalSpacing = cardWidth + 10;
    const spacing = cards.length > 1
      ? Math.max(cardWidth * 0.24, Math.min(naturalSpacing, (available - cardWidth) / (cards.length - 1)))
      : 0;
    cards.forEach((card, index) => {
      card.style.marginLeft = index === 0 ? '0px' : `${spacing - cardWidth}px`;
      card.style.setProperty('--tilt', '0deg');
      card.style.zIndex = String(10 + index);
    });
  }

  function organizeAll() {
    sourcesOrganized = true;
    worksOrganized = true;
    organizeSources();
    organizeWorks();
    showTap('已按从左到右整理，空间不足时自动紧凑重叠');
  }

  function updateSourcePhysics(dt) {
    const bounds = sourceBounds();
    sources.forEach((source, index) => {
      if (!source.dragging && source.organized && source.targetX !== null && source.targetY !== null) {
        source.x = ease(source.x, source.targetX, dt, 118);
        source.y = ease(source.y, source.targetY, dt, 118);
        if (Math.abs(source.x - source.targetX) < 0.08) source.x = source.targetX;
        if (Math.abs(source.y - source.targetY) < 0.08) source.y = source.targetY;
        source.vx = 0;
        source.vy = 0;
      } else if (!source.dragging) {
        source.x += source.vx * dt;
        source.y += source.vy * dt;
        const damping = Math.pow(0.018, dt);
        source.vx *= damping;
        source.vy *= damping;

        if (source.x < bounds.minX) {
          source.x = bounds.minX;
          source.vx = Math.abs(source.vx) * 0.42;
        }
        if (!source.organized && source.x > bounds.maxX) {
          source.x = bounds.maxX;
          source.vx = -Math.abs(source.vx) * 0.42;
        }
        if (source.y < bounds.minY) {
          source.y = bounds.minY;
          source.vy = Math.abs(source.vy) * 0.42;
        }
        if (source.y > bounds.maxY) {
          source.y = bounds.maxY;
          source.vy = -Math.abs(source.vy) * 0.42;
        }
        source.x = source.organized ? source.x : clamp(source.x, bounds.minX, bounds.maxX);
        source.y = source.organized ? source.y : clamp(source.y, bounds.minY, bounds.maxY);
      }

      source.angle = ease(source.angle, source.homeAngle + source.vx * 0.0035, dt, 120);
      const selected = index === state.sourceIndex;
      const scale = source.dragging ? 1.055 : selected ? 1.025 : 1;
      source.element.style.transform = `translate3d(${source.x.toFixed(2)}px, ${source.y.toFixed(2)}px, 0) rotate(${source.angle.toFixed(2)}deg) scale(${scale})`;
    });
  }

  async function importFiles(fileList) {
    const files = Array.from(fileList || []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    let added = 0;
    for (const file of files) {
      try {
        const normalized = await normalizeImageFile(file);
        addSource(normalized, added === 0 && files.length === 1);
        added += 1;
      } catch (error) {
        showTap(error.message || '图片导入失败');
      }
    }
    if (added) showTap(`已导入 ${added} 张照片`);
  }

  async function loadDefaultPortraits() {
    return Promise.all(DEFAULT_PORTRAITS.map(async portrait => {
      const image = await loadImageFromUrl(portrait.url);
      return { image, dataUrl: portrait.url, name: portrait.name };
    }));
  }

  /* ---------------- AI image pipeline ---------------- */

  function setAiService(available, configured) {
    aiPipeline.checking = false;
    aiPipeline.available = Boolean(available);
    aiPipeline.configured = Boolean(configured);
    updateAiUi();
  }

  async function detectAiService() {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error('AI service unavailable');
      const payload = await response.json();
      setAiService(Boolean(payload?.ok), Boolean(payload?.configured));
    } catch {
      setAiService(false, false);
    }
  }


  /* ---------------- EasyInput hardware bridge ----------------
     The browser side intentionally accepts two tiny line protocols so a
     course firmware only needs to print events; it does not need to implement
     the web application protocol. JSON Lines:
       {"type":"encoder","delta":1}
       {"type":"button","key":"S1","action":"down"}
     Text lines:
       ENC+ / ENC- / ENC_PRESS / S1_DOWN
     Mouse-wheel input is only a local fallback and never counts as hardware
     evidence in the assignment recording.
  ---------------------------------------------------------------- */

  function hardwareModeLabel() {
    return {
      normal: '普通创作 · 旋钮选择风格',
      'strength-adjust': '强度调整 · 旋钮微调',
      'strength-confirming': '强度已确认 · 正在生成',
      'result-preview': '成片预览 · 原图 / 效果并排对比',
      'creative-display': '创意显示 · 旋钮调整窗口'
    }[hardware.mode] || hardware.mode;
  }

  function updateHardwareUi() {
    const stateName = hardware.connecting ? 'connecting' : hardware.connected ? 'connected' : 'disconnected';
    elements.hardwareModule.dataset.state = stateName;
    elements.hardwareChip.textContent = hardware.connecting ? '硬件连接中' : hardware.connected ? '硬件已连接' : '硬件未连接';
    elements.hardwareChip.classList.toggle('active', hardware.connected);
    elements.hardwareConnect.textContent = hardware.connected ? '断开设备' : '连接设备';
    elements.hardwareConnect.disabled = hardware.connecting;
    elements.hardwareStateLine.textContent = hardware.connecting
      ? '正在请求串口权限…'
      : hardware.connected
        ? '串口已连接 · 等待实体事件'
        : '未连接 · 鼠标滚轮可用';
    elements.hardwareEvent.textContent = hardware.lastEvent;
    elements.homeworkMode.textContent = hardwareModeLabel();
  }

  function setHardwareMode(mode) {
    hardware.mode = mode;
    updateHardwareUi();
  }

  function recordHardwareEvent(text, simulated = false) {
    hardware.simulated = simulated && !hardware.connected;
    hardware.lastEvent = simulated ? `本地回放 · ${text}` : text;
    hardware.lastEventAt = new Date();
    updateHardwareUi();
  }

  function dispatchHardwareEvent(event, options = {}) {
    if (event.type === 'encoder') {
      const delta = Math.sign(Number(event.delta) || 0);
      if (!delta) return;
      recordHardwareEvent(`ENC ${delta > 0 ? '+' : '-'}`, options.simulated);
      handleHardwareEncoder(delta);
      return;
    }
    if (event.type === 'encoder-press') {
      recordHardwareEvent('ENC PRESS', options.simulated);
      handleHardwareEncoderPress();
      return;
    }
    if (event.type === 'button') {
      const key = String(event.key || '').toUpperCase();
      if (!/^S[1-8]$/.test(key)) return;
      if (event.action && event.action !== 'down') return;
      recordHardwareEvent(`${key} DOWN`, options.simulated);
      handleHardwareButton(key);
    }
  }

  function parseHardwareLine(rawLine) {
    const line = rawLine.trim();
    if (!line) return null;
    if (line.startsWith('{')) {
      try {
        const payload = JSON.parse(line);
        const type = String(payload.type || payload.event || '').toLowerCase();
        if (type.includes('encoder')) {
          if (type.includes('press')) return { type: 'encoder-press' };
          const delta = Number(payload.delta ?? payload.value ?? payload.direction);
          if (delta) return { type: 'encoder', delta };
        }
        const rawKey = String(payload.key ?? payload.button ?? '').toUpperCase().replace(/^KEY/, '');
        const action = String(payload.action ?? payload.state ?? 'down').toLowerCase();
        const numericMatch = rawKey.match(/^([1-8])$/);
        const key = numericMatch ? `S${numericMatch[1]}` : rawKey;
        if (/^S[1-8]$/.test(key)) {
          return { type: 'button', key, action: action.includes('up') ? 'up' : 'down' };
        }
        if (key === 'ENCODER' || key === 'ENC') return { type: 'encoder-press' };
      } catch {
        return null;
      }
      return null;
    }

    if (/^(?:ENC|ENCODER|KNOB|ROT)\+$/.test(line)) return { type: 'encoder', delta: 1 };
    if (/^(?:ENC|ENCODER|KNOB|ROT)-$/.test(line)) return { type: 'encoder', delta: -1 };
    if (/^(?:ENC|ENCODER|KNOB|ROT)[_ ]?PRESS$/.test(line)) return { type: 'encoder-press' };
    const button = line.match(/^(?:S|KEY)?([1-8])(?:[_ ](?:DOWN|PRESS|PRESSED))?$/i);
    if (button) return { type: 'button', key: `S${button[1]}`, action: 'down' };
    return null;
  }

  async function readHardwarePort() {
    const decoder = new TextDecoder();
    let buffer = '';
    hardware.reading = true;
    try {
      while (hardware.reading && hardware.port?.readable) {
        hardware.reader = hardware.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await hardware.reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            for (const line of lines) {
              const event = parseHardwareLine(line);
              if (event) dispatchHardwareEvent(event);
            }
          }
        } finally {
          hardware.reader.releaseLock();
          hardware.reader = null;
        }
      }
    } catch (error) {
      if (hardware.connected) {
        hardware.lastEvent = `串口读取失败：${error.message || error}`;
        updateHardwareUi();
      }
    } finally {
      hardware.reading = false;
    }
  }

  async function connectHardware() {
    if (hardware.connected) {
      hardware.reading = false;
      try { await hardware.reader?.cancel(); } catch { /* already closed */ }
      try { await hardware.port?.close(); } catch { /* already closed */ }
      hardware.port = null;
      hardware.connected = false;
      hardware.lastEvent = '串口已断开';
      setHardwareMode('normal');
      return;
    }
    if (!('serial' in navigator)) {
      hardware.lastEvent = '当前浏览器不支持 Web Serial，请使用 Chrome / Edge';
      elements.hardwareModule.dataset.state = 'error';
      updateHardwareUi();
      showTap('请用桌面版 Chrome / Edge 连接开发板');
      return;
    }
    try {
      hardware.connecting = true;
      updateHardwareUi();
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      hardware.port = port;
      hardware.connected = true;
      hardware.lastEvent = '串口已打开 · 115200 baud';
      updateHardwareUi();
      void readHardwarePort();
      showTap('EasyInput 已连接；请转动旋钮或按 S 键');
    } catch (error) {
      hardware.lastEvent = `连接失败：${error.message || error}`;
      elements.hardwareModule.dataset.state = 'error';
      showTap('开发板连接取消或失败');
    } finally {
      hardware.connecting = false;
      updateHardwareUi();
    }
  }

  function handleHardwareEncoder(delta) {
    if (aiPipeline.generating) return;
    if (elements.workDialog.open && state.mode === 'works') {
      browseWorks(delta);
      return;
    }
    switch (state.mode) {
      case 'strength':
        state.strengthTarget = clamp(state.strengthTarget + delta * 0.05, 0, 1);
        break;
      case 'radius':
        state.radiusTarget = clamp(state.radiusTarget + delta * 0.035, 0, MAX_RADIUS);
        break;
      case 'style':
        changeStyle(delta);
        break;
      case 'works':
        browseWorks(delta);
        break;
      default:
        setView(state.view === 'original' ? 'effect' : 'original');
        break;
    }
    updateUi();
  }

  function confirmStrengthAndGenerate() {
    setHardwareMode('strength-confirming');
    setMode('strength');
    showTap(`强度已确认 ${Math.round(state.strengthTarget * 100)}%，开始生成`);
    void generateAiPrint();
  }

  function handleHardwareEncoderPress() {
    if (aiPipeline.generating) return;
    if (state.mode === 'strength') {
      confirmStrengthAndGenerate();
    } else if (state.creativeDisplay || state.mode === 'radius') {
      showTap('创意窗口已确认，可按 3 / S3 保存');
      setHardwareMode('normal');
      setMode('style');
    } else {
      setHardwareMode('strength-adjust');
      setMode('strength');
      showTap('强度模式：旋钮调整，旋钮按下确认生成');
    }
  }

  function flashComparison() {
    elements.workDialog.classList.remove('compare-pulse');
    void elements.workDialog.offsetWidth;
    elements.workDialog.classList.add('compare-pulse');
  }

  function resetEffectToOriginal() {
    clearStaleAiResult();
    state.strengthTarget = 0;
    state.strength = 0;
    setView('original');
    setMode('source');
    showTap('已重置为原图；旋钮轮换各张原始图');
  }

  function runInputCommand(command) {
    if (aiPipeline.generating && command !== 'works' && command !== 'compare' && command !== 'original') return;
    const commandSerial = ++inputCommandSerial;
    switch (command) {
      case 'strength':
        setCreativeDisplay(false);
        setHardwareMode('strength-adjust');
        setMode('strength');
        showTap('1 / S1：旋钮调整强度');
        break;
      case 'compare':
        setView(state.view === 'compare' ? 'effect' : 'compare');
        setMode('source');
        showTap(state.view === 'compare' ? '旋钮轮换各张对比图' : '旋钮轮换各张效果图');
        if (elements.workDialog.open) flashComparison();
        break;
      case 'save':
        const savePreview = elements.workDialog.open && dialogContext.work && !dialogContext.saved;
        const savePromise = savePreview
          ? saveWork({ work: dialogContext.work })
          : saveWork();
        void savePromise.then(work => {
          if (!work || commandSerial !== inputCommandSerial) return;
          if (elements.workDialog.open) elements.workDialog.close();
          setCreativeDisplay(false);
          setView('effect');
          setMode('source');
          showTap('已保存；旋钮按同风格 / 同强度轮换效果图');
        });
        break;
      case 'works':
        // S4 keeps its dedicated behavior: close an open preview or browse works.
        if (elements.workDialog.open) {
          elements.workDialog.close();
          setCreativeDisplay(false);
          setView('effect');
          setMode('style');
          showTap('已回到工作台');
        } else {
          setCreativeDisplay(false);
          setHardwareMode('normal');
          setMode('works');
        }
        break;
      case 'original':
        // S5 is dedicated to the current source's original/effect pair. A
        // compare view is treated as the effect side, so S5 always lands on
        // the effect first rather than jumping directly to the original.
        setView(state.view === 'effect' ? 'original' : 'effect');
        setMode('source');
        showTap(state.view === 'effect' ? '旋钮轮换各张原始图' : '旋钮轮换各张效果图');
        break;
      case 'style':
        setCreativeDisplay(false);
        setHardwareMode('normal');
        setMode('style');
        showTap('6 / S6：旋钮切换风格');
        break;
      case 'reset':
        resetEffectToOriginal();
        break;
      case 'radius':
        setCreativeDisplay(true);
        setMode('radius');
        showTap('8 / S8：旋钮调圆圈，按住圆心拖动');
        break;
      default:
        break;
    }
  }

  function handleHardwareButton(key) {
    const command = {
      S1: 'strength',
      S2: 'compare',
      S3: 'save',
      S4: 'works',
      S5: 'original',
      S6: 'style',
      S7: 'reset',
      S8: 'radius'
    }[key];
    if (command) runInputCommand(command);
  }

  function installHardwareBridge() {
    elements.hardwareConnect.addEventListener('click', () => void connectHardware());
    navigator.serial?.addEventListener?.('disconnect', event => {
      if (event.target !== hardware.port) return;
      hardware.reading = false;
      hardware.port = null;
      hardware.connected = false;
      hardware.lastEvent = '设备已拔出';
      setHardwareMode('normal');
    });
    updateHardwareUi();
  }

  function currentAiResult() {
    const source = sources[state.sourceIndex];
    const style = STYLES[state.styleIndex];
    const current = aiPipeline.current;
    if (!source || !current) return null;
    const note = '';
    const valid = current.sourceId === source.id
      && current.styleId === style.id
      && current.strengthBucket === Math.round(state.strengthTarget * 20)
      && current.note === note;
    return valid ? current : null;
  }

  function clearStaleAiResult() {
    const current = aiPipeline.current;
    if (current?.resultIsObjectUrl) URL.revokeObjectURL(current.resultUrl);
    aiPipeline.current = null;
    elements.aiResultLayer.classList.remove('show');
    elements.aiResultImage.removeAttribute('src');
  }

  function installAiResult(result) {
    const previous = aiPipeline.current;
    if (previous?.resultIsObjectUrl && previous.resultUrl !== result.resultUrl) {
      URL.revokeObjectURL(previous.resultUrl);
    }
    aiPipeline.current = result;
    elements.aiResultImage.src = result.resultUrl;
    elements.aiResultBadge.textContent = result.engine === 'image-api' ? 'AI 成片' : '本地演示成片';
    elements.aiResultLayer.classList.add('show');
    updateAiUi();
  }

  function updateAiUi() {
    // The AI pipeline is intentionally headless in this workbench UI. Keep only
    // the result layer in sync so stale generated prints cannot be mistaken for
    // the currently selected source, style, and strength.
    if (!currentAiResult() && (aiPipeline.current || elements.aiResultLayer.classList.contains('show'))) {
      clearStaleAiResult();
    }
  }

  async function generateAiPrint() {
    if (aiPipeline.generating) return;
    const source = sources[state.sourceIndex];
    if (!source) {
      showTap('请先导入一张肖像');
      return;
    }

    const style = STYLES[state.styleIndex];
    const note = '';
    // Freeze all generation inputs before any asynchronous work starts.
    const ticket = {
      sourceId: source.id,
      styleId: style.id,
      strengthBucket: Math.round(state.strengthTarget * 20),
      strength: Math.round(state.strengthTarget * 100),
      note
    };

    aiPipeline.generating = true;
    updateAiUi();
    showTap(`正在生成：${style.name}`);

    try {
      if (!aiPipeline.available || !aiPipeline.configured) {
        // No server or no API key: keep the complete product loop testable,
        // but clearly label this as a local demo rather than an AI result.
        await new Promise(resolve => setTimeout(resolve, 520));
        // Canvas has just been rendered by canvasToUrl(); keep this demo as a
        // self-contained data URL so it remains valid even after work pruning.
        const resultUrl = elements.canvas.toDataURL('image/png');
        const localResult = {
          ...ticket,
          resultUrl,
          resultIsObjectUrl: false,
          engine: 'local-preview',
          model: 'WebGL classic filters',
          createdAt: new Date()
        };
        installAiResult(localResult);
        openGeneratedPreview(localResult);
        showTap('本地演示成片已生成并自动放大');
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: source.dataUrl,
          styleId: ticket.styleId,
          strength: state.strengthTarget,
          note
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.dataUrl) {
        throw new Error(payload?.error || `生成失败 (${response.status})`);
      }
      const aiResult = {
        ...ticket,
        resultUrl: payload.dataUrl,
        resultIsObjectUrl: false,
        engine: 'image-api',
        model: payload.model || 'image-api',
        prompt: payload.prompt || '',
        createdAt: new Date()
      };
      installAiResult(aiResult);
      openGeneratedPreview(aiResult);
      showTap('AI 成片已生成并自动放大');
    } catch (error) {
      console.error(error);
      const message = error.name === 'AbortError' ? '生成超时；不会自动重试' : `生成失败：${error.message || '未知错误'}`;
      showTap(`${message}；不会自动重试`);
      if (hardware.mode === 'strength-confirming') setHardwareMode('normal');
    } finally {
      aiPipeline.generating = false;
      if (hardware.mode === 'strength-confirming' && currentAiResult()) setHardwareMode('result-preview');
      else if (hardware.mode === 'strength-confirming') setHardwareMode('normal');
      updateAiUi();
    }
  }

  /* ---------------- Works ---------------- */

  function updateCounts() {
    elements.sourceCount.textContent = `${sources.length} 张素材`;
    elements.workCount.textContent = `${works.length} 张作品`;
    elements.worksLabel.textContent = `${works.length} / ${MAX_WORKS}`;
    elements.worksEmpty.style.display = works.length ? 'none' : 'grid';
  }

  function canvasToUrl() {
    return new Promise((resolve, reject) => {
      try {
        renderer?.render({
          styleA: state.styleA,
          styleB: state.styleB,
          styleMix: state.styleBlend,
          strength: state.strength,
          centerX: state.centerX,
          centerY: state.centerY,
          radius: state.radius,
          maskSide: state.maskSide,
          view: 'effect'
        });
        elements.canvas.toBlob(blob => {
          if (blob) resolve(URL.createObjectURL(blob));
          else reject(new Error('效果图导出失败'));
        }, 'image/png');
      } catch (error) {
        reject(error);
      }
    });
  }


  function effectSignature(explicitResult = null) {
    const source = sources[state.sourceIndex];
    if (!source) return 'no-source';
    const aiResult = explicitResult || (!state.creativeDisplay ? currentAiResult() : null);
    if (aiResult) {
      return [
        'ai',
        aiResult.sourceId,
        aiResult.styleId,
        aiResult.createdAt?.getTime?.() || aiResult.createdAt || '',
        aiResult.engine,
        aiResult.model || '',
        aiResult.resultUrl?.length || 0
      ].join(':');
    }
    return [
      state.creativeDisplay ? 'creative' : 'local',
      source.id,
      state.styleIndex,
      Math.round(state.strengthTarget * 1000),
      Math.round(state.radiusTarget * 1000),
      Math.round(state.centerXTarget * 1000),
      Math.round(state.centerYTarget * 1000),
      state.maskSide
    ].join(':');
  }

  function workSignature(work) {
    if (!work) return '';
    if (work.signature) return work.signature;
    return [
      work.engine,
      work.model || '',
      work.sourceUrl,
      work.style?.id || '',
      work.strength,
      work.radius,
      work.maskSide,
      work.generatedAt?.getTime?.() || work.generatedAt || '',
      work.resultUrl?.length || 0
    ].join(':');
  }

  function updateSaveUi() {
    const commandButton = elements.functionGrid.querySelector('[data-command="save"]');
    if (commandButton) commandButton.disabled = savedEffectSignatures.has(effectSignature()) || pendingSaveSignatures.has(effectSignature());
    if (dialogContext.work) {
      const signature = workSignature(dialogContext.work);
      const saved = dialogContext.saved || savedEffectSignatures.has(signature);
      elements.dialogSave.textContent = saved ? '已保存' : '3 保存效果图';
      elements.dialogSave.disabled = saved || pendingSaveSignatures.has(signature);
    }
  }

  function appendWork(work) {
    works.push(work);
    if (works.length > MAX_WORKS) {
      const removed = works.shift();
      if (removed.resultIsObjectUrl) URL.revokeObjectURL(removed.resultUrl);
    }

    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'work-card';
    element.style.setProperty('--tilt', `${(Math.random() - 0.5) * 8}deg`);
    const engineLabel = work.engine === 'image-api' ? 'AI' : work.engine === 'creative-display' ? '创意' : '本地';
    element.innerHTML = `
      <img alt="${work.style.name}成片">
      <span class="work-meta"><strong>${work.style.name}</strong><span>${engineLabel} · ${work.strength}%</span></span>
    `;
    element.querySelector('img').src = work.resultUrl;
    element.addEventListener('click', () => openWorkDialog(work));
    elements.worksSurface.append(element);
    while (elements.worksSurface.querySelectorAll('.work-card').length > MAX_WORKS) {
      elements.worksSurface.querySelector('.work-card').remove();
    }
    if (worksOrganized) organizeWorks();
    state.workBrowseIndex = Math.max(0, works.length - 1);
    updateCounts();
    updateSaveUi();
    return work;
  }

  async function saveWork(options = {}) {
    if (!sources.length || !renderer) {
      showTap('请先导入一张肖像');
      return null;
    }

    const signature = options.work?.signature || effectSignature();
    if (pendingSaveSignatures.has(signature)) {
      showTap('这张效果图正在保存');
      return null;
    }
    if (savedEffectSignatures.has(signature)) {
      showTap('这张效果图已保存；生成或调整出新效果后可再保存');
      updateSaveUi();
      return null;
    }

    pendingSaveSignatures.add(signature);
    updateSaveUi();
    let work = options.work;
    if (work) {
      work = {
        ...work,
        signature,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date(),
        resultIsObjectUrl: Boolean(work.resultIsObjectUrl)
      };
    } else {
      const source = sources[state.sourceIndex];
      const aiResult = state.creativeDisplay ? null : currentAiResult();
      const resultUrl = aiResult?.resultUrl || await canvasToUrl();
      const style = STYLES[state.styleIndex];
      work = {
        signature,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sourceUrl: source.dataUrl,
        sourceName: source.name,
        resultUrl,
        style,
        strength: Math.round(state.strength * 100),
        radius: Math.round(state.radius * 100),
        maskSide: state.maskSide,
        engine: options.engine || aiResult?.engine || 'local-preview',
        model: options.model || aiResult?.model || 'WebGL classic filters',
        inspiration: aiResult?.note || '',
        generatedAt: aiResult?.createdAt || null,
        resultIsObjectUrl: aiResult ? Boolean(aiResult.resultIsObjectUrl) : true,
        createdAt: new Date()
      };
    }

    try {
      appendWork(work);
      savedEffectSignatures.add(signature);
      if (dialogContext.work && workSignature(dialogContext.work) === signature) {
        dialogContext.saved = true;
      }
      showTap(work.engine === 'creative-display' ? '创意显示结果已保存' : '已保存到下方工作台');
      return work;
    } finally {
      pendingSaveSignatures.delete(signature);
      updateSaveUi();
    }
  }

  function workEngineText(work) {
    if (work.engine === 'image-api') return `AI(${work.model})`;
    if (work.engine === 'creative-display') return '创意显示 · 本地 WebGL';
    return '本地演示 · 非真实 AI 生成';
  }

  function openWorkDialog(work) {
    const index = works.indexOf(work);
    const saved = index >= 0;
    if (saved) state.workBrowseIndex = index;
    dialogContext = { work, saved };
    const position = saved ? `${index + 1} / ${works.length}` : '未保存预览';
    elements.dialogTitle.textContent = work.style.name;
    elements.dialogMeta.textContent = `${position} · ${work.style.tagline} · 强度 ${work.strength}% · ${workEngineText(work)}`;
    elements.dialogOriginal.src = work.sourceUrl;
    elements.dialogResult.src = work.resultUrl;
    elements.dialogResultLabel.textContent = work.engine === 'image-api' ? 'AI 效果' : work.engine === 'creative-display' ? '创意显示' : '本地演示效果';
    elements.dialogDownload.href = work.resultUrl;
    elements.dialogDownload.download = `stylecam-${work.style.id}-${work.strength}.png`;
    elements.dialogSave.textContent = saved ? '已保存' : '3 保存效果图';
    elements.dialogSave.disabled = saved || savedEffectSignatures.has(workSignature(work));
    if (!elements.workDialog.open) elements.workDialog.showModal();
  }

  function openGeneratedPreview(result) {
    const source = sources.find(item => item.id === result.sourceId) || sources[state.sourceIndex];
    if (!source) return;
    const style = STYLES.find(item => item.id === result.styleId) || STYLES[state.styleIndex];
    openWorkDialog({
      sourceUrl: source.dataUrl,
      sourceName: source.name,
      resultUrl: result.resultUrl,
      style,
      strength: result.strength ?? Math.round(state.strengthTarget * 100),
      radius: Math.round(state.radius * 100),
      maskSide: state.maskSide,
      engine: result.engine,
      model: result.model || 'WebGL classic filters',
      inspiration: result.note || '',
      generatedAt: result.createdAt || null,
      resultIsObjectUrl: Boolean(result.resultIsObjectUrl),
      signature: effectSignature(result),
      createdAt: new Date()
    });
    setHardwareMode('result-preview');
  }

  function browseWorks(delta = 0) {
    if (!works.length) {
      state.workBrowseIndex = 0;
      showTap('当前还没有保存作品');
      updateUi();
      return;
    }
    if (delta === 0) {
      if (state.workBrowseIndex < 0 || state.workBrowseIndex >= works.length) {
        state.workBrowseIndex = works.length - 1;
      }
    } else {
      state.workBrowseIndex = modulo(state.workBrowseIndex, delta > 0 ? 1 : -1, works.length);
    }
    openWorkDialog(works[state.workBrowseIndex]);
    updateUi();
  }

  /* ---------------- Controls ---------------- */

  function setCreativeDisplay(active) {
    const next = Boolean(active);
    if (state.creativeDisplay === next) {
      updateHardwareUi();
      return;
    }
    state.creativeDisplay = next;
    if (next) {
      if (elements.workDialog.open) elements.workDialog.close();
      elements.machinePanel.classList.add('creative');
      setView('effect');
      setMode('radius');
      setHardwareMode('creative-display');
      showTap('创意显示：旋钮调窗口，按住圆心拖动，3 / S3 保存');
    } else {
      elements.machinePanel.classList.remove('creative');
      setHardwareMode('normal');
    }
    updateHardwareUi();
  }

  function sourceModeLabel() {
    if (state.view === 'compare') return '轮换对比图';
    if (state.view === 'original') return '轮换原始图';
    return '轮换效果图';
  }

  function setMode(mode) {
    state.mode = mode;
    elements.functionGrid.querySelectorAll('.function-button').forEach(button => {
      button.classList.toggle('active', button.dataset.mode === mode);
    });
    const current = MODES.find(item => item.id === mode);
    elements.modeName.textContent = mode === 'source' ? sourceModeLabel() : current?.name ?? '';
    updateUi();
    if (mode === 'works') browseWorks(0);
  }

  function adjust(delta) {
    if (!delta) return;
    switch (state.mode) {
      case 'radius':
        state.radiusTarget = clamp(state.radiusTarget + delta * 0.035, 0, MAX_RADIUS);
        break;
      case 'side':
        state.maskSide = state.maskSide === 'inside' ? 'outside' : 'inside';
        break;
      case 'style':
        changeStyle(delta > 0 ? 1 : -1);
        break;
      case 'strength':
        state.strengthTarget = clamp(state.strengthTarget + delta * 0.05, 0, 1);
        break;
      case 'source':
        if (sources.length) selectSource(modulo(state.sourceIndex, delta > 0 ? 1 : -1, sources.length));
        break;
      case 'works':
        browseWorks(delta);
        break;
      default:
        setView(state.view === 'original' ? 'effect' : 'original');
        break;
    }
    updateUi();
  }

  function setView(view) {
    state.view = view;
    elements.stageStack.dataset.view = view;
    elements.stageStack.classList.toggle('comparing', view === 'compare');
    elements.stageStack.closest('.machine-panel')?.classList.toggle('comparing', view === 'compare');
  }

  function currentModeValue() {
    switch (state.mode) {
      case 'radius': return `${Math.round(state.radiusTarget * 100)}%`;
      case 'side': return state.maskSide === 'inside' ? '圈内' : '圈外';
      case 'style': return `${state.styleIndex + 1} / ${STYLES.length}`;
      case 'strength': return `${Math.round(state.strengthTarget * 100)}%`;
      case 'source': return sources.length ? `${state.sourceIndex + 1} / ${sources.length}` : '未导入';
      case 'works': return works.length ? `${state.workBrowseIndex + 1} / ${works.length}` : '未保存';
      case 'view':
        if (state.view === 'original') return '原图';
        if (state.view === 'compare') return '对比';
        return '效果图';
      default: return '';
    }
  }

  function updateDialTarget() {
    const map = (value, min, max) => -140 + 280 * ((value - min) / (max - min));
    switch (state.mode) {
      case 'radius': state.dialAngleTarget = map(state.radiusTarget, 0, MAX_RADIUS); break;
      case 'side': state.dialAngleTarget = state.maskSide === 'inside' ? -70 : 70; break;
      case 'style': state.dialAngleTarget = ((state.styleIndex * 36 - 90) % 280) - 140; break;
      case 'strength': state.dialAngleTarget = map(state.strengthTarget, 0, 1); break;
      case 'source': state.dialAngleTarget = sources.length > 1 ? map(state.sourceIndex, 0, sources.length - 1) : 0; break;
      case 'works': state.dialAngleTarget = works.length > 1 ? map(state.workBrowseIndex, 0, works.length - 1) : 0; break;
      default: state.dialAngleTarget = 0;
    }
  }

  function updateUi() {
    elements.modeValue.textContent = currentModeValue();
    updateDialTarget();
    const fullCover = state.radius >= FULL_COVER_RADIUS;
    const zero = state.radius <= 0.002;
    const sideText = zero ? '圆圈外 · 全图' : fullCover ? '圆圈内 · 全图' : `${state.maskSide === 'inside' ? '圆圈内' : '圆圈外'} · ${Math.round(state.radius * 100)}%`;
    elements.maskStatus.textContent = sideText;
    elements.strengthStatus.textContent = `强度 ${Math.round(state.strength * 100)}%`;
    updateSaveUi();
    updateAiUi();
  }

  function updateMaskRing() {
    const stage = elements.canvas.parentElement;
    const width = stage.clientWidth;
    const diameter = Math.max(2, state.radius * 2 * width);
    elements.maskRing.style.width = `${diameter.toFixed(1)}px`;
    elements.maskRing.style.height = `${diameter.toFixed(1)}px`;
    elements.maskRing.style.left = `calc(${(state.centerX * 100).toFixed(2)}% - ${(diameter / 2).toFixed(1)}px)`;
    elements.maskRing.style.top = `calc(${(state.centerY * 100).toFixed(2)}% - ${(diameter / 2).toFixed(1)}px)`;
    elements.maskRing.classList.toggle('extreme', state.radius <= 0.004 || state.radius >= FULL_COVER_RADIUS);
  }

  function installStageDrag() {
    const stage = elements.canvas.parentElement;
    let tracking = false;

    // Snap both the target and displayed value: while the circle is held,
    // its center must stay exactly at the pointer rather than easing behind it.
    const setFromEvent = event => {
      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      state.centerXTarget = x;
      state.centerYTarget = y;
      state.centerX = x;
      state.centerY = y;
    };
    const stopTracking = () => {
      tracking = false;
    };

    stage.style.cursor = 'crosshair';
    stage.style.touchAction = 'none';
    stage.style.userSelect = 'none';

    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || tracking) return;

      const rect = stage.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      const insideImage = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      const circleVisible = state.radius > 0.004 && state.radius < FULL_COVER_RADIUS;
      const distanceFromCenter = Math.hypot(x - state.centerX, y - state.centerY);
      const insideCircle = !circleVisible || distanceFromCenter <= state.radius + 0.003;

      // Press inside a visible circle to start holding. Pointer capture keeps
      // tracking the same mouse even when it moves outside the preview.
      if (!insideImage || !insideCircle) return;
      event.preventDefault();
      tracking = true;
      setFromEvent(event);
      try { stage.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
    });

    window.addEventListener('pointermove', event => {
      if (tracking && event.isPrimary) setFromEvent(event);
    });

    // Release the left mouse button anywhere to stop and freeze the circle.
    window.addEventListener('pointerup', event => {
      if (tracking && event.button === 0) stopTracking();
    });

    // These are safety exits for interrupted pointing devices or window switches.
    window.addEventListener('pointercancel', stopTracking);
    window.addEventListener('blur', stopTracking);
  }

  function installDialDrag() {
    const dial = elements.dial;
    let dragging = false;
    let previousAngle = 0;
    let accumulated = 0;
    let rotated = false;
    const angleFromEvent = event => {
      const rect = dial.getBoundingClientRect();
      return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
    };
    dial.addEventListener('pointerdown', event => {
      event.preventDefault();
      dragging = true;
      accumulated = 0;
      rotated = false;
      previousAngle = angleFromEvent(event);
      dial.setPointerCapture(event.pointerId);
    });
    dial.addEventListener('pointermove', event => {
      if (!dragging) return;
      const angle = angleFromEvent(event);
      let delta = angle - previousAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      previousAngle = angle;
      accumulated += delta;
      if (Math.abs(accumulated) >= 8) rotated = true;
      while (Math.abs(accumulated) >= 15) {
        const direction = accumulated > 0 ? 1 : -1;
        adjust(direction);
        accumulated -= direction * 15;
      }
    });
    const end = (event) => {
      if (!dragging) return;
      dragging = false;
      // A click without rotation is the on-screen equivalent of the encoder
      // press. It invokes the same application action without recording a
      // hardware event, so it cannot be mistaken for real EasyInput evidence.
      if (!rotated && event.type === 'pointerup') handleHardwareEncoderPress();
    };
    dial.addEventListener('pointerup', end);
    dial.addEventListener('pointercancel', end);
  }

  function installInputs() {
    elements.functionGrid.addEventListener('click', event => {
      const button = event.target.closest('.function-button[data-command]');
      if (!button || button.disabled) return;
      runInputCommand(button.dataset.command);
    });
    elements.uploadButton.addEventListener('click', () => elements.fileInput.click());
    elements.organizeButton.addEventListener('click', organizeAll);
    elements.fileInput.addEventListener('change', () => {
      void importFiles(elements.fileInput.files);
      elements.fileInput.value = '';
    });
    elements.dialogClose.addEventListener('click', () => elements.workDialog.close());
    elements.workDialog.addEventListener('close', () => {
      if (!state.creativeDisplay) setHardwareMode('normal');
    });
    elements.dialogSave.addEventListener('click', () => runInputCommand('save'));
    elements.dialogCreative.addEventListener('click', () => setCreativeDisplay(true));

    window.addEventListener('dragover', event => event.preventDefault());
    window.addEventListener('drop', event => {
      event.preventDefault();
      if (event.dataTransfer?.files?.length) void importFiles(event.dataTransfer.files);
    });

    window.addEventListener('wheel', event => {
      const direction = event.deltaY < 0 ? 1 : -1;
      if (elements.workDialog.open) {
        if (!dialogContext.saved) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        if (state.mode !== 'works') setMode('works');
        else browseWorks(direction);
        return;
      }
      if (event.target.closest?.('#work-dialog')) return;
      event.preventDefault();
      adjust(direction);
    }, { passive: false });

    window.addEventListener('keydown', event => {
      const tag = event.target.tagName?.toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || event.target.isContentEditable;
      const commands = ['strength', 'compare', 'save', 'works', 'original', 'style', 'reset', 'radius'];
      if (elements.workDialog.open) {
        if (event.key === 'Escape') {
          elements.workDialog.close();
        } else if (!typing && event.key >= '1' && event.key <= '8') {
          event.preventDefault();
          runInputCommand(commands[Number(event.key) - 1]);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
          if (!dialogContext.saved) return;
          event.preventDefault();
          browseWorks(-1);
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
          if (!dialogContext.saved) return;
          event.preventDefault();
          browseWorks(1);
        }
        return;
      }
      if (typing) return;
      if (event.key >= '1' && event.key <= '8') {
        event.preventDefault();
        runInputCommand(commands[Number(event.key) - 1]);
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        event.preventDefault();
        adjust(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        event.preventDefault();
        adjust(1);
      } else if (event.key.toLowerCase() === 'c') {
        setView(state.view === 'compare' ? 'effect' : 'compare');
      }
    });

    window.addEventListener('resize', () => {
      sources.forEach(source => {
        const bounds = sourceBounds();
        source.x = source.organized ? source.x : clamp(source.x, bounds.minX, bounds.maxX);
        source.y = source.organized ? source.y : clamp(source.y, bounds.minY, bounds.maxY);
      });
      if (sourcesOrganized) organizeSources();
      if (worksOrganized) organizeWorks();
    });
  }

  /* ---------------- Main loop ---------------- */

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
    lastFrame = now;

    state.radius = ease(state.radius, state.radiusTarget, dt, 72);
    state.centerX = ease(state.centerX, state.centerXTarget, dt, 58);
    state.centerY = ease(state.centerY, state.centerYTarget, dt, 58);
    state.strength = ease(state.strength, state.strengthTarget, dt, 78);
    state.styleBlend = ease(state.styleBlend, state.styleBlendTarget, dt, 88);
    if (state.styleBlend >= 0.999 && state.styleBlendTarget === 1) {
      state.styleA = state.styleB;
      state.styleBlend = 0;
      state.styleBlendTarget = 0;
    }
    state.dialAngle = ease(state.dialAngle, state.dialAngleTarget, dt, 82);

    elements.dial.style.transform = `rotate(${state.dialAngle.toFixed(2)}deg)`;

    renderer?.render({
      styleA: state.styleA,
      styleB: state.styleB,
      styleMix: state.styleBlend,
      strength: state.strength,
      centerX: state.centerX,
      centerY: state.centerY,
      radius: state.radius,
      maskSide: state.maskSide,
      view: state.view
    });

    updateMaskRing();
    updateUi();
    updateSourcePhysics(dt);
    requestAnimationFrame(frame);
  }

  async function init() {
    installInputs();
    installHardwareBridge();
    installStageDrag();
    installDialDrag();
    setView('effect');
    setMode('style');
    updateCounts();
    void detectAiService();

    // Static portraits still pass through the same decode boundary before WebGL
    // upload, preventing INVALID_VALUE from incompletely decoded textures.
    const samples = await loadDefaultPortraits();
    sourcesOrganized = true;
    worksOrganized = true;
    samples.forEach(sample => addSource(sample));
    selectSource(0);
    organizeSources();
    sources.forEach(source => {
      if (source.targetX === null || source.targetY === null) return;
      source.x = source.targetX;
      source.y = source.targetY;
      source.angle = 0;
      source.vx = 0;
      source.vy = 0;
      source.element.style.transform = `translate3d(${source.x.toFixed(2)}px, ${source.y.toFixed(2)}px, 0) rotate(0deg)`;
    });
    updateUi();
    requestAnimationFrame(frame);
    showTap('已载入 10 张默认肖像，已保持整理状态');
  }

  void init();
})();
