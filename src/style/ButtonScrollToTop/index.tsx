import { DetailedHTMLProps, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface IButtonScrollToTopStyle {
  isvisible: string;
}

type Props = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & IButtonScrollToTopStyle;

export function ButtonScrollToTopStyle({ isvisible, className, ...props }: Props) {
  return (
    <button
      className={cn(
        isvisible === 'true' ? 'block' : 'hidden',
        'fixed bottom-5 right-5 rounded-full border-2 border-black bg-[#ECF3FD] p-2.5 text-[30px] text-[#001428]',
        className,
      )}
      {...props}
    />
  );
}
