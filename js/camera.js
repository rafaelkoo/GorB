// Live in-app camera. There is deliberately no "choose from gallery" option:
// a check-in photo has to be taken right now.
// Drawing the frame onto a canvas and re-encoding also drops all EXIF data (GPS, phone model).
import { PHOTO_MAX_PX, PHOTO_QUALITY, THUMB_MAX_PX, THUMB_QUALITY, CHAT_PHOTO_MAX_PX, CHAT_PHOTO_QUALITY, CHAT_THUMB_MAX_PX, CHAT_THUMB_QUALITY } from './config.js';

// facing: 'environment' = back camera, 'user' = front (selfie)
export async function openCamera(videoEl, facing = 'environment') {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access. Open the app in Chrome.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    audio: false
  });
  videoEl.srcObject = stream;
  // don't wait on play(): if the screen was left meanwhile it never settles, and the caller must still get the stream to stop it
  videoEl.play().catch(() => {});
  return stream;
}

export function stopCamera(stream) { stream?.getTracks().forEach(t => t.stop()); }

// more than one camera means there's a front one to flip to (labels/ids need permission first)
export async function cameraCount() {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput').length; } catch { return 1; }
}

function encode(source, w, h, maxPx, quality) {
  const scale = Math.min(1, maxPx / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return new Promise((ok, fail) => c.toBlob(b => (b ? ok(b) : fail(new Error('Could not take photo'))), 'image/jpeg', quality));
}

// Returns two JPEGs from the same frame: the full photo, and a small one for the feed
// (the feed is most of the download traffic, and Supabase free allows 5 GB a month).
export async function snap(videoEl) {
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  if (!w || !h) throw new Error('Camera not ready yet');
  const [full, thumb] = await Promise.all([
    encode(videoEl, w, h, PHOTO_MAX_PX, PHOTO_QUALITY),
    encode(videoEl, w, h, THUMB_MAX_PX, THUMB_QUALITY)
  ]);
  return { full, thumb };
}

// A photo picked from the gallery for the chat: turned the right way up, shrunk (960 px, plus a 360 px
// preview) and re-encoded, which also drops its EXIF (GPS, phone model). Usually 60–150 KB.
export async function shrinkPhoto(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('That isn’t a photo');
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error('Couldn’t open that photo')); im.src = URL.createObjectURL(file); });
  }
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  let full = await encode(src, w, h, CHAT_PHOTO_MAX_PX, CHAT_PHOTO_QUALITY);
  if (full.size > 400 * 1024) full = await encode(src, w, h, CHAT_PHOTO_MAX_PX, 0.5);   // very busy photos
  const thumb = await encode(src, w, h, CHAT_THUMB_MAX_PX, CHAT_THUMB_QUALITY);
  src.close?.();
  return { full, thumb, w, h };
}

// For the story-style editor: grab the frame once at full photo size, edit on top, then encode.
// mirror: selfies are saved the way you saw them on screen (like Instagram)
export function grabFrame(videoEl, mirror = false) {
  const w = videoEl.videoWidth, h = videoEl.videoHeight;
  if (!w || !h) throw new Error('Camera not ready yet');
  const scale = Math.min(1, PHOTO_MAX_PX / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const x = c.getContext('2d');
  if (mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
  x.drawImage(videoEl, 0, 0, c.width, c.height);
  return c;
}
export async function encodeCanvas(c) {
  const [full, thumb] = await Promise.all([
    encode(c, c.width, c.height, PHOTO_MAX_PX, PHOTO_QUALITY),
    encode(c, c.width, c.height, THUMB_MAX_PX, THUMB_QUALITY)
  ]);
  return { full, thumb };
}
