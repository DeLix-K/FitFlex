// Generates three stereo binaural-beat tracks via pure sine-wave synthesis
// (a distinct left/right carrier frequency per track; the perceived "beat"
// is the frequency difference between the two ears). No licensed audio
// samples -- just math, same spirit as generate_ambient_noise.js.
//
// Frequencies are chosen so a whole number of cycles fits in the loop
// duration on BOTH channels, so the loop point is mathematically seamless
// (sin and its slope both match at t=0 and t=duration) -- no crossfade
// needed, unlike the noise tracks.
//
// Run: node scripts/generate_binaural_beats.js

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 4;
const PEAK = 0.32;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'audio');

const TRACKS = [
  // Beta range (~14Hz) -- associated with alert focus.
  { name: 'binaural_focus', left: 200, right: 214 },
  // Alpha range (~8Hz) -- associated with relaxed wakefulness.
  { name: 'binaural_relax', left: 200, right: 208 },
  // Delta range (~3Hz) -- associated with deep-sleep transition.
  { name: 'binaural_sleep', left: 150, right: 153 },
];

function generateChannel(freq, n, sampleRate, peak) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = peak * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

function interleaveStereo(left, right) {
  const out = new Float32Array(left.length * 2);
  for (let i = 0; i < left.length; i++) {
    out[i * 2] = left[i];
    out[i * 2 + 1] = right[i];
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

function writeStereoWav(filePath, interleaved, sampleRate) {
  const pcm = floatTo16BitPCM(interleaved);
  const header = Buffer.alloc(44);
  const numChannels = 2;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, pcm]));
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const track of TRACKS) {
  const n = SAMPLE_RATE * DURATION_SECONDS;
  const left = generateChannel(track.left, n, SAMPLE_RATE, PEAK);
  const right = generateChannel(track.right, n, SAMPLE_RATE, PEAK);
  const interleaved = interleaveStereo(left, right);
  const outPath = path.join(OUT_DIR, `${track.name}.wav`);
  writeStereoWav(outPath, interleaved, SAMPLE_RATE);
  console.log(
    `Wrote ${outPath} (L=${track.left}Hz R=${track.right}Hz beat=${Math.abs(track.right - track.left)}Hz, ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`
  );
}
