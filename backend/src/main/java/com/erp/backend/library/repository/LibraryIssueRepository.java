package com.erp.backend.library.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.library.entity.LibraryIssue;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LibraryIssueRepository extends JpaRepository<LibraryIssue, Long> {

    List<LibraryIssue> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<LibraryIssue> findByInstituteIdAndId(Long instituteId, Long id);

    boolean existsByInstituteIdAndBookIdAndReturnDateIsNull(Long instituteId, Long bookId);
}
