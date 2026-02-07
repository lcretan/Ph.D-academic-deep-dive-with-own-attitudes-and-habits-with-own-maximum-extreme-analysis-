
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState, useRef} from 'react';
import ApiKeyDialog from './components/ApiKeyDialog';
import LoadingIndicator from './components/LoadingIndicator';
import PromptForm from './components/PromptForm';
import VideoResult from './components/VideoResult';
import {generateVideo} from './services/geminiService';
import {
  AppState,
  AspectRatio,
  GenerateVideoParams,
} from './types';
import { UploadIcon, ClapperboardIcon, DownloadIcon, ArrowPathIcon } from './components/icons';
import { projectService, ProjectData } from './services/projectService';
import { AudioSegment } from './services/audioMixer';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastConfig, setLastConfig] = useState<GenerateVideoParams | null>(
    null,
  );
  // @ts-ignore
  const [lastVideoObject, setLastVideoObject] = useState<Video | null>(null);
  // @ts-ignore
  const [lastVideoBlob, setLastVideoBlob] = useState<Blob | null>(null);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  
  // State for imported video
  const [isImportedVideo, setIsImportedVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [initialFormValues] = useState<GenerateVideoParams | null>(null);

  // Project Persistence State
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedProjects, setSavedProjects] = useState<{id: string, name: string, updatedAt: number}[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);
  const [restoredSegments, setRestoredSegments] = useState<AudioSegment[] | undefined>(undefined);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        try {
          if (!(await window.aistudio.hasSelectedApiKey())) {
            setShowApiKeyDialog(true);
          }
        } catch (error) {
          setShowApiKeyDialog(true);
        }
      }
    };
    checkApiKey();
    refreshProjectsList();
  }, []);

  const refreshProjectsList = async () => {
    try {
      const projects = await projectService.getAllProjects();
      setSavedProjects(projects);
    } catch (e) {
      console.error("Failed to load projects list", e);
    }
  };

  const handleApiKeyDialogContinue = useCallback(async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
      } catch (e) {
        console.error("Failed to open key selection", e);
      }
    }
    setShowApiKeyDialog(false);
  }, []);

  const handleGenerate = useCallback(async (params: GenerateVideoParams) => {
    setAppState(AppState.LOADING);
    setErrorMessage(null);
    setLastConfig(params);
    setIsImportedVideo(false);
    setCurrentProjectId(null); // New generation means new project
    setCurrentProjectName(null);

    try {
      const {objectUrl, blob, video} = await generateVideo(params);
      setVideoUrl(objectUrl);
      setLastVideoBlob(blob);
      setLastVideoObject(video);
      setAppState(AppState.SUCCESS);
    } catch (error: any) {
      console.error('Production failed:', error);
      
      if (error.message && error.message.includes("Requested entity was not found.")) {
        setErrorMessage("プロジェクトまたはAPIキーが見つかりません。有効な課金対象のAPIキーを再選択してください。");
        setShowApiKeyDialog(true);
      } else {
        setErrorMessage(error instanceof Error ? error.message : '不明な制作エラーが発生しました。');
      }
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastConfig) handleGenerate(lastConfig);
  }, [lastConfig, handleGenerate]);

  const handleNewVideo = useCallback(() => {
    // Cleanup old URL
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorMessage(null);
    setIsImportedVideo(false);
    setCurrentProjectId(null);
    setCurrentProjectName(null);
    setRestoredSegments(undefined);
  }, [videoUrl]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Cleanup previous
      if (videoUrl) URL.revokeObjectURL(videoUrl);

      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setLastConfig(null);
      setLastVideoBlob(file);
      setLastVideoObject(null);
      setIsImportedVideo(true);
      setAppState(AppState.SUCCESS);
      setCurrentProjectId(null);
      setCurrentProjectName(null);
      setRestoredSegments([]);
    }
  };

  // Project Management Functions
  const handleSaveProject = async (segments: AudioSegment[]) => {
    let blobToSave = lastVideoBlob;

    // Fallback: If blob is missing but URL exists (e.g. reload or edge case), try to fetch
    if (!blobToSave && videoUrl) {
        try {
            const res = await fetch(videoUrl);
            blobToSave = await res.blob();
        } catch (e) {
            console.error("Failed to recover blob from URL", e);
        }
    }

    if (!blobToSave) {
        alert("保存する動画データが見つかりません。");
        return;
    }
    
    const projectId = currentProjectId || crypto.randomUUID();
    // Maintain existing name or generate new one based on date
    const projectName = currentProjectName || `Project ${new Date().toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    
    const projectData: ProjectData = {
        id: projectId,
        name: projectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        videoBlob: blobToSave,
        segments: segments,
        params: lastConfig
    };

    try {
        await projectService.saveProject(projectData);
        setCurrentProjectId(projectId);
        setCurrentProjectName(projectName);
        alert("✅ プロジェクトを保存しました (動画 + 音声トラック)");
        refreshProjectsList();
    } catch (e) {
        console.error(e);
        alert("保存に失敗しました: " + e);
    }
  };

  const handleLoadProject = async (id: string) => {
    try {
        const project = await projectService.loadProject(id);
        
        // Cleanup existing
        if (videoUrl) URL.revokeObjectURL(videoUrl);

        // Restore state
        const url = URL.createObjectURL(project.videoBlob);
        setVideoUrl(url);
        setLastVideoBlob(project.videoBlob);
        setLastConfig(project.params);
        setCurrentProjectId(project.id);
        setCurrentProjectName(project.name);
        
        // IMPORTANT: Pass segments to VideoResult via a prop or state
        setRestoredSegments(project.segments);
        
        setAppState(AppState.SUCCESS);
        setShowLoadDialog(false);
    } catch (e) {
        console.error(e);
        alert("読み込みに失敗しました");
    }
  };
  
  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm("本当に削除しますか？")) return;
      await projectService.deleteProject(id);
      refreshProjectsList();
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col font-sans overflow-x-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}

      {showLoadDialog && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
              <div className="bg-[#101012] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-black uppercase tracking-widest text-white">Load Project</h2>
                      <button onClick={() => setShowLoadDialog(false)} className="p-2 hover:bg-white/10 rounded-full"><DownloadIcon className="w-5 h-5 rotate-45" /></button>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {savedProjects.length === 0 ? (
                          <div className="text-center py-10 text-gray-500">保存されたプロジェクトはありません</div>
                      ) : (
                          savedProjects.map(p => (
                              <div key={p.id} onClick={() => handleLoadProject(p.id)} className="group flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer border border-transparent hover:border-indigo-500/30 transition-all">
                                  <div>
                                      <div className="font-bold text-gray-200 flex items-center gap-2">
                                          {p.name}
                                          {p.id === currentProjectId && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">ACTIVE</span>}
                                      </div>
                                      <div className="text-xs text-gray-500">{new Date(p.updatedAt).toLocaleString()}</div>
                                  </div>
                                  <button onClick={(e) => handleDeleteProject(p.id, e)} className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                      Delete
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
      
      {/* Compact Header */}
      <header className="py-4 px-6 border-b border-white/5 bg-[#050505] flex items-center justify-between z-20 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <ClapperboardIcon className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter italic uppercase leading-none">
              Veo Studio <span className="text-indigo-500">Pro</span>
            </h1>
            <div className="flex items-center gap-2">
                <p className="text-[9px] font-bold text-gray-500 tracking-[0.2em]">GEN-AI VIDEO WORKSTATION</p>
                {currentProjectName && (
                    <>
                        <span className="text-[9px] text-gray-600">/</span>
                        <span className="text-[9px] font-mono text-indigo-400 truncate max-w-[200px]" title={currentProjectName}>{currentProjectName}</span>
                    </>
                )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
             <button onClick={() => setShowLoadDialog(true)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-bold uppercase tracking-widest border border-white/5 transition-all">
                <ArrowPathIcon className="w-3 h-3" /> Load Project
             </button>
             <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest border-l border-white/10 pl-4">
                <span>Engine: Veo 3.1</span>
                <span>DB: IndexedDB</span>
             </div>
        </div>
      </header>

      <main className="w-full max-w-[1600px] mx-auto flex-grow flex flex-col p-4 pb-20">
        {appState === AppState.IDLE ? (
          <div className="max-w-5xl mx-auto w-full space-y-8 mt-8">
            <div className="text-center py-10 space-y-4">
              <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-4">
                IMAGINE. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">GENERATE.</span> DIRECT.
              </h2>
              <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
                Googleの最新映像生成モデルVeoと、マルチモーダル音声生成モデルGeminiを統合。
                プロンプトから最終カットまで、一つのインターフェースで完結します。
              </p>
            </div>

            <PromptForm onGenerate={handleGenerate} initialValues={initialFormValues} />
            
            <div className="flex flex-col items-center gap-4 py-12 border-t border-white/5">
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">外部メディアのインポート (タイムライン編集モード)</p>
               <input
                 type="file"
                 accept="video/*"
                 ref={fileInputRef}
                 onChange={handleFileUpload}
                 className="hidden"
               />
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-black text-[11px] uppercase tracking-widest rounded-2xl border border-white/10 transition-all border-dashed hover:border-indigo-500/50"
               >
                 <UploadIcon className="w-4 h-4" />
                 既存の動画ファイル (MP4/MOV) をロード
               </button>
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center py-4 w-full">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onExtend={() => {}}
                canExtend={true}
                aspectRatio={lastConfig?.aspectRatio || AspectRatio.LANDSCAPE}
                isImported={isImportedVideo}
                onSaveProject={handleSaveProject}
                initialSegments={restoredSegments}
              />
            )}
            {appState === AppState.ERROR && (
              <div className="text-center p-12 bg-red-900/10 border border-red-500/20 rounded-[3rem] mt-20">
                <h2 className="text-2xl font-black text-red-400 uppercase tracking-tighter italic mb-4">制作停止 (SYSTEM HALT)</h2>
                <p className="text-red-300/70 text-sm mb-8">{errorMessage}</p>
                <button onClick={handleNewVideo} className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] rounded-full transition-all">システムリセット</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
