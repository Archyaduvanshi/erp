package com.erp.backend.student.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.attendance.dto.AttendanceStudentResponse;
import com.erp.backend.curriculum.dto.SectionOccupancyRow;
import com.erp.backend.fee.dto.FeeStudentSearchResponse;
import com.erp.backend.hostel.dto.HostelStudentSearchResponse;
import com.erp.backend.student.dto.StudentClassSummaryResponse;
import com.erp.backend.student.dto.StudentListResponse;
import com.erp.backend.student.entity.Student;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

public interface StudentRepository extends JpaRepository<Student, Long> {

    List<Student> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<Student> findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByFirstNameAscLastNameAscCreatedAtAsc(Long instituteId, String assignedClass);

    Optional<Student> findByInstituteIdAndId(Long instituteId, Long id);

    @Query("""
            select s
            from Student s
            left join fetch s.schoolClass
            left join fetch s.classSection cs
            left join fetch cs.schoolClass
            where s.institute.id = :instituteId
              and s.id = :id
            """)
    Optional<Student> findByInstituteIdAndIdWithClassAndSection(@Param("instituteId") Long instituteId, @Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Student s where s.institute.id = :instituteId and s.id = :id")
    Optional<Student> findByInstituteIdAndIdForUpdate(@Param("instituteId") Long instituteId, @Param("id") Long id);

    Optional<Student> findByInstituteIdAndEnrollmentNoIgnoreCase(Long instituteId, String enrollmentNo);

    List<Student> findAllByEnrollmentNoIgnoreCase(String enrollmentNo);

    List<Student> findAllByInstituteIdAndIdIn(Long instituteId, List<Long> ids);

    List<Student> findAllByInstituteIdAndIdIn(Long instituteId, Set<Long> ids);

    List<Student> findAllByEnrollmentNoIgnoreCaseOrMobile(String enrollmentNo, String mobile);

    boolean existsByInstituteIdAndEmailIgnoreCase(Long instituteId, String email);

    boolean existsByInstituteIdAndEmailIgnoreCaseAndIdNot(Long instituteId, String email, Long id);

    boolean existsByInstituteIdAndEnrollmentNoIgnoreCase(Long instituteId, String enrollmentNo);

    boolean existsByInstituteIdAndEnrollmentNoIgnoreCaseAndIdNot(Long instituteId, String enrollmentNo, Long id);

    long countByInstituteId(Long instituteId);

    @Query("""
            select count(s)
            from Student s
            where s.institute.id = :instituteId
              and s.classSection.id = :sectionId
              and lower(coalesce(s.status, 'verified')) not in ('archived', 'inactive', 'left', 'transferred', 'cancelled')
            """)
    long countSeatConsumingByInstituteIdAndSectionId(
            @Param("instituteId") Long instituteId,
            @Param("sectionId") Long sectionId
    );

    @Query("""
            select count(s)
            from Student s
            where s.institute.id = :instituteId
              and s.classSection.id = :sectionId
              and s.id <> :studentId
              and lower(coalesce(s.status, 'verified')) not in ('archived', 'inactive', 'left', 'transferred', 'cancelled')
            """)
    long countSeatConsumingByInstituteIdAndSectionIdExcludingStudent(
            @Param("instituteId") Long instituteId,
            @Param("sectionId") Long sectionId,
            @Param("studentId") Long studentId
    );

    @Query("""
            select new com.erp.backend.curriculum.dto.SectionOccupancyRow(
                sec.id,
                count(s.id)
            )
            from ClassSection sec
            left join Student s on s.classSection = sec
                and s.institute.id = :instituteId
                and lower(coalesce(s.status, 'verified')) not in ('archived', 'inactive', 'left', 'transferred', 'cancelled')
            where sec.institute.id = :instituteId
            group by sec.id
            """)
    List<SectionOccupancyRow> findSectionOccupancy(@Param("instituteId") Long instituteId);

    @Query("""
            select new com.erp.backend.student.dto.StudentClassSummaryResponse(
                coalesce(s.assignedClass, 'Unassigned'),
                count(s),
                coalesce(sum(case when lower(coalesce(s.status, '')) = 'verified' then 1L else 0L end), 0L)
            )
            from Student s
            where s.institute.id = :instituteId
            group by coalesce(s.assignedClass, 'Unassigned')
            order by coalesce(s.assignedClass, 'Unassigned')
            """)
    List<StudentClassSummaryResponse> findClassSummaries(@Param("instituteId") Long instituteId);

    @Query("""
            select distinct coalesce(s.assignedClass, s.className)
            from Student s
            where s.institute.id = :instituteId
              and coalesce(s.assignedClass, s.className) is not null
            """)
    List<String> findDistinctClassLabels(@Param("instituteId") Long instituteId);

    @Query(
            value = """
                    select new com.erp.backend.fee.dto.FeeStudentSearchResponse(
                        s.id,
                        s.enrollmentNo,
                        coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo)),
                        coalesce(s.className, s.assignedClass),
                        s.section,
                        coalesce(s.admissionCategory, s.category, 'General'),
                        coalesce(s.status, 'ACTIVE'),
                        s.transportStatus,
                        s.hostelStatus,
                        s.libraryStatus,
                        s.libraryMonthlyCharge
                    )
                    from Student s
                    where s.institute.id = :instituteId
                      and (:className = '' or lower(coalesce(s.className, s.assignedClass, '')) = lower(:className))
                      and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                      and lower(coalesce(s.status, '')) <> 'archived'
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.guardianPhone, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    order by s.firstName asc, s.lastName asc, s.enrollmentNo asc
                    """,
            countQuery = """
                    select count(s)
                    from Student s
                    where s.institute.id = :instituteId
                      and (:className = '' or lower(coalesce(s.className, s.assignedClass, '')) = lower(:className))
                      and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                      and lower(coalesce(s.status, '')) <> 'archived'
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.guardianPhone, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    """
    )
    Page<FeeStudentSearchResponse> searchFeeStudents(
            @Param("instituteId") Long instituteId,
            @Param("search") String search,
            @Param("className") String className,
            @Param("section") String section,
            Pageable pageable
    );

    @Query("""
            select s
            from Student s
            where s.institute.id = :instituteId
              and lower(coalesce(s.status, 'ACTIVE')) <> 'archived'
              and (
                lower(coalesce(s.className, '')) = lower(:className)
                or lower(coalesce(s.assignedClass, '')) = lower(:className)
                or lower(coalesce(s.assignedClass, '')) like lower(concat(:className, '/%'))
              )
            order by s.id asc
            """)
    List<Student> findFeeChargeCandidatesByClass(
            @Param("instituteId") Long instituteId,
            @Param("className") String className
    );

    @Query(
            value = """
                    select new com.erp.backend.student.dto.StudentListResponse(
                        s.id,
                        s.enrollmentNo,
                        s.firstName,
                        s.lastName,
                        s.name,
                        s.photoUrl,
                        s.assignedClass,
                        s.className,
                        s.section,
                        s.rollNo,
                        s.mobile,
                        s.email,
                        s.academicYear,
                        s.status,
                        s.transportOptIn,
                        s.hostelOptIn,
                        s.libraryOptIn,
                        s.transportStatus,
                        s.hostelStatus,
                        s.libraryStatus,
                        s.createdAt,
                        s.updatedAt
                    )
                    from Student s
                    where s.institute.id = :instituteId
                      and (:assignedClass = '' or lower(coalesce(s.assignedClass, '')) = lower(:assignedClass))
                      and (:status = '' or lower(coalesce(s.status, '')) = lower(:status))
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.email, ''), ' ',
                            coalesce(s.guardianName, ''), ' ',
                            coalesce(s.rollNo, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    """,
            countQuery = """
                    select count(s)
                    from Student s
                    where s.institute.id = :instituteId
                      and (:assignedClass = '' or lower(coalesce(s.assignedClass, '')) = lower(:assignedClass))
                      and (:status = '' or lower(coalesce(s.status, '')) = lower(:status))
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.email, ''), ' ',
                            coalesce(s.guardianName, ''), ' ',
                            coalesce(s.rollNo, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    """
    )
    Page<StudentListResponse> findStudentList(
            @Param("instituteId") Long instituteId,
            @Param("assignedClass") String assignedClass,
            @Param("search") String search,
            @Param("status") String status,
            Pageable pageable
    );

    @Query(
            value = """
                    select new com.erp.backend.hostel.dto.HostelStudentSearchResponse(
                        s.id,
                        s.enrollmentNo,
                        coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo)),
                        coalesce(s.className, s.assignedClass),
                        s.section,
                        s.guardianName,
                        s.guardianPhone,
                        coalesce(s.hostelStatus, case when lower(coalesce(s.hostelOptIn, 'no')) in ('yes', 'true') then 'requested' else 'not_requested' end),
                        case when count(a.id) > 0 then true else false end
                    )
                    from Student s
                    left join HostelResident a
                      on a.student.id = s.id
                     and a.institute.id = s.institute.id
                     and lower(coalesce(a.status, 'active')) = 'active'
                     and a.checkOutDate is null
                    where s.institute.id = :instituteId
                      and (:className = '' or lower(coalesce(s.className, s.assignedClass, '')) = lower(:className))
                      and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.guardianName, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    group by s.id, s.enrollmentNo, s.firstName, s.lastName, s.name, s.className,
                             s.assignedClass, s.section, s.guardianName, s.guardianPhone, s.hostelStatus, s.hostelOptIn
                    """,
            countQuery = """
                    select count(s)
                    from Student s
                    where s.institute.id = :instituteId
                      and (:className = '' or lower(coalesce(s.className, s.assignedClass, '')) = lower(:className))
                      and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
                      and (
                        :search = ''
                        or lower(concat(
                            coalesce(s.firstName, ''), ' ',
                            coalesce(s.lastName, ''), ' ',
                            coalesce(s.name, ''), ' ',
                            coalesce(s.enrollmentNo, ''), ' ',
                            coalesce(s.mobile, ''), ' ',
                            coalesce(s.guardianName, '')
                        )) like lower(concat('%', :search, '%'))
                      )
                    """
    )
    Page<HostelStudentSearchResponse> searchHostelStudents(
            @Param("instituteId") Long instituteId,
            @Param("search") String search,
            @Param("className") String className,
            @Param("section") String section,
            Pageable pageable
    );

    List<Student> findAllByInstituteIdAndAssignedClassIgnoreCaseOrderByCreatedAtAsc(Long instituteId, String assignedClass);

    @Query("""
            select s
            from Student s
            where s.institute.id = :instituteId
              and (
                (:classId is not null and s.schoolClass is not null and s.schoolClass.id = :classId)
                or lower(coalesce(s.assignedClass, s.className, '')) = lower(:className)
                or lower(coalesce(s.className, '')) = lower(:baseClassName)
              )
              and (:section = '' or lower(coalesce(s.section, '')) = lower(:section))
              and lower(coalesce(s.status, '')) <> 'archived'
            order by s.rollNo asc, s.firstName asc, s.lastName asc, s.createdAt asc
            """)
    List<Student> findActiveExamCandidates(
            @Param("instituteId") Long instituteId,
            @Param("classId") Long classId,
            @Param("className") String className,
            @Param("baseClassName") String baseClassName,
            @Param("section") String section
    );

    @Query("""
            select new com.erp.backend.attendance.dto.AttendanceStudentResponse(
                s.id,
                coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, 'Unnamed Student')),
                coalesce(s.rollNo, s.enrollmentNo),
                s.enrollmentNo
            )
            from Student s
            where s.institute.id = :instituteId
              and lower(coalesce(s.assignedClass, s.className, '')) = lower(:assignedClass)
              and lower(coalesce(s.status, '')) <> 'archived'
            order by s.rollNo asc, s.firstName asc, s.lastName asc, s.createdAt asc
            """)
    List<AttendanceStudentResponse> findAttendanceStudents(
            @Param("instituteId") Long instituteId,
            @Param("assignedClass") String assignedClass
    );
}
