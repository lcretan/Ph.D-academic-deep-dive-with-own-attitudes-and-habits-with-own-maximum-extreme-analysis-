
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useRef, useState, useMemo} from 'react';
import {
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  Resolution,
  VeoModel,
  VideoFile,
  ProductionControls,
} from '../types';
import {
  ArrowRightIcon,
  ChevronDownIcon,
  FilmIcon,
  FramesModeIcon,
  PlusIcon,
  RectangleStackIcon,
  ReferencesModeIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TextModeIcon,
  TvIcon,
  XMarkIcon,
  ScriptIcon,
  SettingsIcon,
  ArrowPathIcon
} from './icons';

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
}

const aspectRatioDisplayNames: Record<AspectRatio, string> = {
  [AspectRatio.LANDSCAPE]: 'Landscape (16:9)',
  [AspectRatio.PORTRAIT]: 'Portrait (9:16)',
};

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.TEXT_TO_VIDEO]: <TextModeIcon className="w-5 h-5" />,
  [GenerationMode.FRAMES_TO_VIDEO]: <FramesModeIcon className="w-5 h-5" />,
  [GenerationMode.REFERENCES_TO_VIDEO]: <ReferencesModeIcon className="w-5 h-5" />,
  [GenerationMode.EXTEND_VIDEO]: <FilmIcon className="w-5 h-5" />,
};

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: string;
  className?: string;
}> = ({onSelect, onRemove, image, label, className = "w-40 h-28"}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image.file) : null, [image]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => onSelect({ file, base64: (reader.result as string).split(',')[1] });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={`relative group ${className} shrink-0`}>
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="preview" className="w-full h-full object-cover rounded-[2rem] border border-white/10 shadow-2xl" />
          <button type="button" onClick={onRemove} className="absolute -top-1 -right-1 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 z-10"><XMarkIcon className="w-4 h-4" /></button>
        </>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="w-full h-full bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-[2rem] flex flex-col items-center justify-center transition-all group">
          <PlusIcon className="w-6 h-6 text-gray-500 group-hover:text-indigo-400 mb-1" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">{label}</span>
          <input type="file" ref={inputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </button>
      )}
    </div>
  );
};

const PromptForm: React.FC<PromptFormProps> = ({ onGenerate, initialValues }) => {
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [model, setModel] = useState<VeoModel>(initialValues?.model ?? VeoModel.VEO_FAST);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE);
  const [resolution, setResolution] = useState<Resolution>(initialValues?.resolution ?? Resolution.P720);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(initialValues?.mode ?? GenerationMode.FRAMES_TO_VIDEO);
  const [startFrame, setStartFrame] = useState<ImageFile | null>(initialValues?.startFrame ?? null);
  const [endFrame, setEndFrame] = useState<ImageFile | null>(initialValues?.endFrame ?? null);
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping ?? false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);

  // Master Production Controls
  const [controls, setControls] = useState<ProductionControls>({
    anatomyMaster: true,
    anatomyCorrectionIntensity: 10,
    cinematicLighting: true,
    textureDetail: true,
    temporalStability: true,
  });

  const [scriptFields, setScriptFields] = useState({
    start: 'Subject in her private room, suddenly wakes up, alert but disoriented. Casual nightwear.',
    end: 'Subject is crawling and rolling across the bed, intensely deep-diving into academic papers. Serious research posture.',
    action: 'The subject shifts from a startle sit-up to a comfortable rolling prone posture on the bed, thinking deeply.',
    style: 'CINEMATIC. Correct human anatomy: specifically fix right hand/arm if distorted in source.'
  });

  useEffect(() => {
    if (generationMode === GenerationMode.FRAMES_TO_VIDEO) {
      setPrompt(`${scriptFields.start} -> ${scriptFields.end}. Motion: ${scriptFields.action}. Style: ${scriptFields.style}`);
    }
  }, [scriptFields, generationMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      prompt, model, aspectRatio, resolution,
      mode: generationMode, startFrame, endFrame, isLooping, controls
    });
  };

  const ControlToggle = ({ label, active, onClick, icon, color = "indigo" }: { label: string, active: boolean, onClick: () => void, icon: React.ReactNode, color?: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all ${active ? `bg-${color}-600 border-${color}-500 text-white shadow-lg` : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'}`}
    >
      <div className={active ? 'text-white' : 'text-gray-600'}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );

  return (
    <div className="w-full space-y-10">
      {/* Master Control Deck - Prominent Top Position */}
      <div className="w-full bg-[#0a0a0b] border border-white/10 rounded-[3rem] p-6 flex flex-wrap items-center justify-between gap-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] sticky top-6 z-50 backdrop-blur-3xl">
        <div className="flex items-center gap-5">
           <div className="p-3.5 bg-indigo-600 rounded-2xl text-white shadow-xl">
              <SettingsIcon className="w-6 h-6" />
           </div>
           <div>
              <div className="text-[12px] font-black uppercase tracking-[0.4em] text-white">ANATOMY COMMAND CENTER</div>
              <div className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">Active Neural Correction Enabled</div>
           </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <ControlToggle 
            label="Anatomy Master" 
            active={controls.anatomyMaster} 
            onClick={() => setControls(c => ({...c, anatomyMaster: !c.anatomyMaster}))} 
            icon={<XMarkIcon className="w-4 h-4 rotate-45" />}
            color="indigo"
          />
          
          {controls.anatomyMaster && (
            <div className="flex items-center gap-5 bg-white/5 px-6 py-2.5 rounded-full border border-white/10 shadow-inner">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-indigo-300 uppercase tracking-widest mb-1">Override Strength</span>
                <input 
                  type="range" min="1" max="10" 
                  value={controls.anatomyCorrectionIntensity} 
                  onChange={e => setControls(c => ({...c, anatomyCorrectionIntensity: parseInt(e.target.value)}))}
                  className="w-32 h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <div className="bg-indigo-600 text-white text-[12px] font-black px-2.5 py-1 rounded-lg shadow-lg">
                {controls.anatomyCorrectionIntensity}
              </div>
            </div>
          )}

          <ControlToggle 
            label="Cinematic" 
            active={controls.cinematicLighting} 
            onClick={() => setControls(c => ({...c, cinematicLighting: !c.cinematicLighting}))} 
            icon={<SparklesIcon className="w-4 h-4" />}
          />
          
          <ControlToggle 
            label="Temporal" 
            active={controls.temporalStability} 
            onClick={() => setControls(c => ({...c, temporalStability: !c.temporalStability}))} 
            icon={<ArrowPathIcon className="w-4 h-4" />}
          />
        </div>

        <div className="flex items-center gap-6 border-l border-white/10 pl-8">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Resolution</span>
            <select value={resolution} onChange={e => setResolution(e.target.value as Resolution)} className="bg-transparent text-[11px] font-black text-gray-200 uppercase tracking-widest focus:outline-none cursor-pointer">
              <option value={Resolution.P720}>720p HD</option>
              <option value={Resolution.P1080}>1080p Master</option>
            </select>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest mb-1">Engine</span>
            <select value={model} onChange={e => setModel(e.target.value as VeoModel)} className="bg-transparent text-[11px] font-black text-indigo-400 uppercase tracking-widest focus:outline-none cursor-pointer">
              <option value={VeoModel.VEO_FAST}>Fast</option>
              <option value={VeoModel.VEO}>Cinematic</option>
            </select>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="p-10 bg-[#161617] rounded-[3.5rem] border border-white/5 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                 <div>
                    <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-gray-400">Reference A (Start)</h3>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">First Scene Keyframe</p>
                 </div>
                 <ImageUpload label="Initial" image={startFrame} onSelect={setStartFrame} onRemove={() => setStartFrame(null)} />
              </div>
              <textarea 
                value={scriptFields.start}
                onChange={e => setScriptFields(p => ({...p, start: e.target.value}))}
                className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-sm text-gray-300 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none leading-relaxed min-h-[90px] resize-none"
                placeholder="Initial scene context..."
              />
           </div>

           <div className="p-10 bg-[#161617] rounded-[3.5rem] border border-white/5 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                 <div>
                    <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-gray-400">Reference B (End)</h3>
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-1">Final Scene Keyframe</p>
                 </div>
                 {!isLooping ? (
                    <ImageUpload label="Final" image={endFrame} onSelect={setEndFrame} onRemove={() => setEndFrame(null)} />
                 ) : (
                    <div className="w-40 h-28 bg-indigo-500/5 border border-dashed border-indigo-500/20 rounded-[2.5rem] flex items-center justify-center text-indigo-400/50 text-[10px] font-black uppercase tracking-tighter text-center">Seamless Habit Loop</div>
                 )}
              </div>
              <textarea 
                value={scriptFields.end}
                onChange={e => setScriptFields(p => ({...p, end: e.target.value}))}
                className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-sm text-gray-300 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none leading-relaxed min-h-[90px] resize-none"
                placeholder="Final research posture..."
              />
           </div>
        </div>

        <div className="p-12 bg-[#1b1b1c] rounded-[4.5rem] border border-white/5 shadow-3xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-600/[0.03] to-transparent pointer-events-none"></div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <ScriptIcon className="w-6 h-6 text-indigo-500 shadow-sm" />
                    <label className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">HABITUAL MOTION SCRIPT</label>
                 </div>
                 <textarea 
                    value={scriptFields.action} 
                    onChange={e => setScriptFields(p => ({...p, action: e.target.value}))}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-[2rem] p-8 text-[15px] text-gray-100 min-h-[140px] focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed shadow-inner"
                    placeholder="Describe the rolling/habitual motion..."
                 />
              </div>
              <div className="space-y-6">
                 <div className="flex items-center gap-4">
                    <SparklesIcon className="w-6 h-6 text-indigo-500 shadow-sm" />
                    <label className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-400">SKELETAL & ANATOMY RULES</label>
                 </div>
                 <textarea 
                    value={scriptFields.style} 
                    onChange={e => setScriptFields(p => ({...p, style: e.target.value}))}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-[2rem] p-8 text-[15px] text-gray-100 min-h-[140px] focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed shadow-inner"
                    placeholder="Specific rules for arm and hand rendering..."
                 />
              </div>
           </div>

           <div className="mt-16 flex items-center justify-between border-t border-white/10 pt-12">
              <div className="flex items-center gap-10">
                 <div className="flex items-center gap-4 group cursor-pointer">
                    <input type="checkbox" checked={isLooping} onChange={e => setIsLooping(e.target.checked)} className="w-6 h-6 rounded-[0.75rem] bg-white/5 border-white/20 text-indigo-600 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer" id="loop-toggle" />
                    <label htmlFor="loop-toggle" className="text-[11px] font-black text-gray-500 uppercase tracking-widest cursor-pointer group-hover:text-gray-300">Seamless Habit Animation</label>
                 </div>
                 <div className="h-8 w-px bg-white/10"></div>
                 <div className="text-[10px] font-black text-gray-700 uppercase tracking-[0.6em]">VEO 3.1 PRO SYNTHESIS PIPELINE</div>
              </div>

              <button
                type="submit"
                disabled={!startFrame}
                className="group relative px-24 py-6 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-black uppercase tracking-[0.5em] rounded-full shadow-[0_30px_60px_-15px_rgba(79,70,229,0.5)] transition-all transform hover:scale-105 active:scale-95 disabled:opacity-20 disabled:scale-100 disabled:shadow-none overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                EXECUTE PRODUCTION
              </button>
           </div>
        </div>
      </form>
    </div>
  );
};

export default PromptForm;
