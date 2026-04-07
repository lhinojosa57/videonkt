import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen bg-sepia-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold text-ink-900 mb-2">VideoNKT</h1>
          <p className="font-body text-ink-600 text-lg italic">Plataforma Educativa NEM</p>
        </div>

        <div className="bg-parchment-50 rounded-sm shadow-raised p-8 border border-parchment-200">
          <h2 className="font-display text-2xl text-ink-800 mb-2 text-center">Bienvenido/a</h2>
          <p className="text-ink-600 text-sm text-center mb-8 font-body">
            Accede con tu cuenta de Google Workspace educativa
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-parchment-300 rounded px-5 py-3.5 text-ink-800 font-body font-medium hover:bg-parchment-50 hover:border-gold-400 transition-all shadow-manuscript"
          >
            <span>Continuar con Google</span>
          </button>

          <div className="mt-6 p-4 bg-sepia-100 rounded border border-parchment-200">
            <p className="text-xs text-ink-600 font-body text-center">
              🔒 Solo cuentas <span className="font-semibold text-crimson-500">@nikolatesla.edu.mx</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}