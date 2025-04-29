'use client';

import React, { useState, useEffect } from 'react';

type AttributeType = 'string' | 'address' | 'contact' | 'collectionPoint' | 'number' | 'select' | 'boolean' | 'tarifs';

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

interface Contact {
  id: string;
  nom: string;
  email: string;
  telephone: string;
  respoTerrain: boolean;
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
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const data = { ...initialData };
    if (data.tarifs) {
      delete data.tarifs;
    }
    return data;
  });
  const [collectionPoints, setCollectionPoints] = useState<CollectionPoint[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tarifs, setTarifs] = useState<{
    id: string;
    dechet: string;
    code_ced: string;
    couts: {
      traitement: number;
      location: number;
      transport: number;
    };
  }[]>([]);

  useEffect(() => {
    if (initialData?.tarifs) {
      setTarifs(initialData.tarifs as {
        id: string;
        dechet: string;
        code_ced: string;
        couts: {
          traitement: number;
          location: number;
          transport: number;
        };
      }[]);
    }
    if (initialData?.contacts) {
      setContacts(initialData.contacts as Contact[]);
    } else {
      setContacts([]);
    }
  }, [initialData]);

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

  const handleAddTarif = () => {
    setTarifs(prev => [
      ...prev,
      { 
        id: Date.now().toString(), 
        dechet: '', 
        code_ced: '', 
        couts: {
          traitement: 0,
          location: 0,
          transport: 0
        }
      }
    ]);
  };

  const handleRemoveTarif = (id: string) => {
    setTarifs(prev => prev.filter(tarif => tarif.id !== id));
  };

  const handleTarifChange = (id: string, field: string, value: string | number) => {
    setTarifs(prev => 
      prev.map(tarif => {
        if (tarif.id === id) {
          if (field.includes('.')) {
            const [parent, child] = field.split('.');
            if (parent === 'couts' && child in tarif.couts) {
              return {
                ...tarif,
                couts: {
                  ...tarif.couts,
                  [child]: value
                }
              };
            }
          } else if (field === 'dechet' || field === 'code_ced') {
            return { ...tarif, [field]: value };
          }
        }
        return tarif;
      })
    );
  };

  const handleAddContact = () => {
    const newContact = {
      id: Date.now().toString(),
      nom: '',
      email: '',
      telephone: '',
      respoTerrain: false
    };
    setContacts(prev => [...prev, newContact]);
  };

  const handleRemoveContact = (id: string) => {
    setContacts(prev => prev.filter(contact => contact.id !== id));
  };

  const handleContactChange = (id: string, field: keyof Contact, value: string | boolean) => {
    setContacts(prev => 
      prev.map(contact => contact.id === id ? { ...contact, [field]: value } : contact)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData: Record<string, unknown> = {
      ...formData,
      contacts: contacts,
    };
    if (title.toLowerCase().includes('site')) {
      finalData.pointsCollecte = collectionPoints;
    }
    if (title.toLowerCase().includes('contrat')) {
      finalData.tarifs = tarifs;
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
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-500">
                {attribute.label}
              </label>
              <button
                type="button"
                onClick={handleAddContact}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
              >
                + Ajouter un contact
              </button>
            </div>
            {contacts.map((contact) => (
              <div key={contact.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nom du contact"
                    value={contact.nom}
                    onChange={(e) => handleContactChange(contact.id, 'nom', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveContact(contact.id)}
                    className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition-all shrink-0"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={contact.email}
                    onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                  />
                  <input
                    type="tel"
                    placeholder="Téléphone"
                    value={contact.telephone}
                    onChange={(e) => handleContactChange(contact.id, 'telephone', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                  />
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <input
                      type="checkbox"
                      checked={contact.respoTerrain}
                      onChange={(e) => handleContactChange(contact.id, 'respoTerrain', e.target.checked)}
                      className="w-4 h-4 text-[var(--green-medium)] border-gray-300 rounded focus:ring-[var(--green-medium)]"
                    />
                    Responsable terrain
                  </label>
                </div>
              </div>
            ))}
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

      case 'tarifs':
        return (
          <div className="space-y-2 w-full">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-500">
                {attribute.label}
              </label>
              <button
                type="button"
                onClick={handleAddTarif}
                className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-2 py-1 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-all"
              >
                + Ajouter
              </button>
            </div>
            <div className="space-y-4">
              {tarifs.map((tarif) => (
                <div key={tarif.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Type de déchet"
                      value={tarif.dechet}
                      onChange={(e) => handleTarifChange(tarif.id, 'dechet', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                    />
                    <input
                      type="text"
                      placeholder="Code CED"
                      value={tarif.code_ced}
                      onChange={(e) => handleTarifChange(tarif.id, 'code_ced', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTarif(tarif.id)}
                      className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg text-xs font-medium hover:bg-red-100 transition-all shrink-0"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Coût traitement
                      </label>
                      <input
                        type="number"
                        value={tarif.couts.traitement}
                        onChange={(e) => handleTarifChange(tarif.id, 'couts.traitement', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Coût location
                      </label>
                      <input
                        type="number"
                        value={tarif.couts.location}
                        onChange={(e) => handleTarifChange(tarif.id, 'couts.location', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Coût transport
                      </label>
                      <input
                        type="number"
                        value={tarif.couts.transport}
                        onChange={(e) => handleTarifChange(tarif.id, 'couts.transport', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--green-medium)] focus:ring-1 focus:ring-[var(--green-medium)]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main attribute */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">
            {mainAttribute.label}
            {mainAttribute.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={formData[mainAttribute.name] as string || ''}
            onChange={(e) => handleInputChange(mainAttribute.name, e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder={mainAttribute.placeholder}
            required={mainAttribute.required}
          />
        </div>

        {/* Secondary attributes */}
        {secondaryAttributes.map((attr) => {
          if (attr.type === 'collectionPoint') {
            return (
              <div key={attr.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">
                    {attr.label}
                    {attr.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddCollectionPoint}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    + Ajouter un point de collecte
                  </button>
                </div>
                <div className="space-y-2">
                  {collectionPoints.map((point) => (
                    <div key={point.id} className="flex gap-2">
                      <input
                        type="text"
                        value={point.nom}
                        onChange={(e) => handleCollectionPointChange(point.id, 'nom', e.target.value)}
                        placeholder="Nom du point"
                        className="flex-1 p-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={point.adresse}
                        onChange={(e) => handleCollectionPointChange(point.id, 'adresse', e.target.value)}
                        placeholder="Adresse"
                        className="flex-1 p-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCollectionPoint(point.id)}
                        className="p-2 text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (attr.type === 'contact') {
            return (
              <div key={attr.name} className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">
                    {attr.label}
                    {attr.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddContact}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    + Ajouter un contact
                  </button>
                </div>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={contact.nom}
                          onChange={(e) => handleContactChange(contact.id, 'nom', e.target.value)}
                          placeholder="Nom du contact"
                          className="flex-1 p-2 border border-gray-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(contact.id)}
                          className="p-2 text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => handleContactChange(contact.id, 'email', e.target.value)}
                        placeholder="Email"
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="tel"
                        value={contact.telephone}
                        onChange={(e) => handleContactChange(contact.id, 'telephone', e.target.value)}
                        placeholder="Téléphone"
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={contact.respoTerrain}
                          onChange={(e) => handleContactChange(contact.id, 'respoTerrain', e.target.checked)}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        Responsable terrain
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (attr.type === 'tarifs') {
            return (
              <div key={attr.name} className="space-y-2 hidden">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-gray-700">
                    {attr.label}
                    {attr.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTarif}
                    className="text-sm text-green-600 hover:text-green-700"
                  >
                    + Ajouter un tarif
                  </button>
                </div>
                <div className="space-y-4">
                  {tarifs.map((tarif) => (
                    <div key={tarif.id} className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={tarif.dechet}
                          onChange={(e) => handleTarifChange(tarif.id, 'dechet', e.target.value)}
                          placeholder="Nom du déchet"
                          className="flex-1 p-2 border border-gray-300 rounded-lg"
                        />
                        <input
                          type="text"
                          value={tarif.code_ced}
                          onChange={(e) => handleTarifChange(tarif.id, 'code_ced', e.target.value)}
                          placeholder="Code CED"
                          className="flex-1 p-2 border border-gray-300 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTarif(tarif.id)}
                          className="p-2 text-red-600 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Traitement</label>
                          <input
                            type="number"
                          value={tarif.couts.traitement}
                          onChange={(e) => handleTarifChange(tarif.id, 'couts.traitement', Number(e.target.value))}
                          placeholder="Coût traitement"
                          className="p-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                          <input
                            type="number"
                            value={tarif.couts.location}
                            onChange={(e) => handleTarifChange(tarif.id, 'couts.location', Number(e.target.value))}
                            placeholder="Coût location"
                            className="p-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Transport</label>
                          <input
                            type="number"
                            value={tarif.couts.transport}
                            onChange={(e) => handleTarifChange(tarif.id, 'couts.transport', Number(e.target.value))}
                            placeholder="Coût transport"
                            className="p-2 border border-gray-300 rounded-lg"
                        />
                        </div> 
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={attr.name} className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                {attr.label}
                {attr.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type={attr.type === 'number' ? 'number' : 'text'}
                value={formData[attr.name] as string || ''}
                onChange={(e) => handleInputChange(attr.name, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={attr.placeholder}
                required={attr.required}
              />
            </div>
          );
        })}

        <div className="flex justify-end">
          <button 
            type="submit" 
            className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};

export default EntityForm;