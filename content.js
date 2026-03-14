const BAND_CONFIG = [
  { key: "band31", frequency: 31 },
  { key: "band62", frequency: 62 },
  { key: "band125", frequency: 125 },
  { key: "band250", frequency: 250 },
  { key: "band500", frequency: 500 },
  { key: "band1k", frequency: 1000 },
  { key: "band2k", frequency: 2000 },
  { key: "band4k", frequency: 4000 },
  { key: "band8k", frequency: 8000 },
  { key: "band16k", frequency: 16000 }
];

const DEFAULT_SETTINGS = {
  band31: 0,
  band62: 0,
  band125: 0,
  band250: 0,
  band500: 0,
  band1k: 0,
  band2k: 0,
  band4k: 0,
  band8k: 0,
  band16k: 0,
  volume: 1
};

let audioContext = null;
const pipelines = new WeakMap();

function createPipeline(mediaElement) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  const source = audioContext.createMediaElementSource(mediaElement);
  const gain = audioContext.createGain();
  const filters = BAND_CONFIG.map((band) => {
    const filter = audioContext.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = band.frequency;
    filter.Q.value = 1.1;
    filter.gain.value = 0;
    return filter;
  });

  let previousNode = source;
  for (const filter of filters) {
    previousNode.connect(filter);
    previousNode = filter;
  }

  previousNode.connect(gain);
  gain.connect(audioContext.destination);

  const pipeline = { source, filters, gain };
  pipelines.set(mediaElement, pipeline);
  return pipeline;
}

function ensurePipeline(mediaElement) {
  return pipelines.get(mediaElement) || createPipeline(mediaElement);
}

function applySettings(settings) {
  const mediaElements = document.querySelectorAll("audio, video");
  if (!mediaElements.length) {
    return false;
  }

  for (const mediaElement of mediaElements) {
    try {
      const pipeline = ensurePipeline(mediaElement);
      BAND_CONFIG.forEach((band, index) => {
        pipeline.filters[index].gain.value = settings[band.key];
      });
      pipeline.gain.gain.value = settings.volume;
    } catch (error) {
      console.warn("Equalizer could not attach to a media element.", error);
    }
  }

  if (audioContext?.state === "suspended") {
    audioContext.resume().catch((error) => console.warn("AudioContext resume failed.", error));
  }

  return true;
}

async function loadInitialSettings() {
  const { equalizerSettings = DEFAULT_SETTINGS } = await chrome.storage.local.get("equalizerSettings");
  applySettings({ ...DEFAULT_SETTINGS, ...equalizerSettings });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "APPLY_EQ") {
    return false;
  }

  const applied = applySettings({ ...DEFAULT_SETTINGS, ...message.settings });
  sendResponse({ applied });
  return true;
});

const observer = new MutationObserver(() => {
  loadInitialSettings().catch((error) => console.warn("Failed to re-apply equalizer settings.", error));
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

loadInitialSettings().catch((error) => console.warn("Failed to load equalizer settings.", error));
