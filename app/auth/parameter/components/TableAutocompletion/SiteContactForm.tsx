/*import React, { useState } from 'react';
import { SiteContactFormProps } from './types';

const SiteContactForm: React.FC<SiteContactFormProps> = ({
  sites,
  contactEmetteurs,
  linkedItems,
  onLink,
}) => {
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSite && selectedContact) {
      onLink(selectedSite, selectedContact);
      setSelectedSite('');
      setSelectedContact('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Liens Site - Contact Émetteur</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-start gap-4">
          <div className="w-40">
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full p-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-sm">→</span>
          </div>

          <div className="w-40">
            <select
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
              className="w-full p-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Contact</option>
              {contactEmetteurs.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.prenomNom}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-[var(--green-medium)] hover:bg-[var(--green-light)] text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all"
          >
            Lier
          </button>
        </div>
      </form>

      <div className="mt-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Liens existants</h4>
        <div className="space-y-2">
          {linkedItems.map((link, index) => {
            const site = sites.find(s => s.id === link.site);
            const contact = contactEmetteurs.find(c => c.id === link.contact);
            return (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">
                  {site?.nom} → {contact?.prenomNom}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SiteContactForm; */