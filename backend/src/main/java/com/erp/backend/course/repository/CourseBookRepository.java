package com.erp.backend.course.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.course.entity.CourseBook;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseBookRepository extends JpaRepository<CourseBook, Long> {

    List<CourseBook> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<CourseBook> findByInstituteIdAndId(Long instituteId, Long id);
}
