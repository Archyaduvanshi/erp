package com.erp.backend.result.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.marks.entity.StudentMark;
import com.erp.backend.marks.repository.StudentMarkRepository;
import com.erp.backend.result.dto.ResultCellResponse;
import com.erp.backend.result.dto.ResultClassResponse;
import com.erp.backend.result.dto.ResultExamColumnResponse;
import com.erp.backend.result.dto.ResultStudentResponse;
import com.erp.backend.result.dto.ResultSummaryResponse;
import com.erp.backend.result.dto.StudentResultResponse;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ResultService {

    private static final BigDecimal PASS_PERCENTAGE = BigDecimal.valueOf(33);
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

    private final InstituteRepository instituteRepository;
    private final StudentRepository studentRepository;
    private final StudentMarkRepository studentMarkRepository;

    public ResultService(
            InstituteRepository instituteRepository,
            StudentRepository studentRepository,
            StudentMarkRepository studentMarkRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.studentRepository = studentRepository;
        this.studentMarkRepository = studentMarkRepository;
    }

    public List<ResultClassResponse> getClasses(Long instituteId) {
        validateInstitute(instituteId);
        List<Student> students = studentRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId);
        List<StudentMark> marks = studentMarkRepository.findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(instituteId);
        Set<String> classNames = new LinkedHashSet<>();
        students.stream().map(this::studentClass).filter(StringUtils::hasText).forEach(classNames::add);
        marks.stream().map(StudentMark::getClassName).filter(StringUtils::hasText).forEach(classNames::add);

        return classNames.stream()
                .sorted(this::compareClassNames)
                .map(className -> {
                    List<Student> classStudents = students.stream()
                            .filter(student -> className.equalsIgnoreCase(studentClass(student)))
                            .toList();
                    List<StudentMark> classMarks = marks.stream()
                            .filter(mark -> className.equalsIgnoreCase(mark.getClassName()))
                            .toList();
                    int studentCount = classStudents.isEmpty()
                            ? (int) classMarks.stream().map(mark -> mark.getStudent().getId()).distinct().count()
                            : classStudents.size();
                    int resultCount = (int) classMarks.stream()
                            .map(mark -> mark.getStudent().getId() + "-" + defaultValue(mark.getExamTitle(), ""))
                            .distinct()
                            .count();
                    int subjectCount = (int) classMarks.stream()
                            .map(StudentMark::getSubjectName)
                            .filter(StringUtils::hasText)
                            .distinct()
                            .count();
                    return new ResultClassResponse(className, studentCount, resultCount, subjectCount);
                })
                .toList();
    }

    public List<ResultStudentResponse> getClassStudents(Long instituteId, String className) {
        validateInstitute(instituteId);
        String cleanClassName = cleanRequired(className, "Class name is required.");
        List<Student> students = studentRepository.findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByFirstNameAscLastNameAscCreatedAtAsc(instituteId, cleanClassName);
        List<StudentMark> marks = studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseOrderBySubjectNameAscExamTitleAscCreatedAtAsc(instituteId, cleanClassName);
        Map<Long, ResultStudentResponse> studentMap = new LinkedHashMap<>();

        students.forEach(student -> studentMap.put(student.getId(), toStudentResponse(student, cleanClassName, studentMarks(marks, student.getId()))));
        marks.forEach(mark -> {
            Long studentId = mark.getStudent().getId();
            studentMap.putIfAbsent(studentId, toStudentResponse(mark.getStudent(), cleanClassName, studentMarks(marks, studentId)));
        });

        return studentMap.values().stream()
                .sorted(Comparator.comparing(ResultStudentResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public StudentResultResponse getStudentResult(Long instituteId, String className, Long studentId) {
        validateInstitute(instituteId);
        String cleanClassName = cleanRequired(className, "Class name is required.");
        Student student = studentRepository.findByInstituteIdAndId(instituteId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found with id: " + studentId));
        List<StudentMark> classMarks = studentMarkRepository.findAllByInstituteIdAndClassNameIgnoreCaseOrderBySubjectNameAscExamTitleAscCreatedAtAsc(instituteId, cleanClassName);
        List<StudentMark> studentMarks = studentMarks(classMarks, studentId);
        List<String> subjects = classMarks.stream()
                .map(StudentMark::getSubjectName)
                .filter(StringUtils::hasText)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
        List<ResultExamColumnResponse> exams = buildExamColumns(classMarks);
        Map<String, StudentMark> markMap = studentMarks.stream()
                .filter(mark -> StringUtils.hasText(mark.getSubjectName()) && StringUtils.hasText(mark.getExamTitle()))
                .collect(Collectors.toMap(
                        mark -> resultCellKey(mark.getSubjectName(), examKey(mark)),
                        mark -> mark,
                        (existing, replacement) -> replacement
                ));
        List<ResultCellResponse> cells = new ArrayList<>();
        List<ResultSummaryResponse> summaries = new ArrayList<>();

        exams.forEach(exam -> {
            BigDecimal obtainedTotal = BigDecimal.ZERO;
            BigDecimal maxTotal = BigDecimal.ZERO;

            for (String subject : subjects) {
                StudentMark mark = markMap.get(resultCellKey(subject, exam.key()));
                if (mark == null) continue;
                obtainedTotal = obtainedTotal.add(nullSafe(mark.getMarksObtained()));
                maxTotal = maxTotal.add(nullSafe(mark.getMaxMarks()));
                cells.add(toCellResponse(mark, exam.key()));
            }

            summaries.add(new ResultSummaryResponse(
                    exam.key(),
                    obtainedTotal,
                    maxTotal,
                    calculatePercentage(obtainedTotal, maxTotal)
            ));
        });

        return new StudentResultResponse(
                toStudentResponse(student, cleanClassName, studentMarks),
                subjects,
                exams,
                cells,
                summaries
        );
    }

    private List<ResultExamColumnResponse> buildExamColumns(List<StudentMark> marks) {
        Map<String, ExamMeta> examMap = new LinkedHashMap<>();
        marks.forEach(mark -> {
            if (!StringUtils.hasText(mark.getExamTitle())) return;
            String key = examKey(mark);
            ExamMeta meta = examMap.computeIfAbsent(key, ignored -> new ExamMeta(
                    key,
                    mark.getExamTitle().trim(),
                    mark.getExamDate() == null ? "" : mark.getExamDate().format(DATE_FORMATTER),
                    new LinkedHashSet<>()
            ));
            if (mark.getMaxMarks() != null && mark.getMaxMarks().compareTo(BigDecimal.ZERO) > 0) {
                meta.maxMarksValues().add(mark.getMaxMarks().stripTrailingZeros().toPlainString());
            }
        });

        return examMap.values().stream()
                .sorted(this::compareExamMeta)
                .map(meta -> new ResultExamColumnResponse(
                        meta.key(),
                        meta.title(),
                        meta.examDate(),
                        meta.maxMarksValues().size() == 1 ? meta.maxMarksValues().iterator().next() + " marks" : "Marks vary"
                ))
                .toList();
    }

    private ResultStudentResponse toStudentResponse(Student student, String className, List<StudentMark> marks) {
        int subjectCount = (int) marks.stream()
                .map(StudentMark::getSubjectName)
                .filter(StringUtils::hasText)
                .distinct()
                .count();
        BigDecimal obtained = marks.stream().map(StudentMark::getMarksObtained).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = marks.stream().map(StudentMark::getMaxMarks).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
        int percentage = calculatePercentage(obtained, total);
        String status = total.compareTo(BigDecimal.ZERO) <= 0 ? "Pending" : percentage >= PASS_PERCENTAGE.intValue() ? "Pass" : "Fail";
        return new ResultStudentResponse(student.getId(), studentName(student), rollNo(student), className, subjectCount, status);
    }

    private ResultCellResponse toCellResponse(StudentMark mark, String examKey) {
        int percentage = calculatePercentage(nullSafe(mark.getMarksObtained()), nullSafe(mark.getMaxMarks()));
        return new ResultCellResponse(
                mark.getSubjectName(),
                examKey,
                mark.getMaxMarks(),
                mark.getMarksObtained(),
                percentage,
                mark.getMaxMarks() == null || mark.getMaxMarks().compareTo(BigDecimal.ZERO) <= 0 ? "Pending" : percentage >= PASS_PERCENTAGE.intValue() ? "Pass" : "Fail",
                mark.getUploadedBy()
        );
    }

    private List<StudentMark> studentMarks(List<StudentMark> marks, Long studentId) {
        return marks.stream()
                .filter(mark -> mark.getStudent() != null && Objects.equals(mark.getStudent().getId(), studentId))
                .toList();
    }

    private int calculatePercentage(BigDecimal obtained, BigDecimal total) {
        if (total == null || total.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return obtained.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP).intValue();
    }

    private BigDecimal nullSafe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String examKey(StudentMark mark) {
        return defaultValue(mark.getExamTitle(), "") + "__" + (mark.getExamDate() == null ? "" : mark.getExamDate().format(DATE_FORMATTER));
    }

    private String resultCellKey(String subjectName, String examKey) {
        return defaultValue(subjectName, "") + "__" + examKey;
    }

    private String cleanRequired(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private void validateInstitute(Long instituteId) {
        if (!instituteRepository.existsById(instituteId)) {
            throw new ResourceNotFoundException("Institute not found with id: " + instituteId);
        }
    }

    private String studentClass(Student student) {
        return firstNonBlank(student.getAssignedClass(), student.getClassName());
    }

    private String studentName(Student student) {
        return firstNonBlank(
                String.join(" ", defaultValue(student.getFirstName(), ""), defaultValue(student.getLastName(), "")).trim(),
                student.getName(),
                student.getEnrollmentNo(),
                "Unnamed student"
        );
    }

    private String rollNo(Student student) {
        return firstNonBlank(student.getRollNo(), student.getEnrollmentNo(), student.getSystemId(), String.valueOf(student.getId()));
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

    private int compareClassNames(String left, String right) {
        int leftRank = classRank(left);
        int rightRank = classRank(right);
        if (leftRank != rightRank) return leftRank - rightRank;
        return left.compareToIgnoreCase(right);
    }

    private int classRank(String value) {
        String normalized = defaultValue(value, "").toLowerCase();
        if (normalized.contains("nursery")) return 0;
        if (normalized.contains("lkg")) return 1;
        if (normalized.contains("ukg")) return 2;
        String digits = normalized.replaceAll("\\D+", "");
        return digits.isBlank() ? 1000 : 2 + Integer.parseInt(digits);
    }

    private int compareExamMeta(ExamMeta left, ExamMeta right) {
        if (StringUtils.hasText(left.examDate()) && StringUtils.hasText(right.examDate()) && !left.examDate().equals(right.examDate())) {
            return left.examDate().compareTo(right.examDate());
        }
        if (StringUtils.hasText(left.examDate())) return -1;
        if (StringUtils.hasText(right.examDate())) return 1;
        return left.title().compareToIgnoreCase(right.title());
    }

    private record ExamMeta(String key, String title, String examDate, Set<String> maxMarksValues) {
    }
}
