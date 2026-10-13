import { healthPayload } from '../lib/image-service.mjs';

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json(healthPayload());
}
