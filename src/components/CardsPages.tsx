import { ReactNode } from 'react';
import { CardPageStyle } from '../style/CardPages'

interface CardsPagesProps {
  pageNames: string;
  children: ReactNode;
}

function CardsPages({ pageNames, children }: CardsPagesProps) {


  return (
    <CardPageStyle>
      {children}
      <p>{ pageNames }</p>
    </CardPageStyle>
  )
}

export default CardsPages