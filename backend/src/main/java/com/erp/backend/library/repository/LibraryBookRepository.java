package com.erp.backend.library.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.library.entity.LibraryBook;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LibraryBookRepository extends JpaRepository<LibraryBook, Long> {

    List<LibraryBook> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<LibraryBook> findByInstituteIdAndId(Long instituteId, Long id);
}
