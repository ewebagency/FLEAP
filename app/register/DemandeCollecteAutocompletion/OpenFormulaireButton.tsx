import React, { useEffect, useState } from 'react';
import BoxIcon from "@/app/component/BoxIconWrapper";

interface OpenFormulaireButtonProps {
  onClick: () => void;
}

const OpenFormulaireButton: React.FC<OpenFormulaireButtonProps> = ({ onClick }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Initial check
    checkIsMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 md:py-4 md:ml-2 py-2 bg-[var(--green-medium)] text-white rounded-md hover:bg-[var(--green-dark)] transition-colors duration-200 text-l"
    >
      <BoxIcon name="truck" type="solid" color="white"/>
      <span>{isMobile ? 'Demande de collecte' : 'Demander des collectes'}</span>
    </button>
  );
};

export default OpenFormulaireButton;