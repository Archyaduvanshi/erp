import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  IndianRupee,
  Landmark,
  ReceiptText,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { db } from '../../utils/db';
import { isFacilityActive } from '../../utils/facilityUtils';
import {
  allocateOverallAmount,
  buildFeeRow,
  buildOverallPaymentPreview,
  calculateTaxBreakdown,
  formatBillingType,
  formatCoveredMonths,
  formatCycleLabel,
  getTodayKey,
  resolveBillingType,
  resolveCoverageLabel,
} from '../../utils/feeUtils';

const today = getTodayKey();

const initialStructureForm = {
  courseId: '',
  category: '',
  feeComponent: '',
  amount: '',
  cycleMonths: '1',
  billingType: 'cycle_based',
};

const initialPaymentForm = {
  studentId: '',
  transactionId: '',
  gatewayRef: '',
  mode: 'UPI',
  paymentStatus: 'Success',
  paymentTarget: 'due_auto',
  paidAmount: '',
  paymentDate: today,
};

const FeeManagement = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('home');
  const [students, setStudents] = useState(() => db.getAll('students'));
  const [structures, setStructures] = useState(() => db.getAll('fee_structures'));
  const [payments, setPayments] = useState(() => db.getAll('fee_payments'));
  const [structureForm, setStructureForm] = useState(initialStructureForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [selectedFeeClass, setSelectedFeeClass] = useState('');
  const [pendingFeeComponents, setPendingFeeComponents] = useState([]);
  const [structureSearch, setStructureSearch] = useState('');
  const [structureCategoryFilter, setStructureCategoryFilter] = useState('');
  const [receiptSearch, setReceiptSearch] = useState('');
  const [dueSearch, setDueSearch] = useState('');

  const refreshData = () => {
    setStudents(db.getAll('students'));
    setStructures(db.getAll('fee_structures'));
    setPayments(db.getAll('fee_payments'));
  };

  const studentOptions = useMemo(() => {
    return students
      .map((student) => ({
        id: student.id,
        name: `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.enrollmentNo || 'Unnamed student',
        className: student.assignedClass || 'Course pending',
        enrollmentNo: student.enrollmentNo || student.systemId || `Student ${student.id}`,
        category: student.admissionCategory || student.category || 'General',
        transportOptIn: student.transportOptIn,
        hostelOptIn: student.hostelOptIn,
        libraryOptIn: student.libraryOptIn,
        transportStatus: student.transportStatus,
        hostelStatus: student.hostelStatus,
        libraryStatus: student.libraryStatus,
        libraryMonthlyCharge: student.libraryMonthlyCharge,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const courseOptions = useMemo(() => {
    return [...new Set(students.map((student) => student.assignedClass).filter(Boolean))].sort(compareClassNames);
  }, [students]);

  const successfulPayments = useMemo(() => {
    return payments.filter((payment) => payment.paymentStatus === 'Success');
  }, [payments]);

  const reportRows = useMemo(() => {
    return structures.flatMap((structure) => {
      const matchingStudents = studentOptions.filter((student) => student.className === structure.courseId);
      return matchingStudents.map((student) => {
        return {
          id: `${structure.id}-${student.id}`,
          structure,
          student,
          ...buildFeeRow(structure, student.id, successfulPayments),
        };
      });
    });
  }, [structures, studentOptions, successfulPayments]);

  const receiptRows = useMemo(() => {
    return payments
      .map((payment) => {
        const structure = structures.find((entry) => String(entry.id) === String(payment.structureId));
        const student = studentOptions.find((entry) => String(entry.id) === String(payment.studentId));
        const report = reportRows.find((entry) => String(entry.structure.id) === String(payment.structureId) && String(entry.student.id) === String(payment.studentId));
        const overallLabel = Array.isArray(payment.allocations) && payment.allocations.length > 0
          ? `Overall Fee Payment (${payment.allocations.length} allocations)`
          : 'Overall Fee Payment';
        return {
          ...payment,
          structure: structure || {
            feeComponent: overallLabel,
            billingType: payment.billingType,
            courseId: student?.className || 'Course pending',
          },
          student,
          receiptNumber: payment.receiptNumber || `RCPT-${payment.id}`,
          taxBreakdown: payment.taxBreakdown || calculateTaxBreakdown(payment.paidAmount),
          balanceRemaining: payment.balanceRemaining ?? report?.totalOutstanding ?? 0,
          downloadLink: payment.downloadLink || `receipt-${payment.id}.txt`,
        };
      })
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
  }, [payments, reportRows, structures, studentOptions]);

  const filteredFeeClasses = useMemo(() => {
    const query = structureSearch.trim().toLowerCase();
    return courseOptions.filter((className) => {
      if (!query) return true;
      return className.toLowerCase().includes(query);
    });
  }, [courseOptions, structureSearch]);

  const selectedClassCategoryOptions = useMemo(() => {
    return [...new Set(
      structures
        .filter((structure) => structure.courseId === selectedFeeClass)
        .map((structure) => structure.category)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
  }, [selectedFeeClass, structures]);

  const selectedClassStructures = useMemo(() => {
    return structures
      .filter((structure) => structure.courseId === selectedFeeClass)
      .filter((structure) => !structureCategoryFilter || structure.category === structureCategoryFilter)
      .sort((a, b) => String(a.feeComponent || '').localeCompare(String(b.feeComponent || '')));
  }, [selectedFeeClass, structureCategoryFilter, structures]);

  const filteredReceipts = useMemo(() => {
    const query = receiptSearch.trim().toLowerCase();
    return receiptRows.filter((receipt) => {
      if (!query) return true;
      return (
        receipt.receiptNumber?.toLowerCase().includes(query) ||
        receipt.transactionId?.toLowerCase().includes(query) ||
        receipt.gatewayRef?.toLowerCase().includes(query) ||
        receipt.student?.name?.toLowerCase().includes(query) ||
        receipt.structure?.courseId?.toLowerCase().includes(query)
      );
    });
  }, [receiptRows, receiptSearch]);

  const filteredDueRows = useMemo(() => {
    const query = dueSearch.trim().toLowerCase();
    return reportRows.filter((row) => {
      if (row.totalOutstanding <= 0) return false;
      if (!query) return true;
      return (
        row.student.name.toLowerCase().includes(query) ||
        row.student.enrollmentNo.toLowerCase().includes(query) ||
        row.student.className.toLowerCase().includes(query) ||
        row.structure.feeComponent.toLowerCase().includes(query)
      );
    });
  }, [dueSearch, reportRows]);

  const totalConfigured = structures.reduce((sum, structure) => sum + (Number(structure.amount) || 0), 0);
  const collectedAmount = successfulPayments.reduce((sum, payment) => sum + (Number(payment.paidAmount) || 0), 0);
  const totalOutstanding = reportRows.reduce((sum, row) => sum + row.totalOutstanding, 0);
  const defaulterCount = new Set(filteredDueRows.map((row) => row.student.id)).size;
  const pendingFeeTotal = pendingFeeComponents.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const selectedPaymentStudent = studentOptions.find((student) => String(student.id) === String(paymentForm.studentId));
  const selectedPaymentRows = useMemo(() => {
    if (!selectedPaymentStudent) return [];
    return reportRows
      .filter((row) => String(row.student.id) === String(selectedPaymentStudent.id))
      .filter((row) => {
        if (row.billingType !== 'monthly_active') return true;
        const component = String(row.structure.feeComponent || '').toLowerCase();
        const transportActive = isFacilityActive(selectedPaymentStudent, 'transport');
        const hostelActive = isFacilityActive(selectedPaymentStudent, 'hostel');
        const libraryActive = isFacilityActive(selectedPaymentStudent, 'library');
        if (component.includes('transport')) return transportActive && row.serviceMonthsCount > 0;
        if (component.includes('hostel')) return hostelActive && row.serviceMonthsCount > 0;
        if (component.includes('library')) return libraryActive && row.serviceMonthsCount > 0;
        return true;
      });
  }, [reportRows, selectedPaymentStudent]);
  const selectedPaymentOutstandingTotal = useMemo(() => (
    selectedPaymentRows.reduce((sum, row) => sum + (Number(row.totalOutstanding) || 0), 0)
  ), [selectedPaymentRows]);
  const paymentPreview = useMemo(() => {
    if (!selectedPaymentStudent) return null;
    return buildOverallPaymentPreview(paymentForm.paidAmount, selectedPaymentRows, paymentForm.paymentTarget);
  }, [paymentForm.paidAmount, paymentForm.paymentTarget, selectedPaymentRows, selectedPaymentStudent]);

  const handleAddPendingFeeComponent = (e) => {
    e.preventDefault();
    const feeComponent = structureForm.feeComponent.trim();
    const amount = Number(structureForm.amount) || 0;
    const cycleMonths = Math.max(Number(structureForm.cycleMonths) || 1, 1);
    const billingType = resolveBillingType({ ...structureForm, feeComponent });
    if (!selectedFeeClass || !structureForm.category || !feeComponent || !amount) return;

    setPendingFeeComponents((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        feeComponent,
        amount,
        category: structureForm.category,
        cycleMonths,
        billingType,
      },
    ]);
    setStructureForm((current) => ({
      ...current,
      feeComponent: '',
      amount: '',
      cycleMonths: current.cycleMonths || '1',
      billingType: current.billingType || 'cycle_based',
    }));
  };

  const handleRemovePendingFeeComponent = (componentId) => {
    setPendingFeeComponents((current) => current.filter((item) => item.id !== componentId));
  };

  const handleSavePendingFeeComponents = () => {
    if (!selectedFeeClass || pendingFeeComponents.length === 0) return;

    const records = pendingFeeComponents.map((item, index) => ({
      courseId: selectedFeeClass,
      category: item.category,
      feeComponent: item.feeComponent,
      amount: Number(item.amount) || 0,
      cycleMonths: Math.max(Number(item.cycleMonths) || 1, 1),
      billingType: resolveBillingType(item),
      dueDate: '',
      id: Date.now() + index,
      createdAt: new Date().toISOString(),
    }));
    replaceModuleRecords('fee_structures', [...db.getAll('fee_structures'), ...records]);
    setPendingFeeComponents([]);
    setStructureForm({ ...initialStructureForm, courseId: selectedFeeClass });
    refreshData();
  };

  const handleStudentSelect = (studentId) => {
    const selectedStudent = studentOptions.find((student) => String(student.id) === studentId);
    const studentRows = reportRows
      .filter((row) => String(row.student.id) === String(studentId))
      .filter((row) => {
        if (row.billingType !== 'monthly_active') return true;
        const component = String(row.structure.feeComponent || '').toLowerCase();
        const transportActive = isFacilityActive(selectedStudent, 'transport');
        const hostelActive = isFacilityActive(selectedStudent, 'hostel');
        const libraryActive = isFacilityActive(selectedStudent, 'library');
        if (component.includes('transport')) return transportActive && row.serviceMonthsCount > 0;
        if (component.includes('hostel')) return hostelActive && row.serviceMonthsCount > 0;
        if (component.includes('library')) return libraryActive && row.serviceMonthsCount > 0;
        return true;
      });
    const studentOutstanding = studentRows.reduce((sum, row) => sum + (Number(row.totalOutstanding) || 0), 0);
    setPaymentForm((current) => ({
      ...current,
      studentId,
      paymentTarget: 'due_auto',
      paidAmount: studentOutstanding > 0 ? String(studentOutstanding) : current.paidAmount,
    }));
  };

  const handleSavePayment = (e) => {
    e.preventDefault();
    const selectedStudent = studentOptions.find((student) => String(student.id) === String(paymentForm.studentId));
    if (!selectedStudent || !paymentForm.transactionId.trim() || !paymentForm.paidAmount) return;
    const paidAmount = Number(paymentForm.paidAmount) || 0;
    if (paidAmount <= 0) return;
    const allocations = allocateOverallAmount(paidAmount, selectedPaymentRows, paymentForm.paymentTarget);
    if (allocations.length === 0) return;
    const currentDuePaid = allocations
      .filter((allocation) => allocation.kind === 'Current Due')
      .reduce((sum, allocation) => sum + (Number(allocation.amount) || 0), 0);
    const balanceRemaining = Math.max(selectedPaymentOutstandingTotal - currentDuePaid, 0);
    const receiptNumber = `FEE-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    db.save('fee_payments', {
      ...paymentForm,
      studentId: selectedStudent.id,
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
    setPaymentForm(initialPaymentForm);
    refreshData();
  };

  const handleDelete = (module, recordId, message) => {
    if (!window.confirm(message)) return;
    replaceModuleRecords(module, db.getAll(module).filter((record) => record.id !== recordId));
    refreshData();
  };

  const handleDownloadReceipt = (receipt) => {
    const lines = [
      `Receipt Number: ${receipt.receiptNumber}`,
      `Student: ${receipt.student?.name || 'Student pending'}`,
      `Course: ${receipt.structure?.courseId || '-'}`,
      `Component: ${receipt.structure?.feeComponent || '-'}`,
      `Billing Rule: ${formatBillingType(receipt.structure?.billingType, receipt.structure?.feeComponent)}`,
      `Cycle Window: ${resolveCoverageLabel(receipt)}`,
      `Covered Months: ${formatCoveredMonths(receipt.coveredMonths)}`,
      `Transaction ID: ${receipt.transactionId}`,
      `Gateway Ref: ${receipt.gatewayRef || '-'}`,
      `Mode: ${receipt.mode}`,
      `Status: ${receipt.paymentStatus}`,
      `Paid Amount: Rs ${receipt.paidAmount}`,
      `Tax Breakdown: ${receipt.taxBreakdown}`,
      `Balance Remaining: Rs ${receipt.balanceRemaining}`,
    ];
    if (Array.isArray(receipt.allocations) && receipt.allocations.length) {
      lines.push('');
      lines.push('Allocation Summary:');
      receipt.allocations.forEach((allocation, index) => {
        lines.push(
          `${index + 1}. ${allocation.feeComponent} | ${allocation.kind} | Rs ${allocation.amount} | ${allocation.note}`,
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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef8f4_38%,#f8fafc_100%)] text-slate-900">
      <div className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/college')}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-600">Fee Management</p>
              <h1 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Finance And Receipt Desk</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <section className="overflow-hidden rounded-4xl bg-[linear-gradient(145deg,#064e3b_0%,#0f766e_48%,#111827_100%)] px-7 py-8 text-white shadow-[0_30px_80px_-40px_rgba(6,78,59,0.8)] lg:px-10 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200">Student Finance</p>
              <h2 className="mt-4 max-w-3xl font-serif text-4xl font-black italic leading-none tracking-tight">
                Configure fees, collect payments, issue receipts, and track dues.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/80">
                Manage course-wise fee components, payment modes, receipt proof, and outstanding balances for administrative follow-up.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard label="Configured Fees" value={`Rs ${totalConfigured}`} icon={Landmark} />
              <MetricCard label="Collected" value={`Rs ${collectedAmount}`} icon={CreditCard} />
              <MetricCard label="Outstanding" value={`Rs ${totalOutstanding}`} icon={IndianRupee} />
              <MetricCard label="Defaulters" value={defaulterCount} icon={UserRound} />
            </div>
          </div>
        </section>

        {activeSection === 'home' ? (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <ActionCard icon={BadgeIndianRupee} title="Fee Structure Setup" text="Define cycle-based fees and monthly hostel, transport, or library service fees." onClick={() => setActiveSection('structures')} />
            <ActionCard icon={CreditCard} title="Fee Collection" text="Record UPI, card, cash, or gateway payments." onClick={() => setActiveSection('payments')} />
            <ActionCard icon={ReceiptText} title="Receipt Generation" text="Review receipt number, tax, balance, and download proof." onClick={() => setActiveSection('receipts')} />
            <ActionCard icon={CalendarClock} title="Due Fee Reports" text="Find pending balances, late fines, and reminder counts." onClick={() => setActiveSection('dues')} />
          </section>
        ) : (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Fee Module Page</p>
              <h2 className="mt-2 font-serif text-3xl font-black italic tracking-tight text-slate-950">{sectionTitle(activeSection)}</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('home')}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <ArrowLeft size={15} />
              Back To Fee Cards
            </button>
          </div>
        )}

        {activeSection === 'structures' ? (
          <TwoColumnPage
            left={
              <Panel title="All Classes" description="Select a class to add and view its fee structure.">
                <div className="mt-6">
                  <SearchInput value={structureSearch} onChange={setStructureSearch} placeholder="Search class..." />
                </div>
                <div className="mt-6 grid gap-3">
                  {filteredFeeClasses.map((className) => {
                    const classStructures = structures.filter((structure) => structure.courseId === className);
                    const classTotal = classStructures.reduce((sum, structure) => sum + (Number(structure.amount) || 0), 0);
                    return (
                      <button
                        key={className}
                        type="button"
                        onClick={() => {
                          setSelectedFeeClass(className);
                          setStructureCategoryFilter('');
                          setStructureForm({ ...initialStructureForm, courseId: className });
                          setPendingFeeComponents([]);
                        }}
                        className={`flex items-center justify-between gap-4 rounded-[1.4rem] border p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 ${
                          selectedFeeClass === className ? 'border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100' : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <h4 className="truncate text-base font-black text-slate-950">{className}</h4>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                            {classStructures.length} fee items | Rs {classTotal}
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
                          <BadgeIndianRupee size={18} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            }
            right={
              <Panel
                title={selectedFeeClass || 'Select A Class'}
                description="Add the fee components for the selected class and review the total fee."
              >
                {selectedFeeClass ? (
                  <div className="mt-8 space-y-8">
                    <form className="grid gap-5 md:grid-cols-2" onSubmit={handleAddPendingFeeComponent}>
                      <InputField label="Class" value={selectedFeeClass} readOnly />
                      <SelectField label="Category" value={structureForm.category} onChange={(e) => setStructureForm({ ...structureForm, category: e.target.value })} options={['', 'General', 'OBC', 'SC', 'ST', 'EWS', 'Scholarship']} />
                      <InputField label="Fee Component" value={structureForm.feeComponent} onChange={(e) => setStructureForm({ ...structureForm, feeComponent: e.target.value })} placeholder="Tuition / Library / Lab / Custom Fee" />
                      <SelectField
                        label="Billing Rule"
                        value={structureForm.billingType}
                        onChange={(e) => setStructureForm({ ...structureForm, billingType: e.target.value })}
                        options={['cycle_based', 'monthly_active']}
                        renderOptionLabel={(value) => {
                          if (value === 'cycle_based') return 'Cycle Based Fee';
                          if (value === 'monthly_active') return 'Monthly Active Service';
                          return 'Select billing rule';
                        }}
                      />
                      <InputField
                        label="Month Cycle"
                        type="number"
                        min="1"
                        max="12"
                        value={structureForm.cycleMonths}
                        onChange={(e) => setStructureForm({ ...structureForm, cycleMonths: e.target.value })}
                        placeholder="3"
                      />
                      <InputField
                        label={structureForm.billingType === 'monthly_active' ? 'Amount Per Month' : 'Amount For This Cycle'}
                        type="number"
                        min="0"
                        value={structureForm.amount}
                        onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                        placeholder={structureForm.billingType === 'monthly_active' ? '3500' : '25000'}
                      />
                      <div className="md:col-span-2">
                        <PrimaryButton type="submit" icon={BadgeIndianRupee} label="Add Fee Component" />
                      </div>
                    </form>
                    <p className="-mt-2 text-sm leading-7 text-slate-500">
                      Use `Cycle Based Fee` for tuition, lab, and other college charges. Use `Monthly Active Service` for hostel, transport, or library so only active months inside the April to March cycle are billed.
                    </p>

                    <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Added Components</h4>
                        <span className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-emerald-800 shadow-sm">Total Rs {pendingFeeTotal}</span>
                      </div>

                      {pendingFeeComponents.length > 0 ? (
                        <div className="mt-5 grid gap-3">
                          {pendingFeeComponents.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
                              <div>
                                <h5 className="font-black text-slate-950">{item.feeComponent}</h5>
                                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">
                                  {item.category} | {formatBillingType(item.billingType, item.feeComponent)} | {formatCycleLabel(item.cycleMonths)}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-slate-800">Rs {item.amount}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePendingFeeComponent(item.id)}
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <PrimaryButton type="button" icon={BadgeIndianRupee} label="Save All Added Components" onClick={handleSavePendingFeeComponents} />
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl bg-white px-5 py-8 text-center text-sm font-semibold text-slate-500">No components added yet.</div>
                      )}
                    </div>

                    <div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h4 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Fees Of This Class</h4>
                          <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                            {structureCategoryFilter ? `Showing ${structureCategoryFilter} components` : 'Showing all categories'}
                          </p>
                        </div>
                        <span className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">
                          Total Rs {selectedClassStructures.reduce((sum, structure) => sum + (Number(structure.amount) || 0), 0)}
                        </span>
                      </div>
                      <div className="mt-5 max-w-xs">
                        <SelectField
                          label="Filter By Category"
                          value={structureCategoryFilter}
                          onChange={(e) => setStructureCategoryFilter(e.target.value)}
                          options={['', ...selectedClassCategoryOptions]}
                          renderOptionLabel={(value) => value || 'All Categories'}
                        />
                      </div>
                      <div className="mt-5 grid gap-4">
                        {selectedClassStructures.length > 0 ? (
                          selectedClassStructures.map((structure) => (
                            <RecordCard key={structure.id} icon={BadgeIndianRupee} title={structure.feeComponent} subtitle={structure.category}>
                              <InfoPill icon={IndianRupee} text={resolveAmountLabel(structure)} />
                              <InfoPill icon={CalendarClock} text={formatCycleLabel(structure.cycleMonths)} />
                              <InfoPill icon={FileText} text={formatBillingType(structure.billingType, structure.feeComponent)} />
                              <button onClick={() => handleDelete('fee_structures', structure.id, 'Delete this fee structure?')} className="ml-auto text-slate-400 transition hover:text-rose-600">
                                <Trash2 size={18} />
                              </button>
                            </RecordCard>
                          ))
                        ) : (
                          <div className="rounded-[1.8rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                            <h4 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">
                              {structureCategoryFilter ? 'No fees found for this category' : 'No fees added'}
                            </h4>
                            <p className="mt-2 text-sm leading-7 text-slate-500">
                              {structureCategoryFilter
                                ? `No fee components are available under ${structureCategoryFilter} for ${selectedFeeClass}.`
                                : `Add the first fee component for ${selectedFeeClass}.`}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 rounded-4xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm">
                      <BadgeIndianRupee size={34} />
                    </div>
                    <h4 className="mt-6 font-serif text-3xl font-black italic tracking-tight text-slate-950">Choose a class</h4>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">Click a class from the list to add and view that class fee structure.</p>
                  </div>
                )}
              </Panel>
            }
          />
        ) : null}

        {activeSection === 'payments' ? (
          <TwoColumnPage
            left={
              <Panel title="Collect Fee Payment" description="Capture transaction ID, gateway reference, mode, status, and paid amount.">
                <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSavePayment}>
                  <SelectField label="Student" value={paymentForm.studentId} onChange={(e) => handleStudentSelect(e.target.value)} options={['', ...studentOptions.map((student) => String(student.id))]} renderOptionLabel={(value) => studentLabel(value, studentOptions)} />
                  {paymentPreview ? (
                    <div className="md:col-span-2 rounded-[1.8rem] border border-emerald-100 bg-emerald-50/70 p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <InfoPill icon={IndianRupee} text={`Current pending Rs ${selectedPaymentOutstandingTotal}`} />
                        <InfoPill icon={CreditCard} text={`Entered Rs ${Number(paymentForm.paidAmount) || 0}`} />
                        <InfoPill icon={ReceiptText} text={`Advance Rs ${paymentPreview.advanceAmount}`} />
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-600">
                        Student ko fee component choose nahi karna padega. Amount automatically current due me adjust hoga, aur agar aap `Advance Next Cycle` choose karte hain to pura amount upcoming cycle ke advance me save hoga.
                      </p>
                      {paymentPreview.allocations.length ? (
                        <div className="mt-5 grid gap-3">
                          {paymentPreview.allocations.map((allocation, index) => (
                            <div key={`${allocation.structureId}-${allocation.kind}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
                      ) : (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-500">
                          Amount enter karne ke baad yahan automatic allocation preview dikhega.
                        </div>
                      )}
                    </div>
                  ) : null}
                  <InputField label="Transaction ID" value={paymentForm.transactionId} onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} placeholder="TXN-2026-001" />
                  <InputField label="Payment Gateway Ref" value={paymentForm.gatewayRef} onChange={(e) => setPaymentForm({ ...paymentForm, gatewayRef: e.target.value })} placeholder="razorpay_abc123" />
                  <SelectField label="Mode" value={paymentForm.mode} onChange={(e) => setPaymentForm({ ...paymentForm, mode: e.target.value })} options={['UPI', 'Card', 'Cash', 'Net Banking', 'Cheque']} />
                  <SelectField label="Payment Status" value={paymentForm.paymentStatus} onChange={(e) => setPaymentForm({ ...paymentForm, paymentStatus: e.target.value })} options={['Success', 'Pending', 'Failed']} />
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
                  <InputField label="Paid Amount" type="number" min="0" value={paymentForm.paidAmount} onChange={(e) => setPaymentForm({ ...paymentForm, paidAmount: e.target.value })} placeholder="25000" />
                  <InputField label="Payment Date" type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} />
                  <div className="md:col-span-2">
                    <PrimaryButton type="submit" icon={CreditCard} label="Save Payment And Receipt" />
                  </div>
                </form>
              </Panel>
            }
            right={
              <Panel title="Recent Payments" description="Latest financial transactions recorded for students.">
                <div className="mt-6 grid gap-4">
                  {receiptRows.slice(0, 8).map((receipt) => (
                    <RecordCard key={receipt.id} icon={CreditCard} title={receipt.student?.name || 'Student pending'} subtitle={`${receipt.transactionId} | ${receipt.mode} | ${receipt.paymentStatus}`}>
                      <InfoPill icon={IndianRupee} text={`Rs ${receipt.paidAmount}`} />
                      <InfoPill icon={CalendarClock} text={resolveCoverageLabel(receipt)} />
                      <InfoPill icon={ReceiptText} text={receipt.receiptNumber} />
                    </RecordCard>
                  ))}
                </div>
              </Panel>
            }
          />
        ) : null}

        {activeSection === 'receipts' ? (
          <Panel className="mt-8" title="Receipt Generation" description="Each successful collection stores proof of payment with receipt number, tax breakdown, balance, and download link.">
            <div className="mt-6 max-w-md">
              <SearchInput value={receiptSearch} onChange={setReceiptSearch} placeholder="Search receipt, student, transaction..." />
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {filteredReceipts.map((receipt) => (
                <RecordCard key={receipt.id} icon={ReceiptText} title={receipt.receiptNumber} subtitle={`${receipt.student?.name || 'Student pending'} | ${receipt.structure?.feeComponent || 'Component pending'}`}>
                  <InfoPill icon={CalendarClock} text={resolveCoverageLabel(receipt)} />
                  <InfoPill icon={FileText} text={receipt.taxBreakdown} />
                  <InfoPill icon={IndianRupee} text={`Balance Rs ${receipt.balanceRemaining}`} />
                  <button onClick={() => handleDownloadReceipt(receipt)} className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white transition hover:bg-emerald-600">
                    <Download size={16} />
                  </button>
                </RecordCard>
              ))}
            </div>
          </Panel>
        ) : null}

        {activeSection === 'dues' ? (
          <Panel className="mt-8" title="Due Fee Reports" description="Outstanding balances include unpaid amount plus late fine and reminder count.">
            <div className="mt-6 max-w-md">
              <SearchInput value={dueSearch} onChange={setDueSearch} placeholder="Search defaulter, course, component..." />
            </div>
            <div className="mt-6 grid gap-5">
              {filteredDueRows.map((row) => (
                <RecordCard key={row.id} icon={CalendarClock} title={row.student.name} subtitle={`${row.student.enrollmentNo} | ${row.student.className} | ${row.structure.feeComponent}`}>
                  <InfoPill icon={FileText} text={formatBillingType(row.billingType, row.structure.feeComponent)} />
                  <InfoPill icon={CalendarClock} text={row.currentCycleLabel} />
                  <InfoPill icon={IndianRupee} text={`Late Fine Rs ${row.lateFeeFine}`} />
                  <InfoPill icon={Landmark} text={`Outstanding Rs ${row.totalOutstanding}`} />
                  <InfoPill icon={CalendarClock} text={`${row.reminderCount} reminders`} />
                </RecordCard>
              ))}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
};

const replaceModuleRecords = (module, records) => {
  const tenantId = db.getTenantId();
  if (!tenantId) return;
  localStorage.setItem(`${tenantId}_${module}`, JSON.stringify(records));
};

const compareClassNames = (a, b) => {
  const left = getClassSortValue(a);
  const right = getClassSortValue(b);
  return left.rank - right.rank || left.section.localeCompare(right.section) || a.localeCompare(b);
};

const getClassSortValue = (className) => {
  const normalized = className.toLowerCase();
  const section = className.split('/')[1]?.trim() || '';

  if (normalized.includes('nursery')) return { rank: 0, section };
  if (normalized.includes('lkg')) return { rank: 1, section };
  if (normalized.includes('ukg')) return { rank: 2, section };

  const classMatch = normalized.match(/class\s*(\d+)/);
  if (classMatch) {
    return { rank: 2 + Number(classMatch[1]), section };
  }

  return { rank: 1000, section };
};

const sectionTitle = (section) => ({
  structures: 'Fee Structure Setup',
  payments: 'Fee Collection And Online Payment',
  receipts: 'Receipt Generation',
  dues: 'Due Fee Reports',
}[section] || 'Fee Management');

const studentLabel = (value, students) => {
  if (!value) return 'Select student';
  const student = students.find((entry) => String(entry.id) === value);
  return student ? `${student.name} | ${student.enrollmentNo}` : 'Select student';
};

const structureLabel = (value, structures) => {
  if (!value) return 'Select fee structure';
  const structure = structures.find((entry) => String(entry.id) === value);
  return structure ? `${structure.courseId} | ${structure.feeComponent} | ${formatBillingType(structure.billingType, structure.feeComponent)} | ${formatCycleLabel(structure.cycleMonths)} | Rs ${structure.amount}` : 'Select fee structure';
};

const resolveAmountLabel = (structure) => {
  const amount = Number(structure.amount) || 0;
  return resolveBillingType(structure) === 'monthly_active' ? `Rs ${amount} / month` : `Rs ${amount} / cycle`;
};

const MetricCard = ({ label, value, icon }) => (
  <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-50/80">{label}</p>
        <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200/20 bg-emerald-200/10 text-emerald-50">
        {React.createElement(icon, { size: 20 })}
      </div>
    </div>
  </div>
);

const ActionCard = ({ icon, title, text, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex min-h-56 flex-col justify-between rounded-4xl border border-slate-200/80 bg-white p-6 text-left shadow-[0_20px_60px_-38px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-emerald-300 lg:p-7"
  >
    <div>
      <div className="flex items-start justify-between gap-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
          {React.createElement(icon, { size: 24 })}
        </div>
        <ArrowRight className="text-slate-300 transition group-hover:text-emerald-700" size={20} />
      </div>
      <h3 className="mt-7 font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-500">{text}</p>
    </div>
    <span className="mt-6 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Open Page</span>
  </button>
);

const TwoColumnPage = ({ left, right }) => (
  <div className="mt-8 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
    {left}
    {right}
  </div>
);

const Panel = ({ title, description, className = '', children }) => (
  <section className={`${className} rounded-4xl border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] lg:p-8`}>
    <h3 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    {children}
  </section>
);

const RecordCard = ({ icon, title, subtitle, children }) => (
  <article className="rounded-[1.8rem] border border-slate-200 bg-slate-50 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          {React.createElement(icon, { size: 20 })}
        </div>
        <div className="min-w-0">
          <h4 className="truncate text-lg font-black tracking-tight text-slate-950">{title}</h4>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </article>
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

const PrimaryButton = ({ type, icon, label, onClick }) => (
  <button
    type={type}
    onClick={onClick}
    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-emerald-600"
  >
    {React.createElement(icon, { size: 15 })}
    {label}
  </button>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-emerald-700' })}
    <span>{text}</span>
  </div>
);

export default FeeManagement;
