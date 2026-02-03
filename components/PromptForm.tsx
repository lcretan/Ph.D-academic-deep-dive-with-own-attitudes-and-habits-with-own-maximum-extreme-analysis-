
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
} from './icons';

// Fixed missing PromptFormProps interface error
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

const fileToImageFile = (file: File): Promise<ImageFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ file, base64: (reader.result as string).split(',')[1] });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({label, value, onChange, icon, children, disabled = false}) => (
  <div>
    <label className={`text-[10px] uppercase tracking-widest block mb-2 font-bold ${disabled ? 'text-gray-600' : 'text-gray-500'}`}>
      {label}
    </label>
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none transition-colors group-hover:text-indigo-400">
        {icon}
      </div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full bg-[#1a1a1b] border border-gray-700/50 rounded-xl pl-10 pr-8 py-3 appearance-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all disabled:opacity-50 text-sm font-medium text-gray-200">
        {children}
      </select>
      <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600" />
    </div>
  </div>
);

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: string;
  className?: string;
}> = ({onSelect, onRemove, image, label, className = "w-32 h-24"}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => image ? URL.createObjectURL(image.file) : null, [image]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const img = await fileToImageFile(file);
        onSelect(img);
      } catch (err) { console.error(err); }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={`relative group ${className} shrink-0`}>
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="preview" className="w-full h-full object-cover rounded-xl border border-white/10 shadow-lg" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
          >
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-full bg-white/5 hover:bg-white/10 border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl flex flex-col items-center justify-center transition-all group"
        >
          <PlusIcon className="w-6 h-6 text-gray-500 group-hover:text-indigo-400 mb-1" />
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600 group-hover:text-gray-300">{label}</span>
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
  const [generationMode, setGenerationMode] = useState<GenerationMode>(initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO);
  
  const [startFrame, setStartFrame] = useState<ImageFile | null>(initialValues?.startFrame ?? null);
  const [endFrame, setEndFrame] = useState<ImageFile | null>(initialValues?.endFrame ?? null);
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(initialValues?.referenceImages ?? []);
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping ?? false);

  const [isScriptMode, setIsScriptMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);

  const [scriptFields, setScriptFields] = useState({
    start: 'Subject suddenly wakes up in her private room, casual nightwear, slightly disoriented but attentive.',
    end: 'Subject is crawling/rolling on bed, intensely deep-diving into academic findings, focused and productive.',
    motion: 'The subject shifts from a sitting wake-up position to a prone, casual thinking posture on the bed.',
    style: 'Highly correct female anatomy, professional hand and arm forms, maintaining character consistency, cinematic lighting.'
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  // Auto-update prompt from script fields when in script mode
  useEffect(() => {
    if (isScriptMode && generationMode === GenerationMode.FRAMES_TO_VIDEO) {
      const p = [
        `Initial state: ${scriptFields.start}`,
        `Final state: ${scriptFields.end}`,
        `Action: ${scriptFields.motion}`,
        `Directives: ${scriptFields.style}`
      ].join('. ');
      setPrompt(p);
    }
  }, [scriptFields, isScriptMode, generationMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      prompt, model, aspectRatio, resolution,
      mode: generationMode, startFrame, endFrame, referenceImages, isLooping
    });
  };

  const isSubmitDisabled = useMemo(() => {
    if (generationMode === GenerationMode.TEXT_TO_VIDEO) return !prompt.trim();
    if (generationMode === GenerationMode.FRAMES_TO_VIDEO) return !startFrame;
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) return referenceImages.length === 0;
    return false;
  }, [prompt, generationMode, startFrame, referenceImages]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className="mb-6 p-6 bg-[#1a1a1c] border border-white/10 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <CustomSelect label="Production Engine" value={model} onChange={(e) => setModel(e.target.value as VeoModel)} icon={<SparklesIcon className="w-5 h-5 text-indigo-400" />}>
              <option value={VeoModel.VEO_FAST}>Fast Generation (Preview)</option>
              <option value={VeoModel.VEO}>Cinematic Master (High Fidelity)</option>
            </CustomSelect>
            <CustomSelect label="Frame Aspect" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} icon={<RectangleStackIcon className="w-5 h-5 text-indigo-400" />}>
              {Object.entries(aspectRatioDisplayNames).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </CustomSelect>
            <CustomSelect label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)} icon={<TvIcon className="w-5 h-5 text-indigo-400" />}>
              <option value={Resolution.P720}>720p HD</option>
              <option value={Resolution.P1080}>1080p Full HD</option>
            </CustomSelect>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 block">Visual Presets</label>
            <div className="flex flex-wrap gap-2">
              {[
                { l: 'Correct Anatomy', d: 'Correct female anatomy, professional hand/limb forms, realistic proportions' },
                { l: 'Cinematic Lighting', d: 'Moody cinematic lighting, soft shadows, professional color grading' },
                { l: 'Consistent Character', d: 'Maintain character identity and clothing perfectly across all frames' }
              ].map(p => (
                <button
                  key={p.l}
                  type="button"
                  onClick={() => setPrompt(prev => prev ? `${prev}. ${p.d}` : p.d)}
                  className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-xl border border-indigo-500/20 transition-all"
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Media Zone */}
        {generationMode === GenerationMode.FRAMES_TO_VIDEO && (
          <div className="p-6 bg-[#1a1a1c]/80 backdrop-blur-xl border border-white/5 rounded-3xl flex flex-col items-center gap-6 shadow-xl">
            <div className="flex items-center gap-12">
              <div className="text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">Scene A (Start)</p>
                <ImageUpload label="Wake Up" image={startFrame} onSelect={setStartFrame} onRemove={() => setStartFrame(null)} />
              </div>
              <div className="w-12 h-px bg-white/10 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500/20 p-1.5 rounded-full">
                  <ArrowRightIcon className="w-3 h-3 text-indigo-400" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3">Scene B (End)</p>
                {!isLooping ? (
                   <ImageUpload label="Deep Dive" image={endFrame} onSelect={setEndFrame} onRemove={() => setEndFrame(null)} />
                ) : (
                   <div className="w-32 h-24 bg-indigo-500/5 border border-dashed border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400/50 text-[9px] font-black uppercase tracking-tighter text-center px-4">Seamless Loop Back</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={isLooping} onChange={e => setIsLooping(e.target.checked)} className="w-4 h-4 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-0 focus:ring-offset-0" />
                <span className="text-xs font-bold text-gray-500 group-hover:text-gray-300 transition-colors uppercase tracking-widest">Seamless Motion</span>
              </label>
              <button
                type="button"
                onClick={() => setIsScriptMode(!isScriptMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isScriptMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 text-gray-500 hover:text-white border border-white/5'}`}
              >
                <ScriptIcon className="w-3.5 h-3.5" />
                {isScriptMode ? 'Scripting Active' : 'Enter Script Mode'}
              </button>
            </div>
          </div>
        )}

        {/* Prompt Input Zone */}
        <div className="relative">
          {isScriptMode && generationMode === GenerationMode.FRAMES_TO_VIDEO ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-3">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2">Scene A Narrative</label>
                   <textarea value={scriptFields.start} onChange={e => setScriptFields(p => ({...p, start: e.target.value}))} className="w-full bg-[#161617] border border-white/5 rounded-2xl p-4 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[70px] resize-none" />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2">Scene B Narrative</label>
                   <textarea value={scriptFields.end} onChange={e => setScriptFields(p => ({...p, end: e.target.value}))} className="w-full bg-[#161617] border border-white/5 rounded-2xl p-4 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[70px] resize-none" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2">Action/Motion Description</label>
                   <textarea value={scriptFields.motion} onChange={e => setScriptFields(p => ({...p, motion: e.target.value}))} className="w-full bg-[#161617] border border-white/5 rounded-2xl p-4 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[70px] resize-none" />
                </div>
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase tracking-widest text-gray-600 ml-2">Visual Constraints (Anatomy/Style)</label>
                   <textarea value={scriptFields.style} onChange={e => setScriptFields(p => ({...p, style: e.target.value}))} className="w-full bg-[#161617] border border-white/5 rounded-2xl p-4 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 min-h-[70px] resize-none" />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1b1b1c] border border-white/5 rounded-[2.5rem] p-3 flex items-end gap-3 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/30 transition-all">
              <div className="relative shrink-0" ref={modeSelectorRef}>
                <button
                  type="button"
                  onClick={() => setIsModeSelectorOpen(!isModeSelectorOpen)}
                  className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all group"
                >
                  {modeIcons[generationMode]}
                  <span className="text-[10px] font-black uppercase tracking-widest">{generationMode}</span>
                  <ChevronDownIcon className="w-3.5 h-3.5 opacity-50" />
                </button>
                {isModeSelectorOpen && (
                  <div className="absolute bottom-full mb-4 w-64 bg-[#1a1a1b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30">
                    {[GenerationMode.TEXT_TO_VIDEO, GenerationMode.FRAMES_TO_VIDEO, GenerationMode.REFERENCES_TO_VIDEO].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => { setGenerationMode(m); setIsModeSelectorOpen(false); setIsScriptMode(false); }}
                        className={`w-full flex items-center gap-3 p-4 hover:bg-white/5 text-sm font-bold ${generationMode === m ? 'text-indigo-400 bg-indigo-500/5' : 'text-gray-500'}`}
                      >
                        {modeIcons[m]}
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your cinematic production..."
                className="flex-grow bg-transparent border-none focus:ring-0 text-[15px] font-medium text-gray-200 placeholder-gray-600 py-3.5 max-h-48 resize-none"
                rows={1}
              />

              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-4 rounded-full transition-all ${isSettingsOpen ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-gray-400 hover:text-white'}`}
              >
                <SlidersHorizontalIcon className="w-5 h-5" />
              </button>

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="p-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-700 text-white rounded-full shadow-lg shadow-indigo-600/20 transition-all transform active:scale-90"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {isScriptMode && (
          <div className="flex justify-center pt-2">
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-full shadow-2xl shadow-indigo-600/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              Master Render Production
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default PromptForm;
