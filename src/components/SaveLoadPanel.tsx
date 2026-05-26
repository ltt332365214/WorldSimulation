'use client';

import { useRef } from 'react';

export default function SaveLoadPanel({
  onExport, onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onExport}
        className="text-sm px-3 py-1 rounded border border-bronze/40 text-amber-200/70 hover:border-bronze-light hover:text-amber-100 transition-all"
      >
        导出存档
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="text-sm px-3 py-1 rounded border border-bronze/40 text-amber-200/70 hover:border-bronze-light hover:text-amber-100 transition-all"
      >
        导入存档
      </button>
    </div>
  );
}