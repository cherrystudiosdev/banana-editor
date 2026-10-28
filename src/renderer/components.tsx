import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useText } from './i18n';
export function IconButton({ label, children, onClick, disabled, active, className = '' }: { label: string; children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; className?: string }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} className={`icon-button ${active ? 'active' : ''} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const t = useText();
  useEffect(() => { const d = ref.current!; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={ref} className={wide ? 'dialog wide' : 'dialog'} onCancel={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}><div className="dialog-heading"><h2>{title}</h2><IconButton label={t('close')} onClick={onClose}><X size={18}/></IconButton></div>{children}</dialog>;
}
export function NumberField({ label, value, onChange, step = 1, min, max, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: ReactNode }) {
  return <label className="number-field"><span>{label}</span><span className="number-input"><input aria-label={label} key={value} type="number" defaultValue={Number(value.toFixed(4))} step={step} min={min} max={max} onBlur={e => { const n = Number(e.target.value); if (Number.isFinite(n) && n !== value) onChange(n); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}/>{suffix}</span></label>;
}
export function BananaLogo({ size = 30 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#f4dc54"/><path d="M10 13c2 10 10 15 21 10-4 9-13 12-20 5-4-4-5-10-1-15Z" fill="#202116"/><path d="m28 20 4-3 2 3-3 4" fill="#202116"/></svg>; }
