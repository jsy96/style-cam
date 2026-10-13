import { generateImage } from '../lib/image-service.mjs';

async function readPayload(request) {
  // Vercel's Node.js runtime normally supplies a parsed JSON body. Keep a
  // stream fallback so the same route remains testable outside Vercel.
  if (request.body && typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body === 'string' && request.body) {
    try {
      return JSON.parse(request.body);
    } catch {
      throw Object.assign(new Error('请求格式错误'), { status: 400 });
    }
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) throw Object.assign(new Error('请求图片过大'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const raw = Buffer.concat(chunks.map(chunk => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    return JSON.parse(raw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('请求格式错误'), { status: 400 });
  }
}

function errorText(error) {
  if (error?.name === 'AbortError') return '图像接口超时';
  return error?.message || '生成失败';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const payload = await readPayload(request);
    const result = await generateImage(payload);
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json(result);
  } catch (error) {
    console.error('[vercel generate]', errorText(error));
    response.status(error?.status || 500).json({
      ok: false,
      error: errorText(error)
    });
  }
}
