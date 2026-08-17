package com.erp.backend.notice.repository;

import java.util.List;
import java.util.Optional;

import com.erp.backend.notice.entity.Notice;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findAllByInstituteIdOrderByCreatedAtDesc(Long instituteId);

    Optional<Notice> findByInstituteIdAndId(Long instituteId, Long id);

    Optional<Notice> findByInstituteIdAndSourceTypeAndSourceId(Long instituteId, String sourceType, Long sourceId);

    void deleteByInstituteIdAndSourceTypeAndSourceId(Long instituteId, String sourceType, Long sourceId);
}
