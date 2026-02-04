
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Loads the FFmpeg core. Singleton pattern to avoid reloading.
 */
const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;

  const instance = new FFmpeg();
  // Using unpkg for core files as it's reliable for ffmpeg.wasm distribution
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  try {
    await instance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpeg = instance;
    return ffmpeg;
  } catch (error) {
    console.error("Failed to load FFmpeg:", error);
    throw new Error("動画処理エンジンの起動に失敗しました。ブラウザのセキュリティ設定を確認してください。");
  }
};

/**
 * Muxes (combines) a video blob and an audio blob into a single MP4 file.
 * Video is copied (no re-encoding), Audio is encoded to AAC.
 */
export const muxVideoAndAudio = async (videoUrl: string, audioUrl: string): Promise<string> => {
  const ffmpegInstance = await loadFFmpeg();

  // 1. Fetch File Data
  const videoBlob = await fetch(videoUrl).then((r) => r.blob());
  const audioBlob = await fetch(audioUrl).then((r) => r.blob());
  const videoData = await videoBlob.arrayBuffer();
  const audioData = await audioBlob.arrayBuffer();

  // 2. Write files to FFmpeg's virtual file system
  await ffmpegInstance.writeFile('input_video.mp4', new Uint8Array(videoData));
  await ffmpegInstance.writeFile('input_audio.wav', new Uint8Array(audioData));

  // 3. Run FFmpeg Command
  // -i input_video.mp4: Input 1
  // -i input_audio.wav: Input 2
  // -c:v copy: Copy video stream directly (fast, no quality loss)
  // -c:a aac: Convert audio to AAC (standard for MP4)
  // -strict experimental: Allow AAC encoding in some versions
  // -shortest: Finish when the shortest stream ends (usually video)
  // output.mp4: Output file
  console.log("Starting muxing process...");
  
  await ffmpegInstance.exec([
    '-i', 'input_video.mp4',
    '-i', 'input_audio.wav',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-strict', 'experimental',
    '-shortest', // Optional: clip audio if longer than video, or remove to keep full audio
    'output.mp4'
  ]);

  // 4. Read the result
  const data = await ffmpegInstance.readFile('output.mp4');
  
  // 5. Cleanup
  await ffmpegInstance.deleteFile('input_video.mp4');
  await ffmpegInstance.deleteFile('input_audio.wav');
  await ffmpegInstance.deleteFile('output.mp4');

  // 6. Create Blob URL
  const blob = new Blob([data], { type: 'video/mp4' });
  return URL.createObjectURL(blob);
};
