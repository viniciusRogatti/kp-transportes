import { ReactNode } from 'react';
import Card from './Card';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card className="text-center">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export default EmptyState;
