package com.erp.backend.scanner.service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.auth.TeacherAuthorizationService;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.scanner.dto.QrRegenerateResponse;
import com.erp.backend.scanner.dto.ScanResolveRequest;
import com.erp.backend.scanner.dto.ScanResolveResponse;
import com.erp.backend.scanner.service.QrIdentityTokenService.EntityType;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import com.erp.backend.timetable.repository.ClassTimetableRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScannerService {
    private static final Map<String, String> FEATURE_KEYS = Map.ofEntries(
            Map.entry("fees", "fees"),
            Map.entry("attendance", "attendance"),
            Map.entry("library", "library"),
            Map.entry("hostel", "hostel"),
            Map.entry("transport", "transport"),
            Map.entry("salary", "salary"),
            Map.entry("student-management", "admissionStudent"),
            Map.entry("admissionstudent", "admissionStudent"),
            Map.entry("teacher-management", "teacher"),
            Map.entry("teacher", "teacher"),
            Map.entry("examinations", "examinations"),
            Map.entry("results", "examinations")
    );
    private static final Map<String, Set<EntityType>> SUPPORTED_TYPES = Map.ofEntries(
            Map.entry("fees", Set.of(EntityType.STUDENT)),
            Map.entry("attendance", Set.of(EntityType.STUDENT, EntityType.TEACHER)),
            Map.entry("library", Set.of(EntityType.STUDENT)),
            Map.entry("hostel", Set.of(EntityType.STUDENT)),
            Map.entry("transport", Set.of(EntityType.STUDENT)),
            Map.entry("salary", Set.of(EntityType.TEACHER)),
            Map.entry("admissionStudent", Set.of(EntityType.STUDENT)),
            Map.entry("teacher", Set.of(EntityType.TEACHER)),
            Map.entry("examinations", Set.of(EntityType.STUDENT))
    );

    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final TeacherAuthorizationService teacherAuthorizationService;
    private final QrIdentityTokenService qrIdentityTokenService;
    private final ClassTimetableRepository classTimetableRepository;

    public ScannerService(
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            TeacherAuthorizationService teacherAuthorizationService,
            QrIdentityTokenService qrIdentityTokenService,
            ClassTimetableRepository classTimetableRepository
    ) {
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.teacherAuthorizationService = teacherAuthorizationService;
        this.qrIdentityTokenService = qrIdentityTokenService;
        this.classTimetableRepository = classTimetableRepository;
    }

    @Transactional(readOnly = true)
    public ScanResolveResponse resolve(AuthPrincipal principal, ScanResolveRequest request) {
        String featureKey = normalizeFeature(request.feature());
        authorizeFeature(principal, featureKey, request);
        QrIdentityTokenService.ParsedQr qr = qrIdentityTokenService.parse(request.qrData());
        if (!SUPPORTED_TYPES.get(featureKey).contains(qr.entityType())) {
            throw new IllegalArgumentException("This QR is not supported in " + displayFeature(featureKey) + ".");
        }

        ScanResolveResponse response = qr.entityType() == EntityType.STUDENT
                ? resolveStudent(principal.instituteId(), qr.payload())
                : resolveTeacher(principal.instituteId(), qr.payload());
        validateTeacherAttendanceTarget(principal, featureKey, request, response);
        return response;
    }

    @Transactional
    public QrRegenerateResponse regenerateStudent(AuthPrincipal principal, Long studentId) {
        requireAdmin(principal);
        Student student = studentRepository.findByInstituteIdAndId(principal.instituteId(), studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found."));
        student.setQrCodeData(qrIdentityTokenService.generate(EntityType.STUDENT));
        Student saved = studentRepository.save(student);
        return new QrRegenerateResponse("STUDENT", saved.getId(), saved.getQrCodeData());
    }

    @Transactional
    public QrRegenerateResponse regenerateTeacher(AuthPrincipal principal, Long teacherId) {
        requireAdmin(principal);
        Teacher teacher = teacherRepository.findByInstituteIdAndId(principal.instituteId(), teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found."));
        teacher.setQrCodeData(qrIdentityTokenService.generate(EntityType.TEACHER));
        Teacher saved = teacherRepository.save(teacher);
        return new QrRegenerateResponse("TEACHER", saved.getId(), saved.getQrCodeData());
    }

    private ScanResolveResponse resolveStudent(Long instituteId, String payload) {
        Student student = studentRepository.findByInstituteIdAndQrCodeData(instituteId, payload)
                .orElseThrow(() -> new ResourceNotFoundException("QR could not be verified."));
        String name = firstNonBlank(fullName(student.getFirstName(), student.getLastName()), student.getName(), student.getEnrollmentNo());
        return new ScanResolveResponse(
                "STUDENT", student.getId(), name, student.getEnrollmentNo(),
                student.getSchoolClass() == null ? null : student.getSchoolClass().getId(),
                student.getClassSection() == null ? null : student.getClassSection().getId(),
                firstNonBlank(student.getClassName(), student.getAssignedClass()), student.getSection(),
                student.getRollNo(), null, student.getPhotoUrl()
        );
    }

    private ScanResolveResponse resolveTeacher(Long instituteId, String payload) {
        Teacher teacher = teacherRepository.findByInstituteIdAndQrCodeData(instituteId, payload)
                .orElseThrow(() -> new ResourceNotFoundException("QR could not be verified."));
        String name = firstNonBlank(fullName(teacher.getFirstName(), teacher.getLastName()), teacher.getName(), teacher.getEmployeeId());
        return new ScanResolveResponse(
                "TEACHER", teacher.getId(), name, teacher.getEmployeeId(), null, null, null, null,
                null, teacher.getSpecialization(), teacher.getPhotoUrl()
        );
    }

    private void authorizeFeature(AuthPrincipal principal, String featureKey, ScanResolveRequest request) {
        if (principal == null || principal.instituteId() == null) {
            throw new AccessDeniedException("Authentication is required.");
        }
        if ("ADMIN".equals(principal.role())) {
            return;
        }
        if ("TEACHER".equals(principal.role())) {
            if (teacherAuthorizationService.canRead(principal, featureKey)) {
                return;
            }
            if ("attendance".equals(featureKey) && hasAttendanceContext(request)) {
                return;
            }
        }
        throw new AccessDeniedException("You do not have access to this scanner feature.");
    }

    private void validateTeacherAttendanceTarget(
            AuthPrincipal principal,
            String featureKey,
            ScanResolveRequest request,
            ScanResolveResponse response
    ) {
        if (!"attendance".equals(featureKey) || !"TEACHER".equals(principal.role())) {
            return;
        }
        if (!hasAttendanceContext(request) || principal.teacherId() == null) {
            throw new AccessDeniedException("Select your assigned class before scanning attendance.");
        }
        if (!classTimetableRepository.existsAttendanceTeacherAssignment(
                principal.instituteId(), request.academicSessionId(), principal.teacherId(), request.classId(), request.sectionId()
        )) {
            throw new AccessDeniedException("You are not the attendance teacher for this class/section.");
        }
        if (!"STUDENT".equals(response.entityType())
                || !request.classId().equals(response.classId())
                || !java.util.Objects.equals(request.sectionId(), response.sectionId())) {
            throw new AccessDeniedException("This student does not belong to your selected class/section.");
        }
    }

    private boolean hasAttendanceContext(ScanResolveRequest request) {
        return request.academicSessionId() != null && request.classId() != null;
    }

    private String normalizeFeature(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace('_', '-');
        String featureKey = FEATURE_KEYS.get(normalized);
        if (featureKey == null || !SUPPORTED_TYPES.containsKey(featureKey)) {
            throw new IllegalArgumentException("Scanner is not supported for this feature.");
        }
        return featureKey;
    }

    private void requireAdmin(AuthPrincipal principal) {
        if (principal == null || !"ADMIN".equals(principal.role())) {
            throw new AccessDeniedException("Only an administrator can regenerate QR codes.");
        }
    }

    private String displayFeature(String featureKey) {
        return switch (featureKey) {
            case "admissionStudent" -> "Student Management";
            case "teacher" -> "Teacher Management";
            default -> Character.toUpperCase(featureKey.charAt(0)) + featureKey.substring(1) + " Management";
        };
    }

    private String fullName(String firstName, String lastName) {
        return ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim())).trim();
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
