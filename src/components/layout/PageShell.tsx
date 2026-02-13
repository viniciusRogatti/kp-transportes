import { ReactNode } from 'react';
import Header from '../Header';

interface PageShellProps {
  children: ReactNode;
}

function PageShell({ children }: PageShellProps) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}

export default PageShell;
