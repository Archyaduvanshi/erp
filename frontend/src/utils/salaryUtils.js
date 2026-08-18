const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export const getMonthKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getMonthLabel = (monthKey) => {
  if (!monthKey) return 'Not available';
  const [year, month] = monthKey.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

export const formatSalary = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'Not set';
  return currencyFormatter.format(amount);
};

export const formatCurrencyAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
};

const normalizePaymentEntry = (entry, monthlySalary = 0) => {
  if (!entry?.monthKey) return null;

  const baseSalary = Number(entry.baseSalary ?? entry.amount ?? monthlySalary) || 0;
  const previousPendingAmount = Number(entry.previousPendingAmount) || 0;
  const bonusAmount = Number(entry.bonusAmount) || 0;
  const advanceAmount = Number(entry.advanceAmount) || 0;
  const leaveDeductionAmount = Number(entry.leaveDeductionAmount) || 0;
  const computedAmount = baseSalary + previousPendingAmount + bonusAmount - advanceAmount - leaveDeductionAmount;
  const totalAmount = Number(entry.amount ?? entry.totalAmount);

  return {
    monthKey: entry.monthKey,
    baseSalary,
    previousPendingAmount,
    bonusAmount,
    advanceAmount,
    openSchoolDays: Number(entry.openSchoolDays) || 0,
    presentDays: Number(entry.presentDays) || 0,
    absentDays: Number(entry.absentDays) || 0,
    allowedLeaves: Number(entry.allowedLeaves) || 0,
    extraLeaveDays: Number(entry.extraLeaveDays) || 0,
    perDaySalary: Number(entry.perDaySalary) || 0,
    leaveDeductionAmount,
    amount: Number.isFinite(totalAmount) ? totalAmount : computedAmount,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : computedAmount,
    paidOn: entry.paidOn || '',
    note: entry.note || '',
    settledMonthKeys: Array.isArray(entry.settledMonthKeys)
      ? entry.settledMonthKeys.filter(Boolean)
      : [],
  };
};

export const normalizeTeacherSalary = (teacher) => {
  if (!teacher) return null;
  const salary = Number(teacher?.salary);
  const joiningDateSource = teacher?.joiningDate || teacher?.createdAt || new Date().toISOString();
  return {
    ...teacher,
    salary: Number.isFinite(salary) && salary > 0 ? salary : '',
    joiningDate: String(joiningDateSource).slice(0, 10),
    paymentHistory: Array.isArray(teacher?.paymentHistory)
      ? teacher.paymentHistory
          .map((entry) => normalizePaymentEntry(entry, salary))
          .filter(Boolean)
      : [],
  };
};

export const buildSalaryTimeline = (teacher, now = new Date()) => {
  const normalizedTeacher = normalizeTeacherSalary(teacher);
  if (!normalizedTeacher) return [];
  if (!normalizedTeacher.joiningDate) return [];

  const startDate = new Date(normalizedTeacher.joiningDate);
  const timeline = [];
  const pointer = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  while (pointer <= end) {
    const monthKey = getMonthKey(pointer);
    const payment = normalizedTeacher.paymentHistory.find((entry) => entry.monthKey === monthKey) || null;
    const baseSalary = payment?.baseSalary ?? normalizedTeacher.salary ?? 0;
    const previousPendingAmount = payment?.previousPendingAmount ?? 0;
    const bonusAmount = payment?.bonusAmount ?? 0;
    const advanceAmount = payment?.advanceAmount ?? 0;
    const leaveDeductionAmount = payment?.leaveDeductionAmount ?? 0;
    const totalAmount = payment?.totalAmount ?? payment?.amount ?? baseSalary;

    timeline.push({
      monthKey,
      label: getMonthLabel(monthKey),
      amount: totalAmount,
      totalAmount,
      baseSalary,
      previousPendingAmount,
      bonusAmount,
      advanceAmount,
      openSchoolDays: payment?.openSchoolDays ?? 0,
      presentDays: payment?.presentDays ?? 0,
      absentDays: payment?.absentDays ?? 0,
      allowedLeaves: payment?.allowedLeaves ?? 0,
      extraLeaveDays: payment?.extraLeaveDays ?? 0,
      perDaySalary: payment?.perDaySalary ?? 0,
      leaveDeductionAmount,
      isPaid: Boolean(payment),
      paidOn: payment?.paidOn || '',
      note: payment?.note || '',
      settledMonthKeys: payment?.settledMonthKeys || [],
    });

    pointer.setMonth(pointer.getMonth() + 1);
  }

  return timeline.reverse();
};

export const getPreviousPendingSalaryEntries = (teacher, monthKey, now = new Date()) => {
  if (!monthKey) return [];
  return buildSalaryTimeline(teacher, now).filter((entry) => !entry.isPaid && entry.monthKey < monthKey);
};

export const getCurrentMonthSalaryStatus = (teacher, now = new Date()) => {
  const monthKey = getMonthKey(now);
  const timeline = buildSalaryTimeline(teacher, now);
  return timeline.find((entry) => entry.monthKey === monthKey) || null;
};

export const markSalaryPaid = (teacher, monthKey, options = {}) => {
  const normalizedTeacher = normalizeTeacherSalary(teacher);
  if (!normalizedTeacher) return teacher;
  const paidOn = options.paidOn || new Date().toISOString();
  const baseSalary = Number(normalizedTeacher.salary) || 0;
  const previousPendingEntries = getPreviousPendingSalaryEntries(normalizedTeacher, monthKey);
  const autoSettledMonthKeys = previousPendingEntries.map((entry) => entry.monthKey);
  const previousPendingAmount = previousPendingEntries.reduce((sum, entry) => sum + (Number(entry.baseSalary) || 0), 0);
  const bonusAmount = Math.max(0, Number(options.bonusAmount) || 0);
  const advanceAmount = Math.max(0, Number(options.advanceAmount) || 0);
  const leaveDeductionAmount = Math.max(0, Number(options.leaveDeductionAmount) || 0);
  const totalAmount = Math.max(0, baseSalary + previousPendingAmount + bonusAmount - advanceAmount - leaveDeductionAmount);
  const note = String(options.note || '').trim();

  const monthsToReplace = new Set([monthKey, ...autoSettledMonthKeys]);
  const existingPayments = normalizedTeacher.paymentHistory.filter((entry) => !monthsToReplace.has(entry.monthKey));
  const settledEntries = autoSettledMonthKeys.map((settledMonthKey) => ({
    monthKey: settledMonthKey,
    baseSalary,
    previousPendingAmount: 0,
    bonusAmount: 0,
    advanceAmount: 0,
    openSchoolDays: 0,
    presentDays: 0,
    absentDays: 0,
    allowedLeaves: 0,
    extraLeaveDays: 0,
    perDaySalary: 0,
    leaveDeductionAmount: 0,
    amount: baseSalary,
    totalAmount: baseSalary,
    paidOn,
    note: `Settled in ${getMonthLabel(monthKey)} payroll`,
    settledMonthKeys: [],
  }));

  return {
    ...normalizedTeacher,
    paymentHistory: [
      ...existingPayments,
      ...settledEntries,
      {
        monthKey,
        baseSalary,
        previousPendingAmount,
        bonusAmount,
        advanceAmount,
        openSchoolDays: Number(options.openSchoolDays) || 0,
        presentDays: Number(options.presentDays) || 0,
        absentDays: Number(options.absentDays) || 0,
        allowedLeaves: Number(options.allowedLeaves) || 0,
        extraLeaveDays: Number(options.extraLeaveDays) || 0,
        perDaySalary: Number(options.perDaySalary) || 0,
        leaveDeductionAmount,
        amount: totalAmount,
        totalAmount,
        paidOn,
        note,
        settledMonthKeys: autoSettledMonthKeys,
      },
    ].sort((a, b) => a.monthKey.localeCompare(b.monthKey)),
  };
};
