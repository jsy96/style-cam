const apiKey = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY || '';
const model = process.env.IMAGE_API_MODEL || 'gpt-image-1';
const quality = process.env.IMAGE_API_QUALITY || 'high';
const inputFidelity = process.env.IMAGE_API_INPUT_FIDELITY || 'high';
const editUrl = process.env.IMAGE_API_EDIT_URL || 'https://api.openai.com/v1/images/edits';
const requestTimeoutMs = Number(process.env.IMAGE_API_TIMEOUT_MS || 150000);

const STYLE_PRESETS = {
  yarn: {
    name: '毛线旅行家',
    prompt: [
      'A cozy knitted travel world inspired by high-end collectible toy design.',
      'The person becomes part of a warm handmade scene: soft wool travel bag, stitched landscape details, yarn mountains, felt clouds, and a small suitcase.',
      'Visible knitting language: plush yarn fibers, loop stitches, rounded crochet forms, wool nap, and gentle fabric seams.',
      'Warm late-afternoon light, tactile macro photography, shallow depth of field, harmonious cream/coral/blue palette.'
    ]
  },
  blocks: {
    name: '积木星球',
    prompt: [
      'A complete miniature block-built planet inspired by classic modernist plastic toys.',
      'Place the person naturally inside a brick-built world with modular islands, clouds, vehicles, plants, and architecture.',
      'Crisp injection-molded plastic, glossy studs, precise seams, controlled pastel and primary color palette.',
      'Clean studio-toy lighting with soft shadows and a believable scale model depth.'
    ]
  },
  mecha: {
    name: '机甲模型盒',
    prompt: [
      'A premium collectible mecha model display scene inspired by classic industrial product design.',
      'The person is redesigned as an articulated figure integrated with everyday objects, armor panels, connectors, and display base.',
      'Matte and metallic finishes, sharp panel lines, tiny decals, snap-fit runners, precise bevels, restrained gray-blue-orange palette.',
      'Controlled museum display lighting, soft rim highlights, product-photography realism.'
    ]
  },
  retro: {
    name: '掌上像素梦',
    prompt: [
      'A complete retro handheld game world with the person as the recognizable hero character.',
      'Surround them with a small pixel village, path, clouds, HUD-free game scenery, and a cartridge-like collectible setting.',
      'Limited green handheld palette, ordered dithering, readable pixel clusters, crisp pixel boundaries; no unreadable noise.',
      'Soft backlight glow and subtle LCD contrast, charming 8-bit adventure composition.'
    ]
  },
  clay: {
    name: '软陶盲盒',
    prompt: [
      'A soft polymer-clay blind box scene with the person as a cute but faithful collectible figure.',
      'Create a complete miniature scene: display base, tiny props, soft background scenery, and playful narrative details.',
      'Matte clay surface, gentle fingerprints, rounded forms, soft pastel palette, hand-formed edges.',
      'Even collectible studio lighting with delicate shadows and no plastic gloss.'
    ]
  },
  paper: {
    name: '纸间剧场',
    prompt: [
      'A layered paper theater diorama containing the person as one integrated paper performer.',
      'Build foreground, middle ground, and background from cut paper: arches, plants, light shafts, clouds, and stage props.',
      'Visible paper grain, crisp folds, controlled cast shadows, warm ivory palette with accents.',
      'Theatrical top light and graceful depth, tactile handcrafted realism.'
    ]
  },
  chrome: {
    name: '液态银诗',
    prompt: [
      'A liquid chrome visual poem where the person flows into an elegant metallic scene.',
      'Preserve the silhouette and identity while transforming clothes, scenery, and light into liquid mirror forms.',
      'Polished chrome, flowing mercury, subtle iridescence, clean reflections, soft distortion, elegant silver-blue palette.',
      'Studio light cards create readable highlights; no chaotic funhouse distortion.'
    ]
  },
  jelly: {
    name: '果冻宇宙',
    prompt: [
      'A translucent jelly universe with the person suspended inside a soft candy-like world.',
      'Create a complete translucent environment: jelly planets, glossy bubbles, refracted light, and playful cosmic props.',
      'Subsurface scattering, elastic rounded forms, clean translucency, candy pink/cyan/violet palette.',
      'Backlight illumination, fresh highlights, airy composition.'
    ]
  },
  terrarium: {
    name: '口袋生态舱',
    prompt: [
      'A pocket ecosystem contained in a beautifully engineered glass orb.',
      'The person becomes part of a tiny living world with moss, stones, small plants, water vapor, and believable spatial depth.',
      'Clear glass, soft refraction, miniature landscape materials, botanical greens with warm neutral accents.',
      'Natural window light, delicate caustics, clean collector-product presentation.'
    ]
  },
  risograph: {
    name: '孔版夏日',
    prompt: [
      'A Risograph-style summer scene built from limited inks and printed texture.',
      'Place the person in a complete summer environment: seaside, plants, breeze, shadows, and everyday objects.',
      'Flat spot colors, visible paper grain, slight misregistration, clean shapes, apricot/blue/lilac/leaf palette.',
      'Bold graphic composition with warm sunlight and no photographic gradients.'
    ]
  }
};

function strengthLanguage(strength) {
  if (strength < 0.35) {
    return 'Subtle interpretation: retain most of the original photograph while introducing clear material direction and a believable surrounding.';
  }
  if (strength < 0.7) {
    return 'Balanced interpretation: strong readable style transformation while preserving the subject identity and natural scene integration.';
  }
  return 'Strong interpretation: fully stylized complete scene, but the person must remain recognizable and harmoniously lit.';
}

function buildPrompt(styleId, strength, note) {
  const preset = STYLE_PRESETS[styleId];
  if (!preset) throw Object.assign(new Error('未知风格'), { status: 400 });

  return [
    `Transform the uploaded portrait into: ${preset.name}.`,
    ...preset.prompt,
    strengthLanguage(strength),
    'Composition: subject is one integrated part of a complete scene, not a pasted sticker and not a full-frame face crop.',
    'Identity: preserve the person’s recognizable facial structure, age range, hairstyle, expression, gender presentation, and distinguishing features.',
    'Finish: classic tasteful industrial design, collector-product presentation, coherent perspective, physically believable lighting and shadow.',
    note ? `User inspiration: ${note}.` : '',
    'No text, watermark, logo, border, UI, or extra people unless explicitly requested.'
  ].filter(Boolean).join('\n');
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw Object.assign(new Error('仅支持 PNG / JPEG / WebP 图片'), { status: 400 });
  return { type: match[1], buffer: Buffer.from(match[2], 'base64') };
}

async function remoteImageToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('生成结果下载失败');
  const buffer = Buffer.from(await response.arrayBuffer());
  const type = response.headers.get('content-type')?.split(';')[0] || 'image/png';
  return `data:${type};base64,${buffer.toString('base64')}`;
}

async function callImageApi({ buffer, type, prompt }) {
  const form = new FormData();
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  form.append('model', model);
  form.append('image', new Blob([buffer], { type }), `portrait.${extension}`);
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', quality);
  if (inputFidelity) form.append('input_fidelity', inputFidelity);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(editUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.message || `图像接口返回 ${response.status}`;
      throw new Error(detail);
    }
    const item = payload?.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) return remoteImageToDataUrl(item.url);
    throw new Error('图像接口没有返回图片');
  } finally {
    clearTimeout(timeout);
  }
}

export function healthPayload() {
  return {
    ok: true,
    configured: Boolean(apiKey),
    model: apiKey ? model : null
  };
}

export async function generateImage(payload = {}) {
  if (!apiKey) {
    throw Object.assign(new Error('未配置 OPENAI_API_KEY / IMAGE_API_KEY'), { status: 503 });
  }

  const strength = Number(payload.strength);
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    throw Object.assign(new Error('风格强度必须在 0～1 之间'), { status: 400 });
  }
  if (String(payload.imageDataUrl || '').length > 16 * 1024 * 1024) {
    throw Object.assign(new Error('请求图片过大'), { status: 413 });
  }

  const prompt = buildPrompt(
    String(payload.styleId || ''),
    strength,
    String(payload.note || '').slice(0, 600)
  );
  const image = parseDataUrl(payload.imageDataUrl);
  const dataUrl = await callImageApi({ ...image, prompt });
  return { ok: true, dataUrl, model, prompt };
}
