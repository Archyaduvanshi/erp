package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.hostel.dto.HostelRoomResponse;
import com.erp.backend.hostel.entity.HostelRoom;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HostelRoomRepository extends JpaRepository<HostelRoom, Long> {

    List<HostelRoom> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<HostelRoom> findByInstituteIdAndId(Long instituteId, Long id);

    List<HostelRoom> findAllByInstituteIdAndHostelIdOrderByCreatedAtDesc(Long instituteId, Long hostelId);

    @Query("""
            select new com.erp.backend.hostel.dto.HostelRoomResponse(
                r.id,
                h.id,
                h.hostelName,
                coalesce(h.hostelType, 'boys'),
                r.roomNumber,
                r.floorLabel,
                r.roomType,
                coalesce(r.acType, 'non-ac'),
                r.capacity,
                coalesce(r.occupiedBeds, 0),
                r.monthlyCharge,
                r.amenities,
                coalesce(r.status, 'available'),
                r.createdAt,
                r.updatedAt
            )
            from HostelRoom r
            join r.hostel h
            where r.institute.id = :instituteId
              and lower(coalesce(r.status, 'available')) <> 'archived'
              and lower(coalesce(h.status, 'active')) <> 'archived'
              and (:hostelId is null or h.id = :hostelId)
              and (:floor = '' or lower(coalesce(r.floorLabel, '')) = lower(:floor))
              and (:status = '' or lower(coalesce(r.status, '')) = lower(:status))
            order by lower(h.hostelName) asc, r.floorLabel asc, r.roomNumber asc
            """)
    List<HostelRoomResponse> findRoomResponses(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId,
            @Param("floor") String floor,
            @Param("status") String status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select r
            from HostelRoom r
            join fetch r.hostel h
            join fetch r.institute i
            where r.institute.id = :instituteId
              and r.id = :roomId
            """)
    Optional<HostelRoom> findByInstituteIdAndIdForUpdate(
            @Param("instituteId") Long instituteId,
            @Param("roomId") Long roomId
    );

    boolean existsByInstituteIdAndHostelId(Long instituteId, Long hostelId);

    @Query("""
            select case when count(r) > 0 then true else false end
            from HostelRoom r
            where r.institute.id = :instituteId
              and r.hostel.id = :hostelId
              and lower(r.roomNumber) = lower(:roomNumber)
              and (:excludedRoomId is null or r.id <> :excludedRoomId)
              and lower(coalesce(r.status, 'available')) <> 'archived'
            """)
    boolean existsNonArchivedByInstituteIdAndHostelIdAndRoomNumberIgnoreCase(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId,
            @Param("roomNumber") String roomNumber,
            @Param("excludedRoomId") Long excludedRoomId
    );
}
