'use client';

import { useRef, useState, useEffect } from 'react';

export default function SaveLoadPanel({
  onExport, onImport,
}: {
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => {
        setFeedbackMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMessage]);

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (file) {
      try {
        await onImport(file);
        setFeedbackType('success');
        setFeedbackMessage('存档导入成功');
      } catch {
        setFeedbackType('error');
        setFeedbackMessage('存档导入失败');
      }
    }
  };

  const handleExport = () => {
    onExport();
    setFeedbackType('success');
    setFeedbackMessage('存档导出成功');
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
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
      {feedbackMessage && (
        <p className={`text-xs mt-2 ${feedbackType === 'success' ? 'text-jade-light' : 'text-vermillion-light'}`}>
          {feedbackMessage}
        </p>
      )}
    </div>
  );
}