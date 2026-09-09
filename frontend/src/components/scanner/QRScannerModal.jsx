import { Camera, CameraOff, Keyboard, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveQrIdentity } from '../../api/scannerApi';

const IGNORED_SCAN_ERRORS = new Set(['NotFoundException', 'ChecksumException', 'FormatException']);

const QRScannerModal = ({ open, feature, featureLabel, resolveContext, onClose, onResolved }) => {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const resolvingRef = useRef(false);
  const mountedRef = useRef(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [manualValue, setManualValue] = useState('');

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop?.();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    stream?.getTracks?.().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const resolveValue = useCallback(async (value) => {
    const qrData = String(value || '').trim();
    if (!qrData || resolvingRef.current) return;
    resolvingRef.current = true;
    setStatus('verifying');
    setError('');
    stopCamera();
    try {
      const identity = await resolveQrIdentity(qrData, feature, resolveContext);
      if (!mountedRef.current) return;
      setStatus('success');
      onResolved(identity);
    } catch (requestError) {
      if (!mountedRef.current) return;
      resolvingRef.current = false;
      setStatus('error');
      setError(requestError.message || 'QR could not be verified.');
    }
  }, [feature, onResolved, resolveContext, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    resolvingRef.current = false;
    setStatus('starting');
    setError('');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 250 });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } }, audio: false },
        videoRef.current,
        (result, scanError) => {
          if (result) {
            resolveValue(result.getText());
            return;
          }
          if (scanError && !IGNORED_SCAN_ERRORS.has(scanError.name)) {
            setError('Camera could not read this QR. Hold it steady inside the frame.');
          }
        },
      );
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (cameraError) {
      if (!mountedRef.current) return;
      setStatus('error');
      setError(cameraError?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access or enter the QR value manually.'
        : 'No usable camera was found. You can enter the QR value manually.');
    }
  }, [resolveValue, stopCamera]);

  useEffect(() => {
    mountedRef.current = open;
    if (open) {
      setManualValue('');
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">{featureLabel}</p>
            <h2 className="mt-1 font-serif text-2xl font-black italic text-slate-950">Scan Identity QR</h2>
          </div>
          <button type="button" title="Close scanner" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-950"><X size={18} /></button>
        </div>

        <div className="p-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-950">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(2,6,23,0.35)]" />
            {status === 'starting' || status === 'verifying' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white">
                <LoaderCircle className="animate-spin" size={28} />
                <span className="mt-3 text-xs font-black uppercase tracking-[0.18em]">{status === 'verifying' ? 'Verifying' : 'Starting Camera'}</span>
              </div>
            ) : null}
            {status === 'error' ? <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-slate-300"><CameraOff size={38} /></div> : null}
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-slate-500">Place the Student or Teacher QR inside the frame.</p>

          {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}

          <div className="mt-5 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="Paste QR value" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none focus:border-emerald-400" />
            </div>
            <button type="button" onClick={() => resolveValue(manualValue)} disabled={!manualValue.trim() || status === 'verifying'} className="rounded-2xl bg-slate-950 px-4 text-[11px] font-black uppercase tracking-[0.15em] text-white disabled:opacity-50">Verify</button>
          </div>

          <button type="button" onClick={startCamera} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 hover:border-emerald-300 hover:text-emerald-700">
            {status === 'error' ? <RotateCcw size={15} /> : <Camera size={15} />} Retry Camera
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
