import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeIndianRupee,
  CalendarClock,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  IndianRupee,
  Landmark,
  ReceiptText,
  Search,
  Trash2,
} from 'lucide-react';
import { feeApi } from '../../utils/api';
import {
  calculateTaxBreakdown,
  formatBillingType,
  formatCoveredMonths,
  formatCycleLabel,
  formatFeeType,
  formatMoney,
  getTodayKey,
  resolveBillingType,
  resolveCoverageLabel,
} from '../../utils/feeUtils';

const today = getTodayKey();
const ALL_STUDENTS_CATEGORY = 'All Students';
const PAGE_SIZE = 25;

const initialStructureForm = {
  courseId: '',
  category: ALL_STUDENTS_CATEGORY,
  feeType: 'college_fee',
  facilityKey: '',
  feeComponent: '',
  amount: '',
  cycleMonths: '3',
  billingType: 'cycle_based',
  dueDate: today,
};

const initialPaymentForm = {
  className: '',
  section: '',
  studentId: '',
  transactionId: '',
  gatewayRef: '',
  mode: 'Cash',
  paymentStatus: 'Success',
  paymentTarget: 'due_auto',
  paidAmount: '',
  paymentDate: today,
};

const FeeManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('home');
  const [structureForm, setStructureForm] = useState(initialStructureForm);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [selectedFeeClass, setSelectedFeeClass] = useState('');
  const [categoryWiseFees, setCategoryWiseFees] = useState(false);
  const [structureSearch, setStructureSearch] = useState('');
  const [manualClassName, setManualClassName] = useState('');
  const [structureCategoryFilter, setStructureCategoryFilter] = useState('');
  const [dueSearch, setDueSearch] = useState('');
  const [loadError, setLoadError] = useState('');
  const [feeSummaryOpen, setFeeSummaryOpen] = useState(false);
  const [generatedReceipt, setGeneratedReceipt] = useState(null);
  const debouncedDueSearch = useDebouncedValue(dueSearch, 350);

  const overviewQuery = useQuery({
    queryKey: ['fees', 'overview'],
    queryFn: () => feeApi.getOverview(),
    staleTime: 45_000,
  });

  const classesQuery = useQuery({
    queryKey: ['fees', 'classes'],
    queryFn: () => feeApi.getClasses(),
    staleTime: 45_000,
    placeholderData: keepPreviousData,
  });

  const structuresQuery = useQuery({
    queryKey: ['fees', 'structures', selectedFeeClass, structureCategoryFilter],
    queryFn: () => feeApi.getStructures({ className: selectedFeeClass, category: structureCategoryFilter }),
    enabled: activeSection === 'structures',
    staleTime: 45_000,
    placeholderData: keepPreviousData,
  });

  const studentSearchQuery = useInfiniteQuery({
    queryKey: ['fees', 'students', paymentForm.className, paymentForm.section],
    queryFn: ({ pageParam = 0 }) => feeApi.searchStudents({
      className: paymentForm.className,
      section: paymentForm.section,
      page: pageParam,
      size: PAGE_SIZE,
    }),
    enabled: activeSection === 'payments' && Boolean(paymentForm.className),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const selectedStudentSummaryQuery = useQuery({
    queryKey: ['fees', 'student-summary', paymentForm.studentId],
    queryFn: () => feeApi.getStudentSummary(paymentForm.studentId),
    enabled: activeSection === 'payments' && Boolean(paymentForm.studentId),
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const selectedStudentPaymentsQuery = useInfiniteQuery({
    queryKey: ['fees', 'student-payments', paymentForm.studentId],
    queryFn: ({ pageParam = 0 }) => feeApi.getStudentPayments(paymentForm.studentId, { page: pageParam, size: PAGE_SIZE }),
    enabled: activeSection === 'payments' && Boolean(paymentForm.studentId),
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const duesQuery = useInfiniteQuery({
    queryKey: ['fees', 'dues', debouncedDueSearch],
    queryFn: ({ pageParam = 0 }) => feeApi.getDues({ search: debouncedDueSearch, page: pageParam, size: PAGE_SIZE }),
    enabled: activeSection === 'dues',
    initialPageParam: 0,
    getNextPageParam: nextPageParam,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const saveStructureMutation = useMutation({
    mutationFn: feeApi.saveStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees', 'structures'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'overview'] });
    },
  });

  const savePaymentMutation = useMutation({
    mutationFn: feeApi.savePayment,
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ['fees', 'student-summary', String(payload.studentId)] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'student-summary', payload.studentId] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'student-payments', String(payload.studentId)] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'student-payments', payload.studentId] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'overview'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'dues'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'receipts'] });
    },
  });

  const deleteStructureMutation = useMutation({
    mutationFn: feeApi.deleteStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees', 'structures'] });
      queryClient.invalidateQueries({ queryKey: ['fees', 'overview'] });
    },
  });

  const voidPaymentMutation = useMutation({
    mutationFn: (id) => feeApi.voidPayment(id, { reason: 'Voided from Fees Management.' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: feeApi.verifyPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: (id) => feeApi.rejectPayment(id, { reason: 'Rejected by admin verification.' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fees'] });
    },
  });

  const feeClasses = classesQuery.data || [];
  const structures = structuresQuery.data || [];
  const studentOptions = useMemo(() => pagesContent(studentSearchQuery.data)
    .map((student) => ({
      id: student.id,
      name: student.studentName || student.enrollmentNo || 'Unnamed student',
      className: normalizeClassName(student.className) || 'Course pending',
      sectionName: student.section || '',
      enrollmentNo: student.enrollmentNo || `Student ${student.id}`,
      category: student.category || 'General',
      transportStatus: student.transportStatus,
      hostelStatus: student.hostelStatus,
      libraryStatus: student.libraryStatus,
      libraryMonthlyCharge: student.libraryMonthlyCharge,
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  [studentSearchQuery.data]);
  const selectedStudentPayments = pagesContent(selectedStudentPaymentsQuery.data);
  const dueRows = pagesContent(duesQuery.data);

  useEffect(() => {
    const error = overviewQuery.error || classesQuery.error || structuresQuery.error || studentSearchQuery.error || selectedStudentSummaryQuery.error || selectedStudentPaymentsQuery.error || duesQuery.error;
    setLoadError(error?.message || '');
  }, [classesQuery.error, duesQuery.error, overviewQuery.error, selectedStudentPaymentsQuery.error, selectedStudentSummaryQuery.error, structuresQuery.error, studentSearchQuery.error]);

  const courseOptions = useMemo(() => {
    return [
      ...new Set([
        ...feeClasses.map((className) => normalizeClassName(className)).filter(Boolean),
        ...structures.map((structure) => normalizeClassName(structure.courseId)).filter(Boolean),
      ]),
    ].sort(compareClassNames);
  }, [feeClasses, structures]);

  const receiptRows = useMemo(() => {
    return selectedStudentPayments
      .map((payment) => {
        const structure = structures.find((entry) => String(entry.id) === String(payment.structureId));
        const student = studentOptions.find((entry) => String(entry.id) === String(payment.studentId));
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
          balanceRemaining: payment.balanceRemaining ?? 0,
          downloadLink: payment.downloadLink || `receipt-${payment.id}.txt`,
        };
      })
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0));
  }, [selectedStudentPayments, structures, studentOptions]);

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
        .filter((structure) => normalizeClassName(structure.courseId) === selectedFeeClass)
        .map((structure) => structure.category)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
  }, [selectedFeeClass, structures]);

  const selectedClassStructures = useMemo(() => {
    return structures
      .filter((structure) => normalizeClassName(structure.courseId) === selectedFeeClass)
      .filter((structure) => !structureCategoryFilter || structure.category === structureCategoryFilter)
      .sort((a, b) => String(a.feeComponent || '').localeCompare(String(b.feeComponent || '')));
  }, [selectedFeeClass, structureCategoryFilter, structures]);

  const selectedPaymentStudent = studentOptions.find((student) => String(student.id) === String(paymentForm.studentId));
  const collectionClassOptions = useMemo(() => {
    return [...new Set(courseOptions.filter(Boolean))].sort(compareClassNames);
  }, [courseOptions]);
  const collectionSectionOptions = useMemo(() => {
    if (!paymentForm.className) return [];
    return [...new Set(
      studentOptions
        .filter((student) => student.className === paymentForm.className)
        .map((student) => student.sectionName)
        .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
  }, [paymentForm.className, studentOptions]);
  const filteredCollectionStudents = useMemo(() => {
    return studentOptions.filter((student) => {
      if (!paymentForm.className || student.className !== paymentForm.className) return false;
      if (collectionSectionOptions.length > 0 && student.sectionName !== paymentForm.section) return false;
      return true;
    });
  }, [collectionSectionOptions.length, paymentForm.className, paymentForm.section, studentOptions]);
  const canSelectCollectionStudent = Boolean(paymentForm.className) && (collectionSectionOptions.length === 0 || Boolean(paymentForm.section));
  const filteredDueRows = useMemo(() => dueRows.map((row) => ({
    id: row.studentId,
    student: {
      name: row.studentName,
      enrollmentNo: row.enrollmentNo,
      className: row.className,
    },
    structure: {
      feeComponent: row.dueStatus || 'Outstanding',
      billingType: 'cycle_based',
    },
    billingType: 'cycle_based',
    currentCycleLabel: 'Current session',
    lateFeeFine: 0,
    totalOutstanding: Number(row.outstanding) || 0,
    reminderCount: Number(row.outstanding) > 0 ? 1 : 0,
  })), [dueRows]);
  const selectedPaymentRows = useMemo(() => {
    if (!selectedPaymentStudent) return [];
    if (selectedStudentSummaryQuery.data?.components) {
      return selectedStudentSummaryQuery.data.components.map((component) => ({
        id: component.feeStructureId,
        structure: {
          id: component.feeStructureId,
          feeComponent: component.feeComponent,
          feeType: 'college_fee',
          billingType: 'cycle_based',
        },
        billingType: 'cycle_based',
        currentCycleLabel: component.dueDate || 'Current session',
        currentCycleMonths: [],
        serviceMonthsCount: 0,
        totalOutstanding: Number(component.outstandingAmount) || 0,
        currentCycleDueAmount: Number(component.outstandingAmount) || 0,
        previousPendingAmount: 0,
        lateFeeFine: 0,
        reminderCount: Number(component.outstandingAmount) > 0 ? 1 : 0,
      }));
    }
    return [];
  }, [selectedPaymentStudent, selectedStudentSummaryQuery.data]);
  const selectedPaymentOutstandingTotal = useMemo(() => (
    selectedPaymentRows.reduce((sum, row) => sum + (Number(row.totalOutstanding) || 0), 0)
  ), [selectedPaymentRows]);
  const selectedPaymentSummary = useMemo(() => {
    if (selectedStudentSummaryQuery.data) {
      const summary = selectedStudentSummaryQuery.data;
      return {
        previousPending: Number(summary.previousPending) || 0,
        collegeFee: Number(summary.currentDue) || 0,
        facilityFee: 0,
        facilityRows: [],
        totalPayable: Number(summary.totalOutstanding) || 0,
        paidAmount: Number(paymentForm.paidAmount) || 0,
        newPending: Math.max((Number(summary.totalOutstanding) || 0) - (Number(paymentForm.paidAmount) || 0), 0),
      };
    }
    const paidAmount = Number(paymentForm.paidAmount) || 0;
    return {
      previousPending: 0,
      collegeFee: selectedPaymentOutstandingTotal,
      facilityFee: 0,
      facilityRows: [],
      totalPayable: selectedPaymentOutstandingTotal,
      paidAmount,
      newPending: Math.max(selectedPaymentOutstandingTotal - paidAmount, 0),
    };
  }, [paymentForm.paidAmount, selectedPaymentOutstandingTotal, selectedPaymentRows, selectedStudentSummaryQuery.data]);
  const selectedPaymentHistory = useMemo(() => {
    if (!selectedPaymentStudent) return [];
    return receiptRows
      .filter((receipt) => String(receipt.studentId) === String(selectedPaymentStudent.id))
      .map((receipt) => ({
        ...receipt,
        noticeSent: receipt.notificationStatus === 'SENT',
      }));
  }, [receiptRows, selectedPaymentStudent]);

  const handleSaveFeeStructure = async (e) => {
    e.preventDefault();
    const feeComponent = resolveStructureComponentName(structureForm);
    const feeCategory = categoryWiseFees ? structureForm.category : ALL_STUDENTS_CATEGORY;
    const amount = Number(structureForm.amount) || 0;
    const cycleMonths = Math.min(Math.max(Number(structureForm.cycleMonths) || 1, 1), 12);
    const billingType = resolveBillingType({ ...structureForm, feeComponent });
    if (!selectedFeeClass || !feeCategory || !feeComponent || !amount) return;

    try {
      await saveStructureMutation.mutateAsync({
        courseId: selectedFeeClass,
        category: feeCategory,
        feeComponent,
        amount,
        cycleMonths,
        billingType,
        feeType: structureForm.feeType || 'college_fee',
        facilityKey: structureForm.feeType === 'facility_fee' ? structureForm.facilityKey : '',
        dueDate: structureForm.dueDate || today,
      });
      setStructureForm((current) => ({
        ...initialStructureForm,
        courseId: selectedFeeClass,
        category: categoryWiseFees ? current.category : ALL_STUDENTS_CATEGORY,
        feeType: current.feeType,
        facilityKey: current.facilityKey,
        billingType: current.billingType,
        cycleMonths: current.cycleMonths,
        dueDate: current.dueDate || today,
      }));
    } catch (error) {
      setLoadError(error.message || 'Unable to save fee structure in database.');
    }
  };

  const handleAddManualClass = (e) => {
    e.preventDefault();
    const className = normalizeClassName(manualClassName);
    if (!className) return;
    setSelectedFeeClass(className);
    setCategoryWiseFees(false);
    setStructureCategoryFilter('');
    setStructureForm({ ...initialStructureForm, courseId: className });
    setManualClassName('');
  };

  const handleStudentSelect = (studentId) => {
    setFeeSummaryOpen(false);
    setGeneratedReceipt(null);
    setPaymentForm((current) => ({
      ...current,
      studentId,
      paymentTarget: 'due_auto',
      paidAmount: '',
    }));
  };

  const handleCollectionClassSelect = (className) => {
    setFeeSummaryOpen(false);
    setGeneratedReceipt(null);
    setPaymentForm((current) => ({
      ...current,
      className,
      section: '',
      studentId: '',
      paymentTarget: 'due_auto',
      paidAmount: '',
      transactionId: '',
      gatewayRef: '',
    }));
  };

  const handleCollectionSectionSelect = (section) => {
    setFeeSummaryOpen(false);
    setGeneratedReceipt(null);
    setPaymentForm((current) => ({
      ...current,
      section,
      studentId: '',
      paymentTarget: 'due_auto',
      paidAmount: '',
      transactionId: '',
      gatewayRef: '',
    }));
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    setGeneratedReceipt(null);
    const selectedStudent = studentOptions.find((student) => String(student.id) === String(paymentForm.studentId));
    if (!selectedStudent || !paymentForm.paidAmount) return;
    const paidAmount = Number(paymentForm.paidAmount) || 0;
    if (paidAmount <= 0) return;
    if (paymentForm.paymentTarget !== 'advance_only' && selectedPaymentRows.length === 0) return;
    const counterNote = paymentForm.mode === 'Cash' ? 'Collected at college counter' : 'Collected through digital mode';

    const { className, section, ...paymentPayload } = paymentForm;

    try {
      const savedPayment = await savePaymentMutation.mutateAsync({
        ...paymentPayload,
        studentId: selectedStudent.id,
        structureId: 'overall_total',
        transactionId: paymentForm.transactionId || '',
        gatewayRef: counterNote,
        paidAmount,
        idempotencyKey: crypto.randomUUID(),
        coverageLabel: paymentForm.paymentTarget === 'advance_only'
          ? 'Advance payment for upcoming cycle'
          : 'Overall payment auto-adjusted',
        activeFromMonth: '',
        billedMonthsCount: 0,
        billingType: 'overall_payment',
      });
      const generated = enrichReceiptForDisplay(savedPayment, selectedStudent);
      generated.noticeSent = savedPayment.notificationStatus === 'SENT';
      setGeneratedReceipt(generated);
      setPaymentForm(initialPaymentForm);
    } catch (error) {
      setLoadError(error.message || 'Unable to save payment in database.');
    }
  };

  const handleDelete = async (module, recordId, message) => {
    if (!window.confirm(message)) return;
    try {
      if (module === 'fee_structures') {
        await deleteStructureMutation.mutateAsync(recordId);
      } else if (module === 'fee_payments') {
        await voidPaymentMutation.mutateAsync(recordId);
      }
    } catch (error) {
      setLoadError(error.message || 'Unable to delete fee record from database.');
    }
  };

  const handleBack = () => {
    if (selectedFeeClass) {
      setSelectedFeeClass('');
      setCategoryWiseFees(false);
      setStructureCategoryFilter('');
      setStructureForm(initialStructureForm);
      return;
    }
    if (activeSection !== 'home') {
      setActiveSection('home');
      return;
    }
    navigate('/college');
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
      `${receipt.mode === 'Cash' ? 'Receipt / Voucher No.' : 'Transaction ID'}: ${receipt.transactionId}`,
      `${receipt.mode === 'Cash' ? 'Counter Note' : 'Gateway Ref'}: ${receipt.gatewayRef || '-'}`,
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
              onClick={handleBack}
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
        {loadError ? (
          <div className="mb-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {loadError}
          </div>
        ) : null}

        {activeSection === 'home' ? (
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <ActionCard icon={BadgeIndianRupee} title="Fee Structure Setup" text="Define cycle-based fees and monthly hostel, transport, or library service fees." onClick={() => setActiveSection('structures')} />
            <ActionCard icon={CreditCard} title="Fee Collection" text="Collect fee at the counter, with cash as the default mode and receipt-ready allocation." onClick={() => setActiveSection('payments')} />
            <ActionCard icon={CalendarClock} title="Due Fee Reports" text="Find pending balances, late fines, and reminder counts." onClick={() => setActiveSection('dues')} />
          </section>
        ) : (
          <div className="mt-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">Fee Module Page</p>
              <h2 className="mt-2 font-serif text-3xl font-black italic tracking-tight text-slate-950">{sectionTitle(activeSection)}</h2>
            </div>
          </div>
        )}

        {activeSection === 'structures' ? (
          selectedFeeClass ? (
            <Panel
              className="mt-8"
              title={`${selectedFeeClass} Fee Structure`}
              description="Save class-wise and category-wise monthly rates, then review saved structures in the table."
            >
              <div className="mt-8 space-y-8">
                <form className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleSaveFeeStructure}>
                  <InputField label="Class" value={selectedFeeClass} readOnly />
                  <div className="space-y-2.5">
                    <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Category Mode</label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryWiseFees(false);
                          setStructureForm({ ...structureForm, category: ALL_STUDENTS_CATEGORY });
                        }}
                        className={`rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                          !categoryWiseFees ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                        }`}
                      >
                        Same For All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryWiseFees(true);
                          setStructureForm({
                            ...structureForm,
                            category: structureForm.category === ALL_STUDENTS_CATEGORY ? 'General' : structureForm.category,
                          });
                        }}
                        className={`rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                          categoryWiseFees ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                        }`}
                      >
                        Category Wise
                      </button>
                    </div>
                  </div>
                  {categoryWiseFees ? (
                    <SelectField label="Category" value={structureForm.category} onChange={(e) => setStructureForm({ ...structureForm, category: e.target.value })} options={['General', 'OBC', 'SC', 'ST', 'EWS', 'Scholarship']} />
                  ) : null}
                  <SelectField
                    label="Fee Type"
                    value={structureForm.feeType}
                    onChange={(e) => {
                      const feeType = e.target.value;
                      setStructureForm({
                        ...structureForm,
                        feeType,
                        facilityKey: feeType === 'facility_fee' ? (structureForm.facilityKey || 'transport') : '',
                        feeComponent: '',
                        billingType: feeType === 'facility_fee'
                          ? (structureForm.billingType === 'monthly_active' ? 'monthly_active' : 'active_cycle')
                          : 'cycle_based',
                      });
                    }}
                    options={['college_fee', 'facility_fee']}
                    renderOptionLabel={(value) => formatFeeType(value)}
                  />
                  {structureForm.feeType === 'facility_fee' ? (
                    <SelectField
                      label="Facility"
                      value={structureForm.facilityKey}
                      onChange={(e) => setStructureForm({ ...structureForm, facilityKey: e.target.value, feeComponent: '' })}
                      options={['transport', 'hostel', 'library', 'other']}
                      renderOptionLabel={(value) => ({
                        transport: 'Transport',
                        hostel: 'Hostel',
                        library: 'Library',
                        other: 'Other Facility',
                      }[value] || 'Select facility')}
                    />
                  ) : null}
                  <SelectField
                    label="Billing Rule"
                    value={structureForm.billingType}
                    onChange={(e) => {
                      const billingType = e.target.value;
                      setStructureForm({
                        ...structureForm,
                        billingType,
                      });
                    }}
                    options={structureForm.feeType === 'facility_fee' ? ['monthly_active', 'active_cycle'] : ['cycle_based']}
                    renderOptionLabel={(value) => {
                      if (value === 'cycle_based') return 'Cycle Based Fee';
                      if (value === 'monthly_active') return 'Monthly Active Service';
                      if (value === 'active_cycle') return 'Active Facility Cycle';
                      return 'Select billing rule';
                    }}
                  />
                  <SelectField
                    label="Billing Frequency"
                    value={structureForm.cycleMonths}
                    onChange={(e) => setStructureForm({ ...structureForm, cycleMonths: e.target.value })}
                    options={['1', '3', '6', '12']}
                    renderOptionLabel={(value) => ({
                      1: 'Monthly Cycle',
                      3: 'Every 3 Months',
                      6: 'Every 6 Months',
                      12: 'One Time In A Year',
                    }[value] || `Every ${value} Months`)}
                  />
                  <InputField
                    label="Amount Per Month"
                    type="number"
                    min="0"
                    value={structureForm.amount}
                    onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                    placeholder={structureForm.feeType === 'facility_fee' ? '1200' : '5000'}
                  />
                  <InputField
                    label="Due Date"
                    type="date"
                    value={structureForm.dueDate}
                    onChange={(e) => setStructureForm({ ...structureForm, dueDate: e.target.value })}
                  />
                  <div className="md:col-span-2 xl:col-span-3">
                    <PrimaryButton type="submit" icon={BadgeIndianRupee} label="Save Fee Setup" />
                  </div>
                </form>

                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h4 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">Saved Fees Structure</h4>
                      <p className="mt-1 text-sm leading-7 text-slate-500">Rows below are saved for this class, not separate sections.</p>
                    </div>
                    <div className="w-full sm:w-64">
                      <SelectField
                        label="Filter By Category"
                        value={structureCategoryFilter}
                        onChange={(e) => setStructureCategoryFilter(e.target.value)}
                        options={['', ...selectedClassCategoryOptions]}
                        renderOptionLabel={(value) => value || 'All Categories'}
                      />
                    </div>
                  </div>

                  <FeeStructureTable
                    rows={selectedClassStructures}
                    onDelete={(structure) => handleDelete('fee_structures', structure.id, 'Delete this fee structure?')}
                  />
                </div>
              </div>
            </Panel>
          ) : (
            <Panel className="mt-8" title="Select Class" description="Choose the class first. Fees are maintained class-wise, not section-wise.">
                <div className="mt-6">
                  <SearchInput value={structureSearch} onChange={setStructureSearch} placeholder="Search class..." />
                </div>
                <form className="mt-4 flex flex-col gap-3 rounded-[1.4rem] border border-emerald-100 bg-emerald-50/60 p-4 sm:flex-row" onSubmit={handleAddManualClass}>
                  <input
                    value={manualClassName}
                    onChange={(e) => setManualClassName(e.target.value)}
                    placeholder="Add class/course manually"
                    className="min-w-0 flex-1 rounded-2xl border-2 border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-950"
                  >
                    Add Class
                  </button>
                </form>
                <div className="mt-6 grid gap-3">
                  {filteredFeeClasses.length > 0 ? filteredFeeClasses.map((className) => {
                    const classStructures = structures.filter((structure) => normalizeClassName(structure.courseId) === className);
                    const classTotal = classStructures.reduce((sum, structure) => sum + (Number(structure.amount) || 0), 0);
                    return (
                      <button
                        key={className}
                        type="button"
                        onClick={() => {
                          setSelectedFeeClass(className);
                          setCategoryWiseFees(false);
                          setStructureCategoryFilter('');
                          setStructureForm({ ...initialStructureForm, courseId: className });
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
                  }) : (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                      <p className="text-sm font-semibold text-slate-500">
                        No classes found. Add a class/course above, then create its fee structure.
                      </p>
                    </div>
                  )}
                </div>
            </Panel>
          )
        ) : null}

        {activeSection === 'payments' ? (
          <Panel className="mt-8" title="Counter Fee Collection" description="Cash counter ke liye student select karo, payable amount verify karo, cash receive karo, aur receipt save karo.">
                <form className="mt-8 grid gap-5 md:grid-cols-2" onSubmit={handleSavePayment}>
                  <SelectField
                    label="Class"
                    value={paymentForm.className}
                    onChange={(e) => handleCollectionClassSelect(e.target.value)}
                    options={['', ...collectionClassOptions]}
                    renderOptionLabel={(value) => value || 'Select class'}
                  />
                  <SelectField
                    label="Section"
                    value={paymentForm.section}
                    onChange={(e) => handleCollectionSectionSelect(e.target.value)}
                    options={['', ...collectionSectionOptions]}
                    disabled={!paymentForm.className || collectionSectionOptions.length === 0}
                    renderOptionLabel={(value) => {
                      if (value) return value;
                      if (!paymentForm.className) return 'Select class first';
                      return collectionSectionOptions.length ? 'Select section' : 'No section found';
                    }}
                  />
                  <div className="md:col-span-2">
                    <SelectField
                      label="Student Name"
                      value={paymentForm.studentId}
                      onChange={(e) => handleStudentSelect(e.target.value)}
                      options={['', ...filteredCollectionStudents.map((student) => String(student.id))]}
                      disabled={!canSelectCollectionStudent}
                      renderOptionLabel={(value) => {
                        if (!value && !paymentForm.className) return 'Select class first';
                        if (!value && collectionSectionOptions.length > 0 && !paymentForm.section) return 'Select section first';
                        return studentLabel(value, filteredCollectionStudents);
                      }}
                    />
                  </div>
                  {studentSearchQuery.hasNextPage ? (
                    <div className="md:col-span-2">
                      <LoadMoreButton
                        label={`Load More Students (${studentOptions.length}/${studentSearchQuery.data?.pages?.at(-1)?.totalElements || studentOptions.length})`}
                        loading={studentSearchQuery.isFetchingNextPage}
                        onClick={() => studentSearchQuery.fetchNextPage()}
                      />
                    </div>
                  ) : null}
                  {selectedPaymentStudent ? (
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
                        >
                          <div>
                            <h4 className="text-sm font-black text-slate-950">Simple Fee Summary</h4>
                            <p className="mt-1 text-xs font-semibold text-slate-500">Click to view cycle and facility usage.</p>
                          </div>
                          <ChevronDown className={`shrink-0 text-slate-400 transition ${feeSummaryOpen ? 'rotate-180 text-emerald-700' : ''}`} size={18} />
                        </button>
                        <div className="grid gap-2 px-4 pb-4">
                          <SummaryLine label="College Fees" value={formatMoney(selectedPaymentSummary.collegeFee)} />
                          {selectedPaymentSummary.facilityRows.map((row) => (
                            <SummaryLine key={row.id} label={`${row.structure.feeComponent} Facility`} value={formatMoney(row.currentCycleDueAmount)} />
                          ))}
                          {selectedPaymentSummary.facilityRows.length === 0 ? (
                            <SummaryLine label="Facility Fees" value={formatMoney(0)} />
                          ) : null}
                          <SummaryLine label="Previous Pending" value={formatMoney(selectedPaymentSummary.previousPending)} tone="danger" />
                        </div>
                        <div className={`grid transition-all duration-300 ease-out ${feeSummaryOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                          <div className="overflow-hidden">
                            <div className="mx-4 mb-4 mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <h5 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Cycle Details</h5>
                              <div className="mt-3 grid gap-2">
                                <SummaryDetailLine label="College Fee" meta={resolveCycleDetailMeta(selectedPaymentSummary.collegeFee, selectedPaymentRows)} value={formatMoney(selectedPaymentSummary.collegeFee)} />
                                {selectedPaymentSummary.facilityRows.map((row) => (
                                  <SummaryDetailLine
                                    key={row.id}
                                    label={row.structure.feeComponent}
                                    meta={`${row.serviceMonthsCount || row.currentCycleMonths?.length || 0} month${(row.serviceMonthsCount || row.currentCycleMonths?.length || 0) === 1 ? '' : 's'} used in ${row.currentCycleLabel}`}
                                    value={formatMoney(row.currentCycleDueAmount)}
                                  />
                                ))}
                                {selectedPaymentSummary.facilityRows.length === 0 ? (
                                  <SummaryDetailLine label="Facilities" meta="No active facility usage in this cycle" value={formatMoney(0)} />
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <SelectField
                    label="Collection Mode"
                    value={paymentForm.mode}
                    onChange={(e) => setPaymentForm((current) => ({
                      ...current,
                      mode: e.target.value,
                    }))}
                    options={['Cash', 'UPI', 'Card', 'Net Banking', 'Cheque']}
                  />
                  <InputField
                    label="Amount To Collect"
                    type="number"
                    min="0"
                    value={paymentForm.paidAmount}
                    onChange={(e) => setPaymentForm((current) => ({
                      ...current,
                      paidAmount: e.target.value,
                    }))}
                    placeholder="25000"
                  />
                  <div className="md:col-span-2">
                    <PrimaryButton type="submit" icon={CreditCard} label="Tap To Collect" />
                  </div>
                </form>
                {generatedReceipt ? (
                  <ReceiptPreview receipt={generatedReceipt} onDownload={handleDownloadReceipt} />
                ) : null}
                {selectedPaymentStudent ? (
                  <>
                    <PaymentHistoryTable
                      rows={selectedPaymentHistory}
                      onVerify={(id) => verifyPaymentMutation.mutateAsync(id)}
                      onReject={(id) => rejectPaymentMutation.mutateAsync(id)}
                      verifying={verifyPaymentMutation.isPending || rejectPaymentMutation.isPending}
                    />
                    {selectedStudentPaymentsQuery.hasNextPage ? (
                      <LoadMoreButton
                        label={`Load More Payments (${selectedPaymentHistory.length}/${selectedStudentPaymentsQuery.data?.pages?.at(-1)?.totalElements || selectedPaymentHistory.length})`}
                        loading={selectedStudentPaymentsQuery.isFetchingNextPage}
                        onClick={() => selectedStudentPaymentsQuery.fetchNextPage()}
                      />
                    ) : null}
                  </>
                ) : null}
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
              {duesQuery.hasNextPage ? (
                <LoadMoreButton
                  label={`Load More Dues (${filteredDueRows.length}/${duesQuery.data?.pages?.at(-1)?.totalElements || filteredDueRows.length})`}
                  loading={duesQuery.isFetchingNextPage}
                  onClick={() => duesQuery.fetchNextPage()}
                />
              ) : null}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
};

const getStudentClassName = (student = {}) => (
  normalizeClassName(student.assignedClass || student.className || '')
);

const getStudentSectionName = (student = {}) => {
  if (student.section) return String(student.section).trim();
  const assignedClassParts = String(student.assignedClass || '').split('/');
  return assignedClassParts[1]?.trim() || '';
};

const normalizeClassName = (className = '') => String(className)
  .split('/')
  .at(0)
  ?.replace(/\s+-\s+section\s+.+$/i, '')
  .replace(/\s+section\s+.+$/i, '')
  .trim() || '';

const resolveStructureComponentName = (structure = {}) => {
  if (structure.feeType !== 'facility_fee') return 'College Fee';
  return ({
    transport: 'Transport',
    hostel: 'Hostel',
    library: 'Library',
    other: 'Other Facility',
  }[structure.facilityKey] || 'Facility Fee');
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
  payments: 'Fee Counter Collection',
  dues: 'Due Fee Reports',
}[section] || 'Fee Management');

const enrichReceiptForDisplay = (receipt, student) => ({
  ...receipt,
  student,
  structure: {
    feeComponent: Array.isArray(receipt.allocations) && receipt.allocations.length
      ? `Overall Fee Payment (${receipt.allocations.length} allocations)`
      : 'Overall Fee Payment',
    billingType: receipt.billingType || 'overall_payment',
    courseId: student?.className || 'Course pending',
  },
  receiptNumber: receipt.receiptNumber || `RCPT-${receipt.id}`,
  taxBreakdown: receipt.taxBreakdown || calculateTaxBreakdown(receipt.paidAmount),
  balanceRemaining: receipt.balanceRemaining ?? 0,
  downloadLink: receipt.downloadLink || `receipt-${receipt.receiptNumber || receipt.id}.txt`,
});

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
  if (resolveBillingType(structure) === 'monthly_active') return `${formatMoney(amount)} / month`;
  return `${formatMoney(amount)} / month, collected ${formatCycleLabel(structure.cycleMonths).toLowerCase()}`;
};

const resolveCycleDetailMeta = (amount, rows = []) => {
  if (!amount) return 'No college fee due in this cycle';
  const collegeRow = rows.find((row) => row.structure?.feeType !== 'facility_fee');
  return collegeRow?.currentCycleLabel || 'Current cycle';
};

const buildFeeCollectionNoticePayload = ({
  student,
  receiptNumber,
  paidAmount,
  balanceRemaining,
  mode,
  paymentDate,
  summary,
  rows,
}) => {
  const studentName = student?.name || student?.enrollmentNo || 'Student';
  const cycleLabel = resolveCycleDetailMeta(summary.collegeFee, rows);
  const cycleFee = (Number(summary.collegeFee) || 0) + (Number(summary.facilityFee) || 0);
  const facilityLines = summary.facilityRows.length
    ? summary.facilityRows.map((row) => {
        const monthsUsed = row.serviceMonthsCount || row.currentCycleMonths?.length || 0;
        return `- ${row.structure.feeComponent}: ${formatMoney(row.currentCycleDueAmount)} (${monthsUsed} month${monthsUsed === 1 ? '' : 's'} used)`;
      })
    : ['- No facility fee charged in this cycle'];

  return {
    title: `Fee received: ${formatMoney(paidAmount)}`,
    category: 'Fee',
    audience: 'Students',
    targetClasses: [student.className || 'All'],
    targetStudentId: student.id,
    priority: balanceRemaining > 0 ? 'High' : 'Normal',
    publishDate: paymentDate || getTodayKey(),
    expireDate: null,
    status: 'Published',
    isPinned: false,
    summary: `${studentName}, your fee payment of ${formatMoney(paidAmount)} has been received. Pending balance: ${formatMoney(balanceRemaining)}.`,
    details: [
      `Receipt No.: ${receiptNumber}`,
      `Student: ${studentName}`,
      `Class: ${student.className || '-'}`,
      `Section: ${student.sectionName || '-'}`,
      `Payment Date: ${paymentDate || getTodayKey()}`,
      `Payment Mode: ${mode || 'Cash'}`,
      '',
      `Month/Cycle: ${cycleLabel}`,
      `Cycle Fee: ${formatMoney(cycleFee)}`,
      `College Fee: ${formatMoney(summary.collegeFee)}`,
      `Facilities Fee: ${formatMoney(summary.facilityFee)}`,
      ...facilityLines,
      '',
      `Previous Pending: ${formatMoney(summary.previousPending)}`,
      `Amount Deposited: ${formatMoney(paidAmount)}`,
      `Remaining Pending: ${formatMoney(balanceRemaining)}`,
    ].join('\n'),
  };
};

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

const LoadMoreButton = ({ label, loading, onClick }) => (
  <button
    type="button"
    disabled={loading}
    onClick={onClick}
    className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {loading ? 'Loading...' : label}
  </button>
);

const InfoPill = ({ icon, text }) => (
  <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
    {React.createElement(icon, { size: 15, className: 'text-emerald-700' })}
    <span>{text}</span>
  </div>
);

const ReceiptPreview = ({ receipt, onDownload }) => (
  <div className="mt-8 rounded-[1.8rem] border border-emerald-200 bg-emerald-50/70 p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
          <ReceiptText size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">Fees Receipt Generated</p>
          <h4 className="mt-1 truncate text-xl font-black tracking-tight text-slate-950">{receipt.receiptNumber}</h4>
          <p className="mt-1 text-sm font-semibold text-slate-600">{receipt.student?.name || 'Student pending'} | {receipt.student?.enrollmentNo || '-'}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDownload(receipt)}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-emerald-700"
      >
        <Download size={15} />
        Download
      </button>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <InvoiceStat label="Paid Amount" value={formatMoney(receipt.paidAmount)} strong tone="success" />
      <InvoiceStat label="Balance" value={formatMoney(receipt.balanceRemaining)} tone={Number(receipt.balanceRemaining) > 0 ? 'danger' : 'success'} />
      <InvoiceStat label="Mode" value={receipt.mode || 'Cash'} />
      <InvoiceStat label="Notice" value={receipt.noticeSent ? 'Sent' : 'Pending'} tone={receipt.noticeSent ? 'success' : 'default'} />
    </div>
    <div className="mt-5 grid gap-2 rounded-2xl border border-emerald-100 bg-white p-4">
      <SummaryLine label="Payment Date" value={receipt.paymentDate || '-'} />
      <SummaryLine label="Cycle Window" value={resolveCoverageLabel(receipt)} />
      <SummaryLine label={receipt.mode === 'Cash' ? 'Receipt / Voucher No.' : 'Transaction ID'} value={receipt.transactionId || '-'} />
      <SummaryLine label="Tax Breakdown" value={receipt.taxBreakdown || '-'} />
    </div>
  </div>
);

const FeeStructureTable = ({ rows, onDelete }) => (
  <div className="mt-5 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white">
    {rows.length ? (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Category</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Type</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Fee</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Monthly Amount</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Cycle</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Billing</th>
              <th className="px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Due Date</th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((structure) => (
              <tr key={structure.id} className="hover:bg-emerald-50/40">
                <td className="px-4 py-4 font-bold text-slate-900">{structure.category || '-'}</td>
                <td className="px-4 py-4 text-slate-600">{formatFeeType(structure.feeType)}</td>
                <td className="px-4 py-4 font-bold text-slate-900">{structure.feeComponent || '-'}</td>
                <td className="px-4 py-4 font-black text-slate-950">{formatMoney(structure.amount)}</td>
                <td className="px-4 py-4 text-slate-600">{formatCycleLabel(structure.cycleMonths)}</td>
                <td className="px-4 py-4 text-slate-600">{formatBillingType(structure.billingType, structure.feeComponent)}</td>
                <td className="px-4 py-4 text-slate-600">{structure.dueDate || '-'}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(structure)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete fee structure"
                  >
                    <Trash2 size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="px-6 py-12 text-center">
        <h4 className="font-serif text-2xl font-black italic tracking-tight text-slate-950">No fees added</h4>
        <p className="mt-2 text-sm leading-7 text-slate-500">Save the first fee setup for this class.</p>
      </div>
    )}
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

const SummaryLine = ({ label, value, strong = false, tone = 'default' }) => {
  const toneClass = {
    danger: 'text-rose-600',
    default: 'text-slate-950',
  }[tone] || 'text-slate-950';

  return (
    <div className={`flex items-center justify-between gap-4 rounded-2xl px-4 py-3 ${strong ? 'bg-slate-950 text-white' : 'bg-slate-50'}`}>
      <span className={`text-sm ${strong ? 'font-black' : 'font-semibold text-slate-600'}`}>{label}</span>
      <span className={`text-base font-black ${strong ? 'text-white' : toneClass}`}>{value}</span>
    </div>
  );
};

const SummaryDetailLine = ({ label, meta, value }) => (
  <div className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-sm font-black text-slate-900">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{meta}</p>
    </div>
    <p className="text-sm font-black text-slate-950">{value}</p>
  </div>
);

const PaymentHistoryTable = ({ rows, onVerify, onReject, verifying }) => (
  <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <h4 className="text-sm font-black text-slate-950">Payment History</h4>
      <p className="mt-1 text-xs font-semibold text-slate-500">Student ne kab-kab fees jama ki, mode chahe counter cash/card ho ya online.</p>
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
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Notice</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Amount</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Balance</th>
              <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-emerald-50/40">
                <td className="px-4 py-4 font-semibold text-slate-700">{receipt.paymentDate || '-'}</td>
                <td className="px-4 py-4 font-black text-slate-900">{receipt.receiptNumber || receipt.transactionId || '-'}</td>
                <td className="px-4 py-4 text-slate-600">{receipt.mode || '-'}</td>
                <td className="px-4 py-4 text-slate-600">{receipt.paymentStatus || '-'}</td>
                <td className="px-4 py-4">
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${receipt.noticeSent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {receipt.noticeSent ? 'Notice Sent' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-black text-slate-950">{formatMoney(receipt.paidAmount)}</td>
                <td className="px-4 py-4 text-right font-semibold text-slate-600">{formatMoney(receipt.balanceRemaining)}</td>
                <td className="px-4 py-4">
                  {String(receipt.paymentStatus || '').toUpperCase() === 'PENDING_VERIFICATION' ? (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={verifying}
                        onClick={() => onVerify?.(receipt.id)}
                        className="rounded-full bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        disabled={verifying}
                        onClick={() => onReject?.(receipt.id)}
                        className="rounded-full bg-rose-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="block text-right text-xs font-semibold text-slate-400">-</span>
                  )}
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

function pageContent(page) {
  return Array.isArray(page) ? page : page?.content || [];
}

function pagesContent(data) {
  if (!data?.pages) return pageContent(data);
  return data.pages.flatMap(pageContent);
}

function nextPageParam(lastPage) {
  if (!lastPage || Array.isArray(lastPage) || lastPage.last) return undefined;
  const nextPage = Number(lastPage.number || 0) + 1;
  return nextPage < Number(lastPage.totalPages || 0) ? nextPage : undefined;
}

function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [delay, value]);

  return debouncedValue;
}

export default FeeManagement;
