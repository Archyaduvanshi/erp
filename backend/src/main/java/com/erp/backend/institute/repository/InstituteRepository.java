package com.erp.backend.institute.repository;

import java.util.Optional;

import com.erp.backend.institute.entity.Institute;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InstituteRepository extends JpaRepository<Institute, Long> {

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByAffiliationNoIgnoreCase(String affiliationNo);

    Optional<Institute> findByUsernameIgnoreCase(String username);
}
