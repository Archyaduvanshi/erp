package com.erp.backend.marks.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.erp.backend.marks.entity.StudentMark;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentMarkRepository extends JpaRepository<StudentMark, Long> {

    List<StudentMark> findAllByInstituteIdOrderByClassNameAscSubjectNameAscExamTitleAscCreatedAtAsc(Long instituteId);

    List<StudentMark> findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseOrderByExamTitleAscCreatedAtAsc(
            Long instituteId,
            String className,
            String subjectName
    );

    List<StudentMark> findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndExamTitleIn(
            Long instituteId,
            String className,
            String subjectName,
            Collection<String> examTitles
    );

    Optional<StudentMark> findByInstituteIdAndId(Long instituteId, Long id);
}
