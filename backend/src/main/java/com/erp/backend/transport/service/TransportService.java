package com.erp.backend.transport.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.transport.dto.TransportAssignmentPayload;
import com.erp.backend.transport.dto.TransportAssignmentResponse;
import com.erp.backend.transport.dto.TransportAttendanceEntryPayload;
import com.erp.backend.transport.dto.TransportAttendanceResponse;
import com.erp.backend.transport.dto.TransportAttendanceSaveRequest;
import com.erp.backend.transport.dto.TransportDriverPayload;
import com.erp.backend.transport.dto.TransportDriverResponse;
import com.erp.backend.transport.entity.TransportAssignment;
import com.erp.backend.transport.entity.TransportAttendance;
import com.erp.backend.transport.entity.TransportDriver;
import com.erp.backend.transport.repository.TransportAssignmentRepository;
import com.erp.backend.transport.repository.TransportAttendanceRepository;
import com.erp.backend.transport.repository.TransportDriverRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TransportService {
    private static final Pattern INDIAN_DRIVING_LICENSE_PATTERN = Pattern.compile("^[A-Z]{2}\\d{2}\\d{10}$");
    private static final Pattern INDIAN_BUS_NUMBER_PATTERN = Pattern.compile("^[A-Z]{2}\\d{2}[A-Z]{2}\\d{4}$");

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final TransportDriverRepository transportDriverRepository;
    private final TransportAssignmentRepository transportAssignmentRepository;
    private final TransportAttendanceRepository transportAttendanceRepository;

    public TransportService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            TransportDriverRepository transportDriverRepository,
            TransportAssignmentRepository transportAssignmentRepository,
            TransportAttendanceRepository transportAttendanceRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.transportDriverRepository = transportDriverRepository;
        this.transportAssignmentRepository = transportAssignmentRepository;
        this.transportAttendanceRepository = transportAttendanceRepository;
    }

    public List<TransportDriverResponse> getDrivers(Long instituteId) {
        validateInstitute(instituteId);
        return transportDriverRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .map(this::toDriverResponse)
                .toList();
    }

    @Transactional
    public TransportDriverResponse saveDriver(Long instituteId, TransportDriverPayload request) {
        Institute institute = validateInstitute(instituteId);
        TransportDriver driver = new TransportDriver();
        driver.setInstitute(institute);
        applyDriverPayload(driver, request);
        return toDriverResponse(transportDriverRepository.save(driver));
    }

    @Transactional
    public void deleteDriver(Long instituteId, Long driverId) {
        TransportDriver driver = findDriver(instituteId, driverId);
        List<TransportAssignment> assignments = transportAssignmentRepository.findAllByInstituteIdAndDriverId(instituteId, driverId);
        assignments.forEach(assignment -> {
            assignment.setDriver(null);
            markStudentTransportStatus(assignment.getStudent(), false);
        });
        transportAssignmentRepository.saveAll(assignments);
        transportDriverRepository.delete(driver);
    }

    public List<TransportAssignmentResponse> getAssignments(Long instituteId) {
        validateInstitute(instituteId);
        return transportAssignmentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing((TransportAssignment assignment) -> assignment.getStudent().getAssignedClass(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(assignment -> assignment.getStudent().getFirstName(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(assignment -> assignment.getStudent().getLastName(), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toAssignmentResponse)
                .toList();
    }

    @Transactional
    public TransportAssignmentResponse saveAssignment(Long instituteId, TransportAssignmentPayload request) {
        Institute institute = validateInstitute(instituteId);
        Student student = findStudent(instituteId, request.studentId());
        TransportAssignment assignment = transportAssignmentRepository.findByInstituteIdAndStudentId(instituteId, request.studentId())
                .orElseGet(() -> {
                    TransportAssignment newAssignment = new TransportAssignment();
                    newAssignment.setInstitute(institute);
                    newAssignment.setStudent(student);
                    return newAssignment;
                });

        TransportDriver driver = null;
        if (request.assignedDriverId() != null) {
            driver = findDriver(instituteId, request.assignedDriverId());
        }

        assignment.setDriver(driver);
        assignment.setPickupStop(trim(request.pickupStop()));

        TransportAssignment savedAssignment = transportAssignmentRepository.save(assignment);
        markStudentTransportRequested(student);
        markStudentTransportStatus(student, driver != null);
        studentRepository.save(student);
        return toAssignmentResponse(savedAssignment);
    }

    @Transactional
    public void deleteAssignment(Long instituteId, Long assignmentId) {
        TransportAssignment assignment = transportAssignmentRepository.findByInstituteIdAndId(instituteId, assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport assignment not found with id: " + assignmentId));
        markStudentTransportRequested(assignment.getStudent());
        markStudentTransportStatus(assignment.getStudent(), false);
        studentRepository.save(assignment.getStudent());
        transportAssignmentRepository.delete(assignment);
    }

    public List<TransportAttendanceResponse> getAttendance(Long instituteId, Long driverId) {
        validateInstitute(instituteId);
        List<TransportAttendance> records = driverId == null
                ? transportAttendanceRepository.findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(instituteId)
                : transportAttendanceRepository.findAllByInstituteIdAndDriverIdOrderByAttendanceDateDescCreatedAtDesc(instituteId, driverId);
        return records.stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional
    public List<TransportAttendanceResponse> saveAttendance(Long instituteId, TransportAttendanceSaveRequest request) {
        validateInstitute(instituteId);
        TransportDriver driver = findDriver(instituteId, request.driverId());
        LocalDate attendanceDate = LocalDate.parse(request.date().trim());
        List<TransportAssignment> assignments = transportAssignmentRepository.findAllByInstituteIdAndDriverId(instituteId, request.driverId());

        List<Long> assignedStudentIds = assignments.stream()
                .map(assignment -> assignment.getStudent().getId())
                .toList();

        List<TransportAttendance> existing = transportAttendanceRepository
                .findAllByInstituteIdAndDriverIdAndAttendanceDate(instituteId, request.driverId(), attendanceDate);
        transportAttendanceRepository.deleteAll(existing);

        List<TransportAttendance> records = request.entries().stream()
                .map(entry -> createAttendanceRecord(instituteId, driver, attendanceDate, entry, assignments, assignedStudentIds, request.markedBy()))
                .toList();

        return transportAttendanceRepository.saveAll(records)
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    private TransportAttendance createAttendanceRecord(
            Long instituteId,
            TransportDriver driver,
            LocalDate attendanceDate,
            TransportAttendanceEntryPayload entry,
            List<TransportAssignment> assignments,
            List<Long> assignedStudentIds,
            String markedBy
    ) {
        if (!assignedStudentIds.contains(entry.studentId())) {
            throw new IllegalArgumentException("Student " + entry.studentId() + " is not assigned to the selected driver.");
        }

        Student student = findStudent(instituteId, entry.studentId());
        assignments.stream()
                .filter(candidate -> candidate.getStudent().getId().equals(entry.studentId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Transport assignment not found for student " + entry.studentId()));

        TransportAttendance attendance = new TransportAttendance();
        attendance.setInstitute(driver.getInstitute());
        attendance.setDriver(driver);
        attendance.setStudent(student);
        attendance.setAttendanceDate(attendanceDate);
        attendance.setStatus(defaultValue(entry.status(), "Absent"));
        attendance.setMarkedBy(defaultValue(markedBy, driver.getDriverName()));
        attendance.setNotes(trim(entry.notes()));
        return attendance;
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private TransportDriver findDriver(Long instituteId, Long driverId) {
        return transportDriverRepository.findByInstituteIdAndId(instituteId, driverId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport driver not found with id: " + driverId));
    }

    private void applyDriverPayload(TransportDriver driver, TransportDriverPayload request) {
        driver.setDriverName(defaultValue(request.driverName(), "Driver"));
        driver.setDriverPhone(trim(request.driverPhone()));
        driver.setDriverLicense(normalizeDrivingLicense(request.driverLicense()));
        driver.setSalary(parseSalary(request.salary()));
        driver.setBusNumber(normalizeBusNumber(request.busNumber()));
        driver.setRouteName(trim(request.routeName()));
        driver.setRouteCode(resolveRouteCode(request));
        driver.setVehicleType(defaultValue(request.vehicleType(), "School Bus"));
        driver.setSeatCapacity(request.seatCapacity());
        driver.setPickupPoints(trim(request.pickupPoints()));
        driver.setStatus(defaultValue(request.status(), "Active"));
    }

    private TransportDriverResponse toDriverResponse(TransportDriver driver) {
        return new TransportDriverResponse(
                driver.getId(),
                driver.getDriverName(),
                driver.getDriverPhone(),
                driver.getDriverLicense(),
                driver.getSalary() == null ? null : driver.getSalary().toPlainString(),
                driver.getBusNumber(),
                driver.getRouteName(),
                driver.getRouteCode(),
                driver.getVehicleType(),
                driver.getSeatCapacity(),
                driver.getPickupPoints(),
                defaultValue(driver.getStatus(), "Active"),
                driver.getCreatedAt(),
                driver.getUpdatedAt()
        );
    }

    private TransportAssignmentResponse toAssignmentResponse(TransportAssignment assignment) {
        Student student = assignment.getStudent();
        TransportDriver driver = assignment.getDriver();
        return new TransportAssignmentResponse(
                assignment.getId(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(student.getAssignedClass(), student.getClassName()),
                assignment.getPickupStop(),
                driver == null ? null : driver.getId(),
                driver == null ? "" : driver.getDriverName(),
                driver == null ? "" : driver.getDriverPhone(),
                driver == null ? "" : driver.getBusNumber(),
                driver == null ? "" : driver.getRouteName(),
                assignment.getCreatedAt(),
                assignment.getUpdatedAt()
        );
    }

    private TransportAttendanceResponse toAttendanceResponse(TransportAttendance attendance) {
        Student student = attendance.getStudent();
        TransportDriver driver = attendance.getDriver();
        return new TransportAttendanceResponse(
                attendance.getId(),
                attendance.getAttendanceDate().toString(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(student.getAssignedClass(), student.getClassName()),
                driver.getId(),
                driver.getDriverName(),
                driver.getBusNumber(),
                driver.getRouteName(),
                resolvePickupStop(student.getId(), driver.getId(), student.getInstitute().getId()),
                defaultValue(attendance.getStatus(), "Absent"),
                attendance.getMarkedBy(),
                attendance.getNotes(),
                attendance.getCreatedAt(),
                attendance.getUpdatedAt()
        );
    }

    private String resolvePickupStop(Long studentId, Long driverId, Long instituteId) {
        return transportAssignmentRepository.findByInstituteIdAndStudentId(instituteId, studentId)
                .filter(assignment -> assignment.getDriver() != null && assignment.getDriver().getId().equals(driverId))
                .map(TransportAssignment::getPickupStop)
                .orElse(null);
    }

    private void markStudentTransportRequested(Student student) {
        student.setTransportOptIn("yes");
    }

    private void markStudentTransportStatus(Student student, boolean active) {
        student.setTransportStatus(active ? "active" : "inactive");
    }

    private BigDecimal parseSalary(String salary) {
        if (!StringUtils.hasText(salary)) {
            return null;
        }

        try {
            return new BigDecimal(salary.trim());
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("Salary must be a valid number.");
        }
    }

    private String resolveRouteCode(TransportDriverPayload request) {
        if (StringUtils.hasText(request.routeCode())) {
            return request.routeCode().trim();
        }

        if (!StringUtils.hasText(request.routeName())) {
            return null;
        }

        return "ROUTE-" + request.routeName().trim().replaceAll("\\s+", "-").toUpperCase();
    }

    private String normalizeDrivingLicense(String drivingLicense) {
        if (!StringUtils.hasText(drivingLicense)) {
            return null;
        }

        String normalized = drivingLicense.trim().toUpperCase().replaceAll("[\\s-]+", "");
        if (!INDIAN_DRIVING_LICENSE_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("License number must be in the format SS-YY-XXXXXXXXXX, for example DL-01-1234567890.");
        }

        return normalized.substring(0, 2)
                + "-"
                + normalized.substring(2, 4)
                + "-"
                + normalized.substring(4);
    }

    private String normalizeBusNumber(String busNumber) {
        if (!StringUtils.hasText(busNumber)) {
            return null;
        }

        String normalized = busNumber.trim().toUpperCase().replaceAll("[\\s-]+", "");
        if (!INDIAN_BUS_NUMBER_PATTERN.matcher(normalized).matches()) {
            throw new IllegalArgumentException("Bus number must be in the format SS XX YY ZZZZ, for example UP 16 AB 1234.");
        }

        return normalized.substring(0, 2)
                + " "
                + normalized.substring(2, 4)
                + " "
                + normalized.substring(4, 6)
                + " "
                + normalized.substring(6);
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String primary, String fallback) {
        if (StringUtils.hasText(primary)) {
            return primary.trim();
        }
        return StringUtils.hasText(fallback) ? fallback.trim() : null;
    }
}
