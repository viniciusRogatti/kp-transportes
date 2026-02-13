import { ReactNode } from 'react';

interface CardsPagesProps {
  pageNames: string;
  children: ReactNode;
}

function CardsPages({ pageNames, children }: CardsPagesProps) {


  return (
    <div className="flex h-9 min-w-[6.5rem] w-max items-center justify-center gap-1.5 rounded-md border border-white/10 bg-surface/60 px-3 py-2 text-center transition hover:-translate-y-0.5 hover:border-white/35 hover:shadow-[0_8px_18px_rgba(2,12,20,0.35)] md:flex-col md:h-auto md:min-w-[4.2rem] md:px-2 md:py-1.5">
      {children}
      <p className="text-xs font-medium text-text md:text-[0.55rem]">{ pageNames }</p>
    </div>
  )
}

export default CardsPages
