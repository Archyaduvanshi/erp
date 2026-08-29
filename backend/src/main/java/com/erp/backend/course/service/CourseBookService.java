package com.erp.backend.course.service;

import java.util.Comparator;
import java.util.List;

import com.erp.backend.course.dto.CourseBookPayload;
import com.erp.backend.course.dto.CourseBookResponse;
import com.erp.backend.course.entity.CourseBook;
import com.erp.backend.course.repository.CourseBookRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CourseBookService {

    private final InstituteRepository instituteRepository;
    private final CourseBookRepository courseBookRepository;

    public CourseBookService(
            InstituteRepository instituteRepository,
            CourseBookRepository courseBookRepository
    ) {
        this.instituteRepository = instituteRepository;
        this.courseBookRepository = courseBookRepository;
    }

    public List<CourseBookResponse> getCourseBooks(Long instituteId) {
        validateInstitute(instituteId);
        return courseBookRepository.findAllByInstituteIdOrderByCreatedAtDesc(instituteId)
                .stream()
                .sorted(Comparator.comparing(CourseBook::getClassName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(CourseBook::getSubjectName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(CourseBook::getPublisher, Comparator.nullsLast(String::compareToIgnoreCase)))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public CourseBookResponse saveCourseBook(Long instituteId, CourseBookPayload request) {
        Institute institute = validateInstitute(instituteId);
        CourseBook courseBook = new CourseBook();
        courseBook.setInstitute(institute);
        applyPayload(courseBook, request);
        return toResponse(courseBookRepository.save(courseBook));
    }

    @Transactional
    public CourseBookResponse updateCourseBook(Long instituteId, Long id, CourseBookPayload request) {
        validateInstitute(instituteId);
        CourseBook courseBook = courseBookRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Course book not found with id: " + id));
        applyPayload(courseBook, request);
        return toResponse(courseBookRepository.save(courseBook));
    }

    @Transactional
    public void deleteCourseBook(Long instituteId, Long id) {
        CourseBook courseBook = courseBookRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Course book not found with id: " + id));
        courseBookRepository.delete(courseBook);
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private void applyPayload(CourseBook courseBook, CourseBookPayload request) {
        courseBook.setClassName(request.className().trim());
        courseBook.setSubjectName(request.subjectName().trim());
        courseBook.setPublisher(request.publisher().trim());
        courseBook.setBookTitle(defaultValue(request.bookTitle(), request.subjectName()));
        courseBook.setLanguage(defaultValue(request.language(), "English"));
        courseBook.setAcademicYear(defaultValue(request.academicYear(), "2026-27"));
        courseBook.setIsbn(trim(request.isbn()));
        courseBook.setEdition(trim(request.edition()));
        courseBook.setPrimaryBook(request.primaryBook() == null || request.primaryBook());
        courseBook.setStatus(defaultValue(request.status(), "ACTIVE"));
        courseBook.setNotes(trim(request.notes()));
    }

    private CourseBookResponse toResponse(CourseBook courseBook) {
        Long classSubjectId = courseBook.getClassSubject() == null ? null : courseBook.getClassSubject().getId();
        Long subjectId = courseBook.getClassSubject() == null ? null : courseBook.getClassSubject().getSubject().getId();
        Long classId = courseBook.getClassSubject() == null ? null : courseBook.getClassSubject().getSchoolClass().getId();
        String className = courseBook.getClassSubject() == null ? courseBook.getClassName() : courseBook.getClassSubject().getSchoolClass().getName();
        String subjectName = courseBook.getClassSubject() == null ? courseBook.getSubjectName() : courseBook.getClassSubject().getSubject().getName();
        String subjectCode = courseBook.getClassSubject() == null ? null : courseBook.getClassSubject().getSubject().getCode();
        return new CourseBookResponse(
                courseBook.getId(),
                classSubjectId,
                subjectId,
                classId,
                className,
                subjectName,
                subjectCode,
                defaultValue(courseBook.getBookTitle(), subjectName),
                courseBook.getPublisher(),
                defaultValue(courseBook.getLanguage(), "English"),
                defaultValue(courseBook.getAcademicYear(), "2026-27"),
                courseBook.getIsbn(),
                courseBook.getEdition(),
                courseBook.getPrimaryBook() == null || courseBook.getPrimaryBook(),
                defaultValue(courseBook.getStatus(), "ACTIVE"),
                courseBook.getNotes(),
                courseBook.getCreatedAt(),
                courseBook.getUpdatedAt()
        );
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }
}
