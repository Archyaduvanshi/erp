package com.erp.backend.platform.auth.repository;

import java.util.Optional;

import com.erp.backend.platform.auth.entity.PlatformUser;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface PlatformUserRepository extends JpaRepository<PlatformUser, Long> {
    Optional<PlatformUser> findByNormalizedUsername(String normalizedUsername);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PlatformUser> findForUpdateByNormalizedUsername(String normalizedUsername);
}
