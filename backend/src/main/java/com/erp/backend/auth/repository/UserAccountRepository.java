package com.erp.backend.auth.repository;

import java.util.Optional;
import java.util.List;

import com.erp.backend.auth.entity.UserAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    List<UserAccount> findAllByNormalizedLoginIdentifier(String normalizedLoginIdentifier);
    Optional<UserAccount> findByInstituteIdAndNormalizedLoginIdentifier(Long instituteId, String normalizedLoginIdentifier);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select account
            from UserAccount account
            where account.normalizedLoginIdentifier = :normalizedLoginIdentifier
            """)
    List<UserAccount> findAllByNormalizedLoginIdentifierForUpdate(
            @Param("normalizedLoginIdentifier") String normalizedLoginIdentifier
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select account
            from UserAccount account
            where account.institute.id = :instituteId
              and account.normalizedLoginIdentifier = :normalizedLoginIdentifier
            """)
    Optional<UserAccount> findByInstituteIdAndNormalizedLoginIdentifierForUpdate(
            @Param("instituteId") Long instituteId,
            @Param("normalizedLoginIdentifier") String normalizedLoginIdentifier
    );

    Optional<UserAccount> findByInstituteIdAndRole(Long instituteId, String role);

    Optional<UserAccount> findByInstituteIdAndTeacherId(Long instituteId, Long teacherId);

    Optional<UserAccount> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from UserAccount account where account.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") Long id);
}
