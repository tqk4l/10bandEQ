const BANDS = [
  { key: "band31", label: "31" },
  { key: "band62", label: "62" },
  { key: "band125", label: "125" },
  { key: "band250", label: "250" },
  { key: "band500", label: "500" },
  { key: "band1k", label: "1K" },
  { key: "band2k", label: "2K" },
  { key: "band4k", label: "4K" },
  { key: "band8k", label: "8K" },
  { key: "band16k", label: "16K" }
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

const bandContainer = document.getElementById("bands");
const controls = {};
const outputs = {};
const statusNode = document.getElementById("status");
const resetButton = document.getElementById("reset");
const supportLink = document.getElementById("support");
const volumeControl = document.getElementById("volume");
const volumeOutput = document.getElementById("volumeValue");

function buildBandControls() {
  for (const band of BANDS) {
    const wrapper = document.createElement("label");
    wrapper.className = "band";

    const value = document.createElement("output");
    value.id = `${band.key}Value`;
    value.className = "band-value";
    value.textContent = "0 dB";

    const slider = document.createElement("input");
    slider.id = band.key;
    slider.type = "range";
    slider.min = "-12";
    slider.max = "12";
    slider.step = "1";
    slider.value = "0";

    const name = document.createElement("span");
    name.className = "band-name";
    name.textContent = band.label;

    wrapper.append(value, slider, name);
    bandContainer.appendChild(wrapper);
    controls[band.key] = slider;
    outputs[band.key] = value;
  }

  controls.volume = volumeControl;
  outputs.volume = volumeOutput;
}

function formatValue(key, value) {
  return key === "volume" ? `${Math.round(value * 100)}%` : `${value} dB`;
}

function render(settings) {
  for (const [key, control] of Object.entries(controls)) {
    control.value = settings[key];
    outputs[key].textContent = formatValue(key, Number(settings[key]));
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }
  return tab.id;
}

async function getStoredSettings() {
  const { equalizerSettings = DEFAULT_SETTINGS } = await chrome.storage.local.get("equalizerSettings");
  return { ...DEFAULT_SETTINGS, ...equalizerSettings };
}

async function saveSettings(settings) {
  await chrome.storage.local.set({ equalizerSettings: settings });
}

async function pushSettings(settings) {
  const tabId = await getActiveTabId();
  await chrome.tabs.sendMessage(tabId, { type: "APPLY_EQ", settings });
}

async function syncFromStorage() {
  const settings = await getStoredSettings();
  render(settings);
}

async function handleChange() {
  const settings = {};
  for (const [key, control] of Object.entries(controls)) {
    settings[key] = Number(control.value);
  }

  render(settings);
  await saveSettings(settings);

  try {
    await pushSettings(settings);
    statusNode.textContent = "Applied to current tab";
  } catch (error) {
    statusNode.textContent = "Open a page with audio or video";
    console.error(error);
  }
}

async function resetSettings() {
  render(DEFAULT_SETTINGS);
  await saveSettings(DEFAULT_SETTINGS);

  try {
    await pushSettings(DEFAULT_SETTINGS);
    statusNode.textContent = "Reset";
  } catch (error) {
    statusNode.textContent = "Reset saved";
    console.error(error);
  }
}

buildBandControls();

for (const control of Object.values(controls)) {
  control.addEventListener("input", () => {
    handleChange();
  });
}

resetButton.addEventListener("click", () => {
  resetSettings();
});

supportLink.addEventListener("click", async (event) => {
  event.preventDefault();
  await chrome.tabs.create({ url: "https://ko-fi.com/thequietkid4e" });
});

syncFromStorage().catch((error) => {
  statusNode.textContent = "Failed to load settings";
  console.error(error);
});
