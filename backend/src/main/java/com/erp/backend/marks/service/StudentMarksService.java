package com.erp.backend.marks.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.marks.dto.StudentMarkEntryPayload;
import com.erp.backend.marks.dto.StudentMarkResponse;
import com.erp.backend.marks.dto.StudentMarksExamPayload;
import com.erp.backend.marks.dto.StudentMarksExamRenamePayload;
import com.erp.backend.marks.dto.StudentMarksExamRenameResponse;
import com.erp.backend.marks.dto.StudentMarksRegisterPayload;
import com.erp.backend.marks.entity.StudentMark;
import com.erp.backend.marks.entity.StudentMarksExamRename;
import com.erp.backend.marks.repository.StudentMarkRepository;
import com.erp.backend.marks.repository.StudentMarksExamRenameRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class StudentMarksService {

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;
    private final StudentMarksExamRenameRepository examRenameRepository;

    public StudentMarksService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            StudentMarkRepository studentMarkRepository,
            StudentMarksExamRenameRepository examRenameRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.studentMarkRepository = studentMarkRepository;
        this.examRenameRepository = examRenameRepository;
    }

    public List<StudentMarkResponse> getMarks(Long instituteId, String className, String subjectName) {
        validateInstitute(instituteId);
        List<StudentMark> records = StringUtils.hasText(className) && StringUtils.hasText(subjectName)
                ? studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseOrderByExamTitleAscCreatedAtAsc(
                        instituteId,
                        className.trim(),
                        subjectName.trim()
                )
                : studentMarkRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(instituteId);

        return records.stream()
                .sorted(Comparator.comparing(StudentMark::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(StudentMark::getSubjectName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(StudentMark::getExamTitle, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(record -> buildStudentName(record.getStudent()), Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toMarkResponse)
                .toList();
    }

    public List<StudentMarksExamRenameResponse> getRenames(Long instituteId) {
        validateInstitute(instituteId);
        return examRenameRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscOldTitleAsc(instituteId)
                .stream()
                .map(this::toRenameResponse)
                .toList();
    }

    @Transactional
    public List<StudentMarkResponse> saveRegister(Long instituteId, StudentMarksRegisterPayload request) {
        Institute institute = validateInstitute(instituteId);
        String className = request.className().trim();
        String subjectName = request.subjectName().trim();
        Set<String> examTitles = request.exams().stream()
                .map(StudentMarksExamPayload::examTitle)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .collect(Collectors.toSet());

        if (examTitles.isEmpty()) {
            throw new IllegalArgumentException("At least one exam title is required.");
        }

        List<StudentMark> existing = studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndExamTitleIn(
                instituteId,
                className,
                subjectName,
                examTitles
        );
        studentMarkRepository.deleteAll(existing);

        List<StudentMark> records = request.exams().stream()
                .flatMap(exam -> exam.entries().stream()
                        .map(entry -> createMarkRecord(institute, className, subjectName, request.uploadedBy(), exam, entry)))
                .toList();

        return studentMarkRepository.saveAll(records).stream()
                .map(this::toMarkResponse)
                .toList();
    }

    @Transactional
    public List<StudentMarksExamRenameResponse> renameExam(Long instituteId, StudentMarksExamRenamePayload request) {
        Institute institute = validateInstitute(instituteId);
        String className = request.className().trim();
        String subjectName = request.subjectName().trim();
        String oldTitle = request.oldTitle().trim();
        String newTitle = request.newTitle().trim();

        List<StudentMark> matchingMarks = studentMarkRepository
                .findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndExamTitleIn(
                        instituteId,
                        className,
                        subjectName,
                        List.of(oldTitle)
                );
        matchingMarks.forEach(record -> record.setExamTitle(newTitle));
        studentMarkRepository.saveAll(matchingMarks);

        List<StudentMarksExamRename> matchingRenames = examRenameRepository
                .findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndOldTitleIgnoreCaseOrInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndNewTitleIgnoreCase(
                        instituteId,
                        className,
                        subjectName,
                        oldTitle,
                        instituteId,
                        className,
                        subjectName,
                        oldTitle
                );

        String sourceExamTitle = matchingRenames.stream()
                .map(StudentMarksExamRename::getOldTitle)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(oldTitle);
        examRenameRepository.deleteAll(matchingRenames);

        StudentMarksExamRename rename = new StudentMarksExamRename();
        rename.setInstitute(institute);
        rename.setClassName(className);
        rename.setSubjectName(subjectName);
        rename.setOldTitle(sourceExamTitle);
        rename.setNewTitle(newTitle);
        examRenameRepository.save(rename);

        return getRenames(instituteId);
    }

    private StudentMark createMarkRecord(
            Institute institute,
            String className,
            String subjectName,
            String uploadedBy,
            StudentMarksExamPayload exam,
            StudentMarkEntryPayload entry
    ) {
        Student student = studentRepository.findByInstituteIdAndId(institute.getId(), entry.studentId())
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + entry.studentId()));

        BigDecimal marksObtained = entry.marksObtained();
        BigDecimal maxMarks = exam.maxMarks();
        if (marksObtained.compareTo(maxMarks) > 0) {
            throw new IllegalArgumentException("Marks cannot be greater than max marks for student " + entry.studentId() + ".");
        }

        StudentMark record = new StudentMark();
        record.setInstitute(institute);
        record.setStudent(student);
        record.setClassName(className);
        record.setSubjectName(subjectName);
        record.setExamTitle(exam.examTitle().trim());
        record.setExamDate(parseDate(exam.examDate()));
        record.setMaxMarks(maxMarks);
        record.setMarksObtained(marksObtained);
        record.setRollNo(defaultValue(entry.rollNo(), firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), student.getSystemId(), String.valueOf(student.getId()))));
        record.setUploadedBy(defaultValue(uploadedBy, "Teacher"));
        return record;
    }

    private StudentMarkResponse toMarkResponse(StudentMark record) {
        Student student = record.getStudent();
        return new StudentMarkResponse(
                record.getId(),
                record.getClassName(),
                record.getSubjectName(),
                record.getExamTitle(),
                record.getExamDate() == null ? "" : record.getExamDate().toString(),
                record.getMaxMarks(),
                record.getMarksObtained(),
                student.getId(),
                buildStudentName(student),
                firstNonBlank(record.getRollNo(), student.getRollNo(), student.getEnrollmentNo(), student.getSystemId()),
                record.getUploadedBy(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private StudentMarksExamRenameResponse toRenameResponse(StudentMarksExamRename record) {
        return new StudentMarksExamRenameResponse(
                record.getId(),
                record.getClassName(),
                record.getSubjectName(),
                record.getOldTitle(),
                record.getNewTitle(),
                record.getCreatedAt(),
                record.getUpdatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private LocalDate parseDate(String value) {
        if (!StringUtils.hasText(value)) return null;
        return LocalDate.parse(value.trim());
    }

    private String buildStudentName(Student student) {
        return firstNonBlank(
                String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim(),
                student.getName(),
                student.getEnrollmentNo(),
                "Unnamed student"
        );
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
