package com.erp.backend.institute.repository;

import java.util.Optional;

import com.erp.backend.institute.entity.Institute;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InstituteRepository extends JpaRepository<Institute, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select i from Institute i where i.id = :id")
    Optional<Institute> findByIdForGatewayUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByAffiliationNoIgnoreCase(String affiliationNo);

    Optional<Institute> findByUsernameIgnoreCase(String username);
}
