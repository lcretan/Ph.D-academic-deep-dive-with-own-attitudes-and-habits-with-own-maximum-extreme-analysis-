
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useRef, useState} from 'react';
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

const aspectRatioDisplayNames: Record<AspectRatio, string> = {
  [AspectRatio.LANDSCAPE]: 'Landscape (16:9)',
  [AspectRatio.PORTRAIT]: 'Portrait (9:16)',
};

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  [GenerationMode.TEXT_TO_VIDEO]: <TextModeIcon className="w-5 h-5" />,
  [GenerationMode.FRAMES_TO_VIDEO]: <FramesModeIcon className="w-5 h-5" />,
  [GenerationMode.REFERENCES_TO_VIDEO]: (
    <ReferencesModeIcon className="w-5 h-5" />
  ),
  [GenerationMode.EXTEND_VIDEO]: <FilmIcon className="w-5 h-5" />,
};

const fileToBase64 = <T extends {file: File; base64: string}>(
  file: File,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (base64) {
        resolve({file, base64} as T);
      } else {
        reject(new Error('Failed to read file as base64.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};
const fileToImageFile = (file: File): Promise<ImageFile> =>
  fileToBase64<ImageFile>(file);
const fileToVideoFile = (file: File): Promise<VideoFile> =>
  fileToBase64<VideoFile>(file);

const CustomSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({label, value, onChange, icon, children, disabled = false}) => (
  <div>
    <label
      className={`text-xs block mb-1.5 font-medium ${
        disabled ? 'text-gray-500' : 'text-gray-400'
      }`}>
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        {icon}
      </div>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="w-full bg-[#1f1f1f] border border-gray-600 rounded-lg pl-10 pr-8 py-2.5 appearance-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-700/50 disabled:border-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed">
        {children}
      </select>
      <ChevronDownIcon
        className={`w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
          disabled ? 'text-gray-600' : 'text-gray-400'
        }`}
      />
    </div>
  </div>
);

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: React.ReactNode;
  className?: string;
}> = ({onSelect, onRemove, image, label, className = "w-28 h-20"}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageFile = await fileToImageFile(file);
        onSelect(imageFile);
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  if (image) {
    return (
      <div className={`relative group ${className}`}>
        <img
          src={URL.createObjectURL(image.file)}
          alt="preview"
          className="w-full h-full object-cover rounded-lg shadow-inner border border-gray-600"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove image">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`${className} bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors`}>
      <PlusIcon className="w-6 h-6" />
      <span className="text-xs mt-1 text-center px-1">{label}</span>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
    </button>
  );
};

const VideoUpload: React.FC<{
  onSelect: (video: VideoFile) => void;
  onRemove?: () => void;
  video?: VideoFile | null;
  label: React.ReactNode;
}> = ({onSelect, onRemove, video, label}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const videoFile = await fileToVideoFile(file);
        onSelect(videoFile);
      } catch (error) {
        console.error('Error converting file:', error);
      }
    }
  };

  if (video) {
    return (
      <div className="relative w-48 h-28 group">
        <video
          src={URL.createObjectURL(video.file)}
          muted
          loop
          className="w-full h-full object-cover rounded-lg shadow-inner"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove video">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className="w-48 h-28 bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:text-white transition-colors text-center">
      <PlusIcon className="w-6 h-6" />
      <span className="text-xs mt-1 px-2">{label}</span>
      <input
        type="file"
        ref={inputRef}
        onChange={handleFileChange}
        accept="video/*"
        className="hidden"
      />
    </button>
  );
};

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
}

const PromptForm: React.FC<PromptFormProps> = ({
  onGenerate,
  initialValues,
}) => {
  const [prompt, setPrompt] = useState(initialValues?.prompt ?? '');
  const [model, setModel] = useState<VeoModel>(
    initialValues?.model ?? VeoModel.VEO_FAST,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    initialValues?.aspectRatio ?? AspectRatio.LANDSCAPE,
  );
  const [resolution, setResolution] = useState<Resolution>(
    initialValues?.resolution ?? Resolution.P720,
  );
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    initialValues?.mode ?? GenerationMode.TEXT_TO_VIDEO,
  );
  const [startFrame, setStartFrame] = useState<ImageFile | null>(
    initialValues?.startFrame ?? null,
  );
  const [endFrame, setEndFrame] = useState<ImageFile | null>(
    initialValues?.endFrame ?? null,
  );
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(
    initialValues?.referenceImages ?? [],
  );
  const [styleImage, setStyleImage] = useState<ImageFile | null>(
    initialValues?.styleImage ?? null,
  );
  const [inputVideo, setInputVideo] = useState<VideoFile | null>(
    initialValues?.inputVideo ?? null,
  );
  const [inputVideoObject, setInputVideoObject] = useState<Video | null>(
    initialValues?.inputVideoObject ?? null,
  );
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping ?? false);

  // Script Mode state
  const [isScriptMode, setIsScriptMode] = useState(false);
  const [scriptFields, setScriptFields] = useState({
    start: '',
    end: '',
    action: '',
    style: '',
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modeSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialValues) {
      setPrompt(initialValues.prompt ?? '');
      setModel(initialValues.model ?? VeoModel.VEO_FAST);
      setAspectRatio(initialValues.aspectRatio ?? AspectRatio.LANDSCAPE);
      setResolution(initialValues.resolution ?? Resolution.P720);
      setGenerationMode(initialValues.mode ?? GenerationMode.TEXT_TO_VIDEO);
      setStartFrame(initialValues.startFrame ?? null);
      setEndFrame(initialValues.endFrame ?? null);
      setReferenceImages(initialValues.referenceImages ?? []);
      setStyleImage(initialValues.styleImage ?? null);
      setInputVideo(initialValues.inputVideo ?? null);
      setInputVideoObject(initialValues.inputVideoObject ?? null);
      setIsLooping(initialValues.isLooping ?? false);
    }
  }, [initialValues]);

  // Sync script fields with prompt string
  useEffect(() => {
    if (isScriptMode) {
      let combined = '';
      if (scriptFields.start) combined += `First picture is ${scriptFields.start}.\n`;
      if (scriptFields.end) combined += `Last picture is ${scriptFields.end}.\n`;
      if (scriptFields.action) combined += `Please draw the motion: ${scriptFields.action}.\n`;
      if (scriptFields.style) combined += `Directives: ${scriptFields.style}`;
      setPrompt(combined.trim());
    }
  }, [scriptFields, isScriptMode]);

  useEffect(() => {
    // Rule: Extension strictly only works in 720p
    if (generationMode === GenerationMode.EXTEND_VIDEO) {
      setResolution(Resolution.P720);
    }
  }, [generationMode]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [prompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeSelectorRef.current &&
        !modeSelectorRef.current.contains(event.target as Node)
      ) {
        setIsModeSelectorOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onGenerate({
        prompt,
        model,
        aspectRatio,
        resolution,
        mode: generationMode,
        startFrame,
        endFrame,
        referenceImages,
        styleImage,
        inputVideo,
        inputVideoObject,
        isLooping,
      });
    },
    [
      prompt,
      model,
      aspectRatio,
      resolution,
      generationMode,
      startFrame,
      endFrame,
      referenceImages,
      styleImage,
      inputVideo,
      inputVideoObject,
      onGenerate,
      isLooping,
    ],
  );

  const handleSelectMode = (mode: GenerationMode) => {
    setGenerationMode(mode);
    setIsModeSelectorOpen(false);
    setStartFrame(null);
    setEndFrame(null);
    setReferenceImages([]);
    setStyleImage(null);
    setInputVideo(null);
    setInputVideoObject(null);
    setIsLooping(false);
    // Auto-enable script mode for complex transitions if it feels right
    if (mode === GenerationMode.FRAMES_TO_VIDEO) {
      // Keep state but allow manual toggle
    } else {
      setIsScriptMode(false);
    }
  };

  const handleApplyPreset = (directive: string) => {
    setScriptFields(prev => ({
      ...prev,
      style: prev.style ? `${prev.style}, ${directive}` : directive
    }));
    if (!isScriptMode) {
      setPrompt(prev => prev ? `${prev}. ${directive}` : directive);
    }
  };

  const promptPlaceholder = {
    [GenerationMode.TEXT_TO_VIDEO]: 'Describe the video you want to create...',
    [GenerationMode.FRAMES_TO_VIDEO]:
      'Describe motion between start and end frames...',
    [GenerationMode.REFERENCES_TO_VIDEO]:
      'Describe a video using reference images...',
    [GenerationMode.EXTEND_VIDEO]: 'Describe what happens next (optional)...',
  }[generationMode];

  const selectableModes = [
    GenerationMode.TEXT_TO_VIDEO,
    GenerationMode.FRAMES_TO_VIDEO,
    GenerationMode.REFERENCES_TO_VIDEO,
  ];

  const renderMediaUploads = () => {
    if (generationMode === GenerationMode.FRAMES_TO_VIDEO) {
      return (
        <div className="mb-3 p-4 bg-[#2c2c2e]/80 backdrop-blur-sm rounded-xl border border-gray-700/50 flex flex-col items-center justify-center gap-4 shadow-xl">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Keyframe A</label>
              <ImageUpload
                label="Start Frame"
                image={startFrame}
                onSelect={setStartFrame}
                onRemove={() => {
                  setStartFrame(null);
                  setIsLooping(false);
                }}
              />
            </div>
            <div className="w-8 h-[2px] bg-gray-700/50 mt-6 relative after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-2 after:h-2 after:border-t-2 after:border-r-2 after:border-gray-600 after:rotate-45"></div>
            <div className="text-center">
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Keyframe B</label>
              {!isLooping ? (
                <ImageUpload
                  label="End Frame"
                  image={endFrame}
                  onSelect={setEndFrame}
                  onRemove={() => setEndFrame(null)}
                />
              ) : (
                <div className="w-28 h-20 bg-indigo-900/20 border border-indigo-500/30 rounded-lg flex items-center justify-center text-indigo-400 text-[10px] font-bold uppercase tracking-tighter text-center px-2">
                  Looping back to Start
                </div>
              )}
            </div>
          </div>
          {startFrame && (
            <div className="mt-1 flex items-center gap-4">
              <div className="flex items-center">
                <input
                  id="loop-video-checkbox"
                  type="checkbox"
                  checked={isLooping}
                  onChange={(e) => setIsLooping(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800 cursor-pointer"
                />
                <label
                  htmlFor="loop-video-checkbox"
                  className="ml-2 text-xs font-medium text-gray-400 cursor-pointer">
                  Seamless Loop
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIsScriptMode(!isScriptMode)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${isScriptMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
              >
                <ScriptIcon className="w-3 h-3" />
                {isScriptMode ? 'Script Active' : 'Enable Script Mode'}
              </button>
            </div>
          )}
        </div>
      );
    }
    if (generationMode === GenerationMode.REFERENCES_TO_VIDEO) {
      return (
        <div className="mb-3 p-4 bg-[#2c2c2e]/80 backdrop-blur-sm rounded-xl border border-gray-700/50 flex flex-col items-center gap-5 shadow-xl">
          <div className="w-full">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] block mb-3 text-center">
              Content References ({referenceImages.length}/3)
            </label>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {referenceImages.map((img, index) => (
                <ImageUpload
                  key={index}
                  image={img}
                  label=""
                  onSelect={() => {}}
                  onRemove={() =>
                    setReferenceImages((imgs) => imgs.filter((_, i) => i !== index))
                  }
                />
              ))}
              {referenceImages.length < 3 && (
                <ImageUpload
                  label="Add Asset"
                  onSelect={(img) => setReferenceImages((imgs) => [...imgs, img])}
                />
              )}
            </div>
          </div>
        </div>
      );
    }
    if (generationMode === GenerationMode.EXTEND_VIDEO) {
      return (
        <div className="mb-3 p-4 bg-[#2c2c2e]/80 backdrop-blur-sm rounded-xl border border-gray-700/50 flex items-center justify-center gap-4 shadow-xl">
          <VideoUpload
            label={
              <>
                Target Video
                <br />
                <span className="opacity-50 text-[10px]">(Original Segment)</span>
              </>
            }
            video={inputVideo}
            onSelect={setInputVideo}
            onRemove={() => {
              setInputVideo(null);
              setInputVideoObject(null);
            }}
          />
        </div>
      );
    }
    return null;
  };

  const isSubmitDisabled = 
    (generationMode === GenerationMode.TEXT_TO_VIDEO && !prompt.trim()) ||
    (generationMode === GenerationMode.FRAMES_TO_VIDEO && !startFrame) ||
    (generationMode === GenerationMode.REFERENCES_TO_VIDEO && (!prompt.trim() || referenceImages.length === 0)) ||
    (generationMode === GenerationMode.EXTEND_VIDEO && !inputVideoObject);

  const tooltipText = isSubmitDisabled ? (
    generationMode === GenerationMode.TEXT_TO_VIDEO ? 'Describe the scene' :
    generationMode === GenerationMode.FRAMES_TO_VIDEO ? 'Upload a start frame' :
    generationMode === GenerationMode.REFERENCES_TO_VIDEO ? 'Add references and prompt' :
    'Load original video'
  ) : '';

  return (
    <div className="relative w-full">
      {isSettingsOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-3 p-5 bg-[#222224] rounded-2xl border border-gray-700/50 shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <CustomSelect
              label="Intelligence Engine"
              value={model}
              onChange={(e) => setModel(e.target.value as VeoModel)}
              icon={<SparklesIcon className="w-5 h-5 text-indigo-400" />}>
              <option value={VeoModel.VEO_FAST}>Fast Generation</option>
              <option value={VeoModel.VEO}>Cinematic Master (3.1)</option>
            </CustomSelect>
            <CustomSelect
              label="Format"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
              icon={<RectangleStackIcon className="w-5 h-5 text-indigo-400" />}>
              {Object.entries(aspectRatioDisplayNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </CustomSelect>
            <CustomSelect
              label="Output Resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as Resolution)}
              icon={<TvIcon className="w-5 h-5 text-indigo-400" />}
              disabled={generationMode === GenerationMode.EXTEND_VIDEO}>
              <option value={Resolution.P720}>720p Optimized</option>
              <option value={Resolution.P1080}>1080p Full HD</option>
              <option value={Resolution.P4K}>4K Ultra HD</option>
            </CustomSelect>
          </div>

          <div className="border-t border-gray-800 pt-5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 block">Director's Enhancements</label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Anatomy Correction', text: 'Correct anatomy and forms, especially hands and limbs to professional artistic standards' },
                { label: 'Cinematic 8K', text: 'Stunning cinematic lighting, highly detailed textures, 8k professional resolution' },
                { label: 'Consistent Style', text: 'Maintain perfect stylistic and character consistency across frames' },
                { label: 'Fluid Motion', text: 'Natural, realistic movement with high temporal coherence' }
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyPreset(preset.text)}
                  className="px-3 py-1.5 bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-300 text-[11px] font-medium rounded-lg border border-indigo-500/20 transition-all active:scale-95"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full">
        {renderMediaUploads()}
        
        {isScriptMode && generationMode === GenerationMode.FRAMES_TO_VIDEO ? (
          <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Scene A Context</label>
              <textarea
                value={scriptFields.start}
                onChange={(e) => setScriptFields(p => ({...p, start: e.target.value}))}
                placeholder="Initial status/pose..."
                className="bg-[#1a1a1b] border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] resize-none"
              />
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Scene B Context</label>
              <textarea
                value={scriptFields.end}
                onChange={(e) => setScriptFields(p => ({...p, end: e.target.value}))}
                placeholder="Final status/pose..."
                className="bg-[#1a1a1b] border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Directed Motion</label>
              <textarea
                value={scriptFields.action}
                onChange={(e) => setScriptFields(p => ({...p, action: e.target.value}))}
                placeholder="Describe the movement between frames..."
                className="bg-[#1a1a1b] border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] resize-none"
              />
              <label className="text-[10px] font-bold text-gray-500 uppercase ml-2">Directives & Style</label>
              <textarea
                value={scriptFields.style}
                onChange={(e) => setScriptFields(p => ({...p, style: e.target.value}))}
                placeholder="Anatomy fixes, lighting, clothing rules..."
                className="bg-[#1a1a1b] border border-gray-700/50 rounded-xl p-3 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 min-h-[80px] resize-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-[#1b1b1c] border border-gray-700/50 rounded-[2rem] p-2.5 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
            <div className="relative" ref={modeSelectorRef}>
              <button
                type="button"
                onClick={() => setIsModeSelectorOpen((prev) => !prev)}
                className="flex shrink-0 items-center gap-2 px-4 py-3 rounded-full hover:bg-white/5 text-gray-400 hover:text-white transition-all active:scale-95"
              >
                {modeIcons[generationMode]}
                <span className="font-bold text-xs uppercase tracking-widest whitespace-nowrap">
                  {generationMode}
                </span>
                <ChevronDownIcon className="w-3 h-3 opacity-50" />
              </button>
              {isModeSelectorOpen && (
                <div className="absolute bottom-full mb-4 w-60 bg-[#222224] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-30 animate-in fade-in zoom-in-95 duration-100">
                  {selectableModes.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleSelectMode(mode)}
                      className={`w-full text-left flex items-center gap-3 p-4 hover:bg-white/5 transition-colors ${generationMode === mode ? 'bg-indigo-600/10 text-indigo-400' : 'text-gray-400'}`}>
                      {modeIcons[mode]}
                      <span className="font-medium text-sm">{mode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={promptPlaceholder}
              className="flex-grow bg-transparent focus:outline-none resize-none text-[15px] leading-relaxed text-gray-100 placeholder-gray-600 max-h-48 py-3 px-2 font-medium"
              rows={1}
            />

            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`p-3.5 rounded-full transition-all active:scale-90 ${isSettingsOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white/5 text-gray-400 hover:text-white'}`}
              title="Studio Settings"
            >
              <SlidersHorizontalIcon className="w-5 h-5" />
            </button>

            <div className="relative group">
              <button
                type="submit"
                className="p-3.5 bg-indigo-600 rounded-full hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 shadow-lg shadow-indigo-600/10 transition-all active:scale-90"
                disabled={isSubmitDisabled}
              >
                <ArrowRightIcon className="w-5 h-5 text-white" />
              </button>
              {isSubmitDisabled && tooltipText && (
                <div className="absolute bottom-full right-0 mb-3 px-3 py-1.5 bg-gray-900 border border-gray-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                  {tooltipText}
                </div>
              )}
            </div>
          </div>
        )}

        {isScriptMode && generationMode === GenerationMode.FRAMES_TO_VIDEO && (
           <div className="flex items-center justify-between mt-3 px-4">
             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <ScriptIcon className="w-3 h-3" />
                Script Mode: Structured Storytelling
             </div>
             <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsScriptMode(false)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-red-400 transition-colors"
                >
                  Disable Script
                </button>
                <button
                  type="submit"
                  disabled={isSubmitDisabled}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white disabled:opacity-50"
                >
                  Generate Production
                </button>
             </div>
           </div>
        )}

        <div className="mt-4 flex flex-col items-center">
           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
             <TvIcon className="w-2.5 h-2.5" />
             AI Video Production Studio Powered by Veo 3.1
           </p>
        </div>
      </form>
    </div>
  );
};

export default PromptForm;
