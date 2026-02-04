
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { MicIcon, PlusIcon, XMarkIcon, SparklesIcon, ArrowPathIcon, SlidersHorizontalIcon, DownloadIcon } from './icons';
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
  { id: 'Natural', label: '自然 (Natural)' },
  { id: 'Sleepy', label: '眠い (Sleepy)' },
  { id: 'Happy', label: '喜び (Happy)' },
  { id: 'Sad', label: '悲しみ (Sad)' },
  { id: 'Excited', label: '興奮 (Excited)' },
  { id: 'Whisper', label: '囁き (Whisper)' },
  { id: 'Terrified', label: '恐怖 (Terrified)' },
];

const PITCHES = [
  { id: 'Low', label: '低め (Low)' },
  { id: 'Medium', label: '通常 (Medium)' },
  { id: 'High', label: '高め (High)' },
];

const TimelineEditor: React.FC<TimelineEditorProps> = ({
  duration, videoWidth, videoHeight, segments, onSegmentsChange, onPreviewRequest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{ id: string, type: 'move' | 'resize', startX: number, originalValue: number, originalDuration: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Initialize with one empty segment if none exist
  useEffect(() => {
    if (segments.length === 0) {
      addSegment();
    }
  }, []);

  // Global Mouse Events for Dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const pixelsPerSecond = rect.width / (duration || 10);
      const deltaPixels = e.clientX - dragState.startX;
      const deltaSeconds = deltaPixels / pixelsPerSecond;

      if (dragState.type === 'move') {
        const newStartTime = Math.max(0, Math.min(duration - dragState.originalDuration, dragState.originalValue + deltaSeconds));
        updateSegment(dragState.id, { startTime: newStartTime });
      } else if (dragState.type === 'resize') {
        const newDuration = Math.max(0.5, Math.min(duration - dragState.originalValue, dragState.originalDuration + deltaSeconds));
        
        // Calculate recommended speed based on original audio length if available
        const segment = segments.find(s => s.id === dragState.id);
        if (segment && segment.naturalDuration && !segment.isCustomRecording) {
            // If we stretch the clip (longer duration), speed should decrease (slower)
            // If we shrink the clip (shorter duration), speed should increase (faster)
            // speed = natural / target
            const suggestedSpeed = Math.min(2.0, Math.max(0.5, segment.naturalDuration / newDuration));
            updateSegment(dragState.id, { duration: newDuration, speed: suggestedSpeed });
        } else {
            updateSegment(dragState.id, { duration: newDuration });
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, duration, segments]);

  const addSegment = () => {
    const newSegment: AudioSegment = {
      id: crypto.randomUUID(),
      text: '',
      language: 'ja-JP',
      voice: 'Kore',
      style: 'Natural',
      speed: 1.0,
      pitch: 'Medium',
      startTime: segments.length > 0 ? segments[segments.length - 1].startTime + (segments[segments.length - 1].duration || 2) + 0.5 : 0.5,
      duration: 2,
      blob: null,
      url: null,
      isGenerating: false,
      isCustomRecording: false,
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

    updateSegment(id, { isGenerating: true, isCustomRecording: false });
    try {
      const { audioUrl, blob } = await generateSpeech(
        segment.text, 
        segment.voice, 
        segment.style,
        segment.speed,
        segment.pitch,
        segment.language
      );
      
      const tempAudio = new Audio(audioUrl);
      tempAudio.onloadedmetadata = () => {
         // Reset duration to natural duration adjusted by speed if speed was part of generation
         // Note: The generateSpeech function uses the speed prompt, so the resulting audio *is* at that speed.
         // So natural duration at 1.0 would be (duration * speed).
         const generatedDuration = tempAudio.duration;
         const naturalDuration = generatedDuration * segment.speed; 
         
         updateSegment(id, { 
            blob, 
            url: audioUrl, 
            isGenerating: false,
            duration: generatedDuration,
            naturalDuration: naturalDuration 
          });
      };
    } catch (e) {
      console.error(e);
      updateSegment(id, { isGenerating: false });
      alert("音声生成に失敗しました");
    }
  };

  const startRecording = async (id: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' }); // or 'audio/webm' depending on browser
        const audioUrl = URL.createObjectURL(audioBlob);
        const tempAudio = new Audio(audioUrl);
        
        tempAudio.onloadedmetadata = () => {
            updateSegment(id, {
                blob: audioBlob,
                url: audioUrl,
                duration: tempAudio.duration,
                naturalDuration: tempAudio.duration,
                isCustomRecording: true,
                speed: 1.0 // Reset speed for custom recording
            });
        };
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecordingId(id);
    } catch (e) {
      console.error("Microphone access failed", e);
      alert("マイクへのアクセスが拒否されました");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
    }
  };

  const handleSoloPlay = (id: string) => {
    const segment = segments.find(s => s.id === id);
    if (!segment || !segment.url) return;

    if (previewAudioRef.current) {
        previewAudioRef.current.pause();
    }

    const audio = new Audio(segment.url);
    previewAudioRef.current = audio;
    setPlayingId(id);
    audio.play();
    audio.onended = () => setPlayingId(null);
  };

  // Helper to convert time to pixels
  const timeToPct = (time: number) => Math.min(100, (time / (duration || 10)) * 100);
  const durToPct = (dur: number) => Math.min(100, (dur / (duration || 10)) * 100);

  return (
    <div className="w-full bg-[#121214] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
       {/* Timeline Header / Time Ruler */}
       <div className="h-6 bg-[#0a0a0b] border-b border-white/5 flex items-center px-4 relative select-none">
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
                <span className="text-[10px] font-bold text-gray-400">AUDIO</span>
             </div>
             <div className="text-[9px] font-mono text-gray-500 mt-1 space-y-0.5">
                <div>AAC / 44.1kHz</div>
                <div>Mixer: WebAudio</div>
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
          <div className="flex-grow p-4 relative bg-[#050505] flex flex-col">
             
             {/* 1. VISUAL TIMELINE TRACK */}
             <div 
               ref={containerRef}
               className="relative h-12 bg-[#1a1a1c] border border-white/5 rounded-lg mb-6 overflow-hidden select-none"
             >
                {segments.map((seg) => (
                   <div 
                      key={seg.id}
                      onMouseEnter={() => setHoveredId(seg.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseDown={(e) => {
                         e.stopPropagation();
                         setDragState({ id: seg.id, type: 'move', startX: e.clientX, originalValue: seg.startTime, originalDuration: seg.duration });
                      }}
                      className={`absolute top-1 bottom-1 rounded border overflow-hidden cursor-move transition-colors group ${
                         hoveredId === seg.id ? 'z-10 ring-1 ring-white/50' : 'z-0'
                      } ${
                         seg.isCustomRecording ? 'bg-amber-500/30 border-amber-500' : 
                         (seg.blob ? 'bg-indigo-500/40 border-indigo-400' : 'bg-gray-700/30 border-gray-600 dashed')
                      }`}
                      style={{
                        left: `${timeToPct(seg.startTime)}%`,
                        width: `${Math.max(1, durToPct(seg.duration))}%`,
                        minWidth: '4px'
                      }}
                   >
                     {/* Clip Label */}
                     <div className="absolute inset-0 flex items-center px-1 overflow-hidden">
                        <span className="text-[8px] font-mono text-white/80 whitespace-nowrap truncate">{seg.text || 'Untitled'}</span>
                     </div>
                     
                     {/* Resize Handle (Right) */}
                     <div 
                        onMouseDown={(e) => {
                           e.stopPropagation();
                           setDragState({ id: seg.id, type: 'resize', startX: e.clientX, originalValue: seg.startTime, originalDuration: seg.duration });
                        }}
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/50 bg-transparent" 
                     />
                     
                     {seg.isGenerating && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                   </div>
                ))}
                
                {/* Timeline Cursor (Decoration) */}
                <div className="absolute top-0 bottom-0 left-0 w-px bg-red-500/50 pointer-events-none" style={{left: '0%'}} />
             </div>

             {/* 2. CLIP LIST DETAILS EDITOR */}
             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {segments.map((seg, index) => (
                   <div key={seg.id} className={`group relative bg-[#151517] border rounded-xl p-3 transition-colors ${hoveredId === seg.id ? 'border-indigo-500/50 bg-[#1a1a1e]' : 'border-white/5'}`}>
                      <div className="flex items-start gap-4">
                         
                         {/* Controls Column */}
                         <div className="shrink-0 flex flex-col gap-2 pt-1 w-24">
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase block">Start (s)</label>
                                <input 
                                  type="number"
                                  min="0"
                                  max={duration}
                                  step="0.1"
                                  value={seg.startTime.toFixed(2)}
                                  onChange={(e) => updateSegment(seg.id, { startTime: parseFloat(e.target.value) })}
                                  className="w-full bg-black border border-white/10 rounded px-1 text-[10px] text-white focus:border-indigo-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] text-gray-500 font-bold uppercase block">Length (s)</label>
                                <input 
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={seg.duration.toFixed(2)}
                                  onChange={(e) => updateSegment(seg.id, { duration: parseFloat(e.target.value) })}
                                  className="w-full bg-black border border-white/10 rounded px-1 text-[10px] text-white focus:border-indigo-500"
                                />
                            </div>
                         </div>
                         
                         {/* Main Content Column */}
                         <div className="flex-grow space-y-3">
                            <div className="flex gap-2">
                                <select 
                                   value={seg.language}
                                   onChange={(e) => updateSegment(seg.id, { language: e.target.value as any })}
                                   className="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-1"
                                >
                                   <option value="ja-JP">🇯🇵 JP</option>
                                   <option value="en-US">🇺🇸 EN</option>
                                </select>
                                <input 
                                  type="text"
                                  value={seg.text}
                                  onChange={(e) => updateSegment(seg.id, { text: e.target.value })}
                                  placeholder="セリフを入力 / Enter text..."
                                  className="flex-grow bg-black border border-white/10 rounded-lg px-3 py-1 text-xs text-white focus:border-indigo-500/50 focus:outline-none"
                                />
                            </div>
                            
                            {/* Generation & Parameters Row */}
                            <div className="flex flex-wrap items-center gap-2">
                               {!seg.isCustomRecording && (
                                   <>
                                     <select 
                                       value={seg.voice}
                                       onChange={(e) => updateSegment(seg.id, { voice: e.target.value })}
                                       className="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-1 max-w-[80px]"
                                     >
                                        {VOICES.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                     </select>
                                     <select 
                                       value={seg.style}
                                       onChange={(e) => updateSegment(seg.id, { style: e.target.value })}
                                       className="bg-black border border-white/10 text-[10px] text-gray-300 rounded px-2 py-1 max-w-[80px]"
                                     >
                                        {STYLES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                     </select>
                                     
                                     {/* Speed Control with Direct Input */}
                                     <div className="flex items-center bg-black border border-white/10 rounded px-2 py-1">
                                        <span className="text-[9px] text-gray-500 mr-1">SPD:</span>
                                        <input 
                                          type="number"
                                          min="0.5" max="2.0" step="0.1"
                                          value={seg.speed.toFixed(1)}
                                          onChange={(e) => updateSegment(seg.id, { speed: parseFloat(e.target.value) })}
                                          className="w-10 bg-transparent text-[10px] text-white focus:outline-none text-right"
                                        />
                                        <span className="text-[9px] text-gray-500 ml-1">x</span>
                                     </div>
                                   </>
                               )}

                               {/* Action Buttons */}
                               <div className="flex items-center gap-2 ml-auto">
                                   {/* Play Solo */}
                                   <button
                                     onClick={() => handleSoloPlay(seg.id)}
                                     disabled={!seg.url}
                                     className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 disabled:opacity-30"
                                     title="Solo Preview"
                                   >
                                      {playingId === seg.id ? (
                                        <div className="w-3 h-3 flex gap-0.5 justify-center items-center"><div className="w-1 h-3 bg-green-400 animate-pulse"/><div className="w-1 h-3 bg-green-400 animate-pulse delay-75"/></div>
                                      ) : (
                                        <span className="text-[10px]">▶</span>
                                      )}
                                   </button>

                                   {/* Record Custom */}
                                   <button
                                     onClick={() => recordingId === seg.id ? stopRecording() : startRecording(seg.id)}
                                     className={`p-1.5 rounded-md transition-all ${recordingId === seg.id ? 'bg-red-500 text-white animate-pulse' : 'bg-white/5 hover:bg-amber-500/20 text-gray-300 hover:text-amber-400'}`}
                                     title="Record Microphone (My Voice)"
                                   >
                                      <MicIcon className="w-3.5 h-3.5" />
                                   </button>

                                   {/* Generate AI */}
                                   <button 
                                     onClick={() => generateSegmentAudio(seg.id)}
                                     disabled={!seg.text || seg.isGenerating}
                                     className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 transition-all shadow-lg ${seg.blob && !seg.isCustomRecording ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                                   >
                                      {seg.isGenerating ? <ArrowPathIcon className="w-3 h-3 animate-spin"/> : <SparklesIcon className="w-3 h-3"/>}
                                      {seg.blob && !seg.isCustomRecording ? 'Regen' : 'Gen AI'}
                                   </button>
                               </div>
                            </div>
                            
                            {/* Validation / Hints */}
                            {seg.isCustomRecording && (
                                <div className="text-[9px] text-amber-500 flex items-center gap-1">
                                    <MicIcon className="w-3 h-3" />
                                    Custom Voice Recording Active
                                </div>
                            )}
                         </div>

                         <button onClick={() => removeSegment(seg.id)} className="text-gray-600 hover:text-red-400 p-1 self-start">
                            <XMarkIcon className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                ))}
             </div>
             
             {segments.length > 0 && (
                <div className="mt-4 p-2 bg-indigo-900/10 rounded-lg border border-indigo-500/10 text-[9px] text-indigo-300/70 text-center flex justify-between px-4">
                   <span>Tip: タイムライン上のクリップをドラッグして移動、右端をドラッグして長さ（スピード）を変更できます。</span>
                   <span className="font-bold text-amber-400">Banana Shop Integration Active</span>
                </div>
             )}
          </div>
       </div>
    </div>
  );
};

export default TimelineEditor;
