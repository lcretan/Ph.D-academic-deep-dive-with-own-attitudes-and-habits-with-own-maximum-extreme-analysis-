
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';

const loadingMessages = [
  "デジタル監督が準備運動をしています...",
  "ピクセルと光子を集めています...",
  "あなたのビジョンを絵コンテに描いています...",
  "AIのミューズと相談中...",
  "最初のシーンをレンダリング中...",
  "シネマティックな照明を設定中...",
  "数分かかる場合があります。少々お待ちください...",
  "映像に魔法をかけています...",
  "ファイナルカットを構成中...",
  "傑作を磨き上げています...",
  "AIに「I'll be back」と言わせています...",
  "デジタルなホコリを払っています...",
  "タイムラインを整理中...",
  "驚異的な速度（当社比）で強化中...",
  "ご安心ください、ピクセルは友好的です。",
  "Geminiの星に祈りを捧げています...",
  "アカデミー賞のスピーチの下書き中..."
];

const LoadingIndicator: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="w-16 h-16 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
      <h2 className="text-xl font-bold mt-8 text-gray-200">映像を生成しています</h2>
      <p className="mt-2 text-gray-400 text-sm text-center transition-opacity duration-500">
        {loadingMessages[messageIndex]}
      </p>
    </div>
  );
};

export default LoadingIndicator;
