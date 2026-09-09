import { ArrowRight, IdCard, UserRound, X } from 'lucide-react';

const ScanResultModal = ({ result, featureLabel, continueLabel = 'Open Record', onClose, onContinue }) => {
  if (!result) return null;
  const classLabel = [result.className, result.section].filter(Boolean).join(' - ');

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">QR Verified</p>
            <h2 className="mt-2 font-serif text-2xl font-black italic text-slate-950">{result.name}</h2>
          </div>
          <button type="button" title="Close" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-950">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <ResultLine icon={IdCard} label={result.entityType === 'STUDENT' ? 'Enrollment ID' : 'Employee ID'} value={result.referenceNumber} />
          {classLabel ? <ResultLine icon={UserRound} label="Class" value={classLabel} /> : null}
          {result.department ? <ResultLine icon={UserRound} label="Department" value={result.department} /> : null}
        </div>
        <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
          Continue to load this record in {featureLabel}. Only information allowed for this module will be shown.
        </p>
        <button type="button" onClick={onContinue} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-white hover:bg-emerald-700">
          {continueLabel} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};

const ResultLine = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500"><Icon size={14} />{label}</span>
    <span className="text-right text-sm font-black text-slate-900">{value || '-'}</span>
  </div>
);

export default ScanResultModal;
