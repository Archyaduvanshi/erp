const SESSION_MONTHS = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March',
];

const SESSION_MONTH_SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

export const getTodayKey = () => new Date().toISOString().split('T')[0];

export const daysLate = (dueDate, referenceDate = getTodayKey()) => {
  if (!dueDate) return 0;
  return Math.max(Math.ceil((new Date(referenceDate) - new Date(dueDate)) / (1000 * 60 * 60 * 24)), 0);
};

export const calculateLateFine = (dueDate, isSettled, referenceDate = getTodayKey()) => {
  return 0;
};

export const calculateTaxBreakdown = (amount) => {
  const paid = Number(amount) || 0;
  const tax = Math.round(paid * 0.18);
  return `Base Rs ${Math.max(paid - tax, 0)} + GST Rs ${tax}`;
};

export const formatCycleLabel = (cycleMonths) => {
  const normalizedCycle = Math.max(Number(cycleMonths) || 1, 1);
  return normalizedCycle === 1 ? 'Monthly collection' : `Every ${normalizedCycle} months`;
};

export const formatMoney = (amount) => `Rs ${Math.round(Number(amount) || 0).toLocaleString('en-IN')}`;

export const resolveBillingType = (structure = {}) => {
  if (structure.billingType) return structure.billingType;
  const component = String(structure.feeComponent || '').toLowerCase();
  if (component.includes('transport') || component.includes('hostel') || component.includes('library')) return 'monthly_active';
  return 'cycle_based';
};

export const formatBillingType = (billingType, feeComponent) => (
  ({
    monthly_active: 'Monthly Active Service',
    active_cycle: 'Active Facility Cycle',
    cycle_based: 'Cycle Based Fee',
  }[resolveBillingType({ billingType, feeComponent })] || 'Cycle Based Fee')
);

export const formatFeeType = (feeType) => (
  feeType === 'facility_fee' ? 'Facility Fee' : 'College Fee'
);

const buildSessionMonths = (referenceDate = getTodayKey()) => {
  const currentDate = new Date(referenceDate);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const sessionStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  return SESSION_MONTHS.map((monthName, index) => {
    const year = index < 9 ? sessionStartYear : sessionStartYear + 1;
    const monthNumber = ((index + 3) % 12) + 1;
    return {
      key: `${year}-${String(monthNumber).padStart(2, '0')}`,
      label: `${SESSION_MONTH_SHORT[index]} ${year}`,
      monthName,
      year,
      monthNumber,
      sessionIndex: index,
    };
  });
};

const getMonthKeyFromDate = (dateValue) => {
  if (!dateValue) return '';
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return '';
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
};

const getDateParts = (dateValue) => {
  if (!dateValue) return null;
  const [year, month, day] = String(dateValue).split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const buildCycleDueDate = (month, dueDay = 1) => {
  if (!month) return '';
  const lastDay = new Date(month.year, month.monthNumber, 0).getDate();
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), lastDay);
  return `${month.year}-${String(month.monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getFiscalCycleStarts = (cycleMonths, sessionMonths = []) => {
  const normalizedCycle = Math.min(Math.max(Number(cycleMonths) || 1, 1), 12);
  const starts = [];
  for (let index = 0; index < sessionMonths.length; index += normalizedCycle) {
    starts.push(index);
  }
  return starts;
};

const getDueCycleEntries = (cycleMonths, dueDate, sessionMonths = [], referenceDate = getTodayKey()) => {
  const normalizedCycle = Math.min(Math.max(Number(cycleMonths) || 1, 1), 12);
  const dueParts = getDateParts(dueDate);
  const dueMonthKey = getMonthKeyFromDate(dueDate) || sessionMonths[0]?.key;
  const dueMonthIndex = Math.max(sessionMonths.findIndex((month) => month.key === dueMonthKey), 0);
  const dueOffset = Math.min(dueMonthIndex % normalizedCycle, normalizedCycle - 1);
  const currentMonthKey = getMonthKeyFromDate(referenceDate);
  const currentMonthIndex = sessionMonths.findIndex((month) => month.key === currentMonthKey);
  const dueDay = dueParts?.day || 1;

  return getFiscalCycleStarts(normalizedCycle, sessionMonths)
    .map((startIndex) => {
      const months = sessionMonths.slice(startIndex, Math.min(startIndex + normalizedCycle, sessionMonths.length));
      const dueMonth = months[Math.min(dueOffset, months.length - 1)];
      const cycleDueDate = buildCycleDueDate(dueMonth, dueDay);
      return {
        startIndex,
        months,
        dueDate: cycleDueDate,
        isDue: Boolean(cycleDueDate) && referenceDate >= cycleDueDate,
        isCurrent: currentMonthIndex >= startIndex && currentMonthIndex < startIndex + normalizedCycle,
      };
    });
};

export const getCurrentCycleWindow = (cycleMonths, referenceDate = getTodayKey()) => {
  const normalizedCycle = Math.min(Math.max(Number(cycleMonths) || 1, 1), 12);
  const currentDate = new Date(referenceDate);
  const currentMonth = currentDate.getMonth();
  const sessionMonths = buildSessionMonths(referenceDate);
  const fiscalOffset = currentMonth >= 3 ? currentMonth - 3 : currentMonth + 9;
  const startIndex = Math.floor(fiscalOffset / normalizedCycle) * normalizedCycle;
  const months = sessionMonths.slice(startIndex, Math.min(startIndex + normalizedCycle, sessionMonths.length));
  return {
    months,
    label: months.length ? `${months[0].label} - ${months[months.length - 1].label}` : 'Current cycle',
  };
};

export const formatCoveredMonths = (coveredMonths = []) => {
  if (!coveredMonths.length) return 'Not specified';
  return coveredMonths.join(', ');
};

export const resolveCoverageLabel = (receipt) => receipt.coverageLabel || 'Current cycle';

export const getMonthlyActiveCoveredMonths = (feeRow, activeFromMonth) => {
  if (!feeRow || feeRow.billingType !== 'monthly_active') return [];
  const availableMonths = feeRow.currentCycleMonths.filter((month) => !feeRow.coveredMonths.includes(month.key));
  if (!activeFromMonth) return availableMonths.map((month) => month.key);
  const startIndex = availableMonths.findIndex((month) => month.key === activeFromMonth);
  if (startIndex === -1) return availableMonths.map((month) => month.key);
  return availableMonths.slice(startIndex).map((month) => month.key);
};

const getStructurePaymentEntries = (payments, structureId) => {
  const directEntries = payments
    .filter((payment) => String(payment.structureId) === String(structureId))
    .map((payment) => ({
      amount: Number(payment.paidAmount) || 0,
      coveredMonths: Array.isArray(payment.coveredMonths) ? payment.coveredMonths : [],
      kind: payment.kind || 'Current Due',
      advanceTargetMonthKey: payment.advanceTargetMonthKey || '',
    }));

  const allocationEntries = payments.flatMap((payment) => {
    if (!Array.isArray(payment.allocations)) return [];
    return payment.allocations
      .filter((allocation) => String(allocation.structureId) === String(structureId))
      .map((allocation) => ({
        amount: Number(allocation.amount) || 0,
        coveredMonths: Array.isArray(allocation.coveredMonths) ? allocation.coveredMonths : [],
        kind: allocation.kind || 'Current Due',
        advanceTargetMonthKey: allocation.advanceTargetMonthKey || '',
      }));
  });

  return [...directEntries, ...allocationEntries];
};

export const buildFeeRow = (structure, studentId, successfulPayments, referenceDate = getTodayKey()) => {
  const structurePayments = successfulPayments.filter(
    (payment) => String(payment.studentId) === String(studentId),
  );
  const billingType = resolveBillingType(structure);
  const currentCycle = getCurrentCycleWindow(structure.cycleMonths, referenceDate);
  const sessionMonths = buildSessionMonths(referenceDate);
  const currentMonthKey = getMonthKeyFromDate(referenceDate);
  const paymentEntries = getStructurePaymentEntries(structurePayments, structure.id);

  if (billingType === 'monthly_active') {
    const serviceStartKey = getMonthKeyFromDate(structure.activeFromMonth || structure.joinMonth || structure.dueDate) || sessionMonths[0]?.key;
    const serviceStartIndex = Math.max(sessionMonths.findIndex((month) => month.key === serviceStartKey), 0);
    const dueCycleEntries = getDueCycleEntries(structure.cycleMonths, structure.dueDate, sessionMonths, referenceDate);
    const dueCycles = dueCycleEntries.filter((cycle) => cycle.isDue);
    const currentDueCycle = dueCycleEntries.find((cycle) => cycle.isCurrent && cycle.isDue);
    const latestDueCycle = currentDueCycle || dueCycles[dueCycles.length - 1];
    const eligibleMonths = dueCycles.flatMap((cycle) => (
      cycle.months.filter((month) => month.sessionIndex >= serviceStartIndex)
    ));
    const eligibleMonthKeys = new Set(eligibleMonths.map((month) => month.key));
    const displayCycle = currentDueCycle || latestDueCycle;
    const currentCycleMonths = displayCycle
      ? displayCycle.months.filter((month) => month.sessionIndex >= serviceStartIndex)
      : [];
    const currentCycleMonthKeys = new Set(currentCycleMonths.map((month) => month.key));
    const billedMonths = new Set(
      paymentEntries.flatMap((entry) => {
        if (entry.kind !== 'Advance') return entry.coveredMonths;
        return entry.coveredMonths.filter((monthKey) => eligibleMonthKeys.has(monthKey));
      }),
    );
    const paid = paymentEntries.reduce((sum, entry) => {
      if (entry.kind !== 'Advance') return sum + entry.amount;
      const coveredEligibleMonths = entry.coveredMonths.filter((monthKey) => eligibleMonthKeys.has(monthKey));
      const monthAmount = Number(structure.amount) || 0;
      if (coveredEligibleMonths.length > 0 && monthAmount > 0) {
        return sum + (coveredEligibleMonths.length * monthAmount);
      }
      if (!entry.advanceTargetMonthKey || entry.advanceTargetMonthKey <= currentMonthKey) {
        return sum + entry.amount;
      }
      return sum;
    }, 0);
    const remainingMonths = eligibleMonths.filter((month) => !billedMonths.has(month.key));
    const remainingCurrentCycleMonths = currentCycleMonths.filter((month) => !billedMonths.has(month.key));
    const structureAmount = Number(structure.amount) || 0;
    const totalCharge = structureAmount * eligibleMonths.length;
    const latestDueDate = latestDueCycle?.dueDate || structure.dueDate;
    const lateFeeFine = calculateLateFine(latestDueDate, paid >= totalCharge, referenceDate);
    const totalOutstanding = Math.max(totalCharge + lateFeeFine - paid, 0);
    const currentCycleRawDue = (structureAmount * remainingCurrentCycleMonths.length) + (currentDueCycle ? lateFeeFine : 0);
    const currentCycleDueAmount = currentDueCycle ? Math.min(totalOutstanding, currentCycleRawDue) : 0;
    const previousPendingAmount = Math.max(totalOutstanding - currentCycleDueAmount, 0);
    return {
      paid,
      structureAmount,
      feeComponent: structure.feeComponent,
      billingType,
      currentCycleLabel: currentCycleMonths.length ? `${currentCycleMonths[0].label} - ${currentCycleMonths[currentCycleMonths.length - 1].label}` : currentCycle.label,
      currentCycleMonths,
      currentCycleMonthKeys: currentCycleMonths.map((month) => month.key),
      defaultCoveredMonths: remainingMonths.map((month) => month.key),
      coveredMonths: Array.from(billedMonths),
      availableMonths: remainingMonths,
      serviceMonthsCount: currentCycleMonths.length,
      totalCharge,
      lateFeeFine,
      totalOutstanding,
      currentCycleDueAmount,
      previousPendingAmount,
      reminderCount: totalOutstanding > 0 ? Math.min(Math.ceil(daysLate(latestDueDate, referenceDate) / 7), 5) : 0,
      payableLabel: `${formatMoney(structureAmount * remainingCurrentCycleMonths.length)} for ${remainingCurrentCycleMonths.length} active month${remainingCurrentCycleMonths.length === 1 ? '' : 's'}`,
    };
  }

  const normalizedCycle = Math.min(Math.max(Number(structure.cycleMonths) || 1, 1), 12);
  const dueCycleEntries = getDueCycleEntries(normalizedCycle, structure.dueDate, sessionMonths, referenceDate);
  const dueCycles = dueCycleEntries.filter((cycle) => cycle.isDue);
  const currentDueCycle = dueCycleEntries.find((cycle) => cycle.isCurrent && cycle.isDue);
  const latestDueCycle = currentDueCycle || dueCycles[dueCycles.length - 1];
  const monthlyAmount = Number(structure.amount) || 0;
  const totalBaseDue = dueCycles.reduce((sum, cycle) => sum + (monthlyAmount * cycle.months.length), 0);
  const activeCycleMonths = currentDueCycle?.months || currentCycle.months;
  const latestDueCycleMonths = latestDueCycle?.months || [];
  const activeCycleStartKey = activeCycleMonths[0]?.key || '';
  const latestDueCycleStartKey = latestDueCycleMonths[0]?.key || activeCycleStartKey;
  const paid = paymentEntries.reduce((sum, entry) => {
    if (entry.kind !== 'Advance') return sum + entry.amount;
    if (!entry.advanceTargetMonthKey || (latestDueCycleStartKey && entry.advanceTargetMonthKey <= latestDueCycleStartKey)) {
      return sum + entry.amount;
    }
    return sum;
  }, 0);
  const latestDueDate = latestDueCycle?.dueDate || structure.dueDate;
  const lateFeeFine = calculateLateFine(latestDueDate, paid >= totalBaseDue, referenceDate);
  const totalOutstanding = Math.max(totalBaseDue + lateFeeFine - paid, 0);
  const currentCycleBaseDue = currentDueCycle ? monthlyAmount * activeCycleMonths.length : 0;
  const currentCycleDueAmount = currentDueCycle
    ? Math.min(totalOutstanding, currentCycleBaseDue + lateFeeFine)
    : 0;
  const previousPendingAmount = Math.max(totalOutstanding - currentCycleDueAmount, 0);
  return {
    paid,
    structureAmount: monthlyAmount,
    feeComponent: structure.feeComponent,
    billingType,
    currentCycleLabel: activeCycleMonths.length ? `${activeCycleMonths[0].label} - ${activeCycleMonths[activeCycleMonths.length - 1].label}` : currentCycle.label,
    currentCycleMonths: activeCycleMonths,
    currentCycleMonthKeys: activeCycleMonths.map((month) => month.key),
    defaultCoveredMonths: [],
    coveredMonths: [],
    availableMonths: [],
    serviceMonthsCount: 0,
    totalCharge: totalBaseDue,
    lateFeeFine,
    totalOutstanding,
    currentCycleDueAmount,
    previousPendingAmount,
    reminderCount: totalOutstanding > 0 ? Math.min(Math.ceil(daysLate(latestDueDate, referenceDate) / 7), 5) : 0,
    payableLabel: `${formatMoney(totalOutstanding)} for this cycle`,
  };
};

export const getPreferredAdvanceRow = (rows = []) => (
  rows.find((row) => row.billingType !== 'monthly_active') || rows[0] || null
);

export const getAdvanceTargetMonthKey = (row) => {
  if (!row) return '';
  if (row.billingType === 'monthly_active') {
    const lastMonth = row.currentCycleMonths[row.currentCycleMonths.length - 1];
    if (!lastMonth) return '';
    const nextMonthNumber = lastMonth.monthNumber === 12 ? 1 : lastMonth.monthNumber + 1;
    const nextYear = lastMonth.monthNumber === 12 ? lastMonth.year + 1 : lastMonth.year;
    return `${nextYear}-${String(nextMonthNumber).padStart(2, '0')}`;
  }

  const lastMonth = row.currentCycleMonths[row.currentCycleMonths.length - 1];
  if (!lastMonth) return '';
  const lastDate = new Date(lastMonth.year, lastMonth.monthNumber - 1, 1);
  lastDate.setMonth(lastDate.getMonth() + 1);
  return `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
};

const buildCoveredMonthsForAllocation = (row, amount) => {
  if (!row || row.billingType !== 'monthly_active') return [];
  const monthAmount = Number(row.structureAmount) || 0;
  if (!monthAmount) return [];
  const fullMonthsCovered = Math.floor((Number(amount) || 0) / monthAmount);
  return (row.availableMonths || []).slice(0, fullMonthsCovered).map((month) => month.key);
};

export const allocateOverallAmount = (amount, rows, paymentTarget = 'due_full') => {
  const normalizedAmount = Math.max(Number(amount) || 0, 0);
  const orderedRows = [
    ...rows.filter((row) => row.billingType !== 'monthly_active'),
    ...rows.filter((row) => row.billingType === 'monthly_active'),
  ];

  if (normalizedAmount <= 0 || orderedRows.length === 0) return [];

  if (paymentTarget === 'advance_only') {
    const preferredAdvanceRow = getPreferredAdvanceRow(orderedRows);
    if (!preferredAdvanceRow) return [];
    return [{
      structureId: preferredAdvanceRow.structure.id,
      feeComponent: preferredAdvanceRow.structure.feeComponent || 'Fee component',
      amount: normalizedAmount,
      kind: 'Advance',
      note: 'Saved as advance for upcoming cycle',
      coveredMonths: [],
      advanceTargetMonthKey: getAdvanceTargetMonthKey(preferredAdvanceRow),
    }];
  }

  const allocations = [];
  let remaining = normalizedAmount;

  orderedRows.forEach((row) => {
    if (remaining <= 0) return;
    const allocationAmount = Math.min(row.totalOutstanding, remaining);
    if (allocationAmount <= 0) return;
    allocations.push({
      structureId: row.structure.id,
      feeComponent: row.structure.feeComponent || 'Fee component',
      amount: allocationAmount,
      kind: 'Current Due',
      note: row.billingType === 'monthly_active'
        ? `${buildCoveredMonthsForAllocation(row, allocationAmount).length} month charge adjusted`
        : 'Pending cycle amount adjusted',
      coveredMonths: buildCoveredMonthsForAllocation(row, allocationAmount),
      advanceTargetMonthKey: '',
    });
    remaining -= allocationAmount;
  });

  if (remaining > 0) {
    const preferredAdvanceRow = getPreferredAdvanceRow(orderedRows);
    if (preferredAdvanceRow) {
      allocations.push({
        structureId: preferredAdvanceRow.structure.id,
        feeComponent: preferredAdvanceRow.structure.feeComponent || 'Fee component',
        amount: remaining,
        kind: 'Advance',
        note: 'Saved as advance for upcoming cycle',
        coveredMonths: [],
        advanceTargetMonthKey: getAdvanceTargetMonthKey(preferredAdvanceRow),
      });
    }
  }

  return allocations;
};

export const buildOverallPaymentPreview = (amount, rows, paymentTarget = 'due_full') => {
  const allocations = allocateOverallAmount(amount, rows, paymentTarget);
  const currentDuePaid = allocations
    .filter((allocation) => allocation.kind === 'Current Due')
    .reduce((sum, allocation) => sum + allocation.amount, 0);
  const advanceAmount = allocations
    .filter((allocation) => allocation.kind === 'Advance')
    .reduce((sum, allocation) => sum + allocation.amount, 0);

  return {
    allocations,
    currentDuePaid,
    advanceAmount,
  };
};
