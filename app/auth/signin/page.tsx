"use client"

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginAttempts >= 5) {
      Swal.fire({
        title: 'Compte bloqué',
        text: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6',
        showClass: {
          popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        }
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setLoginAttempts(prev => prev + 1);
      const remainingAttempts = 5 - loginAttempts - 1;
      
      Swal.fire({
        title: 'Erreur de connexion',
        text: remainingAttempts > 0 
          ? `Email ou mot de passe incorrect. Il vous reste ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''}.`
          : 'Email ou mot de passe incorrect. Compte bloqué après 5 tentatives.',
        icon: 'error',
        confirmButtonText: 'Réessayer',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6',
        showClass: {
          popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        }
      });
    } else {
      router.push('/register');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl md:text-4xl font-bold text-green-800">FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-4 md:p-6 w-full max-w-md md:px-12">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Connexion</h2>
        <form onSubmit={handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 p-2 md:p-3 mb-4 w-full rounded"
            required
            disabled={loginAttempts >= 5}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 p-2 md:p-3 mb-6 w-full rounded"
            required
            disabled={loginAttempts >= 5}
          />
          <div className="relative group">
            <button 
              type="submit" 
              className={`w-full p-2 md:p-3 rounded bg-green-600 hover:bg-green-500 text-white text-base md:text-lg border-white hover:border-white
                ${(loading || loginAttempts >= 5) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading || loginAttempts >= 5}
            >
              {loading ? 'Chargement...' : loginAttempts >= 5 ? 'Compte bloqué' : 'Se connecter'}
            </button>
            {loginAttempts >= 5 && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Veuillez envoyer un mail à asohm@fleap.fr ou réessayer plus tard
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        </form>
        <div className="mt-6 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
          <div className="text-sm text-gray-200">Vous n&apos;avez pas de compte ?</div>
          <Link 
            href="/auth/signup" 
            className="btn btn-primary text-xs bg-green-600 hover:bg-green-500 text-white border-white hover:border-white px-4 py-2"
          >
            S&apos;inscrire
          </Link>
        </div>
      </div>
    </div>
  );
}
