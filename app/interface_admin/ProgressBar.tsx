import React from 'react';

interface ProgressBarProps {
  progress: number;
  loading: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, loading }) => {
  return (
    <div className='h-2 bg-gray-300 rounded'>
      <div 
        className='h-full bg-blue-500 rounded'
        style={{ width: `${progress}%` }} // Largeur dynamique selon la progression
      />
      {loading && <p className="mt-2 text-sm">Extraction en cours... {progress}%</p>}
    </div>
  );
};

export default ProgressBar;
