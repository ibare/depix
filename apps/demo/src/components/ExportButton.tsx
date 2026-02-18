import type { DepixIR } from '@depix/core';
import { renderIRToPNG } from '@depix/engine';

interface ExportButtonProps {
  ir: DepixIR | null;
  sceneIndex?: number;
  className?: string;
}

export function ExportButton({ ir, sceneIndex = 0, className }: ExportButtonProps) {
  const handleExport = () => {
    if (!ir) return;

    const { dataUrl } = renderIRToPNG(ir, sceneIndex, { scale: 2 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `depix-export-${Date.now()}.png`;
    a.click();
  };

  return (
    <button className={className ?? 'btn btn-sm'} onClick={handleExport} disabled={!ir}>
      PNG Export
    </button>
  );
}
