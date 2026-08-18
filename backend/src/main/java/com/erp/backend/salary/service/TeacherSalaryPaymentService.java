package com.erp.backend.salary.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.salary.dto.TeacherSalaryPaymentPayload;
import com.erp.backend.salary.dto.TeacherSalaryPaymentResponse;
import com.erp.backend.salary.entity.TeacherSalaryPayment;
import com.erp.backend.salary.repository.TeacherSalaryPaymentRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TeacherSalaryPaymentService {

    private final InstituteRepository instituteRepository;
    private final TeacherRepository teacherRepository;
    private final TeacherSalaryPaymentRepository salaryPaymentRepository;

    public TeacherSalaryPaymentService(
            InstituteRepository instituteRepository,
            TeacherRepository teacherRepository,
            TeacherSalaryPaymentRepository salaryPaymentRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.teacherRepository = teacherRepository;
        this.salaryPaymentRepository = salaryPaymentRepository;
    }

    public List<TeacherSalaryPaymentResponse> getPayments(Long instituteId, Long teacherId) {
        validateInstitute(instituteId);
        List<TeacherSalaryPayment> payments = teacherId == null
                ? salaryPaymentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                : salaryPaymentRepository.findAllByInstituteIdAndTeacherIdOrderByMonthKeyDesc(instituteId, teacherId);
        return payments.stream().map(this::toResponse).toList();
    }

    @Transactional
    public TeacherSalaryPaymentResponse savePayment(Long instituteId, TeacherSalaryPaymentPayload request) {
        Institute institute = validateInstitute(instituteId);
        Teacher teacher = teacherRepository.findByInstituteIdAndId(instituteId, request.teacherId())
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found with id: " + request.teacherId()));
        TeacherSalaryPayment payment = salaryPaymentRepository
                .findByInstituteIdAndTeacherIdAndMonthKey(instituteId, request.teacherId(), request.monthKey().trim())
                .orElseGet(TeacherSalaryPayment::new);

        payment.setInstitute(institute);
        payment.setTeacher(teacher);
        applyPayload(payment, request);
        return toResponse(salaryPaymentRepository.save(payment));
    }

    private void applyPayload(TeacherSalaryPayment payment, TeacherSalaryPaymentPayload request) {
        payment.setMonthKey(request.monthKey().trim());
        payment.setBaseSalary(defaultAmount(request.baseSalary()));
        payment.setPreviousPendingAmount(defaultAmount(request.previousPendingAmount()));
        payment.setBonusAmount(defaultAmount(request.bonusAmount()));
        payment.setLeaveDeductionAmount(defaultAmount(request.leaveDeductionAmount()));
        payment.setTotalAmount(defaultAmount(request.totalAmount()));
        payment.setOpenSchoolDays(defaultNumber(request.openSchoolDays()));
        payment.setPresentDays(defaultNumber(request.presentDays()));
        payment.setAbsentDays(defaultNumber(request.absentDays()));
        payment.setAllowedLeaves(defaultNumber(request.allowedLeaves()));
        payment.setExtraLeaveDays(defaultNumber(request.extraLeaveDays()));
        payment.setPerDaySalary(defaultAmount(request.perDaySalary()));
        payment.setPaidOn(StringUtils.hasText(request.paidOn()) ? request.paidOn().trim() : LocalDate.now().toString());
        payment.setSettledMonthKeys(joinMonthKeys(request.settledMonthKeys()));
        payment.setNote(trim(request.note()));
    }

    private TeacherSalaryPaymentResponse toResponse(TeacherSalaryPayment payment) {
        return new TeacherSalaryPaymentResponse(
                payment.getId(),
                payment.getTeacher().getId(),
                payment.getMonthKey(),
                payment.getBaseSalary(),
                payment.getPreviousPendingAmount(),
                payment.getBonusAmount(),
                payment.getLeaveDeductionAmount(),
                payment.getTotalAmount(),
                payment.getTotalAmount(),
                payment.getOpenSchoolDays(),
                payment.getPresentDays(),
                payment.getAbsentDays(),
                payment.getAllowedLeaves(),
                payment.getExtraLeaveDays(),
                payment.getPerDaySalary(),
                payment.getPaidOn(),
                parseMonthKeys(payment.getSettledMonthKeys()),
                payment.getNote(),
                payment.getCreatedAt(),
                payment.getUpdatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private Integer defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String joinMonthKeys(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }
        return String.join(",", values.stream().filter(StringUtils::hasText).map(String::trim).distinct().toList());
    }

    private List<String> parseMonthKeys(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim).filter(StringUtils::hasText).toList();
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }
}
