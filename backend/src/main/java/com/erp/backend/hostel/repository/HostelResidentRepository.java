package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.hostel.dto.HostelMessSummaryProjection;
import com.erp.backend.hostel.dto.HostelOverviewProjection;
import com.erp.backend.hostel.dto.HostelResidentResponse;
import com.erp.backend.hostel.entity.HostelResident;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HostelResidentRepository extends JpaRepository<HostelResident, Long> {

    List<HostelResident> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<HostelResident> findByInstituteIdAndId(Long instituteId, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from HostelResident r where r.institute.id = :instituteId and r.id = :id")
    Optional<HostelResident> findByInstituteIdAndIdForUpdate(@Param("instituteId") Long instituteId, @Param("id") Long id);

    Optional<HostelResident> findByInstituteIdAndStudentId(Long instituteId, Long studentId);

    List<HostelResident> findAllByInstituteIdAndRoomId(Long instituteId, Long roomId);

    List<HostelResident> findAllByInstituteIdAndRoomHostelId(Long instituteId, Long hostelId);

    long countByInstituteIdAndRoomId(Long instituteId, Long roomId);

    long countByInstituteIdAndRoomHostelId(Long instituteId, Long hostelId);

    @Query("""
            select new com.erp.backend.hostel.dto.HostelOverviewProjection(
                (select count(h) from Hostel h where h.institute.id = :instituteId and lower(coalesce(h.status, 'active')) <> 'archived'),
                (select count(r) from HostelRoom r join r.hostel h where r.institute.id = :instituteId and lower(coalesce(r.status, 'available')) <> 'archived' and lower(coalesce(h.status, 'active')) <> 'archived'),
                (select coalesce(sum(coalesce(r.capacity, 0)), 0) from HostelRoom r join r.hostel h where r.institute.id = :instituteId and lower(coalesce(r.status, 'available')) <> 'archived' and lower(coalesce(h.status, 'active')) <> 'archived'),
                (select coalesce(sum(coalesce(r.occupiedBeds, 0)), 0) from HostelRoom r join r.hostel h where r.institute.id = :instituteId and lower(coalesce(r.status, 'available')) <> 'archived' and lower(coalesce(h.status, 'active')) <> 'archived'),
                (select count(a) from HostelResident a join a.room r join r.hostel h where a.institute.id = :instituteId and lower(coalesce(a.status, 'active')) = 'active' and a.checkOutDate is null and lower(coalesce(r.status, 'available')) <> 'archived' and lower(coalesce(h.status, 'active')) <> 'archived'),
                (select count(s) from Student s where s.institute.id = :instituteId and lower(coalesce(s.hostelStatus, '')) = 'requested')
            )
            from Institute i
            where i.id = :instituteId
            """)
    HostelOverviewProjection getOverview(@Param("instituteId") Long instituteId);

    @Query("""
            select new com.erp.backend.hostel.dto.HostelResidentResponse(
                a.id,
                s.id,
                coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo)),
                coalesce(s.className, s.assignedClass),
                s.section,
                s.enrollmentNo,
                h.id,
                h.hostelName,
                r.id,
                r.roomNumber,
                r.floorLabel,
                a.bedNumber,
                a.checkInDate,
                a.checkOutDate,
                a.monthlyCharge,
                a.guardianContact,
                coalesce(a.messFood, 'select'),
                a.emergencyContact,
                a.notes,
                coalesce(a.status, 'active'),
                a.createdAt,
                a.updatedAt
            )
            from HostelResident a
            join a.student s
            join a.room r
            join r.hostel h
            where a.institute.id = :instituteId
              and (:roomId is null or r.id = :roomId)
              and (:hostelId is null or h.id = :hostelId)
              and (:status = '' or lower(coalesce(a.status, '')) = lower(:status))
              and (
                :search = ''
                or lower(concat(
                    coalesce(s.firstName, ''), ' ',
                    coalesce(s.lastName, ''), ' ',
                    coalesce(s.name, ''), ' ',
                    coalesce(s.enrollmentNo, ''), ' ',
                    coalesce(r.roomNumber, '')
                )) like lower(concat('%', :search, '%'))
              )
            order by case when lower(coalesce(a.status, 'active')) = 'active' and a.checkOutDate is null then 0 else 1 end,
                     h.hostelName asc, r.roomNumber asc, a.checkInDate desc
            """)
    Page<HostelResidentResponse> findResidentResponses(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId,
            @Param("roomId") Long roomId,
            @Param("status") String status,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select a
            from HostelResident a
            join fetch a.student
            join fetch a.room r
            join fetch r.hostel
            where a.institute.id = :instituteId
              and r.id = :roomId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    List<HostelResident> findActiveAllocationsForRoom(
            @Param("instituteId") Long instituteId,
            @Param("roomId") Long roomId
    );

    @Query("""
            select count(a)
            from HostelResident a
            where a.institute.id = :instituteId
              and a.room.id = :roomId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    long countActiveAllocationsForRoom(
            @Param("instituteId") Long instituteId,
            @Param("roomId") Long roomId
    );

    @Query("""
            select case when count(a) > 0 then true else false end
            from HostelResident a
            where a.institute.id = :instituteId
              and a.room.hostel.id = :hostelId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    boolean existsActiveAllocationByHostel(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId
    );

    @Query("""
            select new com.erp.backend.hostel.dto.HostelResidentResponse(
                a.id,
                s.id,
                coalesce(nullif(trim(concat(coalesce(s.firstName, ''), ' ', coalesce(s.lastName, ''))), ''), coalesce(s.name, s.enrollmentNo)),
                coalesce(s.className, s.assignedClass),
                s.section,
                s.enrollmentNo,
                h.id,
                h.hostelName,
                r.id,
                r.roomNumber,
                r.floorLabel,
                a.bedNumber,
                a.checkInDate,
                a.checkOutDate,
                a.monthlyCharge,
                a.guardianContact,
                coalesce(a.messFood, 'select'),
                a.emergencyContact,
                a.notes,
                coalesce(a.status, 'active'),
                a.createdAt,
                a.updatedAt
            )
            from HostelResident a
            join a.student s
            join a.room r
            join r.hostel h
            where a.institute.id = :instituteId
              and s.id = :studentId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
              and lower(coalesce(r.status, 'available')) <> 'archived'
              and lower(coalesce(h.status, 'active')) <> 'archived'
            order by a.checkInDate desc, a.createdAt desc
            """)
    List<HostelResidentResponse> findStudentResidentResponses(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            Pageable pageable
    );

    @Query("""
            select case when count(a) > 0 then true else false end
            from HostelResident a
            where a.institute.id = :instituteId
              and a.student.id = :studentId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    boolean existsActiveAllocationByStudent(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId
    );

    @Query("""
            select case when count(a) > 0 then true else false end
            from HostelResident a
            where a.institute.id = :instituteId
              and a.room.id = :roomId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    boolean existsActiveAllocationByRoom(
            @Param("instituteId") Long instituteId,
            @Param("roomId") Long roomId
    );

    @Query("""
            select new com.erp.backend.hostel.dto.HostelMessSummaryProjection(
                count(a),
                coalesce(sum(case when lower(coalesce(a.messFood, 'select')) = 'vegetarian' then 1L else 0L end), 0L),
                coalesce(sum(case when lower(coalesce(a.messFood, 'select')) = 'non-vegetarian' then 1L else 0L end), 0L),
                coalesce(sum(case when lower(coalesce(a.messFood, 'select')) not in ('vegetarian', 'non-vegetarian') then 1L else 0L end), 0L)
            )
            from HostelResident a
            join a.room r
            join r.hostel h
            where a.institute.id = :instituteId
              and h.id = :hostelId
              and lower(coalesce(a.status, 'active')) = 'active'
              and a.checkOutDate is null
            """)
    HostelMessSummaryProjection getMessSummary(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId
    );
}
