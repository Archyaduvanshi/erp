package com.erp.backend.fee.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.cashbook.service.CashbookService;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.dto.FeeDueResponse;
import com.erp.backend.fee.dto.FeeOverviewResponse;
import com.erp.backend.fee.dto.FeePaymentPayload;
import com.erp.backend.fee.dto.FeePaymentResponse;
import com.erp.backend.fee.dto.FeeReceiptSearchResponse;
import com.erp.backend.fee.dto.FeeStudentSearchResponse;
import com.erp.backend.fee.dto.FeeStudentSummaryResponse;
import com.erp.backend.fee.dto.FeeStructurePayload;
import com.erp.backend.fee.dto.FeeStructureResponse;
import com.erp.backend.fee.entity.FeePayment;
import com.erp.backend.fee.entity.FeePaymentAllocation;
import com.erp.backend.fee.entity.FeeStructure;
import com.erp.backend.fee.entity.StudentFeeCharge;
import com.erp.backend.fee.repository.FeePaymentAllocationRepository;
import com.erp.backend.fee.repository.FeePaymentRepository;
import com.erp.backend.fee.repository.FeeStructureRepository;
import com.erp.backend.fee.repository.StudentFeeChargeRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class FeeService {

    private static final String COMPLETED = "COMPLETED";
    private static final String PENDING_VERIFICATION = "PENDING_VERIFICATION";
    private static final String VOIDED = "VOIDED";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final FeeStructureRepository feeStructureRepository;
    private final FeePaymentRepository feePaymentRepository;
    private final FeePaymentAllocationRepository feePaymentAllocationRepository;
    private final StudentFeeChargeRepository studentFeeChargeRepository;
    private final CashbookService cashbookService;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public FeeService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            AcademicSessionRepository academicSessionRepository,
            FeeStructureRepository feeStructureRepository,
            FeePaymentRepository feePaymentRepository,
            FeePaymentAllocationRepository feePaymentAllocationRepository,
            StudentFeeChargeRepository studentFeeChargeRepository,
            CashbookService cashbookService,
            EntityManager entityManager,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.feeStructureRepository = feeStructureRepository;
        this.feePaymentRepository = feePaymentRepository;
        this.feePaymentAllocationRepository = feePaymentAllocationRepository;
        this.studentFeeChargeRepository = studentFeeChargeRepository;
        this.cashbookService = cashbookService;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public FeeOverviewResponse getOverview(Long instituteId, Long academicSessionId) {
        Long sessionId = optionalSessionId(instituteId, academicSessionId);
        BigDecimal expected = money(studentFeeChargeRepository.sumOpenCharges(instituteId, sessionId));
        BigDecimal collected = money(feePaymentRepository.sumCompletedPayments(instituteId, sessionId));
        long studentsWithDues = ((Number) entityManager.createNativeQuery("""
                select count(*)
                from (
                    select c.student_id,
                           coalesce(sum(c.amount), 0) - coalesce((
                             select sum(a.amount)
                             from fee_payment_allocations a
                             join fee_payments fp on fp.id = a.payment_id
                             where a.institute_id = c.institute_id
                               and a.student_id = c.student_id
                               and a.student_fee_charge_id is not null
                               and lower(coalesce(fp.payment_status, '')) in ('completed', 'success')
                               and (:academicSessionId is null or a.academic_session_id = :academicSessionId or a.academic_session_id is null)
                           ), 0) - greatest(coalesce((
                             select sum(case
                               when upper(coalesce(aa.allocation_type, '')) = 'ADVANCE' and aa.student_fee_charge_id is null then aa.amount
                               when upper(coalesce(aa.allocation_type, '')) = 'ADVANCE_APPLIED' and aa.student_fee_charge_id is not null then -aa.amount
                               else 0
                             end)
                             from fee_payment_allocations aa
                             join fee_payments afp on afp.id = aa.payment_id
                             where aa.institute_id = c.institute_id
                               and aa.student_id = c.student_id
                               and lower(coalesce(afp.payment_status, '')) in ('completed', 'success')
                               and (:academicSessionId is null or aa.academic_session_id = :academicSessionId or aa.academic_session_id is null)
                           ), 0), 0) as outstanding
                    from student_fee_charges c
                    where c.institute_id = :instituteId
                      and lower(coalesce(c.status, 'OPEN')) = 'open'
                      and (:academicSessionId is null or c.academic_session_id = :academicSessionId or c.academic_session_id is null)
                    group by c.institute_id, c.student_id
                ) ledger
                where ledger.outstanding > 0
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", sessionId)
                .getSingleResult()).longValue();
        return new FeeOverviewResponse(
                money(expected),
                collected,
                money(expected.subtract(collected).max(BigDecimal.ZERO)),
                studentsWithDues,
                money(feePaymentRepository.sumTodayCollections(instituteId, sessionId)),
                money(feePaymentRepository.sumMonthCollections(instituteId, sessionId))
        );
    }

    @Transactional(readOnly = true)
    public List<String> getClasses(Long instituteId, Long academicSessionId) {
        Long sessionId = optionalSessionId(instituteId, academicSessionId);
        TreeSet<String> classes = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        studentRepository.findDistinctClassLabels(instituteId).stream()
                .map(this::classOnly)
                .filter(StringUtils::hasText)
                .forEach(classes::add);
        feeStructureRepository.findDistinctStructureClasses(instituteId, sessionId).stream()
                .map(this::classOnly)
                .filter(StringUtils::hasText)
                .forEach(classes::add);
        return classes.stream().toList();
    }

    @Transactional(readOnly = true)
    public List<FeeStructureResponse> getStructures(Long instituteId, Long academicSessionId, String className, String category) {
        Long sessionId = optionalSessionId(instituteId, academicSessionId);
        return feeStructureRepository.findActiveStructures(instituteId, sessionId, defaultValue(className, ""), defaultValue(category, ""))
                .stream()
                .map(this::toStructureResponse)
                .toList();
    }

    @Transactional
    public FeeStructureResponse saveStructure(Long instituteId, FeeStructurePayload request) {
        Institute institute = validateInstitute(instituteId);
        FeeStructure structure = new FeeStructure();
        structure.setInstitute(institute);
        structure.setAcademicSession(resolveRequiredSession(instituteId, request.academicSessionId()));
        applyStructurePayload(structure, request);
        FeeStructure saved = feeStructureRepository.save(structure);
        generateChargesForStructure(institute, saved);
        return toStructureResponse(saved);
    }

    @Transactional
    public void deleteStructure(Long instituteId, Long id) {
        FeeStructure structure = feeStructureRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FEE_STRUCTURE_NOT_FOUND: Fee structure not found with id: " + id));
        boolean used = feePaymentRepository.countByInstituteIdAndStructureId(instituteId, String.valueOf(id)) > 0
                || studentFeeChargeRepository.existsByInstituteIdAndFeeStructureId(instituteId, id)
                || feePaymentAllocationRepository.existsByInstituteIdAndFeeStructureId(instituteId, id);
        if (used) {
            structure.setStatus("ARCHIVED");
            feeStructureRepository.save(structure);
            return;
        }
        feeStructureRepository.delete(structure);
    }

    @Transactional(readOnly = true)
    public Page<FeeStudentSearchResponse> searchStudents(Long instituteId, String search, String className, String section, Pageable pageable) {
        return studentRepository.searchFeeStudents(instituteId, defaultValue(search, ""), defaultValue(className, ""), defaultValue(section, ""), pageable);
    }

    @Transactional(readOnly = true)
    public FeeStudentSummaryResponse getStudentSummary(Long instituteId, Long studentId, Long academicSessionId) {
        Student student = findStudent(instituteId, studentId);
        return buildStudentSummary(instituteId, student, optionalSessionId(instituteId, academicSessionId));
    }

    @Transactional(readOnly = true)
    public FeeStudentSummaryResponse getMyStudentSummary(Long instituteId, Long studentId, Long academicSessionId) {
        if (studentId == null) throw new IllegalArgumentException("STUDENT_NOT_FOUND: Student identity is required.");
        return getStudentSummary(instituteId, studentId, academicSessionId);
    }

    @Transactional
    public void synchronizeChargesForStudent(Long instituteId, Long studentId) {
        AcademicSession currentSession = academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElse(null);
        if (currentSession == null) return;
        Institute institute = validateInstitute(instituteId);
        Student student = findStudentForUpdate(instituteId, studentId);
        ensureChargesForStudent(institute, student, currentSession.getId());
        applyAvailableAdvanceToCharges(institute, currentSession, student);
    }

    @Transactional
    public void synchronizeChargesForStudents(Long instituteId, List<Long> studentIds) {
        if (studentIds == null || studentIds.isEmpty()) return;
        AcademicSession currentSession = academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElse(null);
        if (currentSession == null) return;
        Institute institute = validateInstitute(instituteId);
        for (Long studentId : studentIds.stream().filter(Objects::nonNull).distinct().toList()) {
            Student student = findStudentForUpdate(instituteId, studentId);
            ensureChargesForStudent(institute, student, currentSession.getId());
            applyAvailableAdvanceToCharges(institute, currentSession, student);
        }
    }

    @Transactional(readOnly = true)
    public Page<FeeDueResponse> getDues(Long instituteId, Long academicSessionId, String search, String className, String section, BigDecimal minOutstanding, Pageable pageable) {
        Long sessionId = optionalSessionId(instituteId, academicSessionId);
        BigDecimal minimum = money(minOutstanding);
        String ledgerSql = """
                from (
                    select s.id,
                           s.enrollment_no,
                           coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.name, s.enrollment_no)) as student_name,
                           coalesce(s.class_name, s.assigned_class) as class_name,
                           s.section,
                           coalesce(sum(c.amount), 0) as total_due,
                           coalesce((
                             select sum(a.amount)
                             from fee_payment_allocations a
                             join fee_payments fp on fp.id = a.payment_id
                             where a.institute_id = c.institute_id
                               and a.student_id = s.id
                               and a.student_fee_charge_id is not null
                               and lower(coalesce(fp.payment_status, '')) in ('completed', 'success')
                               and (:academicSessionId is null or a.academic_session_id = :academicSessionId or a.academic_session_id is null)
                           ), 0) as total_paid,
                           greatest(coalesce((
                             select sum(case
                               when upper(coalesce(aa.allocation_type, '')) = 'ADVANCE' and aa.student_fee_charge_id is null then aa.amount
                               when upper(coalesce(aa.allocation_type, '')) = 'ADVANCE_APPLIED' and aa.student_fee_charge_id is not null then -aa.amount
                               else 0
                             end)
                             from fee_payment_allocations aa
                             join fee_payments afp on afp.id = aa.payment_id
                             where aa.institute_id = c.institute_id
                               and aa.student_id = s.id
                               and lower(coalesce(afp.payment_status, '')) in ('completed', 'success')
                               and (:academicSessionId is null or aa.academic_session_id = :academicSessionId or aa.academic_session_id is null)
                           ), 0), 0) as advance_balance
                from student_fee_charges c
                join students s on s.id = c.student_id and s.institute_id = c.institute_id
                where c.institute_id = :instituteId
                  and lower(coalesce(c.status, 'OPEN')) = 'open'
                  and (:academicSessionId is null or c.academic_session_id = :academicSessionId or c.academic_session_id is null)
                  and (:className = '' or lower(coalesce(s.class_name, s.assigned_class, '')) = lower(:className))
                  and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                  and (:search = '' or lower(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''), ' ', coalesce(s.name, ''), ' ', coalesce(s.enrollment_no, ''))) like lower(concat('%', :search, '%')))
                group by c.institute_id, s.id, s.enrollment_no, s.first_name, s.last_name, s.name, s.class_name, s.assigned_class, s.section
                ) ledger
                where greatest(ledger.total_due - ledger.total_paid - ledger.advance_balance, 0) >= :minimum
                """;
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                select id, enrollment_no, student_name, class_name, section, total_due, total_paid, advance_balance
                """ + ledgerSql + """
                order by greatest(total_due - total_paid - advance_balance, 0) desc, id asc
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", sessionId)
                .setParameter("className", defaultValue(className, ""))
                .setParameter("section", defaultValue(section, ""))
                .setParameter("search", defaultValue(search, ""))
                .setParameter("minimum", minimum)
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize())
                .getResultList();
        long total = ((Number) entityManager.createNativeQuery("select count(*) " + ledgerSql)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", sessionId)
                .setParameter("className", defaultValue(className, ""))
                .setParameter("section", defaultValue(section, ""))
                .setParameter("search", defaultValue(search, ""))
                .setParameter("minimum", minimum)
                .getSingleResult()).longValue();
        List<FeeDueResponse> dues = rows.stream()
                .map(row -> {
                    BigDecimal totalDue = money((BigDecimal) row[5]);
                    BigDecimal totalPaid = money((BigDecimal) row[6]);
                    BigDecimal advanceBalance = money((BigDecimal) row[7]);
                    return new FeeDueResponse(
                            ((Number) row[0]).longValue(),
                            Objects.toString(row[1], ""),
                            Objects.toString(row[2], ""),
                            Objects.toString(row[3], ""),
                            Objects.toString(row[4], ""),
                            totalDue,
                            totalPaid,
                            money(totalDue.subtract(totalPaid).subtract(advanceBalance).max(BigDecimal.ZERO)),
                            "DUE"
                    );
                })
                .toList();
        return new PageImpl<>(dues, pageable, total);
    }

    @Transactional(readOnly = true)
    public Page<FeePaymentResponse> getPayments(Long instituteId, Long studentId, Long academicSessionId, String search, String mode, String status, Pageable pageable) {
        Long sessionId = optionalSessionId(instituteId, academicSessionId);
        return feePaymentRepository.findPayments(instituteId, studentId, sessionId, defaultValue(search, ""), defaultValue(mode, ""), defaultValue(status, ""), pageable)
                .map(this::toPaymentResponse);
    }

    @Transactional(readOnly = true)
    public Page<FeePaymentResponse> getStudentPayments(Long instituteId, Long studentId, Long academicSessionId, Pageable pageable) {
        return getPayments(instituteId, studentId, academicSessionId, "", "", "", pageable);
    }

    @Transactional(readOnly = true)
    public Page<FeePaymentResponse> getMyStudentPayments(Long instituteId, Long studentId, Long academicSessionId, Pageable pageable) {
        if (studentId == null) throw new IllegalArgumentException("STUDENT_NOT_FOUND: Student identity is required.");
        return getStudentPayments(instituteId, studentId, academicSessionId, pageable);
    }

    @Transactional(readOnly = true)
    public Page<FeeReceiptSearchResponse> getReceipts(Long instituteId, Long academicSessionId, String search, String mode, String status, Pageable pageable) {
        return feePaymentRepository.findReceipts(instituteId, optionalSessionId(instituteId, academicSessionId), defaultValue(search, ""), defaultValue(mode, ""), defaultValue(status, ""), pageable);
    }

    @Transactional
    public FeePaymentResponse savePayment(Long instituteId, FeePaymentPayload request, AuthPrincipal principal) {
        if (request.studentId() == null) throw new IllegalArgumentException("STUDENT_NOT_FOUND: Student is required.");
        return recordPayment(instituteId, request.studentId(), request, false, principal, "MANUAL", null, false);
    }

    @Transactional
    public FeePaymentResponse recordGatewayPayment(
            Long instituteId,
            Long studentId,
            Long academicSessionId,
            BigDecimal amount,
            String providerPaymentId,
            Long gatewayAttemptId,
            String paymentMode
    ) {
        return recordGatewayPayment(instituteId, studentId, academicSessionId, amount, providerPaymentId,
                gatewayAttemptId, paymentMode, "CASHFREE");
    }

    @Transactional
    public FeePaymentResponse recordGatewayPayment(
            Long instituteId,
            Long studentId,
            Long academicSessionId,
            BigDecimal amount,
            String providerPaymentId,
            Long gatewayAttemptId,
            String paymentMode,
            String provider
    ) {
        if (!StringUtils.hasText(providerPaymentId)) {
            throw new IllegalArgumentException("GATEWAY_PAYMENT_ID_REQUIRED: Gateway payment ID is required.");
        }
        String normalizedProvider = defaultValue(provider, "ONLINE").trim().toUpperCase(Locale.ROOT);
        FeePaymentPayload payload = new FeePaymentPayload(
                "overall_total",
                studentId,
                providerPaymentId.trim(),
                providerPaymentId.trim(),
                defaultValue(paymentMode, "Online"),
                COMPLETED,
                "due_auto",
                amount,
                LocalDate.now(),
                normalizedProvider + " payment auto-adjusted",
                "",
                0,
                "overall_payment",
                normalizedProvider.toLowerCase(Locale.ROOT) + ":" + providerPaymentId.trim(),
                academicSessionId
        );
        return recordPayment(instituteId, studentId, payload, false, null, normalizedProvider, gatewayAttemptId, true);
    }

    @Transactional
    public FeePaymentResponse voidPayment(Long instituteId, Long id, String reason, AuthPrincipal principal) {
        FeePayment payment = feePaymentRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FEE_PAYMENT_NOT_FOUND: Fee payment not found with id: " + id));
        if (VOIDED.equalsIgnoreCase(payment.getPaymentStatus())) {
            throw new IllegalArgumentException("PAYMENT_ALREADY_VOIDED: Payment is already voided.");
        }
        payment.setPaymentStatus(VOIDED);
        payment.setVoidedAt(LocalDateTime.now());
        payment.setVoidedByAccountId(principal == null ? null : principal.accountId());
        payment.setVoidReason(reason);
        FeePayment saved = feePaymentRepository.save(payment);
        cashbookService.reverseFeePayment(saved, principal == null ? null : principal.accountId(), reason);
        return toPaymentResponse(saved);
    }

    @Transactional
    public FeePaymentResponse verifyPayment(Long instituteId, Long id, AuthPrincipal principal) {
        FeePayment payment = feePaymentRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FEE_PAYMENT_NOT_FOUND: Fee payment not found with id: " + id));
        if (COMPLETED.equalsIgnoreCase(payment.getPaymentStatus()) || "Success".equalsIgnoreCase(payment.getPaymentStatus())) {
            return toPaymentResponse(payment);
        }
        if (!PENDING_VERIFICATION.equalsIgnoreCase(defaultValue(payment.getPaymentStatus(), ""))) {
            throw new IllegalArgumentException("PAYMENT_NOT_PENDING: Only pending student payments can be verified.");
        }
        Student student = findStudentForUpdate(instituteId, payment.getStudentId());
        AcademicSession session = payment.getAcademicSession() == null
                ? resolveRequiredSession(instituteId, null)
                : payment.getAcademicSession();
        payment.setPaymentStatus(COMPLETED);
        FeePayment saved = feePaymentRepository.saveAndFlush(payment);
        if (!feePaymentAllocationRepository.existsByInstituteIdAndPaymentId(instituteId, saved.getId())) {
            saveNormalizedAllocations(validateInstitute(instituteId), session, student, saved, money(saved.getPaidAmount()), saved.getPaymentTarget());
        }
        cashbookService.postFeePayment(saved, principal == null ? null : principal.accountId());
        return toPaymentResponse(saved);
    }

    @Transactional
    public FeePaymentResponse rejectPayment(Long instituteId, Long id, String reason, AuthPrincipal principal) {
        FeePayment payment = feePaymentRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("FEE_PAYMENT_NOT_FOUND: Fee payment not found with id: " + id));
        if (!PENDING_VERIFICATION.equalsIgnoreCase(defaultValue(payment.getPaymentStatus(), ""))) {
            throw new IllegalArgumentException("PAYMENT_NOT_PENDING: Only pending student payments can be rejected.");
        }
        payment.setPaymentStatus("REJECTED");
        payment.setVoidedAt(LocalDateTime.now());
        payment.setVoidedByAccountId(principal == null ? null : principal.accountId());
        payment.setVoidReason(reason);
        return toPaymentResponse(feePaymentRepository.save(payment));
    }

    @Transactional
    public void deletePayment(Long instituteId, Long id, AuthPrincipal principal) {
        voidPayment(instituteId, id, "Legacy delete converted to void.", principal);
    }

    private FeePaymentResponse recordPayment(
            Long instituteId,
            Long studentId,
            FeePaymentPayload request,
            boolean studentSubmitted,
            AuthPrincipal principal,
            String paymentOrigin,
            Long gatewayAttemptId,
            boolean trustedGateway
    ) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            Optional<FeePayment> existing = feePaymentRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim());
            if (existing.isPresent()) return toPaymentResponse(existing.get());
        }

        Institute institute = validateInstitute(instituteId);
        Student student = findStudentForUpdate(instituteId, studentId);
        AcademicSession session = resolveRequiredSession(instituteId, request.academicSessionId());

        feePaymentRepository.lockStudentPayments(instituteId, studentId);
        ensureChargesForStudent(institute, student, session.getId());
        applyAvailableAdvanceToCharges(institute, session, student);
        FeeStudentSummaryResponse summary = buildStudentSummary(instituteId, student, session.getId());
        BigDecimal amount = money(request.paidAmount());
        if (amount.compareTo(ZERO) <= 0) throw new IllegalArgumentException("INVALID_PAYMENT_AMOUNT: Payment amount must be greater than zero.");
        if (!trustedGateway && !"advance_only".equalsIgnoreCase(defaultValue(request.paymentTarget(), "")) && amount.compareTo(summary.totalOutstanding()) > 0) {
            throw new IllegalArgumentException("PAYMENT_EXCEEDS_DUE: Payment cannot exceed current outstanding amount.");
        }
        if (requiresUniqueTransaction(request.mode()) && StringUtils.hasText(request.transactionId())
                && feePaymentRepository.existsByInstituteIdAndTransactionIdIgnoreCaseAndPaymentStatusIn(instituteId, request.transactionId().trim(), List.of(COMPLETED, "Success", PENDING_VERIFICATION))) {
            throw new IllegalArgumentException("DUPLICATE_TRANSACTION: Transaction reference already exists.");
        }

        FeePayment payment = new FeePayment();
        payment.setInstitute(institute);
        payment.setAcademicSession(session);
        payment.setStructureId(defaultValue(request.structureId(), "overall_total"));
        payment.setStudentId(studentId);
        payment.setTransactionId(defaultValue(request.transactionId(), generateReceiptNumber()));
        payment.setGatewayRef(trim(request.gatewayRef()));
        payment.setMode(defaultValue(request.mode(), studentSubmitted ? "UPI" : "Cash"));
        payment.setPaymentStatus(studentSubmitted ? PENDING_VERIFICATION : COMPLETED);
        payment.setPaymentTarget(defaultValue(request.paymentTarget(), "due_auto"));
        payment.setPaymentOrigin(defaultValue(paymentOrigin, "MANUAL"));
        payment.setGatewayAttemptId(gatewayAttemptId);
        payment.setPaidAmount(amount);
        payment.setPaymentDate(request.paymentDate() == null ? LocalDate.now() : request.paymentDate());
        payment.setCoverageLabel(defaultValue(request.coverageLabel(), studentSubmitted ? "Online payment pending verification" : "Overall payment auto-adjusted"));
        payment.setActiveFromMonth(trim(request.activeFromMonth()));
        payment.setBilledMonthsCount(request.billedMonthsCount() == null ? 0 : request.billedMonthsCount());
        payment.setBillingType(defaultValue(request.billingType(), "overall_payment"));
        payment.setReceiptNumber(generateReceiptNumber());
        payment.setTaxBreakdown(calculateTaxBreakdown(amount));
        payment.setBalanceRemaining(summary.totalOutstanding().subtract(amount).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        payment.setDownloadLink("receipt-" + payment.getReceiptNumber() + ".txt");
        payment.setIdempotencyKey(trim(request.idempotencyKey()));
        payment.setCoveredMonthsJson(writeJson(List.of()));
        payment.setResolvedMonthsJson(writeJson(List.of()));
        payment.setAllocationsJson(writeJson(List.of()));

        try {
            FeePayment saved = feePaymentRepository.saveAndFlush(payment);
            if (!studentSubmitted) {
                saveNormalizedAllocations(institute, session, student, saved, amount, payment.getPaymentTarget());
                cashbookService.postFeePayment(saved, principal == null ? null : principal.accountId());
            }
            return toPaymentResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            if (StringUtils.hasText(request.idempotencyKey())) {
                return feePaymentRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim())
                        .map(this::toPaymentResponse)
                        .orElseThrow(() -> exception);
            }
            throw exception;
        }
    }

    private FeeStudentSummaryResponse buildStudentSummary(Long instituteId, Student student, Long academicSessionId) {
        String className = classOnly(firstNonBlank(student.getClassName(), student.getAssignedClass()));
        List<StudentFeeCharge> charges = studentFeeChargeRepository.findOpenChargesForStudent(instituteId, student.getId(), academicSessionId);
        List<FeePaymentAllocation> allocations = feePaymentAllocationRepository.findCompletedAllocationsForStudent(instituteId, student.getId(), academicSessionId);
        Map<Long, BigDecimal> paidByCharge = allocations.stream()
                .filter(allocation -> allocation.getStudentFeeCharge() != null)
                .collect(Collectors.groupingBy(allocation -> allocation.getStudentFeeCharge().getId(), Collectors.mapping(FeePaymentAllocation::getAmount,
                        Collectors.reducing(ZERO, this::money, BigDecimal::add))));

        BigDecimal totalDue = charges.stream()
                .map(StudentFeeCharge::getAmount)
                .filter(Objects::nonNull)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add);
        BigDecimal totalPaid = allocations.stream()
                .filter(allocation -> allocation.getStudentFeeCharge() != null)
                .map(FeePaymentAllocation::getAmount)
                .filter(Objects::nonNull)
                .map(this::money)
                .reduce(ZERO, BigDecimal::add)
                .min(totalDue);
        List<FeeStudentSummaryResponse.Component> components = new ArrayList<>();
        for (StudentFeeCharge charge : charges) {
            BigDecimal due = money(charge.getAmount());
            BigDecimal paid = money(paidByCharge.getOrDefault(charge.getId(), ZERO)).min(due);
            components.add(new FeeStudentSummaryResponse.Component(
                    charge.getFeeStructure() == null ? null : charge.getFeeStructure().getId(),
                    charge.getFeeStructure() == null ? charge.getChargeType() : charge.getFeeStructure().getFeeComponent(),
                    due,
                    paid,
                    money(due.subtract(paid).max(BigDecimal.ZERO)),
                    charge.getDueDate()
            ));
        }

        BigDecimal outstandingBeforeAdvance = totalDue.subtract(totalPaid).max(BigDecimal.ZERO);
        BigDecimal advanceBalance = money(feePaymentAllocationRepository.sumAdvanceCredits(instituteId, student.getId(), academicSessionId)
                .subtract(feePaymentAllocationRepository.sumAdvanceApplied(instituteId, student.getId(), academicSessionId))
                .max(BigDecimal.ZERO));
        BigDecimal netOutstanding = outstandingBeforeAdvance.subtract(advanceBalance).max(BigDecimal.ZERO);
        return new FeeStudentSummaryResponse(
                new FeeStudentSummaryResponse.StudentInfo(student.getId(), student.getEnrollmentNo(), buildStudentName(student), className, student.getSection()),
                money(totalDue),
                money(totalPaid),
                money(netOutstanding),
                ZERO,
                money(outstandingBeforeAdvance),
                ZERO,
                ZERO,
                advanceBalance,
                components
        );
    }

    private void generateChargesForStructure(Institute institute, FeeStructure structure) {
        String targetClass = classOnly(structure.getCourseId());
        List<Student> students = studentRepository.findFeeChargeCandidatesByClass(institute.getId(), targetClass).stream()
                .filter(student -> classOnly(firstNonBlank(student.getClassName(), student.getAssignedClass())).equalsIgnoreCase(targetClass))
                .filter(student -> categoryMatches(structure.getCategory(), firstNonBlank(student.getAdmissionCategory(), firstNonBlank(student.getCategory(), "General"))))
                .filter(student -> facilityApplies(structure, student))
                .toList();
        if (students.isEmpty()) return;

        String periodKey = chargePeriodKey(structure);
        Set<String> existingKeys = studentFeeChargeRepository.findExistingKeysForStructureAndStudents(
                        institute.getId(),
                        structure.getId(),
                        students.stream().map(Student::getId).toList()
                ).stream()
                .map(row -> row[0] + "|" + row[1] + "|" + row[2])
                .collect(Collectors.toSet());
        List<StudentFeeCharge> charges = students.stream()
                .filter(student -> !existingKeys.contains(student.getId() + "|" + structure.getId() + "|" + periodKey))
                .map(student -> buildCharge(institute, structure.getAcademicSession(), student, structure, periodKey))
                .toList();
        if (!charges.isEmpty()) {
            saveCharges(charges);
            students.forEach(student -> applyAvailableAdvanceToCharges(institute, structure.getAcademicSession(), student));
        }
    }

    private void ensureChargesForStudent(Institute institute, Student student, Long academicSessionId) {
        String className = classOnly(firstNonBlank(student.getClassName(), student.getAssignedClass()));
        String category = firstNonBlank(student.getAdmissionCategory(), firstNonBlank(student.getCategory(), "General"));
        List<FeeStructure> structures = feeStructureRepository.findActiveStructures(institute.getId(), academicSessionId, className, "").stream()
                .filter(structure -> categoryMatches(structure.getCategory(), category))
                .filter(structure -> facilityApplies(structure, student))
                .toList();
        if (structures.isEmpty()) return;

        Set<String> existingKeys = studentFeeChargeRepository.findExistingKeysForStudentAndStructures(
                        institute.getId(),
                        student.getId(),
                        structures.stream().map(FeeStructure::getId).toList()
                ).stream()
                .map(row -> row[0] + "|" + row[1])
                .collect(Collectors.toSet());
        List<StudentFeeCharge> charges = structures.stream()
                .filter(structure -> !existingKeys.contains(structure.getId() + "|" + chargePeriodKey(structure)))
                .map(structure -> buildCharge(institute, structure.getAcademicSession(), student, structure, chargePeriodKey(structure)))
                .toList();
        if (!charges.isEmpty()) {
            saveCharges(charges);
        }
    }

    private StudentFeeCharge buildCharge(Institute institute, AcademicSession session, Student student, FeeStructure structure, String periodKey) {
        StudentFeeCharge charge = new StudentFeeCharge();
        charge.setInstitute(institute);
        charge.setAcademicSession(session);
        charge.setStudent(student);
        charge.setFeeStructure(structure);
        charge.setChargeType(defaultValue(structure.getFeeType(), "college_fee"));
        charge.setAmount(chargeAmount(structure, student));
        charge.setDueDate(structure.getDueDate());
        charge.setPeriodKey(periodKey);
        charge.setStatus("OPEN");
        return charge;
    }

    private void saveCharges(List<StudentFeeCharge> charges) {
        studentFeeChargeRepository.saveAllAndFlush(charges);
    }

    private BigDecimal chargeAmount(FeeStructure structure, Student student) {
        if ("library".equalsIgnoreCase(defaultValue(structure.getFacilityKey(), "")) && StringUtils.hasText(student.getLibraryMonthlyCharge())) {
            try {
                return money(new BigDecimal(student.getLibraryMonthlyCharge().trim()));
            } catch (NumberFormatException ignored) {
                return money(structure.getAmount());
            }
        }
        int cycleMonths = Math.max(structure.getCycleMonths() == null ? 1 : structure.getCycleMonths(), 1);
        return money(structure.getAmount()).multiply(BigDecimal.valueOf(cycleMonths)).setScale(2, RoundingMode.HALF_UP);
    }

    private String chargePeriodKey(FeeStructure structure) {
        if (StringUtils.hasText(structure.getActiveFromMonth())) return structure.getActiveFromMonth().trim();
        if (structure.getDueDate() != null) return structure.getDueDate().toString().substring(0, 7);
        return "session";
    }

    private boolean facilityApplies(FeeStructure structure, Student student) {
        String feeType = defaultValue(structure.getFeeType(), "college_fee");
        String facilityKey = defaultValue(structure.getFacilityKey(), "").toLowerCase();
        if (!feeType.toLowerCase().contains("facility") && facilityKey.isBlank()) return true;
        if (facilityKey.contains("hostel")) return activeFacility(student.getHostelStatus(), student.getHostelOptIn());
        if (facilityKey.contains("transport")) return activeFacility(student.getTransportStatus(), student.getTransportOptIn());
        if (facilityKey.contains("library")) return activeFacility(student.getLibraryStatus(), student.getLibraryOptIn());
        return true;
    }

    private boolean activeFacility(String status, String optIn) {
        String normalizedStatus = lower(defaultValue(status, ""));
        String normalizedOptIn = lower(defaultValue(optIn, ""));
        return Set.of("active", "assigned", "allocated", "enabled", "yes", "true").contains(normalizedStatus)
                || Set.of("yes", "true", "active").contains(normalizedOptIn);
    }

    private void saveNormalizedAllocations(Institute institute, AcademicSession session, Student student, FeePayment payment, BigDecimal amount, String paymentTarget) {
        BigDecimal remaining = amount;
        if ("advance_only".equalsIgnoreCase(defaultValue(paymentTarget, ""))) {
            saveAdvanceAllocation(institute, session, student, payment, remaining);
            return;
        }
        List<StudentFeeCharge> charges = studentFeeChargeRepository.findOpenChargesForStudent(institute.getId(), student.getId(), session.getId());
        Map<Long, BigDecimal> paidByCharge = feePaymentAllocationRepository.findCompletedAllocationsForStudent(institute.getId(), student.getId(), session.getId()).stream()
                .filter(allocation -> allocation.getStudentFeeCharge() != null)
                .collect(Collectors.groupingBy(allocation -> allocation.getStudentFeeCharge().getId(), Collectors.mapping(FeePaymentAllocation::getAmount,
                        Collectors.reducing(ZERO, this::money, BigDecimal::add))));
        Set<Long> feeStructureIds = charges.stream()
                .map(StudentFeeCharge::getFeeStructure)
                .filter(Objects::nonNull)
                .map(FeeStructure::getId)
                .collect(Collectors.toSet());
        Map<Long, FeeStructure> structuresById = feeStructureRepository.findAllById(feeStructureIds).stream()
                .collect(Collectors.toMap(FeeStructure::getId, structure -> structure));
        for (StudentFeeCharge charge : charges) {
            if (remaining.compareTo(ZERO) <= 0) break;
            BigDecimal alreadyPaid = money(paidByCharge.getOrDefault(charge.getId(), ZERO));
            BigDecimal outstanding = money(charge.getAmount()).subtract(alreadyPaid).max(BigDecimal.ZERO);
            BigDecimal allocationAmount = remaining.min(outstanding);
            if (allocationAmount.compareTo(ZERO) <= 0) continue;
            FeePaymentAllocation allocation = new FeePaymentAllocation();
            allocation.setInstitute(institute);
            allocation.setAcademicSession(session);
            allocation.setPayment(payment);
            allocation.setStudent(student);
            allocation.setStudentFeeCharge(charge);
            FeeStructure chargeStructure = charge.getFeeStructure();
            if (chargeStructure != null) allocation.setFeeStructure(structuresById.getOrDefault(chargeStructure.getId(), chargeStructure));
            allocation.setAmount(money(allocationAmount));
            allocation.setAllocationType("CURRENT_DUE");
            allocation.setFineAmount(ZERO);
            allocation.setDiscountAmount(ZERO);
            feePaymentAllocationRepository.save(allocation);
            remaining = remaining.subtract(allocationAmount);
        }

        if (remaining.compareTo(ZERO) > 0) {
            saveAdvanceAllocation(institute, session, student, payment, remaining);
        }
    }

    private void applyAvailableAdvanceToCharges(Institute institute, AcademicSession session, Student student) {
        if (session == null) return;
        List<FeePaymentAllocation> advanceLedger = feePaymentAllocationRepository.findCompletedAdvanceLedgerForStudent(institute.getId(), student.getId(), session.getId());
        if (advanceLedger.isEmpty()) return;
        Map<Long, BigDecimal> creditByPayment = new HashMap<>();
        Map<Long, BigDecimal> appliedByPayment = new HashMap<>();
        Map<Long, FeePayment> paymentsById = new HashMap<>();
        for (FeePaymentAllocation allocation : advanceLedger) {
            if (allocation.getPayment() == null) continue;
            Long paymentId = allocation.getPayment().getId();
            paymentsById.put(paymentId, allocation.getPayment());
            if ("ADVANCE".equalsIgnoreCase(defaultValue(allocation.getAllocationType(), "")) && allocation.getStudentFeeCharge() == null) {
                creditByPayment.merge(paymentId, money(allocation.getAmount()), BigDecimal::add);
            } else if ("ADVANCE_APPLIED".equalsIgnoreCase(defaultValue(allocation.getAllocationType(), "")) && allocation.getStudentFeeCharge() != null) {
                appliedByPayment.merge(paymentId, money(allocation.getAmount()), BigDecimal::add);
            }
        }

        List<StudentFeeCharge> charges = studentFeeChargeRepository.findOpenChargesForStudent(institute.getId(), student.getId(), session.getId());
        if (charges.isEmpty()) return;
        Map<Long, BigDecimal> paidByCharge = feePaymentAllocationRepository.findCompletedAllocationsForStudent(institute.getId(), student.getId(), session.getId()).stream()
                .filter(allocation -> allocation.getStudentFeeCharge() != null)
                .collect(Collectors.groupingBy(allocation -> allocation.getStudentFeeCharge().getId(), Collectors.mapping(FeePaymentAllocation::getAmount,
                        Collectors.reducing(ZERO, this::money, BigDecimal::add))));

        for (Map.Entry<Long, BigDecimal> entry : creditByPayment.entrySet()) {
            BigDecimal available = money(entry.getValue().subtract(appliedByPayment.getOrDefault(entry.getKey(), ZERO)).max(BigDecimal.ZERO));
            if (available.compareTo(ZERO) <= 0) continue;
            FeePayment advancePayment = paymentsById.get(entry.getKey());
            for (StudentFeeCharge charge : charges) {
                if (available.compareTo(ZERO) <= 0) break;
                BigDecimal alreadyPaid = money(paidByCharge.getOrDefault(charge.getId(), ZERO));
                BigDecimal outstanding = money(charge.getAmount()).subtract(alreadyPaid).max(BigDecimal.ZERO);
                BigDecimal allocationAmount = available.min(outstanding);
                if (allocationAmount.compareTo(ZERO) <= 0) continue;
                FeePaymentAllocation allocation = new FeePaymentAllocation();
                allocation.setInstitute(institute);
                allocation.setAcademicSession(session);
                allocation.setPayment(advancePayment);
                allocation.setStudent(student);
                allocation.setStudentFeeCharge(charge);
                allocation.setFeeStructure(charge.getFeeStructure());
                allocation.setAmount(money(allocationAmount));
                allocation.setAllocationType("ADVANCE_APPLIED");
                allocation.setFineAmount(ZERO);
                allocation.setDiscountAmount(ZERO);
                feePaymentAllocationRepository.save(allocation);
                paidByCharge.merge(charge.getId(), money(allocationAmount), BigDecimal::add);
                available = available.subtract(allocationAmount);
            }
        }
    }

    private void saveAdvanceAllocation(Institute institute, AcademicSession session, Student student, FeePayment payment, BigDecimal amount) {
        if (amount.compareTo(ZERO) <= 0) return;
        FeePaymentAllocation allocation = new FeePaymentAllocation();
        allocation.setInstitute(institute);
        allocation.setAcademicSession(session);
        allocation.setPayment(payment);
        allocation.setStudent(student);
        allocation.setAmount(money(amount));
        allocation.setAllocationType("ADVANCE");
        allocation.setFineAmount(ZERO);
        allocation.setDiscountAmount(ZERO);
        feePaymentAllocationRepository.save(allocation);
    }

    private void applyStructurePayload(FeeStructure structure, FeeStructurePayload request) {
        structure.setCourseId(request.courseId().trim());
        structure.setCategory(request.category().trim());
        structure.setFeeType(defaultValue(request.feeType(), "college_fee"));
        structure.setFacilityKey(trim(request.facilityKey()));
        structure.setFeeComponent(request.feeComponent().trim());
        structure.setAmount(money(request.amount()));
        structure.setCycleMonths(Math.min(Math.max(request.cycleMonths() == null ? 1 : request.cycleMonths(), 1), 12));
        structure.setBillingType(defaultValue(request.billingType(), "cycle_based"));
        structure.setDueDate(request.dueDate() == null ? LocalDate.now() : request.dueDate());
        structure.setActiveFromMonth(trim(request.activeFromMonth()));
        structure.setJoinMonth(trim(request.joinMonth()));
        structure.setStatus("ACTIVE");
    }

    private FeeStructureResponse toStructureResponse(FeeStructure structure) {
        return new FeeStructureResponse(
                structure.getId(),
                structure.getAcademicSession() == null ? null : structure.getAcademicSession().getId(),
                structure.getCourseId(),
                structure.getCategory(),
                defaultValue(structure.getFeeType(), "college_fee"),
                structure.getFacilityKey(),
                structure.getFeeComponent(),
                money(structure.getAmount()),
                structure.getCycleMonths(),
                defaultValue(structure.getBillingType(), "cycle_based"),
                structure.getDueDate(),
                structure.getActiveFromMonth(),
                structure.getJoinMonth(),
                defaultValue(structure.getStatus(), "ACTIVE"),
                structure.getCreatedAt(),
                structure.getUpdatedAt()
        );
    }

    private FeePaymentResponse toPaymentResponse(FeePayment payment) {
        return new FeePaymentResponse(
                payment.getId(),
                payment.getAcademicSession() == null ? null : payment.getAcademicSession().getId(),
                payment.getStructureId(),
                payment.getStudentId(),
                payment.getTransactionId(),
                payment.getGatewayRef(),
                defaultValue(payment.getMode(), "UPI"),
                defaultValue(payment.getPaymentStatus(), COMPLETED),
                defaultValue(payment.getPaymentTarget(), "due_auto"),
                defaultValue(payment.getPaymentOrigin(), "MANUAL"),
                money(payment.getPaidAmount()),
                payment.getPaymentDate(),
                payment.getCoverageLabel(),
                payment.getActiveFromMonth(),
                payment.getBilledMonthsCount(),
                payment.getBillingType(),
                payment.getReceiptNumber(),
                payment.getTaxBreakdown(),
                money(payment.getBalanceRemaining()),
                payment.getDownloadLink(),
                payment.getIdempotencyKey(),
                payment.getGatewayAttemptId(),
                "UNKNOWN",
                readStringList(payment.getCoveredMonthsJson()),
                readStringList(payment.getResolvedMonthsJson()),
                readAllocationList(payment.getAllocationsJson()),
                payment.getCreatedAt(),
                payment.getUpdatedAt(),
                payment.getVoidedAt(),
                payment.getVoidedByAccountId(),
                payment.getVoidReason()
        );
    }

    private AcademicSession resolveRequiredSession(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("ACADEMIC_SESSION_REQUIRED: Academic session not found."));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElseThrow(() -> new IllegalArgumentException("ACADEMIC_SESSION_REQUIRED: Mark an academic session as current before fee changes."));
    }

    private Long optionalSessionId(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("ACADEMIC_SESSION_REQUIRED: Academic session not found."))
                    .getId();
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .map(AcademicSession::getId)
                .orElse(null);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("STUDENT_NOT_FOUND: Student not found with id: " + studentId));
    }

    private Student findStudentForUpdate(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndIdForUpdate(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("STUDENT_NOT_FOUND: Student not found with id: " + studentId));
    }

    private String generateReceiptNumber() {
        Number nextValue = (Number) entityManager.createNativeQuery("select nextval('fee_receipt_seq')").getSingleResult();
        return "FEE-" + Year.now().getValue() + "-" + String.format("%06d", nextValue.longValue());
    }

    private String calculateTaxBreakdown(BigDecimal amount) {
        BigDecimal tax = money(amount.multiply(new BigDecimal("0.18")));
        BigDecimal base = money(amount.subtract(tax).max(BigDecimal.ZERO));
        return "Base Rs " + base + " + GST Rs " + tax;
    }

    private boolean requiresUniqueTransaction(String mode) {
        String normalized = defaultValue(mode, "").toLowerCase();
        return !normalized.equals("cash") && !normalized.isBlank();
    }

    private boolean categoryMatches(String structureCategory, String studentCategory) {
        String normalized = defaultValue(structureCategory, "All Students");
        return "All Students".equalsIgnoreCase(normalized) || normalized.equalsIgnoreCase(defaultValue(studentCategory, "General"));
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String buildStudentName(Student student) {
        return firstNonBlank((defaultValue(student.getFirstName(), "") + " " + defaultValue(student.getLastName(), "")).trim(), firstNonBlank(student.getName(), student.getEnrollmentNo()));
    }

    private String classOnly(String className) {
        if (!StringUtils.hasText(className)) return "";
        return className.split("/", 2)[0].trim();
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to save fee JSON data.", exception);
        }
    }

    private List<String> readStringList(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        try {
            return objectMapper.readValue(value, new TypeReference<List<String>>() {
            });
        } catch (Exception exception) {
            return List.of();
        }
    }

    private List<Map<String, Object>> readAllocationList(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        try {
            return objectMapper.readValue(value, new TypeReference<List<Map<String, Object>>>() {
            }).stream().filter(Objects::nonNull).toList();
        } catch (Exception exception) {
            return List.of();
        }
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String lower(String value) {
        return defaultValue(value, "").toLowerCase();
    }

    private String firstNonBlank(String primary, String fallback) {
        return StringUtils.hasText(primary) ? primary.trim() : fallback;
    }
}
