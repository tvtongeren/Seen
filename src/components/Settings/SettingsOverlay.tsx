import { X } from 'lucide-react'
import SettingsPage from './SettingsPage'

type SettingsPageProps = Parameters<typeof SettingsPage>[0]

interface Props extends SettingsPageProps {
  onClose: () => void
}

/**
 * Settings as a full-screen overlay on top of the map, not a separate
 * screen — the map is the app; this closes back to it rather than
 * navigating away.
 */
export default function SettingsOverlay({ onClose, ...settingsProps }: Props) {
  return (
    <div className="absolute inset-0 z-[2000] bg-slate-900 flex flex-col">
      <div className="flex items-center justify-between px-5 pt-6 pb-4 flex-shrink-0 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-2 -mr-2 transition-colors"
          aria-label="Close settings"
        >
          <X size={22} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <SettingsPage {...settingsProps} />
      </div>
    </div>
  )
}
