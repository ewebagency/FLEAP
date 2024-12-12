"use client"
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/signin'); // Redirection vers la nouvelle page
  }, []);
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-6 px-24 w-[60%] text-center">
        <h2 className="text-3xl font-bold text-white mb-4">La plateforme qui révolutionne la gestion de vos déchets</h2>
        
        <div className="mt-8 space-y-6">
          <div className="text-lg text-gray-200">
            Passez de 2 mois à 2 jours pour la création de votre registre
          </div>
          
          <div className="flex flex-col space-y-4">
            <Link 
              href="/auth/signin" 
              className="w-full p-3 rounded bg-green-600 hover:bg-green-500 text-white text-lg border-white hover:border-white transition-colors"
            >
              Se connecter
            </Link>
            
            <Link 
              href="/auth/signup" 
              className="w-full p-3 rounded bg-green-700 hover:bg-green-600 text-white text-lg border-white hover:border-white transition-colors"
            >
              Créer un compte
            </Link>
          </div>

          <div className="mt-8 text-sm text-gray-200">
            Rejoignez les entreprises qui font confiance à FLEAP pour simplifier leur gestion des déchets
          </div>
        </div>
      </div>
    </div>
  );
}
