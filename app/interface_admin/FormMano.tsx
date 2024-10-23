'use client';
import React, { useState } from 'react';

interface Item {
  siteName: string;
  cedCode: string;
  referenceDate: string;
  preparation: {
    quantity: string;
    weight: string;
    unitPrice: string;
    totalHT: string;
  };
  transport: {
    quantity: string;
    weight: string;
    unitPrice: string;
    totalHT: string;
  };
  treatment: {
    quantity: string;
    weight: string;
    unitPrice: string;
    totalHT: string;
  };
}
interface ReferencePersonInterface { siret: string; name: string; surname: string; date: string }
interface FormValuesInterface {referencePerson: ReferencePersonInterface, items: Item[]}
interface PdfManoProps {
  formValues: FormValuesInterface;
  handleChange: (index: number, field: string, value: string | Item[]) => void;
  isCompleted: boolean;
  onNext: () => void; // Function to go to the next PDF
}

const PdfMano: React.FC<PdfManoProps> = ({handleChange, isCompleted, onNext, session_user_id, pdfId }) => {
  const [pdfType, setPdfType] = useState<string>('Facture');
  const [referencePerson, setReferencePerson] = useState<ReferencePersonInterface>({
    siret: '',
    name: '',
    surname: '',
    date: '',
  });
  const [items, setItems] = useState<Item[]>([{
    siteName: '',
    cedCode: '',
    referenceDate: '',
    preparation: { quantity: '', weight: '', unitPrice: '', totalHT: '' },
    transport: { quantity: '', weight: '', unitPrice: '', totalHT: '' },
    treatment: { quantity: '', weight: '', unitPrice: '', totalHT: '' }
  }]);

  const handleSubmit = async () => {
    const json = {
        referencePerson: referencePerson,
        items: items
      };
    const dataToSend = {
    pdfId: pdfId,
    session_user_id : session_user_id,
    formValues : json,
    };
    console.log(dataToSend);
      try {
        const response = await fetch('api/store-info-mano', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSend),
        });
  
        if (!response.ok) {
          throw new Error('Erreur lors de l\'envoi des données');
        }
  
        const result = await response.json();
        console.log('Données soumises avec succès :', result);
  
      } catch (error) {
        console.error('Erreur lors de l\'envoi des données :', error);
      }
    
  };
 
  

  const handleAddItem = () => {
    setItems([...items, {
      siteName: '',
      cedCode: '',
      referenceDate: '',
      preparation: { quantity: '', weight: '', unitPrice: '', totalHT: '' },
      transport: { quantity: '', weight: '', unitPrice: '', totalHT: '' },
      treatment: { quantity: '', weight: '', unitPrice: '', totalHT: '' }
    }]);
  };

  const handleItemChange = (index: number, section: string, field: string, value: string) => {
    const updatedItems = [...items];
    
    if (section === 'siteName' || section === 'cedCode' || section === 'referenceDate') {
      updatedItems[index][section] = value;
    } else {
      updatedItems[index] = {
        ...updatedItems[index],
        [section]: {
          ...updatedItems[index][section],
          [field]: value
        }
      };
    }
  
    setItems(updatedItems);
    handleChange(0, 'items', updatedItems);  // Mise à jour globale des items dans formValues
  };

  const handleReferenceChange = (field: string, value: string) => {
    const updatedReferencePerson = { ...referencePerson, [field]: value };
    setReferencePerson(updatedReferencePerson);
    handleChange(0, 'referencePerson', updatedReferencePerson);  // Mise à jour globale de referencePerson
  };
  
  const handleDeleteItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    handleChange(index, 'items', updatedItems); // Pass updated items to parent
  };


  return (
    <div className='bg-gray-100 rounded-lg w-1/3 p-4 ml-4 mb-10 flex flex-col justify-between overflow-y-auto max-h-screen'>
      <div className='text-lg font-bold mb-2'>Informations à saisir :</div>
      {isCompleted ? (
        <div className="mt-4 text-green-500 font-bold">Terminé</div>
      ) : (
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          await handleSubmit(referencePerson, items, session_user_id, pdfId);
          onNext(); // Call onNext to proceed to the next PDF
        }} className='space-y-1'>
          <div>
            <label className="text-sm">Type de PDF :</label>
            <select value={pdfType} onChange={(e) => setPdfType(e.target.value)} className="border rounded text-sm w-full">
              <option value="Facture">Facture</option>
              <option value="BSD">BSD</option>
              <option value="Autre">Autre</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm">SIRET :</label>
              <input
                type="text"
                value={referencePerson.siret}
                onChange={(e) => handleReferenceChange('siret', e.target.value)}
                className="border rounded w-full"
              />
            </div>
            <div>
              <label className="text-sm">Date d'enlèvement :</label>
              <input
                type="date"
                value={referencePerson.date}
                onChange={(e) => handleReferenceChange('date', e.target.value)}
                className="border rounded w-full"
              />
            </div>
            <div>
              <label className="text-sm">Nom :</label>
              <input
                type="text"
                value={referencePerson.name}
                onChange={(e) => handleReferenceChange('name', e.target.value)}
                className="border rounded w-full"
              />
            </div>
            <div>
              <label className="text-sm">Prénom :</label>
              <input
                type="text"
                value={referencePerson.surname}
                onChange={(e) => handleReferenceChange('surname', e.target.value)}
                className="border rounded w-full"
              />
            </div>
          </div>
          <div className="mt-4">
            {items.map((item, index) => (
              <div key={index} className="border rounded p-2 mb-2">
                <h4 className="font-semibold text-sm">Item {index + 1}</h4>
                <div>
                  <label className="font-semibold text-xs">Nom du site :</label>
                  <input
                    type="text"
                    value={item.siteName}
                    onChange={(e) => handleItemChange(index, 'siteName', 'siteName', e.target.value)}
                    className="border rounded w-full"
                  />
                </div>
                <div className='grid grid-cols-2 gap-2'>
                    <div>
                    <label className="font-semibold text-xs">Code CED :</label>
                    <input
                        type="text"
                        value={item.cedCode}
                        onChange={(e) => handleItemChange(index, 'cedCode', 'cedCode', e.target.value)}
                        className="border rounded w-full"
                    />
                    </div>
                    <div>
                    <label className="font-semibold text-xs">Date de référence :</label>
                    <input
                        type="date"
                        value={item.referenceDate}
                        onChange={(e) => handleItemChange(index, 'referenceDate', 'referenceDate', e.target.value)}
                        className="border rounded w-full"
                    />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <h4 className="font-semibold text-sm">Préparation</h4>
                    <div>
                      <label className="font-semibold text-xs">Qté :</label>
                      <input
                        type="text"
                        value={item.preparation.quantity}
                        onChange={(e) => handleItemChange(index, 'preparation', 'quantity', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Poids :</label>
                      <input
                        type="text"
                        value={item.preparation.weight}
                        onChange={(e) => handleItemChange(index, 'preparation', 'weight', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">PU :</label>
                      <input
                        type="text"
                        value={item.preparation.unitPrice}
                        onChange={(e) => handleItemChange(index, 'preparation', 'unitPrice', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Total HT :</label>
                      <input
                        type="text"
                        value={item.preparation.totalHT}
                        onChange={(e) => handleItemChange(index, 'preparation', 'totalHT', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Transport</h4>
                    <div>
                      <label className="font-semibold text-xs">Qté :</label>
                      <input
                        type="text"
                        value={item.transport.quantity}
                        onChange={(e) => handleItemChange(index, 'transport', 'quantity', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Poids :</label>
                      <input
                        type="text"
                        value={item.transport.weight}
                        onChange={(e) => handleItemChange(index, 'transport', 'weight', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">PU :</label>
                      <input
                        type="text"
                        value={item.transport.unitPrice}
                        onChange={(e) => handleItemChange(index, 'transport', 'unitPrice', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Total HT :</label>
                      <input
                        type="text"
                        value={item.transport.totalHT}
                        onChange={(e) => handleItemChange(index, 'transport', 'totalHT', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Traitement</h4>
                    <div>
                      <label className="font-semibold text-xs">Qté :</label>
                      <input
                        type="text"
                        value={item.treatment.quantity}
                        onChange={(e) => handleItemChange(index, 'treatment', 'quantity', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Poids :</label>
                      <input
                        type="text"
                        value={item.treatment.weight}
                        onChange={(e) => handleItemChange(index, 'treatment', 'weight', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">PU :</label>
                      <input
                        type="text"
                        value={item.treatment.unitPrice}
                        onChange={(e) => handleItemChange(index, 'treatment', 'unitPrice', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-xs">Total HT :</label>
                      <input
                        type="text"
                        value={item.treatment.totalHT}
                        onChange={(e) => handleItemChange(index, 'treatment', 'totalHT', e.target.value)}
                        className="border rounded w-full"
                      />
                    </div>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => handleDeleteItem(index)} 
                  className="mt-2 bg-red-500 text-white rounded-md px-2 py-1 hover:bg-red-600 transition duration-200"
                >
                  Supprimer
                </button>
              </div>
            ))}
            <button type="button" onClick={handleAddItem} className="mt-2 bg-blue-500 text-white rounded-md px-4 py-2 hover:bg-blue-600 transition duration-200">
              Ajouter un item
            </button>
          </div>

          <button 
            type="submit"
            className='mt-4 bg-green-500 text-white rounded-md px-4 py-2 hover:bg-green-600 transition duration-200'
          >
            Valider et passer au suivant
          </button>
        </form>
      )}
    </div>
  );
};

export default PdfMano;
