/*'use client';

import React, { useState } from 'react';

type AttributeType = 'string' | 'address' | 'contact' | 'collectionPoint' | 'number' | 'select' | 'boolean';

interface Attribute {
  name: string;
  label: string;
  type: AttributeType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface CollectionPoint {
  id: string;
  nom: string;
  adresse: string;
}

interface EntityFormProps {
  title: string;
  mainAttribute: Attribute;
  secondaryAttributes: Attribute[];
  onSave: (data: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
}

const EntityForm: React.FC<EntityFormProps> = ({
  title,
  mainAttribute,
  secondaryAttributes,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData || {});
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);

  const handleInputChange = (name: string, value: string | boolean) => {
    const attribute = secondaryAttributes.find(attr => attr.name === name) || mainAttribute;
    let processedValue: string | number | boolean = value;
    
    if (attribute.type === 'number') {
      processedValue = Number(value);
    } else if (attribute.type === 'boolean') {
      processedValue = Boolean(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleAddCollectionPoint = () => {
    setCollectionPoints(prev => [
      ...prev,
      { id: Date.now().toString(), nom: '', adresse: '' }
    ]);
  };

  const handleRemoveCollectionPoint = (id: string) => {
    setCollectionPoints(prev => prev.filter(point => point.id !== id));
  };

  const handleCollectionPointChange = (id: string, field: 'nom' | 'adresse', value: string) => {
    setCollectionPoints(prev => 
      prev.map(point => point.id === id ? { ...point, [field]: value } : point)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
    };
    // Only include pointsCollecte if the form is for a Site
    if (title.toLowerCase().includes('site')) {
      finalData.pointsCollecte = collectionPoints;
    }
    onSave(finalData);
  };

  const renderAttributeInput = (attribute: Attribute) => {
    switch (attribute.type) {
      case 'string':
        return (
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {attribute.label}
            </label>
            <input
              type="text"
              value={formData[attribute.name] as string || ''}
              onChange={(e) => handleInputChange(attribute.name, e.target.value)}
              placeholder={attribute.placeholder}
              required={attribute.required}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
            />
          </div>
        );

      case 'number':
        return (
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {attribute.label}
            </label>
            <input
              type="number"
              value={formData[attribute.name] as number || ''}
              onChange={(e) => handleInputChange(attribute.name, e.target.value)}
              placeholder={attribute.placeholder}
              required={attribute.required}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
            />
          </div>
        );

      case 'select':
        return (
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {attribute.label}
            </label>
            <select
              value={formData[attribute.name] as string || ''}
              onChange={(e) => handleInputChange(attribute.name, e.target.value)}
              required={attribute.required}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
            >
              <option value="">{attribute.placeholder || 'Sélectionnez une option'}</option>
              {attribute.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'address':
        return (
          <div className="w-full">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {attribute.label}
            </label>
            <textarea
              value={formData[attribute.name] as string || ''}
              onChange={(e) => handleInputChange(attribute.name, e.target.value)}
              placeholder="Adresse complète (adresse, code postal, ville, pays)"
              required={attribute.required}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)] min-h-[60px] resize-vertical"
            />
          </div>
        );

      case 'collectionPoint':
        return (
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-500">
                {attribute.label}
              </label>
              <button
                type="button"
                onClick={handleAddCollectionPoint}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
              >
                + Ajouter
              </button>
            </div>
            {collectionPoints.map((point) => (
              <div key={point.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nom du point de collecte"
                    value={point.nom}
                    onChange={(e) => handleCollectionPointChange(point.id, 'nom', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCollectionPoint(point.id)}
                    className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition-all shrink-0"
                  >
                    Supprimer
                  </button>
                </div>
                <textarea
                  placeholder="Adresse complète du point de collecte"
                  value={point.adresse}
                  onChange={(e) => handleCollectionPointChange(point.id, 'adresse', e.target.value)}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)] min-h-[50px] resize-vertical"
                />
              </div>
            ))}
          </div>
        );

      case 'contact':
        return (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 w-full">
            <p className="text-xs font-medium text-gray-500 mb-2">{attribute.label}</p>
            <div className="space-y-2">
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Nom et Prénom
                </label>
                <input
                  type="text"
                  value={formData[`${attribute.name}.nomPrenom`] as string || ''}
                  onChange={(e) => handleInputChange(`${attribute.name}.nomPrenom`, e.target.value)}
                  placeholder="Nom et Prénom"
                  required={attribute.required}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData[`${attribute.name}.email`] as string || ''}
                  onChange={(e) => handleInputChange(`${attribute.name}.email`, e.target.value)}
                  placeholder="Email"
                  required={attribute.required}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData[`${attribute.name}.telephone`] as string || ''}
                  onChange={(e) => handleInputChange(`${attribute.name}.telephone`, e.target.value)}
                  placeholder="Téléphone"
                  required={attribute.required}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                />
              </div>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="w-full">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <input
                type="checkbox"
                checked={formData[attribute.name] as boolean || false}
                onChange={(e) => handleInputChange(attribute.name, e.target.checked)}
                className="w-4 h-4 text-[var(--green-medium)] border-gray-300 rounded focus:ring-[var(--green-medium)]"
              />
              {attribute.label}
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 transition-all hover:shadow-md w-full">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-3 w-full">
        {renderAttributeInput(mainAttribute)}
        {secondaryAttributes.map(attribute => (
          <React.Fragment key={attribute.name}>
            {renderAttributeInput(attribute)}
          </React.Fragment>
        ))}
        <div className="flex justify-end mt-4">
          <button 
            type="submit" 
            className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};

export default EntityForm;*/