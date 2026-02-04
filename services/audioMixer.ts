
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface AudioSegment {
  id: string;
  text: string;
  language: 'ja-JP' | 'en-US'; // Added language support
  voice: string;
  style: string;
  speed: number; // 0.5 to 2.0
  pitch: string; // 'Low', 'Medium', 'High'
  startTime: number; // Seconds (offset from 0)
  duration: number; // Current duration on timeline
  naturalDuration?: number; // Duration of the actual audio blob
  blob: Blob | null;
  url: string | null;
  isGenerating: boolean;
  isCustomRecording: boolean; // Flag for user recorded audio
}

/**
 * Mixes multiple audio segments into a single WAV Blob.
 * Uses OfflineAudioContext for fast, faster-than-realtime rendering.
 */
export const mixAudioSegments = async (segments: AudioSegment[], totalDuration: number): Promise<Blob> => {
  // 1. Setup Audio Context
  const sampleRate = 44100; // Standard CD quality
  // Ensure duration is at least as long as the last audio segment end
  const maxAudioEnd = Math.max(...segments.map(s => s.startTime + (s.duration || 0)));
  const finalDuration = Math.max(totalDuration, maxAudioEnd);
  
  const offlineCtx = new OfflineAudioContext(1, sampleRate * finalDuration, sampleRate);

  // 2. Decode and Schedule Buffers
  const validSegments = segments.filter(s => s.blob !== null);
  
  await Promise.all(validSegments.map(async (seg) => {
    if (!seg.blob) return;
    try {
      const arrayBuffer = await seg.blob.arrayBuffer();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      
      // Pitch/Speed correction logic
      // If the timeline duration differs significantly from the actual blob duration,
      // we stretch/shrink the audio to fit the visual block.
      // Note: Changing playbackRate alters pitch in standard Web Audio API.
      // Ideally, Gemini should re-generate at the correct speed, but this provides immediate feedback.
      if (seg.duration > 0 && Math.abs(seg.duration - audioBuffer.duration) > 0.05) {
         source.playbackRate.value = audioBuffer.duration / seg.duration;
      } else {
         source.playbackRate.value = 1.0;
      }

      source.connect(offlineCtx.destination);
      source.start(seg.startTime);
    } catch (e) {
      console.error(`Failed to decode/mix segment ${seg.id}`, e);
    }
  }));

  // 3. Render
  const renderedBuffer = await offlineCtx.startRendering();

  // 4. Convert AudioBuffer to WAV Blob
  return bufferToWave(renderedBuffer, renderedBuffer.length);
};

// Helper function to write WAV headers
function bufferToWave(abuffer: AudioBuffer, len: number) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // clamp
      sample = Math.max(-1, Math.min(1, channels[i][offset])); 
      // scale to 16-bit signed int
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}
