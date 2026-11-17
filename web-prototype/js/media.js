let audioCtx = null;
let currentBlobUrl = null;

export function playBeep(frequency, soundOn) {
  if (!soundOn) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = 0.025;
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
    oscillator.stop(audioCtx.currentTime + 0.18);
  } catch {}
}

export function triggerHaptic(soundOn) {
  if (!soundOn) return;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
  } catch {}
}

export function handleImageUpload(file, onPreviewUrl, onSaveRef) {
  if (!file || !file.type.startsWith('image/')) return;
  const nextBlobUrl = URL.createObjectURL(file);
  releaseImage();
  currentBlobUrl = nextBlobUrl;

  const fileRef = {
    kind: "user",
    name: file.name,
    size: file.size,
    lastModified: file.lastModified
  };

  onPreviewUrl(currentBlobUrl);
  onSaveRef(fileRef);
}

export function getDefaultImageSvg() {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 220"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#60a5fa"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="400" height="220" fill="#0f172a"/><circle cx="120" cy="110" r="60" fill="url(#g)"/><rect x="190" y="50" width="130" height="120" rx="18" fill="#f59e0b" opacity="0.85"/></svg>`);
}

export function releaseImage() {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = null;
}
