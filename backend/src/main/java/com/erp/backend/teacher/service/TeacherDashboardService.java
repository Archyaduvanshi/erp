package com.erp.backend.teacher.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.curriculum.entity.AcademicSession;
import com.erp.backend.curriculum.repository.AcademicSessionRepository;
import com.erp.backend.notice.dto.PortalNoticeResponse;
import com.erp.backend.notice.service.NoticeService;
import com.erp.backend.salary.entity.TeacherPayrollPeriod;
import com.erp.backend.salary.repository.TeacherPayrollPeriodRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.teacher.dto.TeacherDashboardResponse;
import com.erp.backend.teacher.entity.Teacher;
import com.erp.backend.teacher.repository.TeacherRepository;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TeacherDashboardService {

    private static final String NOT_GENERATED = "NOT_GENERATED";

    private final TeacherRepository teacherRepository;
    private final AcademicSessionRepository academicSessionRepository;
    private final TeacherPayrollPeriodRepository payrollPeriodRepository;
    private final NoticeService noticeService;
    private final EntityManager entityManager;

    public TeacherDashboardService(
            TeacherRepository teacherRepository,
            AcademicSessionRepository academicSessionRepository,
            TeacherPayrollPeriodRepository payrollPeriodRepository,
            NoticeService noticeService,
            EntityManager entityManager
    ) {
        this.teacherRepository = teacherRepository;
        this.academicSessionRepository = academicSessionRepository;
        this.payrollPeriodRepository = payrollPeriodRepository;
        this.noticeService = noticeService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public TeacherDashboardResponse getDashboard(AuthPrincipal principal) {
        if (principal.teacherId() == null) {
            throw new IllegalArgumentException("TEACHER_PORTAL_REQUIRED");
        }

        Long instituteId = principal.instituteId();
        Long teacherId = principal.teacherId();
        Teacher teacher = teacherRepository.findByInstituteIdAndId(instituteId, teacherId)
                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found for current portal user."));
        AcademicSession currentSession = academicSessionRepository
                .findFirstByInstituteIdAndCurrentTrueOrderByUpdatedAtDesc(instituteId)
                .orElse(null);

        long assignedClassCount = 0;
        long assignedStudentCount = 0;
        long totalTargetCount = 0;
        long completedTargetCount = 0;
        long todayPresent = 0;
        long todayAbsent = 0;
        long todayLeave = 0;
        long todayPending = 0;

        if (currentSession != null) {
            assignedClassCount = longValue(singleValue("""
                    select count(*)
                    from (
                        select distinct ct.class_id, ct.section_id
                        from timetable_periods tp
                        join class_timetables ct on ct.id = tp.timetable_id
                        where ct.institute_id = :instituteId
                          and ct.academic_session_id = :academicSessionId
                          and upper(coalesce(ct.status, '')) = 'PUBLISHED'
                          and tp.teacher_id = :teacherId
                          and ct.class_id is not null
                    ) targets
                    """, instituteId, currentSession.getId(), teacherId, LocalDate.now()));
            totalTargetCount = assignedClassCount;
            assignedStudentCount = longValue(singleValue("""
                    with targets as (
                        select distinct ct.class_id, ct.section_id, cs.name as section_name
                        from timetable_periods tp
                        join class_timetables ct on ct.id = tp.timetable_id
                        left join class_sections cs on cs.id = ct.section_id
                        where ct.institute_id = :instituteId
                          and ct.academic_session_id = :academicSessionId
                          and upper(coalesce(ct.status, '')) = 'PUBLISHED'
                          and tp.teacher_id = :teacherId
                          and ct.class_id is not null
                    )
                    select count(distinct s.id)
                    from students s
                    join targets t on t.class_id = s.class_id
                     and (
                        t.section_id is null
                        or lower(coalesce(s.section, '')) = lower(coalesce(t.section_name, ''))
                     )
                    where s.institute_id = :instituteId
                      and upper(coalesce(s.status, 'ACTIVE')) not in ('ARCHIVED', 'DELETED')
                    """, instituteId, currentSession.getId(), teacherId, LocalDate.now()));
            Object[] attendance = (Object[]) entityManager.createNativeQuery("""
                    with targets as (
                        select distinct ct.class_id, ct.section_id
                        from timetable_periods tp
                        join class_timetables ct on ct.id = tp.timetable_id
                        where ct.institute_id = :instituteId
                          and ct.academic_session_id = :academicSessionId
                          and upper(coalesce(ct.status, '')) = 'PUBLISHED'
                          and tp.teacher_id = :teacherId
                          and ct.class_id is not null
                    ),
                    today_sessions as (
                        select s.id
                        from attendance_sessions s
                        join targets t on t.class_id = s.class_id
                         and (
                            (t.section_id is null and s.section_id is null)
                            or t.section_id = s.section_id
                         )
                        where s.institute_id = :instituteId
                          and s.academic_session_id = :academicSessionId
                          and s.attendance_date = :today
                          and coalesce(s.period_number, 1) = 1
                    ),
                    entry_status as (
                        select distinct e.student_id, upper(coalesce(e.status, '')) as status
                        from attendance_entries e
                        join today_sessions ts on ts.id = e.attendance_session_id
                    )
                    select coalesce(sum(case when status = 'PRESENT' then 1 else 0 end), 0) as present,
                           coalesce(sum(case when status = 'ABSENT' then 1 else 0 end), 0) as absent,
                           coalesce(sum(case when status in ('LEAVE', 'ON_LEAVE') then 1 else 0 end), 0) as leave_count,
                           count(*) as marked
                    from entry_status
                    """)
                    .setParameter("instituteId", instituteId)
                    .setParameter("academicSessionId", currentSession.getId())
                    .setParameter("teacherId", teacherId)
                    .setParameter("today", LocalDate.now())
                    .getSingleResult();
            todayPresent = longValue(attendance[0]);
            todayAbsent = longValue(attendance[1]);
            todayLeave = longValue(attendance[2]);
            long marked = longValue(attendance[3]);
            todayPending = Math.max(assignedStudentCount - marked, 0);
            completedTargetCount = longValue(singleValue("""
                    with targets as (
                        select distinct ct.class_id, ct.section_id
                        from timetable_periods tp
                        join class_timetables ct on ct.id = tp.timetable_id
                        where ct.institute_id = :instituteId
                          and ct.academic_session_id = :academicSessionId
                          and upper(coalesce(ct.status, '')) = 'PUBLISHED'
                          and tp.teacher_id = :teacherId
                          and ct.class_id is not null
                    )
                    select count(*)
                    from targets t
                    where exists (
                        select 1
                        from attendance_sessions s
                        where s.institute_id = :instituteId
                          and s.academic_session_id = :academicSessionId
                          and s.attendance_date = :today
                          and coalesce(s.period_number, 1) = 1
                          and s.class_id = t.class_id
                          and (
                            (t.section_id is null and s.section_id is null)
                            or t.section_id = s.section_id
                          )
                    )
                    """, instituteId, currentSession.getId(), teacherId, LocalDate.now()));
        }

        String monthKey = YearMonth.now().toString();
        TeacherPayrollPeriod payrollPeriod = payrollPeriodRepository
                .findByInstituteIdAndTeacherIdAndMonthKey(instituteId, teacherId, monthKey)
                .orElse(null);
        Page<PortalNoticeResponse> latestNotices = noticeService.getPortalNotices(principal, 0, 5, "", "");
        long noticeCount = noticeService.getPortalOverview(principal, "", "").total();

        return new TeacherDashboardResponse(
                teacher.getId(),
                teacherName(teacher),
                teacher.getEmployeeId(),
                teacher.getSpecialization(),
                teacher.getPhotoUrl(),
                currentSession == null ? null : currentSession.getId(),
                currentSession == null ? null : currentSession.getName(),
                assignedClassCount,
                assignedStudentCount,
                todayPresent,
                todayAbsent,
                todayLeave,
                todayPending,
                assignedStudentCount,
                totalTargetCount > 0 && completedTargetCount == totalTargetCount,
                completedTargetCount,
                totalTargetCount,
                monthKey,
                payrollPeriod == null ? NOT_GENERATED : safeStatus(payrollPeriod.getStatus()),
                payrollPeriod == null ? BigDecimal.ZERO : money(payrollPeriod.getNetPayableAmount()),
                payrollPeriod == null ? BigDecimal.ZERO : money(payrollPeriod.getPaidAmount()),
                payrollPeriod == null ? BigDecimal.ZERO : money(payrollPeriod.getOutstandingAmount()),
                noticeCount,
                latestNotices.getContent()
        );
    }

    private Object singleValue(String sql, Long instituteId, Long academicSessionId, Long teacherId, LocalDate today) {
        var query = entityManager.createNativeQuery(sql)
                .setParameter("instituteId", instituteId)
                .setParameter("academicSessionId", academicSessionId)
                .setParameter("teacherId", teacherId);
        if (sql.contains(":today")) {
            query.setParameter("today", today);
        }
        return query.getSingleResult();
    }

    private static String teacherName(Teacher teacher) {
        String name = String.format("%s %s",
                teacher.getFirstName() == null ? "" : teacher.getFirstName(),
                teacher.getLastName() == null ? "" : teacher.getLastName()).trim();
        if (StringUtils.hasText(name)) return name;
        if (StringUtils.hasText(teacher.getName())) return teacher.getName();
        if (StringUtils.hasText(teacher.getEmployeeId())) return teacher.getEmployeeId();
        return "Teacher";
    }

    private static String safeStatus(String status) {
        return StringUtils.hasText(status) ? status.trim().toUpperCase() : "OPEN";
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }

    private static long longValue(Object value) {
        if (value == null) return 0L;
        if (value instanceof Number number) return number.longValue();
        return Long.parseLong(String.valueOf(value));
    }
}
