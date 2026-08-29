// Generates three short, seamlessly-looping ambient noise tracks entirely
// via DSP synthesis (Voss-McCartney pink noise, a leaky-integrator brown
// noise, and a layered "rain" texture). No external audio samples or
// licensed content involved -- pure math, written once and bundled into
// the app for the Sleep tab's Recovery Hub.
//
// Run: node scripts/generate_ambient_noise.js

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 8;
const CROSSFADE_SECONDS = 0.75;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

function generatePink(n) {
  const rows = new Float32Array(16);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x = i + 1;
    let idx = 0;
    while ((x & 1) === 0 && idx < rows.length - 1) {
      x >>= 1;
      idx++;
    }
    rows[idx] = Math.random() * 2 - 1;
    let sum = 0;
    for (let r = 0; r < rows.length; r++) sum += rows[r];
    out[i] = sum;
  }
  return out;
}

function generateBrown(n) {
  const out = new Float32Array(n);
  let brown = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    brown += white * 0.05;
    // Gentle pull back toward zero so it doesn't wander off and clip.
    brown *= 0.996;
    out[i] = brown;
  }
  return out;
}

function generateRain(n) {
  const pinkBed = generatePink(n);
  const out = new Float32Array(n);
  let prevWhite = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    // First-order high-pass (differencing) emphasizes higher frequencies
    // for a hiss/patter texture, layered over a soft pink noise bed.
    const hiss = white - prevWhite;
    prevWhite = white;
    const lfo = 1 + 0.12 * Math.sin((i / SAMPLE_RATE) * 2 * Math.PI * 0.15);
    out[i] = pinkBed[i] * 0.35 + hiss * 0.5 * lfo;
  }
  return out;
}

function normalize(samples, peak = 0.85) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max === 0) return samples;
  const scale = peak / max;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * scale;
  return out;
}

// Equal-power crossfade of the tail into the head so the loop point has no
// audible seam, then trims to the target duration.
function makeSeamlessLoop(samples, sampleRate, durationSeconds, crossfadeSeconds) {
  const totalLen = Math.floor(sampleRate * (durationSeconds + crossfadeSeconds));
  const targetLen = Math.floor(sampleRate * durationSeconds);
  const fadeLen = totalLen - targetLen;
  const src = samples.slice(0, totalLen);
  const out = new Float32Array(targetLen);
  for (let i = 0; i < targetLen; i++) out[i] = src[i];
  for (let i = 0; i < fadeLen; i++) {
    const t = i / fadeLen;
    const fadeOut = Math.cos((t * Math.PI) / 2);
    const fadeIn = Math.sin((t * Math.PI) / 2);
    out[i] = out[i] * fadeIn + src[targetLen + i] * fadeOut;
  }
  return out;
}

function floatTo16BitPCM(samples) {
  const buffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  return buffer;
}

function writeWav(filePath, samples, sampleRate) {
  const pcm = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}

function build(name, generator) {
  const n = Math.floor(SAMPLE_RATE * (DURATION_SECONDS + CROSSFADE_SECONDS));
  const raw = generator(n);
  const normalized = normalize(raw);
  const looped = makeSeamlessLoop(normalized, SAMPLE_RATE, DURATION_SECONDS, CROSSFADE_SECONDS);
  const outPath = path.join(OUT_DIR, `${name}.wav`);
  writeWav(outPath, looped, SAMPLE_RATE);
  console.log(`Wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
build('pink_noise', generatePink);
build('brown_noise', generateBrown);
build('rain_ambient', generateRain);
