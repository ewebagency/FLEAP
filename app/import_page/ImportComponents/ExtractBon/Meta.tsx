'use client';

import React from 'react';

interface MetaProps {
  numeroBon: string;
  codeCED: string;
  date: string;
  tonnage: string;
  site: string;
  prestataire: string;
  dechet: string;
  siteTranslation?: string;
  prestaTranslation?: string;
  siteSiret?: string;
  prestaSiret?: string;
  bsdId?: string; // Nouveau paramètre pour l'ID du BSD
  isMatch?: {
    codeCED?: boolean;
    date?: boolean;
    tonnage?: boolean;
    site?: boolean;
    prestataire?: boolean;
  };
  showTranslations?: boolean;
  showMatchIndicators?: boolean;
}

export default function Meta({
  numeroBon,
  codeCED,
  date,
  tonnage,
  site,
  prestataire,
  dechet,
  siteTranslation,
  prestaTranslation,
  siteSiret,
  prestaSiret,
  bsdId,
  isMatch = {},
  showTranslations = false,
  showMatchIndicators = false
}: MetaProps) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg h-[250px] overflow-y-auto relative">
      {/* ID du BSD en petit en haut à droite */}
      {bsdId && (
        <div className="absolute top-2 right-2">
          <span className="text-xs text-gray-500 bg-gray-200 px-1 py-0.5 rounded">
            ID: {bsdId}
          </span>
        </div>
      )}
      
      {/* Numéro de Bon en haut */}
      <div className="mb-2 flex items-center justify-center">
        <span className="text-xl text-indigo-700 mr-1">N° Bon : </span>
        <span className="text-2xl font-bold text-indigo-700">{numeroBon || 'Vide'}</span>
      </div>
      
      {/* Informations principales */}
      <div className="space-y-3">
        {/* Code CED, Date et Tonnage */}
        <div className="flex justify-between">
          <div className="text-sm">
            <div className="text-gray-600">CED:</div>
            <div className={`px-2 py-1 rounded font-medium ${
              showMatchIndicators && isMatch.codeCED 
                ? 'text-blue-600 bg-green-50' 
                : 'text-blue-600 bg-gray-50'
            }`}>
              {codeCED || 'Vide'}
              {showMatchIndicators && isMatch.codeCED && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
          <div className="text-sm">
            <div className="text-gray-600">Date:</div>
            <div className={`px-2 py-1 rounded font-medium ${
              showMatchIndicators && isMatch.date 
                ? 'text-orange-600 bg-green-50' 
                : 'text-orange-600 bg-gray-50'
            }`}>
              {date || 'Vide'}
              {showMatchIndicators && isMatch.date && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
          <div className="text-sm">
            <div className="text-gray-600">Tonnage:</div>
            <div className={`px-2 py-1 rounded font-medium ${
              showMatchIndicators && isMatch.tonnage 
                ? 'text-red-600 bg-green-50' 
                : 'text-red-600 bg-gray-50'
            }`}>
              {tonnage || 'Vide'}
              {showMatchIndicators && isMatch.tonnage && <span className="ml-1 text-xs">✓</span>}
            </div>
          </div>
        </div>
        
        {/* Site et Prestataire */}
        <div className="text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Site:</span>
            <div className="text-right">
              <span className={`text-gray-800 ${
                showMatchIndicators && isMatch.site ? 'bg-green-50 px-2 py-1 rounded' : ''
              }`}>
                {showTranslations && siteTranslation ? siteTranslation : (site || 'Vide')}
                <span className="text-xs text-gray-500 mt-1 ml-2">
                   -  {siteSiret}
                </span>
                {showMatchIndicators && isMatch.site && <span className="ml-1 text-xs">✓</span>}
              </span>
            </div>
          </div>
          <div className="flex justify-between">
            <span>Prestataire:</span>
            <div className="text-right">
              <span className={`text-gray-800 ${
                showMatchIndicators && isMatch.prestataire ? 'bg-green-50 px-2 py-1 rounded' : ''
              }`}>
                {showTranslations && prestaTranslation ? prestaTranslation : (prestataire || 'Vide')}
                <span className="text-xs text-gray-500 mt-1 ml-2">
                   -  {prestaSiret}
                </span>
                {showMatchIndicators && isMatch.prestataire && <span className="ml-1 text-xs">✓</span>}
              </span>
            </div>
          </div>
        </div>
        
        {/* Déchet */}
        <div className="text-sm">
          <div className="text-gray-600">Déchet:</div>
          <div className="text-gray-800 bg-gray-50 px-2 py-1 rounded">
            {dechet || 'Vide'}
          </div>
        </div>
      </div>
    </div>
  );
}
