"use client";

import { useMemo } from 'react';

interface LoadingProgressBarProps {
  phase: 'idle' | 'downloading' | 'rendering' | 'done';
  downloadProgress?: number;  // 0-100
  renderProgress?: number;    // 0-100
  totalExpected: number;
  downloadedCount?: number;
  renderedCount?: number;
}

export function LoadingProgressBar({
  phase,
  downloadProgress = 0,
  renderProgress = 0,
  totalExpected,
  downloadedCount = 0,
  renderedCount = 0,
}: LoadingProgressBarProps) {
  const overallProgress = useMemo(() => {
    if (phase === 'idle') return 0;
    if (phase === 'done') return 100;
    // Phase de téléchargement = 0-50% du total
    // Phase de rendu = 50-100% du total
    if (phase === 'downloading') {
      return (downloadProgress / 2);
    }
    if (phase === 'rendering') {
      return 50 + (renderProgress / 2);
    }
    return 0;
  }, [phase, downloadProgress, renderProgress]);

  const statusText = useMemo(() => {
    if (phase === 'idle') return 'En attente...';
    if (phase === 'downloading') {
      return `Téléchargement des PDFs (${downloadedCount}/${totalExpected})`;
    }
    if (phase === 'rendering') {
      return `Conversion en images (${renderedCount}/${totalExpected})`;
    }
    if (phase === 'done') return 'Chargement terminé';
    return '';
  }, [phase, downloadedCount, renderedCount, totalExpected]);

  if (phase === 'idle' || totalExpected === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-lg shadow-md p-6 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{statusText}</span>
        <span className="font-bold text-blue-600">{Math.round(overallProgress)}%</span>
      </div>
      
      {/* Barre de progression principale */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${overallProgress}%` }}
        >
          <div className="h-full w-full animate-pulse bg-white opacity-20"></div>
        </div>
      </div>

      {/* Détails des phases */}
      <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            phase === 'downloading' ? 'bg-blue-500 animate-pulse' : 
            phase === 'rendering' || phase === 'done' ? 'bg-green-500' : 
            'bg-gray-300'
          }`}></div>
          <span>Téléchargement: {downloadedCount}/{totalExpected}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            phase === 'rendering' ? 'bg-blue-500 animate-pulse' : 
            phase === 'done' ? 'bg-green-500' : 
            'bg-gray-300'
          }`}></div>
          <span>Conversion: {renderedCount}/{totalExpected}</span>
        </div>
      </div>
    </div>
  );
}

