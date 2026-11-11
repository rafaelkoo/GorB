// Live in-app camera. There is deliberately no "choose from gallery" option:
// a check-in photo has to be taken right now.
// Drawing the frame onto a canvas and re-encoding also drops all EXIF data (GPS, phone model).
import { PHOTO_MAX_PX, PHOTO_QUALITY } from './config.js';

export async function openCamera(videoEl) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access. Open the app in Chrome.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera(stream) { stream?.getTracks().forEach(t => t.stop()); }

export function snap(videoEl) {
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  if (!w || !h) throw new Error('Camera not ready yet');
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(videoEl, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('Could not take photo'))), 'image/jpeg', PHOTO_QUALITY));
}
