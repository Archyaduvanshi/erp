package com.erp.backend.notice.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.notice.dto.NoticeListResponse;
import com.erp.backend.notice.dto.PortalNoticeResponse;
import com.erp.backend.notice.entity.Notice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<Notice> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<Notice> findByInstituteIdAndSourceTypeAndSourceId(Long instituteId, String sourceType, Long sourceId);

    void deleteByInstituteIdAndSourceTypeAndSourceId(Long instituteId, String sourceType, Long sourceId);

    @Query(
            value = """
                    select new com.erp.backend.notice.dto.NoticeListResponse(
                        n.id,
                        n.title,
                        n.category,
                        n.audience,
                        n.priority,
                        n.publishDate,
                        n.expireDate,
                        n.status,
                        '',
                        n.pinned,
                        n.summary,
                        n.sourceType,
                        n.sourceId,
                        n.createdAt,
                        n.updatedAt
                    )
                    from Notice n
                    where n.institute.id = :instituteId
                      and n.targetStudentId is null
                      and n.targetTeacherId is null
                      and (n.sourceType is null or trim(n.sourceType) = '')
                      and (
                        :status = ''
                        or (:status = 'SCHEDULED' and upper(n.status) = 'PUBLISHED' and n.publishDate > current_date)
                        or (:status = 'EXPIRED' and upper(n.status) = 'PUBLISHED' and n.expireDate is not null and n.expireDate < current_date)
                        or (:status in ('DRAFT', 'PUBLISHED', 'ARCHIVED') and upper(n.status) = :status)
                      )
                      and (:audience = '' or upper(n.audience) = :audience)
                      and (:priority = '' or upper(n.priority) = :priority)
                      and (:category = '' or lower(n.category) = lower(:category))
                      and (
                        :search = ''
                        or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                           like lower(concat('%', :search, '%'))
                      )
                    """,
            countQuery = """
                    select count(n)
                    from Notice n
                    where n.institute.id = :instituteId
                      and n.targetStudentId is null
                      and n.targetTeacherId is null
                      and (n.sourceType is null or trim(n.sourceType) = '')
                      and (
                        :status = ''
                        or (:status = 'SCHEDULED' and upper(n.status) = 'PUBLISHED' and n.publishDate > current_date)
                        or (:status = 'EXPIRED' and upper(n.status) = 'PUBLISHED' and n.expireDate is not null and n.expireDate < current_date)
                        or (:status in ('DRAFT', 'PUBLISHED', 'ARCHIVED') and upper(n.status) = :status)
                      )
                      and (:audience = '' or upper(n.audience) = :audience)
                      and (:priority = '' or upper(n.priority) = :priority)
                      and (:category = '' or lower(n.category) = lower(:category))
                      and (
                        :search = ''
                        or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                           like lower(concat('%', :search, '%'))
                      )
                    """
    )
    Page<NoticeListResponse> findAdminNotices(
            @Param("instituteId") Long instituteId,
            @Param("search") String search,
            @Param("status") String status,
            @Param("audience") String audience,
            @Param("priority") String priority,
            @Param("category") String category,
            Pageable pageable
    );

    @Query("""
            select new com.erp.backend.notice.dto.PortalNoticeResponse(
                n.id,
                n.title,
                n.category,
                n.priority,
                n.publishDate,
                n.expireDate,
                n.pinned,
                n.summary,
                n.createdAt
            )
            from Notice n
            where n.institute.id = :instituteId
              and upper(n.status) = 'PUBLISHED'
              and n.publishDate <= current_date
              and (n.expireDate is null or n.expireDate >= current_date)
              and upper(n.audience) in ('ALL', 'STUDENTS')
              and n.targetTeacherId is null
              and (n.targetStudentId is null or n.targetStudentId = :studentId)
              and (
                not exists (select 1 from NoticeTargetClass ntc where ntc.notice = n)
                or (:classId is not null and exists (
                    select 1 from NoticeTargetClass ntc
                    where ntc.notice = n and ntc.schoolClass.id = :classId
                ))
              )
              and (:priority = '' or upper(n.priority) = :priority)
              and (
                :search = ''
                or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                   like lower(concat('%', :search, '%'))
              )
            """)
    Page<PortalNoticeResponse> findStudentPortalNotices(
            @Param("instituteId") Long instituteId,
            @Param("studentId") Long studentId,
            @Param("classId") Long classId,
            @Param("search") String search,
            @Param("priority") String priority,
            Pageable pageable
    );

    @Query("""
            select new com.erp.backend.notice.dto.PortalNoticeResponse(
                n.id,
                n.title,
                n.category,
                n.priority,
                n.publishDate,
                n.expireDate,
                n.pinned,
                n.summary,
                n.createdAt
            )
            from Notice n
            where n.institute.id = :instituteId
              and upper(n.status) = 'PUBLISHED'
              and n.publishDate <= current_date
              and (n.expireDate is null or n.expireDate >= current_date)
              and upper(n.audience) in ('ALL', 'TEACHERS')
              and n.targetStudentId is null
              and (n.targetTeacherId is null or n.targetTeacherId = :teacherId)
              and (:priority = '' or upper(n.priority) = :priority)
              and (
                :search = ''
                or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                   like lower(concat('%', :search, '%'))
              )
            """)
    Page<PortalNoticeResponse> findTeacherPortalNotices(
            @Param("instituteId") Long instituteId,
            @Param("teacherId") Long teacherId,
            @Param("search") String search,
            @Param("priority") String priority,
            Pageable pageable
    );

    @Query("""
            select n
            from Notice n
            where n.institute.id = :instituteId
              and n.id = :noticeId
              and upper(n.status) = 'PUBLISHED'
              and n.publishDate <= current_date
              and (n.expireDate is null or n.expireDate >= current_date)
              and upper(n.audience) in ('ALL', 'STUDENTS')
              and n.targetTeacherId is null
              and (n.targetStudentId is null or n.targetStudentId = :studentId)
              and (
                not exists (select 1 from NoticeTargetClass ntc where ntc.notice = n)
                or (:classId is not null and exists (
                    select 1 from NoticeTargetClass ntc
                    where ntc.notice = n and ntc.schoolClass.id = :classId
                ))
              )
            """)
    Optional<Notice> findVisibleStudentPortalNotice(
            @Param("instituteId") Long instituteId,
            @Param("noticeId") Long noticeId,
            @Param("studentId") Long studentId,
            @Param("classId") Long classId
    );

    @Query("""
            select n
            from Notice n
            where n.institute.id = :instituteId
              and n.id = :noticeId
              and upper(n.status) = 'PUBLISHED'
              and n.publishDate <= current_date
              and (n.expireDate is null or n.expireDate >= current_date)
              and upper(n.audience) in ('ALL', 'TEACHERS')
              and n.targetStudentId is null
              and (n.targetTeacherId is null or n.targetTeacherId = :teacherId)
            """)
    Optional<Notice> findVisibleTeacherPortalNotice(
            @Param("instituteId") Long instituteId,
            @Param("noticeId") Long noticeId,
            @Param("teacherId") Long teacherId
    );
}
