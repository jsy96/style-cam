# StyleCam Atelier

A portrait style workbench with:

- 10 real-time WebGL style previews
- circular inside/outside editing
- original/result comparison
- natural source and finished-print surfaces
- an optional AI image generation pipeline
- a clearly labeled local demo mode when no API key is configured

## Run

```bash
npm start
```

Open <http://127.0.0.1:4174/?v=9>.

## Optional AI mode

Set an OpenAI-compatible image edit API key before starting:

```bash
export OPENAI_API_KEY=your_key
npm start
```

Optional overrides:

```bash
export IMAGE_API_MODEL=gpt-image-1
export IMAGE_API_QUALITY=high
export IMAGE_API_INPUT_FIDELITY=high
export IMAGE_API_EDIT_URL=https://api.openai.com/v1/images/edits
export IMAGE_API_TIMEOUT_MS=150000
```

Without a key, the complete interaction flow remains usable and generated prints are labeled “本地演示成片”.
