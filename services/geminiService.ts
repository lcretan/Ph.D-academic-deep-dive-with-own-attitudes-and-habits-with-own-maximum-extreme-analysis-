
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
  HarmCategory,
  HarmBlockThreshold,
  Modality,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode, AspectRatio} from '../types';

/**
 * Optimizes a raw user prompt for Veo 3.1 using Gemini 3 Flash.
 * Converts narrative descriptions into visual, camera-ready directions.
 */
export const optimizePromptForVeo = async (rawPrompt: string): Promise<string> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  
  // Using gemini-3-flash-preview for fast reasoning and text rewriting
  // Enhanced system instructions to handle specific "acting" and "temporal flow" requirements
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      You are a professional Director of Photography and Screenwriter for AI Video Generation (Veo).
      Your goal is to convert the user's narrative context into a concrete, visual filming instruction.

      User Input Context: "${rawPrompt}"

      CRITICAL INSTRUCTIONS:
      1. **Translate Abstract to Physical**: If the user describes a habit or abstract thought process (e.g., "thinking deeply", "deep dive"), convert it into the specific PHYSICAL ACTION described (e.g., "rolling side-to-side on the bed", "pacing around").
      2. **Temporal Flow (Timeline)**: The video is short (approx 5-7 seconds). Explicitly describe the sequence: [Start State] -> [Action/Movement] -> [End State].
      3. **Bridge Start and End**: The user often provides a Start Frame and End Frame. Your prompt must describe the *movement* that connects them.
      4. **Atmosphere**: Pay attention to time of day (e.g., "4:30 AM" = Dim blue hour, soft morning light) and setting.
      5. **Style**: Maintain a "Cinematic, High Quality" aesthetic. 
      6. **Output Language**: JAPANESE.

      Example formatting:
      "早朝4時30分の薄暗い寝室。ベッドの上で、アクセサリーをつけたままの日本人女性研究者が、目を閉じてシーツの上を左右にゴロゴロと転がりながら深く考え込んでいる（ディープダイブ）。その後、彼女は動きを止めて仰向けになり、カメラを見上げて、いたずらっぽく自信に満ちた微笑みを浮かべる。シネマティックな照明、高解像度。"

      Output ONLY the optimized prompt string.
    `,
  });

  return response.text || rawPrompt;
};

/**
 * Generates a storyboard/preview image using Gemini 3 Pro (Nano Banana Pro).
 * This image can be used as a start or end frame for Veo.
 */
export const generateStoryboardImage = async (prompt: string, aspectRatio: AspectRatio): Promise<{base64: string, mimeType: string}> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  // Using gemini-3-pro-image-preview (Nano Banana Pro) for high-quality image generation
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
          text: `Generate a high-quality cinematic image based on this description. This will be used as a keyframe for a video: ${prompt}`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio === AspectRatio.PORTRAIT ? "9:16" : "16:9",
        imageSize: "1K"
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }
  throw new Error("No image generated.");
};

/**
 * Helper to convert Base64 PCM data to a WAV Blob for playback
 */
const pcmToWavBlob = (base64Pcm: string, sampleRate: number = 24000): Blob => {
  const binaryString = atob(base64Pcm);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini returns Int16 PCM.
  const dataView = new DataView(bytes.buffer);
  
  // WAV Header construction
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = len;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk length */
  view.setUint32(4, 36 + dataSize, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, byteRate, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitsPerSample, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  for (let i = 0; i < len; i++) {
    view.setUint8(44 + i, bytes[i]);
  }

  return new Blob([view], { type: 'audio/wav' });
};

/**
 * Generates speech from text using Gemini 2.5 Flash TTS with acting style instructions.
 */
export const generateSpeech = async (text: string, voiceName: string = 'Kore', actingStyle: string = 'Natural'): Promise<{audioUrl: string, blob: Blob}> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  
  // Construct a prompt that includes acting instructions
  // Gemini 2.5 Flash TTS is multimodal and follows instructions well.
  const promptText = `
    Acting Direction: Read the following text with a ${actingStyle} tone/emotion.
    Text: "${text}"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Audio generation failed: No audio data returned.");
  }

  // Convert raw PCM to WAV for browser playback
  const audioBlob = pcmToWavBlob(base64Audio, 24000);
  const audioUrl = URL.createObjectURL(audioBlob);

  return { audioUrl, blob: audioBlob };
};

/**
 * Generates a video using the Gemini/Veo API.
 */
export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const startTime = performance.now();
  console.group('Production Pipeline [Standalone Mode]');
  
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  // Build the enhanced prompt
  let enhancedPrompt = params.prompt;
  const styleKeywords: string[] = [];

  if (params.controls) {
    if (params.controls.cinematicLighting) {
      styleKeywords.push("cinematic lighting", "volumetric lighting", "8k resolution");
    }
    if (params.controls.textureDetail) {
      styleKeywords.push("highly detailed textures", "photorealistic");
    }
    if (params.controls.anatomyMaster) {
      styleKeywords.push("anatomically correct");
    }
  }

  if (styleKeywords.length > 0) {
    enhancedPrompt = `${enhancedPrompt}, ${styleKeywords.join(", ")}`;
  }

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

  // Add seed if provided for reproducibility/variation
  if (params.seed !== undefined && params.seed !== 0) {
    config.seed = params.seed;
  }

  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    config.aspectRatio = params.aspectRatio;
  }

  // Safety settings set to BLOCK_NONE to minimize false positives
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  const generateVideoPayload: any = {
    model: params.model,
    prompt: enhancedPrompt,
    config: config,
    safetySettings: safetySettings,
  };

  if (params.mode === GenerationMode.FRAMES_TO_VIDEO) {
    if (params.startFrame) {
      generateVideoPayload.image = {
        imageBytes: params.startFrame.base64,
        mimeType: params.startFrame.file.type,
      };
    }

    const finalEndFrame = params.isLooping ? params.startFrame : params.endFrame;
    if (finalEndFrame) {
      generateVideoPayload.config.lastFrame = {
        imageBytes: finalEndFrame.base64,
        mimeType: finalEndFrame.file.type,
      };
    }
  } else if (params.mode === GenerationMode.REFERENCES_TO_VIDEO) {
    const referenceImagesPayload: VideoGenerationReferenceImage[] = [];
    if (params.referenceImages) {
      params.referenceImages.forEach((img) => {
        referenceImagesPayload.push({
          image: { imageBytes: img.base64, mimeType: img.file.type },
          referenceType: VideoGenerationReferenceType.ASSET,
        });
      });
    }
    if (referenceImagesPayload.length > 0) {
      generateVideoPayload.config.referenceImages = referenceImagesPayload;
    }
  }

  try {
    console.log('Production Started:', params.mode, 'Model:', params.model);
    console.log('Prompt:', enhancedPrompt);
    console.log('Safety Settings: BLOCK_NONE');
    
    let operation = await ai.models.generateVideos(generateVideoPayload);
    
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
      console.log('Engine Status: Processing...');
    }

    if (operation.error) {
      throw new Error(`Veo Engine reported an error: ${operation.error.message} (Code: ${operation.error.code})`);
    }

    const generatedVideos = operation?.response?.generatedVideos;

    if (generatedVideos && generatedVideos.length > 0) {
      const videoObject = generatedVideos[0].video;
      if (!videoObject || !videoObject.uri) {
        throw new Error('動画は生成されましたが、URIが見つかりません。権限を確認してください。');
      }
      
      const url = decodeURIComponent(videoObject.uri);
      const res = await fetch(`${url}&key=${process.env.API_KEY}`);
      if (!res.ok) throw new Error(`ダウンロードに失敗しました: ${res.statusText}`);
      
      const videoBlob = await res.blob();
      const objectUrl = URL.createObjectURL(videoBlob);
      
      console.log('Production Complete. Output ready.');
      console.groupEnd();

      return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
    } else {
      const hint = "生成結果が空でした。プロンプトの内容（矛盾や複雑さ）または入力画像との不整合が原因の可能性があります。より単純なプロンプトを試してください。";
      throw new Error(hint);
    }
  } catch (err) {
    console.error('Production Error:', err);
    console.groupEnd();
    throw err;
  }
};
