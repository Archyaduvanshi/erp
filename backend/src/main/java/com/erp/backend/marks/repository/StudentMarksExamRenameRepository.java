package com.erp.backend.marks.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.marks.entity.StudentMarksExamRename;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudentMarksExamRenameRepository extends JpaRepository<StudentMarksExamRename, Long> {

    List<StudentMarksExamRename> findAllByInstituteIdOrderByClassNameAscSubjectNameAscOldTitleAsc(Long instituteId);

    Optional<StudentMarksExamRename> findByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndOldTitleIgnoreCase(
            Long instituteId,
            String className,
            String subjectName,
            String oldTitle
    );

    List<StudentMarksExamRename> findAllByInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndOldTitleIgnoreCaseOrInstituteIdAndClassNameIgnoreCaseAndSubjectNameIgnoreCaseAndNewTitleIgnoreCase(
            Long instituteIdForOldTitle,
            String classNameForOldTitle,
            String subjectNameForOldTitle,
            String oldTitle,
            Long instituteIdForNewTitle,
            String classNameForNewTitle,
            String subjectNameForNewTitle,
            String newTitle
    );
}
