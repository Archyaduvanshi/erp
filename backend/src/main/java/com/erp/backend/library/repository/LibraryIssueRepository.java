package com.erp.backend.library.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.library.entity.LibraryIssue;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LibraryIssueRepository extends JpaRepository<LibraryIssue, Long> {

    List<LibraryIssue> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<LibraryIssue> findByInstituteIdAndId(Long instituteId, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from LibraryIssue i where i.institute.id = :instituteId and i.id = :id")
    Optional<LibraryIssue> findByInstituteIdAndIdForUpdate(@Param("instituteId") Long instituteId, @Param("id") Long id);

    boolean existsByInstituteIdAndBookIdAndReturnDateIsNull(Long instituteId, Long bookId);

    boolean existsByInstituteIdAndBookIdAndStatus(Long instituteId, Long bookId, String status);

    boolean existsByInstituteIdAndBookId(Long instituteId, Long bookId);

    long countByInstituteIdAndBorrowerIdAndStatus(Long instituteId, Long borrowerId, String status);

    boolean existsByInstituteIdAndBorrowerIdAndStatusAndDueDateBefore(Long instituteId, Long borrowerId, String status, java.time.LocalDate date);

    boolean existsByInstituteIdAndBorrowerIdAndBookIdAndStatus(Long instituteId, Long borrowerId, Long bookId, String status);
}
