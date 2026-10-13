# StyleCam Atelier

A portrait style workbench with:

- 10 real-time WebGL style previews
- circular inside/outside editing
- original/result comparison
- tidy, compact source and finished-print surfaces
- an optional AI image generation pipeline
- a clearly labeled local demo mode when no API key is configured

## Run

```bash
npm start
```

Open <http://127.0.0.1:4174/?v=18>.

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

生成入口保留在 `1 / S1` 强度模式的旋钮按下动作中；页面不再显示独立 AI Pipeline 面板。

## EasyInput hardware bridge

Open the page in desktop Chrome or Edge, click **连接设备**, and select the EasyInput serial port. The page listens at `115200 8N1` and accepts JSON Lines or compact text events:

```text
{"type":"encoder","delta":1}
{"type":"button","key":"S1","action":"down"}
{"type":"button","key":"1","action":"down"}
ENC+
ENC_PRESS
S8_DOWN
```

See `docs/homework/input-mapping.md` for the complete mode map and `docs/homework/hardware-protocol.md` for the firmware-side boundary. The mouse wheel is only a local fallback and cannot replace real EasyInput evidence.

## Assignment materials

- Input mapping: `docs/homework/input-mapping.png`
- Custom plan screenshot: `docs/homework/custom-plan.png`
- Issue record: `docs/homework/issue-record.md`
- Recording script: `docs/homework/demo-script.md`
- Submission checklist: `docs/homework/submission-checklist.md`
