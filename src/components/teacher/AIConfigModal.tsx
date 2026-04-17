import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'

export interface AIConfig {
  multiple_choice: number
  true_false: number
  open: number
}

interface AIConfigModalProps {
  onConfirm: (config: AIConfig) => void
  onClose: () => void
}

export default function AIConfigModal({ onConfirm, onClose }: AIConfigModalProps) {
  const [config, setConfig] = useState<AIConfig>({
    multiple_choice: 3,
    true_false: 2,
    open: 1,
  })

  const total = config.multiple_choice + config.true_false + config.open

  const update = (key: keyof AIConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: Math.max(0, Math.min(10, value)) }))
  }

  return (
    <div className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-parchment-50 rounded-sm shadow-raised w-full max-w-sm border border-parchment-200 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-parchment-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-crimson-500 rounded flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-parchment-50" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-800 leading-tight">Configurar preguntas</h2>
              <p className="text-xs text-ink-400 font-body">¿Cuántas preguntas de cada tipo?</p>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {[
            { key: 'multiple_choice' as keyof AIConfig, label: 'Opción múltiple', color: 'bg-gold-400/20 text-gold-600' },
            { key: 'true_false' as keyof AIConfig, label: 'Verdadero / Falso', color: 'bg-crimson-500/10 text-crimson-500' },
            { key: 'open' as keyof AIConfig, label: 'Pregunta abierta', color: 'bg-ink-600/10 text-ink-600' },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className={`text-xs px-2 py-1 rounded font-mono flex-shrink-0 ${color}`}>
                {label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => update(key, config[key] - 1)}
                  className="w-7 h-7 rounded border border-parchment-300 bg-white text-ink-700 font-mono font-bold hover:bg-sepia-100 transition-colors flex items-center justify-center"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono font-bold text-ink-800 text-lg">
                  {config[key]}
                </span>
                <button
                  onClick={() => update(key, config[key] + 1)}
                  className="w-7 h-7 rounded border border-parchment-300 bg-white text-ink-700 font-mono font-bold hover:bg-sepia-100 transition-colors flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="border-t border-parchment-200 pt-4 flex items-center justify-between">
            <span className="text-sm font-body text-ink-600">Total</span>
            <span className={`font-mono font-bold text-xl ${total === 0 ? 'text-crimson-500' : 'text-ink-800'}`}>
              {total} pregunta{total !== 1 ? 's' : ''}
            </span>
          </div>

          {total === 0 && (
            <p className="text-xs text-crimson-500 font-body text-center">
              Selecciona al menos una pregunta
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-parchment-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-parchment-300 text-ink-700 rounded-sm font-body text-sm hover:bg-sepia-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(config)}
            disabled={total === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-crimson-500 text-parchment-50 rounded-sm font-body text-sm font-medium hover:bg-crimson-600 disabled:opacity-40 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generar
          </button>
        </div>
      </div>
    </div>
  )
}