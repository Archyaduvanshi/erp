package com.erp.backend.notice.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.erp.backend.auth.AuthPrincipal;
import com.erp.backend.curriculum.entity.SchoolClass;
import com.erp.backend.curriculum.repository.SchoolClassRepository;
import com.erp.backend.exception.ResourceNotFoundException;
import com.erp.backend.institute.entity.Institute;
import com.erp.backend.institute.repository.InstituteRepository;
import com.erp.backend.notice.dto.NoticeListResponse;
import com.erp.backend.notice.dto.NoticeOverviewResponse;
import com.erp.backend.notice.dto.NoticePayload;
import com.erp.backend.notice.dto.NoticeResponse;
import com.erp.backend.notice.dto.NoticeTargetClassResponse;
import com.erp.backend.notice.dto.PortalNoticeResponse;
import com.erp.backend.notice.dto.PortalNoticeOverviewResponse;
import com.erp.backend.notice.entity.Notice;
import com.erp.backend.notice.entity.NoticeTargetClass;
import com.erp.backend.notice.repository.NoticeRepository;
import com.erp.backend.notice.repository.NoticeTargetClassRepository;
import com.erp.backend.student.entity.Student;
import com.erp.backend.student.repository.StudentRepository;
import com.erp.backend.teacher.repository.TeacherRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class NoticeService {

    private static final Set<String> AUDIENCES = Set.of("ALL", "STUDENTS", "TEACHERS");
    private static final Set<String> STATUSES = Set.of("DRAFT", "PUBLISHED", "ARCHIVED");
    private static final Set<String> PRIORITIES = Set.of("LOW", "NORMAL", "HIGH", "URGENT");

    private final InstituteRepository instituteRepository;
    private final NoticeRepository noticeRepository;
    private final NoticeTargetClassRepository noticeTargetClassRepository;
    private final SchoolClassRepository schoolClassRepository;
    private final StudentRepository studentRepository;
    private final TeacherRepository teacherRepository;
    private final EntityManager entityManager;

    public NoticeService(
            InstituteRepository instituteRepository,
            NoticeRepository noticeRepository,
            NoticeTargetClassRepository noticeTargetClassRepository,
            SchoolClassRepository schoolClassRepository,
            StudentRepository studentRepository,
            TeacherRepository teacherRepository,
            EntityManager entityManager
    ) {
        this.instituteRepository = instituteRepository;
        this.noticeRepository = noticeRepository;
        this.noticeTargetClassRepository = noticeTargetClassRepository;
        this.schoolClassRepository = schoolClassRepository;
        this.studentRepository = studentRepository;
        this.teacherRepository = teacherRepository;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public Page<NoticeListResponse> getNotices(Long instituteId, int page, int size, String search, String status, String audience, String priority, String category) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), allowedSize(size, 25), Sort.by(
                Sort.Order.desc("pinned"),
                Sort.Order.desc("publishDate"),
                Sort.Order.desc("createdAt")
        ));
        return noticeRepository.findAdminNotices(
                instituteId,
                blankToEmpty(search),
                optionalAdminStatus(status),
                optionalAudience(audience),
                optionalPriority(priority),
                blankToEmpty(category),
                pageable
        ).map(this::withLiveStatus);
    }

    @Transactional(readOnly = true)
    public NoticeOverviewResponse getOverview(Long instituteId) {
        Query query = entityManager.createNativeQuery("""
                select
                    count(*) as total,
                    coalesce(sum(case when upper(status) = 'PUBLISHED' and publish_date <= current_date and (expire_date is null or expire_date >= current_date) then 1 else 0 end), 0) as published,
                    coalesce(sum(case when upper(status) = 'PUBLISHED' and publish_date > current_date then 1 else 0 end), 0) as scheduled,
                    coalesce(sum(case when upper(status) = 'DRAFT' then 1 else 0 end), 0) as draft,
                    coalesce(sum(case when upper(status) = 'ARCHIVED' then 1 else 0 end), 0) as archived,
                    coalesce(sum(case when upper(priority) = 'URGENT' then 1 else 0 end), 0) as urgent
                from notices
                where institute_id = :instituteId
                  and target_student_id is null
                  and target_teacher_id is null
                  and (source_type is null or btrim(source_type) = '')
                """);
        query.setParameter("instituteId", instituteId);
        Object[] row = (Object[]) query.getSingleResult();
        return new NoticeOverviewResponse(longValue(row[0]), longValue(row[1]), longValue(row[2]), longValue(row[3]), longValue(row[4]), longValue(row[5]));
    }

    @Transactional(readOnly = true)
    public PortalNoticeOverviewResponse getPortalOverview(AuthPrincipal principal, String search, String priority) {
        String normalizedPriority = optionalPriority(priority);
        if ("STUDENT".equalsIgnoreCase(principal.role())) {
            Student student = studentRepository.findByInstituteIdAndId(principal.instituteId(), principal.studentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found for current portal user."));
            Long classId = resolveStudentClassId(principal.instituteId(), student);
            Object[] row = (Object[]) entityManager.createNativeQuery("""
                    select count(*) as total,
                           coalesce(sum(case when coalesce(n.pinned, false) then 1 else 0 end), 0) as pinned,
                           coalesce(sum(case when upper(coalesce(n.priority, '')) = 'URGENT' then 1 else 0 end), 0) as urgent
                    from notices n
                    where n.institute_id = :instituteId
                      and upper(n.status) = 'PUBLISHED'
                      and n.publish_date <= current_date
                      and (n.expire_date is null or n.expire_date >= current_date)
                      and upper(n.audience) in ('ALL', 'STUDENTS')
                      and n.target_teacher_id is null
                      and (n.target_student_id is null or n.target_student_id = :studentId)
                      and (
                        not exists (select 1 from notice_target_classes ntc where ntc.notice_id = n.id)
                        or (:classId is not null and exists (
                            select 1 from notice_target_classes ntc
                            where ntc.notice_id = n.id and ntc.class_id = :classId
                        ))
                      )
                      and (:priority = '' or upper(n.priority) = :priority)
                      and (
                        :search = ''
                        or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                           like lower(concat('%', :search, '%'))
                      )
                    """)
                    .setParameter("instituteId", principal.instituteId())
                    .setParameter("studentId", principal.studentId())
                    .setParameter("classId", classId)
                    .setParameter("search", blankToEmpty(search))
                    .setParameter("priority", normalizedPriority)
                    .getSingleResult();
            return toPortalOverview(row);
        }
        if ("TEACHER".equalsIgnoreCase(principal.role())) {
            Object[] row = (Object[]) entityManager.createNativeQuery("""
                    select count(*) as total,
                           coalesce(sum(case when coalesce(n.pinned, false) then 1 else 0 end), 0) as pinned,
                           coalesce(sum(case when upper(coalesce(n.priority, '')) = 'URGENT' then 1 else 0 end), 0) as urgent
                    from notices n
                    where n.institute_id = :instituteId
                      and upper(n.status) = 'PUBLISHED'
                      and n.publish_date <= current_date
                      and (n.expire_date is null or n.expire_date >= current_date)
                      and upper(n.audience) in ('ALL', 'TEACHERS')
                      and n.target_student_id is null
                      and (n.target_teacher_id is null or n.target_teacher_id = :teacherId)
                      and (:priority = '' or upper(n.priority) = :priority)
                      and (
                        :search = ''
                        or lower(concat(coalesce(n.title, ''), ' ', coalesce(n.summary, ''), ' ', coalesce(n.category, '')))
                           like lower(concat('%', :search, '%'))
                      )
                    """)
                    .setParameter("instituteId", principal.instituteId())
                    .setParameter("teacherId", principal.teacherId())
                    .setParameter("search", blankToEmpty(search))
                    .setParameter("priority", normalizedPriority)
                    .getSingleResult();
            return toPortalOverview(row);
        }
        throw new IllegalArgumentException("NOTICE_PORTAL_ROLE_NOT_SUPPORTED");
    }

    @Transactional(readOnly = true)
    public NoticeResponse getNotice(Long instituteId, Long id) {
        Notice notice = noticeRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + id));
        return toResponse(notice);
    }

    @Transactional(readOnly = true)
    public Page<PortalNoticeResponse> getPortalNotices(AuthPrincipal principal, int page, int size, String search, String priority) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), allowedSize(size, 20), Sort.by(
                Sort.Order.desc("pinned"),
                Sort.Order.desc("publishDate"),
                Sort.Order.desc("createdAt")
        ));
        String normalizedPriority = optionalPriority(priority);
        if ("STUDENT".equalsIgnoreCase(principal.role())) {
            Student student = studentRepository.findByInstituteIdAndId(principal.instituteId(), principal.studentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found for current portal user."));
            Long classId = resolveStudentClassId(principal.instituteId(), student);
            return noticeRepository.findStudentPortalNotices(principal.instituteId(), principal.studentId(), classId, blankToEmpty(search), normalizedPriority, pageable);
        }
        if ("TEACHER".equalsIgnoreCase(principal.role())) {
            return noticeRepository.findTeacherPortalNotices(principal.instituteId(), principal.teacherId(), blankToEmpty(search), normalizedPriority, pageable);
        }
        throw new IllegalArgumentException("NOTICE_PORTAL_ROLE_NOT_SUPPORTED");
    }

    @Transactional(readOnly = true)
    public NoticeResponse getPortalNotice(AuthPrincipal principal, Long noticeId) {
        Notice notice;
        if ("STUDENT".equalsIgnoreCase(principal.role())) {
            Student student = studentRepository.findByInstituteIdAndId(principal.instituteId(), principal.studentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Student not found for current portal user."));
            Long classId = resolveStudentClassId(principal.instituteId(), student);
            notice = noticeRepository.findVisibleStudentPortalNotice(principal.instituteId(), noticeId, principal.studentId(), classId)
                    .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + noticeId));
        } else if ("TEACHER".equalsIgnoreCase(principal.role())) {
            notice = noticeRepository.findVisibleTeacherPortalNotice(principal.instituteId(), noticeId, principal.teacherId())
                    .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + noticeId));
        } else {
            throw new IllegalArgumentException("NOTICE_PORTAL_ROLE_NOT_SUPPORTED");
        }
        return toResponse(notice);
    }

    @Transactional
    public NoticeResponse createNotice(Long instituteId, Long accountId, NoticePayload request) {
        Institute institute = validateInstitute(instituteId);
        Notice notice = new Notice();
        notice.setInstitute(institute);
        notice.setCreatedByAccountId(accountId);
        applyPayload(instituteId, notice, request, accountId, false);
        Notice savedNotice = noticeRepository.save(notice);
        replaceTargetClasses(instituteId, savedNotice, request);
        return toResponse(savedNotice);
    }

    @Transactional
    public NoticeResponse createNotice(Long instituteId, NoticePayload request) {
        return createNotice(instituteId, null, request);
    }

    @Transactional
    public NoticeResponse updateNotice(Long instituteId, Long accountId, Long id, NoticePayload request) {
        Notice notice = noticeRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + id));
        if (StringUtils.hasText(notice.getSourceType())) {
            throw new IllegalArgumentException("SYSTEM_NOTICE_EDIT_NOT_ALLOWED");
        }
        applyPayload(instituteId, notice, request, accountId, false);
        Notice savedNotice = noticeRepository.save(notice);
        replaceTargetClasses(instituteId, savedNotice, request);
        return toResponse(savedNotice);
    }

    @Transactional
    public NoticeResponse updateNotice(Long instituteId, Long id, NoticePayload request) {
        return updateNotice(instituteId, null, id, request);
    }

    @Transactional
    public NoticeResponse upsertSystemNotice(Long instituteId, String sourceType, Long sourceId, NoticePayload request) {
        Institute institute = validateInstitute(instituteId);
        Notice notice = noticeRepository.findByInstituteIdAndSourceTypeAndSourceId(instituteId, sourceType, sourceId)
                .orElseGet(Notice::new);
        if (notice.getId() == null) {
            notice.setInstitute(institute);
        }
        notice.setSourceType(requiredTrim(sourceType, "NOTICE_SOURCE_TYPE_REQUIRED").toUpperCase());
        notice.setSourceId(sourceId);
        applyPayload(instituteId, notice, request, null, true);
        Notice savedNotice = noticeRepository.save(notice);
        replaceTargetClasses(instituteId, savedNotice, request);
        return toResponse(savedNotice);
    }

    @Transactional
    public void archiveSystemNotice(Long instituteId, String sourceType, Long sourceId, Long accountId) {
        noticeRepository.findByInstituteIdAndSourceTypeAndSourceId(instituteId, requiredTrim(sourceType, "NOTICE_SOURCE_TYPE_REQUIRED").toUpperCase(), sourceId)
                .ifPresent(notice -> {
                    notice.setStatus("Archived");
                    notice.setArchivedAt(LocalDateTime.now());
                    notice.setArchivedByAccountId(accountId);
                    notice.setUpdatedByAccountId(accountId);
                    noticeRepository.save(notice);
                });
    }

    @Transactional
    public void deleteNotice(Long instituteId, Long accountId, Long id) {
        Notice notice = noticeRepository.findByInstituteIdAndId(instituteId, id)
                .orElseThrow(() -> new ResourceNotFoundException("Notice not found with id: " + id));
        if ("DRAFT".equalsIgnoreCase(notice.getStatus()) && !StringUtils.hasText(notice.getSourceType())) {
            noticeTargetClassRepository.deleteAllByNoticeId(id);
            noticeRepository.delete(notice);
            return;
        }
        notice.setStatus("Archived");
        notice.setArchivedAt(LocalDateTime.now());
        notice.setArchivedByAccountId(accountId);
        notice.setUpdatedByAccountId(accountId);
        noticeRepository.save(notice);
    }

    @Transactional
    public void deleteNotice(Long instituteId, Long id) {
        deleteNotice(instituteId, null, id);
    }

    private void applyPayload(Long instituteId, Notice notice, NoticePayload request, Long accountId, boolean systemNotice) {
        if (!systemNotice && StringUtils.hasText(notice.getSourceType())) {
            throw new IllegalArgumentException("SYSTEM_NOTICE_EDIT_NOT_ALLOWED");
        }
        String previousStatus = notice.getStatus();
        String nextStatus = normalizeStatus(request.status());
        notice.setTitle(requiredTrim(request.title(), "Notice title is required."));
        notice.setCategory(defaultValue(request.category(), "General"));
        notice.setAudience(normalizeAudience(request.audience()));
        validateTargets(instituteId, request, notice.getAudience());
        notice.setTargetClasses(legacyTargetClassesLabel(instituteId, request, notice.getAudience()));
        notice.setTargetStudentId("STUDENTS".equalsIgnoreCase(notice.getAudience()) ? request.targetStudentId() : null);
        notice.setTargetTeacherId("TEACHERS".equalsIgnoreCase(notice.getAudience()) ? request.targetTeacherId() : null);
        notice.setPriority(normalizePriority(request.priority()));
        notice.setPublishDate(request.publishDate() == null ? LocalDate.now() : request.publishDate());
        notice.setExpireDate(request.expireDate());
        if (notice.getExpireDate() != null && notice.getExpireDate().isBefore(notice.getPublishDate())) {
            throw new IllegalArgumentException("INVALID_NOTICE_DATE_RANGE");
        }
        notice.setStatus(nextStatus);
        notice.setPinned(Boolean.TRUE.equals(request.isPinned()));
        notice.setSummary(requiredTrim(request.summary(), "Summary is required."));
        notice.setDetails(requiredTrim(request.details(), "Details are required."));
        notice.setUpdatedByAccountId(accountId);

        LocalDateTime now = LocalDateTime.now();
        if ("PUBLISHED".equalsIgnoreCase(nextStatus) && !"PUBLISHED".equalsIgnoreCase(previousStatus)) {
            notice.setPublishedAt(now);
            notice.setPublishedByAccountId(accountId);
        }
        if ("ARCHIVED".equalsIgnoreCase(nextStatus) && !"ARCHIVED".equalsIgnoreCase(previousStatus)) {
            notice.setArchivedAt(now);
            notice.setArchivedByAccountId(accountId);
        }
    }

    private void validateTargets(Long instituteId, NoticePayload request, String audience) {
        if (request.targetStudentId() != null) {
            if (!"STUDENTS".equalsIgnoreCase(audience)) {
                throw new IllegalArgumentException("TARGET_STUDENT_REQUIRES_STUDENT_AUDIENCE");
            }
            studentRepository.findByInstituteIdAndId(instituteId, request.targetStudentId())
                    .orElseThrow(() -> new IllegalArgumentException("INVALID_TARGET_STUDENT"));
        }
        if (request.targetTeacherId() != null) {
            if (!"TEACHERS".equalsIgnoreCase(audience)) {
                throw new IllegalArgumentException("TARGET_TEACHER_REQUIRES_TEACHER_AUDIENCE");
            }
            teacherRepository.findByInstituteIdAndId(instituteId, request.targetTeacherId())
                    .orElseThrow(() -> new IllegalArgumentException("INVALID_TARGET_TEACHER"));
        }
    }

    private void replaceTargetClasses(Long instituteId, Notice notice, NoticePayload request) {
        noticeTargetClassRepository.deleteAllByNoticeId(notice.getId());
        if (!"STUDENTS".equalsIgnoreCase(notice.getAudience())) {
            return;
        }
        List<SchoolClass> targetClasses = resolveTargetClasses(instituteId, request);
        if (targetClasses.isEmpty()) {
            return;
        }
        noticeTargetClassRepository.saveAll(targetClasses.stream().map(schoolClass -> {
            NoticeTargetClass target = new NoticeTargetClass();
            target.setNotice(notice);
            target.setSchoolClass(schoolClass);
            return target;
        }).toList());
    }

    private List<SchoolClass> resolveTargetClasses(Long instituteId, NoticePayload request) {
        List<Long> ids = request.targetClassIds() == null ? List.of() : request.targetClassIds().stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return List.of();
        }
        Set<Long> requestedIds = new java.util.LinkedHashSet<>(ids);
        Map<Long, SchoolClass> classesById = schoolClassRepository.findAllByInstituteIdAndIdIn(instituteId, requestedIds)
                .stream()
                .collect(Collectors.toMap(SchoolClass::getId, schoolClass -> schoolClass));
        List<Long> missing = ids.stream().filter(id -> !classesById.containsKey(id)).toList();
        if (!missing.isEmpty()) {
            throw new IllegalArgumentException("INVALID_TARGET_CLASS");
        }
        List<Long> archived = ids.stream().filter(id -> "ARCHIVED".equalsIgnoreCase(classesById.get(id).getStatus())).toList();
        if (!archived.isEmpty()) {
            throw new IllegalArgumentException("ARCHIVED_TARGET_CLASS_NOT_ALLOWED");
        }
        return ids.stream().map(classesById::get).toList();
    }

    private Long resolveStudentClassId(Long instituteId, Student student) {
        if (student.getSchoolClass() != null) {
            return student.getSchoolClass().getId();
        }
        String label = firstClassLabel(student.getAssignedClass());
        if (!StringUtils.hasText(label)) {
            label = firstClassLabel(student.getClassName());
        }
        if (!StringUtils.hasText(label)) {
            return null;
        }
        return schoolClassRepository.findByInstituteIdAndNormalizedName(instituteId, normalizeClassName(label))
                .map(SchoolClass::getId)
                .orElse(null);
    }

    private NoticeResponse toResponse(Notice notice) {
        List<NoticeTargetClassResponse> classTargets = noticeTargetClassRepository.findAllByNoticeId(notice.getId())
                .stream()
                .map(NoticeTargetClass::getSchoolClass)
                .sorted(Comparator.comparing(SchoolClass::getName, String::compareToIgnoreCase))
                .map(schoolClass -> new NoticeTargetClassResponse(schoolClass.getId(), schoolClass.getName()))
                .toList();
        List<Long> classIds = classTargets.stream().map(NoticeTargetClassResponse::id).toList();
        List<String> classLabels = classTargets.stream().map(NoticeTargetClassResponse::name).toList();
        return new NoticeResponse(
                notice.getId(),
                notice.getTitle(),
                notice.getCategory(),
                displayAudience(notice.getAudience()),
                classIds.isEmpty() ? parseTargetClasses(notice.getTargetClasses()) : classLabels,
                classIds,
                classTargets,
                notice.getTargetStudentId(),
                notice.getTargetTeacherId(),
                displayPriority(notice.getPriority()),
                notice.getPublishDate(),
                notice.getExpireDate(),
                displayStatus(notice.getStatus()),
                liveStatus(notice),
                Boolean.TRUE.equals(notice.getPinned()),
                notice.getSummary(),
                notice.getDetails(),
                notice.getSourceType(),
                notice.getSourceId(),
                notice.getCreatedByAccountId(),
                notice.getUpdatedByAccountId(),
                notice.getPublishedByAccountId(),
                notice.getArchivedByAccountId(),
                notice.getCreatedAt(),
                notice.getUpdatedAt(),
                notice.getPublishedAt(),
                notice.getArchivedAt()
        );
    }

    private NoticeListResponse withLiveStatus(NoticeListResponse notice) {
        return new NoticeListResponse(
                notice.id(),
                notice.title(),
                notice.category(),
                displayAudience(notice.audience()),
                displayPriority(notice.priority()),
                notice.publishDate(),
                notice.expireDate(),
                displayStatus(notice.status()),
                liveStatus(notice.status(), notice.publishDate(), notice.expireDate()),
                Boolean.TRUE.equals(notice.isPinned()),
                notice.summary(),
                notice.sourceType(),
                notice.sourceId(),
                notice.createdAt(),
                notice.updatedAt()
        );
    }

    private Institute validateInstitute(Long instituteId) {
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new ResourceNotFoundException("Institute not found with id: " + instituteId));
    }

    private String normalizeAudience(String value) {
        String audience = normalizeToken(defaultValue(value, "ALL"));
        if ("STUDENT".equals(audience)) audience = "STUDENTS";
        if ("TEACHER".equals(audience)) audience = "TEACHERS";
        if (!AUDIENCES.contains(audience)) {
            throw new IllegalArgumentException("UNSUPPORTED_NOTICE_AUDIENCE");
        }
        return displayAudience(audience);
    }

    private String normalizeStatus(String value) {
        String status = normalizeToken(defaultValue(value, "DRAFT"));
        if (!STATUSES.contains(status)) {
            throw new IllegalArgumentException("UNSUPPORTED_NOTICE_STATUS");
        }
        return displayStatus(status);
    }

    private String normalizePriority(String value) {
        String priority = normalizeToken(defaultValue(value, "NORMAL"));
        if (!PRIORITIES.contains(priority)) {
            throw new IllegalArgumentException("UNSUPPORTED_NOTICE_PRIORITY");
        }
        return displayPriority(priority);
    }

    private String optionalStatus(String value) {
        if (!StringUtils.hasText(value) || "ALL".equalsIgnoreCase(value)) return "";
        return normalizeToken(normalizeStatus(value));
    }

    private String optionalAdminStatus(String value) {
        if (!StringUtils.hasText(value) || "ALL".equalsIgnoreCase(value)) return "";
        String token = normalizeToken(value);
        if ("SCHEDULED".equals(token) || "EXPIRED".equals(token)) return token;
        return normalizeToken(normalizeStatus(value));
    }

    private String optionalAudience(String value) {
        if (!StringUtils.hasText(value) || "ALL".equalsIgnoreCase(value)) return "";
        return normalizeToken(normalizeAudience(value));
    }

    private String optionalPriority(String value) {
        if (!StringUtils.hasText(value) || "ALL".equalsIgnoreCase(value)) return "";
        return normalizeToken(normalizePriority(value));
    }

    private String liveStatus(Notice notice) {
        return liveStatus(notice.getStatus(), notice.getPublishDate(), notice.getExpireDate());
    }

    private String liveStatus(String status, LocalDate publishDate, LocalDate expireDate) {
        LocalDate today = LocalDate.now();
        if ("ARCHIVED".equalsIgnoreCase(status)) return "Archived";
        if ("DRAFT".equalsIgnoreCase(status)) return "Draft";
        if (publishDate != null && publishDate.isAfter(today)) return "Scheduled";
        if (expireDate != null && expireDate.isBefore(today)) return "Expired";
        return "Published";
    }

    private String displayAudience(String value) {
        String token = normalizeToken(value);
        if ("STUDENTS".equals(token)) return "Students";
        if ("TEACHERS".equals(token)) return "Teachers";
        return "All";
    }

    private String displayStatus(String value) {
        String token = normalizeToken(value);
        if ("PUBLISHED".equals(token)) return "Published";
        if ("ARCHIVED".equals(token)) return "Archived";
        return "Draft";
    }

    private String displayPriority(String value) {
        String token = normalizeToken(value);
        if ("LOW".equals(token)) return "Low";
        if ("HIGH".equals(token)) return "High";
        if ("URGENT".equals(token)) return "Urgent";
        return "Normal";
    }

    private String legacyTargetClassesLabel(Long instituteId, NoticePayload request, String audience) {
        if (!"STUDENTS".equalsIgnoreCase(audience)) {
            return "All";
        }
        List<SchoolClass> classes = resolveTargetClasses(instituteId, request);
        if (!classes.isEmpty()) {
            return classes.stream().map(SchoolClass::getName).collect(Collectors.joining(","));
        }
        if (request.targetClasses() == null || request.targetClasses().isEmpty()) {
            return "All";
        }
        return request.targetClasses().stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(value -> !value.equalsIgnoreCase("All"))
                .distinct()
                .collect(Collectors.collectingAndThen(Collectors.joining(","), joined -> StringUtils.hasText(joined) ? joined : "All"));
    }

    private List<String> parseTargetClasses(String value) {
        if (!StringUtils.hasText(value)) {
            return List.of("All");
        }
        return List.of(value.split(",")).stream().map(String::trim).filter(StringUtils::hasText).toList();
    }

    private String firstClassLabel(String value) {
        if (!StringUtils.hasText(value)) return "";
        return value.split("/", 2)[0].trim();
    }

    private String normalizeClassName(String value) {
        return StringUtils.hasText(value) ? value.trim().replaceAll("\\s+", " ").toLowerCase() : "";
    }

    private String normalizeToken(String value) {
        return StringUtils.hasText(value) ? value.trim().replace('-', '_').replace(' ', '_').toUpperCase() : "";
    }

    private String requiredTrim(String value, String message) {
        if (!StringUtils.hasText(value)) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private String blankToEmpty(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }

    private int allowedSize(int size, int fallback) {
        if (size == 25 || size == 50 || size == 100) return size;
        if (fallback == 20 && size > 0 && size <= 100) return size;
        return fallback;
    }

    private long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private PortalNoticeOverviewResponse toPortalOverview(Object[] row) {
        return new PortalNoticeOverviewResponse(longValue(row[0]), longValue(row[1]), longValue(row[2]));
    }
}
