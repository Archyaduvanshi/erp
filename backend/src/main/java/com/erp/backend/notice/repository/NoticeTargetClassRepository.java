package com.erp.backend.notice.repository;

import java.util.List;

import com.erp.backend.notice.entity.NoticeTargetClass;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeTargetClassRepository extends JpaRepository<NoticeTargetClass, Long> {

    List<NoticeTargetClass> findAllByNoticeId(Long noticeId);

    void deleteAllByNoticeId(Long noticeId);
}
