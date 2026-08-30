package com.erp.backend.cashbook.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.cashbook.entity.FinancialAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialAccountRepository extends JpaRepository<FinancialAccount, Long> {
    List<FinancialAccount> findAllByInstituteIdOrderByCreatedAtAsc(Long instituteId);

    Optional<FinancialAccount> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<FinancialAccount> findFirstByInstituteIdAndTypeAndStatusOrderByIdAsc(Long instituteId, String type, String status);

    Optional<FinancialAccount> findFirstByInstituteIdAndStatusOrderByIdAsc(Long instituteId, String status);
}
