package com.erp.backend.platform.auth.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.platform.auth.entity.PlatformAuthSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformAuthSessionRepository extends JpaRepository<PlatformAuthSession, Long> {
    Optional<PlatformAuthSession> findByRefreshTokenHash(String refreshTokenHash);
    List<PlatformAuthSession> findAllByPlatformUserIdAndRevokedAtIsNullOrderByCreatedAtAsc(Long platformUserId);
}
