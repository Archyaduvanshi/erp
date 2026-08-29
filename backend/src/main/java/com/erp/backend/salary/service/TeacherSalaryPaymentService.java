package com.erp.backend.salary.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.erp.backend.attendance.entity.TeacherAttendanceRecord;
import com.erp.backend.attendance.repository.TeacherAttendanceRecordRepository;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.holiday.entity.Holiday;
import com.erp.backend.holiday.repository.HolidayRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.service.NoticeService;
import com.erp.backend.salary.dto.SalaryOverviewResponse;
import com.erp.backend.salary.dto.SalaryPaymentVoidPayload;
import com.erp.backend.salary.dto.TeacherPayrollPeriodResponse;
import com.erp.backend.salary.dto.TeacherSalaryPaymentPayload;
import com.erp.backend.salary.dto.TeacherSalaryPaymentResponse;
import com.erp.backend.salary.dto.TeacherSalaryProfileResponse;
import com.erp.backend.salary.dto.TeacherSalarySummaryResponse;
import com.erp.backend.salary.entity.SalaryPaymentAllocation;
import com.erp.backend.salary.entity.TeacherPayrollPeriod;
import com.erp.backend.salary.entity.TeacherSalaryPayment;
import com.erp.backend.salary.entity.TeacherSalaryProfile;
import com.erp.backend.salary.repository.SalaryPaymentAllocationRepository;
import com.erp.backend.salary.repository.TeacherPayrollPeriodRepository;
import com.erp.backend.salary.repository.TeacherSalaryPaymentRepository;
import com.erp.backend.salary.repository.TeacherSalaryProfileRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import jakarta.persistence.EntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TeacherSalaryPaymentService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    private static final String COMPLETED = "COMPLETED";
    private static final String VOIDED = "VOIDED";

    private final InstituteRepository instituteRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final HolidayRepository holidayRepository;
    private final TeacherRepository teacherRepository;
    private final TeacherSalaryProfileRepository salaryProfileRepository;
    private final TeacherSalaryPaymentRepository salaryPaymentRepository;
    private final TeacherPayrollPeriodRepository payrollPeriodRepository;
    private final SalaryPaymentAllocationRepository paymentAllocationRepository;
    private final TeacherAttendanceRecordRepository teacherAttendanceRecordRepository;
    private final NoticeService noticeService;
    private final EntityManager entityManager;

    public TeacherSalaryPaymentService(
            InstituteRepository instituteRepository,
            AcademicSessionRepository academicSessionRepository,
            HolidayRepository holidayRepository,
            TeacherRepository teacherRepository,
            TeacherSalaryProfileRepository salaryProfileRepository,
            TeacherSalaryPaymentRepository salaryPaymentRepository,
            TeacherPayrollPeriodRepository payrollPeriodRepository,
            SalaryPaymentAllocationRepository paymentAllocationRepository,
            TeacherAttendanceRecordRepository teacherAttendanceRecordRepository,
            NoticeService noticeService,
            EntityManager entityManager
    ) {
        this.instituteRepository = instituteRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.holidayRepository = holidayRepository;
        this.teacherRepository = teacherRepository;
        this.salaryProfileRepository = salaryProfileRepository;
        this.salaryPaymentRepository = salaryPaymentRepository;
        this.payrollPeriodRepository = payrollPeriodRepository;
        this.paymentAllocationRepository = paymentAllocationRepository;
        this.teacherAttendanceRecordRepository = teacherAttendanceRecordRepository;
        this.noticeService = noticeService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<TeacherSalaryPaymentResponse> getPayments(Long instituteId, Long teacherId) {
        List<TeacherSalaryPayment> payments = teacherId == null
                ? salaryPaymentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                : salaryPaymentRepository.findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(instituteId, teacherId);
        return payments.stream().map(this::toPaymentResponse).toList();
    }

    @Transactional(readOnly = true)
    public Page<TeacherSalaryPaymentResponse> getPaymentsPage(Long instituteId, Long teacherId, String monthKey, String status, Pageable pageable) {
        return salaryPaymentRepository.findPayments(instituteId, teacherId, defaultValue(monthKey, ""), defaultValue(status, ""), pageable)
                .map(this::toPaymentResponse);
    }

    @Transactional
    public TeacherPayrollPeriodResponse getOrGeneratePayrollPeriod(Long instituteId, Long teacherId, String monthKey, Long generatedByAccountId) {
        Institute institute = validateInstitute(instituteId);
        Teacher teacher = findTeacher(instituteId, teacherId);
        return toPeriodResponse(ensurePayrollPeriod(institute, teacher, requireMonth(monthKey), generatedByAccountId));
    }

    @Transactional
    public List<TeacherPayrollPeriodResponse> generatePayrollPeriodsForMonth(Long instituteId, String monthKey, Long teacherId, Long generatedByAccountId) {
        Institute institute = validateInstitute(instituteId);
        String month = requireMonth(monthKey);
        List<Teacher> teachers = teacherId == null
                ? teacherRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream().filter(this::isPayrollEligible).toList()
                : List.of(findTeacher(instituteId, teacherId));
        PayrollGenerationContext context = buildGenerationContext(instituteId, month, teachers);
        Map<Long, TeacherPayrollPeriod> existingPeriods = payrollPeriodRepository.findAllByInstituteIdAndMonthKey(instituteId, month).stream()
                .collect(Collectors.toMap(period -> period.getTeacher().getId(), Function.identity(), (first, second) -> first));
        List<TeacherPayrollPeriod> periods = new ArrayList<>();
        for (Teacher teacher : teachers) {
            TeacherPayrollPeriod period = existingPeriods.getOrDefault(teacher.getId(), newPeriod(institute, teacher, month));
            if (generatedByAccountId != null) period.setGeneratedByAccountId(generatedByAccountId);
            recalculatePeriod(period, teacher, context);
            periods.add(period);
        }
        return payrollPeriodRepository.saveAll(periods).stream()
                .map(this::toPeriodResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public Page<TeacherPayrollPeriodResponse> getPayrollPeriods(Long instituteId, Long teacherId, String monthKey, String status, String search, Pageable pageable) {
        if (StringUtils.hasText(monthKey)) requireMonth(monthKey);
        return payrollPeriodRepository.findPayrollPeriods(instituteId, teacherId, defaultValue(monthKey, ""), defaultValue(status, ""), defaultValue(search, ""), pageable)
                .map(this::toPeriodResponse);
    }

    @Transactional(readOnly = true)
    public SalaryOverviewResponse getOverview(Long instituteId, String monthKey) {
        String month = requireMonth(defaultValue(monthKey, YearMonth.now().toString()));
        return buildOverview(instituteId, month);
    }

    @Transactional
    public TeacherSalaryPaymentResponse savePayment(Long instituteId, Long accountId, TeacherSalaryPaymentPayload request) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            var existing = salaryPaymentRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim());
            if (existing.isPresent()) return toPaymentResponse(existing.get());
        }
        if (StringUtils.hasText(request.transactionReference())
                && salaryPaymentRepository.existsByInstituteIdAndTransactionReferenceIgnoreCaseAndStatusNot(instituteId, request.transactionReference().trim(), VOIDED)) {
            throw new IllegalArgumentException("DUPLICATE_TRANSACTION: This transaction reference is already used.");
        }

        Institute institute = validateInstitute(instituteId);
        Teacher teacher = findTeacher(instituteId, request.teacherId());
        String month = requireMonth(StringUtils.hasText(request.payrollMonth()) ? request.payrollMonth() : request.monthKey());
        payrollPeriodRepository.lockOpenPeriodsForTeacher(instituteId, teacher.getId());
        TeacherPayrollPeriod period = payrollPeriodRepository
                .findByInstituteIdAndTeacherIdAndMonthKeyForUpdate(instituteId, teacher.getId(), month)
                .orElseThrow(() -> new IllegalArgumentException("PAYROLL_PERIOD_NOT_GENERATED: Generate/recalculate payroll for this month before payment."));
        period.setBonusAmount(defaultAmount(request.bonusAmount()));
        recalculatePeriod(period, teacher);
        period = payrollPeriodRepository.saveAndFlush(period);
        if ("DRAFT".equalsIgnoreCase(period.getStatus())) {
            throw new IllegalArgumentException("ATTENDANCE_INCOMPLETE: Complete teacher attendance before salary payment.");
        }
        if ("NOT_ELIGIBLE".equalsIgnoreCase(period.getStatus())) {
            throw new IllegalArgumentException("PAYROLL_NOT_ELIGIBLE: Teacher is not eligible for payroll in this month.");
        }

        BigDecimal previousOutstanding = previousOutstanding(instituteId, teacher.getId(), period.getMonthKey());
        BigDecimal payable = Boolean.TRUE.equals(request.settlePreviousOutstanding())
                ? period.getOutstandingAmount().add(previousOutstanding)
                : period.getOutstandingAmount();
        BigDecimal payAmount = money(firstPositive(request.totalAmount(), payable));
        if (payAmount.compareTo(ZERO) <= 0) throw new IllegalArgumentException("INVALID_SALARY_AMOUNT: Payment amount must be greater than zero.");
        if (payAmount.compareTo(payable) > 0) throw new IllegalArgumentException("PAYMENT_EXCEEDS_OUTSTANDING: Payment cannot exceed outstanding salary.");

        TeacherSalaryPayment payment = new TeacherSalaryPayment();
        payment.setInstitute(institute);
        payment.setTeacher(teacher);
        payment.setMonthKey(period.getMonthKey());
        payment.setBaseSalary(period.getBaseSalary());
        payment.setPreviousPendingAmount(Boolean.TRUE.equals(request.settlePreviousOutstanding()) ? previousOutstanding : ZERO);
        payment.setBonusAmount(period.getBonusAmount());
        payment.setLeaveDeductionAmount(period.getLeaveDeductionAmount());
        payment.setTotalAmount(payAmount);
        payment.setOpenSchoolDays(period.getOpenSchoolDays());
        payment.setPresentDays(period.getPresentDays());
        payment.setAbsentDays(period.getAbsentDays());
        payment.setAllowedLeaves(period.getAllowedLeaves());
        payment.setExtraLeaveDays(period.getExtraLeaveDays());
        payment.setPerDaySalary(period.getPerDaySalary());
        payment.setPaidOn(request.paidOn() == null ? LocalDate.now() : request.paidOn());
        payment.setSettledMonthKeys("");
        payment.setNote(trim(request.note()));
        payment.setStatus(COMPLETED);
        payment.setIdempotencyKey(trim(request.idempotencyKey()));
        payment.setPaymentMode(defaultValue(request.paymentMode(), "Cash"));
        payment.setTransactionReference(trim(request.transactionReference()));
        payment.setCreatedByAccountId(accountId);

        try {
            TeacherSalaryPayment saved = salaryPaymentRepository.saveAndFlush(payment);
            saved.setPaymentReference(buildPaymentReference(saved));
            saved = salaryPaymentRepository.saveAndFlush(saved);
            allocatePayment(institute, teacher, saved, payAmount, period, Boolean.TRUE.equals(request.settlePreviousOutstanding()));
            saved.setSettledMonthKeys(joinMonthKeys(paymentAllocationRepository.findSettledMonthKeysByPayment(instituteId, saved.getId())));
            saved = salaryPaymentRepository.saveAndFlush(saved);
            createSalaryNotice(instituteId, teacher, saved);
            return toPaymentResponse(saved);
        } catch (DataIntegrityViolationException exception) {
            if (StringUtils.hasText(request.idempotencyKey())) {
                return salaryPaymentRepository.findByInstituteIdAndIdempotencyKey(instituteId, request.idempotencyKey().trim())
                        .map(this::toPaymentResponse)
                        .orElseThrow(() -> exception);
            }
            throw exception;
        }
    }

    @Transactional
    public TeacherSalaryPaymentResponse voidPayment(Long instituteId, Long accountId, Long paymentId, SalaryPaymentVoidPayload request) {
        TeacherSalaryPayment payment = salaryPaymentRepository.findByInstituteIdAndId(instituteId, paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Salary payment not found with id: " + paymentId));
        if (VOIDED.equalsIgnoreCase(payment.getStatus())) {
            throw new IllegalArgumentException("PAYMENT_ALREADY_VOIDED: Salary payment is already voided.");
        }
        payment.setStatus(VOIDED);
        payment.setVoidedAt(LocalDateTime.now());
        payment.setVoidedByAccountId(accountId);
        payment.setVoidReason(trim(request == null ? null : request.reason()));
        TeacherSalaryPayment saved = salaryPaymentRepository.saveAndFlush(payment);
        paymentAllocationRepository.findAllByInstituteIdAndSalaryPaymentId(instituteId, paymentId)
                .forEach(allocation -> {
                    TeacherPayrollPeriod period = allocation.getPayrollPeriod();
                    period.setStatus("PENDING");
                    recalculatePeriod(period, period.getTeacher());
                    payrollPeriodRepository.save(period);
                });
        return toPaymentResponse(saved);
    }

    @Transactional(readOnly = true)
    public TeacherSalarySummaryResponse getTeacherSummary(Long instituteId, Long teacherId, String monthKey) {
        Institute institute = validateInstitute(instituteId);
        Teacher teacher = findTeacher(instituteId, teacherId);
        String month = requireMonth(defaultValue(monthKey, YearMonth.now().toString()));
        TeacherPayrollPeriod period = payrollPeriodRepository.findByInstituteIdAndTeacherIdAndMonthKey(instituteId, teacherId, month).orElse(null);
        BigDecimal previous = previousOutstanding(instituteId, teacherId, month);
        List<TeacherSalaryPaymentResponse> latestPayments = salaryPaymentRepository
                .findPayments(instituteId, teacherId, "", "", Pageable.ofSize(5))
                .map(this::toPaymentResponse)
                .getContent();
        return new TeacherSalarySummaryResponse(
                teacher.getId(),
                buildTeacherName(teacher),
                teacher.getEmployeeId(),
                teacher.getSpecialization(),
                teacher.getContractType(),
                toProfileResponse(resolveSalaryProfile(institute, teacher, YearMonth.parse(month).atDay(1))),
                period == null ? null : toPeriodResponse(period),
                money(salaryPaymentRepository.sumCompletedPaymentsForTeacher(instituteId, teacherId)),
                previous,
                money((period == null ? ZERO : period.getOutstandingAmount()).add(previous)),
                latestPayments
        );
    }

    @Transactional
    public TeacherSalarySummaryResponse getMySummary(Long instituteId, Long teacherId, String monthKey) {
        if (teacherId == null) throw new IllegalArgumentException("TEACHER_NOT_FOUND: Teacher identity is required.");
        return getTeacherSummary(instituteId, teacherId, monthKey);
    }

    @Transactional
    public Page<TeacherPayrollPeriodResponse> getMyPayrollPeriods(Long instituteId, Long teacherId, String monthKey, String status, Pageable pageable) {
        if (teacherId == null) throw new IllegalArgumentException("TEACHER_NOT_FOUND: Teacher identity is required.");
        return getPayrollPeriods(instituteId, teacherId, monthKey, status, "", pageable);
    }

    @Transactional(readOnly = true)
    public Page<TeacherSalaryPaymentResponse> getMyPayments(Long instituteId, Long teacherId, String monthKey, Pageable pageable) {
        if (teacherId == null) throw new IllegalArgumentException("TEACHER_NOT_FOUND: Teacher identity is required.");
        return getPaymentsPage(instituteId, teacherId, monthKey, "", pageable);
    }

    private SalaryOverviewResponse buildOverview(Long instituteId, String monthKey) {
        Object[] total = (Object[]) entityManager.createNativeQuery("""
                select coalesce(sum(net_payable_amount), 0),
                       coalesce(sum(paid_amount), 0),
                       coalesce(sum(outstanding_amount), 0),
                       count(*) filter (where status <> 'PAID'),
                       count(*) filter (where status = 'PAID')
                from teacher_payroll_periods
                where institute_id = :instituteId
                """)
                .setParameter("instituteId", instituteId)
                .getSingleResult();
        Object[] current = (Object[]) entityManager.createNativeQuery("""
                select coalesce(sum(net_payable_amount), 0),
                       coalesce(sum(paid_amount), 0),
                       count(*) filter (where status = 'PAID'),
                       count(*) filter (where status in ('PENDING', 'DRAFT')),
                       count(*) filter (where status = 'PARTIALLY_PAID'),
                       count(*) filter (where base_salary <= 0)
                from teacher_payroll_periods
                where institute_id = :instituteId
                  and month_key = :monthKey
                """)
                .setParameter("instituteId", instituteId)
                .setParameter("monthKey", monthKey)
                .getSingleResult();
        return new SalaryOverviewResponse(
                money((BigDecimal) total[0]),
                money((BigDecimal) total[1]),
                money((BigDecimal) total[2]),
                ((Number) total[3]).longValue(),
                ((Number) total[4]).longValue(),
                money((BigDecimal) current[0]),
                money((BigDecimal) current[1]),
                ((Number) current[2]).longValue(),
                ((Number) current[3]).longValue(),
                ((Number) current[4]).longValue(),
                ((Number) current[5]).longValue()
        );
    }

    private TeacherPayrollPeriod ensurePayrollPeriod(Institute institute, Teacher teacher, String monthKey, Long generatedByAccountId) {
        TeacherPayrollPeriod period = payrollPeriodRepository
                .findByInstituteIdAndTeacherIdAndMonthKey(institute.getId(), teacher.getId(), monthKey)
                .orElseGet(() -> newPeriod(institute, teacher, monthKey));
        if (generatedByAccountId != null) period.setGeneratedByAccountId(generatedByAccountId);
        recalculatePeriod(period, teacher);
        return payrollPeriodRepository.save(period);
    }

    private TeacherPayrollPeriod newPeriod(Institute institute, Teacher teacher, String monthKey) {
        TeacherPayrollPeriod period = new TeacherPayrollPeriod();
        period.setInstitute(institute);
        period.setTeacher(teacher);
        period.setMonthKey(monthKey);
        return period;
    }

    private void recalculatePeriod(TeacherPayrollPeriod period, Teacher teacher) {
        recalculatePeriod(period, teacher, buildGenerationContext(period.getInstitute().getId(), period.getMonthKey(), List.of(teacher)));
    }

    private void recalculatePeriod(TeacherPayrollPeriod period, Teacher teacher, PayrollGenerationContext context) {
        if ("PAID".equalsIgnoreCase(period.getStatus()) || "VOIDED".equalsIgnoreCase(period.getStatus())) return;
        YearMonth month = YearMonth.parse(period.getMonthKey());
        LocalDate joiningDate = parseDate(teacher.getJoiningDate(), month.atDay(1));
        if (joiningDate.isAfter(month.atEndOfMonth())) {
            period.setAcademicSession(resolveAcademicSession(context, month.atDay(1)));
            period.setBaseSalary(ZERO);
            period.setBonusAmount(ZERO);
            period.setLeaveDeductionAmount(ZERO);
            period.setGrossAmount(ZERO);
            period.setNetPayableAmount(ZERO);
            period.setPaidAmount(ZERO);
            period.setOutstandingAmount(ZERO);
            period.setOpenSchoolDays(0);
            period.setPresentDays(0);
            period.setAbsentDays(0);
            period.setAllowedLeaves(0);
            period.setExtraLeaveDays(0);
            period.setPaidLeaveDays(0);
            period.setUnpaidLeaveDays(0);
            period.setHalfDays(0);
            period.setMissingAttendanceDays(0);
            period.setPerDaySalary(ZERO);
            period.setGeneratedAt(period.getGeneratedAt() == null ? LocalDateTime.now() : period.getGeneratedAt());
            period.setStatus("NOT_ELIGIBLE");
            period.setNote("Teacher joining date is after this payroll month.");
            return;
        }
        LocalDate from = maxDate(month.atDay(1), joiningDate);
        LocalDate to = month.atEndOfMonth();
        period.setAcademicSession(resolveAcademicSession(context, from));

        Set<LocalDate> workingDates = from.datesUntil(to.plusDays(1))
                .filter(date -> date.getDayOfWeek() != DayOfWeek.SUNDAY)
                .filter(date -> !context.teacherHolidayDates().contains(date))
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        List<TeacherAttendanceRecord> attendance = context.attendanceByTeacherId().getOrDefault(teacher.getId(), List.of()).stream()
                .filter(record -> !record.getAttendanceDate().isBefore(from) && !record.getAttendanceDate().isAfter(to))
                .filter(record -> workingDates.contains(record.getAttendanceDate()))
                .toList();

        int openDays = workingDates.size();
        int markedDays = (int) attendance.stream().map(TeacherAttendanceRecord::getAttendanceDate).distinct().count();
        int present = (int) attendance.stream().filter(record -> isAnyStatus(record.getStatus(), "present", "p", "late")).count();
        int absent = (int) attendance.stream().filter(record -> isAnyStatus(record.getStatus(), "absent", "a")).count();
        int paidLeaves = (int) attendance.stream().filter(record -> isAnyStatus(record.getStatus(), "leave", "paid leave", "approved paid leave")).count();
        int unpaidLeaves = (int) attendance.stream().filter(record -> isAnyStatus(record.getStatus(), "unpaid leave", "approved unpaid leave")).count();
        int halfDays = (int) attendance.stream().filter(record -> isAnyStatus(record.getStatus(), "half day", "half_day", "half")).count();
        int missingDays = Math.max(0, openDays - markedDays);
        BigDecimal unpaidDayUnits = BigDecimal.valueOf(absent + unpaidLeaves).add(BigDecimal.valueOf(halfDays).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP));
        BigDecimal base = salaryAmount(context, teacher, from);
        BigDecimal perDay = openDays > 0 ? money(base.divide(BigDecimal.valueOf(openDays), 2, RoundingMode.HALF_UP)) : ZERO;
        BigDecimal deduction = money(perDay.multiply(unpaidDayUnits));
        BigDecimal bonus = money(period.getBonusAmount());
        BigDecimal gross = money(base.add(bonus));
        BigDecimal paid = allocatedToPeriod(period);
        BigDecimal net = gross.subtract(deduction).max(BigDecimal.ZERO);

        period.setBaseSalary(base);
        period.setOpenSchoolDays(openDays);
        period.setPresentDays(present);
        period.setAbsentDays(absent);
        period.setAllowedLeaves(0);
        period.setExtraLeaveDays(unpaidDayUnits.setScale(0, RoundingMode.CEILING).intValue());
        period.setPaidLeaveDays(paidLeaves);
        period.setUnpaidLeaveDays(unpaidLeaves);
        period.setHalfDays(halfDays);
        period.setMissingAttendanceDays(missingDays);
        period.setPerDaySalary(perDay);
        period.setLeaveDeductionAmount(deduction);
        period.setGrossAmount(gross);
        period.setNetPayableAmount(money(net));
        period.setPaidAmount(paid);
        period.setOutstandingAmount(money(net.subtract(paid).max(BigDecimal.ZERO)));
        period.setGeneratedAt(period.getGeneratedAt() == null ? LocalDateTime.now() : period.getGeneratedAt());
        period.setStatus(missingDays > 0 ? "DRAFT" : period.getOutstandingAmount().compareTo(ZERO) <= 0 ? "PAID" : paid.compareTo(ZERO) > 0 ? "PARTIALLY_PAID" : "PENDING");
    }

    private void allocatePayment(Institute institute, Teacher teacher, TeacherSalaryPayment payment, BigDecimal amount, TeacherPayrollPeriod currentPeriod, boolean settlePreviousOutstanding) {
        if (paymentAllocationRepository.existsByInstituteIdAndSalaryPaymentId(institute.getId(), payment.getId())) return;
        BigDecimal remaining = amount;
        List<TeacherPayrollPeriod> periods = settlePreviousOutstanding
                ? payrollPeriodRepository.findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(institute.getId(), teacher.getId()).stream()
                        .filter(period -> period.getMonthKey().compareTo(currentPeriod.getMonthKey()) <= 0)
                        .sorted((a, b) -> a.getMonthKey().compareTo(b.getMonthKey()))
                        .toList()
                : List.of(currentPeriod);
        if (periods.stream().noneMatch(period -> Objects.equals(period.getId(), currentPeriod.getId()))) {
            periods = List.of(currentPeriod);
        }
        for (TeacherPayrollPeriod period : periods) {
            if (remaining.compareTo(ZERO) <= 0) break;
            recalculatePeriod(period, teacher);
            if ("DRAFT".equalsIgnoreCase(period.getStatus())) continue;
            BigDecimal allocationAmount = remaining.min(period.getOutstandingAmount());
            if (allocationAmount.compareTo(ZERO) <= 0) continue;
            SalaryPaymentAllocation allocation = new SalaryPaymentAllocation();
            allocation.setInstitute(institute);
            allocation.setTeacher(teacher);
            allocation.setSalaryPayment(payment);
            allocation.setPayrollPeriod(period);
            allocation.setAmount(allocationAmount);
            paymentAllocationRepository.save(allocation);
            remaining = remaining.subtract(allocationAmount);
            recalculatePeriod(period, teacher);
            payrollPeriodRepository.save(period);
        }
    }

    private void createSalaryNotice(Long instituteId, Teacher teacher, TeacherSalaryPayment payment) {
        try {
            noticeService.upsertSystemNotice(instituteId, "SALARY_PAYMENT", payment.getId(), new NoticePayload(
                    "Salary paid: " + payment.getMonthKey(),
                    "Salary",
                    "Teachers",
                    List.of("All"),
                    null,
                    null,
                    teacher.getId(),
                    "High",
                    LocalDate.now(),
                    LocalDate.now().plusDays(30),
                    "Published",
                    false,
                    buildTeacherName(teacher) + ", your salary of Rs " + money(payment.getTotalAmount()) + " has been marked paid.",
                    "Reference: " + defaultValue(payment.getPaymentReference(), "-")
                            + "\nSalary Month: " + payment.getMonthKey()
                            + "\nPaid Amount: Rs " + money(payment.getTotalAmount())
                            + "\nPaid On: " + payment.getPaidOn()
                            + "\nLeave Deduction: Rs " + money(payment.getLeaveDeductionAmount())
                            + "\nStatus: " + payment.getStatus()
            ));
        } catch (RuntimeException ignored) {
            // Salary payment is financial truth; notice delivery can be retried separately.
        }
    }

    private TeacherSalaryPaymentResponse toPaymentResponse(TeacherSalaryPayment payment) {
        return new TeacherSalaryPaymentResponse(
                payment.getId(),
                payment.getTeacher().getId(),
                payment.getPaymentReference(),
                payment.getMonthKey(),
                money(payment.getBaseSalary()),
                money(payment.getPreviousPendingAmount()),
                money(payment.getBonusAmount()),
                money(payment.getLeaveDeductionAmount()),
                money(payment.getTotalAmount()),
                money(payment.getTotalAmount()),
                payment.getOpenSchoolDays(),
                payment.getPresentDays(),
                payment.getAbsentDays(),
                payment.getAllowedLeaves(),
                payment.getExtraLeaveDays(),
                money(payment.getPerDaySalary()),
                payment.getPaidOn(),
                defaultValue(payment.getStatus(), COMPLETED),
                payment.getIdempotencyKey(),
                payment.getPaymentMode(),
                payment.getTransactionReference(),
                settledMonthKeys(payment),
                payment.getNote(),
                payment.getCreatedAt(),
                payment.getUpdatedAt()
        );
    }

    private List<String> settledMonthKeys(TeacherSalaryPayment payment) {
        if (payment == null || payment.getId() == null || payment.getInstitute() == null) return List.of();
        List<String> monthKeys = paymentAllocationRepository.findSettledMonthKeysByPayment(payment.getInstitute().getId(), payment.getId());
        return monthKeys.stream().filter(StringUtils::hasText).distinct().toList();
    }

    private TeacherPayrollPeriodResponse toPeriodResponse(TeacherPayrollPeriod period) {
        return new TeacherPayrollPeriodResponse(
                period.getId(),
                period.getTeacher().getId(),
                period.getAcademicSession() == null ? null : period.getAcademicSession().getId(),
                buildTeacherName(period.getTeacher()),
                period.getTeacher().getEmployeeId(),
                period.getMonthKey(),
                money(period.getBaseSalary()),
                money(period.getBonusAmount()),
                money(period.getLeaveDeductionAmount()),
                money(period.getGrossAmount()),
                money(period.getNetPayableAmount()),
                money(period.getPaidAmount()),
                money(period.getOutstandingAmount()),
                period.getOpenSchoolDays(),
                period.getPresentDays(),
                period.getAbsentDays(),
                period.getAllowedLeaves(),
                period.getExtraLeaveDays(),
                period.getPaidLeaveDays(),
                period.getUnpaidLeaveDays(),
                period.getHalfDays(),
                period.getMissingAttendanceDays(),
                money(period.getPerDaySalary()),
                defaultValue(period.getStatus(), "DRAFT"),
                period.getNote(),
                period.getCreatedAt(),
                period.getUpdatedAt()
        );
    }

    private TeacherSalaryProfileResponse toProfileResponse(TeacherSalaryProfile profile) {
        if (profile == null) return null;
        return new TeacherSalaryProfileResponse(profile.getId(), money(profile.getBaseSalary()), profile.getEffectiveFrom(), profile.getEffectiveTo(), profile.getStatus());
    }

    private Teacher findTeacher(Long instituteId, Long teacherId) {
        return teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + teacherId));
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private AcademicSession resolveAcademicSession(Long instituteId, LocalDate date) {
        return academicSessionRepository.findAllByInstituteIdOrderByCurrentDescNameDesc(instituteId).stream()
                .filter(session -> (session.getStartDate() == null || !session.getStartDate().isAfter(date))
                        && (session.getEndDate() == null || !session.getEndDate().isBefore(date)))
                .findFirst()
                .or(() -> academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId))
                .orElse(null);
    }

    private AcademicSession resolveAcademicSession(PayrollGenerationContext context, LocalDate date) {
        return context.academicSessions().stream()
                .filter(session -> (session.getStartDate() == null || !session.getStartDate().isAfter(date))
                        && (session.getEndDate() == null || !session.getEndDate().isBefore(date)))
                .findFirst()
                .or(() -> context.academicSessions().stream().filter(AcademicSession::isCurrent).findFirst())
                .orElse(null);
    }

    private BigDecimal previousOutstanding(Long instituteId, Long teacherId, String monthKey) {
        return money(paymentAllocationRepository.sumPreviousOutstanding(instituteId, teacherId, monthKey));
    }

    private BigDecimal allocatedToPeriod(TeacherPayrollPeriod period) {
        if (period.getId() == null) return ZERO;
        return money(paymentAllocationRepository.sumAllocatedToPayrollPeriod(period.getInstitute().getId(), period.getId()));
    }

    private BigDecimal salaryAmount(Institute institute, Teacher teacher, LocalDate payrollDate) {
        TeacherSalaryProfile profile = resolveSalaryProfile(institute, teacher, payrollDate);
        if (profile != null) return money(profile.getBaseSalary());
        return legacySalaryAmount(teacher);
    }

    private BigDecimal salaryAmount(PayrollGenerationContext context, Teacher teacher, LocalDate payrollDate) {
        TeacherSalaryProfile profile = context.profilesByTeacherId().getOrDefault(teacher.getId(), List.of()).stream()
                .filter(candidate -> !candidate.getEffectiveFrom().isAfter(payrollDate)
                        && (candidate.getEffectiveTo() == null || !candidate.getEffectiveTo().isBefore(payrollDate)))
                .max(Comparator.comparing(TeacherSalaryProfile::getEffectiveFrom))
                .orElse(null);
        if (profile != null) return money(profile.getBaseSalary());
        return legacySalaryAmount(teacher);
    }

    private TeacherSalaryProfile resolveSalaryProfile(Institute institute, Teacher teacher, LocalDate payrollDate) {
        List<TeacherSalaryProfile> profiles = salaryProfileRepository.findActiveProfilesForDate(institute.getId(), teacher.getId(), payrollDate);
        if (!profiles.isEmpty()) return profiles.get(0);
        return null;
    }

    private BigDecimal legacySalaryAmount(Teacher teacher) {
        if (teacher.getSalaryAmount() != null) return money(teacher.getSalaryAmount());
        if (StringUtils.hasText(teacher.getSalary())) {
            try {
                return money(new BigDecimal(teacher.getSalary().replace(",", "").trim()));
            } catch (NumberFormatException ignored) {
                return ZERO;
            }
        }
        return ZERO;
    }

    private boolean appliesToTeachers(Holiday holiday) {
        String audience = defaultValue(holiday.getAudience(), "All").toLowerCase();
        return audience.contains("all") || audience.contains("teacher") || audience.contains("staff");
    }

    private boolean isPayrollEligible(Teacher teacher) {
        return !"inactive".equalsIgnoreCase(defaultValue(teacher.getStatus(), "Active"));
    }

    private PayrollGenerationContext buildGenerationContext(Long instituteId, String monthKey, List<Teacher> teachers) {
        YearMonth month = YearMonth.parse(monthKey);
        LocalDate from = month.atDay(1);
        LocalDate to = month.atEndOfMonth();
        Set<Long> teacherIds = teachers.stream().map(Teacher::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, List<TeacherAttendanceRecord>> attendanceByTeacherId = teacherIds.size() == 1
                ? teacherAttendanceRecordRepository
                        .findAllByInstituteIdAndTeacherIdAndAttendanceDateBetween(instituteId, teacherIds.iterator().next(), from, to).stream()
                        .filter(record -> record.getTeacher() != null)
                        .collect(Collectors.groupingBy(record -> record.getTeacher().getId()))
                : teacherAttendanceRecordRepository
                        .findAllByInstituteIdAndAttendanceDateBetween(instituteId, from, to).stream()
                        .filter(record -> record.getTeacher() != null && teacherIds.contains(record.getTeacher().getId()))
                        .collect(Collectors.groupingBy(record -> record.getTeacher().getId()));
        Map<Long, List<TeacherSalaryProfile>> profilesByTeacherId = teacherIds.isEmpty()
                ? Map.of()
                : salaryProfileRepository.findActiveProfilesForTeachersInRange(instituteId, new ArrayList<>(teacherIds), from, to).stream()
                        .collect(Collectors.groupingBy(profile -> profile.getTeacher().getId()));
        Set<LocalDate> teacherHolidayDates = holidayRepository.findAllWithTargetsInRange(instituteId, from, to).stream()
                .filter(this::appliesToTeachers)
                .map(Holiday::getHolidayDate)
                .collect(Collectors.toSet());
        return new PayrollGenerationContext(
                academicSessionRepository.findAllByInstituteIdOrderByCurrentDescNameDesc(instituteId),
                teacherHolidayDates,
                attendanceByTeacherId,
                profilesByTeacherId
        );
    }

    private boolean isAnyStatus(String value, String... statuses) {
        String normalized = defaultValue(value, "").trim().toLowerCase();
        return Arrays.stream(statuses).anyMatch(status -> normalized.equals(status.toLowerCase()));
    }

    private String buildPaymentReference(TeacherSalaryPayment payment) {
        return "SAL-" + payment.getPaidOn().getYear() + "-" + String.format("%06d", payment.getId());
    }

    private LocalDate maxDate(LocalDate first, LocalDate second) {
        return first.isAfter(second) ? first : second;
    }

    private LocalDate parseDate(String value, LocalDate fallback) {
        if (!StringUtils.hasText(value)) return fallback;
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception exception) {
            return fallback;
        }
    }

    private BigDecimal firstPositive(BigDecimal primary, BigDecimal fallback) {
        BigDecimal value = money(primary);
        return value.compareTo(ZERO) > 0 ? value : money(fallback);
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return money(value);
    }

    private String requireMonth(String value) {
        if (!StringUtils.hasText(value)) throw new IllegalArgumentException("INVALID_PAYROLL_MONTH: Salary month is required.");
        YearMonth.parse(value.trim());
        return value.trim();
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private String joinMonthKeys(List<String> values) {
        if (values == null || values.isEmpty()) return "";
        return String.join(",", values.stream().filter(StringUtils::hasText).map(String::trim).distinct().toList());
    }

    private List<String> parseMonthKeys(String value) {
        if (!StringUtils.hasText(value)) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(StringUtils::hasText).toList();
    }

    private String buildTeacherName(Teacher teacher) {
        return defaultValue((defaultValue(teacher.getFirstName(), "") + " " + defaultValue(teacher.getLastName(), "")).trim(), defaultValue(teacher.getName(), "Teacher"));
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private record PayrollGenerationContext(
            List<AcademicSession> academicSessions,
            Set<LocalDate> teacherHolidayDates,
            Map<Long, List<TeacherAttendanceRecord>> attendanceByTeacherId,
            Map<Long, List<TeacherSalaryProfile>> profilesByTeacherId
    ) {}
}
