package com.erp.backend.transport.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.fee.service.FeeService;
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
import com.erp.backend.transport.dto.TransportOverviewResponse;
import com.erp.backend.transport.dto.TransportRouteOperationResponse;
import com.erp.backend.transport.dto.TransportRouteStopResponse;
import com.erp.backend.transport.dto.TransportStudentLookupResponse;
import com.erp.backend.transport.entity.TransportAssignment;
import com.erp.backend.transport.entity.TransportAttendance;
import com.erp.backend.transport.entity.TransportDriver;
import com.erp.backend.transport.entity.TransportRoute;
import com.erp.backend.transport.entity.TransportRouteOperation;
import com.erp.backend.transport.entity.TransportRouteStop;
import com.erp.backend.transport.entity.TransportVehicle;
import com.erp.backend.transport.repository.TransportAssignmentRepository;
import com.erp.backend.transport.repository.TransportAttendanceRepository;
import com.erp.backend.transport.repository.TransportDriverRepository;
import com.erp.backend.transport.repository.TransportRouteOperationRepository;
import com.erp.backend.transport.repository.TransportRouteRepository;
import com.erp.backend.transport.repository.TransportRouteStopRepository;
import com.erp.backend.transport.repository.TransportVehicleRepository;
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
    private final AcademicSessionRepository academicSessionRepository;
    private final TransportVehicleRepository transportVehicleRepository;
    private final TransportRouteRepository transportRouteRepository;
    private final TransportRouteStopRepository transportRouteStopRepository;
    private final TransportRouteOperationRepository transportRouteOperationRepository;
    private final FeeService feeService;

    public TransportService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            TransportDriverRepository transportDriverRepository,
            TransportAssignmentRepository transportAssignmentRepository,
            TransportAttendanceRepository transportAttendanceRepository,
            AcademicSessionRepository academicSessionRepository,
            TransportVehicleRepository transportVehicleRepository,
            TransportRouteRepository transportRouteRepository,
            TransportRouteStopRepository transportRouteStopRepository,
            TransportRouteOperationRepository transportRouteOperationRepository,
            FeeService feeService
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.transportDriverRepository = transportDriverRepository;
        this.transportAssignmentRepository = transportAssignmentRepository;
        this.transportAttendanceRepository = transportAttendanceRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.transportVehicleRepository = transportVehicleRepository;
        this.transportRouteRepository = transportRouteRepository;
        this.transportRouteStopRepository = transportRouteStopRepository;
        this.transportRouteOperationRepository = transportRouteOperationRepository;
        this.feeService = feeService;
    }

    @Transactional(readOnly = true)
    public List<TransportDriverResponse> getDrivers(Long instituteId) {
        validateInstitute(instituteId);
        return transportDriverRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .filter(driver -> !"ARCHIVED".equalsIgnoreCase(defaultValue(driver.getStatus(), "")))
                .map(this::toDriverResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TransportOverviewResponse getOverview(Long instituteId, String dateValue) {
        validateInstitute(instituteId);
        LocalDate date = StringUtils.hasText(dateValue) ? LocalDate.parse(dateValue.trim()) : LocalDate.now();
        return new TransportOverviewResponse(
                transportDriverRepository.countByInstituteIdAndStatusIgnoreCase(instituteId, "Active"),
                transportDriverRepository.countActiveVehicles(instituteId),
                transportDriverRepository.countActiveRoutes(instituteId),
                transportAssignmentRepository.countByInstituteIdAndDriverIsNotNull(instituteId),
                transportAttendanceRepository.countByInstituteIdAndAttendanceDateAndStatusIgnoreCase(instituteId, date, "Present"),
                transportAttendanceRepository.countByInstituteIdAndAttendanceDateAndStatusIgnoreCase(instituteId, date, "Absent")
        );
    }

    @Transactional(readOnly = true)
    public List<TransportRouteOperationResponse> getRouteOperations(Long instituteId, Long academicSessionId, String dateValue) {
        validateInstitute(instituteId);
        LocalDate date = StringUtils.hasText(dateValue) ? LocalDate.parse(dateValue.trim()) : LocalDate.now();
        Long sessionId = resolveAcademicSession(instituteId, academicSessionId).map(AcademicSession::getId).orElse(null);
        Map<Long, Long> assignedCountsByRoute = sessionId == null
                ? Map.of()
                : transportAssignmentRepository.countActiveAssignmentsByRoute(instituteId, sessionId)
                        .stream()
                        .collect(Collectors.toMap(
                                row -> (Long) row[0],
                                row -> (Long) row[1]
                        ));
        return transportRouteOperationRepository.findActiveOperations(instituteId, date)
                .stream()
                .map(operation -> toRouteOperationResponse(assignedCountsByRoute, operation))
                .toList();
    }

    @Transactional
    public TransportDriverResponse saveDriver(Long instituteId, TransportDriverPayload request) {
        Institute institute = validateInstitute(instituteId);
        TransportDriver driver = new TransportDriver();
        driver.setInstitute(institute);
        applyDriverPayload(driver, request);
        TransportDriver savedDriver = transportDriverRepository.save(driver);
        ensureRouteOperation(institute, savedDriver, request);
        return toDriverResponse(savedDriver);
    }

    @Transactional
    public void deleteDriver(Long instituteId, Long driverId) {
        updateDriverStatus(instituteId, driverId, "ARCHIVED");
    }

    @Transactional
    public TransportDriverResponse updateDriverStatus(Long instituteId, Long driverId, String statusValue) {
        TransportDriver driver = findDriver(instituteId, driverId);
        String status = normalizeDriverStatus(statusValue);
        driver.setStatus(status);
        transportRouteOperationRepository.findActiveByDriver(instituteId, driverId, LocalDate.now()).ifPresent(operation -> {
            operation.setStatus(status);
            if ("ARCHIVED".equals(status) || "INACTIVE".equals(status)) {
                operation.setEffectiveTo(LocalDate.now());
            }
            transportRouteOperationRepository.save(operation);
        });
        return toDriverResponse(transportDriverRepository.save(driver));
    }

    @Transactional(readOnly = true)
    public List<TransportAssignmentResponse> getAssignments(Long instituteId, Long academicSessionId) {
        validateInstitute(instituteId);
        Long sessionId = resolveAcademicSession(instituteId, academicSessionId).map(AcademicSession::getId).orElse(null);
        return transportAssignmentRepository.findAllWithStudentAndDriver(instituteId, sessionId)
                .stream()
                .sorted(Comparator.comparing((TransportAssignment assignment) -> assignment.getStudent().getAssignedClass(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(assignment -> assignment.getStudent().getFirstName(), Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(assignment -> assignment.getStudent().getLastName(), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toAssignmentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAssignmentResponse> getDriverAssignments(Long instituteId, Long driverId, Long academicSessionId) {
        findDriver(instituteId, driverId);
        Long sessionId = resolveAcademicSession(instituteId, academicSessionId).map(AcademicSession::getId).orElse(null);
        TransportRouteOperation operation = transportRouteOperationRepository.findActiveByDriver(instituteId, driverId, LocalDate.now()).orElse(null);
        if (operation != null) {
            return getRouteAssignments(instituteId, operation.getRoute().getId(), academicSessionId);
        }
        return transportAssignmentRepository.findAllByInstituteIdAndDriverId(instituteId, driverId, sessionId)
                .stream()
                .map(this::toAssignmentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAssignmentResponse> getRouteAssignments(Long instituteId, Long routeId, Long academicSessionId) {
        findRoute(instituteId, routeId);
        Long sessionId = resolveAcademicSession(instituteId, academicSessionId).map(AcademicSession::getId).orElse(null);
        return transportAssignmentRepository.findAllByInstituteIdAndRouteId(instituteId, routeId, sessionId)
                .stream()
                .map(this::toAssignmentResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TransportStudentLookupResponse lookupStudent(Long instituteId, String enrollmentNo) {
        validateInstitute(instituteId);
        if (!StringUtils.hasText(enrollmentNo)) {
            throw new IllegalArgumentException("Enrollment number is required.");
        }
        Student student = studentRepository.findByInstituteIdAndEnrollmentNoIgnoreCase(instituteId, enrollmentNo.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with enrollment number: " + enrollmentNo));
        return toStudentLookupResponse(student);
    }

    @Transactional(readOnly = true)
    public Optional<TransportAssignmentResponse> getStudentAssignment(Long instituteId, Long studentId, Long academicSessionId) {
        findStudent(instituteId, studentId);
        Long sessionId = resolveAcademicSession(instituteId, academicSessionId).map(AcademicSession::getId).orElse(null);
        return transportAssignmentRepository.findStudentAssignment(instituteId, studentId, sessionId)
                .map(this::toAssignmentResponse);
    }

    @Transactional
    public TransportAssignmentResponse saveAssignment(Long instituteId, TransportAssignmentPayload request) {
        Institute institute = validateInstitute(instituteId);
        Student student = findStudent(instituteId, request.studentId());
        AcademicSession academicSession = resolveAcademicSession(instituteId, request.academicSessionId())
                .orElseThrow(() -> new ResourceNotFoundException("Academic session is required before assigning transport."));
        TransportAssignment assignment = transportAssignmentRepository
                .findByInstituteIdAndAcademicSessionIdAndStudentId(instituteId, academicSession.getId(), request.studentId())
                .orElseGet(() -> {
                    TransportAssignment newAssignment = new TransportAssignment();
                    newAssignment.setInstitute(institute);
                    newAssignment.setStudent(student);
                    newAssignment.setAcademicSession(academicSession);
                    return newAssignment;
        });

        TransportDriver driver = null;
        TransportRoute route = null;
        TransportRouteStop pickupStopRef = null;
        TransportRouteOperation operation = null;
        if (request.routeId() != null) {
            route = findRoute(instituteId, request.routeId());
            Long routeId = route.getId();
            operation = transportRouteOperationRepository
                    .findActiveByRouteForUpdate(instituteId, routeId, LocalDate.now())
                    .orElseThrow(() -> new ResourceNotFoundException("Active transport route operation not found for route: " + routeId));
            driver = operation.getDriver();
            validateRouteCapacity(instituteId, academicSession.getId(), route.getId(), assignment.getId(), operation.getVehicle());
        } else if (request.assignedDriverId() != null) {
            driver = findDriver(instituteId, request.assignedDriverId());
            operation = transportRouteOperationRepository
                    .findActiveByDriver(instituteId, driver.getId(), LocalDate.now())
                    .orElse(null);
            if (operation != null) {
                route = operation.getRoute();
                driver = operation.getDriver();
                validateRouteCapacity(instituteId, academicSession.getId(), route.getId(), assignment.getId(), operation.getVehicle());
            }
        }
        if (request.pickupStopId() != null) {
            pickupStopRef = findRouteStop(instituteId, request.pickupStopId());
            if (route != null && !pickupStopRef.getRoute().getId().equals(route.getId())) {
                throw new IllegalArgumentException("Pickup stop does not belong to the selected route.");
            }
        }

        assignment.setAcademicSession(academicSession);
        assignment.setDriver(driver);
        assignment.setRoute(route);
        assignment.setPickupStopRef(pickupStopRef);
        assignment.setPickupStop(firstNonBlank(pickupStopRef == null ? null : pickupStopRef.getStopName(), request.pickupStop()));
        assignment.setStatus(driver == null && route == null ? "INACTIVE" : "ACTIVE");

        TransportAssignment savedAssignment = transportAssignmentRepository.save(assignment);
        markStudentTransportRequested(student);
        markStudentTransportStatus(student, driver != null);
        studentRepository.save(student);
        feeService.synchronizeChargesForStudent(instituteId, student.getId());
        return toAssignmentResponse(savedAssignment);
    }

    @Transactional
    public void deleteAssignment(Long instituteId, Long assignmentId) {
        TransportAssignment assignment = transportAssignmentRepository.findByInstituteIdAndId(instituteId, assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport assignment not found with id: " + assignmentId));
        markStudentTransportRequested(assignment.getStudent());
        markStudentTransportStatus(assignment.getStudent(), false);
        studentRepository.save(assignment.getStudent());
        assignment.setStatus("INACTIVE");
        transportAssignmentRepository.save(assignment);
    }

    @Transactional(readOnly = true)
    @Deprecated
    public List<TransportAttendanceResponse> getAttendance(Long instituteId, Long driverId) {
        validateInstitute(instituteId);
        List<TransportAttendance> records = driverId == null
                ? transportAttendanceRepository.findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(instituteId)
                : transportAttendanceRepository.findAllByInstituteIdAndDriverIdOrderByAttendanceDateDescCreatedAtDesc(instituteId, driverId);
        return records.stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAttendanceResponse> getDailyAttendance(Long instituteId, Long driverId, String dateValue) {
        validateInstitute(instituteId);
        findDriver(instituteId, driverId);
        LocalDate attendanceDate = LocalDate.parse(dateValue.trim());
        TransportRouteOperation operation = transportRouteOperationRepository.findActiveByDriver(instituteId, driverId, attendanceDate).orElse(null);
        if (operation != null) {
            return getRouteDailyAttendance(instituteId, operation.getRoute().getId(), dateValue);
        }
        return transportAttendanceRepository.findDayWithStudentAndDriver(instituteId, driverId, attendanceDate)
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAttendanceResponse> getMonthlyAttendance(Long instituteId, Long driverId, String monthValue) {
        validateInstitute(instituteId);
        findDriver(instituteId, driverId);
        YearMonth month = YearMonth.parse(monthValue.trim());
        TransportRouteOperation operation = transportRouteOperationRepository.findActiveByDriver(instituteId, driverId, month.atDay(1)).orElse(null);
        if (operation != null) {
            return getRouteMonthlyAttendance(instituteId, operation.getRoute().getId(), monthValue);
        }
        return transportAttendanceRepository.findMonthWithStudentAndDriver(instituteId, driverId, month.atDay(1), month.atEndOfMonth())
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAttendanceResponse> getRouteDailyAttendance(Long instituteId, Long routeId, String dateValue) {
        validateInstitute(instituteId);
        findRoute(instituteId, routeId);
        LocalDate attendanceDate = LocalDate.parse(dateValue.trim());
        return transportAttendanceRepository.findDayWithStudentAndRoute(instituteId, routeId, attendanceDate)
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAttendanceResponse> getRouteMonthlyAttendance(Long instituteId, Long routeId, String monthValue) {
        validateInstitute(instituteId);
        findRoute(instituteId, routeId);
        YearMonth month = YearMonth.parse(monthValue.trim());
        return transportAttendanceRepository.findMonthWithStudentAndRoute(instituteId, routeId, month.atDay(1), month.atEndOfMonth())
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransportAttendanceResponse> getStudentMonthlyAttendance(Long instituteId, Long studentId, String monthValue) {
        findStudent(instituteId, studentId);
        YearMonth month = YearMonth.parse(monthValue.trim());
        return transportAttendanceRepository.findStudentMonthWithDriver(instituteId, studentId, month.atDay(1), month.atEndOfMonth())
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    @Transactional
    public List<TransportAttendanceResponse> saveAttendance(Long instituteId, Long markedByUserId, TransportAttendanceSaveRequest request) {
        validateInstitute(instituteId);
        TransportDriver driver = findDriver(instituteId, request.driverId());
        LocalDate attendanceDate = LocalDate.parse(request.date().trim());
        TransportRouteOperation operation = request.routeId() == null
                ? transportRouteOperationRepository.findActiveByDriver(instituteId, request.driverId(), attendanceDate).orElse(null)
                : transportRouteOperationRepository.findActiveByRouteForUpdate(instituteId, request.routeId(), attendanceDate).orElse(null);
        Long sessionId = resolveAcademicSessionForDate(instituteId, request.academicSessionId(), attendanceDate)
                .map(AcademicSession::getId)
                .orElse(null);
        List<TransportAssignment> assignments = operation == null
                ? transportAssignmentRepository.findAllByInstituteIdAndDriverId(instituteId, request.driverId(), sessionId)
                : transportAssignmentRepository.findAllByInstituteIdAndRouteId(instituteId, operation.getRoute().getId(), sessionId);

        Map<Long, TransportAssignment> assignmentsByStudentId = assignments.stream()
                .collect(Collectors.toMap(
                        assignment -> assignment.getStudent().getId(),
                        assignment -> assignment,
                        (existing, ignored) -> existing
                ));

        List<TransportAttendance> existing = operation == null
                ? transportAttendanceRepository.findAllByInstituteIdAndDriverIdAndAttendanceDate(instituteId, request.driverId(), attendanceDate)
                : transportAttendanceRepository.findAllByInstituteIdAndRouteIdAndAttendanceDate(instituteId, operation.getRoute().getId(), attendanceDate);
        transportAttendanceRepository.deleteAll(existing);

        List<TransportAttendance> records = request.entries().stream()
                .map(entry -> createAttendanceRecord(driver, operation, attendanceDate, entry, assignmentsByStudentId, request.markedBy(), markedByUserId))
                .toList();

        return transportAttendanceRepository.saveAll(records)
                .stream()
                .map(this::toAttendanceResponse)
                .toList();
    }

    private TransportAttendance createAttendanceRecord(
            TransportDriver driver,
            TransportRouteOperation operation,
            LocalDate attendanceDate,
            TransportAttendanceEntryPayload entry,
            Map<Long, TransportAssignment> assignmentsByStudentId,
            String markedBy,
            Long markedByUserId
    ) {
        TransportAssignment assignment = assignmentsByStudentId.get(entry.studentId());
        if (assignment == null) {
            throw new IllegalArgumentException("Student " + entry.studentId() + " is not assigned to the selected driver.");
        }
        Student student = assignment.getStudent();

        TransportAttendance attendance = new TransportAttendance();
        attendance.setInstitute(driver.getInstitute());
        attendance.setDriver(driver);
        attendance.setRoute(operation == null ? assignment.getRoute() : operation.getRoute());
        attendance.setRouteOperation(operation);
        attendance.setStudent(student);
        attendance.setAttendanceDate(attendanceDate);
        attendance.setStatus(normalizeAttendanceStatus(entry.status()));
        attendance.setMarkedBy(defaultValue(markedBy, driver.getDriverName()));
        attendance.setMarkedByUserId(markedByUserId);
        attendance.setPickupStopSnapshot(assignment.getPickupStop());
        attendance.setRouteNameSnapshot(operation == null ? driver.getRouteName() : operation.getRoute().getRouteName());
        attendance.setBusNumberSnapshot(operation == null ? driver.getBusNumber() : operation.getVehicle().getBusNumber());
        attendance.setDriverNameSnapshot(operation == null ? driver.getDriverName() : operation.getDriver().getDriverName());
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

    private TransportRoute findRoute(Long instituteId, Long routeId) {
        return transportRouteRepository.findByInstituteIdAndId(instituteId, routeId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport route not found with id: " + routeId));
    }

    private TransportRouteStop findRouteStop(Long instituteId, Long stopId) {
        return transportRouteStopRepository.findByRouteInstituteIdAndId(instituteId, stopId)
                .orElseThrow(() -> new ResourceNotFoundException("Transport route stop not found with id: " + stopId));
    }

    private Optional<AcademicSession> resolveAcademicSession(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            return Optional.of(academicSessionRepository.findByInstituteIdAndId(instituteId, academicSessionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Academic session not found with id: " + academicSessionId)));
        }
        return academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId);
    }

    private Optional<AcademicSession> resolveAcademicSessionForDate(Long instituteId, Long academicSessionId, LocalDate date) {
        if (academicSessionId != null) {
            return resolveAcademicSession(instituteId, academicSessionId);
        }
        return academicSessionRepository.findAllByInstituteIdOrderByCurrentDescNameDesc(instituteId)
                .stream()
                .filter(session -> session.getStartDate() != null
                        && session.getEndDate() != null
                        && !date.isBefore(session.getStartDate())
                        && !date.isAfter(session.getEndDate()))
                .findFirst()
                .or(() -> academicSessionRepository.findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId));
    }

    private void ensureRouteOperation(Institute institute, TransportDriver driver, TransportDriverPayload request) {
        if (!StringUtils.hasText(request.busNumber()) || !StringUtils.hasText(request.routeName())) {
            return;
        }

        TransportVehicle vehicle = transportVehicleRepository
                .findByInstituteIdAndBusNumberIgnoreCase(institute.getId(), driver.getBusNumber())
                .orElseGet(() -> {
                    TransportVehicle next = new TransportVehicle();
                    next.setInstitute(institute);
                    next.setBusNumber(driver.getBusNumber());
                    return next;
                });
        vehicle.setVehicleType(defaultValue(request.vehicleType(), "School Bus"));
        vehicle.setSeatCapacity(request.seatCapacity());
        vehicle.setStatus("ACTIVE");
        vehicle = transportVehicleRepository.save(vehicle);

        String routeCode = resolveRouteCode(request);
        TransportRoute route = transportRouteRepository
                .findByInstituteIdAndRouteCodeIgnoreCase(institute.getId(), routeCode)
                .orElseGet(() -> {
                    TransportRoute next = new TransportRoute();
                    next.setInstitute(institute);
                    next.setRouteCode(routeCode);
                    return next;
                });
        route.setRouteName(trim(request.routeName()));
        route.setStatus("ACTIVE");
        route = transportRouteRepository.save(route);

        syncRouteStops(route, request.pickupPoints());

        LocalDate effectiveFrom = LocalDate.now();
        Optional<TransportRouteOperation> activeOperation = transportRouteOperationRepository.findActiveByDriver(institute.getId(), driver.getId(), effectiveFrom);
        Long routeId = route.getId();
        Long vehicleId = vehicle.getId();
        if (activeOperation
                .filter(operation -> operation.getRoute().getId().equals(routeId) && operation.getVehicle().getId().equals(vehicleId))
                .isPresent()) {
            return;
        }

        activeOperation.ifPresent(operation -> {
            LocalDate previousEnd = operation.getEffectiveFrom() != null && operation.getEffectiveFrom().isEqual(effectiveFrom)
                    ? effectiveFrom
                    : effectiveFrom.minusDays(1);
            operation.setEffectiveTo(previousEnd);
            operation.setStatus("INACTIVE");
            transportRouteOperationRepository.save(operation);
        });

        assertNoRouteOperationOverlap(institute.getId(), null, route.getId(), driver.getId(), vehicle.getId(), effectiveFrom, null);
        validateVehicleCanOperateRoute(institute.getId(), route.getId(), vehicle);

        TransportRouteOperation operation = new TransportRouteOperation();
        operation.setInstitute(institute);
        operation.setDriver(driver);
        operation.setRoute(route);
        operation.setVehicle(vehicle);
        operation.setEffectiveFrom(effectiveFrom);
        operation.setStatus("ACTIVE");
        transportRouteOperationRepository.save(operation);
    }

    private void syncRouteStops(TransportRoute route, String pickupPoints) {
        if (!StringUtils.hasText(pickupPoints)) {
            return;
        }
        List<String> stops = Arrays.stream(pickupPoints.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
        for (int index = 0; index < stops.size(); index++) {
            String stopName = stops.get(index);
            TransportRouteStop stop = transportRouteStopRepository
                    .findByRouteIdAndStopNameIgnoreCase(route.getId(), stopName)
                    .orElseGet(() -> {
                        TransportRouteStop next = new TransportRouteStop();
                        next.setRoute(route);
                        next.setStopName(stopName);
                        return next;
                    });
            stop.setStopOrder(index + 1);
            stop.setStatus("ACTIVE");
            transportRouteStopRepository.save(stop);
        }
    }

    private void validateRouteCapacity(Long instituteId, Long academicSessionId, Long routeId, Long assignmentId, TransportVehicle vehicle) {
        if (vehicle == null || vehicle.getSeatCapacity() == null || vehicle.getSeatCapacity() <= 0) {
            return;
        }
        long assignedCount = transportAssignmentRepository.countByInstituteIdAndAcademicSessionIdAndRouteIdAndStatusIgnoreCase(
                instituteId,
                academicSessionId,
                routeId,
                "ACTIVE"
        );
        boolean existingAssignmentOnRoute = assignmentId != null && transportAssignmentRepository.findByInstituteIdAndId(instituteId, assignmentId)
                .map(existing -> existing.getRoute() != null && existing.getRoute().getId().equals(routeId))
                .orElse(false);
        if (!existingAssignmentOnRoute && assignedCount >= vehicle.getSeatCapacity()) {
            throw new IllegalArgumentException("Vehicle capacity exceeded. Bus capacity: " + vehicle.getSeatCapacity() + ", currently assigned: " + assignedCount + ".");
        }
    }

    private void validateVehicleCanOperateRoute(Long instituteId, Long routeId, TransportVehicle vehicle) {
        Long sessionId = resolveAcademicSession(instituteId, null).map(AcademicSession::getId).orElse(null);
        if (sessionId == null || vehicle.getSeatCapacity() == null || vehicle.getSeatCapacity() <= 0) {
            return;
        }
        long assignedCount = transportAssignmentRepository.countByInstituteIdAndAcademicSessionIdAndRouteIdAndStatusIgnoreCase(
                instituteId,
                sessionId,
                routeId,
                "ACTIVE"
        );
        if (assignedCount > vehicle.getSeatCapacity()) {
            throw new IllegalArgumentException("Vehicle capacity mismatch. Bus capacity: " + vehicle.getSeatCapacity() + ", route has assigned students: " + assignedCount + ".");
        }
    }

    private void assertNoRouteOperationOverlap(
            Long instituteId,
            Long operationId,
            Long routeId,
            Long driverId,
            Long vehicleId,
            LocalDate effectiveFrom,
            LocalDate effectiveTo
    ) {
        LocalDate rangeEnd = effectiveTo == null ? LocalDate.of(9999, 12, 31) : effectiveTo;
        List<TransportRouteOperation> overlaps = transportRouteOperationRepository.findOverlappingOperations(
                instituteId,
                operationId,
                routeId,
                driverId,
                vehicleId,
                effectiveFrom,
                rangeEnd
        );
        if (!overlaps.isEmpty()) {
            throw new IllegalArgumentException("Route, driver, or vehicle already has an overlapping active transport operation.");
        }
    }

    private TransportRouteOperationResponse toRouteOperationResponse(Map<Long, Long> assignedCountsByRoute, TransportRouteOperation operation) {
        long assignedCount = assignedCountsByRoute.getOrDefault(operation.getRoute().getId(), 0L);
        int capacity = operation.getVehicle().getSeatCapacity() == null ? 0 : operation.getVehicle().getSeatCapacity();
        List<TransportRouteStopResponse> stops = transportRouteStopRepository.findAllByRouteIdOrderByStopOrderAsc(operation.getRoute().getId())
                .stream()
                .filter(stop -> !"ARCHIVED".equalsIgnoreCase(defaultValue(stop.getStatus(), "")))
                .map(stop -> new TransportRouteStopResponse(stop.getId(), stop.getStopName(), stop.getStopOrder()))
                .toList();
        return new TransportRouteOperationResponse(
                operation.getId(),
                operation.getRoute().getId(),
                operation.getRoute().getRouteName(),
                operation.getRoute().getRouteCode(),
                operation.getDriver().getId(),
                operation.getDriver().getDriverName(),
                operation.getDriver().getDriverPhone(),
                operation.getVehicle().getId(),
                operation.getVehicle().getBusNumber(),
                operation.getVehicle().getVehicleType(),
                operation.getVehicle().getSeatCapacity(),
                assignedCount,
                capacity <= 0 ? 0 : Math.max(0, capacity - assignedCount),
                stops
        );
    }

    private String normalizeDriverStatus(String status) {
        String value = defaultValue(status, "ACTIVE").trim().toUpperCase();
        if (List.of("ACTIVE", "INACTIVE", "ARCHIVED").contains(value)) {
            return value;
        }
        throw new IllegalArgumentException("Driver status must be ACTIVE, INACTIVE, or ARCHIVED.");
    }

    private String normalizeAttendanceStatus(String status) {
        String value = defaultValue(status, "Absent").trim();
        if (value.equalsIgnoreCase("Present")) return "Present";
        if (value.equalsIgnoreCase("Absent")) return "Absent";
        throw new IllegalArgumentException("Transport attendance status must be Present or Absent.");
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
        TransportRoute route = assignment.getRoute();
        TransportRouteOperation operation = route == null
                ? null
                : transportRouteOperationRepository.findActiveByRoute(assignment.getInstitute().getId(), route.getId(), LocalDate.now()).orElse(null);
        TransportDriver displayDriver = operation == null ? driver : operation.getDriver();
        TransportVehicle displayVehicle = operation == null ? null : operation.getVehicle();
        return new TransportAssignmentResponse(
                assignment.getId(),
                assignment.getAcademicSession() == null ? null : assignment.getAcademicSession().getId(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(student.getAssignedClass(), student.getClassName()),
                assignment.getPickupStop(),
                route == null ? null : route.getId(),
                assignment.getPickupStopRef() == null ? null : assignment.getPickupStopRef().getId(),
                displayDriver == null ? null : displayDriver.getId(),
                displayDriver == null ? "" : displayDriver.getDriverName(),
                displayDriver == null ? "" : displayDriver.getDriverPhone(),
                displayVehicle == null ? (driver == null ? "" : driver.getBusNumber()) : displayVehicle.getBusNumber(),
                route == null ? (driver == null ? "" : driver.getRouteName()) : route.getRouteName(),
                displayVehicle == null ? (driver == null ? "" : driver.getVehicleType()) : displayVehicle.getVehicleType(),
                route == null ? (driver == null ? "" : driver.getPickupPoints()) : buildPickupPoints(route.getId()),
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
                attendance.getRoute() == null ? null : attendance.getRoute().getId(),
                attendance.getRouteOperation() == null ? null : attendance.getRouteOperation().getId(),
                firstNonBlank(attendance.getDriverNameSnapshot(), driver.getDriverName()),
                firstNonBlank(attendance.getBusNumberSnapshot(), driver.getBusNumber()),
                firstNonBlank(attendance.getRouteNameSnapshot(), driver.getRouteName()),
                attendance.getPickupStopSnapshot(),
                defaultValue(attendance.getStatus(), "Absent"),
                attendance.getMarkedBy(),
                attendance.getNotes(),
                attendance.getCreatedAt(),
                attendance.getUpdatedAt()
        );
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

    private TransportStudentLookupResponse toStudentLookupResponse(Student student) {
        return new TransportStudentLookupResponse(
                student.getId(),
                student.getEnrollmentNo(),
                buildStudentName(student),
                student.getGuardianName(),
                getStudentClassName(student),
                getStudentSection(student)
        );
    }

    private String getStudentClassName(Student student) {
        String assignedClass = trim(student.getAssignedClass());
        if (assignedClass != null && assignedClass.contains("/")) {
            return assignedClass.split("/", 2)[0].trim();
        }
        return firstNonBlank(student.getClassName(), assignedClass);
    }

    private String getStudentSection(Student student) {
        String assignedClass = trim(student.getAssignedClass());
        if (assignedClass != null && assignedClass.contains("/")) {
            return assignedClass.split("/", 2)[1].trim();
        }
        return trim(student.getSection());
    }

    private String buildPickupPoints(Long routeId) {
        return transportRouteStopRepository.findAllByRouteIdOrderByStopOrderAsc(routeId)
                .stream()
                .filter(stop -> !"ARCHIVED".equalsIgnoreCase(defaultValue(stop.getStatus(), "")))
                .map(TransportRouteStop::getStopName)
                .filter(StringUtils::hasText)
                .collect(Collectors.joining(", "));
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
