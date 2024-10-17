import React from 'react';
import InputDeroulant from './InputDeroulant';
import InputText from './InputText';

const CollecteDemande = () => {

    return (
        <div>
            <button onClick={()=>document.getElementById('my_modal_1').showModal()} className="flex justify-between items-center bg-green-600 rounded-xl px-2 mx-1 cursor-pointer duration-300 focus:px-3 focus:py-1 active:scale-95 ">
                <div className="text-white mr-2 mb-1">🚚</div>
                <div className="text-white font-thin text-xs">Demander une collecte</div>
            </button>
            <dialog id="my_modal_1" className="modal">
                <div className="modal-box">
                    <h3 className="font-bold text-lg">Demande de collecte</h3>
                    <form className="my-2 p-6 border-[1px] border-gray-400 rounded-xl">
                        <div className='text-md font-bold'>Demande de collecte</div>
                        <div className='flex justify-between'>
                            <InputDeroulant titre="Filière" placeholder="Sélectionner une filière" options={['Plastique', 'Carton', 'DEEE']}/>
                            <InputDeroulant titre="Site" placeholder="Sélectionner un site" options={['Paris', 'Anger', 'Marseilles']}/>
                        </div>
                        <div className='flex justify-between'>
                            <InputText titre="Adresse d'enlèvement" placeholder="Adresse" type="text"/>
                            <InputDeroulant titre="Personne à contacter" placeholder="Prénom Nom" options={['Arthur Pouzargue', 'Auguste Holmes', 'Benjamin Steeg']}/>
                            <InputText titre="Email " placeholder="exemple@entreprise.fr" type="text"/>
                        </div>


                        <label className="block mb-2">
                            Nom:
                            <input type="text" name="name" className="input input-bordered w-full" required />
                        </label>
                        <label className="block mb-2">
                            Email:
                            <input type="email" name="email" className="input input-bordered w-full" required />
                        </label>
                        <label className="block mb-2">
                            Adresse:
                            <input type="text" name="address" className="input input-bordered w-full" required />
                        </label>
                        <div className="modal-action">
                            <button type="submit" className="btn">Envoyer</button>
                            <button type="button" className="btn" onClick={() => document.getElementById('my_modal_1').close()}>Fermer</button>
                        </div>
                    </form>
                </div>
            </dialog>
        </div>
        
    )
                    
}

export default CollecteDemande;
