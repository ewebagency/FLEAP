//Component Liens site - contact emetteur / front uniquement
// -> DEPRECATED
/*
import React from 'react';
import { FormField } from './FormField';
import { BaseEntity } from '../types';

interface SiteContactFormProps {
  sites: BaseEntity[];
  contactEmetteurs: BaseEntity[];
  linkedItems: Array<{
    siteId: string;
    contactId: string;
  }>;
  onLink: (siteId: string, contactId: string) => void;
}

export const SiteContactForm: React.FC<SiteContactFormProps> = ({
  sites,
  contactEmetteurs,
  linkedItems,
  onLink,
}) => {
  const [selectedSite, setSelectedSite] = React.useState('');
  const [selectedContact, setSelectedContact] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSite && selectedContact) {
      onLink(selectedSite, selectedContact);
      setSelectedSite('');
      setSelectedContact('');
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Lier un site à un contact</h3>
      <form onSubmit={handleSubmit} className="flex gap-4 items-end mb-4">
        <FormField
          label="Site"
          value={selectedSite}
          onChange={setSelectedSite}
          options={sites.map((site) => ({ id: site.id, label: site.nom || '' }))}
        />
        <FormField
          label="Contact"
          value={selectedContact}
          onChange={setSelectedContact}
          options={contactEmetteurs.map((contact) => ({ id: contact.id, label: contact.nom || '' }))}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
        >
          Lier
        </button>
      </form>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Liens existants :</h4>
        <div className="space-y-2">
          {linkedItems.map((link, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                {sites.find((s) => s.id === link.siteId)?.nom}
              </span>
              <span>→</span>
              <span className="font-medium">
                {contactEmetteurs.find((c) => c.id === link.contactId)?.nom}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; */