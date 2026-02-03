
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef} from 'react';
import {AspectRatio} from '../types';
import {ArrowPathIcon, DownloadIcon, SparklesIcon, FileImageIcon, PlusIcon} from './icons';
// @ts-ignore
import gifshot from 'gifshot';

interface VideoResultProps {
  videoUrl: string;
  onRetry: () => void;
  onNewVideo: () => void;
  onExtend: () => void;
  canExtend: boolean;
  aspectRatio: AspectRatio;
}

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl,
  onRetry,
  onNewVideo,
  onExtend,
  canExtend,
  aspectRatio,
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const [isConvertingGif, setIsConvertingGif] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleDownloadGif = async (frames: number) => {
    if (!videoUrl) return;
    
    setIsConvertingGif(true);
    
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";

      await new Promise((resolve) => {
        if (video.readyState >= 1) {
          resolve(null);
        } else {
          video.onloadedmetadata = () => resolve(null);
        }
      });

      const duration = video.duration;
      const width = isPortrait ? 360 : 640;
      const height = isPortrait ? 640 : 360;
      const step = duration / frames;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const images: string[] = [];

      for (let i = 0; i < frames; i++) {
        const time = i * step;
        if (time > 0) {
          video.currentTime = time;
          await new Promise((resolve) => {
             const onSeeked = () => {
               video.removeEventListener('seeked', onSeeked);
               resolve(null);
             };
             video.addEventListener('seeked', onSeeked);
          });
        }
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          images.push(canvas.toDataURL('image/jpeg', 0.8));
        }
      }

      gifshot.createGIF({
        images: images,
        interval: 0.1,
        gifWidth: width,
        gifHeight: height,
        numFrames: frames,
        sampleInterval: 10,
      }, (obj: any) => {
        if (!obj.error) {
          const link = document.createElement('a');
          link.href = obj.image;
          link.download = `veo-studio-${(frames/10).toFixed(1)}s.gif`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          console.error('GIF generation failed:', obj.error);
        }
        setIsConvertingGif(false);
      });
    } catch (error) {
      console.error('Error preparing GIF:', error);
      setIsConvertingGif(false);
    }
  };

  const getDurationLabel = (divisor: number) => {
    if (!videoDuration) return divisor === 1 ? '8s' : divisor === 2 ? '4s' : '2s';
    return `${Math.round(videoDuration / divisor)}s`;
  };

  const getFrames = (divisor: number) => {
    const duration = videoDuration || 8;
    return Math.floor((duration / divisor) * 10);
  }

  return (
    <div className="w-full relative flex flex-col items-center gap-8 p-12 bg-[#121213]/60 backdrop-blur-xl rounded-3xl border border-white/5 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-visible">
      <button
        onClick={onNewVideo}
        className="absolute top-6 left-6 flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-white/10 transition-all active:scale-95 z-10"
      >
        <PlusIcon className="w-3.5 h-3.5" />
        New Production
      </button>

      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border border-indigo-500/20 mb-3">
          <SparklesIcon className="w-3 h-3" />
          Scene Synthesized Successfully
        </div>
        <h2 className="text-3xl font-black text-white tracking-tighter mb-1">
          Final Render
        </h2>
        <p className="text-sm text-gray-500 font-medium">
          Generated with Veo 3.1 Cinematic Engine
        </p>
      </div>

      <div 
        className={`w-full ${
          isPortrait ? 'max-w-xs aspect-[9/16]' : 'max-w-2xl aspect-video'
        } rounded-2xl overflow-hidden bg-black shadow-[0_0_100px_-20px_rgba(79,70,229,0.3)] border border-white/10 relative group`}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          loop
          className="w-full h-full object-contain"
          onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration)}
        />
        <div className="absolute inset-0 pointer-events-none border-[12px] border-black/20 group-hover:opacity-0 transition-opacity"></div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all active:scale-95"
          title="Re-render with same parameters">
          <ArrowPathIcon className="w-5 h-5 opacity-70" />
          Regenerate
        </button>
        
        <a
          href={videoUrl}
          download="veo-studio-production.mp4"
          className="flex items-center gap-2 px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 shadow-xl shadow-indigo-600/20">
          <DownloadIcon className="w-5 h-5" />
          Export MP4
        </a>

        <div className="relative group">
          <button
            disabled={isConvertingGif}
            onClick={() => handleDownloadGif(getFrames(1))}
            className={`flex items-center gap-2 px-6 py-3.5 bg-amber-600/90 hover:bg-amber-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-xl shadow-amber-900/20 disabled:opacity-50`}
          >
            {isConvertingGif ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <FileImageIcon className="w-5 h-5" />
            )}
            {isConvertingGif ? 'Processing...' : 'Export GIF'}
          </button>
          
          {!isConvertingGif && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-[#1a1a1b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-30">
              <div className="p-3 text-[9px] text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 text-center font-black">
                Select Speed
              </div>
              {[
                { label: getDurationLabel(4), sub: 'Fast (4x)', frames: getFrames(4) },
                { label: getDurationLabel(2), sub: 'Mid (2x)', frames: getFrames(2) },
                { label: getDurationLabel(1), sub: 'Real (1x)', frames: getFrames(1) },
              ].map((opt) => (
                <button 
                  key={opt.sub}
                  onClick={(e) => { e.stopPropagation(); handleDownloadGif(opt.frames); }}
                  className="w-full text-left px-5 py-3.5 text-xs hover:bg-white/5 transition-colors flex justify-between items-center group/item"
                >
                  <span className="font-bold text-gray-200">{opt.label}</span>
                  <span className="text-[9px] text-gray-500 group-hover/item:text-amber-400 font-bold uppercase tracking-widest">{opt.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {canExtend ? (
          <button
            onClick={onExtend}
            className="flex items-center gap-2 px-7 py-3.5 bg-purple-600/90 hover:bg-purple-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-xl shadow-purple-900/20"
            title="Extend sequence by 7 seconds">
            <SparklesIcon className="w-5 h-5" />
            Extend Story
          </button>
        ) : (
          <div className="flex items-center gap-2 px-6 py-3.5 bg-gray-800/50 text-gray-500 font-bold rounded-xl opacity-60 border border-white/5 cursor-not-allowed" title="Resolution limit: Extension only available for 720p">
            <SparklesIcon className="w-5 h-5" />
            Extend Story
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoResult;
