package com.erp.backend.cashbook.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

import com.erp.backend.cashbook.dto.CashbookEntryPayload;
import com.erp.backend.cashbook.dto.CashbookTransferPayload;
import com.erp.backend.cashbook.dto.FinancialAccountPayload;
import com.erp.backend.cashbook.dto.FinancialCategoryPayload;
import com.erp.backend.cashbook.entity.CashbookEntry;
import com.erp.backend.cashbook.entity.FinancialAccount;
import com.erp.backend.cashbook.entity.FinancialCategory;
import com.erp.backend.cashbook.repository.CashbookEntryRepository;
import com.erp.backend.cashbook.repository.FinancialAccountRepository;
import com.erp.backend.cashbook.repository.FinancialCategoryRepository;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.entity.FeePayment;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.report.service.FeeReportService;
import com.erp.backend.report.service.SalaryReportService;
import com.erp.backend.salary.entity.TeacherSalaryPayment;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CashbookService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final List<String> INFLOWS = List.of("INCOME", "TRANSFER_IN", "REFUND_IN", "ADJUSTMENT");
    private static final List<String> OUTFLOWS = List.of("EXPENSE", "TRANSFER_OUT", "REFUND_OUT");

    private final InstituteRepository instituteRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final FinancialAccountRepository accountRepository;
    private final FinancialCategoryRepository categoryRepository;
    private final CashbookEntryRepository entryRepository;
    private final FeeReportService feeReportService;
    private final SalaryReportService salaryReportService;
    private final EntityManager entityManager;

    public CashbookService(
            InstituteRepository instituteRepository,
            AcademicSessionRepository academicSessionRepository,
            FinancialAccountRepository accountRepository,
            FinancialCategoryRepository categoryRepository,
            CashbookEntryRepository entryRepository,
            FeeReportService feeReportService,
            SalaryReportService salaryReportService,
            EntityManager entityManager
    ) {
        this.instituteRepository = instituteRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.entryRepository = entryRepository;
        this.feeReportService = feeReportService;
        this.salaryReportService = salaryReportService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long instituteId, Long academicSessionId, LocalDate dateFrom, LocalDate dateTo, Long accountId) {
        assertAccount(instituteId, accountId);
        Object[] period = (Object[]) entityManager.createNativeQuery("""
                select
                  coalesce(sum(case when entry_type in ('INCOME', 'REFUND_IN') then amount else 0 end), 0) as income,
                  coalesce(sum(case when entry_type in ('EXPENSE', 'REFUND_OUT') then amount else 0 end), 0) as expense,
                  count(*) as transaction_count
                from cashbook_entries
                where institute_id = :instituteId
                  and status = 'POSTED'
                  and (:academicSessionId is null or academic_session_id = :academicSessionId or academic_session_id is null)
                  and (:accountId is null or account_id = :accountId)
                  and (:dateFrom is null or transaction_date >= :dateFrom)
                  and (:dateTo is null or transaction_date <= :dateTo)
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", academicSessionId)
                .setParameter("accountId", accountId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getSingleResult();
        Object[] today = (Object[]) entityManager.createNativeQuery("""
                select
                  coalesce(sum(case when entry_type in ('INCOME', 'REFUND_IN') then amount else 0 end), 0),
                  coalesce(sum(case when entry_type in ('EXPENSE', 'REFUND_OUT') then amount else 0 end), 0),
                  count(*)
                from cashbook_entries
                where institute_id = :instituteId
                  and status = 'POSTED'
                  and transaction_date = current_date
                  and (:accountId is null or account_id = :accountId)
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("accountId", accountId)
                .getSingleResult();
        BigDecimal cashBalance = accountBalanceByType(instituteId, "CASH");
        BigDecimal bankBalance = accountBalanceByType(instituteId, "BANK");
        BigDecimal income = money(period[0]);
        BigDecimal expense = money(period[1]);
        BigDecimal todayIncome = money(today[0]);
        BigDecimal todayExpense = money(today[1]);
        Map<String, Object> feeSummary = feeReportService.summary(instituteId, academicSessionId);
        BigDecimal charged = money(feeSummary.get("totalCharged"));
        BigDecimal collected = money(feeSummary.get("totalCollected"));
        Map<String, Object> salarySummary = salaryReportService.summary(instituteId, "");
        return Map.ofEntries(
                Map.entry("totalIncome", income),
                Map.entry("totalExpense", expense),
                Map.entry("netCashFlow", income.subtract(expense)),
                Map.entry("cashInHand", cashBalance),
                Map.entry("bankBalance", bankBalance),
                Map.entry("outstandingReceivables", charged.subtract(collected).max(ZERO)),
                Map.entry("pendingPayables", money(salarySummary.get("outstanding"))),
                Map.entry("todayIncome", todayIncome),
                Map.entry("todayExpense", todayExpense),
                Map.entry("todayNet", todayIncome.subtract(todayExpense)),
                Map.entry("transactionCount", ((Number) period[2]).longValue())
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> trend(Long instituteId, LocalDate dateFrom, LocalDate dateTo, String groupBy, Long accountId) {
        assertAccount(instituteId, accountId);
        String bucket = switch (normalize(groupBy, "month")) {
            case "day" -> "to_char(transaction_date, 'YYYY-MM-DD')";
            case "week" -> "to_char(date_trunc('week', transaction_date), 'YYYY-MM-DD')";
            default -> "to_char(date_trunc('month', transaction_date), 'YYYY-MM')";
        };
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select %s as period,
                       coalesce(sum(case when entry_type in ('INCOME', 'REFUND_IN') then amount else 0 end), 0) as income,
                       coalesce(sum(case when entry_type in ('EXPENSE', 'REFUND_OUT') then amount else 0 end), 0) as expense
                from cashbook_entries
                where institute_id = :instituteId
                  and status = 'POSTED'
                  and (:accountId is null or account_id = :accountId)
                  and (:dateFrom is null or transaction_date >= :dateFrom)
                  and (:dateTo is null or transaction_date <= :dateTo)
                group by period
                order by period
                """.formatted(bucket))
                .setParameter("instituteId", instituteId)
                .setParameter("accountId", accountId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getResultList();
        return rows.stream()
                .map(row -> {
                    BigDecimal income = money(row[1]);
                    BigDecimal expense = money(row[2]);
                    return Map.<String, Object>of("period", row[0], "income", income, "expense", expense, "net", income.subtract(expense));
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> categoryBreakdown(Long instituteId, String type, LocalDate dateFrom, LocalDate dateTo, Long accountId) {
        assertAccount(instituteId, accountId);
        String normalizedType = requireOne(type, "INCOME", "EXPENSE");
        String entryPredicate = "INCOME".equals(normalizedType)
                ? "entry_type = 'INCOME'"
                : "entry_type in ('EXPENSE', 'REFUND_OUT')";
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select category_code, category_label, coalesce(sum(amount), 0) as amount
                from cashbook_entries
                where institute_id = :instituteId
                  and status = 'POSTED'
                  and %s
                  and (:accountId is null or account_id = :accountId)
                  and (:dateFrom is null or transaction_date >= :dateFrom)
                  and (:dateTo is null or transaction_date <= :dateTo)
                group by category_code, category_label
                order by amount desc, category_label
                """.formatted(entryPredicate))
                .setParameter("instituteId", instituteId)
                .setParameter("accountId", accountId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getResultList();
        BigDecimal total = rows.stream().map(row -> money(row[2])).reduce(ZERO, BigDecimal::add);
        return rows.stream()
                .map(row -> {
                    BigDecimal amount = money(row[2]);
                    BigDecimal percentage = total.compareTo(ZERO) == 0 ? ZERO : amount.multiply(BigDecimal.valueOf(100)).divide(total, 2, RoundingMode.HALF_UP);
                    return Map.<String, Object>of("categoryCode", row[0], "categoryName", row[1], "amount", amount, "percentage", percentage);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> paymentModes(Long instituteId, LocalDate dateFrom, LocalDate dateTo, Long accountId) {
        assertAccount(instituteId, accountId);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select coalesce(payment_mode, 'Other') as payment_mode,
                       coalesce(sum(case when entry_type in ('INCOME', 'TRANSFER_IN', 'REFUND_IN', 'ADJUSTMENT') then amount else 0 end), 0) as money_in,
                       coalesce(sum(case when entry_type in ('EXPENSE', 'TRANSFER_OUT', 'REFUND_OUT') then amount else 0 end), 0) as money_out,
                       count(*) as transaction_count
                from cashbook_entries
                where institute_id = :instituteId
                  and status = 'POSTED'
                  and (:accountId is null or account_id = :accountId)
                  and (:dateFrom is null or transaction_date >= :dateFrom)
                  and (:dateTo is null or transaction_date <= :dateTo)
                group by payment_mode
                order by payment_mode
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("accountId", accountId)
                .setParameter("dateFrom", dateFrom)
                .setParameter("dateTo", dateTo)
                .getResultList();
        return rows.stream()
                .map(row -> Map.<String, Object>of("paymentMode", row[0], "moneyIn", row[1], "moneyOut", row[2], "transactionCount", row[3]))
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<Map<String, Object>> transactions(Long instituteId, Map<String, String> filters, Pageable pageable) {
        String sql = transactionFilterSql(filters);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select e.id, e.transaction_date, e.voucher_number, e.description, e.category_label, e.entry_type,
                       a.name as account_name, e.payment_mode, e.source_type, e.amount, e.status,
                       e.payer_payee_name, e.reference_number, e.created_at
                from cashbook_entries e
                join financial_accounts a on a.id = e.account_id and a.institute_id = e.institute_id
                """ + sql + """
                order by e.transaction_date desc, e.created_at desc, e.id desc
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("search", like(filters.get("search")))
                .setParameter("entryType", normalize(filters.get("entryType"), ""))
                .setParameter("categoryId", parseLong(filters.get("categoryId")))
                .setParameter("accountId", parseLong(filters.get("accountId")))
                .setParameter("paymentMode", normalize(filters.get("paymentMode"), ""))
                .setParameter("sourceType", normalize(filters.get("sourceType"), ""))
                .setParameter("status", normalize(filters.get("status"), ""))
                .setParameter("dateFrom", parseDate(filters.get("dateFrom")))
                .setParameter("dateTo", parseDate(filters.get("dateTo")))
                .setParameter("minAmount", moneyOrNull(filters.get("minAmount")))
                .setParameter("maxAmount", moneyOrNull(filters.get("maxAmount")))
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();
        long total = ((Number) entityManager.createNativeQuery("select count(*) from cashbook_entries e " + sql)
                .setParameter("instituteId", instituteId)
                .setParameter("search", like(filters.get("search")))
                .setParameter("entryType", normalize(filters.get("entryType"), ""))
                .setParameter("categoryId", parseLong(filters.get("categoryId")))
                .setParameter("accountId", parseLong(filters.get("accountId")))
                .setParameter("paymentMode", normalize(filters.get("paymentMode"), ""))
                .setParameter("sourceType", normalize(filters.get("sourceType"), ""))
                .setParameter("status", normalize(filters.get("status"), ""))
                .setParameter("dateFrom", parseDate(filters.get("dateFrom")))
                .setParameter("dateTo", parseDate(filters.get("dateTo")))
                .setParameter("minAmount", moneyOrNull(filters.get("minAmount")))
                .setParameter("maxAmount", moneyOrNull(filters.get("maxAmount")))
                .getSingleResult()).longValue();
        List<Map<String, Object>> content = rows.stream()
                .map(row -> Map.<String, Object>ofEntries(
                        Map.entry("id", row[0]),
                        Map.entry("transactionDate", row[1]),
                        Map.entry("voucherNumber", row[2]),
                        Map.entry("description", Objects.toString(row[3], "")),
                        Map.entry("category", row[4]),
                        Map.entry("entryType", row[5]),
                        Map.entry("accountName", row[6]),
                        Map.entry("paymentMode", row[7]),
                        Map.entry("sourceType", row[8]),
                        Map.entry("amount", row[9]),
                        Map.entry("status", row[10]),
                        Map.entry("payerPayeeName", Objects.toString(row[11], "")),
                        Map.entry("referenceNumber", Objects.toString(row[12], "")),
                        Map.entry("createdAt", row[13]),
                        Map.entry("moneyIn", INFLOWS.contains(row[5]) ? row[9] : ZERO),
                        Map.entry("moneyOut", OUTFLOWS.contains(row[5]) ? row[9] : ZERO)
                ))
                .toList();
        return new PageImpl<>(content, pageable, total);
    }

    @Transactional
    public List<Map<String, Object>> accounts(Long instituteId) {
        Institute institute = validateInstitute(instituteId);
        accountRepository.findFirstByInstituteIdAndTypeAndStatusOrderByIdAsc(instituteId, "CASH", "ACTIVE")
                .orElseGet(() -> createDefaultAccount(institute, "CASH"));
        accountRepository.findFirstByInstituteIdAndTypeAndStatusOrderByIdAsc(instituteId, "BANK", "ACTIVE")
                .orElseGet(() -> createDefaultAccount(institute, "BANK"));
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select a.id, a.name, a.type, a.bank_name, a.account_number_last4, a.opening_balance, a.status,
                       coalesce(sum(case when e.status = 'POSTED' and e.entry_type in ('INCOME','TRANSFER_IN','REFUND_IN','ADJUSTMENT') then e.amount else 0 end), 0) as total_in,
                       coalesce(sum(case when e.status = 'POSTED' and e.entry_type in ('EXPENSE','TRANSFER_OUT','REFUND_OUT') then e.amount else 0 end), 0) as total_out,
                       max(e.transaction_date) as last_transaction
                from financial_accounts a
                left join cashbook_entries e on e.account_id = a.id and e.institute_id = a.institute_id
                where a.institute_id = :instituteId
                group by a.id, a.name, a.type, a.bank_name, a.account_number_last4, a.opening_balance, a.status
                order by a.status, a.created_at, a.id
                """)
                .setParameter("instituteId", instituteId)
                .getResultList();
        return rows.stream()
                .map(row -> {
                    BigDecimal opening = money(row[5]);
                    BigDecimal in = money(row[7]);
                    BigDecimal out = money(row[8]);
                    return Map.<String, Object>ofEntries(
                            Map.entry("id", row[0]),
                            Map.entry("name", row[1]),
                            Map.entry("type", row[2]),
                            Map.entry("bankName", Objects.toString(row[3], "")),
                            Map.entry("accountNumberLast4", Objects.toString(row[4], "")),
                            Map.entry("openingBalance", opening),
                            Map.entry("status", row[6]),
                            Map.entry("totalIn", in),
                            Map.entry("totalOut", out),
                            Map.entry("currentBalance", opening.add(in).subtract(out)),
                            Map.entry("lastTransaction", row[9] == null ? "" : row[9])
                    );
                })
                .toList();
    }

    @Transactional
    public List<FinancialCategory> categories(Long instituteId) {
        Institute institute = validateInstitute(instituteId);
        ensureDefaultCategories(institute);
        return categoryRepository.findAllByInstituteIdOrderByTypeAscNameAsc(instituteId);
    }

    @Transactional
    public FinancialAccount createAccount(Long instituteId, Long accountId, FinancialAccountPayload request) {
        Institute institute = validateInstitute(instituteId);
        FinancialAccount account = new FinancialAccount();
        account.setInstitute(institute);
        account.setName(trimRequired(request.name(), "ACCOUNT_NAME_REQUIRED"));
        account.setType(requireOne(request.type(), "CASH", "BANK", "UPI", "WALLET", "OTHER"));
        account.setBankName(trim(request.bankName()));
        account.setAccountNumberLast4(trim(request.accountNumberLast4()));
        account.setOpeningBalance(money(request.openingBalance()));
        account.setOpeningDate(request.openingDate() == null ? LocalDate.now() : request.openingDate());
        account.setCreatedByAccountId(accountId);
        return accountRepository.save(account);
    }

    @Transactional
    public FinancialCategory createCategory(Long instituteId, FinancialCategoryPayload request) {
        Institute institute = validateInstitute(instituteId);
        String type = requireOne(request.type(), "INCOME", "EXPENSE");
        String name = trimRequired(request.name(), "CATEGORY_NAME_REQUIRED");
        String code = name.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        FinancialCategory category = new FinancialCategory();
        category.setInstitute(institute);
        category.setType(type);
        category.setCode(code);
        category.setName(name);
        return categoryRepository.save(category);
    }

    @Transactional
    public CashbookEntry addIncome(Long instituteId, Long accountId, CashbookEntryPayload request) {
        return createManualEntry(instituteId, accountId, request, "INCOME", "MANUAL_INCOME");
    }

    @Transactional
    public CashbookEntry addExpense(Long instituteId, Long accountId, CashbookEntryPayload request) {
        return createManualEntry(instituteId, accountId, request, "EXPENSE", "MANUAL_EXPENSE");
    }

    @Transactional
    public CashbookEntry addRefund(Long instituteId, Long accountId, CashbookEntryPayload request) {
        return createManualEntry(instituteId, accountId, request, "REFUND_OUT", "REFUND");
    }

    @Transactional
    public List<CashbookEntry> transfer(Long instituteId, Long accountId, CashbookTransferPayload request) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            return entryRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim())
                    .map(List::of)
                    .orElseGet(List::of);
        }
        Institute institute = validateInstitute(instituteId);
        FinancialAccount from = findAccount(instituteId, request.fromAccountId());
        FinancialAccount to = findAccount(instituteId, request.toAccountId());
        if (from.getId().equals(to.getId())) throw new IllegalArgumentException("INVALID_TRANSFER_ACCOUNT: Accounts must be different.");
        BigDecimal amount = positive(request.amount());
        AcademicSession session = optionalSession(instituteId, request.academicSessionId());
        String transferRef = "TRF-" + UUID.randomUUID();
        CashbookEntry out = buildEntry(institute, session, from, null, "TRANSFER", "TRANSFER_OUT", "TRANSFER",
                "Account Transfer", amount, request.date(), request.paymentMode(), "Transfer to " + to.getName(),
                request.referenceNumber(), request.description(), accountId);
        out.setTransferReferenceId(transferRef);
        out.setIdempotencyKey(trim(request.idempotencyKey()));
        CashbookEntry in = buildEntry(institute, session, to, null, "TRANSFER", "TRANSFER_IN", "TRANSFER",
                "Account Transfer", amount, request.date(), request.paymentMode(), "Transfer from " + from.getName(),
                request.referenceNumber(), request.description(), accountId);
        in.setTransferReferenceId(transferRef);
        return entryRepository.saveAll(List.of(out, in));
    }

    @Transactional
    public CashbookEntry voidManualEntry(Long instituteId, Long accountId, Long entryId, String reason) {
        CashbookEntry original = entryRepository.findByInstituteIdAndId(instituteId, entryId)
                .orElseThrow(() -> new ResourceNotFoundException("CASHBOOK_ENTRY_NOT_FOUND: Cashbook entry not found."));
        if (!original.getSourceType().startsWith("MANUAL_")) {
            throw new IllegalArgumentException("SYSTEM_ENTRY_VOID_BLOCKED: Void fee/salary entries from their source module.");
        }
        if ("VOIDED".equalsIgnoreCase(original.getStatus())) {
            throw new IllegalArgumentException("ENTRY_ALREADY_VOIDED: Cashbook entry is already voided.");
        }
        original.setStatus("VOIDED");
        original.setVoidedAt(java.time.LocalDateTime.now());
        original.setVoidedByAccountId(accountId);
        original.setVoidReason(trimRequired(reason, "VOID_REASON_REQUIRED"));
        return entryRepository.save(original);
    }

    @Transactional
    public void postFeePayment(FeePayment payment, Long accountId) {
        postFeePayment(payment, null, accountId);
    }

    @Transactional
    public void postFeePayment(FeePayment payment, Long financialAccountId, Long actorAccountId) {
        if (payment == null || payment.getId() == null || !isCompleted(payment.getPaymentStatus())) return;
        Long instituteId = payment.getInstitute().getId();
        if (entryRepository.findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(instituteId, "FEE_PAYMENT", payment.getId()).isPresent()) return;
        Institute institute = validateInstitute(instituteId);
        FinancialAccount account = financialAccountId == null
                ? resolveAccount(institute, payment.getMode())
                : findAccount(instituteId, financialAccountId);
        FinancialCategory category = ensureCategory(institute, "INCOME", categoryCodeForFee(payment), categoryLabelForFee(payment), true);
        CashbookEntry entry = buildEntry(institute, payment.getAcademicSession(), account, category, "FEE_PAYMENT", "INCOME",
                category.getCode(), category.getName(), money(payment.getPaidAmount()),
                payment.getPaymentDate(), payment.getMode(), "Student #" + payment.getStudentId(),
                firstText(payment.getReceiptNumber(), payment.getTransactionId()), payment.getCoverageLabel(), actorAccountId);
        entry.setSourceId(payment.getId());
        saveIdempotent(entry);
    }

    @Transactional
    public void reverseFeePayment(FeePayment payment, Long accountId, String reason) {
        reverseSourcePayment(payment.getInstitute().getId(), "FEE_PAYMENT", payment.getId(), "REFUND_OUT", "FEE_PAYMENT_VOID", accountId, reason);
    }

    @Transactional
    public void postSalaryPayment(TeacherSalaryPayment payment, Long accountId) {
        if (payment == null || payment.getId() == null || !isCompleted(payment.getStatus())) return;
        Long instituteId = payment.getInstitute().getId();
        if (entryRepository.findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(instituteId, "SALARY_PAYMENT", payment.getId()).isPresent()) return;
        Institute institute = validateInstitute(instituteId);
        FinancialAccount account = resolveAccount(institute, payment.getPaymentMode());
        FinancialCategory category = ensureCategory(institute, "EXPENSE", "SALARY", "Salary", true);
        CashbookEntry entry = buildEntry(institute, null, account, category, "SALARY_PAYMENT", "EXPENSE",
                "SALARY", "Salary", money(payment.getTotalAmount()), payment.getPaidOn(),
                payment.getPaymentMode(), "Teacher #" + payment.getTeacher().getId(),
                firstText(payment.getPaymentReference(), payment.getTransactionReference()),
                payment.getNote(), accountId);
        entry.setSourceId(payment.getId());
        saveIdempotent(entry);
    }

    @Transactional
    public void reverseSalaryPayment(TeacherSalaryPayment payment, Long accountId, String reason) {
        reverseSourcePayment(payment.getInstitute().getId(), "SALARY_PAYMENT", payment.getId(), "REFUND_IN", "SALARY_PAYMENT_VOID", accountId, reason);
    }

    private CashbookEntry createManualEntry(Long instituteId, Long accountId, CashbookEntryPayload request, String entryType, String sourceType) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            var existing = entryRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim());
            if (existing.isPresent()) return existing.get();
        }
        Institute institute = validateInstitute(instituteId);
        FinancialAccount account = findAccount(instituteId, request.accountId());
        FinancialCategory category = findCategory(instituteId, request.categoryId());
        String requiredCategoryType = "INCOME".equals(entryType) || "REFUND_IN".equals(entryType) ? "INCOME" : "EXPENSE";
        if (!requiredCategoryType.equals(category.getType())) throw new IllegalArgumentException("CATEGORY_TYPE_MISMATCH: Category type does not match entry.");
        CashbookEntry entry = buildEntry(institute, optionalSession(instituteId, request.academicSessionId()), account, category, sourceType,
                entryType, category.getCode(), category.getName(), positive(request.amount()), request.date(), request.paymentMode(),
                request.payerPayeeName(), request.referenceNumber(), request.description(), accountId);
        entry.setAttachmentUrl(trim(request.attachmentUrl()));
        entry.setAttachmentName(trim(request.attachmentName()));
        entry.setAttachmentContentType(trim(request.attachmentContentType()));
        entry.setIdempotencyKey(trim(request.idempotencyKey()));
        return saveIdempotent(entry);
    }

    private void reverseSourcePayment(Long instituteId, String sourceType, Long sourceId, String reversalType, String reversalSourceType, Long accountId, String reason) {
        CashbookEntry original = entryRepository.findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(instituteId, sourceType, sourceId)
                .orElse(null);
        if (original == null) return;
        if (entryRepository.findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(instituteId, reversalSourceType, sourceId).isPresent()) return;
        CashbookEntry reversal = buildEntry(original.getInstitute(), original.getAcademicSession(), original.getAccount(), original.getCategory(),
                reversalSourceType, reversalType, original.getCategoryCode(), original.getCategoryLabel(), original.getAmount(),
                LocalDate.now(), original.getPaymentMode(), original.getPayerPayeeName(), original.getReferenceNumber(),
                "Reversal: " + trimRequired(reason, "VOID_REASON_REQUIRED"), accountId);
        reversal.setSourceId(sourceId);
        reversal.setReversalOfEntry(original);
        entryRepository.save(reversal);
    }

    private CashbookEntry buildEntry(Institute institute, AcademicSession session, FinancialAccount account, FinancialCategory category,
                                     String sourceType, String entryType, String categoryCode, String categoryLabel,
                                     BigDecimal amount, LocalDate date, String paymentMode, String payerPayee,
                                     String referenceNumber, String description, Long accountId) {
        CashbookEntry entry = new CashbookEntry();
        entry.setInstitute(institute);
        entry.setAcademicSession(session);
        entry.setAccount(account);
        entry.setCategory(category);
        entry.setSourceType(sourceType);
        entry.setEntryType(entryType);
        entry.setCategoryCode(categoryCode);
        entry.setCategoryLabel(categoryLabel);
        entry.setAmount(positive(amount));
        entry.setTransactionDate(date == null ? LocalDate.now() : date);
        entry.setPaymentMode(defaultValue(paymentMode, "Cash"));
        entry.setPayerPayeeName(trim(payerPayee));
        entry.setReferenceNumber(trim(referenceNumber));
        entry.setDescription(trim(description));
        entry.setCreatedByAccountId(accountId);
        entry.setVoucherNumber(nextVoucher(entryType));
        return entry;
    }

    private CashbookEntry saveIdempotent(CashbookEntry entry) {
        try {
            return entryRepository.saveAndFlush(entry);
        } catch (DataIntegrityViolationException exception) {
            if (entry.getSourceId() != null) {
                return entryRepository.findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(
                        entry.getInstitute().getId(), entry.getSourceType(), entry.getSourceId()).orElseThrow(() -> exception);
            }
            if (StringUtils.hasText(entry.getIdempotencyKey())) {
                return entryRepository.findByInstituteIdAndIdempotencyKey(entry.getInstitute().getId(), entry.getIdempotencyKey()).orElseThrow(() -> exception);
            }
            throw exception;
        }
    }

    private FinancialAccount resolveAccount(Institute institute, String paymentMode) {
        String mode = normalize(paymentMode, "Cash");
        String type = mode.equalsIgnoreCase("Cash") ? "CASH" : mode.equalsIgnoreCase("UPI") ? "UPI" : "BANK";
        return accountRepository.findFirstByInstituteIdAndTypeAndStatusOrderByIdAsc(institute.getId(), type, "ACTIVE")
                .orElseGet(() -> createDefaultAccount(institute, type));
    }

    private FinancialAccount createDefaultAccount(Institute institute, String type) {
        FinancialAccount account = new FinancialAccount();
        account.setInstitute(institute);
        account.setName(switch (type) {
            case "BANK" -> "Main Bank Account";
            case "UPI" -> "UPI Collection Account";
            default -> "Cash Counter";
        });
        account.setType(type);
        account.setOpeningBalance(ZERO);
        account.setOpeningDate(LocalDate.now());
        return accountRepository.save(account);
    }

    private FinancialCategory ensureCategory(Institute institute, String type, String code, String name, boolean system) {
        return categoryRepository.findByInstituteIdAndTypeAndCodeIgnoreCase(institute.getId(), type, code)
                .orElseGet(() -> {
                    FinancialCategory category = new FinancialCategory();
                    category.setInstitute(institute);
                    category.setType(type);
                    category.setCode(code);
                    category.setName(name);
                    category.setSystemCategory(system);
                    return categoryRepository.save(category);
                });
    }

    private void ensureDefaultCategories(Institute institute) {
        List.of(
                List.of("INCOME", "FEES", "Fees"),
                List.of("INCOME", "DONATION", "Donation"),
                List.of("INCOME", "GRANT", "Government Grant"),
                List.of("INCOME", "INTEREST", "Interest"),
                List.of("INCOME", "OTHER_INCOME", "Other Income"),
                List.of("EXPENSE", "SALARY", "Salary"),
                List.of("EXPENSE", "UTILITIES", "Utilities"),
                List.of("EXPENSE", "FUEL", "Fuel"),
                List.of("EXPENSE", "MAINTENANCE", "Maintenance"),
                List.of("EXPENSE", "STATIONERY", "Stationery"),
                List.of("EXPENSE", "LIBRARY_PURCHASE", "Library Purchase"),
                List.of("EXPENSE", "HOSTEL", "Hostel"),
                List.of("EXPENSE", "MESS", "Mess"),
                List.of("EXPENSE", "EXAMINATION", "Examination"),
                List.of("EXPENSE", "OTHER_EXPENSE", "Other Expense")
        ).forEach(row -> ensureCategory(institute, row.get(0), row.get(1), row.get(2), true));
    }

    private FinancialAccount findAccount(Long instituteId, Long id) {
        return accountRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FINANCIAL_ACCOUNT_NOT_FOUND: Account not found."));
    }

    private FinancialCategory findCategory(Long instituteId, Long id) {
        return categoryRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FINANCIAL_CATEGORY_NOT_FOUND: Category not found."));
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("INSTITUTE_NOT_FOUND: Institute not found."));
    }

    private AcademicSession optionalSession(Long instituteId, Long sessionId) {
        if (sessionId == null) return null;
        return academicSessionRepository.findByInstituteIdAndId(instituteId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ACADEMIC_SESSION_NOT_FOUND: Academic session not found."));
    }

    private void assertAccount(Long instituteId, Long accountId) {
        if (accountId != null) findAccount(instituteId, accountId);
    }

    private String transactionFilterSql(Map<String, String> filters) {
        return """
                where e.institute_id = :instituteId
                  and (:search = '' or lower(concat(coalesce(e.voucher_number,''), ' ', coalesce(e.description,''), ' ', coalesce(e.payer_payee_name,''), ' ', coalesce(e.reference_number,''))) like :search)
                  and (:entryType = '' or e.entry_type = :entryType)
                  and (:categoryId is null or e.category_id = :categoryId)
                  and (:accountId is null or e.account_id = :accountId)
                  and (:paymentMode = '' or lower(e.payment_mode) = lower(:paymentMode))
                  and (:sourceType = '' or e.source_type = :sourceType)
                  and (:status = '' or e.status = :status)
                  and (:dateFrom is null or e.transaction_date >= :dateFrom)
                  and (:dateTo is null or e.transaction_date <= :dateTo)
                  and (:minAmount is null or e.amount >= :minAmount)
                  and (:maxAmount is null or e.amount <= :maxAmount)
                """;
    }

    private BigDecimal accountBalanceByType(Long instituteId, String type) {
        Object result = entityManager.createNativeQuery("""
                select coalesce(sum(a.opening_balance), 0)
                     + coalesce(sum(case when e.status = 'POSTED' and e.entry_type in ('INCOME','TRANSFER_IN','REFUND_IN','ADJUSTMENT') then e.amount else 0 end), 0)
                     - coalesce(sum(case when e.status = 'POSTED' and e.entry_type in ('EXPENSE','TRANSFER_OUT','REFUND_OUT') then e.amount else 0 end), 0)
                from financial_accounts a
                left join cashbook_entries e on e.account_id = a.id and e.institute_id = a.institute_id
                where a.institute_id = :instituteId and a.status = 'ACTIVE' and a.type = :type
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("type", type)
                .getSingleResult();
        return money(result);
    }

    private String nextVoucher(String entryType) {
        String prefix = switch (entryType) {
            case "EXPENSE" -> "EXP";
            case "TRANSFER_IN", "TRANSFER_OUT" -> "TRF";
            case "REFUND_IN", "REFUND_OUT" -> "REF";
            default -> "REC";
        };
        Number next = (Number) entityManager.createNativeQuery("select nextval('cashbook_voucher_sequence')").getSingleResult();
        return "%s-%d-%06d".formatted(prefix, Year.now().getValue(), next.longValue());
    }

    private String categoryCodeForFee(FeePayment payment) {
        String target = normalize(payment.getPaymentTarget(), "");
        if (target.contains("hostel")) return "HOSTEL_FEE";
        if (target.contains("transport")) return "TRANSPORT_FEE";
        if (target.contains("library")) return "LIBRARY_FEE";
        if (target.contains("exam")) return "EXAM_FEE";
        if (target.contains("admission")) return "ADMISSION_FEE";
        return "FEES";
    }

    private String categoryLabelForFee(FeePayment payment) {
        return switch (categoryCodeForFee(payment)) {
            case "HOSTEL_FEE" -> "Hostel Fee";
            case "TRANSPORT_FEE" -> "Transport Fee";
            case "LIBRARY_FEE" -> "Library Fee";
            case "EXAM_FEE" -> "Exam Fee";
            case "ADMISSION_FEE" -> "Admission Fee";
            default -> "Fees";
        };
    }

    private boolean isCompleted(String status) {
        return "COMPLETED".equalsIgnoreCase(status) || "SUCCESS".equalsIgnoreCase(status);
    }

    private String requireOne(String value, String... allowed) {
        String normalized = normalize(value, "");
        for (String option : allowed) {
            if (option.equalsIgnoreCase(normalized)) return option;
        }
        throw new IllegalArgumentException("UNSUPPORTED_CASHBOOK_VALUE: Unsupported value " + value);
    }

    private String normalize(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : fallback;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String trimRequired(String value, String code) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException(code + ": Required value is missing.");
        return value.trim();
    }

    private String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first.trim() : trim(second);
    }

    private BigDecimal positive(BigDecimal value) {
        BigDecimal amount = money(value);
        if (amount.compareTo(ZERO) <= 0) throw new IllegalArgumentException("INVALID_AMOUNT: Amount must be greater than zero.");
        return amount;
    }

    private BigDecimal money(Object value) {
        if (value == null) return ZERO;
        if (value instanceof BigDecimal bd) return bd.setScale(2, RoundingMode.HALF_UP);
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal moneyOrNull(String value) {
        return StringUtils.hasText(value) ? money(value) : null;
    }

    private String like(String value) {
        return StringUtils.hasText(value) ? "%" + value.trim().toLowerCase(Locale.ROOT) + "%" : "";
    }

    private Long parseLong(String value) {
        return StringUtils.hasText(value) ? Long.valueOf(value.trim()) : null;
    }

    private LocalDate parseDate(String value) {
        return StringUtils.hasText(value) ? LocalDate.parse(value.trim()) : null;
    }
}
