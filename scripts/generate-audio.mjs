import fs from 'node:fs';
import path from 'node:path';

const AUDIO_DIR = path.resolve('content/audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

/**
 * Creates a clean 16kHz mono WAV file containing a pleasant tone
 * and sine-wave speech notification chime as fallback audio test fixture.
 */
function createToneWav(filename, durationSec = 2, freq = 440) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2; // 16-bit
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(1, 22);  // 1 channel (mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32);  // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate gentle decay chime
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const decay = Math.exp(-3 * (t / durationSec));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.4 * decay;
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  fs.writeFileSync(path.join(AUDIO_DIR, filename), buffer);
}

console.log('[generate-audio] generating listening audio test tone files in content/audio...');
createToneWav('tone.wav', 1.5, 520);
console.log('[generate-audio] generated tone.wav. When Piper TTS is available, generate speech audio with: piper --model en_US-lessac-medium');
