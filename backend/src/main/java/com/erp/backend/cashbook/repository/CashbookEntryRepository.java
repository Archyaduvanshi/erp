package com.erp.backend.cashbook.repository;

import java.util.Optional;

import com.erp.backend.cashbook.entity.CashbookEntry;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashbookEntryRepository extends JpaRepository<CashbookEntry, Long> {
    Optional<CashbookEntry> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<CashbookEntry> findByInstituteIdAndSourceTypeAndSourceIdAndReversalOfEntryIsNull(Long instituteId, String sourceType, Long sourceId);

    Optional<CashbookEntry> findByInstituteIdAndIdempotencyKey(Long instituteId, String idempotencyKey);
}
