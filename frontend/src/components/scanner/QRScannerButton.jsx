import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import QRScannerModal from './QRScannerModal';
import ScanResultModal from './ScanResultModal';
import { SCANNER_FEATURE_LABELS } from './scannerConfig';

const QRScannerButton = ({ feature, onResolved, className = '' }) => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState(null);
  const featureLabel = SCANNER_FEATURE_LABELS[feature] || 'ERP Management';

  const handleResolved = (identity) => {
    setScannerOpen(false);
    setResult(identity);
  };

  const handleContinue = () => {
    const identity = result;
    setResult(null);
    onResolved?.(identity);
  };

  return (
    <>
      <button type="button" onClick={() => setScannerOpen(true)} className={`inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 ${className}`}>
        <ScanLine size={16} /> Scan QR
      </button>
      <QRScannerModal open={scannerOpen} feature={feature} featureLabel={featureLabel} onClose={() => setScannerOpen(false)} onResolved={handleResolved} />
      <ScanResultModal result={result} featureLabel={featureLabel} onClose={() => setResult(null)} onContinue={handleContinue} />
    </>
  );
};

export default QRScannerButton;
