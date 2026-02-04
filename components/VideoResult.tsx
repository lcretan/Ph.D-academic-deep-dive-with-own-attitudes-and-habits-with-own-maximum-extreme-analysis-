
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useState, useRef, useMemo, useEffect} from 'react';
import {AspectRatio} from '../types';
import {ArrowPathIcon, DownloadIcon, SparklesIcon, FileImageIcon, PlusIcon, MicIcon} from './icons';
// @ts-ignore
import gifshot from 'gifshot';
import { generateSpeech } from '../services/geminiService';

interface VideoResultProps {
  videoUrl: string;
  onRetry: () => void;
  onNewVideo: () => void;
  onExtend: () => void;
  canExtend: boolean;
  aspectRatio: AspectRatio;
}

const VOICES = [
  { name: 'Kore', label: 'Kore (女性・落ち着き)', gender: 'Female' },
  { name: 'Puck', label: 'Puck (女性・少し低め)', gender: 'Female' },
  { name: 'Charon', label: 'Charon (男性・深み)', gender: 'Male' },
  { name: 'Fenrir', label: 'Fenrir (男性・威厳)', gender: 'Male' },
  { name: 'Zephyr', label: 'Zephyr (女性・明るめ)', gender: 'Female' },
];

const VideoResult: React.FC<VideoResultProps> = ({
  videoUrl, onRetry, onNewVideo, onExtend, canExtend, aspectRatio
}) => {
  const isPortrait = aspectRatio === AspectRatio.PORTRAIT;
  const [isExporting, setIsExporting] = useState(false);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Audio/Dubbing State
  const [speechText, setSpeechText] = useState("徹夜したんでしょ。どうしたの？入っていいよ。");
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

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

  const handleGenerateAudio = async () => {
    if (!speechText) return;
    setIsGeneratingAudio(true);
    try {
      const result = await generateSpeech(speechText, selectedVoice);
      setAudioUrl(result.audioUrl);
    } catch (e) {
      console.error("Audio generation failed", e);
      alert("音声の生成に失敗しました。");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const toggleCombinedPlayback = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      if (audioUrl && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      videoRef.current.pause();
      if (audioUrl && audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 py-12 px-6 bg-[#0a0a0b] rounded-[3rem] border border-white/5 shadow-3xl animate-in zoom-in-95 duration-500 max-w-6xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
          <SparklesIcon className="w-3.5 h-3.5" />
          生成完了 (Success)
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic">The Final Cut</h2>
        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">Cinematic Render • Veo 3.1 Pro</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full items-start justify-center">
        {/* Video Player Section */}
        <div className={`relative group ${isPortrait ? 'max-w-xs' : 'w-full max-w-2xl'} shrink-0 bg-black rounded-3xl overflow-hidden shadow-[0_0_80px_-20px_rgba(79,70,229,0.4)] border border-white/10`}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            className="w-full h-full object-contain"
            onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
            onPlay={() => {
              if (audioRef.current && audioUrl) {
                // simple sync attempt when user presses play on video native controls
                if (Math.abs(videoRef.current!.currentTime - audioRef.current.currentTime) > 0.5) {
                   audioRef.current.currentTime = videoRef.current!.currentTime;
                }
                audioRef.current.play();
              }
            }}
            onPause={() => audioRef.current?.pause()}
            onSeeked={() => {
              if (audioRef.current) audioRef.current.currentTime = videoRef.current!.currentTime;
            }}
          />
          <div className="absolute inset-0 border-[16px] border-black/10 pointer-events-none" />
        </div>

        {/* Dubbing Studio Section */}
        <div className="w-full max-w-md bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col gap-4">
           <div className="flex items-center gap-2 mb-2">
             <MicIcon className="w-5 h-5 text-indigo-400" />
             <h3 className="text-sm font-black uppercase tracking-widest text-white">アフレコスタジオ (Dubbing)</h3>
           </div>
           
           <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">セリフ (Script)</label>
              <textarea
                value={speechText}
                onChange={(e) => setSpeechText(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 min-h-[80px]"
                placeholder="ここにセリフを入力..."
              />
           </div>

           <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">声質 (Voice Actor)</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none"
              >
                {VOICES.map(v => (
                  <option key={v.name} value={v.name}>{v.label}</option>
                ))}
              </select>
           </div>

           <button
             onClick={handleGenerateAudio}
             disabled={isGeneratingAudio || !speechText}
             className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
           >
             {isGeneratingAudio ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <MicIcon className="w-4 h-4" />}
             音声生成 (Generate Audio)
           </button>

           {audioUrl && (
             <div className="mt-4 p-4 bg-black/30 rounded-xl border border-indigo-500/30 animate-in slide-in-from-top-2">
                <audio ref={audioRef} src={audioUrl} controls className="w-full h-8 mb-4" />
                <div className="flex gap-2">
                  <button onClick={toggleCombinedPlayback} className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all">
                    ▶ 同時再生プレビュー
                  </button>
                  <a href={audioUrl} download="dubbing.wav" className="px-3 py-2 bg-white/5 hover:bg-white/10 text-indigo-300 text-[10px] font-bold uppercase rounded-lg border border-white/10 flex items-center justify-center">
                    <DownloadIcon className="w-4 h-4" />
                  </a>
                </div>
             </div>
           )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 w-full border-t border-white/5 pt-8">
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
