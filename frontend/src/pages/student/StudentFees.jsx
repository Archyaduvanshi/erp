import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  CreditCard,
  Download,
  Landmark,
  Search,
} from 'lucide-react';
import { feeApi, studentApi } from '../../utils/api';
import { getFeeFacilityKey, isFeeStructureApplicableToStudent } from '../../utils/facilityUtils';
import {
  allocateOverallAmount,
  buildFeeRow,
  calculateTaxBreakdown,
  formatBillingType,
  formatCoveredMonths,
  formatMoney,
  getTodayKey,
  resolveCoverageLabel,
} from '../../utils/feeUtils';

const today = getTodayKey();

const createPaymentForm = () => ({
  transactionId: '',
  gatewayRef: '',
  mode: 'UPI',
  paymentStatus: 'Success',
  paymentTarget: 'due_auto',
  paidAmount: '',
  paymentDate: today,
});

const paymentMethodDetails = {
  UPI: {
    title: 'UPI Payment',
    primary: 'fees@collegeupi',
    secondary: 'UPI app me amount pay karke UTR / transaction ID paste karein.',
  },
  'Bank Transfer': {
    title: 'Bank Transfer',
    primary: 'A/C 0000000000 | IFSC COLG0001234',
    secondary: 'NEFT / IMPS / RTGS ke baad bank reference number submit karein.',
  },
  Card: {
    title: 'Card Payment',
    primary: 'Gateway reference required',
    secondary: 'Card payment ke successful gateway reference ko save karein.',
  },
  'Net Banking': {
    title: 'Net Banking',
    primary: 'Bank confirmation reference required',
    secondary: 'Net banking receipt ka transaction reference enter karein.',
  },
  Other: {
    title: 'Other Method',
    primary: 'Reference / proof number required',
    secondary: 'Cheque, wallet, ya kisi other mode ka proof reference add karein.',
  },
};

const StudentFees = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [paymentForm, setPaymentForm] = useState(createPaymentForm);
  const [loadError, setLoadError] = useState('');
  const [feeSummaryOpen, setFeeSummaryOpen] = useState(false);

  const student = useMemo(() => {
    if (!session || session.role !== 'student') return null;
    return students.find((entry) => {
      const matchesId = session.studentId && String(entry.id) === String(session.studentId);
      const matchesSystemId = session.studentSystemId && String(entry.systemId) === String(session.studentSystemId);
      const matchesEnrollment = session.enrollmentNo && String(entry.enrollmentNo) === String(session.enrollmentNo);
      return matchesId || matchesSystemId || matchesEnrollment;
    }) || null;
  }, [session, students]);

  const studentName = student
    ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || student.systemId || 'Student'
    : 'Student';
  const studentSection = getStudentSectionName(student);

  const refreshData = async () => {
    try {
      const studentRequest = session?.studentId ? studentApi.getById(session.studentId) : studentApi.getAll();
      const [studentResponse, structureResponse, paymentResponse] = await Promise.all([
        studentRequest,
        feeApi.getStructures(),
        feeApi.getPayments(session?.studentId),
      ]);
      setStudents(Array.isArray(studentResponse) ? studentResponse : [studentResponse]);
      setStructures(structureResponse);
      setPayments(paymentResponse);
      setLoadError('');
    } catch (error) {
      setStudents([]);
      setStructures([]);
      setPayments([]);
      setLoadError(error.message || 'Unable to load fee data from database.');
    }
  };

  const studentStructures = useMemo(() => {
    const studentClassName = normalizeClassName(student?.assignedClass || student?.className || '');
    if (!studentClassName) return [];
    return structures
      .filter((structure) => normalizeClassName(structure.courseId) === studentClassName)
      .sort((a, b) => String(a.feeComponent || '').localeCompare(String(b.feeComponent || '')));
  }, [student, structures]);

  const successfulPayments = useMemo(() => {
    if (!student) return [];
    return payments.filter(
      (payment) => String(payment.studentId) === String(student.id) && payment.paymentStatus === 'Success',
    );
  }, [payments, student]);

  const feeRows = useMemo(() => {
    if (!student) return [];
    return studentStructures.map((structure) => ({
      structure,
      ...buildFeeRow(structure, student.id, successfulPayments),
    }));
  }, [student, studentStructures, successfulPayments]);

  const visibleFeeRows = useMemo(() => {
    return feeRows.filter((row) => {
      if (!isFeeStructureApplicableToStudent(row.structure, student)) return false;
      return row.billingType !== 'monthly_active' || row.serviceMonthsCount > 0;
    });
  }, [feeRows, student]);

  const receiptRows = useMemo(() => {
    if (!student) return [];
    return payments
      .filter((payment) => String(payment.studentId) === String(student.id))
      .map((payment) => {
        const structure = structures.find((entry) => String(entry.id) === String(payment.structureId));
        const overallLabel = Array.isArray(payment.allocations) && payment.allocations.length > 0
          ? `Overall Fee Payment (${payment.allocations.length} allocations)`
          : 'Overall Fee Payment';
        return {
          ...payment,
          structure: structure || {
            feeComponent: overallLabel,
            billingType: payment.billingType,
          },
          receiptNumber: payment.receiptNumber || `RCPT-${payment.id}`,
          taxBreakdown: payment.taxBreakdown || calculateTaxBreakdown(payment.paidAmount),
          downloadLink: payment.downloadLink || `receipt-${payment.id}.txt`,
        };
      })
      .filter((receipt) => {
        const query = receiptSearch.trim().toLowerCase();
        if (!query) return true;
        return (
          String(receipt.receiptNumber || '').toLowerCase().includes(query) ||
          String(receipt.transactionId || '').toLowerCase().includes(query) ||
          String(receipt.structure?.feeComponent || '').toLowerCase().includes(query)
        );
      })
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0).getTime() - new Date(a.paymentDate || a.createdAt || 0).getTime());
  }, [payments, receiptSearch, structures, student]);

  const totalCurrentDue = visibleFeeRows.reduce((sum, row) => sum + row.totalOutstanding, 0);
  const totalPreviousPending = visibleFeeRows.reduce((sum, row) => sum + (Number(row.previousPendingAmount) || 0), 0);
  const totalFacilityCharge = visibleFeeRows.reduce((sum, row) => {
    if (!isFacilityFeeStructure(row.structure)) return sum;
    return sum + (Number(row.currentCycleDueAmount) || 0);
  }, 0);
  const totalCollegeCharge = visibleFeeRows.reduce((sum, row) => {
    if (isFacilityFeeStructure(row.structure)) return sum;
    return sum + (Number(row.currentCycleDueAmount) || 0);
  }, 0);
  const customPaymentAmount = Number(paymentForm.paidAmount) || 0;
  const selectedPaymentMethod = paymentMethodDetails[paymentForm.mode] || paymentMethodDetails.Other;
  const activeFacilityRows = visibleFeeRows.filter((row) => (
    isFacilityFeeStructure(row.structure) && (Number(row.currentCycleDueAmount) || 0) > 0
  ));
  const selectedPaymentSummary = useMemo(() => ({
    previousPending: totalPreviousPending,
    collegeFee: totalCollegeCharge,
    facilityFee: totalFacilityCharge,
    facilityRows: activeFacilityRows,
    totalPayable: totalCurrentDue,
  }), [
    activeFacilityRows,
    totalCollegeCharge,
    totalCurrentDue,
    totalFacilityCharge,
    totalPreviousPending,
  ]);

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    if (session?.role === 'student') {
      refreshData();
    }
  }, [session]);

  useEffect(() => {
    if (totalCurrentDue > 0 && !paymentForm.paidAmount) {
      setPaymentForm((current) => ({
        ...current,
        paidAmount: String(totalCurrentDue),
      }));
    }
  }, [paymentForm.paidAmount, totalCurrentDue]);

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!student) return;

    const paidAmount = Number(paymentForm.paidAmount) || 0;
    if (!paymentForm.transactionId.trim() || paidAmount <= 0) return;

    const allocations = allocateOverallAmount(paidAmount, visibleFeeRows, 'due_auto');
    if (allocations.length === 0) return;
    const currentDuePaid = allocations
      .filter((allocation) => allocation.kind === 'Current Due')
      .reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);

    const balanceRemaining = Math.max(totalCurrentDue - currentDuePaid, 0);
    const receiptNumber = `FEE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    try {
      await feeApi.savePayment({
        ...paymentForm,
        studentId: student.id,
        structureId: 'overall_total',
        paidAmount,
        allocations,
        coveredMonths: [],
        resolvedMonths: [],
        paymentTarget: 'due_auto',
        coverageLabel: 'Online payment auto-adjusted',
        activeFromMonth: '',
        billedMonthsCount: allocations.reduce((sum, allocation) => sum + (allocation.coveredMonths?.length || 0), 0),
        billingType: 'overall_payment',
        receiptNumber,
        taxBreakdown: calculateTaxBreakdown(paidAmount),
        balanceRemaining,
        downloadLink: `receipt-${receiptNumber}.txt`,
      });

      setPaymentForm(createPaymentForm());
      await refreshData();
    } catch (error) {
      setLoadError(error.message || 'Unable to save payment in database.');
    }
  };

  const handleDownloadReceipt = (receipt) => {
    const lines = [
      `Receipt Number: ${receipt.receiptNumber}`,
      `Student: ${studentName}`,
      `Class: ${student?.assignedClass || '-'}`,
      `Fee Component: ${receipt.structure?.feeComponent || '-'}`,
      `Billing Rule: ${formatBillingType(receipt.structure?.billingType, receipt.structure?.feeComponent)}`,
      `Cycle: ${resolveCoverageLabel(receipt)}`,
      `Covered Months: ${formatCoveredMonths(receipt.coveredMonths)}`,
      `Transaction ID: ${receipt.transactionId || '-'}`,
      `Gateway Ref: ${receipt.gatewayRef || '-'}`,
      `Mode: ${receipt.mode || '-'}`,
      `Status: ${receipt.paymentStatus || '-'}`,
      `Paid Amount: Rs ${receipt.paidAmount || 0}`,
      `Tax Breakdown: ${receipt.taxBreakdown || '-'}`,
      `Balance Remaining: Rs ${receipt.balanceRemaining || 0}`,
    ];
    if (Array.isArray(receipt.allocations) && receipt.allocations.length) {
      lines.push('');
      lines.push('Allocation Summary:');
      receipt.allocations.forEach((allocation, index) => {
        const coveredMonths = formatCoveredMonths(allocation.coveredMonths || []);
        lines.push(
          `${index + 1}. ${allocation.feeComponent} | ${allocation.kind} | Rs ${allocation.amount} | ${allocation.note} | ${coveredMonths}`,
        );
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = receipt.downloadLink || `${receipt.receiptNumber}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!session || session.role !== 'student') return null;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffaf2_0%,#f4fbf7_34%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/student')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Student Fees</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Fee Management</h1>
            </div>
          </div>
          <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 md:inline-flex">
            April To March Cycle
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        <div className="grid gap-8">
          <section className="space-y-8">
            <Panel
              title="Student Fee Collection"
              description="Payable amount verify karein, online payment proof submit karein, aur receipt database me save karein."
            >
              <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSavePayment}>
                <div className="md:col-span-2">
                  <LoggedInStudentStrip student={student} studentName={studentName} studentSection={studentSection} />
                </div>
                <div className="md:col-span-2 rounded-[1.8rem] border border-emerald-100 bg-emerald-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InvoiceStat label="Previous Pending" value={formatMoney(selectedPaymentSummary.previousPending)} />
                    <InvoiceStat label="College Fee" value={formatMoney(selectedPaymentSummary.collegeFee)} />
                    <InvoiceStat label="Facilities" value={formatMoney(selectedPaymentSummary.facilityFee)} />
                    <InvoiceStat label="Total Payable" value={formatMoney(selectedPaymentSummary.totalPayable)} strong />
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setFeeSummaryOpen((open) => !open)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
                      aria-expanded={feeSummaryOpen}
                    >
                      <div>
                        <h4 className="text-sm font-black text-slate-950">Simple Fee Summary</h4>
                        <p className="mt-1 text-xs font-semibold text-slate-500">Payable amount aur pending balance ka quick summary.</p>
                      </div>
                      <ChevronDown className={`shrink-0 text-slate-400 transition ${feeSummaryOpen ? 'rotate-180 text-emerald-700' : ''}`} size={18} />
                    </button>
                    <div className={`grid transition-all duration-300 ease-out ${feeSummaryOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                      <div className="overflow-hidden">
                        <div className="grid gap-2 px-4 pb-4">
                          <SummaryLine label="College Fees" value={formatMoney(selectedPaymentSummary.collegeFee)} />
                          {selectedPaymentSummary.facilityRows.map((row) => (
                            <SummaryLine key={row.structure.id} label={`${row.structure.feeComponent} Facility`} value={formatMoney(row.currentCycleDueAmount)} />
                          ))}
                          {selectedPaymentSummary.facilityRows.length === 0 ? (
                            <SummaryLine label="Facility Fees" value={formatMoney(0)} />
                          ) : null}
                          <SummaryLine label="Previous Pending" value={formatMoney(selectedPaymentSummary.previousPending)} tone={selectedPaymentSummary.previousPending > 0 ? 'danger' : 'default'} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <SelectField
                  label="Collection Mode"
                  value={paymentForm.mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                  options={['UPI', 'Bank Transfer', 'Card', 'Net Banking', 'Other']}
                />
                <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                      {paymentForm.mode === 'Bank Transfer' ? <Landmark size={20} /> : <CreditCard size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-950">{selectedPaymentMethod.title}</p>
                      <p className="mt-1 text-sm font-bold text-emerald-700">{selectedPaymentMethod.primary}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{selectedPaymentMethod.secondary}</p>
                    </div>
                  </div>
                </div>
                <InputField
                  label="UTR / Transaction ID"
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                  placeholder="UPI123456 / NEFT-2026-001"
                />
                <InputField
                  label="Bank / Gateway Reference"
                  value={paymentForm.gatewayRef}
                  onChange={(e) => setPaymentForm({ ...paymentForm, gatewayRef: e.target.value })}
                  placeholder="bank_ref_or_gateway_ref"
                />
                <InputField
                  label="Amount To Collect"
                  type="number"
                  min="0"
                  value={paymentForm.paidAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                  placeholder="25000"
                />
                <div className="md:col-span-2">
                  <PrimaryButton type="submit" icon={CreditCard} label="Tap To Pay" disabled={!student || customPaymentAmount <= 0 || !paymentForm.transactionId.trim()} />
                </div>
              </form>
              <div className="mt-8 max-w-md">
                <SearchInput value={receiptSearch} onChange={setReceiptSearch} placeholder="Search receipt or transaction..." />
              </div>
              <PaymentHistoryTable rows={receiptRows} onDownload={handleDownloadReceipt} />
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
};

const isFacilityFeeStructure = (structure = {}) => (
  structure.feeType === 'facility_fee' || structure.billingType === 'monthly_active' || Boolean(getFeeFacilityKey(structure))
);

const normalizeClassName = (className = '') => String(className)
  .split('/')
  .at(0)
  ?.replace(/\s+-\s+section\s+.+$/i, '')
  .replace(/\s+section\s+.+$/i, '')
  .trim() || '';

const getStudentSectionName = (student = {}) => {
  if (student?.section) return String(student.section).trim();
  const assignedClassParts = String(student?.assignedClass || '').split('/');
  return assignedClassParts[1]?.trim() || 'Section pending';
};

const Panel = ({ title, description, children }) => (
  <section className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8">
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const InputField = ({ label, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <input
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    />
  </div>
);

const SelectField = ({ label, options, renderOptionLabel, ...props }) => (
  <div className="space-y-2.5">
    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</label>
    <select
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
      {...props}
    >
      {options.map((option) => (
        <option key={option || 'empty-option'} value={option}>
          {renderOptionLabel ? renderOptionLabel(option) : option || 'Select'}
        </option>
      ))}
    </select>
  </div>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-12 py-3.5 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    />
  </div>
);

const PrimaryButton = ({ type, icon: Icon, label, disabled = false }) => (
  <button
    type={type}
    disabled={disabled}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
  >
    <Icon size={15} />
    {label}
  </button>
);

const LoggedInStudentStrip = ({ student, studentName, studentSection }) => (
  <div className="rounded-[1.8rem] border border-slate-200 bg-white p-4">
    <div className="grid gap-4 md:grid-cols-3">
      <ReadOnlyContext label="Student Name" value={`${studentName} | ${student?.enrollmentNo || student?.systemId || 'Enrollment pending'}`} />
      <ReadOnlyContext label="Class" value={student?.assignedClass || student?.className || 'Class pending'} />
      <ReadOnlyContext label="Section" value={studentSection} />
    </div>
  </div>
);

const ReadOnlyContext = ({ label, value }) => (
  <div>
    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{label}</p>
    <div className="mt-2 min-h-14 rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-black text-slate-900">
      {value}
    </div>
  </div>
);

const InvoiceStat = ({ label, value, strong = false, tone = 'default' }) => {
  const toneClass = {
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    default: 'border-slate-200 bg-white text-slate-950',
  }[tone] || 'border-slate-200 bg-white text-slate-950';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`${strong ? 'text-2xl' : 'text-xl'} mt-1 font-black tracking-tight`}>{value}</p>
    </div>
  );
};

const SummaryLine = ({ label, value, tone = 'default' }) => {
  const toneClass = tone === 'danger' ? 'text-rose-600' : 'text-slate-950';

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className={`text-base font-black ${toneClass}`}>{value}</span>
    </div>
  );
};

const PaymentHistoryTable = ({ rows, onDownload }) => (
  <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <h4 className="text-sm font-black text-slate-950">Payment History</h4>
      <p className="mt-1 text-xs font-semibold text-slate-500">Sirf is student ke database receipts aur online payment proofs.</p>
    </div>
    {rows.length ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-white">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Date</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Receipt</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Mode</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Status</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Amount</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Balance</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-emerald-50/40">
                <td className="px-4 py-4 font-semibold text-slate-700">{receipt.paymentDate || '-'}</td>
                <td className="px-4 py-4 font-black text-slate-900">{receipt.receiptNumber || receipt.transactionId || '-'}</td>
                <td className="px-4 py-4 text-slate-600">{receipt.mode || '-'}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${receipt.paymentStatus === 'Success' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {receipt.paymentStatus || 'Saved'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-black text-slate-950">{formatMoney(receipt.paidAmount)}</td>
                <td className="px-4 py-4 text-right font-semibold text-slate-600">{formatMoney(receipt.balanceRemaining)}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDownload(receipt)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                    aria-label="Download receipt"
                  >
                    <Download size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
        Is student ki payment history abhi empty hai.
      </div>
    )}
  </div>
);

export default StudentFees;
