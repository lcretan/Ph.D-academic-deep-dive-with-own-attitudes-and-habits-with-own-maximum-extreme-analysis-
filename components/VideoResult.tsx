
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef, useMemo, useEffect} from 'react';
import {AspectRatio} from '../types';
import {ArrowPathIcon, DownloadIcon, SparklesIcon, FileImageIcon, PlusIcon, MicIcon, FilmIcon, ClapperboardIcon} from './icons';
// @ts-ignore
import gifshot from 'gifshot';
import { generateSpeech } from '../services/geminiService';
import { muxVideoAndAudio } from '../services/mediaService';
import TimelineEditor from './TimelineEditor';
import { AudioSegment, mixAudioSegments } from '../services/audioMixer';

interface VideoResultProps {
  videoUrl: string;
  onRetry: () => void;
  onNewVideo: () => void;
  onExtend: () => void;
  canExtend: boolean;
  aspectRatio: AspectRatio;
  isImported?: boolean;
  onSaveProject: (segments: AudioSegment[]) => void;
  initialSegments?: AudioSegment[];
}

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl, onRetry, onNewVideo, onExtend, canExtend, aspectRatio, isImported = false, onSaveProject, initialSegments
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const [isExporting, setIsExporting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1280, height: 720 });
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Timeline State
  const [segments, setSegments] = useState<AudioSegment[]>([]);
  const [masterAudioUrl, setMasterAudioUrl] = useState<string | null>(null);
  
  // Muxing State
  const [isMuxing, setIsMuxing] = useState(false);

  // Load initial segments if restored from project
  useEffect(() => {
    if (initialSegments) {
        setSegments(initialSegments);
    }
  }, [initialSegments]);

  // Initialize Video Metadata
  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
    setVideoDimensions({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight });
  };

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

  const handlePreviewSync = async () => {
    if (segments.length === 0) return;
    
    // Check if any segment needs generation
    const needsGeneration = segments.some(s => s.text && !s.blob && !s.isGenerating);
    if (needsGeneration) {
      alert("音声を生成していないクリップがあります。各クリップの「Generate」ボタンを押してください。");
      return;
    }

    try {
      // Use the duration from the video, or max duration of segments
      const mixBlob = await mixAudioSegments(segments, duration || 5);
      
      // Cleanup previous master
      if (masterAudioUrl) URL.revokeObjectURL(masterAudioUrl);

      const url = URL.createObjectURL(mixBlob);
      setMasterAudioUrl(url);
      
      // Auto play
      if (videoRef.current && audioRef.current) {
        videoRef.current.currentTime = 0;
        audioRef.current.src = url;
        // Wait for audio to load slightly
        setTimeout(() => {
             videoRef.current?.play();
             audioRef.current?.play();
        }, 100);
      }
    } catch (e) {
      console.error("Mixing failed", e);
      alert("プレビューの作成に失敗しました");
    }
  };

  const handleMuxAndDownload = async () => {
    if (!videoUrl) return;
    
    // If we haven't mixed yet or segments changed, mix now
    let finalAudioUrl = masterAudioUrl;
    if (!finalAudioUrl && segments.length > 0) {
        try {
            const mixBlob = await mixAudioSegments(segments, duration || 5);
            finalAudioUrl = URL.createObjectURL(mixBlob);
        } catch (e) {
            console.error(e);
            alert("音声合成に失敗しました");
            return;
        }
    }

    if (!finalAudioUrl) {
        // Fallback: If no audio, just download video
        alert("音声トラックがありません。映像のみダウンロードします。");
        const a = document.createElement('a');
        a.href = videoUrl;
        a.download = `veo-video-only-${Date.now()}.mp4`;
        a.click();
        return;
    }

    setIsMuxing(true);
    try {
      const muxedUrl = await muxVideoAndAudio(videoUrl, finalAudioUrl);
      const a = document.createElement('a');
      a.href = muxedUrl;
      a.download = `veo-timeline-export-${Date.now()}.mp4`;
      a.click();
    } catch (e) {
      console.error("Muxing failed", e);
      alert("動画の書き出しに失敗しました。各トラックを個別にダウンロードしてください。");
    } finally {
      setIsMuxing(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 py-8 px-6 bg-[#050505] rounded-[2rem] border border-white/5 shadow-3xl animate-in zoom-in-95 duration-500 max-w-[1400px] mx-auto">
      
      {/* Top Section: Video Preview + Info */}
      <div className="flex flex-col xl:flex-row gap-8 w-full items-start">
         
         {/* Left: Player */}
         <div className="flex-1 w-full flex flex-col items-center gap-4">
            <div className={`relative group w-full bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 aspect-video max-h-[60vh] flex items-center justify-center`}>
              <video
                ref={videoRef}
                src={videoUrl}
                controls={false} // Custom controls via Timeline? Or keep native for now
                className={`max-w-full max-h-full object-contain ${isPortrait ? 'h-full w-auto' : 'w-full h-auto'}`}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => audioRef.current?.play()}
                onPause={() => audioRef.current?.pause()}
                onSeeked={() => {
                  if (audioRef.current && videoRef.current) {
                    audioRef.current.currentTime = videoRef.current.currentTime;
                  }
                }}
              />
              {/* Hidden Master Audio Player */}
              <audio ref={audioRef} className="hidden" />
              
              {/* Overlay Controls (Play/Pause could go here) */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()} 
                   className="bg-white/10 backdrop-blur-md p-6 rounded-full pointer-events-auto hover:bg-white/20 transition-all transform hover:scale-110"
                 >
                    {videoRef.current?.paused ? <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[20px] border-l-white border-b-[10px] border-b-transparent ml-1" /> : <div className="flex gap-2"><div className="w-2 h-6 bg-white"/><div className="w-2 h-6 bg-white"/></div>}
                 </button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-4 w-full justify-center">
                <button onClick={onRetry} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase rounded-xl transition-all border border-white/10">
                   RE-ROLL VIDEO
                </button>
                
                 {/* Video Only Download (New Feature) */}
                 <a 
                   href={videoUrl} 
                   download={`veo-video-raw-${Date.now()}.mp4`}
                   className="px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-bold uppercase rounded-xl transition-all border border-blue-500/20 flex items-center gap-2"
                 >
                   <DownloadIcon className="w-4 h-4" />
                   VIDEO ONLY (MP4)
                </a>

                 <button onClick={() => onSaveProject(segments)} className="px-6 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase rounded-xl transition-all border border-indigo-500/20">
                   SAVE PROJECT
                </button>
                <button onClick={handleMuxAndDownload} disabled={isMuxing} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
                   {isMuxing ? <ArrowPathIcon className="w-4 h-4 animate-spin"/> : <DownloadIcon className="w-4 h-4" />}
                   EXPORT FINAL (MUXED)
                </button>
                <button onClick={onNewVideo} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold uppercase rounded-xl transition-all border border-white/10">
                   NEW PROJECT
                </button>
            </div>
         </div>

         {/* Right (or Bottom on mobile): Timeline Editor */}
         <div className="w-full xl:w-[40%] flex flex-col gap-4">
             <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                   <ClapperboardIcon className="w-4 h-4 text-indigo-400" />
                   Timeline Editor
                </h3>
                <span className="text-[10px] font-mono text-gray-500">NON-LINEAR AUDIO SEQ</span>
             </div>
             
             <TimelineEditor 
                duration={duration} 
                videoWidth={videoDimensions.width}
                videoHeight={videoDimensions.height}
                segments={segments}
                onSegmentsChange={setSegments}
                onPreviewRequest={handlePreviewSync}
             />

             <div className="p-4 bg-white/5 rounded-xl border border-white/5 mt-4">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Editor Tips</h4>
                <ul className="text-[10px] text-gray-500 space-y-1 list-disc list-inside">
                   <li>「Download Icon」で個別の音声クリップを保存できます。</li>
                   <li>「Video Only」で映像だけを救出できます。</li>
                   <li>「Generate」で各クリップの音声を生成後、「Preview Sync」で映像と同期確認できます。</li>
                   <li>Save Project を押すと、現在の動画と音声トラックがIndexedDBに保存され、後でLoad可能です。</li>
                </ul>
             </div>
         </div>

      </div>
    </div>
  );
};

export default VideoResult;
