import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CreditCard,
  Download,
  IndianRupee,
  ReceiptText,
  Search,
} from 'lucide-react';
import { db } from '../../utils/db';
import { isFacilityActive, isFacilityRequested } from '../../utils/facilityUtils';
import {
  buildOverallPaymentPreview,
  allocateOverallAmount,
  buildFeeRow,
  calculateTaxBreakdown,
  formatBillingType,
  formatCoveredMonths,
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

const StudentFees = () => {
  const navigate = useNavigate();
  const [session] = useState(() => JSON.parse(localStorage.getItem('active_session')) || null);
  const [students] = useState(() => db.getAll('students'));
  const [structures, setStructures] = useState(() => db.getAll('fee_structures'));
  const [payments, setPayments] = useState(() => db.getAll('fee_payments'));
  const [dueSearch, setDueSearch] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [paymentForm, setPaymentForm] = useState(createPaymentForm);

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

  const transportRequested = isFacilityRequested(student, 'transport');
  const hostelRequested = isFacilityRequested(student, 'hostel');
  const libraryRequested = isFacilityRequested(student, 'library');
  const transportActive = isFacilityActive(student, 'transport');
  const hostelActive = isFacilityActive(student, 'hostel');
  const libraryActive = isFacilityActive(student, 'library');

  const refreshData = () => {
    setStructures(db.getAll('fee_structures'));
    setPayments(db.getAll('fee_payments'));
  };

  const studentStructures = useMemo(() => {
    if (!student?.assignedClass) return [];
    return structures
      .filter((structure) => structure.courseId === student.assignedClass)
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
      if (row.billingType !== 'monthly_active') return true;
      const component = String(row.structure.feeComponent || '').toLowerCase();
      if (component.includes('transport')) return transportActive && row.serviceMonthsCount > 0;
      if (component.includes('hostel')) return hostelActive && row.serviceMonthsCount > 0;
      if (component.includes('library')) return libraryActive && row.serviceMonthsCount > 0;
      return true;
    });
  }, [feeRows, hostelActive, libraryActive, transportActive]);

  const filteredFeeRows = useMemo(() => {
    const query = dueSearch.trim().toLowerCase();
    return visibleFeeRows.filter((row) => {
      if (!query) return true;
      return (
        String(row.structure.feeComponent || '').toLowerCase().includes(query) ||
        String(row.structure.courseId || '').toLowerCase().includes(query) ||
        String(row.structure.category || '').toLowerCase().includes(query)
      );
    });
  }, [dueSearch, visibleFeeRows]);

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

  const currentCycleOverallTotal = visibleFeeRows.reduce((sum, row) => {
    return sum + (Number(row.totalCharge) || 0);
  }, 0);
  const totalFacilityCharge = visibleFeeRows.reduce((sum, row) => {
    if (row.billingType !== 'monthly_active') return sum;
    return sum + (Number(row.totalCharge) || 0);
  }, 0);
  const totalCollegeCharge = visibleFeeRows.reduce((sum, row) => {
    if (row.billingType === 'monthly_active') return sum;
    return sum + (Number(row.totalCharge) || 0);
  }, 0);
  const totalCurrentDue = visibleFeeRows.reduce((sum, row) => sum + row.totalOutstanding, 0);
  const totalPreviousPending = visibleFeeRows.reduce((sum, row) => sum + (Number(row.previousPendingAmount) || 0), 0);
  const totalCurrentCycleDue = visibleFeeRows.reduce((sum, row) => sum + (Number(row.currentCycleDueAmount) || 0), 0);
  const customPaymentAmount = Number(paymentForm.paidAmount) || 0;

  useEffect(() => {
    if (!session || session.role !== 'student') {
      navigate('/login');
    }
  }, [navigate, session]);

  useEffect(() => {
    if (totalCurrentDue > 0 && !paymentForm.paidAmount) {
      setPaymentForm((current) => ({
        ...current,
        paidAmount: String(totalCurrentDue),
      }));
    }
  }, [paymentForm.paidAmount, totalCurrentDue]);

  const handleSavePayment = (e) => {
    e.preventDefault();
    if (!student) return;

    const paidAmount = Number(paymentForm.paidAmount) || 0;
    if (!paymentForm.transactionId.trim() || paidAmount <= 0) return;

    const allocations = allocateOverallAmount(paidAmount, visibleFeeRows, paymentForm.paymentTarget);
    if (allocations.length === 0) return;
    const currentDuePaid = allocations
      .filter((allocation) => allocation.kind === 'Current Due')
      .reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);

    const balanceRemaining = Math.max(totalCurrentDue - currentDuePaid, 0);
    const receiptNumber = `FEE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    db.save('fee_payments', {
      ...paymentForm,
      studentId: student.id,
      structureId: 'overall_total',
      paidAmount,
      allocations,
      coveredMonths: [],
      resolvedMonths: [],
      coverageLabel: paymentForm.paymentTarget === 'advance_only'
        ? 'Advance payment for upcoming cycle'
        : 'Overall payment auto-adjusted',
      activeFromMonth: '',
      billedMonthsCount: allocations.reduce((sum, allocation) => sum + (allocation.coveredMonths?.length || 0), 0),
      billingType: 'overall_payment',
      receiptNumber,
      taxBreakdown: calculateTaxBreakdown(paidAmount),
      balanceRemaining,
      downloadLink: `receipt-${receiptNumber}.txt`,
    });

    setPaymentForm(createPaymentForm());
    refreshData();
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
  const paymentPreview = useMemo(
    () => buildOverallPaymentPreview(customPaymentAmount, visibleFeeRows, paymentForm.paymentTarget),
    [customPaymentAmount, paymentForm.paymentTarget, visibleFeeRows],
  );

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
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Smart Fee Wallet</h1>
            </div>
          </div>
          <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 md:inline-flex">
            April To March Cycle
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-8">
            <Panel
              title="Fee Components"
              description="Each facility component shows only its fixed total for the current month cycle. Paid and due amounts are shown separately and do not change the component total."
            >
              <div className="mt-6 max-w-md">
                <SearchInput value={dueSearch} onChange={setDueSearch} placeholder="Search component, category, or class..." />
              </div>

              {filteredFeeRows.length ? (
                <div className="mt-6 grid gap-5">
                  {filteredFeeRows.map((row) => {
                    const isMonthlyActive = row.billingType === 'monthly_active';
                    const facilityStatus = resolveServiceStatus(row.structure.feeComponent, student);
                    const facilityMonths = row.serviceMonthsCount || 0;
                    const facilityTotalCharge = Number(row.totalCharge) || 0;
                    const headlineAmount = isMonthlyActive ? facilityTotalCharge : row.totalOutstanding;
                    return (
                      <article key={row.structure.id} className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
                        <div className="border-b border-slate-200/80 px-5 py-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-black tracking-tight text-slate-950">{row.structure.feeComponent || 'Fee component'}</h3>
                                <Badge tone={isMonthlyActive ? 'amber' : (row.totalOutstanding > 0 ? 'rose' : 'emerald')} text={isMonthlyActive ? 'Cycle Total Fixed' : (row.totalOutstanding > 0 ? 'Due' : 'Settled')} />
                                {isMonthlyActive ? <Badge tone="amber" text={facilityStatus} /> : null}
                              </div>
                              <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                                {row.structure.courseId || student?.assignedClass || 'Class pending'} | {row.structure.category || 'General'} | {formatBillingType(row.billingType, row.structure.feeComponent)}
                              </p>
                            </div>
                            <div className="rounded-[1.4rem] bg-slate-950 px-4 py-3 text-right text-white">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                                {isMonthlyActive ? 'Month Cycle Total' : 'Outstanding'}
                              </p>
                              <p className="mt-2 text-2xl font-black tracking-tight">Rs {headlineAmount}</p>
                              {isMonthlyActive ? (
                                <div className="mt-2 space-y-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-200">
                                  <p>Paid Rs {row.paid}</p>
                                  <p>Due Rs {row.totalOutstanding}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-3 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                          <InfoPill label={isMonthlyActive ? 'Per Month' : 'Base Amount'} value={`Rs ${Number(row.structure.amount) || 0}`} />
                          <InfoPill label={isMonthlyActive ? 'Months In Cycle' : 'Paid Till Now'} value={isMonthlyActive ? `${facilityMonths} month${facilityMonths === 1 ? '' : 's'}` : `Rs ${row.paid}`} />
                          <InfoPill label={isMonthlyActive ? 'Paid Till Now' : 'Late Fine'} value={isMonthlyActive ? `Rs ${row.paid}` : `Rs ${row.lateFeeFine}`} />
                          <InfoPill label={isMonthlyActive ? 'Outstanding' : 'Cycle Window'} value={isMonthlyActive ? `Rs ${row.totalOutstanding}` : row.currentCycleLabel} />
                        </div>

                        <div className="grid gap-3 border-t border-slate-200/80 px-5 py-5 md:grid-cols-2">
                          <InfoPill label="Billing Rule" value={formatBillingType(row.billingType, row.structure.feeComponent)} />
                          <InfoPill label="Due Date" value={row.structure.dueDate || 'Not assigned'} />
                          <InfoPill label={isMonthlyActive ? 'Cycle Window' : 'Fee Category'} value={isMonthlyActive ? row.currentCycleLabel : (row.structure.category || 'General')} />
                          <InfoPill label="Covered Months" value={isMonthlyActive ? formatCoveredMonths(row.coveredMonths) : 'Cycle based charge'} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={IndianRupee} title="No fee components found" description="No fee structures are currently linked to this student's class." />
              )}

              <div className="mt-8 rounded-[1.8rem] bg-[linear-gradient(135deg,#0f172a_0%,#065f46_55%,#111827_100%)] p-6 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-200">Overall Current Cycle Total</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <InfoPill label="College Fees" value={`Rs ${totalCollegeCharge}`} />
                  <InfoPill label="Facility Fees" value={`Rs ${totalFacilityCharge}`} />
                  <InfoPill label="Overall Total" value={`Rs ${currentCycleOverallTotal}`} />
                </div>
                {libraryRequested ? (
                  <p className="mt-4 text-sm font-semibold text-emerald-50/85">
                    Library facility is {student?.libraryStatus || 'inactive'} with monthly charge Rs {student?.libraryMonthlyCharge || '0'}.
                  </p>
                ) : null}
              </div>
            </Panel>
          </section>

          <section className="space-y-8">
            <Panel
              title="Pay Overall Fees"
              description="Student sirf amount enter karega. System previous pending aur current cycle due dono ko dikhakar payment ko automatic adjust karega."
            >
              <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSavePayment}>
                <div className="rounded-[1.8rem] border border-amber-200 bg-[linear-gradient(180deg,#fffdf6_0%,#fff7ed_100%)] p-5 md:col-span-2">
                  <div className="flex flex-wrap gap-3">
                    <InfoPill label="Previous Pending" value={`Rs ${totalPreviousPending}`} />
                    <InfoPill label="This Month Cycle Due" value={`Rs ${totalCurrentCycleDue}`} />
                    <InfoPill label="Current Pending Total" value={`Rs ${totalCurrentDue}`} />
                    <InfoPill label="Entered Amount" value={`Rs ${customPaymentAmount}`} />
                    <InfoPill label="Advance Amount" value={`Rs ${paymentPreview.advanceAmount}`} />
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    Agar pichle month cycle ki fees pending hai ya current month cycle ka due bacha hai, dono yahan show honge. Amount pehle current pending dues me adjust hoga, aur extra amount next cycle advance me save ho jayega.
                  </p>
                  {visibleFeeRows.some((row) => row.totalOutstanding > 0) ? (
                    <div className="mt-5 grid gap-3">
                      {visibleFeeRows
                        .filter((row) => row.totalOutstanding > 0)
                        .map((row) => (
                          <div key={row.structure.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-sm font-black text-slate-900">{row.structure.feeComponent || 'Fee component'}</p>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                  {row.currentCycleLabel}
                                </p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <InfoPill label="Previous Pending" value={`Rs ${Number(row.previousPendingAmount) || 0}`} />
                                <InfoPill label={row.billingType === 'monthly_active' ? 'This Month Due' : 'This Cycle Due'} value={`Rs ${Number(row.currentCycleDueAmount) || 0}`} />
                                <InfoPill label="Total Pending" value={`Rs ${Number(row.totalOutstanding) || 0}`} />
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : null}
                  {paymentPreview.allocations.length ? (
                    <div className="mt-5 grid gap-3">
                      {paymentPreview.allocations.map((allocation) => (
                        <div key={allocation.structureId} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-black text-slate-900">{allocation.feeComponent}</p>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{allocation.kind}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-950">Rs {allocation.amount}</p>
                              <p className="text-xs font-semibold text-slate-500">{allocation.note}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <SelectField
                  label="Mode"
                  value={paymentForm.mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })}
                  options={['UPI', 'Card', 'Net Banking', 'Cash', 'Cheque']}
                />
                <SelectField
                  label="Payment For"
                  value={paymentForm.paymentTarget}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentTarget: e.target.value })}
                  options={['due_auto', 'advance_only']}
                  renderOptionLabel={(value) => (
                    {
                      due_auto: 'Adjust In Pending Total',
                      advance_only: 'Advance Next Cycle',
                    }[value] || value
                  )}
                />
                <InputField
                  label="Transaction ID"
                  value={paymentForm.transactionId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                  placeholder="TXN-2026-001"
                />
                <InputField
                  label="Gateway Reference"
                  value={paymentForm.gatewayRef}
                  onChange={(e) => setPaymentForm({ ...paymentForm, gatewayRef: e.target.value })}
                  placeholder="gateway_ref_123"
                />
                <InputField
                  label="Paid Amount"
                  type="number"
                  min="0"
                  value={paymentForm.paidAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })}
                  placeholder="25000"
                />
                <div className="md:col-span-2">
                  <InputField
                    label="Payment Date"
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <PrimaryButton type="submit" icon={CreditCard} label="Save Payment And Receipt" />
                </div>
              </form>
            </Panel>

            <Panel
              title="Recent Receipts"
              description="Download saved proofs, review month coverage, and verify remaining balances."
            >
              <div className="mt-6 max-w-md">
                <SearchInput value={receiptSearch} onChange={setReceiptSearch} placeholder="Search receipt or transaction..." />
              </div>

              {receiptRows.length ? (
                <div className="mt-6 grid gap-5">
                  {receiptRows.map((receipt) => (
                    <article key={receipt.id} className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black tracking-tight text-slate-950">{receipt.receiptNumber}</h3>
                            <Badge tone={receipt.paymentStatus === 'Success' ? 'emerald' : 'amber'} text={receipt.paymentStatus || 'Saved'} />
                          </div>
                          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
                            {receipt.structure?.feeComponent || 'Fee component pending'} | {resolveCoverageLabel(receipt)} | {receipt.mode}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(receipt)}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-600"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <InfoPill label="Paid Amount" value={`Rs ${Number(receipt.paidAmount) || 0}`} />
                        <InfoPill label="Balance Remaining" value={`Rs ${Number(receipt.balanceRemaining) || 0}`} />
                        <InfoPill label="Payment Date" value={receipt.paymentDate || 'Not added'} />
                        <InfoPill label="Covered Months" value={formatCoveredMonths(receipt.coveredMonths)} />
                        <InfoPill label="Cycle Window" value={resolveCoverageLabel(receipt)} />
                        <InfoPill label="Tax Breakdown" value={receipt.taxBreakdown || 'Not available'} />
                      </div>
                      {Array.isArray(receipt.allocations) && receipt.allocations.length ? (
                        <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-white p-4">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Auto Allocation</p>
                          <div className="mt-3 grid gap-3">
                            {receipt.allocations.map((allocation, index) => (
                              <div key={`${receipt.id}-${allocation.structureId}-${index}`} className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-black text-slate-900">{allocation.feeComponent}</p>
                                  <p className="text-xs font-semibold text-slate-500">{allocation.note}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{allocation.kind}</p>
                                  <p className="text-sm font-black text-slate-950">Rs {Number(allocation.amount) || 0}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState icon={ReceiptText} title="No receipts yet" description="Once a payment is saved for this student, the receipt will appear here." />
              )}
            </Panel>
          </section>
        </div>
      </main>
    </div>
  );
};

const resolveServiceStatus = (feeComponent, student) => {
  const component = String(feeComponent || '').toLowerCase();
  if (component.includes('transport')) {
    const requested = student?.transportOptIn === 'yes' || student?.transportOptIn === true;
    return requested ? (student?.transportStatus || 'inactive') : 'not requested';
  }
  if (component.includes('hostel')) {
    const requested = student?.hostelOptIn === 'yes' || student?.hostelOptIn === true;
    return requested ? (student?.hostelStatus || 'inactive') : 'not requested';
  }
  if (component.includes('library')) {
    const requested = student?.libraryOptIn === 'yes' || student?.libraryOptIn === true;
    return requested ? (student?.libraryStatus || 'inactive') : 'not requested';
  }
  return 'standard';
};

const Badge = ({ text, tone = 'slate' }) => {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones[tone]}`}>
      {text}
    </span>
  );
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

const PrimaryButton = ({ type, icon: Icon, label }) => (
  <button
    type={type}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
  >
    <Icon size={15} />
    {label}
  </button>
);

const InfoPill = ({ label, value }) => (
  <div className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-2 text-sm font-bold text-slate-800">{value}</p>
  </div>
);

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
      <Icon size={34} />
    </div>
    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">{title}</h4>
    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">{description}</p>
  </div>
);

export default StudentFees;
