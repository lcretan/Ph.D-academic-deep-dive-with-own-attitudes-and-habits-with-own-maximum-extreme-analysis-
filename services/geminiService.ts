
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  Video,
  VideoGenerationReferenceImage,
  VideoGenerationReferenceType,
} from '@google/genai';
import {GenerateVideoParams, GenerationMode} from '../types';

/**
 * Generates a video using the Gemini/Veo API.
 * Injects specific directives for anatomy and quality based on master controls.
 */
export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const startTime = performance.now();
  console.group('Production Pipeline [Standalone Mode]');
  
  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  // Build the enhanced prompt based on Master Controls
  let enhancedPrompt = params.prompt;
  const directives = [];

  // ---------------------------------------------------------
  // LANGUAGE & CULTURAL ENFORCEMENT
  // ---------------------------------------------------------
  // Updated directives to strictly enforce Japanese visual speaking patterns
  directives.push(`
    [CULTURAL & LANGUAGE PROTOCOL: JAPANESE]
    - The visual context is STRICTLY Japan/Japanese.
    - If characters are talking, they MUST appear to be speaking Japanese.
    - Mouth movements should match Japanese vowel shapes (a, i, u, e, o).
    - Gestures: Include Japanese conversational mannerisms (e.g., slight nodding/aizuchi, soft hand gestures).
    - Atmosphere: Authentic Japanese cinematic aesthetic.
  `.trim());

  if (params.controls) {
    if (params.controls.anatomyMaster) {
      const intensity = params.controls.anatomyCorrectionIntensity || 5;
      const intensitySuffix = intensity > 8 
        ? "CRITICAL: The model MUST synthesize correct hands and arms. If the reference image has anatomical errors, the model is strictly ordered to correct them using professional artistic anatomy knowledge. DO NOT COPY HAND DISTORTIONS." 
        : "";
      
      // Note: We keep internal directives in English as the model's instruction following is highly optimized for English constraints, even with Japanese prompts.
      directives.push(`
        [ANATOMY PROTOCOL LEVEL ${intensity}]
        - Perfect human skeletal structure.
        - Professional joint rendering.
        - ${intensitySuffix}
      `.trim());
    }

    // ---------------------------------------------------------
    // TARGETED RIGHT ARM/HAND FIX
    // ---------------------------------------------------------
    // Specifically targeting the user reported issue with right arms/hands
    if (params.controls.handCorrectionIntensity && params.controls.handCorrectionIntensity > 0) {
      const handIntensity = params.controls.handCorrectionIntensity;
      const aggression = handIntensity > 7 ? "EXTREME PRIORITY" : "HIGH PRIORITY";
      
      directives.push(`
        [CRITICAL FIX: RIGHT ARM & RIGHT HAND (${aggression})]
        - TARGET: The character's RIGHT ARM and RIGHT HAND.
        - RULE 1: The right hand must have exactly 5 distinct fingers.
        - RULE 2: The right wrist and elbow joints must be anatomically valid. No backward bending.
        - RULE 3: Do not merge the right hand with objects or other body parts.
        - OVERRIDE: If the prompt implies a complex pose, prioritize anatomical correctness of the right arm over motion blur.
      `.trim());
    }
    
    if (params.controls.negativePrompt) {
      // Append specific hand negative prompts
      const specificNegatives = "malformed right hand, extra fingers on right hand, broken right arm, fused fingers, missing limb, distorted hands";
      directives.push(`[AVOID / NEGATIVE]: ${params.controls.negativePrompt}, ${specificNegatives}`);
    }

    if (params.controls.cinematicLighting) {
      directives.push("LIGHTING: 8k volumetric, cinematic master-class shadow rendering.");
    }
    if (params.controls.textureDetail) {
      directives.push("TEXTURE: Ultra-high fidelity, realistic fabrics, skin pores, and environmental detail.");
    }
  }

  if (directives.length > 0) {
    enhancedPrompt = `${enhancedPrompt}\n\nDIRECTIVES:\n${directives.join("\n")}`;
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
    console.log('Production Started:', params.mode, 'Seed:', params.seed || 'random');
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
      // Improved error message for empty response (likely safety filter)
      const hint = "これは通常、AIの安全性フィルターが生成をブロックした場合や、プロンプトが矛盾している場合に発生します。表現を少し変更するか（例：「パジャマ」を「ラウンジウェア」に変更するなど）、人体構造補正の強度を下げてみてください。";
      throw new Error(`生成レスポンスが空でした。${hint}`);
    }
  } catch (err) {
    console.error('Production Error:', err);
    console.groupEnd();
    throw err;
  }
};
