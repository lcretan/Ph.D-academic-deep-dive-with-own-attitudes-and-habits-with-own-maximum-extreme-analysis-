
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef, useMemo} from 'react';
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
  videoUrl, onRetry, onNewVideo, onExtend, canExtend, aspectRatio
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const [isExporting, setIsExporting] = useState(false);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleGifExport = async (divisor: number) => {
    if (!videoUrl) return;
    setIsExporting(true);
    
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.muted = true;
      video.crossOrigin = "anonymous";
      await new Promise(r => video.onloadedmetadata = r);

      const frames = Math.floor((video.duration / divisor) * 10);
      const width = isPortrait ? 360 : 640;
      const height = isPortrait ? 640 : 360;
      const step = video.duration / frames;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const images: string[] = [];

      for (let i = 0; i < frames; i++) {
        video.currentTime = i * step;
        await new Promise(r => video.onseeked = r);
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          images.push(canvas.toDataURL('image/jpeg', 0.7));
        }
      }

      gifshot.createGIF({
        images, interval: 0.1, gifWidth: width, gifHeight: height, numFrames: frames,
      }, (obj: any) => {
        if (!obj.error) {
          const a = document.createElement('a');
          a.href = obj.image;
          a.download = `veo-export-${Date.now()}.gif`;
          a.click();
        }
        setIsExporting(false);
      });
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 py-12 px-6 bg-[#0a0a0b] rounded-[3rem] border border-white/5 shadow-3xl animate-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
          <SparklesIcon className="w-3.5 h-3.5" />
          生成完了 (Success)
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">The Final Cut</h2>
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">Cinematic Render • Veo 3.1 Pro</p>
      </div>

      <div className={`relative group ${isPortrait ? 'max-w-xs' : 'max-w-3xl'} w-full bg-black rounded-3xl overflow-hidden shadow-[0_0_80px_-20px_rgba(79,70,229,0.4)] border border-white/10`}>
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          autoPlay
          loop
          className="w-full h-full object-contain"
          onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
        />
        <div className="absolute inset-0 border-[16px] border-black/10 pointer-events-none" />
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button onClick={onRetry} className="group flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl border border-white/10 transition-all active:scale-95">
          <ArrowPathIcon className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
          再レンダリング (RETRY)
        </button>

        <a href={videoUrl} download="veo-production.mp4" className="flex items-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95">
          <DownloadIcon className="w-4 h-4" />
          MP4ダウンロード
        </a>

        <div className="relative group">
          <button disabled={isExporting} className="flex items-center gap-3 px-8 py-4 bg-amber-600/90 hover:bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-900/10 transition-all disabled:opacity-50">
            {isExporting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileImageIcon className="w-4 h-4" />}
            GIF変換出力
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-40 bg-[#161617] border border-white/10 rounded-2xl shadow-3xl opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50 overflow-hidden">
             {[ {l: '等倍速', s: 1}, {l: '2倍速', s: 2}, {l: '4倍速', s: 4} ].map(o => (
               <button key={o.l} onClick={() => handleGifExport(o.s)} className="w-full text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                 {o.l}
               </button>
             ))}
          </div>
        </div>

        <button onClick={onNewVideo} className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl border border-white/10 transition-all">
          <PlusIcon className="w-4 h-4" />
          新規作成 (NEW)
        </button>
      </div>
    </div>
  );
};

export default VideoResult;
