"use client";

import { useRouter } from "next/navigation";

export default function MerciPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-8 w-[60%] text-center">
        <h2 className="text-2xl font-bold text-white mb-6">
          Merci pour votre inscription !
        </h2>
        
        <p className="text-gray-200 mb-6">
          Nous vous contacterons par email pour donner suite à cette demande d&apos;inscription.
        </p>

        <div className="space-y-4">
          <p className="text-sm text-gray-200">
            N&apos;hésitez pas à nous suivre sur les réseaux pour rester informé.
          </p>

          <button 
            onClick={() => router.push("/")}
            className="w-full p-3 rounded bg-green-600 hover:bg-green-500 text-white text-lg border-white hover:border-white transition-colors"
          >
            Retourner à l&apos;accueil
          </button>
        </div>
      </div>
    </div>
  );
}
