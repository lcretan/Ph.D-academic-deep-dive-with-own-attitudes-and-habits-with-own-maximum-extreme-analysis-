
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {Video} from '@google/genai';
import React, {useCallback, useEffect, useState} from 'react';
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

  // We do not define initial values anymore to prevent potential hydration issues with complex state
  const [initialFormValues] = useState<GenerateVideoParams | null>(null);

  useEffect(() => {
    // Check if an API key is selected on mount
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
  }, []);

  // Update handler for API key dialog to trigger openSelectKey according to guidelines
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

    try {
      const {objectUrl, blob, video} = await generateVideo(params);
      setVideoUrl(objectUrl);
      setLastVideoBlob(blob);
      setLastVideoObject(video);
      setAppState(AppState.SUCCESS);
    } catch (error: any) {
      console.error('Production failed:', error);
      
      // Handle "Requested entity was not found." by resetting key selection as per guidelines
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
    setAppState(AppState.IDLE);
    setVideoUrl(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col font-sans overflow-x-hidden">
      {showApiKeyDialog && (
        <ApiKeyDialog onContinue={handleApiKeyDialogContinue} />
      )}
      
      <header className="py-8 flex flex-col items-center justify-center px-8 relative z-10">
        <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-center italic uppercase">
          映像制作 <span className="text-indigo-600">ワークステーション</span>
        </h1>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-600 mt-2">Veo 3.1 Pro 搭載・学術映像合成エンジン</p>
      </header>

      <main className="w-full max-w-5xl mx-auto flex-grow flex flex-col p-4 pb-20">
        {appState === AppState.IDLE ? (
          <PromptForm onGenerate={handleGenerate} initialValues={initialFormValues} />
        ) : (
          <div className="flex-grow flex items-center justify-center py-10">
            {appState === AppState.LOADING && <LoadingIndicator />}
            {appState === AppState.SUCCESS && videoUrl && (
              <VideoResult
                videoUrl={videoUrl}
                onRetry={handleRetry}
                onNewVideo={handleNewVideo}
                onExtend={() => {}}
                canExtend={true}
                aspectRatio={lastConfig?.aspectRatio || AspectRatio.LANDSCAPE}
              />
            )}
            {appState === AppState.ERROR && (
              <div className="text-center p-12 bg-red-900/10 border border-red-500/20 rounded-[3rem]">
                <h2 className="text-2xl font-black text-red-400 uppercase tracking-tighter italic mb-4">制作停止</h2>
                <p className="text-red-300/70 text-sm mb-8">{errorMessage}</p>
                <button onClick={handleNewVideo} className="px-10 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest text-[10px] rounded-full transition-all">リセット</button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 py-4 bg-black/80 backdrop-blur-xl border-t border-white/5 flex justify-center z-50">
        <div className="text-[9px] font-black text-gray-700 uppercase tracking-[0.5em]">Veo 3.1 Pro Integrated Station (JP)</div>
      </footer>
    </div>
  );
};

export default App;
