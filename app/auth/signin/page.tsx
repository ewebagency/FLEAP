"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/app/database/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { Session } from '@supabase/supabase-js';
import { trackEvent } from '@/app/utils/mixpanel';

type SignInMethod = 'credentials' | 'session-refresh';
type SignInOutcome = 'success' | 'failure' | 'blocked';

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
  const [rememberMe, setRememberMe] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [sessionFound, setSessionFound] = useState(false);
  const [storedEmail, setStoredEmail] = useState('');
  const [hasTrackedView, setHasTrackedView] = useState(false);

  const getEmailDomain = () => {
    if (!email.includes('@')) {
      return null;
    }
    const [, domain] = email.split('@');
    return domain || null;
  };

  const emitSignInAttempt = (method: SignInMethod) => {
    trackEvent('Sign In - Attempt', {
      method,
      hasEmail: email.length > 0,
      emailDomain: getEmailDomain(),
      rememberMe,
      sessionFound,
      storedEmailMatch: storedEmail.length > 0 && storedEmail === email,
    });
  };

  const emitSignInResult = (
    method: SignInMethod,
    outcome: SignInOutcome,
    reason?: string,
    attemptOverride?: number
  ) => {
    const attemptCount = typeof attemptOverride === 'number' ? attemptOverride : loginAttempts;
    trackEvent('Sign In - Result', {
      method,
      outcome,
      reason: reason || null,
      hasEmail: email.length > 0,
      emailDomain: getEmailDomain(),
      rememberMe,
      attempts: attemptCount,
    });
  };
  
  // Gestion de l'hydratation
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || hasTrackedView) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const persistentSession = window.localStorage.getItem('fleap_session');
    const temporarySession = window.sessionStorage.getItem('fleap_session');
    trackEvent('Sign In - Page Viewed', {
      hasStoredEmail: storedEmail.length > 0,
      sessionFound,
      persistentSession: Boolean(persistentSession),
      temporarySession: Boolean(temporarySession),
    });
    setHasTrackedView(true);
  }, [isClient, hasTrackedView, storedEmail, sessionFound]);

  const REMEMBER_ME_ENABLED = isClient ? process.env.NEXT_PUBLIC_REMEMBER_ME_ENABLED === 'true' : false;

  // Restauration automatique de la session
  useEffect(() => {
    if (!REMEMBER_ME_ENABLED || !isClient) return;
    
    // On vérifie d'abord localStorage puis sessionStorage
    const sessionStr = localStorage.getItem('fleap_session') || sessionStorage.getItem('fleap_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session && session.access_token) {
          console.log('🔍 Session trouvée, récupération des informations...');
          
          // Récupérer l'email depuis la session Supabase
          supabase.auth.getUser(session.access_token).then(({ data, error }) => {
            if (data.user && !error) {
              console.log('✅ Email récupéré:', data.user.email);
              setStoredEmail(data.user.email || '');
              setEmail(data.user.email || '');
              setSessionFound(true);
              // Cocher automatiquement "Se souvenir de moi" si la session était dans localStorage
              if (localStorage.getItem('fleap_session')) {
                setRememberMe(true);
              }
            } else {
              console.error('❌ Erreur lors de la récupération de l\'email:', error);
              // Session invalide, on la supprime
              localStorage.removeItem('fleap_session');
              sessionStorage.removeItem('fleap_session');
            }
          });
        }
      } catch (e) {
        console.error('❌ Session corrompue:', e);
        localStorage.removeItem('fleap_session');
        sessionStorage.removeItem('fleap_session');
      }
    }
  }, [isClient]);

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
    const authMethod: SignInMethod = sessionFound && storedEmail === email ? 'session-refresh' : 'credentials';
    
    if (loginAttempts >= 5) {
      emitSignInResult(authMethod, 'blocked', 'too_many_attempts');
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

    emitSignInAttempt(authMethod);
    setLoading(true);

    // Si une session existe et qu'on a trouvé l'email, essayer de la restaurer
    if (sessionFound && storedEmail === email) {
      console.log('🔄 Tentative de restauration de session...');
      const sessionStr = localStorage.getItem('fleap_session') || sessionStorage.getItem('fleap_session');
      
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          if (session && session.refresh_token) {
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: session.refresh_token
            });
            
            if (error) {
              console.error('❌ Session expirée, connexion normale...');
              // Session expirée, on continue avec la connexion normale
            } else if (data.session) {
              console.log('✅ Session restaurée avec succès !');
              
              // Mettre à jour le stockage avec la nouvelle session
              const newSessionData = {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
              };
              
              if (rememberMe) {
                localStorage.setItem('fleap_session', JSON.stringify(newSessionData));
                sessionStorage.removeItem('fleap_session');
              } else {
                sessionStorage.setItem('fleap_session', JSON.stringify(newSessionData));
                localStorage.removeItem('fleap_session');
              }
              
              // Continuer avec le processus normal (MFA, etc.)
              await processSuccessfulAuth(data.session);
              emitSignInResult(authMethod, 'success', 'session_restored');
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          console.error('❌ Erreur lors de la restauration:', e);
        }
      }
    }

    // Connexion normale si pas de session ou session invalide
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (authError) {
      setLoading(false);
      const nextAttempts = loginAttempts + 1;
      setLoginAttempts(nextAttempts);
      emitSignInResult(authMethod, 'failure', authError.message, nextAttempts);
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

    // Stockage de la session selon le choix
    if (REMEMBER_ME_ENABLED) {
      const sessionData = {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
      };
      try {
        if (rememberMe) {
          localStorage.setItem('fleap_session', JSON.stringify(sessionData));
          sessionStorage.removeItem('fleap_session');
          console.log('💾 Session stockée dans localStorage (persistant)');
        } else {
          sessionStorage.setItem('fleap_session', JSON.stringify(sessionData));
          localStorage.removeItem('fleap_session');
          console.log('💾 Session stockée dans sessionStorage (temporaire)');
        }
      } catch (e) {
        console.error('❌ Erreur lors du stockage de la session:', e);
      }
    }

    await processSuccessfulAuth(authData.session);
    emitSignInResult(authMethod, 'success', 'credentials_authenticated');
    setLoading(false);
  };

  // Fonction pour traiter l'authentification réussie (MFA, etc.)
  const processSuccessfulAuth = async (session: Session) => {
    // Récupérer l'entreprise_id depuis profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('entreprise_id')
      .eq('user_id', session.user.id)
      .single();

    if (profileError) {
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
            // Désactiver et enlever le required si sessionFound
            required={!sessionFound}
            disabled={loginAttempts >= 5 || sessionFound}
          />
          {isClient && REMEMBER_ME_ENABLED && (
            <div className="flex items-center mb-4">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="mr-2"
                disabled={loginAttempts >= 5}
              />
              <label htmlFor="rememberMe" className="text-white text-sm select-none cursor-pointer">
                Se souvenir de moi
              </label>
            </div>
          )}
          <div className="relative group">
            <button 
              type="submit" 
              className={`w-full p-2 md:p-3 rounded bg-green-600 hover:bg-green-500 text-white text-base md:text-lg border-white hover:border-white
                ${(loading || loginAttempts >= 5) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading || loginAttempts >= 5}
            >
              {loading ? 'Chargement...' : 
               loginAttempts >= 5 ? 'Compte bloqué' : 
               sessionFound ? 'Identifiants retrouvés' : 'Se connecter'}
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
      {!sessionFound && (
        <MFAModal
          isOpen={showMFAModal}
          onClose={() => setShowMFAModal(false)}
          onVerify={handleMFAVerify}
          email={email}
        />
      )}
    </div>
  );
}
