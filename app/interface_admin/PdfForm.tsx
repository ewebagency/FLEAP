'use client';
import React from 'react';

interface PdfFormProps {
  formValues: any[];
  handleChange: (index: number, field: string, value: string) => void;
  handleSubmit: () => Promise<void>;
  isCompleted: boolean;
  onNext: () => void; // Add onNext prop
}

const PdfForm: React.FC<PdfFormProps> = ({ formValues, handleChange, handleSubmit, isCompleted, onNext }) => {
  return (
    <div className='bg-gray-100 rounded-lg w-1/3 p-4 ml-4 mb-10 flex flex-col justify-between overflow-y-auto max-h-screen'>
      <div className='text-lg font-bold mb-4'>Informations extraites :</div>
      {isCompleted ? (
        <div className="mt-4 text-green-500 font-bold">Terminé</div>
      ) : (
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          await handleSubmit(); // Call handleSubmit
          onNext(); // Call onNext to proceed to the next PDF
        }} className='mt-2 space-y-4'>
          {formValues && formValues.length > 0 ? (
            formValues.map((row, index) => (
              <div key={index} className='bg-white rounded-lg shadow-md p-4 text-xs'>
                <h3 className="font-bold text-sm mb-2">Dossier {index + 1}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-semibold">N° de dossier :</label>
                    <input
                      type="text"
                      value={row.dossierNumber}
                      onChange={(e) => handleChange(index, 'dossierNumber', e.target.value)}
                      className="border rounded p-1 w-full"
                    />
                  </div>
                  <div>
                    <label className="font-semibold">N° CED :</label>
                    <input
                      type="text"
                      value={row.cedNumber}
                      onChange={(e) => handleChange(index, 'cedNumber', e.target.value)}
                      className="border rounded p-1 w-full"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="font-semibold">Ligne avec +</h4>
                  <div className="flex flex-wrap gap-2">
                    <label className="font-semibold">Description :</label>
                    <input
                      type="text"
                      value={row.description_plus}
                      onChange={(e) => handleChange(index, 'description_plus', e.target.value)}
                      className="border rounded p-1 w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="font-semibold">Type :</label>
                      <input
                        type="text"
                        value={row.type_plus}
                        onChange={(e) => handleChange(index, 'type_plus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Total HT :</label>
                      <input
                        type="text"
                        value={row.total_ht_plus}
                        onChange={(e) => handleChange(index, 'total_ht_plus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Prix unitaire :</label>
                      <input
                        type="text"
                        value={row.prix_unitaire_plus}
                        onChange={(e) => handleChange(index, 'prix_unitaire_plus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Quantité :</label>
                      <input
                        type="text"
                        value={row.quantite_plus}
                        onChange={(e) => handleChange(index, 'quantite_plus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="font-semibold">Ligne avec -</h4>
                  <div className="flex flex-wrap gap-2">
                    <label className="font-semibold">Description :</label>
                    <input
                      type="text"
                      value={row.description_minus}
                      onChange={(e) => handleChange(index, 'description_minus', e.target.value)}
                      className="border rounded p-1 w-full"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="font-semibold">Type :</label>
                      <input
                        type="text"
                        value={row.type_minus}
                        onChange={(e) => handleChange(index, 'type_minus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Total HT :</label>
                      <input
                        type="text"
                        value={row.total_ht_minus}
                        onChange={(e) => handleChange(index, 'total_ht_minus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Prix unitaire :</label>
                      <input
                        type="text"
                        value={row.prix_unitaire_minus}
                        onChange={(e) => handleChange(index, 'prix_unitaire_minus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">Quantité :</label>
                      <input
                        type="text"
                        value={row.quantite_minus}
                        onChange={(e) => handleChange(index, 'quantite_minus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold">TVA :</label>
                      <input
                        type="text"
                        value={row.tva_minus}
                        onChange={(e) => handleChange(index, 'tva_minus', e.target.value)}
                        className="border rounded p-1 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>Aucune information extraite trouvée.</p>
          )}
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

export default PdfForm;
