export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-green-800">Bienvenue chez FLEAP</h1>
      <div className="mt-10 bg-green-800 rounded-lg shadow-lg p-6 max-w-sm w-full text-center">
        <div className="mt-4 text-lg text-white">Vous n&apos;êtes pas connecté</div>
        <a href="/auth/signin" className="mt-4 btn btn-primary w-full bg-green-600 hover:bg-green-500 text-white text-lg border-white hover:border-white">Se connecter</a>
        <div className="mt-6 flex justify-between items-center">
          <div className="text-sm text-gray-200">Vous n&apos;avez pas de compte ?</div>
          <a href="/auth/signup" className="btn btn-primary text-xs bg-green-600 hover:bg-green-500 text-white border-white hover:border-white">S'inscrire</a>
        </div>
      </div>
    </div>
  );
}
