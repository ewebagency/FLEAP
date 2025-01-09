import { useState } from "react";

export default function Assistance() {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-1">
            <button 
                onClick={() => setOpen(!open)} 
                className="w-full px-1 py-1 text-sm text-gray-700 rounded-lg hover:bg-gray-200 active:bg-gray-400 transition-colors duration-200 flex items-center gap-2"
            >
                <box-icon name='phone' size="sm" color="currentColor"></box-icon>
                <div className="ml-2">Assistance</div>
            </button>
            {open && 
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setOpen(false)}>
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-md text-center" onClick={e => e.stopPropagation()}>
                    <h2 className="text-2xl font-bold text-gray-800">Auguste Sohm</h2>
                    <p className="text-gray-600 mt-2">Service client</p>
                    <h3 className="text-lg font-semibold text-gray-700 mt-4">Contactez-nous :</h3>
                    <h3 className="text-lg text-gray-800">📞 06 52 90 65 15</h3>
                    <h3 className="text-lg text-gray-800">✉️ asohm@fleap.fr</h3>
                    <p className="text-gray-500 mt-4">Nous sommes là pour vous aider ! N&apos;hésitez pas à nous contacter pour toute question ou assistance.</p>
                    <button onClick={() => setOpen(false)} className="mt-4 bg-blue-500 text-white font-semibold py-2 px-4 rounded hover:bg-blue-600">Fermer</button>
                </div>
            </div>
            }
        </div>
    )
}