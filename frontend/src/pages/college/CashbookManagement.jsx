import React, { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Landmark,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cashbookApi } from '../../utils/api';

const tabs = ['Overview', 'Transactions', 'Income', 'Expenses', 'Accounts', 'Receivables', 'Payables', 'Reports'];
const modes = ['Cash', 'UPI', 'Bank', 'Card', 'Cheque', 'Other'];
const inputClass = 'h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white';
const ranges = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Financial Year', value: 'year' },
  { label: 'Custom Date Range', value: 'custom' },
];

const emptyEntry = {
  date: new Date().toISOString().slice(0, 10),
  categoryId: '',
  accountId: '',
  amount: '',
  paymentMode: 'Cash',
  payerPayeeName: '',
  referenceNumber: '',
  description: '',
  idempotencyKey: '',
};

const CashbookManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');
  const [trendGroup, setTrendGroup] = useState('month');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState(() => buildRange('month'));
  const [searchText, setSearchText] = useState('');
  const [transactionFilters, setTransactionFilters] = useState({ search: '', entryType: '', status: '', page: 0, size: 25 });
  const [incomeForm, setIncomeForm] = useState(emptyEntry);
  const [expenseForm, setExpenseForm] = useState(emptyEntry);
  const [transferForm, setTransferForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    paymentMode: 'Cash',
    referenceNumber: '',
    description: '',
  });
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'CASH',
    bankName: '',
    accountNumberLast4: '',
    openingBalance: '0',
    openingDate: new Date().toISOString().slice(0, 10),
  });
  const sharedFilters = useMemo(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    accountId: filters.accountId,
  }), [filters]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setTransactionFilters((current) => ({ ...current, search: searchText }));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchText]);

  const overviewQuery = useQuery({
    queryKey: ['cashbook', 'overview', sharedFilters],
    queryFn: () => cashbookApi.getOverview(sharedFilters),
    staleTime: 45_000,
  });

  const trendQuery = useQuery({
    queryKey: ['cashbook', 'trend', { ...sharedFilters, groupBy: trendGroup }],
    queryFn: () => cashbookApi.getTrend({ ...sharedFilters, groupBy: trendGroup }),
    enabled: activeTab === 'Overview' || activeTab === 'Reports',
    staleTime: 60_000,
  });

  const incomeBreakdownQuery = useQuery({
    queryKey: ['cashbook', 'income-breakdown', sharedFilters],
    queryFn: () => cashbookApi.getCategoryBreakdown({ ...sharedFilters, type: 'INCOME' }),
    enabled: activeTab === 'Overview' || activeTab === 'Income' || activeTab === 'Reports',
    staleTime: 60_000,
  });

  const expenseBreakdownQuery = useQuery({
    queryKey: ['cashbook', 'expense-breakdown', sharedFilters],
    queryFn: () => cashbookApi.getCategoryBreakdown({ ...sharedFilters, type: 'EXPENSE' }),
    enabled: activeTab === 'Overview' || activeTab === 'Expenses' || activeTab === 'Reports',
    staleTime: 60_000,
  });

  const paymentModeQuery = useQuery({
    queryKey: ['cashbook', 'payment-modes', sharedFilters],
    queryFn: () => cashbookApi.getPaymentModes(sharedFilters),
    enabled: activeTab === 'Overview' || activeTab === 'Reports',
    staleTime: 60_000,
  });

  const accountsQuery = useQuery({
    queryKey: ['cashbook', 'accounts'],
    queryFn: cashbookApi.getAccounts,
    staleTime: 90_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ['cashbook', 'categories'],
    queryFn: cashbookApi.getCategories,
    staleTime: 90_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ['cashbook', 'transactions', { ...sharedFilters, ...transactionFilters, page }],
    queryFn: () => cashbookApi.getTransactions({ ...sharedFilters, ...transactionFilters, page }),
    enabled: activeTab === 'Overview' || activeTab === 'Transactions' || activeTab === 'Income' || activeTab === 'Expenses',
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const invalidateCashbook = () => {
    queryClient.invalidateQueries({ queryKey: ['cashbook'] });
  };

  const incomeMutation = useMutation({
    mutationFn: (payload) => cashbookApi.addIncome({ ...payload, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      setIncomeForm(emptyEntry);
      invalidateCashbook();
    },
  });

  const expenseMutation = useMutation({
    mutationFn: (payload) => cashbookApi.addExpense({ ...payload, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      setExpenseForm(emptyEntry);
      invalidateCashbook();
    },
  });

  const refundMutation = useMutation({
    mutationFn: (payload) => cashbookApi.addRefund({ ...payload, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      setExpenseForm(emptyEntry);
      invalidateCashbook();
    },
  });

  const transferMutation = useMutation({
    mutationFn: (payload) => cashbookApi.transfer({ ...payload, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      setTransferForm({ date: new Date().toISOString().slice(0, 10), fromAccountId: '', toAccountId: '', amount: '', paymentMode: 'Cash', referenceNumber: '', description: '' });
      invalidateCashbook();
    },
  });

  const accountMutation = useMutation({
    mutationFn: cashbookApi.createAccount,
    onSuccess: () => {
      setAccountForm({ name: '', type: 'CASH', bankName: '', accountNumberLast4: '', openingBalance: '0', openingDate: new Date().toISOString().slice(0, 10) });
      invalidateCashbook();
    },
  });

  const overview = overviewQuery.data || {};
  const accounts = accountsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const incomeCategories = categories.filter((category) => category.type === 'INCOME' && category.status !== 'ARCHIVED');
  const expenseCategories = categories.filter((category) => category.type === 'EXPENSE' && category.status !== 'ARCHIVED');
  const transactions = transactionsQuery.data?.content || [];

  const handleRange = (range) => {
    setFilters((current) => ({ ...current, range, ...buildRange(range) }));
  };

  const submitEntry = (event, form, mutation) => {
    event.preventDefault();
    mutation.mutate({ ...form, amount: Number(form.amount), categoryId: Number(form.categoryId), accountId: Number(form.accountId) });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12 text-slate-900">
      <Header
        title="Cashbook & Finance"
        eyebrow="Finance Control Center"
        onBack={() => navigate('/college')}
        rightContent={(
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={Plus} label="Add Income" onClick={() => setActiveTab('Income')} />
            <ActionButton icon={ReceiptText} label="Add Expense" onClick={() => setActiveTab('Expenses')} />
            <ActionButton icon={ArrowRightLeft} label="Transfer Money" onClick={() => setActiveTab('Accounts')} />
          </div>
        )}
      />

      <main className="mx-auto max-w-screen-2xl px-6 py-8 md:px-10">
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-black tracking-tight text-slate-950">Financial Position</h2>
            <p className="text-sm leading-6 text-slate-500">Track school income, expenses, balances, receivables and financial transactions.</p>
          </div>
        </section>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {ranges.map((range) => (
              <button
                key={range.value}
                onClick={() => handleRange(range.value)}
                className={`h-11 rounded-xl px-4 text-sm font-black transition ${filters.range === range.value ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'}`}
              >
                {range.label}
              </button>
            ))}
            <select value={filters.accountId || ''} onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))} className={inputClass}>
              <option value="">All Accounts</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">From</span>
            <input type="date" value={filters.dateFrom || ''} onChange={(event) => setFilters((current) => ({ ...current, range: 'custom', dateFrom: event.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">To</span>
            <input type="date" value={filters.dateTo || ''} onChange={(event) => setFilters((current) => ({ ...current, range: 'custom', dateTo: event.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500" />
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`h-11 shrink-0 rounded-xl px-4 text-sm font-black transition ${activeTab === tab ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Overview' && (
          <div className="space-y-6">
            <KpiGrid overview={overview} />
            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Panel title="Income vs Expense Trend" action={(
                <select value={trendGroup} onChange={(event) => setTrendGroup(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:bg-white">
                  <option value="day">Daily</option>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                </select>
              )}>
                <TrendBars rows={trendQuery.data || []} />
              </Panel>
              <Panel title="Today's Position">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniStat label="Today's Collection" value={money(overview.todayIncome)} />
                  <MiniStat label="Today's Expenses" value={money(overview.todayExpense)} />
                  <MiniStat label="Today's Net" value={money(overview.todayNet)} />
                  <MiniStat label="Transaction Count" value={overview.transactionCount || 0} />
                </div>
              </Panel>
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
              <Breakdown title="Income Breakdown" rows={incomeBreakdownQuery.data || []} />
              <Breakdown title="Expense Breakdown" rows={expenseBreakdownQuery.data || []} />
              <Panel title="Payment Mode Analysis">
                {(paymentModeQuery.data || []).map((row) => (
                  <div key={row.paymentMode} className="mb-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between text-sm font-black text-slate-700">
                      <span>{row.paymentMode}</span>
                      <span>{row.transactionCount}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">In {money(row.moneyIn)} | Out {money(row.moneyOut)}</p>
                  </div>
                ))}
              </Panel>
            </div>
            <Panel title="Recent Transactions">
              <TransactionsTable rows={transactions.slice(0, 8)} />
            </Panel>
          </div>
        )}

        {activeTab === 'Transactions' && (
          <Panel title="Transaction Ledger">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search voucher, payee, reference" className="h-11 w-72 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm font-semibold outline-none focus:border-emerald-500 focus:bg-white" />
              </div>
              <select value={transactionFilters.entryType} onChange={(event) => { setPage(0); setTransactionFilters((current) => ({ ...current, entryType: event.target.value })); }} className={inputClass}>
                <option value="">All Types</option>
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
                <option value="TRANSFER_IN">Transfer In</option>
                <option value="TRANSFER_OUT">Transfer Out</option>
                <option value="REFUND_OUT">Refund</option>
              </select>
              <select value={transactionFilters.status} onChange={(event) => setTransactionFilters((current) => ({ ...current, status: event.target.value }))} className={inputClass}>
                <option value="">All Status</option>
                <option value="POSTED">Posted</option>
                <option value="VOIDED">Voided</option>
              </select>
            </div>
            <TransactionsTable rows={transactions} />
            <Pager page={page} totalPages={transactionsQuery.data?.totalPages || 1} onPage={setPage} />
          </Panel>
        )}

        {activeTab === 'Income' && (
          <EntryPanel title="Add Income" icon={<ArrowDownLeft size={18} />} form={incomeForm} setForm={setIncomeForm} categories={incomeCategories} accounts={accounts} mutation={incomeMutation} onSubmit={(event) => submitEntry(event, incomeForm, incomeMutation)} />
        )}

        {activeTab === 'Expenses' && (
          <div className="space-y-6">
            <EntryPanel title="Add Expense" icon={<ArrowUpRight size={18} />} form={expenseForm} setForm={setExpenseForm} categories={expenseCategories} accounts={accounts} mutation={expenseMutation} onSubmit={(event) => submitEntry(event, expenseForm, expenseMutation)} />
            <EntryPanel title="Add Refund" icon={<RefreshCw size={18} />} form={expenseForm} setForm={setExpenseForm} categories={expenseCategories} accounts={accounts} mutation={refundMutation} onSubmit={(event) => submitEntry(event, expenseForm, refundMutation)} />
          </div>
        )}

        {activeTab === 'Accounts' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Panel title="Add Account">
              <form onSubmit={(event) => { event.preventDefault(); accountMutation.mutate({ ...accountForm, openingBalance: Number(accountForm.openingBalance || 0) }); }} className="grid gap-3">
                <Input label="Account Name" value={accountForm.name} onChange={(value) => setAccountForm((current) => ({ ...current, name: value }))} required />
                <Select label="Type" value={accountForm.type} onChange={(value) => setAccountForm((current) => ({ ...current, type: value }))} options={['CASH', 'BANK', 'UPI', 'WALLET', 'OTHER']} />
                <Input label="Bank Name" value={accountForm.bankName} onChange={(value) => setAccountForm((current) => ({ ...current, bankName: value }))} />
                <Input label="Last 4 Digits" value={accountForm.accountNumberLast4} onChange={(value) => setAccountForm((current) => ({ ...current, accountNumberLast4: value }))} />
                <Input label="Opening Balance" type="number" value={accountForm.openingBalance} onChange={(value) => setAccountForm((current) => ({ ...current, openingBalance: value }))} />
                <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700">Save Account</button>
              </form>
            </Panel>
            <Panel title="Accounts">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                    <tr><th className="p-3">Account</th><th className="p-3">Type</th><th className="p-3">Total In</th><th className="p-3">Total Out</th><th className="p-3">Balance</th><th className="p-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm font-semibold">
                    {accounts.map((account) => (
                      <tr key={account.id}><td className="p-3">{account.name}</td><td className="p-3">{account.type}</td><td className="p-3 text-emerald-700">{money(account.totalIn)}</td><td className="p-3 text-rose-700">{money(account.totalOut)}</td><td className="p-3 font-black">{money(account.currentBalance)}</td><td className="p-3">{account.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
            <Panel title="Transfer Money">
              <form onSubmit={(event) => { event.preventDefault(); transferMutation.mutate({ ...transferForm, amount: Number(transferForm.amount), fromAccountId: Number(transferForm.fromAccountId), toAccountId: Number(transferForm.toAccountId) }); }} className="grid gap-3 md:grid-cols-2">
                <Input label="Date" type="date" value={transferForm.date} onChange={(value) => setTransferForm((current) => ({ ...current, date: value }))} />
                <Select label="Mode" value={transferForm.paymentMode} onChange={(value) => setTransferForm((current) => ({ ...current, paymentMode: value }))} options={modes} />
                <Select label="From Account" value={transferForm.fromAccountId} onChange={(value) => setTransferForm((current) => ({ ...current, fromAccountId: value }))} options={accounts.map((account) => ({ value: account.id, label: account.name }))} />
                <Select label="To Account" value={transferForm.toAccountId} onChange={(value) => setTransferForm((current) => ({ ...current, toAccountId: value }))} options={accounts.map((account) => ({ value: account.id, label: account.name }))} />
                <Input label="Amount" type="number" value={transferForm.amount} onChange={(value) => setTransferForm((current) => ({ ...current, amount: value }))} required />
                <Input label="Reference" value={transferForm.referenceNumber} onChange={(value) => setTransferForm((current) => ({ ...current, referenceNumber: value }))} />
                <div className="md:col-span-2"><Input label="Note" value={transferForm.description} onChange={(value) => setTransferForm((current) => ({ ...current, description: value }))} /></div>
                <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 md:col-span-2">Transfer Money</button>
              </form>
            </Panel>
          </div>
        )}

        {(activeTab === 'Receivables' || activeTab === 'Payables' || activeTab === 'Reports') && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Receivables">
              <MiniStat label="Outstanding Student Fee Receivables" value={money(overview.outstandingReceivables)} />
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">This comes from StudentFeeCharge minus completed fee allocations. It is not counted as income until a FeePayment is completed.</p>
            </Panel>
            <Panel title="Payables">
              <MiniStat label="Pending Salary Payables" value={money(overview.pendingPayables)} />
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">This comes from TeacherPayrollPeriod outstanding amounts. It is not counted as expense until a SalaryPayment is completed.</p>
            </Panel>
          </div>
        )}
      </main>
    </div>
  );
};

const KpiGrid = ({ overview }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Kpi icon={ArrowDownLeft} label="Total Income" value={money(overview.totalIncome)} tone="success" />
    <Kpi icon={ArrowUpRight} label="Total Expense" value={money(overview.totalExpense)} tone="danger" />
    <Kpi icon={RefreshCw} label="Net Cash Flow" value={money(overview.netCashFlow)} />
    <Kpi icon={Wallet} label="Cash in Hand" value={money(overview.cashInHand)} tone="warning" />
    <Kpi icon={Landmark} label="Bank Balance" value={money(overview.bankBalance)} />
    <Kpi icon={ReceiptText} label="Outstanding Receivables" value={money(overview.outstandingReceivables)} tone="warning" />
    <Kpi icon={Banknote} label="Pending Payables" value={money(overview.pendingPayables)} tone="danger" />
  </div>
);

const Header = ({ title, eyebrow, onBack, rightContent = null }) => (
  <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-6 py-4 md:px-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <ArrowLeft size={16} />
          Dashboard
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-700">{eyebrow}</p>
          <h1 className="truncate text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        </div>
      </div>
      {rightContent}
    </div>
  </header>
);

const Kpi = ({ icon: Icon, label, value, tone = 'default' }) => {
  const toneClass = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    danger: 'bg-rose-100 text-rose-700',
  }[tone] || 'bg-slate-100 text-slate-700';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon size={19} />
        </div>
      </div>
    </article>
  );
};

const Panel = ({ title, action, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const TrendBars = ({ rows }) => {
  const max = Math.max(1, ...rows.map((row) => Math.max(Number(row.income || 0), Number(row.expense || 0))));
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <Empty /> : rows.map((row) => (
        <div key={row.period}>
          <div className="mb-1 flex justify-between text-xs font-black text-slate-500"><span>{row.period}</span><span>{money(row.net)}</span></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-emerald-500" style={{ width: `${(Number(row.income || 0) / max) * 100}%` }} /></div>
            <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-rose-500" style={{ width: `${(Number(row.expense || 0) / max) * 100}%` }} /></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Breakdown = ({ title, rows }) => (
  <Panel title={title}>
    {rows.length === 0 ? <Empty /> : rows.slice(0, 8).map((row) => (
      <div key={row.categoryCode} className="mb-3">
        <div className="flex justify-between text-sm font-black text-slate-700"><span>{row.categoryName}</span><span>{money(row.amount)}</span></div>
        <div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-cyan-600" style={{ width: `${Math.min(100, Number(row.percentage || 0))}%` }} /></div>
      </div>
    ))}
  </Panel>
);

const TransactionsTable = ({ rows }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200">
  <div className="overflow-x-auto">
    <table className="w-full min-w-[920px] text-left">
      <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
        <tr><th className="p-3">Date</th><th className="p-3">Voucher</th><th className="p-3">Description</th><th className="p-3">Category</th><th className="p-3">Account</th><th className="p-3">Mode</th><th className="p-3">Money In</th><th className="p-3">Money Out</th><th className="p-3">Status</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm font-semibold">
        {rows.length === 0 ? (
          <tr><td colSpan="9" className="p-8"><Empty /></td></tr>
        ) : rows.map((entry) => (
          <tr key={entry.id} className="bg-white transition hover:bg-emerald-50/70">
            <td className="p-3">{entry.transactionDate}</td>
            <td className="p-3 font-black text-slate-900">{entry.voucherNumber}</td>
            <td className="p-3">{entry.description || entry.payerPayeeName || entry.sourceType}</td>
            <td className="p-3">{entry.category}</td>
            <td className="p-3">{entry.accountName}</td>
            <td className="p-3">{entry.paymentMode}</td>
            <td className="p-3 text-emerald-700">{Number(entry.moneyIn || 0) > 0 ? money(entry.moneyIn) : '-'}</td>
            <td className="p-3 text-rose-700">{Number(entry.moneyOut || 0) > 0 ? money(entry.moneyOut) : '-'}</td>
            <td className="p-3"><StatusPill status={entry.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  </div>
);

const EntryPanel = ({ title, icon, form, setForm, categories, accounts, mutation, onSubmit }) => (
  <Panel title={title}>
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Input label="Date" type="date" value={form.date} onChange={(value) => setForm((current) => ({ ...current, date: value }))} />
      <Select label="Category" value={form.categoryId} onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))} options={categories.map((category) => ({ value: category.id, label: category.name }))} />
      <Input label="Amount" type="number" value={form.amount} onChange={(value) => setForm((current) => ({ ...current, amount: value }))} required />
      <Select label="Account" value={form.accountId} onChange={(value) => setForm((current) => ({ ...current, accountId: value }))} options={accounts.map((account) => ({ value: account.id, label: account.name }))} />
      <Select label="Payment Mode" value={form.paymentMode} onChange={(value) => setForm((current) => ({ ...current, paymentMode: value }))} options={modes} />
      <Input label={title.includes('Income') ? 'Payer / Source' : 'Payee / Vendor'} value={form.payerPayeeName} onChange={(value) => setForm((current) => ({ ...current, payerPayeeName: value }))} />
      <Input label="Reference" value={form.referenceNumber} onChange={(value) => setForm((current) => ({ ...current, referenceNumber: value }))} />
      <div className="xl:col-span-2"><Input label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} /></div>
      <button disabled={mutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 xl:col-span-3">
        {icon}
        {mutation.isPending ? 'Saving' : title}
      </button>
    </form>
  </Panel>
);

const Input = ({ label, value, onChange, type = 'text', required = false }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
    <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
  </label>
);

const Select = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
    <select required value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
      <option value="">Select</option>
      {options.map((option) => typeof option === 'string'
        ? <option key={option} value={option}>{option}</option>
        : <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const ActionButton = ({ icon: Icon, label, onClick }) => (
  <button type="button" onClick={onClick} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
    <Icon size={16} />
    {label}
  </button>
);

const MiniStat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
    <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
  </div>
);

const Pager = ({ page, totalPages, onPage }) => (
  <div className="mt-4 flex items-center justify-end gap-2">
    <button type="button" disabled={page <= 0} onClick={() => onPage(page - 1)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300">Previous</button>
    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Page {page + 1} / {Math.max(1, totalPages)}</span>
    <button type="button" disabled={page + 1 >= totalPages} onClick={() => onPage(page + 1)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 disabled:cursor-not-allowed disabled:text-slate-300">Next</button>
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
    status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
  }`}>
    {status}
  </span>
);

const Empty = () => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
    No financial records found.
  </div>
);

const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

const buildRange = (range) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (range === 'today') return { range, dateFrom: today, dateTo: today };
  if (range === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { range, dateFrom: start.toISOString().slice(0, 10), dateTo: today };
  }
  if (range === 'year') {
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { range, dateFrom: `${year}-04-01`, dateTo: `${year + 1}-03-31` };
  }
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return { range: range || 'month', dateFrom: `${now.getFullYear()}-${month}-01`, dateTo: today };
};

export default CashbookManagement;
