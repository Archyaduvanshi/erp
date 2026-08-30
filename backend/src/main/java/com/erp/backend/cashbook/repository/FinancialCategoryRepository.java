package com.erp.backend.cashbook.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.cashbook.entity.FinancialCategory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialCategoryRepository extends JpaRepository<FinancialCategory, Long> {
    List<FinancialCategory> findAllByInstituteIdOrderByTypeAscNameAsc(Long instituteId);

    Optional<FinancialCategory> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<FinancialCategory> findByInstituteIdAndTypeAndCodeIgnoreCase(Long instituteId, String type, String code);
}
