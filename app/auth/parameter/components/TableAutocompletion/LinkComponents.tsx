/*import React, { useState } from 'react';
import { Site, Transporteur, Dechet, Destinataire, Contenant, ContactEmetteur } from './AutocompletionTab';

interface TransportLink {
  site: string;
  dechet: string;
}

interface DestLink {
  site: string;
  dechet: string;
}

interface ContenantLink {
  site: string;
  dechet: string;
}

interface SiteContactLink {
  site: string;
  contact: string;
}

interface LinkFormProps {
  title: string;
  items: (Site | Transporteur | Dechet | Destinataire | Contenant)[];
  sites: Site[];
  dechets: Dechet[];
  linkedItems: (TransportLink | DestLink | ContenantLink)[];
  onLink: (itemId: string, siteId: string, dechetId: string) => void;
  mainField: string;
}

const LinkForm: React.FC<LinkFormProps> = ({ 
  title, 
  items, 
  sites, 
  dechets,
  linkedItems, 
  onLink, 
  mainField 
}) => {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [selectedDechet, setSelectedDechet] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItem && selectedSite && selectedDechet) {
      onLink(selectedItem, selectedSite, selectedDechet);
      setSelectedItem('');
      setSelectedSite('');
      setSelectedDechet('');
    }
  };

  const getItemName = (id: string, items: (Site | Transporteur | Dechet | Destinataire | Contenant)[]) => {
    const item = items.find(item => item.id === id);
    if (!item) return '';
    if ('nomBoite' in item) return item.nomBoite;
    if ('nom' in item) return item.nom;
    return '';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
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
            <span className="text-gray-500 text-sm">+</span>
          </div>

          <div className="w-40">
            <select
              value={selectedDechet}
              onChange={(e) => setSelectedDechet(e.target.value)}
              className="w-full p-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Déchet</option>
              {dechets.map((dechet) => (
                <option key={dechet.id} value={dechet.id}>
                  {dechet.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-sm">→</span>
          </div>

          <div className="w-40">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full p-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Item à lier</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {getItemName(item.id, items)}
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
            const dechet = dechets.find(d => d.id === link.dechet);
            const linkedItem = items[index];
            return (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">
                  {site?.nom} + {dechet?.nom} → {getItemName(linkedItem?.id || '', items)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface SiteContactFormProps {
  sites: Site[];
  contactEmetteurs: ContactEmetteur[];
  linkedItems: SiteContactLink[];
  onLink: (siteId: string, contactId: string) => void;
}

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

interface LinkComponentsProps {
  sites: Site[];
  transporteurs: Transporteur[];
  dechets: Dechet[];
  destinataires: Destinataire[];
  contenants: Contenant[];
  contactEmetteurs: ContactEmetteur[];
  transportLinks: TransportLink[];
  destLinks: DestLink[];
  contenantLinks: ContenantLink[];
  siteContactLinks: SiteContactLink[];
  onTransportLink: (transportId: string, siteId: string, dechetId: string) => void;
  onDestLink: (destId: string, siteId: string, dechetId: string) => void;
  onContenantLink: (contenantId: string, siteId: string, dechetId: string) => void;
  onSiteContactLink: (siteId: string, contactId: string) => void;
}

const LinkComponents: React.FC<LinkComponentsProps> = ({
  sites,
  transporteurs,
  dechets,
  destinataires,
  contenants,
  contactEmetteurs,
  transportLinks,
  destLinks,
  contenantLinks,
  siteContactLinks,
  onTransportLink,
  onDestLink,
  onContenantLink,
  onSiteContactLink,
}) => {
  return (
    <div className="flex flex-col gap-8">
      <LinkForm
        title="Liens Transporteur"
        items={transporteurs}
        sites={sites}
        dechets={dechets}
        linkedItems={transportLinks}
        onLink={onTransportLink}
        mainField="nomBoite"
      />

      <LinkForm
        title="Liens Destinataire"
        items={destinataires}
        sites={sites}
        dechets={dechets}
        linkedItems={destLinks}
        onLink={onDestLink}
        mainField="nomBoite"
      />

      <LinkForm
        title="Liens Contenant"
        items={contenants}
        sites={sites}
        dechets={dechets}
        linkedItems={contenantLinks}
        onLink={onContenantLink}
        mainField="nom"
      />

      <SiteContactForm
        sites={sites}
        contactEmetteurs={contactEmetteurs}
        linkedItems={siteContactLinks}
        onLink={onSiteContactLink}
      />
    </div>
  );
};

export default LinkComponents;
*/