import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
  description?: string | undefined;
  leftSection?: React.ReactNode;
  rightSection?: React.ReactNode;
  icon?: React.ReactNode;
  w?: unknown;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, label, error, description, leftSection, rightSection, icon, id: providedId, ...props }, ref) => {
  // W3-A: useId() yields stable, unique ids per render. Auto-generate when
  // caller did not supply one so the <label htmlFor> ↔ <input id> link is
  // always present (WCAG 1.3.1 + 3.3.2). Caller-provided id wins.
  const generatedId = React.useId();
  const inputId = providedId ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const descriptionId = description ? `${inputId}-desc` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const a11yProps = {
    'aria-invalid': error ? true as const : undefined,
    'aria-describedby': describedBy,
  };

  const showSection = leftSection ?? icon;
  const inputEl = showSection || rightSection ? (
    <div className="relative">
      {showSection && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showSection}</span>}
      <input
        id={inputId}
        type={type}
        className={cn(
          'field-emphasis flex h-11 w-full px-4 py-2.5 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/90 focus-visible:shadow-[0_0_0_4px_var(--leaf-ring),0_0_0_1px_var(--leaf)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
          showSection && 'pl-9',
          rightSection && 'pr-9',
          error && 'border-red-500',
          className,
        )}
        ref={ref}
        {...a11yProps}
        {...props}
      />
      {rightSection && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{rightSection}</span>}
    </div>
  ) : (
    <input
      id={inputId}
      type={type}
      className={cn(
        'field-emphasis flex h-11 w-full px-4 py-2.5 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/90 focus-visible:shadow-[0_0_0_4px_var(--leaf-ring),0_0_0_1px_var(--leaf)] focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-red-500',
        className,
      )}
      ref={ref}
      {...a11yProps}
      {...props}
    />
  );

  if (!label && !error && !description) return inputEl;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {props.required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}
      {inputEl}
      {description && <p id={descriptionId} className="text-xs text-muted-foreground">{description}</p>}
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
    </div>
  );
});
Input.displayName = 'Input';

export { Input };
