import { useEffect, useMemo, useState } from 'react';
import { IconDownload } from './Icons';
import { showSuccess, showWarning } from './Toaster';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return !!(
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone
  );
}

export default function InstallAppButton({ compact = false, fullWidth = false }) {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      showSuccess('smBank installed successfully.');
    };
    const handleVisibility = () => {
      if (isStandalone()) {
        setInstalled(true);
        setPromptEvent(null);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const label = useMemo(() => compact ? 'Install' : 'Install App', [compact]);

  if (installed) return null;

  const install = async () => {
    if (!promptEvent) {
      showWarning('To install this app, open your browser menu and choose Install App or Add to Home Screen.');
      return;
    }
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPromptEvent(null);
      if (choice && choice.outcome === 'accepted') {
        showSuccess('Installation started.');
      } else {
        showWarning('Installation cancelled.');
      }
    } catch {
      showWarning('Install prompt is not available right now.');
    }
  };

  return (
    <button
      type="button"
      className={`install-app-btn${compact ? ' compact' : ''}${fullWidth ? ' full' : ''}`}
      onClick={install}
      title="Install smBank app"
    >
      <IconDownload />
      <span>{label}</span>
    </button>
  );
}
