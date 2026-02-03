
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

  if (params.controls) {
    if (params.controls.anatomyMaster) {
      const intensity = params.controls.anatomyCorrectionIntensity || 5;
      // Ultra-aggressive prompting to override bad anatomy in source images
      const intensitySuffix = intensity > 8 
        ? "CRITICAL: OVERRIDE SOURCE PIXELS. If the reference image has anatomical errors, ignore them and render correctly." 
        : "";
      
      directives.push(`
        ANATOMY MASTER DIRECTIVE:
        1. Render perfectly correct human anatomy for the subject.
        2. MANDATORY: The right hand and arm must have professional skeletal structure and exactly five fingers.
        3. ERROR CORRECTION: Even if the provided Reference Images (A or B) contain anatomical distortions in the hands or limbs, the model MUST disregard those specific errors and synthesize correct, realistic anatomy.
        4. Focus intensity: ${intensity}/10. ${intensitySuffix}
      `.trim());
    }
    if (params.controls.cinematicLighting) {
      directives.push("LIGHTING: 8k cinematic master-class, volumetric lighting, realistic soft bedroom shadows, professional color grading.");
    }
    if (params.controls.textureDetail) {
      directives.push("TEXTURE: Ultra-realistic skin textures, fabric weave detail, sharp academic paper text, high-fidelity environment.");
    }
    if (params.controls.temporalStability) {
      directives.push("STABILITY: High temporal coherence. No warping or flickering during transitions. Maintain character identity 100%.");
    }
  }

  if (directives.length > 0) {
    enhancedPrompt = `${enhancedPrompt}\n\n[PRODUCTION DIRECTIVES - SENSITIVE OVERRIDES]\n${directives.join("\n")}`;
  }

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

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
    console.log('Production Started: ', params.mode);
    let operation = await ai.models.generateVideos(generateVideoPayload);
    
    while (!operation.done) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
      console.log('Polling Engine State...');
    }

    // Safety check for operation error
    if (operation.error) {
      throw new Error(`Veo Engine Error: ${operation.error.message}`);
    }

    // Comprehensive safety check to prevent "Cannot read properties of undefined (reading '0')"
    if (operation?.response?.generatedVideos && operation.response.generatedVideos.length > 0) {
      const videoObject = operation.response.generatedVideos[0].video;
      if (!videoObject || !videoObject.uri) {
        throw new Error('Engine finished but returned an invalid video object.');
      }
      
      const url = decodeURIComponent(videoObject.uri);
      const res = await fetch(`${url}&key=${process.env.API_KEY}`);
      if (!res.ok) throw new Error(`Failed to fetch video binary: ${res.statusText}`);
      
      const videoBlob = await res.blob();
      const objectUrl = URL.createObjectURL(videoBlob);
      
      console.log('Production Complete. Duration:', ((performance.now() - startTime)/1000).toFixed(2), 's');
      console.groupEnd();

      return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
    } else {
      throw new Error('Video generation completed but the response was empty. Please check your prompt or reference images.');
    }
  } catch (err) {
    console.error('Production Failed:', err);
    console.groupEnd();
    throw err;
  }
};
