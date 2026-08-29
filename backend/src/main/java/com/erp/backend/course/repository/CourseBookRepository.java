package com.erp.backend.course.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.course.entity.CourseBook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CourseBookRepository extends JpaRepository<CourseBook, Long> {

    List<CourseBook> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<CourseBook> findByInstituteIdAndId(Long instituteId, Long id);

    List<CourseBook> findAllByInstituteIdAndClassSubjectIdOrderByPrimaryBookDescBookTitleAscSubjectNameAsc(Long instituteId, Long classSubjectId);

    @Query("select distinct cb.className from CourseBook cb where cb.institute.id = :instituteId and cb.className is not null")
    List<String> findDistinctClassNames(@Param("instituteId") Long instituteId);

    @Query("select cb from CourseBook cb where cb.institute.id = :instituteId and cb.classSubject is null")
    List<CourseBook> findLegacyRows(@Param("instituteId") Long instituteId);

    boolean existsByInstituteIdAndClassSubjectIdAndBookTitleIgnoreCaseAndPublisherIgnoreCase(Long instituteId, Long classSubjectId, String bookTitle, String publisher);
}
