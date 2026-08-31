import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1; // Disables WebWorker .mjs fetching (fixes CSP block)

let objectDetector = null;

async function loadModels() {
  if (!objectDetector) {
    objectDetector = await pipeline('object-detection', 'Xenova/detr-resnet-50', { dtype: 'q8' });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'RUN_INFERENCE') {
    runInference(msg.imageDataUrl).then(res => {
      chrome.runtime.sendMessage({ type: 'ML_INFERENCE_RESULT', data: res });
    });
    return true;
  }
});

async function runInference(dataUrl) {
  await loadModels();
  const detections = await objectDetector(dataUrl, { threshold: 0.5, percentage: true });
  
  const img = new Image();
  await new Promise(r => { img.onload = r; img.src = dataUrl; });
  
  const faces = [];
  for (const det of detections) {
    if (det.label === 'person') {
      faces.push({
        bbox: {
          x: det.box.xmin * img.width + (det.box.xmax - det.box.xmin) * img.width * 0.2,
          y: det.box.ymin * img.height,
          w: (det.box.xmax - det.box.xmin) * img.width * 0.6,
          h: (det.box.ymax - det.box.ymin) * img.height * 0.35
        },
        type: 'face'
      });
    }
  }
  return { faces };
}

loadModels();
