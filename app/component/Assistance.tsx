import { useState } from "react";

export default function Assistance() {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex items-center justify-start">
            <div onClick={() => setOpen(!open)} className="text-md font-bold text-gray-400 mt-2 bg-gray-200 cursor-pointer rounded-lg px-2 py-1">📞 Assistance</div>
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