"use client"
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Si l'URL contient un hash Supabase (#access_token=...&refresh_token=...&type=recovery)
    // on redirige vers /reset_password avec ces paramètres en query
    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      const type = params.get('type');
      if (access_token || refresh_token || type) {
        const qs = new URLSearchParams();
        if (access_token) qs.set('access_token', access_token);
        if (refresh_token) qs.set('refresh_token', refresh_token);
        if (type) qs.set('type', type);
        router.replace(`/reset_password?${qs.toString()}`);
        return;
      }
    }

    router.replace('/auth/signin'); // Redirection vers la nouvelle page
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl md:text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-2xl mx-auto text-center">
        <h2 className="text-xl md:text-3xl font-bold text-white mb-4 px-2 md:px-8">
          La plateforme qui révolutionne la gestion de vos déchets
        </h2>
        
        <div className="mt-6 md:mt-8 space-y-4 md:space-y-6">
          <div className="text-base md:text-lg text-gray-200 px-2">
            Passez de 2 mois à 2 jours pour la création de votre registre
          </div>
          
          <div className="flex flex-col space-y-3 md:space-y-4 px-4">
            <Link 
              href="/auth/signin" 
              className="w-full p-2.5 md:p-3 rounded bg-green-600 hover:bg-green-500 text-white text-base md:text-lg border-white hover:border-white transition-colors"
            >
              Se connecter
            </Link>
            
            <Link 
              href="/auth/signup" 
              className="w-full p-2.5 md:p-3 rounded bg-green-700 hover:bg-green-600 text-white text-base md:text-lg border-white hover:border-white transition-colors"
            >
              Créer un compte
            </Link>
          </div>

          <div className="mt-6 md:mt-8 text-xs md:text-sm text-gray-200 px-4">
            Rejoignez les entreprises qui font confiance à FLEAP pour simplifier leur gestion des déchets
          </div>
        </div>
      </div>
    </div>
  );
}
