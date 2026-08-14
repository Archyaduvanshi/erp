package com.erp.backend.fee.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.dto.FeePaymentPayload;
import com.erp.backend.fee.dto.FeePaymentResponse;
import com.erp.backend.fee.dto.FeeStructurePayload;
import com.erp.backend.fee.dto.FeeStructureResponse;
import com.erp.backend.fee.entity.FeePayment;
import com.erp.backend.fee.entity.FeeStructure;
import com.erp.backend.fee.repository.FeePaymentRepository;
import com.erp.backend.fee.repository.FeeStructureRepository;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class FeeService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final FeeStructureRepository feeStructureRepository;
    private final FeePaymentRepository feePaymentRepository;
    private final ObjectMapper objectMapper;

    public FeeService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            FeeStructureRepository feeStructureRepository,
            FeePaymentRepository feePaymentRepository,
            ObjectMapper objectMapper
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.feeStructureRepository = feeStructureRepository;
        this.feePaymentRepository = feePaymentRepository;
        this.objectMapper = objectMapper;
    }

    public List<String> getClasses(Long instituteId) {
        validateInstitute(instituteId);
        TreeSet<String> classes = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .map(this::resolveStudentClass)
                .filter(StringUtils::hasText)
                .forEach(classes::add);
        feeStructureRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .map(FeeStructure::getCourseId)
                .filter(StringUtils::hasText)
                .forEach(classes::add);
        return classes.stream().toList();
    }

    public List<FeeStructureResponse> getStructures(Long instituteId) {
        validateInstitute(instituteId);
        return feeStructureRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(FeeStructure::getCourseId, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(FeeStructure::getFeeComponent, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toStructureResponse)
                .toList();
    }

    @Transactional
    public FeeStructureResponse saveStructure(Long instituteId, FeeStructurePayload request) {
        Institute institute = validateInstitute(instituteId);
        FeeStructure structure = new FeeStructure();
        structure.setInstitute(institute);
        applyStructurePayload(structure, request);
        return toStructureResponse(feeStructureRepository.save(structure));
    }

    @Transactional
    public void deleteStructure(Long instituteId, Long id) {
        FeeStructure structure = feeStructureRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Fee structure not found with id: " + id));
        feeStructureRepository.delete(structure);
    }

    public List<FeePaymentResponse> getPayments(Long instituteId, Long studentId) {
        validateInstitute(instituteId);
        List<FeePayment> payments = studentId == null
                ? feePaymentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                : feePaymentRepository.findAllByInstituteIdAndStudentIdOrderByCreatedAtDesc(instituteId, studentId);
        return payments.stream().map(this::toPaymentResponse).toList();
    }

    @Transactional
    public FeePaymentResponse savePayment(Long instituteId, FeePaymentPayload request) {
        Institute institute = validateInstitute(instituteId);
        studentRepository.findByInstituteIdAndId(instituteId, request.studentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + request.studentId()));

        FeePayment payment = new FeePayment();
        payment.setInstitute(institute);
        applyPaymentPayload(payment, request);
        return toPaymentResponse(feePaymentRepository.save(payment));
    }

    @Transactional
    public void deletePayment(Long instituteId, Long id) {
        FeePayment payment = feePaymentRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Fee payment not found with id: " + id));
        feePaymentRepository.delete(payment);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyStructurePayload(FeeStructure structure, FeeStructurePayload request) {
        structure.setCourseId(request.courseId().trim());
        structure.setCategory(request.category().trim());
        structure.setFeeType(defaultValue(request.feeType(), "college_fee"));
        structure.setFacilityKey(trim(request.facilityKey()));
        structure.setFeeComponent(request.feeComponent().trim());
        structure.setAmount(request.amount());
        structure.setCycleMonths(Math.min(Math.max(request.cycleMonths() == null ? 1 : request.cycleMonths(), 1), 12));
        structure.setBillingType(defaultValue(request.billingType(), "cycle_based"));
        structure.setDueDate(defaultValue(request.dueDate(), LocalDate.now().toString()));
        structure.setActiveFromMonth(trim(request.activeFromMonth()));
        structure.setJoinMonth(trim(request.joinMonth()));
    }

    private void applyPaymentPayload(FeePayment payment, FeePaymentPayload request) {
        payment.setStructureId(request.structureId().trim());
        payment.setStudentId(request.studentId());
        payment.setTransactionId(request.transactionId().trim());
        payment.setGatewayRef(trim(request.gatewayRef()));
        payment.setMode(defaultValue(request.mode(), "UPI"));
        payment.setPaymentStatus(defaultValue(request.paymentStatus(), "Success"));
        payment.setPaymentTarget(defaultValue(request.paymentTarget(), "due_auto"));
        payment.setPaidAmount(request.paidAmount());
        payment.setPaymentDate(defaultValue(request.paymentDate(), LocalDate.now().toString()));
        payment.setCoverageLabel(trim(request.coverageLabel()));
        payment.setActiveFromMonth(trim(request.activeFromMonth()));
        payment.setBilledMonthsCount(request.billedMonthsCount() == null ? 0 : request.billedMonthsCount());
        payment.setBillingType(defaultValue(request.billingType(), "overall_payment"));
        payment.setReceiptNumber(defaultValue(request.receiptNumber(), "FEE-" + LocalDate.now().getYear() + "-" + System.currentTimeMillis() % 1000000));
        payment.setTaxBreakdown(trim(request.taxBreakdown()));
        payment.setBalanceRemaining(request.balanceRemaining() == null ? 0 : request.balanceRemaining());
        payment.setDownloadLink(trim(request.downloadLink()));
        payment.setCoveredMonthsJson(writeJson(request.coveredMonths() == null ? List.of() : request.coveredMonths()));
        payment.setResolvedMonthsJson(writeJson(request.resolvedMonths() == null ? List.of() : request.resolvedMonths()));
        payment.setAllocationsJson(writeJson(request.allocations() == null ? List.of() : request.allocations()));
    }

    private FeeStructureResponse toStructureResponse(FeeStructure structure) {
        return new FeeStructureResponse(
                structure.getId(),
                structure.getCourseId(),
                structure.getCategory(),
                defaultValue(structure.getFeeType(), "college_fee"),
                structure.getFacilityKey(),
                structure.getFeeComponent(),
                structure.getAmount(),
                structure.getCycleMonths(),
                defaultValue(structure.getBillingType(), "cycle_based"),
                structure.getDueDate(),
                structure.getActiveFromMonth(),
                structure.getJoinMonth(),
                structure.getCreatedAt(),
                structure.getUpdatedAt()
        );
    }

    private FeePaymentResponse toPaymentResponse(FeePayment payment) {
        return new FeePaymentResponse(
                payment.getId(),
                payment.getStructureId(),
                payment.getStudentId(),
                payment.getTransactionId(),
                payment.getGatewayRef(),
                defaultValue(payment.getMode(), "UPI"),
                defaultValue(payment.getPaymentStatus(), "Success"),
                defaultValue(payment.getPaymentTarget(), "due_auto"),
                payment.getPaidAmount(),
                payment.getPaymentDate(),
                payment.getCoverageLabel(),
                payment.getActiveFromMonth(),
                payment.getBilledMonthsCount(),
                payment.getBillingType(),
                payment.getReceiptNumber(),
                payment.getTaxBreakdown(),
                payment.getBalanceRemaining(),
                payment.getDownloadLink(),
                readStringList(payment.getCoveredMonthsJson()),
                readStringList(payment.getResolvedMonthsJson()),
                readAllocationList(payment.getAllocationsJson()),
                payment.getCreatedAt(),
                payment.getUpdatedAt()
        );
    }

    private String resolveStudentClass(Student student) {
        if (StringUtils.hasText(student.getAssignedClass())) {
            return student.getAssignedClass().trim();
        }
        String className = trim(student.getClassName());
        String section = trim(student.getSection());
        if (StringUtils.hasText(className) && StringUtils.hasText(section)) {
            return className + " / " + section;
        }
        return StringUtils.hasText(className) ? className : null;
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
}
