package com.erp.backend.attendance.service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

import com.erp.backend.attendance.dto.AttendanceEntryPayload;
import com.erp.backend.attendance.dto.AttendanceResponse;
import com.erp.backend.attendance.dto.AttendanceSaveRequest;
import com.erp.backend.attendance.entity.AttendanceRecord;
import com.erp.backend.attendance.repository.AttendanceRecordRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class AttendanceService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;

    public AttendanceService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            AttendanceRecordRepository attendanceRecordRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
    }

    public List<AttendanceResponse> getAttendance(Long instituteId, String className) {
        validateInstitute(instituteId);
        List<AttendanceRecord> records = StringUtils.hasText(className)
                ? attendanceRecordRepository.findAllByInstituteIdAndClassNameIgnoreCaseOrderByAttendanceDateDescCreatedAtDesc(instituteId, className.trim())
                : attendanceRecordRepository.findAllByInstituteIdOrderByAttendanceDateDescCreatedAtDesc(instituteId);

        return records.stream()
                .sorted(Comparator.comparing(AttendanceRecord::getAttendanceDate, Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(AttendanceRecord::getLectureNumber, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(record -> buildStudentName(record.getStudent()), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<AttendanceResponse> saveAttendance(Long instituteId, AttendanceSaveRequest request) {
        Institute institute = validateInstitute(instituteId);
        LocalDate attendanceDate = LocalDate.parse(request.date().trim());
        String normalizedClassName = request.className().trim();
        String normalizedLectureNumber = request.lectureNumber().trim();

        List<Student> classStudents = studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .filter(student -> normalizedClassName.equalsIgnoreCase(firstNonBlank(student.getAssignedClass(), student.getClassName())))
                .toList();

        Set<Long> classStudentIds = classStudents.stream()
                .map(Student::getId)
                .collect(java.util.stream.Collectors.toSet());

        List<AttendanceRecord> existing = attendanceRecordRepository
                .findAllByInstituteIdAndClassNameIgnoreCaseAndAttendanceDateAndLectureNumber(
                        instituteId,
                        normalizedClassName,
                        attendanceDate,
                        normalizedLectureNumber
                );
        attendanceRecordRepository.deleteAll(existing);

        List<AttendanceRecord> records = request.entries().stream()
                .map(entry -> createAttendanceRecord(institute, normalizedClassName, attendanceDate, normalizedLectureNumber, request, entry, classStudentIds))
                .toList();

        return attendanceRecordRepository.saveAll(records)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void deleteAttendance(Long instituteId, Long recordId) {
        AttendanceRecord record = attendanceRecordRepository.findByInstituteIdAndId(instituteId, recordId)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance record not found with id: " + recordId));
        attendanceRecordRepository.delete(record);
    }

    private AttendanceRecord createAttendanceRecord(
            Institute institute,
            String className,
            LocalDate attendanceDate,
            String lectureNumber,
            AttendanceSaveRequest request,
            AttendanceEntryPayload entry,
            Set<Long> classStudentIds
    ) {
        if (!classStudentIds.contains(entry.studentId())) {
            throw new IllegalArgumentException("Student " + entry.studentId() + " does not belong to the selected class.");
        }

        Student student = findStudent(institute.getId(), entry.studentId());
        AttendanceRecord record = new AttendanceRecord();
        record.setInstitute(institute);
        record.setStudent(student);
        record.setClassName(className);
        record.setAttendanceDate(attendanceDate);
        record.setLectureNumber(lectureNumber);
        record.setSubject(request.subject().trim());
        record.setMarkedBy(request.markedBy().trim());
        record.setRollNo(firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), student.getSystemId(), String.valueOf(student.getId())));
        record.setStatus(defaultValue(entry.status(), "Present"));
        return record;
    }

    private AttendanceResponse toResponse(AttendanceRecord record) {
        Student student = record.getStudent();
        return new AttendanceResponse(
                record.getId(),
                record.getAttendanceDate() == null ? null : record.getAttendanceDate().toString(),
                record.getLectureNumber(),
                record.getSubject(),
                record.getMarkedBy(),
                record.getClassName(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(record.getRollNo(), student.getRollNo(), student.getEnrollmentNo(), student.getSystemId()),
                defaultValue(record.getStatus(), "Present"),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private Student findStudent(Long instituteId, Long studentId) {
        return studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
    }

    private String buildStudentName(Student student) {
        return String.join(" ",
                defaultValue(student.getFirstName(), "").trim(),
                defaultValue(student.getLastName(), "").trim()).trim();
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value.trim();
            }
        }
        return null;
    }
}
