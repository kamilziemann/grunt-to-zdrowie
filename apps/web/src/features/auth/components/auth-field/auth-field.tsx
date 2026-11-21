import type { ChangeEvent, HTMLInputAutoCompleteAttribute } from 'react';

export interface AuthFieldProps {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  autoComplete: HTMLInputAutoCompleteAttribute;
  /** komunikat bledu pola (juz przetlumaczony); brak = pole poprawne */
  error?: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** Pole formularza auth w stylu aplikacji: etykieta, pole na `card`, blad powiazany przez aria-describedby. */
export function AuthField({
  id,
  label,
  type = 'text',
  value,
  autoComplete,
  error,
  disabled,
  onChange,
}: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={disabled}
        className="h-13 w-full rounded-lg border bg-card px-4 text-[17px] text-foreground outline-offset-3 aria-invalid:outline-2 aria-invalid:outline-destructive disabled:text-muted-foreground"
      />
      {error && (
        <p id={`${id}-error`} className="m-0 text-[15px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
