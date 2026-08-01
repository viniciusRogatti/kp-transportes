import { CircleHelp } from 'lucide-react';
import { useTutorial } from './TutorialContext';

export default function TutorialHelpButton({ compact = false }: { compact?: boolean }) {
  const { openPageHelp } = useTutorial();
  return (
    <button
      type="button"
      data-tutorial="global-help"
      onClick={openPageHelp}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-text shadow-sm transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label="Abrir ajuda desta página"
      title="Ajuda desta página"
    >
      <CircleHelp className="h-5 w-5" />
      {!compact && <span className="hidden xl:inline">Ajuda</span>}
    </button>
  );
}
