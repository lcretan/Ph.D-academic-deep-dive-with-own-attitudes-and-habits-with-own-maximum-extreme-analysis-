
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { MicIcon, PlusIcon, XMarkIcon, SparklesIcon, ArrowPathIcon } from './icons';
import { generateSpeech } from '../services/geminiService';
import { AudioSegment } from '../services/audioMixer';

interface TimelineEditorProps {
  duration: number; // Video duration in seconds
  videoWidth: number;
  videoHeight: number;
  segments: AudioSegment[];
  onSegmentsChange: (segments: AudioSegment[]) => void;
  onPreviewRequest: () => void;
}

const VOICES = [
  { name: 'Kore', label: 'Kore (女)' },
  { name: 'Puck', label: 'Puck (女低)' },
  { name: 'Zephyr', label: 'Zephyr (女明)' },
  { name: 'Charon', label: 'Charon (男深)' },
  { name: 'Fenrir', label: 'Fenrir (男厳)' },
];

const STYLES = [
  { id: 'Natural', label: '自然' },
  { id: 'Sleepy', label: '眠い' },
  { id: 'Happy', label: '喜び' },
  { id: 'Sad', label: '悲しみ' },
  { id: 'Excited', label: '興奮' },
  { id: 'Whisper', label: '囁き' },
  { id: 'Terrified', label: '恐怖' },
];

const TimelineEditor: React.FC<TimelineEditorProps> = ({
  duration, videoWidth, videoHeight, segments, onSegmentsChange, onPreviewRequest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize with one empty segment if none exist
  useEffect(() => {
    if (segments.length === 0) {
      addSegment();
    }
  }, []);

  const addSegment = () => {
    const newSegment: AudioSegment = {
      id: crypto.randomUUID(),
      text: '',
      voice: 'Kore',
      style: 'Natural',
      startTime: segments.length > 0 ? segments[segments.length - 1].startTime + (segments[segments.length - 1].duration || 2) + 0.5 : 0.5,
      duration: 2, // Estimated initial duration
      blob: null,
      url: null,
      isGenerating: false,
    };
    onSegmentsChange([...segments, newSegment]);
  };

  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
  };

  const updateSegment = (id: string, updates: Partial<AudioSegment>) => {
    onSegmentsChange(segments.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const generateSegmentAudio = async (id: string) => {
    const segment = segments.find(s => s.id === id);
    if (!segment || !segment.text) return;

    updateSegment(id, { isGenerating: true });
    try {
      const { audioUrl, blob } = await generateSpeech(segment.text, segment.voice, segment.style);
      
      // Calculate duration from blob size roughly or use audio element to check (more accurate)
      const tempAudio = new Audio(audioUrl);
      tempAudio.onloadedmetadata = () => {
         updateSegment(id, { 
            blob, 
            url: audioUrl, 
            isGenerating: false,
            duration: tempAudio.duration
          });
      };
    } catch (e) {
      console.error(e);
      updateSegment(id, { isGenerating: false });
      alert("音声生成に失敗しました");
    }
  };

  // Helper to convert time to pixels
  const timeToPct = (time: number) => Math.min(100, (time / (duration || 10)) * 100);
  const durToPct = (dur: number) => Math.min(100, (dur / (duration || 10)) * 100);

  return (
    <div className="w-full bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
       {/* Timeline Header / Time Ruler */}
       <div className="h-6 bg-[#0a0a0b] border-b border-white/5 flex items-center px-4 relative">
          <div className="w-48 shrink-0 text-[9px] font-mono text-gray-600 border-r border-white/5 mr-4">TIMELINE MASTER</div>
          <div className="flex-grow relative h-full">
             {[0, 25, 50, 75, 100].map(p => (
               <div key={p} className="absolute top-0 bottom-0 border-l border-white/5 text-[8px] text-gray-700 pl-1" style={{left: `${p}%`}}>
                 {((duration || 10) * (p/100)).toFixed(1)}s
               </div>
             ))}
          </div>
       </div>

       {/* Video Track (V1) */}
       <div className="flex border-b border-white/5 bg-[#0e0e10]">
          {/* Track Info Header */}
          <div className="w-48 shrink-0 p-4 border-r border-white/5 flex flex-col justify-center gap-1">
             <div className="flex items-center gap-2 text-blue-400">
                <span className="text-[10px] font-black bg-blue-500/10 px-1.5 py-0.5 rounded">V1</span>
                <span className="text-[10px] font-bold text-gray-400">VIDEO</span>
             </div>
             <div className="text-[9px] font-mono text-gray-500 mt-1 space-y-0.5">
                <div>H.264 / MP4</div>
                <div>{videoWidth}x{videoHeight}</div>
                <div>{(duration).toFixed(1)}s (Total)</div>
             </div>
          </div>
          {/* Track Content */}
          <div className="flex-grow p-2 relative min-h-[80px] flex items-center">
             <div className="w-full h-12 bg-blue-900/20 border border-blue-500/30 rounded-lg relative overflow-hidden flex items-center justify-center group">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
                 <span className="text-[10px] font-black tracking-[0.5em] text-blue-400/50 group-hover:text-blue-400 transition-colors z-10">MASTER VIDEO TRACK</span>
             </div>
          </div>
       </div>

       {/* Audio Track (A1) */}
       <div className="flex bg-[#0e0e10] min-h-[200px]">
          {/* Track Info Header */}
          <div className="w-48 shrink-0 p-4 border-r border-white/5 flex flex-col gap-1">
             <div className="flex items-center gap-2 text-indigo-400">
                <span className="text-[10px] font-black bg-indigo-500/10 px-1.5 py-0.5 rounded">A1</span>
                <span className="text-[10px] font-bold text-gray-400">AUDIO (TTS)</span>
             </div>
             <div className="text-[9px] font-mono text-gray-500 mt-1 space-y-0.5">
                <div>AAC / 44.1kHz</div>
                <div>Multi-Segment</div>
                <div>{segments.length} Clips</div>
             </div>
             
             <button 
               onClick={addSegment}
               className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
             >
                <PlusIcon className="w-3 h-3" />
                Add Clip
             </button>

             <button 
               onClick={onPreviewRequest}
               className="mt-2 flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10"
             >
                <ArrowPathIcon className="w-3 h-3" />
                Preview Sync
             </button>
          </div>
          
          {/* Track Content (Segments Editor) */}
          <div className="flex-grow p-4 relative bg-[#050505]">
             {/* Visual Bar Background */}
             <div className="absolute top-0 left-0 right-0 h-8 bg-[#1a1a1c] border-b border-white/5">
                {segments.map((seg) => (
                   <div 
                      key={seg.id}
                      className={`absolute top-1 bottom-1 rounded border overflow-hidden ${seg.blob ? 'bg-indigo-500/40 border-indigo-400' : 'bg-gray-700/30 border-gray-600 dashed'}`}
                      style={{
                        left: `${timeToPct(seg.startTime)}%`,
                        width: `${Math.max(1, durToPct(seg.duration))}%`,
                        minWidth: '4px'
                      }}
                   >
                     {seg.isGenerating && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                   </div>
                ))}
             </div>

             {/* Clip List Editor */}
             <div className="mt-10 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {segments.map((seg, index) => (
                   <div key={seg.id} className="group relative bg-[#151517] border border-white/5 rounded-xl p-3 hover:border-indigo-500/30 transition-colors">
                      <div className="flex items-start gap-3">
                         <div className="shrink-0 flex flex-col gap-2 pt-1">
                            <span className="text-[9px] font-mono text-gray-600">IN: {seg.startTime.toFixed(2)}s</span>
                            <input 
                              type="range" 
                              min="0" 
                              max={duration} 
                              step="0.1" 
                              value={seg.startTime} 
                              onChange={(e) => updateSegment(seg.id, { startTime: parseFloat(e.target.value) })}
                              className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                         </div>
                         
                         <div className="flex-grow space-y-2">
                            <textarea 
                              value={seg.text}
                              onChange={(e) => updateSegment(seg.id, { text: e.target.value })}
                              placeholder="セリフを入力..."
                              className="w-full bg-black border border-white/10 rounded-lg p-2 text-xs text-white focus:border-indigo-500/50 focus:outline-none min-h-[40px]"
                            />
                            <div className="flex flex-wrap gap-2">
                               <select 
                                 value={seg.voice}
                                 onChange={(e) => updateSegment(seg.id, { voice: e.target.value })}
                                 className="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-1"
                               >
                                  {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                               </select>
                               <select 
                                 value={seg.style}
                                 onChange={(e) => updateSegment(seg.id, { style: e.target.value })}
                                 className="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-1"
                               >
                                  {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                               </select>
                               <button 
                                 onClick={() => generateSegmentAudio(seg.id)}
                                 disabled={!seg.text || seg.isGenerating}
                                 className={`px-3 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 transition-all ${seg.blob ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-indigo-600 text-white'}`}
                               >
                                  {seg.isGenerating ? <ArrowPathIcon className="w-3 h-3 animate-spin"/> : (seg.blob ? <SparklesIcon className="w-3 h-3"/> : <MicIcon className="w-3 h-3"/>)}
                                  {seg.blob ? 'Regenerate' : 'Generate'}
                               </button>
                            </div>
                         </div>

                         <button onClick={() => removeSegment(seg.id)} className="text-gray-600 hover:text-red-400 p-1">
                            <XMarkIcon className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
};

export default TimelineEditor;
