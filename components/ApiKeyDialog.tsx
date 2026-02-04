
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { KeyIcon } from './icons';

interface ApiKeyDialogProps {
  onContinue: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onContinue }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl max-w-lg w-full p-8 text-center flex flex-col items-center">
        <div className="bg-indigo-600/20 p-4 rounded-full mb-6">
          <KeyIcon className="w-12 h-12 text-indigo-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Veoのご利用には有料APIキーが必要です</h2>
        <p className="text-gray-300 mb-6 text-sm leading-relaxed">
          Veoは有料版の動画生成モデルです。この機能を使用するには、課金が有効になっているGoogle Cloudプロジェクトに関連付けられたAPIキーを選択してください。
        </p>
        <p className="text-gray-400 mb-8 text-xs">
          詳細については{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-medium"
          >
            課金の有効化方法
          </a>{' '}
          および{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing#veo-3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-medium"
          >
            Veoの料金体系
          </a>
          をご覧ください。
        </p>
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors"
        >
          有料APIキーを選択する
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
