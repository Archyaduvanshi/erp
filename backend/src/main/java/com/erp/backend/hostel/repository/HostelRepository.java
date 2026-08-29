package com.erp.backend.hostel.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.erp.backend.hostel.dto.HostelResponse;
import com.erp.backend.hostel.entity.Hostel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HostelRepository extends JpaRepository<Hostel, Long> {

    List<Hostel> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    List<Hostel> findAllByInstituteIdAndIdIn(Long instituteId, Set<Long> ids);

    Optional<Hostel> findByInstituteIdAndId(Long instituteId, Long id);

    @Query("""
            select h
            from Hostel h
            where h.institute.id = :instituteId
              and h.id = :hostelId
              and lower(coalesce(h.status, 'active')) = 'active'
            """)
    Optional<Hostel> findActiveHostel(
            @Param("instituteId") Long instituteId,
            @Param("hostelId") Long hostelId
    );

    @Query("""
            select h
            from Hostel h
            where h.institute.id = :instituteId
              and h.id in :ids
              and lower(coalesce(h.status, 'active')) = 'active'
            """)
    List<Hostel> findActiveHostelsByInstituteIdAndIdIn(
            @Param("instituteId") Long instituteId,
            @Param("ids") Set<Long> ids
    );

    @Query("""
            select new com.erp.backend.hostel.dto.HostelResponse(
                h.id,
                h.hostelName,
                coalesce(h.hostelType, 'boys'),
                h.totalFloors,
                h.wardenName,
                h.contactNumber,
                coalesce(h.status, 'active'),
                count(r.id),
                coalesce(sum(coalesce(r.capacity, 0)), 0),
                coalesce(sum(coalesce(r.occupiedBeds, 0)), 0),
                coalesce(sum(coalesce(r.capacity, 0)), 0) - coalesce(sum(coalesce(r.occupiedBeds, 0)), 0),
                h.createdAt,
                h.updatedAt
            )
            from Hostel h
            left join HostelRoom r
             on r.hostel.id = h.id
             and r.institute.id = h.institute.id
             and lower(coalesce(r.status, 'available')) <> 'archived'
            where h.institute.id = :instituteId
              and lower(coalesce(h.status, 'active')) <> 'archived'
            group by h.id, h.hostelName, h.hostelType, h.totalFloors, h.wardenName,
                     h.contactNumber, h.status, h.createdAt, h.updatedAt
            order by lower(h.hostelName) asc
            """)
    List<HostelResponse> findHostelList(@Param("instituteId") Long instituteId);

    @Query("""
            select case when count(h) > 0 then true else false end
            from Hostel h
            where h.institute.id = :instituteId
              and lower(h.hostelName) = lower(:hostelName)
              and lower(coalesce(h.status, 'active')) <> 'archived'
            """)
    boolean existsNonArchivedByInstituteIdAndHostelNameIgnoreCase(
            @Param("instituteId") Long instituteId,
            @Param("hostelName") String hostelName
    );
}
