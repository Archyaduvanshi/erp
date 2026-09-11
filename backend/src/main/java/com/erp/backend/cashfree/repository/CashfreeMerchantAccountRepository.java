package com.erp.backend.cashfree.repository;

import java.util.Optional;

import com.erp.backend.cashfree.entity.CashfreeMerchantAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashfreeMerchantAccountRepository extends JpaRepository<CashfreeMerchantAccount, Long> {
    @org.springframework.data.jpa.repository.Query("select a from CashfreeMerchantAccount a where a.institute.id = :instituteId and a.current = true")
    Optional<CashfreeMerchantAccount> findByInstituteId(@org.springframework.data.repository.query.Param("instituteId") Long instituteId);
    Optional<CashfreeMerchantAccount> findByMerchantId(String merchantId);
}
