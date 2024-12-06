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
                    className={`relative p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md
                        ${selectedBSD === bsd.id
                            ? 'border-blue-500 bg-blue-50/50' 
                            : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="bsd"
                                checked={selectedBSD === bsd.id}
                                onChange={() => setSelectedBSD(bsd.id)}
                                className="w-4 h-4 text-blue-600"
                            />
                            <h3 className="font-medium text-gray-900">
                                {bsd.infos_json.formAPI.createFormInput.recipient.company.name}
                            </h3>
                        </div>
                        <span className="text-sm text-gray-500">
                            {new Date(bsd.created_at).toLocaleDateString('fr-FR')}
                        </span>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="text-sm text-gray-600">
                                    {bsd.infos_json.formAPI.createFormInput.wasteDetails.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    CED : {bsd.infos_json.formAPI.createFormInput.wasteDetails.code}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">
                                    {bsd.infos_json.formAPI.createFormInput.transporter.company.name}
                                </p>
                                <p className="text-xs text-gray-500">ID : {bsd.id}</p>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div className="text-sm text-gray-600">
                                    {bsd.infos_json.formAPI.createFormInput.emitter.workSite.address}
                                </div>
                                <div className="text-sm font-medium text-gray-700">
                                    {bsd.infos_json.formAPI.createFormInput.emitter.workSite.city}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ColonneBSDs;
