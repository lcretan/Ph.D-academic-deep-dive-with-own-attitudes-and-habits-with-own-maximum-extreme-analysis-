
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

// Centralized Safety Settings (BLOCK_NONE)
// ユーザーの指示に従い、創造的なプロンプトが誤検知でブロックされないように全てのフィルターを無効化します。
const SAFETY_SETTINGS_BLOCK_NONE = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Optimizes a raw user prompt for Veo 3.1 using Gemini 3 Flash.
 * Converts narrative descriptions into visual, camera-ready directions.
 */
export const optimizePromptForVeo = async (rawPrompt: string): Promise<string> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  
  // Using gemini-3-flash-preview for fast reasoning and text rewriting
  // Enhanced system instructions to handle specific "acting" and "temporal flow" requirements
  try {
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
        6. **Output Language**: JAPANESE (Must be in Japanese).
        7. **Clean Output**: Do not include markdown formatting (like \`\`\`) or introductory phrases. Just the prompt.

        Example formatting:
        "早朝4時30分の薄暗い寝室。ベッドの上で、アクセサリーをつけたままの日本人女性研究者が、目を閉じてシーツの上を左右にゴロゴロと転がりながら深く考え込んでいる（ディープダイブ）。その後、彼女は動きを止めて仰向けになり、カメラを見上げて、いたずらっぽく自信に満ちた微笑みを浮かべる。シネマティックな照明、高解像度。"

        Output ONLY the optimized prompt string.
      `,
      safetySettings: SAFETY_SETTINGS_BLOCK_NONE, // Apply BLOCK_NONE here as well
    });

    let text = response.text;
    if (!text) {
        // Fallback if model returns empty text but no error (rare)
        return rawPrompt;
    }
    
    // Cleanup any potential markdown or quotes that Gemini might have added
    text = text.replace(/^```(json|text)?\n/, '').replace(/\n```$/, '').trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }
    return text;
  } catch (e) {
      console.warn("Prompt optimization failed or was blocked, falling back to raw prompt.", e);
      return rawPrompt;
  }
};

/**
 * Helper function to sanitize prompts that triggered safety filters.
 * It rewrites the prompt to be "safe" while keeping the aesthetic.
 */
const sanitizePromptForSafety = async (originalPrompt: string, reason: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a Safety Compliance Expert for AI Video Generation.
        The user's prompt triggered a safety filter (Reason: "${reason}").
        
        Original Prompt: "${originalPrompt}"

        Goal: Rewrite the prompt to be safe for a general audience while maintaining the artistic intent, lighting, and mood.
        
        Guidelines:
        1. Soften specific location descriptions if they imply intimacy (e.g., change "bedroom" to "cozy living space", "sunlit room", or "studio").
        2. Modify pose descriptions (e.g., change "lying on bed" to "sitting comfortably", "resting", or "reclining on a sofa").
        3. Remove specific camera angles like "POV" or "low angle" if coupled with a human subject in a private setting.
        4. Remove keywords that might be misinterpreted as NSFW (e.g., specific body part focus, "rolling around").
        5. Keep the language Japanese.
        6. Output ONLY the rewritten prompt.
      `,
      safetySettings: SAFETY_SETTINGS_BLOCK_NONE,
    });
    
    let text = response.text;
    if (text) {
        text = text.replace(/^```(json|text)?\n/, '').replace(/\n```$/, '').trim();
        if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
        return text;
    }
    return originalPrompt;
  } catch (e) {
    console.warn("Sanitization failed, returning original", e);
    return originalPrompt;
  }
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
    safetySettings: SAFETY_SETTINGS_BLOCK_NONE, // Apply BLOCK_NONE here
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
 * Returns audio URL, Blob, and calculated duration.
 */
export const generateSpeech = async (
  text: string, 
  voiceName: string = 'Kore', 
  actingStyle: string = 'Natural',
  speed: number = 1.0,
  pitch: string = 'Medium',
  language: 'ja-JP' | 'en-US' = 'ja-JP'
): Promise<{audioUrl: string, blob: Blob, duration: number}> => {
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
  
  // Convert numeric speed to natural language description
  let speedDesc = "Normal speed";
  if (speed <= 0.7) speedDesc = "Very slow";
  else if (speed < 1.0) speedDesc = "Slightly slow";
  else if (speed > 1.3) speedDesc = "Very fast";
  else if (speed > 1.0) speedDesc = "Fast";

  const langInstruction = language === 'en-US' 
    ? "Language: English (US)" 
    : "Language: Japanese";

  // Construct a prompt that includes acting instructions
  // Simplified structure to avoid confusing the model
  const promptText = `
    Instructions: Read the following text as a professional voice actor.
    ${langInstruction}
    Style: ${actingStyle}
    Speed: ${speedDesc}
    Pitch: ${pitch}
    
    Text to speak:
    "${text}"
  `;

  try {
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
      safetySettings: SAFETY_SETTINGS_BLOCK_NONE, // Ensure this is using the constant
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    
    // Check if we got text instead of audio (error message from model)
    if (part?.text) {
        console.warn("TTS returned text instead of audio:", part.text);
    }

    const base64Audio = part?.inlineData?.data;
    
    if (!base64Audio) {
      console.error("Full response dump:", JSON.stringify(response, null, 2));
      throw new Error("Audio generation failed: No audio data returned. The model might have blocked the content.");
    }

    // Convert raw PCM to WAV for browser playback
    const sampleRate = 24000;
    const audioBlob = pcmToWavBlob(base64Audio, sampleRate);
    const audioUrl = URL.createObjectURL(audioBlob);

    // Calculate duration from PCM size (more reliable than waiting for Audio element to load)
    // base64 -> binary string -> bytes
    // Each sample is 16-bit (2 bytes). Mono channel.
    // Duration = TotalBytes / (SampleRate * NumChannels * BytesPerSample)
    const binaryString = atob(base64Audio);
    const byteLength = binaryString.length;
    const duration = byteLength / (sampleRate * 1 * 2);

    return { audioUrl, blob: audioBlob, duration };
  } catch (e: any) {
    console.error("Gemini TTS Error:", e);
    throw new Error(e.message || "Failed to generate speech.");
  }
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

  // --- Helper: Poll for completion with simple backoff/resilience ---
  const waitForOperation = async (initialOperation: any) => {
    let operation = initialOperation;
    let retries = 0;
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
          operation = await ai.operations.getVideosOperation({operation: operation});
          console.log('Engine Status: Processing...');
      } catch (e) {
          console.warn("Polling error (ignoring momentarily):", e);
          if (retries++ > 3) throw e;
      }
    }
    return operation;
  };
  // ----------------------------------------------------------------

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

  const generateVideoPayload: any = {
    model: params.model,
    prompt: enhancedPrompt,
    config: config,
    safetySettings: SAFETY_SETTINGS_BLOCK_NONE, // Use the constant
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
      // Constraint: Reference Images only supported on veo-3.1-generate-preview with 720p 16:9
      console.log("Enforcing constraints for References to Video mode: 720p, 16:9, Pro Model");
      generateVideoPayload.model = 'veo-3.1-generate-preview';
      config.aspectRatio = '16:9';
      config.resolution = '720p';
    }
  }

  try {
    console.log('Production Started:', params.mode, 'Model:', params.model);
    console.log('Prompt:', enhancedPrompt);
    console.log('Safety Settings: BLOCK_NONE');
    
    // Initial Attempt
    let operation = await ai.models.generateVideos(generateVideoPayload);
    operation = await waitForOperation(operation);

    if (operation.error) {
      throw new Error(`Veo Engine reported an error: ${operation.error.message} (Code: ${operation.error.code})`);
    }

    // Safety Filter Retry Logic:
    // If blocked, use Smart Sanitization to rewrite the prompt.
    if (operation.response?.raiMediaFilteredCount && operation.response.raiMediaFilteredCount > 0) {
        console.warn("⚠️ Safety filter triggered. Engaging Smart Sanitization...");
        const reason = operation.response.raiMediaFilteredReasons?.[0] || "Unknown Safety Violation";
        
        // Use smart sanitization on the ORIGINAL prompt to get a compliant version
        // We do not add back the style keywords to maximize success chance
        const sanitizedPrompt = await sanitizePromptForSafety(params.prompt, reason);
        
        console.log(`Retrying with sanitized prompt: "${sanitizedPrompt}"`);
        generateVideoPayload.prompt = sanitizedPrompt;
        
        // Retry generation
        operation = await ai.models.generateVideos(generateVideoPayload);
        operation = await waitForOperation(operation);
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
      // Detailed Failure Analysis
      console.error("Empty Response Operation Dump:", JSON.stringify(operation, null, 2));
      
      const reasons = operation.response?.raiMediaFilteredReasons;
      let errorMessage = "生成結果が空でした。";
      
      if (reasons && reasons.length > 0) {
           errorMessage = `安全フィルターによりブロックされました: ${reasons[0]}`;
           errorMessage += "\n(ヒント: プロンプトに含まれる身体的特徴、特定の場所、またはアングルを変更してみてください。自動修正を試みましたが、まだポリシーに抵触しています)";
      } else {
           errorMessage += "プロンプトが複雑すぎるか、不明なエラーが発生しました。";
      }
      
      throw new Error(errorMessage);
    }
  } catch (err) {
    console.error('Production Error:', err);
    console.groupEnd();
    throw err;
  }
};
