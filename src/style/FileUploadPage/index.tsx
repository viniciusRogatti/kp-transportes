import { DetailedHTMLProps, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type DivProps = DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
type InputProps = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
type LabelProps = DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
type BtnProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

export function BoxInput({ className, ...props }: DivProps) {
  return <div className={cn('flex gap-2 text-[#f0f0f0]', className)} {...props} />;
}

export function BoxMessage({ className, ...props }: DivProps) {
  return <div className={cn('p-3 text-[#fefefe]', className)} {...props} />;
}

export function HiddenFileInput({ className, ...props }: InputProps) {
  return <input className={cn('absolute -z-10 h-[0.1px] w-[0.1px] overflow-hidden opacity-0', className)} {...props} />;
}

export function FileUploadLabel({ className, ...props }: LabelProps) {
  return <label className={cn('inline-block cursor-pointer rounded border border-[#ccc] bg-[#f0f0f0] px-3 py-1.5 text-black', className)} {...props} />;
}

export function UploadButton({ className, ...props }: BtnProps) {
  return <button className={cn('cursor-pointer px-3 py-1.5 text-black', className)} {...props} />;
}
