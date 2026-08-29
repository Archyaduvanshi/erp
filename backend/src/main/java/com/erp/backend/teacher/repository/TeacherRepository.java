package com.erp.backend.teacher.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.teacher.dto.TeacherListResponse;
import com.erp.backend.teacher.dto.TeacherOptionResponse;
import com.erp.backend.teacher.entity.Teacher;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {

    List<Teacher> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<Teacher> findByInstituteIdAndId(Long instituteId, Long id);

    List<Teacher> findAllByInstituteIdAndIdIn(Long instituteId, Set<Long> ids);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select t
            from Teacher t
            where t.institute.id = :instituteId
              and t.id in :ids
            order by t.id asc
            """)
    List<Teacher> lockAllByInstituteIdAndIdIn(@Param("instituteId") Long instituteId, @Param("ids") Set<Long> ids);

    List<Teacher> findAllByEmployeeIdIgnoreCaseOrMobileNumber(String employeeId, String mobileNumber);

    List<Teacher> findAllByEmployeeIdIgnoreCase(String employeeId);

    Optional<Teacher> findByInstituteIdAndEmployeeIdIgnoreCase(Long instituteId, String employeeId);

    boolean existsByInstituteIdAndEmployeeIdIgnoreCase(Long instituteId, String employeeId);

    boolean existsByInstituteIdAndEmployeeIdIgnoreCaseAndIdNot(Long instituteId, String employeeId, Long id);

    boolean existsByInstituteIdAndPersonalEmailIgnoreCase(Long instituteId, String personalEmail);

    boolean existsByInstituteIdAndPersonalEmailIgnoreCaseAndIdNot(Long instituteId, String personalEmail, Long id);

    boolean existsByInstituteIdAndMobileNumber(Long instituteId, String mobileNumber);

    boolean existsByInstituteIdAndMobileNumberAndIdNot(Long instituteId, String mobileNumber, Long id);

    long countByInstituteId(Long instituteId);

    @Query(
            value = """
                    select new com.erp.backend.teacher.dto.TeacherListResponse(
                        t.id,
                        t.employeeId,
                        t.name,
                        t.firstName,
                        t.lastName,
                        t.photoUrl,
                        t.mobileNumber,
                        t.personalEmail,
                        t.specialization,
                        t.contractType,
                        t.status,
                        t.createdAt,
                        t.updatedAt
                    )
                    from Teacher t
                    where t.institute.id = :instituteId
                      and (:search = ''
                        or lower(concat(
                            coalesce(t.firstName, ''), ' ',
                            coalesce(t.lastName, ''), ' ',
                            coalesce(t.name, ''), ' ',
                            coalesce(t.employeeId, ''), ' ',
                            coalesce(t.mobileNumber, ''), ' ',
                            coalesce(t.personalEmail, ''), ' ',
                            coalesce(t.specialization, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                      and (:status = '' or lower(coalesce(t.status, '')) = lower(:status))
                      and (:specialization = '' or lower(coalesce(t.specialization, '')) like lower(concat('%', :specialization, '%')))
                      and (:contractType = '' or lower(coalesce(t.contractType, '')) = lower(:contractType))
                    """,
            countQuery = """
                    select count(t)
                    from Teacher t
                    where t.institute.id = :instituteId
                      and (:search = ''
                        or lower(concat(
                            coalesce(t.firstName, ''), ' ',
                            coalesce(t.lastName, ''), ' ',
                            coalesce(t.name, ''), ' ',
                            coalesce(t.employeeId, ''), ' ',
                            coalesce(t.mobileNumber, ''), ' ',
                            coalesce(t.personalEmail, ''), ' ',
                            coalesce(t.specialization, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                      and (:status = '' or lower(coalesce(t.status, '')) = lower(:status))
                      and (:specialization = '' or lower(coalesce(t.specialization, '')) like lower(concat('%', :specialization, '%')))
                      and (:contractType = '' or lower(coalesce(t.contractType, '')) = lower(:contractType))
                    """
    )
    Page<TeacherListResponse> findTeacherList(
            @Param("instituteId") Long instituteId,
            @Param("search") String search,
            @Param("status") String status,
            @Param("specialization") String specialization,
            @Param("contractType") String contractType,
            Pageable pageable
    );

    @Query("""
            select new com.erp.backend.teacher.dto.TeacherOptionResponse(
                t.id,
                t.employeeId,
                coalesce(nullif(trim(concat(coalesce(t.firstName, ''), ' ', coalesce(t.lastName, ''))), ''), coalesce(t.name, 'Unnamed Teacher'))
            )
            from Teacher t
            where t.institute.id = :instituteId
              and (:status = '' or lower(coalesce(t.status, '')) = lower(:status))
            order by t.firstName asc, t.lastName asc, t.name asc
            """)
    List<TeacherOptionResponse> findTeacherOptions(@Param("instituteId") Long instituteId, @Param("status") String status);
}
