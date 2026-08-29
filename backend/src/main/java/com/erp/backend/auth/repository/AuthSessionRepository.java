package com.erp.backend.auth.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.auth.entity.AuthSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

public interface AuthSessionRepository extends JpaRepository<AuthSession, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<AuthSession> findByRefreshTokenHash(String refreshTokenHash);

    List<AuthSession> findAllByAccountIdAndRevokedAtIsNullOrderByCreatedAtAsc(Long accountId);
}
