"use client"

import { useState } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';

interface MFAModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (code: string) => void;
  email: string;
}

const MFAModal = ({ isOpen, onClose, onVerify, email }: MFAModalProps) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Le code doit contenir 6 chiffres');
      return;
    }
    onVerify(code);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Vérification en deux étapes</h2>
        <p className="mb-4">Un code de vérification a été envoyé à {email}</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
              setError('');
            }}
            placeholder="Entrez le code à 6 chiffres"
            className="border border-gray-300 p-2 w-full rounded mb-4"
            maxLength={6}
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500"
            >
              Vérifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showMFAModal, setShowMFAModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpExpiry, setOtpExpiry] = useState<Date | null>(null);
  const router = useRouter();

  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const sendOTPEmail = async (email: string, code: string) => {
    try {
      const response = await fetch('/api/send_mail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: 'Code de vérification FLEAP',
          text: `Votre code de vérification est : ${code}\n\nCe code est valable pendant 5 minutes.`,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi du code');
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du code:', error);
      throw error;
    }
  };

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
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (authError) {
      setLoading(false);
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
      return;
    }

    // Récupérer l'entreprise_id depuis profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('entreprise_id')
      .eq('user_id', authData.user.id)
      .single();

    if (profileError) {
      setLoading(false);
      Swal.fire({
        title: 'Erreur',
        text: 'Erreur lors de la récupération du profil.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6'
      });
      return;
    }

    // Vérifier si MFA est activé pour l'entreprise
    const { data: entrepriseData, error: entrepriseError } = await supabase
      .from('entreprise')
      .select('mfa')
      .eq('id', profileData.entreprise_id)
      .single();

    if (entrepriseError) {
      setLoading(false);
      Swal.fire({
        title: 'Erreur',
        text: 'Erreur lors de la vérification MFA.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6'
      });
      return;
    }

    if (entrepriseData.mfa) {
      // Générer et envoyer le code OTP
      const otp = generateOTP();
      setOtpCode(otp);
      setOtpExpiry(new Date(Date.now() + 5 * 60 * 1000)); // 5 minutes
      
      try {
        await sendOTPEmail(email, otp);
        setShowMFAModal(true);
      } catch (error) {
        Swal.fire({
          title: 'Erreur',
          text: 'Erreur lors de l\'envoi du code de vérification.',
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#16a34a',
          background: '#f3f4f6'
        });
      }
    } else {
      // Si MFA n'est pas activé, rediriger directement
      console.log('Le MFA n\'est pas activé pour cette entreprise');
      router.push('/register');
    }
    
    setLoading(false);
  };

  const handleMFAVerify = (code: string) => {
    if (!otpExpiry || Date.now() > otpExpiry.getTime()) {
      Swal.fire({
        title: 'Code expiré',
        text: 'Le code de vérification a expiré. Veuillez vous reconnecter.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6'
      });
      setShowMFAModal(false);
      return;
    }

    if (code === otpCode) {
      setShowMFAModal(false);
      router.push('/register');
    } else {
      Swal.fire({
        title: 'Code incorrect',
        text: 'Le code de vérification est incorrect.',
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#16a34a',
        background: '#f3f4f6'
      });
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
      <MFAModal
        isOpen={showMFAModal}
        onClose={() => setShowMFAModal(false)}
        onVerify={handleMFAVerify}
        email={email}
      />
    </div>
  );
}
