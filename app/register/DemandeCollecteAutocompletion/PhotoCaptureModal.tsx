import React, { useRef } from 'react';
import BoxIcon from "@/app/component/BoxIconWrapper";
import { toast } from 'react-hot-toast';

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleGallerySelect = () => {
    if (galleryInputRef.current) {
      galleryInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedFile = await compressImage(file);
        onCapture(compressedFile);
        onClose();
        toast.success('Photo ajoutée');
      } catch (error) {
        console.error('Erreur lors de la compression:', error);
        toast.error('Erreur lors de la compression de la photo');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-[90%] max-w-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-base font-semibold">Ajouter une photo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <BoxIcon name="x" type="solid" size="sm" />
          </button>
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <div 
            onClick={handleGallerySelect}
            className="w-full bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
          >
            <div className="text-center text-gray-500">
              <BoxIcon name="camera" type="solid" size="150px"/>
            </div>
          </div>

          {/* Input caché pour la galerie */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

// Fonction de compression d'image
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Compression failed'));
          }
        }, 'image/jpeg', 0.7);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

export default PhotoCaptureModal; 