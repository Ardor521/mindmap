
import { useRef, type FocusEvent, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

function useClearPlaceholder(value: string, placeholder: string, onChange: (v: string) => void) {
  const cleared = useRef(false);
  return (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!cleared.current && (value === placeholder || value === '')) {
      if (value === placeholder) onChange('');
      cleared.current = true;
      requestAnimationFrame(() => e.target.select());
    } else if (value === placeholder) {
      onChange('');
      requestAnimationFrame(() => e.target.select());
    }
  };
}

export function ClearableInput({ value, onChange, placeholder, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void; placeholder: string }) {
  const onFocus = useClearPlaceholder(value, placeholder, onChange);
  return <input {...rest} value={value} placeholder={placeholder} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} className={className} />;
}

export function ClearableTextarea({ value, onChange, placeholder, className, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void; placeholder: string }) {
  const onFocus = useClearPlaceholder(value, placeholder, onChange);
  return <textarea {...rest} value={value} placeholder={placeholder} onFocus={onFocus} onChange={(e) => onChange(e.target.value)} className={className} />;
}
