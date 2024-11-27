import { BSD_on_Supabase } from "../interface/bsd_line";

const ColonneBSDs = ({ 
    BSDs, 
    selectedBSD, 
    setSelectedBSD,
}: { 
    BSDs: BSD_on_Supabase[],
    selectedBSD: string | null,
    setSelectedBSD: (id: string | null) => void,
}) => {
    return (
        <div className="space-y-4">
            {BSDs.map((bsd) => (
                <div key={bsd.id} 
                    className={`relative p-4 rounded-lg border transition-all duration-200
                        ${selectedBSD === bsd.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                    <div className="absolute top-4 right-4">
                        <input
                            type="radio"
                            name="bsd"
                            checked={selectedBSD === bsd.id}
                            onChange={() => setSelectedBSD(bsd.id)}
                            className="w-4 h-4 text-blue-600"
                        />
                    </div>
                    <div className="font-semibold text-gray-800 ml-5">
                        {new Date(bsd.created_at).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                    <div className="flex justify-between mb-4">
                        <div className="text-xs text-gray-600 mt-2">ID : {bsd.id}</div>
                    </div>
        
                    <div className="text-xs text-gray-600 mt-2 mb-4">
                        {bsd.infos_json.formAPI.createFormInput.recipient.company.name}
                    </div>
                    <div className="flex justify-between gap-2 mb-2">
                        <div className="text-xs text-gray-600 mt-2">
                            <p>CED : {bsd.infos_json.formAPI.createFormInput.wasteDetails.code}</p>
                            <p>{bsd.infos_json.formAPI.createFormInput.wasteDetails.name}</p>
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            {bsd.infos_json.formAPI.createFormInput.transporter.company.name}
                        </div>
                    </div>
                    <div className="flex justify-between gap-2">
                        <div className="text-xs text-gray-600 mt-2">
                            Lieu : {bsd.infos_json.formAPI.createFormInput.emitter.workSite.address}
                        </div>
                        <div className="text-xs text-gray-600 mt-2">
                            {bsd.infos_json.formAPI.createFormInput.emitter.workSite.city}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ColonneBSDs;
