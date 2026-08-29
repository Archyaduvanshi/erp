package com.erp.backend.library.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.library.entity.LibraryBook;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LibraryBookRepository extends JpaRepository<LibraryBook, Long> {

    List<LibraryBook> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<LibraryBook> findByInstituteIdAndId(Long instituteId, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from LibraryBook b where b.institute.id = :instituteId and b.id = :id")
    Optional<LibraryBook> findByInstituteIdAndIdForUpdate(@Param("instituteId") Long instituteId, @Param("id") Long id);

    boolean existsByInstituteIdAndNormalizedIsbnIgnoreCaseAndStatusNot(Long instituteId, String normalizedIsbn, String status);

    @Query(
            value = """
                    select b
                    from LibraryBook b
                    where b.institute.id = :instituteId
                      and (:status = '' or lower(coalesce(b.status, 'ACTIVE')) = lower(:status))
                      and (:format = '' or lower(coalesce(b.format, '')) = lower(:format))
                      and (:availability = '' or (:availability = 'available' and coalesce(b.availableCopies, b.availableQuantity, 0) > 0) or (:availability = 'unavailable' and coalesce(b.availableCopies, b.availableQuantity, 0) <= 0))
                      and (
                        :search = ''
                        or lower(concat(coalesce(b.isbn, ''), ' ', coalesce(b.title, ''), ' ', coalesce(b.author, ''), ' ', coalesce(b.shelfLocation, ''))) like lower(concat('%', :search, '%'))
                      )
                    order by b.title asc, b.createdAt desc
                    """,
            countQuery = """
                    select count(b)
                    from LibraryBook b
                    where b.institute.id = :instituteId
                      and (:status = '' or lower(coalesce(b.status, 'ACTIVE')) = lower(:status))
                      and (:format = '' or lower(coalesce(b.format, '')) = lower(:format))
                      and (:availability = '' or (:availability = 'available' and coalesce(b.availableCopies, b.availableQuantity, 0) > 0) or (:availability = 'unavailable' and coalesce(b.availableCopies, b.availableQuantity, 0) <= 0))
                      and (
                        :search = ''
                        or lower(concat(coalesce(b.isbn, ''), ' ', coalesce(b.title, ''), ' ', coalesce(b.author, ''), ' ', coalesce(b.shelfLocation, ''))) like lower(concat('%', :search, '%'))
                      )
                    """
    )
    Page<LibraryBook> searchBooks(
            @Param("instituteId") Long instituteId,
            @Param("search") String search,
            @Param("format") String format,
            @Param("availability") String availability,
            @Param("status") String status,
            Pageable pageable
    );
}
