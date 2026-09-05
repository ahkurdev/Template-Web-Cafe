import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  judul: string;
  onTutup: () => void;
  children: ReactNode;
  lebar?: string;
}

/**
 * Dialog native (`<dialog>`): fokus terkurung, Escape menutup, dan backdrop
 * tanpa JS tambahan. Menulis modal sendiri berarti menulis ulang semua itu.
 */
export function Modal({ judul, onTutup, children, lebar = 'max-w-md' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el?.open) el?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onTutup();
      }}
      onClick={(e) => {
        // Klik di backdrop = target dialog itu sendiri, bukan isinya.
        if (e.target === ref.current) onTutup();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${lebar} rounded-2xl bg-[var(--color-surface)] p-0 text-[var(--color-fg)] backdrop:bg-black/40`}
    >
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <h2 className="font-semibold">{judul}</h2>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup"
          className="grid size-9 place-items-center rounded-lg text-lg text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
        >
          ×
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
