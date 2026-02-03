
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
 * Refactored for better speed and debugging visibility.
 */
export const generateVideo = async (
  params: GenerateVideoParams,
): Promise<{objectUrl: string; blob: Blob; uri: string; video: Video}> => {
  const startTime = performance.now();
  console.group('Video Production Pipeline');
  console.log('Parameters:', params);

  const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

  const config: any = {
    numberOfVideos: 1,
    resolution: params.resolution,
  };

  if (params.mode !== GenerationMode.EXTEND_VIDEO) {
    config.aspectRatio = params.aspectRatio;
  }

  const generateVideoPayload: any = {
    model: params.model,
    config: config,
  };

  if (params.prompt) {
    generateVideoPayload.prompt = params.prompt;
  }

  // Handle specific generation modes
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

    if (params.styleImage) {
      referenceImagesPayload.push({
        image: { imageBytes: params.styleImage.base64, mimeType: params.styleImage.file.type },
        referenceType: VideoGenerationReferenceType.STYLE,
      });
    }

    if (referenceImagesPayload.length > 0) {
      generateVideoPayload.config.referenceImages = referenceImagesPayload;
    }
  } else if (params.mode === GenerationMode.EXTEND_VIDEO) {
    if (params.inputVideoObject) {
      generateVideoPayload.video = params.inputVideoObject;
    } else {
      throw new Error('An input video object is required to extend a video.');
    }
  }

  try {
    console.log('Submitting request to Veo engine...');
    let operation = await ai.models.generateVideos(generateVideoPayload);
    console.log('Operation ID:', operation.name);

    // Optimized Polling: 5 seconds for faster turn-around on quick renders
    let pollCount = 0;
    while (!operation.done) {
      pollCount++;
      const timeElapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`[${timeElapsed}s] Polling state (Attempt ${pollCount})...`);
      
      await new Promise((resolve) => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    if (operation?.response) {
      const videos = operation.response.generatedVideos;
      if (!videos || videos.length === 0) throw new Error('Engine returned empty video array.');

      const videoObject = videos[0].video;
      const url = decodeURIComponent(videoObject.uri);
      
      console.log('Fetching binary data from URI...');
      const res = await fetch(`${url}&key=${process.env.API_KEY}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

      const videoBlob = await res.blob();
      const objectUrl = URL.createObjectURL(videoBlob);
      
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`Production complete in ${totalTime}s`);
      console.groupEnd();

      return {objectUrl, blob: videoBlob, uri: url, video: videoObject};
    } else {
      throw new Error('Operation finished but no response data found.');
    }
  } catch (err) {
    console.error('Pipeline Error:', err);
    console.groupEnd();
    throw err;
  }
};
