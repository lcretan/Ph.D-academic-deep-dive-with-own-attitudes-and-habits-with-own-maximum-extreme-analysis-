
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, {useRef, useState, useMemo, useEffect} from 'react';
import {
  AspectRatio,
  GenerateVideoParams,
  GenerationMode,
  ImageFile,
  Resolution,
  VeoModel,
  ProductionControls,
} from '../types';
import {
  ArrowRightIcon,
  FramesModeIcon,
  PlusIcon,
  ReferencesModeIcon,
  TextModeIcon,
  XMarkIcon,
  ScriptIcon,
  SettingsIcon,
  ArrowPathIcon,
  MicIcon,
  MicOffIcon,
  MagicWandIcon,
  PaletteIcon,
  FileImageIcon
} from './icons';
import { optimizePromptForVeo, generateStoryboardImage } from '../services/geminiService';

interface PromptFormProps {
  onGenerate: (params: GenerateVideoParams) => void;
  initialValues?: GenerateVideoParams | null;
}

const ImageUpload: React.FC<{
  onSelect: (image: ImageFile) => void;
  onRemove?: () => void;
  image?: ImageFile | null;
  label: string;
  className?: string;
}> = ({onSelect, onRemove, image, label, className = "w-44 h-32"}) => {
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
          <img src={previewUrl} alt="preview" className="w-full h-full object-cover rounded-[2.5rem] border border-white/10 shadow-2xl transition-transform group-hover:scale-[1.02]" />
          <button type="button" onClick={onRemove} className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-full border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-2 hover:border-white/20 hover:bg-white/5 transition-all group"
        >
          <PlusIcon className="w-6 h-6 text-gray-500 group-hover:text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};

const PromptForm: React.FC<PromptFormProps> = ({ onGenerate, initialValues }) => {
  // Default prompt changed to Japanese to demonstrate UTF-8 support
  const [prompt, setPrompt] = useState(initialValues?.prompt || '');
  const [model, setModel] = useState<VeoModel>(initialValues?.model || VeoModel.VEO_FAST);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialValues?.aspectRatio || AspectRatio.LANDSCAPE);
  const [resolution, setResolution] = useState<Resolution>(initialValues?.resolution || Resolution.P720);
  const [mode, setMode] = useState<GenerationMode>(initialValues?.mode || GenerationMode.TEXT_TO_VIDEO);
  const [startFrame, setStartFrame] = useState<ImageFile | null>(initialValues?.startFrame || null);
  const [endFrame, setEndFrame] = useState<ImageFile | null>(initialValues?.endFrame || null);
  const [referenceImages, setReferenceImages] = useState<ImageFile[]>(initialValues?.referenceImages || []);
  const [isLooping, setIsLooping] = useState(initialValues?.isLooping || false);
  const [controls, setControls] = useState<ProductionControls>(initialValues?.controls || {
    anatomyMaster: true,
    anatomyCorrectionIntensity: 6,
    handCorrectionIntensity: 9, // Default to high intensity for hands
    cinematicLighting: true,
    textureDetail: true,
    temporalStability: true,
    negativePrompt: '歪み, 低画質, 指が多い, ぼやけた画像, 腕の歪み',
  });
  const [seed, setSeed] = useState<number>(initialValues?.seed || 0);

  // Tools State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState<{url: string, base64: string, file: File} | null>(null);

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState(''); // New state for interim results
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const toggleListening = () => {
    setVoiceError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("お使いのブラウザは音声認識をサポートしていません。ChromeまたはEdgeをご利用ください。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true; // Enable interim results to show real-time feedback

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      setInterimTranscript('');
      
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          setVoiceError("マイクの使用が許可されていません。ブラウザのアドレスバーのマイクアイコンから許可してください。");
          break;
        case 'no-speech':
          // Ignore no-speech errors in continuous mode usually, but inform if needed
          break;
        case 'network':
          setVoiceError("ネットワークエラーが発生しました。");
          break;
        default:
          setVoiceError(`音声認識エラー: ${event.error}`);
      }
    };
    
    recognition.onresult = (event: any) => {
      let finalTranscriptChunk = '';
      let currentInterim = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptChunk += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }

      // Update interim display
      setInterimTranscript(currentInterim);

      // Append final text to prompt
      if (finalTranscriptChunk) {
        setPrompt((prev) => {
          const textToAdd = finalTranscriptChunk.trim();
          if (!textToAdd) return prev;
          
          // Smart spacing for Japanese text
          if (prev.length > 0 && ![' ', '、', '。', '\n'].includes(prev.slice(-1))) {
            return prev + ' ' + textToAdd;
          }
          return prev + textToAdd;
        });
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition", e);
      setIsListening(false);
      setVoiceError("音声認識を開始できませんでした。");
    }
  };


  const handleOptimizePrompt = async () => {
    if (!prompt) return;
    setIsOptimizing(true);
    try {
      const optimized = await optimizePromptForVeo(prompt);
      setPrompt(optimized);
    } catch (e) {
      console.error("Prompt optimization failed", e);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleGeneratePreview = async () => {
    if (!prompt) return;
    setIsGeneratingImage(true);
    try {
      const result = await generateStoryboardImage(prompt, aspectRatio);
      
      // Convert base64 to File for compatibility with existing ImageUpload component
      const res = await fetch(`data:${result.mimeType};base64,${result.base64}`);
      const blob = await res.blob();
      const file = new File([blob], "generated_preview.png", { type: result.mimeType });
      
      setGeneratedPreview({
        url: URL.createObjectURL(blob),
        base64: result.base64,
        file: file
      });
    } catch (e) {
      console.error("Image generation failed", e);
      setVoiceError("画像の生成に失敗しました。");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      prompt,
      model,
      aspectRatio,
      resolution,
      mode,
      startFrame,
      endFrame,
      referenceImages,
      isLooping,
      controls,
      seed,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col gap-6 p-8 bg-white/5 border border-white/10 rounded-[3rem] shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-4 border-b border-white/5 pb-6 overflow-x-auto scrollbar-hide">
          {[
            { id: GenerationMode.TEXT_TO_VIDEO, label: 'テキストから生成', icon: TextModeIcon },
            { id: GenerationMode.FRAMES_TO_VIDEO, label: '画像から生成', icon: FramesModeIcon },
            { id: GenerationMode.REFERENCES_TO_VIDEO, label: 'アセット参照生成', icon: ReferencesModeIcon },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                mode === m.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              <m.icon className="w-4 h-4" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <ScriptIcon className="w-4 h-4 text-indigo-400" />
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">制作スクリプト (日本語対応)</label>
             </div>
             {isListening && <span className="text-[10px] font-bold text-red-500 animate-pulse">● 音声認識中 (お話しください)</span>}
          </div>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="ここに映像のシーン詳細を日本語で記述してください... （例：カフェで楽しそうに会話する二人の日本人学生、自然光、シネマティックな被写界深度）"
              className={`w-full min-h-[140px] border border-white/10 rounded-3xl p-6 pb-20 text-white placeholder:text-gray-700 focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-lg leading-relaxed ${
                isListening ? 'ring-2 ring-red-500/50 bg-red-900/10' : 'bg-black/40'
              }`}
              required
            />
            
            {/* Interim Results Overlay/Feedback */}
            {isListening && interimTranscript && (
              <div className="absolute left-6 bottom-20 right-6 pointer-events-none">
                <span className="text-gray-400 text-lg opacity-80 animate-pulse bg-black/50 px-2 rounded">
                  {interimTranscript}
                </span>
              </div>
            )}
            
            <div className="absolute bottom-4 left-4 flex gap-3">
              <button
                type="button"
                onClick={handleOptimizePrompt}
                disabled={!prompt || isOptimizing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-indigo-500/20 disabled:opacity-50"
              >
                {isOptimizing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <MagicWandIcon className="w-4 h-4" />}
                Veo向け最適化
              </button>
              
               <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={!prompt || isGeneratingImage}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/20 disabled:opacity-50"
              >
                {isGeneratingImage ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaletteIcon className="w-4 h-4" />}
                ストーリーボード作成
              </button>
            </div>

            <button
              type="button"
              onClick={toggleListening}
              className={`absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                  : 'bg-white/10 text-gray-400 hover:bg-indigo-600 hover:text-white hover:shadow-indigo-600/20'
              }`}
            >
              {isListening ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
              {isListening ? '完了' : '音声入力'}
            </button>
          </div>
          {voiceError && (
            <div className="text-[11px] text-red-400 font-bold bg-red-900/20 p-3 rounded-xl border border-red-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <XMarkIcon className="w-3 h-3" />
              {voiceError}
            </div>
          )}
        </div>
        
        {/* Storyboard / Preview Section */}
        {generatedPreview && (
          <div className="animate-in fade-in zoom-in-95 duration-500 bg-black/40 border border-white/10 rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2 text-amber-500">
                  <PaletteIcon className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Nano Banana Pro (Gemini 3) 生成プレビュー</span>
               </div>
               <button onClick={() => setGeneratedPreview(null)} className="text-gray-500 hover:text-white"><XMarkIcon className="w-4 h-4"/></button>
            </div>
            <div className="flex flex-col md:flex-row gap-6">
              <img src={generatedPreview.url} alt="Storyboard" className="h-40 rounded-2xl border border-white/20 object-cover shadow-2xl" />
              <div className="flex flex-col gap-3 justify-center">
                 <p className="text-xs text-gray-400 leading-relaxed max-w-sm mb-2">
                   この画像を動画生成のキーフレームとして使用できます。「画像から生成」モードに自動的に切り替わります。
                 </p>
                 <button
                   type="button"
                   onClick={() => {
                     setMode(GenerationMode.FRAMES_TO_VIDEO);
                     setStartFrame({ file: generatedPreview.file, base64: generatedPreview.base64 });
                   }}
                   className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white transition-all text-left"
                 >
                   <ArrowRightIcon className="w-3 h-3 text-indigo-400" />
                   開始フレームに設定
                 </button>
                 <button
                   type="button"
                   onClick={() => {
                     setMode(GenerationMode.FRAMES_TO_VIDEO);
                     setEndFrame({ file: generatedPreview.file, base64: generatedPreview.base64 });
                   }}
                   className="flex items-center gap-3 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-white transition-all text-left"
                 >
                   <ArrowRightIcon className="w-3 h-3 text-pink-400" />
                   終了フレームに設定
                 </button>
              </div>
            </div>
          </div>
        )}

        {mode === GenerationMode.FRAMES_TO_VIDEO && (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <ImageUpload label="開始フレーム" image={startFrame} onSelect={setStartFrame} onRemove={() => setStartFrame(null)} />
            <ImageUpload label="終了フレーム" image={endFrame} onSelect={setEndFrame} onRemove={() => setEndFrame(null)} />
            <div className="flex flex-col justify-center gap-2 px-4">
               <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative w-10 h-5 bg-white/10 rounded-full transition-colors group-hover:bg-white/20">
                    <input type="checkbox" checked={isLooping} onChange={(e) => setIsLooping(e.target.checked)} className="sr-only" />
                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isLooping ? 'left-6 bg-indigo-400' : 'left-1 bg-gray-600'}`} />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-300">シームレスループ</span>
               </label>
            </div>
          </div>
        )}

        {mode === GenerationMode.REFERENCES_TO_VIDEO && (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {Array.from({ length: 3 }).map((_, i) => (
              <ImageUpload
                key={i}
                label={`参照アセット ${i + 1}`}
                image={referenceImages[i]}
                onSelect={(img) => {
                  const newRefs = [...referenceImages];
                  newRefs[i] = img;
                  setReferenceImages(newRefs.filter(Boolean));
                }}
                onRemove={() => {
                  const newRefs = [...referenceImages];
                  newRefs.splice(i, 1);
                  setReferenceImages(newRefs);
                }}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-white/5 pt-8">
           <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">レンダリングエンジン</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as VeoModel)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white uppercase tracking-widest focus:outline-none"
              >
                <option value={VeoModel.VEO_FAST}>Veo 3.1 Fast (高速)</option>
                <option value={VeoModel.VEO}>Veo 3.1 Pro (高品質)</option>
              </select>
           </div>
           <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">画面比率 (アスペクト比)</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white uppercase tracking-widest focus:outline-none"
              >
                <option value={AspectRatio.LANDSCAPE}>16:9 横長 (シネマ)</option>
                <option value={AspectRatio.PORTRAIT}>9:16 縦長 (スマホ)</option>
              </select>
           </div>
           <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">出力解像度</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white uppercase tracking-widest focus:outline-none"
              >
                <option value={Resolution.P720}>720p (推奨)</option>
                <option value={Resolution.P1080}>1080p (最高画質)</option>
              </select>
           </div>
           <div className="space-y-3">
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">シード値 (乱数)</label>
              <div className="relative">
                <input
                  type="number"
                  value={seed || ''}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                  placeholder="ランダム"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white uppercase tracking-widest focus:outline-none"
                />
                <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1000000))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400">
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>
           </div>
        </div>
      </div>

      <div className="p-8 bg-white/5 border border-white/10 rounded-[3rem] space-y-6">
        <div className="flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-amber-500" />
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">人体構造 & 品質コントロール</label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-500">人体構造補正マスター</span>
                <button
                  type="button"
                  onClick={() => setControls({...controls, anatomyMaster: !controls.anatomyMaster})}
                  className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${controls.anatomyMaster ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-700'}`}
                >
                  {controls.anatomyMaster ? '有効 (Active)' : '無効 (Disabled)'}
                </button>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={controls.anatomyCorrectionIntensity}
                onChange={(e) => setControls({...controls, anatomyCorrectionIntensity: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase">
                <span>Natural</span>
                <span>Strict</span>
              </div>
           </div>
           
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-500/80">右腕・右手の重点補正</span>
                <span className="text-[9px] font-black text-amber-500">{controls.handCorrectionIntensity || 5} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={controls.handCorrectionIntensity || 5}
                onChange={(e) => setControls({...controls, handCorrectionIntensity: parseInt(e.target.value)})}
                className="w-full h-1.5 bg-white/10 rounded-full appearance-none accent-amber-500 cursor-pointer"
              />
               <div className="flex justify-between text-[9px] text-gray-600 font-bold uppercase">
                <span>Soft Fix</span>
                <span className="text-amber-700">Hard Fix</span>
              </div>
           </div>
        </div>
        
        <div className="flex gap-4 pt-4 border-t border-white/5">
              {[
                { key: 'cinematicLighting', label: 'シネマ照明' },
                { key: 'textureDetail', label: '高詳細テクスチャ' },
                { key: 'temporalStability', label: '時間的安定性' },
              ].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  // @ts-ignore
                  onClick={() => setControls({...controls, [c.key]: !controls[c.key as keyof ProductionControls]})}
                  className={`flex-1 py-3 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    // @ts-ignore
                    controls[c.key as keyof ProductionControls] ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-white/5 border-white/5 text-gray-700'
                  }`}
                >
                  {c.label}
                </button>
              ))}
        </div>

        <div className="space-y-3">
          <label className="text-[9px] font-black uppercase tracking-widest text-gray-500">ネガティブプロンプト (回避事項)</label>
          <input
            type="text"
            value={controls.negativePrompt}
            onChange={(e) => setControls({...controls, negativePrompt: e.target.value})}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white placeholder:text-gray-800 focus:outline-none"
            placeholder="例: 歪み, 余分な指, ノイズ, テキストの乱れ"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full py-6 bg-white text-black font-black uppercase tracking-[0.4em] text-[13px] rounded-[3rem] hover:bg-indigo-500 hover:text-white transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-4"
      >
        制作を開始 (INITIATE)
        <ArrowRightIcon className="w-5 h-5" />
      </button>
    </form>
  );
};

export default PromptForm;
