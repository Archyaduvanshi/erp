package com.erp.backend.cashfree.repository;

import java.util.Optional;

import com.erp.backend.cashfree.entity.CashfreeMerchantAccount;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CashfreeMerchantAccountRepository extends JpaRepository<CashfreeMerchantAccount, Long> {
    Optional<CashfreeMerchantAccount> findByInstituteId(Long instituteId);
    Optional<CashfreeMerchantAccount> findByMerchantId(String merchantId);
}
