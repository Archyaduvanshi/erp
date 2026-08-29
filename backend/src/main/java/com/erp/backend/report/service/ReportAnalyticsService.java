package com.erp.backend.report.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ReportAnalyticsService {

    private final EntityManager entityManager;
    private final FeeReportService feeReportService;
    private final SalaryReportService salaryReportService;
    private final BigDecimal passPercentage;

    public ReportAnalyticsService(
            EntityManager entityManager,
            FeeReportService feeReportService,
            SalaryReportService salaryReportService,
            @Value("${erp.results.pass-percentage:33}") BigDecimal passPercentage
    ) {
        this.entityManager = entityManager;
        this.feeReportService = feeReportService;
        this.salaryReportService = salaryReportService;
        this.passPercentage = passPercentage;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> overview(Long instituteId, Long academicSessionId) {
        Long sessionId = resolveAcademicSessionId(instituteId, academicSessionId);
        Map<String, Object> overview = map();
        overview.put("academicSessionId", sessionId);
        overview.put("students", studentSummary(instituteId, sessionId));
        overview.put("teachers", teacherSummary(instituteId));
        overview.put("attendance", attendanceSummary(instituteId, sessionId, null, null, null, null, null));
        overview.put("fees", feeReportService.summary(instituteId, sessionId));
        overview.put("results", resultSummary(instituteId, sessionId, null, null, null));
        overview.put("salary", salaryReportService.summary(instituteId, ""));
        overview.put("library", librarySummary(instituteId));
        overview.put("transport", transportSummary(instituteId, sessionId));
        overview.put("hostel", hostelSummary(instituteId, sessionId));
        overview.put("holidays", holidaySummary(instituteId));
        return overview;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> categoryBundle(Long instituteId, String category, Long academicSessionId, Map<String, String> filters, Pageable pageable) {
        Long sessionId = resolveAcademicSessionId(instituteId, academicSessionId);
        return switch (defaultValue(category, "overview").toLowerCase(Locale.ROOT)) {
            case "students" -> bundle(studentReports(instituteId, sessionId, filters, pageable));
            case "attendance" -> bundle(attendanceReports(instituteId, sessionId, filters, pageable));
            case "fees" -> bundle(feeReports(instituteId, sessionId, filters));
            case "results" -> bundle(resultReports(instituteId, sessionId, filters, pageable));
            case "teachers" -> bundle(teacherReports(instituteId, filters, pageable));
            case "salary" -> bundle(salaryReports(instituteId, filters));
            case "timetable" -> bundle(timetableReports(instituteId, sessionId));
            case "library" -> bundle(libraryReports(instituteId, pageable));
            case "transport" -> bundle(transportReports(instituteId, sessionId));
            case "hostel" -> bundle(hostelReports(instituteId, sessionId, pageable));
            case "holidays" -> bundle(holidayReports(instituteId));
            default -> bundle(List.of(overviewReport(instituteId, sessionId)));
        };
    }

    @Transactional(readOnly = true)
    public Map<String, Object> report(Long instituteId, String category, String reportKey, Long academicSessionId, Map<String, String> filters, Pageable pageable) {
        Long sessionId = resolveAcademicSessionId(instituteId, academicSessionId);
        return reportByKey(instituteId, defaultValue(category, "overview").toLowerCase(Locale.ROOT), defaultValue(reportKey, ""), sessionId, filters, pageable);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> export(Long instituteId, String category, String reportKey, Long academicSessionId, Map<String, String> filters) {
        Long sessionId = resolveAcademicSessionId(instituteId, academicSessionId);
        Map<String, Object> report = reportByKey(instituteId, defaultValue(category, "overview").toLowerCase(Locale.ROOT), defaultValue(reportKey, ""), sessionId, filters, Pageable.unpaged());
        report.put("exportedAt", java.time.LocalDateTime.now().toString());
        return report;
    }

    private Map<String, Object> reportByKey(Long instituteId, String category, String reportKey, Long sessionId, Map<String, String> filters, Pageable pageable) {
        return switch (category) {
            case "students" -> studentReport(instituteId, sessionId, reportKey, filters, pageable);
            case "attendance" -> attendanceReport(instituteId, sessionId, reportKey, filters, pageable);
            case "fees" -> feeReport(instituteId, sessionId, reportKey, filters);
            case "results" -> resultReport(instituteId, sessionId, reportKey, filters, pageable);
            case "teachers" -> teacherReport(instituteId, reportKey, filters, pageable);
            case "salary" -> salaryReport(instituteId, reportKey, filters);
            case "timetable" -> timetableReport(instituteId, sessionId, reportKey);
            case "library" -> libraryReport(instituteId, reportKey, pageable);
            case "transport" -> transportReport(instituteId, sessionId, reportKey);
            case "hostel" -> hostelReport(instituteId, sessionId, reportKey, pageable);
            case "holidays" -> holidayReport(instituteId, reportKey);
            default -> overviewReport(instituteId, sessionId);
        };
    }

    private Map<String, Object> studentReport(Long instituteId, Long sessionId, String reportKey, Map<String, String> filters, Pageable pageable) {
        return switch (reportKey) {
            case "class-strength" -> {
                List<Map<String, Object>> byClass = studentClassStrength(instituteId);
                yield report("class-strength", "Class & Section Strength", "Class strength grouped in PostgreSQL.", byClass, columns("label", "Class", "value", "Students"), charts("Class Strength", "bar", byClass, "Class", "Students"), kpisFromRows(byClass, "Classes", "Students"));
            }
            case "gender-distribution" -> {
                List<Map<String, Object>> byGender = studentGenderDistribution(instituteId);
                yield report("gender-distribution", "Gender Distribution", "Gender distribution grouped in PostgreSQL.", byGender, columns("label", "Gender", "value", "Students"), charts("Gender Distribution", "donut", byGender, "Gender", "Students"), kpisFromRows(byGender, "Groups", "Students"));
            }
            case "student-directory" -> {
                List<Map<String, Object>> directory = studentDirectory(instituteId, filters, pageable);
                yield report("student-directory", "Student Directory", "Paginated lightweight student directory.", directory, columns("name", "Student", "className", "Class", "section", "Section", "rollNo", "Roll No", "gender", "Gender", "status", "Status"), charts("Student Directory", "bar", studentClassStrength(instituteId), "Class", "Students"), kpisFromRows(directory, "Loaded Rows", "Directory"), page(pageable, studentDirectoryCount(instituteId, filters)));
            }
            default -> {
                Map<String, Object> summary = studentSummary(instituteId, sessionId);
                yield report("student-summary", "Student Summary", "Student analytics from aggregate database queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Student Summary", "bar", simpleRows(summary), "Metric", "Students"), kpis(summary));
            }
        };
    }

    private Map<String, Object> attendanceReport(Long instituteId, Long sessionId, String reportKey, Map<String, String> filters, Pageable pageable) {
        LocalDate from = dateFilter(filters, "dateFrom");
        LocalDate to = dateFilter(filters, "dateTo");
        Long classId = longFilter(filters, "classId");
        Long sectionId = longFilter(filters, "sectionId");
        return switch (reportKey) {
            case "monthly-attendance" -> {
                List<Map<String, Object>> monthly = attendanceTrend(instituteId, sessionId, classId, sectionId, from, to, "month");
                yield report("monthly-attendance", "Monthly Attendance", "Monthly attendance trend from one aggregate query.", monthly, columns("label", "Month", "present", "Present", "absent", "Absent", "percentage", "Attendance %"), charts("Monthly Attendance", "area", monthly, "Month", "Attendance %"), kpisFromRows(monthly, "Months", "Attendance %"));
            }
            case "class-attendance" -> {
                List<Map<String, Object>> byClass = attendanceTrend(instituteId, sessionId, classId, sectionId, from, to, "class");
                yield report("class-attendance", "Class Attendance", "Class-wise attendance trend from one aggregate query.", byClass, columns("label", "Class", "present", "Present", "absent", "Absent", "percentage", "Attendance %"), charts("Class Attendance", "bar", byClass, "Class", "Attendance %"), kpisFromRows(byClass, "Classes", "Attendance %"));
            }
            case "low-attendance" -> {
                int threshold = intFilter(filters, "threshold", 75);
                List<Map<String, Object>> low = lowAttendance(instituteId, sessionId, classId, sectionId, threshold, pageable);
                yield report("low-attendance", "Low Attendance", "Students below configured threshold.", low, columns("studentName", "Student", "className", "Class", "presentDays", "Present", "workingDays", "Working Days", "percentage", "Attendance %"), charts("Low Attendance", "horizontal", low, "Student", "Attendance %"), kpisFromRows(low, "Students", "Attendance %"), page(pageable, lowAttendanceCount(instituteId, sessionId, classId, sectionId, threshold)));
            }
            case "absentees" -> {
                List<Map<String, Object>> absentees = absentees(instituteId, sessionId, classId, sectionId, dateFilter(filters, "date"), pageable);
                yield report("absentees", "Absentee Report", "Paginated absentee records for the selected date or range.", absentees, columns("date", "Date", "studentName", "Student", "className", "Class", "status", "Status"), charts("Absentees", "bar", absentees, "Date", "Absences"), kpisFromRows(absentees, "Loaded Rows", "Absences"), page(pageable, absenteesCount(instituteId, sessionId, classId, sectionId, dateFilter(filters, "date"))));
            }
            default -> {
                Map<String, Object> summary = attendanceSummary(instituteId, sessionId, classId, sectionId, null, from, to);
                yield report("attendance-summary", "Attendance Summary", "Attendance summary from saved attendance entries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Attendance Summary", "bar", simpleRows(summary), "Metric", "Records"), kpis(summary));
            }
        };
    }

    private Map<String, Object> feeReport(Long instituteId, Long sessionId, String reportKey, Map<String, String> filters) {
        LocalDate from = dateFilter(filters, "dateFrom");
        LocalDate to = dateFilter(filters, "dateTo");
        return switch (reportKey) {
            case "daily-fee-collections" -> {
                List<Map<String, Object>> daily = feeReportService.collections(instituteId, sessionId, from, to, "date").stream().map(this::bucketRow).toList();
                yield report("daily-fee-collections", "Daily Collections", "Daily fee collections from backend aggregates.", daily, amountColumns("Date"), charts("Daily Collections", "area", daily, "Date", "Amount"), kpisFromRows(daily, "Buckets", "Amount"));
            }
            case "monthly-fee-collections" -> {
                List<Map<String, Object>> monthly = feeReportService.collections(instituteId, sessionId, from, to, "month").stream().map(this::bucketRow).toList();
                yield report("monthly-fee-collections", "Monthly Collections", "Monthly fee collections from backend aggregates.", monthly, amountColumns("Month"), charts("Monthly Collections", "area", monthly, "Month", "Amount"), kpisFromRows(monthly, "Buckets", "Amount"));
            }
            case "fee-payment-modes" -> {
                List<Map<String, Object>> modes = feeReportService.collections(instituteId, sessionId, from, to, "mode").stream().map(this::bucketRow).toList();
                yield report("fee-payment-modes", "Payment Modes", "Fee collections grouped by payment mode.", modes, amountColumns("Mode"), charts("Payment Modes", "donut", modes, "Mode", "Amount"), kpisFromRows(modes, "Modes", "Amount"));
            }
            case "fee-outstanding" -> {
                List<Map<String, Object>> outstanding = feeReportService.outstanding(instituteId, sessionId);
                yield report("fee-outstanding", "Outstanding Fees", "Outstanding fees by class from backend ledger query.", outstanding, columns("className", "Class", "expected", "Expected", "paid", "Paid", "outstanding", "Outstanding"), charts("Outstanding Fees", "bar", chartRows(outstanding, "className", "outstanding"), "Class", "Outstanding"), kpisFromRows(outstanding, "Classes", "Outstanding"));
            }
            default -> {
                Map<String, Object> summary = feeReportService.summary(instituteId, sessionId);
                yield report("fee-summary", "Fee Summary", "Fee totals from charge and payment allocation aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Fee Summary", "bar", simpleRows(summary), "Metric", "Amount"), kpis(summary));
            }
        };
    }

    private Map<String, Object> resultReport(Long instituteId, Long sessionId, String reportKey, Map<String, String> filters, Pageable pageable) {
        Long examId = longFilter(filters, "examId");
        Long classId = longFilter(filters, "classId");
        Long subjectId = longFilter(filters, "subjectId");
        return switch (reportKey) {
            case "class-performance" -> {
                List<Map<String, Object>> byClass = resultPerformance(instituteId, sessionId, examId, classId, subjectId, "class");
                yield report("class-performance", "Class Performance", "Class performance grouped in PostgreSQL.", byClass, columns("label", "Class", "value", "Average %", "students", "Students"), charts("Class Performance", "bar", byClass, "Class", "Average %"), kpisFromRows(byClass, "Classes", "Average %"));
            }
            case "subject-performance" -> {
                List<Map<String, Object>> bySubject = resultPerformance(instituteId, sessionId, examId, classId, subjectId, "subject");
                yield report("subject-performance", "Subject Performance", "Subject performance grouped in PostgreSQL.", bySubject, columns("label", "Subject", "value", "Average %", "students", "Students"), charts("Subject Performance", "bar", bySubject, "Subject", "Average %"), kpisFromRows(bySubject, "Subjects", "Average %"));
            }
            case "pass-fail" -> {
                List<Map<String, Object>> passFail = resultPassFail(instituteId, sessionId, examId, classId, subjectId);
                yield report("pass-fail", "Pass / Fail Analysis", "Pass/fail distribution from backend pass policy.", passFail, columns("label", "Status", "value", "Students"), charts("Pass / Fail Analysis", "donut", passFail, "Status", "Students"), kpisFromRows(passFail, "Groups", "Students"));
            }
            case "top-performers" -> {
                List<Map<String, Object>> top = rankedResults(instituteId, sessionId, examId, classId, pageSize(pageable), false);
                yield report("top-performers", "Top Performers", "Top student ranking calculated in PostgreSQL.", top, columns("studentName", "Student", "className", "Class", "percentage", "Percentage"), charts("Top Performers", "horizontal", chartRows(top, "studentName", "percentage"), "Student", "Percentage"), kpisFromRows(top, "Students", "Percentage"));
            }
            case "needs-attention" -> {
                List<Map<String, Object>> attention = rankedResults(instituteId, sessionId, examId, classId, pageSize(pageable), true);
                yield report("needs-attention", "Students Needing Attention", "Students below pass threshold.", attention, columns("studentName", "Student", "className", "Class", "percentage", "Percentage"), charts("Needs Attention", "horizontal", chartRows(attention, "studentName", "percentage"), "Student", "Percentage"), kpisFromRows(attention, "Students", "Percentage"), page(pageable, rankedResultCount(instituteId, sessionId, examId, classId, true)));
            }
            default -> {
                Map<String, Object> summary = resultSummary(instituteId, sessionId, examId, classId, subjectId);
                yield report("result-summary", "Result Summary", "Result summary from uploaded marks aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Result Summary", "bar", simpleRows(summary), "Metric", "Value"), kpis(summary));
            }
        };
    }

    private Map<String, Object> teacherReport(Long instituteId, String reportKey, Map<String, String> filters, Pageable pageable) {
        return switch (reportKey) {
            case "teacher-subject-distribution" -> {
                List<Map<String, Object>> bySubject = teacherSubjectDistribution(instituteId);
                yield report("teacher-subject-distribution", "Subject Distribution", "Teacher distribution by subject.", bySubject, columns("label", "Subject", "value", "Teachers"), charts("Subject Distribution", "bar", bySubject, "Subject", "Teachers"), kpisFromRows(bySubject, "Subjects", "Teachers"));
            }
            case "teacher-directory" -> {
                List<Map<String, Object>> directory = teacherDirectory(instituteId, filters, pageable);
                yield report("teacher-directory", "Teacher Directory", "Paginated lightweight teacher directory.", directory, columns("name", "Teacher", "subject", "Subject", "department", "Department", "phone", "Phone", "salary", "Salary", "status", "Status"), charts("Teacher Directory", "bar", teacherSubjectDistribution(instituteId), "Subject", "Teachers"), kpisFromRows(directory, "Loaded Rows", "Directory"), page(pageable, teacherDirectoryCount(instituteId, filters)));
            }
            default -> {
                Map<String, Object> summary = teacherSummary(instituteId);
                yield report("teacher-summary", "Teacher Summary", "Teacher totals from aggregate queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Teacher Summary", "bar", simpleRows(summary), "Metric", "Teachers"), kpis(summary));
            }
        };
    }

    private Map<String, Object> salaryReport(Long instituteId, String reportKey, Map<String, String> filters) {
        String monthKey = filter(filters, "monthKey");
        LocalDate from = dateFilter(filters, "dateFrom");
        LocalDate to = dateFilter(filters, "dateTo");
        return switch (reportKey) {
            case "salary-payments-monthly" -> {
                List<Map<String, Object>> monthly = salaryReportService.payments(instituteId, from, to, "month").stream().map(this::bucketRow).toList();
                yield report("salary-payments-monthly", "Monthly Salary Payments", "Monthly salary payments grouped in PostgreSQL.", monthly, amountColumns("Month"), charts("Monthly Salary Payments", "area", monthly, "Month", "Amount"), kpisFromRows(monthly, "Months", "Amount"));
            }
            case "salary-payments-teacher" -> {
                List<Map<String, Object>> byTeacher = salaryReportService.payments(instituteId, from, to, "teacher").stream().map(this::bucketRow).toList();
                yield report("salary-payments-teacher", "Teacher Salary Payments", "Salary payments grouped by teacher.", byTeacher, amountColumns("Teacher"), charts("Teacher Salary Payments", "horizontal", byTeacher, "Teacher", "Amount"), kpisFromRows(byTeacher, "Teachers", "Amount"));
            }
            case "salary-outstanding" -> {
                List<Map<String, Object>> outstanding = salaryReportService.outstanding(instituteId, monthKey);
                yield report("salary-outstanding", "Salary Outstanding", "Outstanding payroll periods from backend aggregates.", outstanding, columns("monthKey", "Month", "status", "Status", "periods", "Periods", "obligation", "Obligation", "paid", "Paid", "outstanding", "Outstanding"), charts("Salary Outstanding", "bar", chartRows(outstanding, "monthKey", "outstanding"), "Month", "Outstanding"), kpisFromRows(outstanding, "Rows", "Outstanding"));
            }
            default -> {
                Map<String, Object> summary = salaryReportService.summary(instituteId, monthKey);
                yield report("salary-summary", "Salary Summary", "Salary obligation and payment aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Salary Summary", "bar", simpleRows(summary), "Metric", "Amount"), kpis(summary));
            }
        };
    }

    private Map<String, Object> timetableReport(Long instituteId, Long sessionId, String reportKey) {
        return timetableReports(instituteId, sessionId).stream()
                .filter(report -> reportKey.equals(report.get("id")))
                .findFirst()
                .orElseGet(() -> timetableReports(instituteId, sessionId).get(0));
    }

    private Map<String, Object> libraryReport(Long instituteId, String reportKey, Pageable pageable) {
        return libraryReports(instituteId, pageable).stream()
                .filter(report -> reportKey.equals(report.get("id")))
                .findFirst()
                .orElseGet(() -> libraryReports(instituteId, pageable).get(0));
    }

    private Map<String, Object> transportReport(Long instituteId, Long sessionId, String reportKey) {
        return transportReports(instituteId, sessionId).stream()
                .filter(report -> reportKey.equals(report.get("id")))
                .findFirst()
                .orElseGet(() -> transportReports(instituteId, sessionId).get(0));
    }

    private Map<String, Object> hostelReport(Long instituteId, Long sessionId, String reportKey, Pageable pageable) {
        return hostelReports(instituteId, sessionId, pageable).stream()
                .filter(report -> reportKey.equals(report.get("id")))
                .findFirst()
                .orElseGet(() -> hostelReports(instituteId, sessionId, pageable).get(0));
    }

    private Map<String, Object> holidayReport(Long instituteId, String reportKey) {
        return holidayReports(instituteId).stream()
                .filter(report -> reportKey.equals(report.get("id")))
                .findFirst()
                .orElseGet(() -> holidayReports(instituteId).get(0));
    }

    private List<Map<String, Object>> studentClassStrength(Long instituteId) {
        return grouped("""
                select coalesce(nullif(split_part(coalesce(assigned_class, class_name, 'Unassigned'), '/', 1), ''), 'Unassigned') as label,
                       count(*) as value
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by label
                """, params("instituteId", instituteId));
    }

    private List<Map<String, Object>> studentGenderDistribution(Long instituteId) {
        return grouped("""
                select coalesce(nullif(gender, ''), 'Not Added') as label, count(*) as value
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by value desc
                """, params("instituteId", instituteId));
    }

    private List<Map<String, Object>> studentDirectory(Long instituteId, Map<String, String> filters, Pageable pageable) {
        return rows("""
                select id,
                       coalesce(nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''), coalesce(name, enrollment_no, 'Student')) as name,
                       coalesce(assigned_class, class_name, 'Not Added') as className,
                       coalesce(section, 'Not Added') as section,
                       coalesce(roll_no, enrollment_no, 'Not Added') as rollNo,
                       coalesce(gender, 'Not Added') as gender,
                       coalesce(status, 'Active') as status
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(enrollment_no, ''), ' ', coalesce(roll_no, ''))) like lower(concat('%', :search, '%')))
                order by created_at desc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "search", filter(filters, "search"), "limit", exportLimit(pageable), "offset", offset(pageable)),
                "id", "name", "className", "section", "rollNo", "gender", "status");
    }

    private long studentDirectoryCount(Long instituteId, Map<String, String> filters) {
        return count("""
                select count(*)
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(enrollment_no, ''), ' ', coalesce(roll_no, ''))) like lower(concat('%', :search, '%')))
                """, params("instituteId", instituteId, "search", filter(filters, "search")));
    }

    private List<Map<String, Object>> teacherSubjectDistribution(Long instituteId) {
        return grouped("""
                select coalesce(nullif(specialization, ''), 'Not Added') as label, count(*) as value
                from teachers
                where institute_id = :instituteId and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by value desc
                """, params("instituteId", instituteId));
    }

    private List<Map<String, Object>> teacherDirectory(Long instituteId, Map<String, String> filters, Pageable pageable) {
        return rows("""
                select id,
                       coalesce(nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''), coalesce(name, employee_id, 'Teacher')) as name,
                       coalesce(specialization, 'Not Added') as subject,
                       coalesce(contract_type, 'Not Added') as department,
                       coalesce(mobile_number, 'Not Added') as phone,
                       coalesce(salary_amount::text, salary, '0') as salary,
                       coalesce(status, 'Active') as status
                from teachers
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(employee_id, ''), ' ', coalesce(specialization, ''))) like lower(concat('%', :search, '%')))
                order by created_at desc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "search", filter(filters, "search"), "limit", exportLimit(pageable), "offset", offset(pageable)),
                "id", "name", "subject", "department", "phone", "salary", "status");
    }

    private long teacherDirectoryCount(Long instituteId, Map<String, String> filters) {
        return count("""
                select count(*)
                from teachers
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(employee_id, ''), ' ', coalesce(specialization, ''))) like lower(concat('%', :search, '%')))
                """, params("instituteId", instituteId, "search", filter(filters, "search")));
    }

    private long lowAttendanceCount(Long instituteId, Long sessionId, Long classId, Long sectionId, int threshold) {
        return count("""
                select count(*)
                from (
                    select e.student_id
                    from attendance_entries e
                    join attendance_sessions s on s.id = e.attendance_session_id
                    where s.institute_id = :instituteId
                      and (:sessionId is null or s.academic_session_id = :sessionId)
                      and (:classId is null or s.class_id = :classId)
                      and (:sectionId is null or s.section_id = :sectionId)
                    group by e.student_id
                    having round(((count(e.id) filter (where lower(e.status) in ('present', 'p', 'late', 'half day', 'half_day', 'half'))::numeric / nullif(count(e.id), 0)) * 100), 2) < :threshold
                ) low_students
                """, params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "threshold", threshold));
    }

    private long absenteesCount(Long instituteId, Long sessionId, Long classId, Long sectionId, LocalDate date) {
        return count("""
                select count(e.id)
                from attendance_entries e
                join attendance_sessions s on s.id = e.attendance_session_id
                where s.institute_id = :instituteId
                  and lower(e.status) in ('absent', 'a')
                  and (:sessionId is null or s.academic_session_id = :sessionId)
                  and (:classId is null or s.class_id = :classId)
                  and (:sectionId is null or s.section_id = :sectionId)
                  and (:date is null or s.attendance_date = :date)
                """, params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "date", date));
    }

    private long rankedResultCount(Long instituteId, Long sessionId, Long examId, Long classId, boolean lowOnly) {
        return count("""
                select count(*)
                from (
                    select m.student_id
                    from student_marks m
                    where m.institute_id = :instituteId
                      and (:sessionId is null or m.academic_session_id = :sessionId)
                      and (:examId is null or m.exam_id = :examId)
                      and (:classId is null or m.class_id = :classId)
                      and m.max_marks > 0
                      and upper(coalesce(m.status, 'PRESENT')) not in ('EXEMPT', 'NOT_ENTERED')
                    group by m.student_id
                    having (:lowOnly = false or round((sum(m.marks_obtained) / nullif(sum(m.max_marks), 0)) * 100, 2) < :passPercentage)
                ) ranked_students
                """, params("instituteId", instituteId, "sessionId", sessionId, "examId", examId, "classId", classId, "lowOnly", lowOnly, "passPercentage", passPercentage));
    }

    private List<Map<String, Object>> studentReports(Long instituteId, Long sessionId, Map<String, String> filters, Pageable pageable) {
        Map<String, Object> summary = studentSummary(instituteId, sessionId);
        List<Map<String, Object>> byClass = grouped("""
                select coalesce(nullif(split_part(coalesce(assigned_class, class_name, 'Unassigned'), '/', 1), ''), 'Unassigned') as label,
                       count(*) as value
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by label
                """, params("instituteId", instituteId));
        List<Map<String, Object>> byGender = grouped("""
                select coalesce(nullif(gender, ''), 'Not Added') as label, count(*) as value
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by value desc
                """, params("instituteId", instituteId));
        List<Map<String, Object>> directory = rows("""
                select id,
                       coalesce(nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''), coalesce(name, enrollment_no, 'Student')) as name,
                       coalesce(assigned_class, class_name, 'Not Added') as className,
                       coalesce(section, 'Not Added') as section,
                       coalesce(roll_no, enrollment_no, 'Not Added') as rollNo,
                       coalesce(gender, 'Not Added') as gender,
                       coalesce(status, 'Active') as status
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(enrollment_no, ''), ' ', coalesce(roll_no, ''))) like lower(concat('%', :search, '%')))
                order by created_at desc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "search", filter(filters, "search"), "limit", pageSize(pageable), "offset", offset(pageable)),
                "id", "name", "className", "section", "rollNo", "gender", "status");
        return List.of(
                report("student-summary", "Student Summary", "Student analytics from aggregate database queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Student Summary", "bar", simpleRows(summary), "Metric", "Students"), kpis(summary)),
                report("class-strength", "Class & Section Strength", "Class strength grouped in PostgreSQL.", byClass, columns("label", "Class", "value", "Students"), charts("Class Strength", "bar", byClass, "Class", "Students"), kpisFromRows(byClass, "Classes", "Students")),
                report("gender-distribution", "Gender Distribution", "Gender distribution grouped in PostgreSQL.", byGender, columns("label", "Gender", "value", "Students"), charts("Gender Distribution", "donut", byGender, "Gender", "Students"), kpisFromRows(byGender, "Groups", "Students")),
                report("student-directory", "Student Directory", "Paginated lightweight student directory.", directory, columns("name", "Student", "className", "Class", "section", "Section", "rollNo", "Roll No", "gender", "Gender", "status", "Status"), charts("Student Directory", "bar", byClass, "Class", "Students"), kpisFromRows(directory, "Loaded Rows", "Directory"))
        );
    }

    private List<Map<String, Object>> attendanceReports(Long instituteId, Long sessionId, Map<String, String> filters, Pageable pageable) {
        LocalDate from = dateFilter(filters, "dateFrom");
        LocalDate to = dateFilter(filters, "dateTo");
        Long classId = longFilter(filters, "classId");
        Long sectionId = longFilter(filters, "sectionId");
        Map<String, Object> summary = attendanceSummary(instituteId, sessionId, classId, sectionId, null, from, to);
        List<Map<String, Object>> monthly = attendanceTrend(instituteId, sessionId, classId, sectionId, from, to, "month");
        List<Map<String, Object>> byClass = attendanceTrend(instituteId, sessionId, classId, sectionId, from, to, "class");
        List<Map<String, Object>> low = lowAttendance(instituteId, sessionId, classId, sectionId, intFilter(filters, "threshold", 75), pageable);
        List<Map<String, Object>> absentees = absentees(instituteId, sessionId, classId, sectionId, dateFilter(filters, "date"), pageable);
        return List.of(
                report("attendance-summary", "Attendance Summary", "Attendance summary from saved attendance entries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Attendance Summary", "bar", simpleRows(summary), "Metric", "Records"), kpis(summary)),
                report("monthly-attendance", "Monthly Attendance", "Monthly attendance trend from one aggregate query.", monthly, columns("label", "Month", "present", "Present", "absent", "Absent", "percentage", "Attendance %"), charts("Monthly Attendance", "area", monthly, "Month", "Attendance %"), kpisFromRows(monthly, "Months", "Attendance %")),
                report("class-attendance", "Class Attendance", "Class-wise attendance trend from one aggregate query.", byClass, columns("label", "Class", "present", "Present", "absent", "Absent", "percentage", "Attendance %"), charts("Class Attendance", "bar", byClass, "Class", "Attendance %"), kpisFromRows(byClass, "Classes", "Attendance %")),
                report("low-attendance", "Low Attendance", "Students below configured threshold.", low, columns("studentName", "Student", "className", "Class", "presentDays", "Present", "workingDays", "Working Days", "percentage", "Attendance %"), charts("Low Attendance", "horizontal", low, "Student", "Attendance %"), kpisFromRows(low, "Students", "Attendance %")),
                report("absentees", "Absentee Report", "Paginated absentee records for the selected date or range.", absentees, columns("date", "Date", "studentName", "Student", "className", "Class", "status", "Status"), charts("Absentees", "bar", absentees, "Date", "Absences"), kpisFromRows(absentees, "Loaded Rows", "Absences"))
        );
    }

    private List<Map<String, Object>> feeReports(Long instituteId, Long sessionId, Map<String, String> filters) {
        Map<String, Object> summary = feeReportService.summary(instituteId, sessionId);
        List<Map<String, Object>> daily = feeReportService.collections(instituteId, sessionId, dateFilter(filters, "dateFrom"), dateFilter(filters, "dateTo"), "date").stream().map(this::bucketRow).toList();
        List<Map<String, Object>> monthly = feeReportService.collections(instituteId, sessionId, dateFilter(filters, "dateFrom"), dateFilter(filters, "dateTo"), "month").stream().map(this::bucketRow).toList();
        List<Map<String, Object>> modes = feeReportService.collections(instituteId, sessionId, dateFilter(filters, "dateFrom"), dateFilter(filters, "dateTo"), "mode").stream().map(this::bucketRow).toList();
        List<Map<String, Object>> outstanding = feeReportService.outstanding(instituteId, sessionId);
        return List.of(
                report("fee-summary", "Fee Summary", "Fee totals from charge and payment allocation aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Fee Summary", "bar", simpleRows(summary), "Metric", "Amount"), kpis(summary)),
                report("daily-fee-collections", "Daily Collections", "Daily fee collections from backend aggregates.", daily, amountColumns("Date"), charts("Daily Collections", "area", daily, "Date", "Amount"), kpisFromRows(daily, "Buckets", "Amount")),
                report("monthly-fee-collections", "Monthly Collections", "Monthly fee collections from backend aggregates.", monthly, amountColumns("Month"), charts("Monthly Collections", "area", monthly, "Month", "Amount"), kpisFromRows(monthly, "Buckets", "Amount")),
                report("fee-payment-modes", "Payment Modes", "Fee collections grouped by payment mode.", modes, amountColumns("Mode"), charts("Payment Modes", "donut", modes, "Mode", "Amount"), kpisFromRows(modes, "Modes", "Amount")),
                report("fee-outstanding", "Outstanding Fees", "Outstanding fees by class from backend ledger query.", outstanding, columns("className", "Class", "expected", "Expected", "paid", "Paid", "outstanding", "Outstanding"), charts("Outstanding Fees", "bar", chartRows(outstanding, "className", "outstanding"), "Class", "Outstanding"), kpisFromRows(outstanding, "Classes", "Outstanding"))
        );
    }

    private List<Map<String, Object>> resultReports(Long instituteId, Long sessionId, Map<String, String> filters, Pageable pageable) {
        Long examId = longFilter(filters, "examId");
        Long classId = longFilter(filters, "classId");
        Long subjectId = longFilter(filters, "subjectId");
        Map<String, Object> summary = resultSummary(instituteId, sessionId, examId, classId, subjectId);
        List<Map<String, Object>> byClass = resultPerformance(instituteId, sessionId, examId, classId, subjectId, "class");
        List<Map<String, Object>> bySubject = resultPerformance(instituteId, sessionId, examId, classId, subjectId, "subject");
        List<Map<String, Object>> passFail = resultPassFail(instituteId, sessionId, examId, classId, subjectId);
        List<Map<String, Object>> top = rankedResults(instituteId, sessionId, examId, classId, 10, false);
        List<Map<String, Object>> attention = rankedResults(instituteId, sessionId, examId, classId, pageSize(pageable), true);
        return List.of(
                report("result-summary", "Result Summary", "Result summary from uploaded marks aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Result Summary", "bar", simpleRows(summary), "Metric", "Value"), kpis(summary)),
                report("class-performance", "Class Performance", "Class performance grouped in PostgreSQL.", byClass, columns("label", "Class", "value", "Average %", "students", "Records"), charts("Class Performance", "bar", byClass, "Class", "Average %"), kpisFromRows(byClass, "Classes", "Average %")),
                report("subject-performance", "Subject Performance", "Subject performance grouped in PostgreSQL.", bySubject, columns("label", "Subject", "value", "Average %", "students", "Records"), charts("Subject Performance", "bar", bySubject, "Subject", "Average %"), kpisFromRows(bySubject, "Subjects", "Average %")),
                report("pass-fail", "Pass / Fail Analysis", "Pass/fail distribution from backend pass policy.", passFail, columns("label", "Status", "value", "Students"), charts("Pass / Fail Analysis", "donut", passFail, "Status", "Students"), kpisFromRows(passFail, "Groups", "Students")),
                report("top-performers", "Top Performers", "Top student ranking calculated in PostgreSQL.", top, columns("studentName", "Student", "className", "Class", "percentage", "Percentage"), charts("Top Performers", "horizontal", chartRows(top, "studentName", "percentage"), "Student", "Percentage"), kpisFromRows(top, "Students", "Percentage")),
                report("needs-attention", "Students Needing Attention", "Students below pass threshold.", attention, columns("studentName", "Student", "className", "Class", "percentage", "Percentage"), charts("Needs Attention", "horizontal", chartRows(attention, "studentName", "percentage"), "Student", "Percentage"), kpisFromRows(attention, "Students", "Percentage"))
        );
    }

    private List<Map<String, Object>> teacherReports(Long instituteId, Map<String, String> filters, Pageable pageable) {
        Map<String, Object> summary = teacherSummary(instituteId);
        List<Map<String, Object>> bySubject = grouped("""
                select coalesce(nullif(specialization, ''), 'Not Added') as label, count(*) as value
                from teachers
                where institute_id = :instituteId and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by value desc
                """, params("instituteId", instituteId));
        List<Map<String, Object>> directory = rows("""
                select id,
                       coalesce(nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''), coalesce(name, employee_id, 'Teacher')) as name,
                       coalesce(specialization, 'Not Added') as subject,
                       coalesce(contract_type, 'Not Added') as department,
                       coalesce(mobile_number, 'Not Added') as phone,
                       coalesce(salary_amount::text, salary, '0') as salary,
                       coalesce(status, 'Active') as status
                from teachers
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                  and (:search = '' or lower(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''), ' ', coalesce(name, ''), ' ', coalesce(employee_id, ''), ' ', coalesce(specialization, ''))) like lower(concat('%', :search, '%')))
                order by created_at desc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "search", filter(filters, "search"), "limit", pageSize(pageable), "offset", offset(pageable)),
                "id", "name", "subject", "department", "phone", "salary", "status");
        return List.of(
                report("teacher-summary", "Teacher Summary", "Teacher totals from aggregate queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Teacher Summary", "bar", simpleRows(summary), "Metric", "Teachers"), kpis(summary)),
                report("teacher-subject-distribution", "Subject Distribution", "Teacher distribution by subject.", bySubject, columns("label", "Subject", "value", "Teachers"), charts("Subject Distribution", "bar", bySubject, "Subject", "Teachers"), kpisFromRows(bySubject, "Subjects", "Teachers")),
                report("teacher-directory", "Teacher Directory", "Paginated lightweight teacher directory.", directory, columns("name", "Teacher", "subject", "Subject", "department", "Department", "phone", "Phone", "salary", "Salary", "status", "Status"), charts("Teacher Directory", "bar", bySubject, "Subject", "Teachers"), kpisFromRows(directory, "Loaded Rows", "Directory"))
        );
    }

    private List<Map<String, Object>> salaryReports(Long instituteId, Map<String, String> filters) {
        String monthKey = filter(filters, "monthKey");
        Map<String, Object> summary = salaryReportService.summary(instituteId, monthKey);
        List<Map<String, Object>> monthly = salaryReportService.payments(instituteId, dateFilter(filters, "dateFrom"), dateFilter(filters, "dateTo"), "month").stream().map(this::bucketRow).toList();
        List<Map<String, Object>> byTeacher = salaryReportService.payments(instituteId, dateFilter(filters, "dateFrom"), dateFilter(filters, "dateTo"), "teacher").stream().map(this::bucketRow).toList();
        List<Map<String, Object>> outstanding = salaryReportService.outstanding(instituteId, monthKey);
        return List.of(
                report("salary-summary", "Salary Summary", "Salary obligation and payment aggregates.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Salary Summary", "bar", simpleRows(summary), "Metric", "Amount"), kpis(summary)),
                report("salary-payments-monthly", "Monthly Salary Payments", "Monthly salary payments grouped in PostgreSQL.", monthly, amountColumns("Month"), charts("Monthly Salary Payments", "area", monthly, "Month", "Amount"), kpisFromRows(monthly, "Months", "Amount")),
                report("salary-payments-teacher", "Teacher Salary Payments", "Salary payments grouped by teacher.", byTeacher, amountColumns("Teacher"), charts("Teacher Salary Payments", "horizontal", byTeacher, "Teacher", "Amount"), kpisFromRows(byTeacher, "Teachers", "Amount")),
                report("salary-outstanding", "Salary Outstanding", "Outstanding payroll periods from backend aggregates.", outstanding, columns("monthKey", "Month", "status", "Status", "periods", "Periods", "obligation", "Obligation", "paid", "Paid", "outstanding", "Outstanding"), charts("Salary Outstanding", "bar", chartRows(outstanding, "monthKey", "outstanding"), "Month", "Outstanding"), kpisFromRows(outstanding, "Rows", "Outstanding"))
        );
    }

    private List<Map<String, Object>> timetableReports(Long instituteId, Long sessionId) {
        Map<String, Object> summary = single("""
                select count(distinct t.id) as timetables, count(p.id) as periods, count(distinct p.teacher_id) as teachers
                from class_timetables t
                left join timetable_periods p on p.timetable_id = t.id
                where t.institute_id = :instituteId
                  and (:sessionId is null or t.academic_session_id = :sessionId)
                  and lower(coalesce(t.status, 'published')) = 'published'
                """, params("instituteId", instituteId, "sessionId", sessionId), "timetables", "periods", "teachers");
        List<Map<String, Object>> byDay = grouped("""
                select coalesce(p.day_of_week, 'Not Added') as label, count(*) as value
                from timetable_periods p
                join class_timetables t on t.id = p.timetable_id
                where t.institute_id = :instituteId
                  and (:sessionId is null or t.academic_session_id = :sessionId)
                  and lower(coalesce(t.status, 'published')) = 'published'
                group by label
                order by label
                """, params("instituteId", instituteId, "sessionId", sessionId));
        return List.of(
                report("timetable-summary", "Timetable Summary", "Timetable totals from period rows.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Timetable Summary", "bar", simpleRows(summary), "Metric", "Count"), kpis(summary)),
                report("period-distribution", "Period Distribution", "Period distribution by day.", byDay, columns("label", "Day", "value", "Periods"), charts("Period Distribution", "bar", byDay, "Day", "Periods"), kpisFromRows(byDay, "Days", "Periods"))
        );
    }

    private List<Map<String, Object>> libraryReports(Long instituteId, Pageable pageable) {
        Map<String, Object> summary = librarySummary(instituteId);
        List<Map<String, Object>> issues = rows("""
                select i.id, b.title as bookTitle,
                       coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.name, s.enrollment_no, 'Student')) as studentName,
                       i.issue_date as issueDate,
                       i.due_date as dueDate,
                       i.return_date as returnDate,
                       case when i.return_date is not null then 'Returned' when i.due_date < current_date then 'Overdue' else 'Issued' end as status
                from library_issues i
                join library_books b on b.id = i.book_id and b.institute_id = i.institute_id
                join students s on s.id = i.borrower_id and s.institute_id = i.institute_id
                where i.institute_id = :instituteId
                order by i.issue_date desc, i.id desc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "limit", pageSize(pageable), "offset", offset(pageable)),
                "id", "bookTitle", "studentName", "issueDate", "dueDate", "returnDate", "status");
        return List.of(
                report("library-summary", "Library Summary", "Library totals from books and issues.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Library Summary", "bar", simpleRows(summary), "Metric", "Count"), kpis(summary)),
                report("library-issues", "Library Issues", "Paginated issue report.", issues, columns("bookTitle", "Book", "studentName", "Student", "issueDate", "Issue Date", "dueDate", "Due Date", "status", "Status"), charts("Library Issues", "donut", groupedIssueStatuses(instituteId), "Status", "Issues"), kpisFromRows(issues, "Loaded Rows", "Issues"))
        );
    }

    private List<Map<String, Object>> transportReports(Long instituteId, Long sessionId) {
        Map<String, Object> summary = transportSummary(instituteId, sessionId);
        List<Map<String, Object>> routes = grouped("""
                select coalesce(route_name, 'Not Added') as label, count(*) as value
                from transport_drivers
                where institute_id = :instituteId and lower(coalesce(status, 'active')) <> 'archived'
                group by label
                order by value desc
                """, params("instituteId", instituteId));
        return List.of(
                report("transport-summary", "Transport Summary", "Transport totals from aggregate queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Transport Summary", "bar", simpleRows(summary), "Metric", "Count"), kpis(summary)),
                report("transport-routes", "Route Distribution", "Transport route distribution.", routes, columns("label", "Route", "value", "Drivers"), charts("Route Distribution", "bar", routes, "Route", "Drivers"), kpisFromRows(routes, "Routes", "Drivers"))
        );
    }

    private List<Map<String, Object>> hostelReports(Long instituteId, Long sessionId, Pageable pageable) {
        Map<String, Object> summary = hostelSummary(instituteId, sessionId);
        List<Map<String, Object>> occupancy = rows("""
                select h.name as hostelName, r.room_number as roomNumber, r.capacity as capacity,
                       coalesce(count(res.id) filter (where lower(coalesce(res.status, 'active')) = 'active'), 0) as occupied,
                       greatest(coalesce(r.capacity, 0) - coalesce(count(res.id) filter (where lower(coalesce(res.status, 'active')) = 'active'), 0), 0) as vacant
                from hostel_rooms r
                join hostels h on h.id = r.hostel_id and h.institute_id = r.institute_id
                left join hostel_residents res on res.room_id = r.id and res.institute_id = r.institute_id and (:sessionId is null or res.academic_session_id = :sessionId)
                where r.institute_id = :instituteId
                  and lower(coalesce(r.status, 'active')) <> 'archived'
                  and lower(coalesce(h.status, 'active')) <> 'archived'
                group by h.name, r.room_number, r.capacity
                order by h.name, r.room_number
                limit :limit offset :offset
                """, params("instituteId", instituteId, "sessionId", sessionId, "limit", pageSize(pageable), "offset", offset(pageable)),
                "hostelName", "roomNumber", "capacity", "occupied", "vacant");
        return List.of(
                report("hostel-summary", "Hostel Summary", "Hostel capacity and occupancy from aggregate queries.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Hostel Summary", "bar", simpleRows(summary), "Metric", "Count"), kpis(summary)),
                report("hostel-occupancy", "Room Occupancy", "Paginated room occupancy report.", occupancy, columns("hostelName", "Hostel", "roomNumber", "Room", "capacity", "Capacity", "occupied", "Occupied", "vacant", "Vacant"), charts("Room Occupancy", "bar", chartRows(occupancy, "roomNumber", "occupied"), "Room", "Occupied"), kpisFromRows(occupancy, "Loaded Rooms", "Occupied"))
        );
    }

    private List<Map<String, Object>> holidayReports(Long instituteId) {
        Map<String, Object> summary = holidaySummary(instituteId);
        List<Map<String, Object>> byType = grouped("""
                select coalesce(nullif(holiday_type, ''), 'Holiday') as label, count(*) as value
                from holidays
                where institute_id = :instituteId
                group by label
                order by value desc
                """, params("instituteId", instituteId));
        return List.of(
                report("holiday-summary", "Holiday Summary", "Holiday totals from saved records.", simpleRows(summary), columns("label", "Metric", "value", "Value"), charts("Holiday Summary", "bar", simpleRows(summary), "Metric", "Count"), kpis(summary)),
                report("holiday-types", "Holiday Types", "Holiday distribution by type.", byType, columns("label", "Type", "value", "Holidays"), charts("Holiday Types", "donut", byType, "Type", "Holidays"), kpisFromRows(byType, "Types", "Holidays"))
        );
    }

    private Map<String, Object> overviewReport(Long instituteId, Long sessionId) {
        Map<String, Object> overview = overview(instituteId, sessionId);
        List<Map<String, Object>> rows = List.of(
                row("label", "Students", "value", scalar(((Map<?, ?>) overview.get("students")).get("total"))),
                row("label", "Teachers", "value", scalar(((Map<?, ?>) overview.get("teachers")).get("total"))),
                row("label", "Attendance %", "value", scalar(((Map<?, ?>) overview.get("attendance")).get("attendancePercentage"))),
                row("label", "Fee Collected", "value", scalar(((Map<?, ?>) overview.get("fees")).get("totalCollected"))),
                row("label", "Salary Outstanding", "value", scalar(((Map<?, ?>) overview.get("salary")).get("outstanding"))),
                row("label", "Hostel Occupied", "value", scalar(((Map<?, ?>) overview.get("hostel")).get("occupied")))
        );
        return report("overview-dashboard", "Overview Dashboard", "One lightweight report overview request.", rows, columns("label", "Area", "value", "Value"), charts("Overview", "bar", rows, "Area", "Value"), kpisFromRows(rows, "Metrics", "Overview"));
    }

    private Map<String, Object> studentSummary(Long instituteId, Long sessionId) {
        return single("""
                select count(*) as total,
                       count(*) filter (where lower(coalesce(status, 'active')) = 'active') as active,
                       count(*) filter (where lower(coalesce(status, '')) in ('inactive', 'left')) as inactive,
                       count(*) filter (where lower(coalesce(gender, '')) = 'male') as male,
                       count(*) filter (where lower(coalesce(gender, '')) = 'female') as female
                from students
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                """, params("instituteId", instituteId), "total", "active", "inactive", "male", "female");
    }

    private Map<String, Object> teacherSummary(Long instituteId) {
        return single("""
                select count(*) as total,
                       count(*) filter (where lower(coalesce(status, 'active')) = 'active') as active
                from teachers
                where institute_id = :instituteId
                  and lower(coalesce(status, 'active')) <> 'archived'
                """, params("instituteId", instituteId), "total", "active");
    }

    private Map<String, Object> attendanceSummary(Long instituteId, Long sessionId, Long classId, Long sectionId, Long studentId, LocalDate from, LocalDate to) {
        Map<String, Object> row = single("""
                select count(e.id) as totalRecords,
                       count(e.id) filter (where lower(e.status) in ('present', 'p', 'late')) as present,
                       count(e.id) filter (where lower(e.status) in ('absent', 'a')) as absent,
                       count(e.id) filter (where lower(e.status) in ('half day', 'half_day', 'half')) as halfDay,
                       count(e.id) filter (where lower(e.status) like '%leave%') as leave
                from attendance_entries e
                join attendance_sessions s on s.id = e.attendance_session_id
                where s.institute_id = :instituteId
                  and (:sessionId is null or s.academic_session_id = :sessionId)
                  and (:classId is null or s.class_id = :classId)
                  and (:sectionId is null or s.section_id = :sectionId)
                  and (:studentId is null or e.student_id = :studentId)
                  and (:dateFrom is null or s.attendance_date >= :dateFrom)
                  and (:dateTo is null or s.attendance_date <= :dateTo)
                """, params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "studentId", studentId, "dateFrom", from, "dateTo", to),
                "totalRecords", "present", "absent", "halfDay", "leave");
        row.put("attendancePercentage", percent(number(row.get("present")).add(number(row.get("halfDay")).multiply(BigDecimal.valueOf(0.5))), number(row.get("totalRecords"))));
        return row;
    }

    private List<Map<String, Object>> attendanceTrend(Long instituteId, Long sessionId, Long classId, Long sectionId, LocalDate from, LocalDate to, String groupBy) {
        String bucket = "class".equalsIgnoreCase(groupBy)
                ? "coalesce(c.name, s.class_name, 'Class')"
                : "to_char(date_trunc('month', s.attendance_date), 'YYYY-MM')";
        return rows("""
                select %s as label,
                       count(e.id) filter (where lower(e.status) in ('present', 'p', 'late')) as present,
                       count(e.id) filter (where lower(e.status) in ('absent', 'a')) as absent,
                       count(e.id) as total,
                       round(((count(e.id) filter (where lower(e.status) in ('present', 'p', 'late', 'half day', 'half_day', 'half'))::numeric / nullif(count(e.id), 0)) * 100), 2) as percentage
                from attendance_entries e
                join attendance_sessions s on s.id = e.attendance_session_id
                left join school_classes c on c.id = s.class_id
                where s.institute_id = :instituteId
                  and (:sessionId is null or s.academic_session_id = :sessionId)
                  and (:classId is null or s.class_id = :classId)
                  and (:sectionId is null or s.section_id = :sectionId)
                  and (:dateFrom is null or s.attendance_date >= :dateFrom)
                  and (:dateTo is null or s.attendance_date <= :dateTo)
                group by label
                order by label
                """.formatted(bucket), params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "dateFrom", from, "dateTo", to),
                "label", "present", "absent", "total", "percentage");
    }

    private List<Map<String, Object>> lowAttendance(Long instituteId, Long sessionId, Long classId, Long sectionId, int threshold, Pageable pageable) {
        return rows("""
                select e.student_id as studentId,
                       coalesce(nullif(trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))), ''), coalesce(st.name, st.enrollment_no, 'Student')) as studentName,
                       coalesce(st.assigned_class, st.class_name, c.name, 'Class') as className,
                       count(e.id) filter (where lower(e.status) in ('present', 'p', 'late')) as presentDays,
                       count(e.id) as workingDays,
                       round(((count(e.id) filter (where lower(e.status) in ('present', 'p', 'late', 'half day', 'half_day', 'half'))::numeric / nullif(count(e.id), 0)) * 100), 2) as percentage
                from attendance_entries e
                join attendance_sessions s on s.id = e.attendance_session_id
                join students st on st.id = e.student_id and st.institute_id = s.institute_id
                left join school_classes c on c.id = s.class_id
                where s.institute_id = :instituteId
                  and (:sessionId is null or s.academic_session_id = :sessionId)
                  and (:classId is null or s.class_id = :classId)
                  and (:sectionId is null or s.section_id = :sectionId)
                group by e.student_id, studentName, className
                having round(((count(e.id) filter (where lower(e.status) in ('present', 'p', 'late', 'half day', 'half_day', 'half'))::numeric / nullif(count(e.id), 0)) * 100), 2) < :threshold
                order by percentage asc
                limit :limit offset :offset
                """, params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "threshold", threshold, "limit", pageSize(pageable), "offset", offset(pageable)),
                "studentId", "studentName", "className", "presentDays", "workingDays", "percentage");
    }

    private List<Map<String, Object>> absentees(Long instituteId, Long sessionId, Long classId, Long sectionId, LocalDate date, Pageable pageable) {
        return rows("""
                select e.id, s.attendance_date as date,
                       coalesce(nullif(trim(concat(coalesce(st.first_name, ''), ' ', coalesce(st.last_name, ''))), ''), coalesce(st.name, st.enrollment_no, 'Student')) as studentName,
                       coalesce(st.assigned_class, st.class_name, c.name, 'Class') as className,
                       e.status
                from attendance_entries e
                join attendance_sessions s on s.id = e.attendance_session_id
                join students st on st.id = e.student_id and st.institute_id = s.institute_id
                left join school_classes c on c.id = s.class_id
                where s.institute_id = :instituteId
                  and lower(e.status) in ('absent', 'a')
                  and (:sessionId is null or s.academic_session_id = :sessionId)
                  and (:classId is null or s.class_id = :classId)
                  and (:sectionId is null or s.section_id = :sectionId)
                  and (:date is null or s.attendance_date = :date)
                order by s.attendance_date desc, studentName
                limit :limit offset :offset
                """, params("instituteId", instituteId, "sessionId", sessionId, "classId", classId, "sectionId", sectionId, "date", date, "limit", pageSize(pageable), "offset", offset(pageable)),
                "id", "date", "studentName", "className", "status");
    }

    private Map<String, Object> resultSummary(Long instituteId, Long sessionId, Long examId, Long classId, Long subjectId) {
        Map<String, Object> row = single("""
                with student_results as (
                    select student_id,
                           sum(case when upper(coalesce(status, 'PRESENT')) <> 'EXEMPT' then coalesce(marks_obtained, 0) else 0 end) as obtained,
                           sum(case when upper(coalesce(status, 'PRESENT')) <> 'EXEMPT' then coalesce(max_marks, 0) else 0 end) as total_marks,
                           bool_or(upper(coalesce(status, 'PRESENT')) = 'NOT_ENTERED') as has_pending
                    from student_marks
                    where institute_id = :instituteId
                      and (:sessionId is null or academic_session_id = :sessionId)
                      and (:examId is null or exam_id = :examId)
                      and (:classId is null or class_id = :classId)
                      and (:subjectId is null or subject_id = :subjectId)
                      and max_marks > 0
                    group by student_id
                ), scored as (
                    select student_id,
                           round((obtained / nullif(total_marks, 0)) * 100, 2) as percentage,
                           has_pending
                    from student_results
                    where total_marks > 0
                )
                select count(*) as studentsAppeared,
                       count(*) filter (where has_pending = false and percentage >= :passPercentage) as studentsPassed,
                       count(*) filter (where has_pending = false and percentage < :passPercentage) as studentsFailed,
                       round(avg(percentage), 2) as averagePercentage,
                       round(max(percentage), 2) as highestPercentage,
                       round(min(percentage), 2) as lowestPercentage
                from scored
                """, params("instituteId", instituteId, "sessionId", sessionId, "examId", examId, "classId", classId, "subjectId", subjectId, "passPercentage", passPercentage),
                "studentsAppeared", "studentsPassed", "studentsFailed", "averagePercentage", "highestPercentage", "lowestPercentage");
        row.put("passPercentage", percent(number(row.get("studentsPassed")), number(row.get("studentsAppeared"))));
        return row;
    }

    private List<Map<String, Object>> resultPerformance(Long instituteId, Long sessionId, Long examId, Long classId, Long subjectId, String groupBy) {
        String bucket = "subject".equalsIgnoreCase(groupBy) ? "coalesce(sub.name, subject_name, 'Subject')" : "coalesce(c.name, class_name, 'Class')";
        return rows("""
                select %s as label,
                       round((sum(case when upper(coalesce(m.status, 'PRESENT')) <> 'EXEMPT' then coalesce(m.marks_obtained, 0) else 0 end) / nullif(sum(case when upper(coalesce(m.status, 'PRESENT')) <> 'EXEMPT' then coalesce(m.max_marks, 0) else 0 end), 0)) * 100, 2) as value,
                       count(distinct m.student_id) as students
                from student_marks m
                left join school_classes c on c.id = m.class_id
                left join subjects sub on sub.id = m.subject_id
                where m.institute_id = :instituteId
                  and (:sessionId is null or m.academic_session_id = :sessionId)
                  and (:examId is null or m.exam_id = :examId)
                  and (:classId is null or m.class_id = :classId)
                  and (:subjectId is null or m.subject_id = :subjectId)
                  and m.max_marks > 0
                  and upper(coalesce(m.status, 'PRESENT')) <> 'NOT_ENTERED'
                group by label
                order by label
                """.formatted(bucket), params("instituteId", instituteId, "sessionId", sessionId, "examId", examId, "classId", classId, "subjectId", subjectId),
                "label", "value", "students");
    }

    private List<Map<String, Object>> resultPassFail(Long instituteId, Long sessionId, Long examId, Long classId, Long subjectId) {
        return grouped("""
                with student_results as (
                    select student_id,
                           sum(case when upper(coalesce(status, 'PRESENT')) <> 'EXEMPT' then coalesce(marks_obtained, 0) else 0 end) as obtained,
                           sum(case when upper(coalesce(status, 'PRESENT')) <> 'EXEMPT' then coalesce(max_marks, 0) else 0 end) as total_marks,
                           bool_or(upper(coalesce(status, 'PRESENT')) = 'NOT_ENTERED') as has_pending
                    from student_marks
                    where institute_id = :instituteId
                      and (:sessionId is null or academic_session_id = :sessionId)
                      and (:examId is null or exam_id = :examId)
                      and (:classId is null or class_id = :classId)
                      and (:subjectId is null or subject_id = :subjectId)
                      and max_marks > 0
                    group by student_id
                ), scored as (
                    select case
                               when has_pending = true then 'Pending'
                               when round((obtained / nullif(total_marks, 0)) * 100, 2) >= :passPercentage then 'Pass'
                               else 'Fail'
                           end as label
                    from student_results
                    where total_marks > 0
                )
                select label, count(*) as value
                from scored
                group by label
                order by label
                """, params("instituteId", instituteId, "sessionId", sessionId, "examId", examId, "classId", classId, "subjectId", subjectId, "passPercentage", passPercentage));
    }

    private List<Map<String, Object>> rankedResults(Long instituteId, Long sessionId, Long examId, Long classId, int limit, boolean lowOnly) {
        return rows("""
                select m.student_id as studentId,
                       coalesce(nullif(trim(concat(coalesce(s.first_name, ''), ' ', coalesce(s.last_name, ''))), ''), coalesce(s.name, s.enrollment_no, 'Student')) as studentName,
                       coalesce(s.assigned_class, s.class_name, m.class_name, 'Class') as className,
                       round((sum(m.marks_obtained) / nullif(sum(m.max_marks), 0)) * 100, 2) as percentage
                from student_marks m
                join students s on s.id = m.student_id and s.institute_id = m.institute_id
                where m.institute_id = :instituteId
                  and (:sessionId is null or m.academic_session_id = :sessionId)
                  and (:examId is null or m.exam_id = :examId)
                  and (:classId is null or m.class_id = :classId)
                  and m.max_marks > 0
                  and upper(coalesce(m.status, 'PRESENT')) not in ('EXEMPT', 'NOT_ENTERED')
                group by m.student_id, studentName, className
                having (:lowOnly = false or round((sum(m.marks_obtained) / nullif(sum(m.max_marks), 0)) * 100, 2) < :passPercentage)
                order by percentage %s
                limit :limit
                """.formatted(lowOnly ? "asc" : "desc"), params("instituteId", instituteId, "sessionId", sessionId, "examId", examId, "classId", classId, "lowOnly", lowOnly, "passPercentage", passPercentage, "limit", limit),
                "studentId", "studentName", "className", "percentage");
    }

    private Map<String, Object> librarySummary(Long instituteId) {
        return single("""
                select coalesce((select count(*) from library_books where institute_id = :instituteId and coalesce(status, 'ACTIVE') <> 'ARCHIVED'), 0) as totalBooks,
                       coalesce((select sum(coalesce(available_copies, available_quantity, 0)) from library_books where institute_id = :instituteId and coalesce(status, 'ACTIVE') <> 'ARCHIVED'), 0) as availableBooks,
                       coalesce((select count(*) from library_issues where institute_id = :instituteId and coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED'), 0) as issuedBooks,
                       coalesce((select count(*) from library_issues where institute_id = :instituteId and coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and due_date < current_date), 0) as overdueIssues
                """, params("instituteId", instituteId), "totalBooks", "availableBooks", "issuedBooks", "overdueIssues");
    }

    private List<Map<String, Object>> groupedIssueStatuses(Long instituteId) {
        return grouped("""
                select case when coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end) = 'ISSUED' and due_date < current_date then 'Overdue' else initcap(lower(coalesce(status, case when return_date is null then 'ISSUED' else 'RETURNED' end))) end as label,
                       count(*) as value
                from library_issues
                where institute_id = :instituteId
                group by label
                order by value desc
                """, params("instituteId", instituteId));
    }

    private Map<String, Object> transportSummary(Long instituteId, Long sessionId) {
        return single("""
                select coalesce((select count(*) from transport_drivers where institute_id = :instituteId and lower(coalesce(status, 'active')) <> 'archived'), 0) as drivers,
                       coalesce((select count(*) from transport_assignments where institute_id = :instituteId and (:sessionId is null or academic_session_id = :sessionId)), 0) as assignedStudents,
                       coalesce((select count(distinct ta.id)
                                 from transport_attendance ta
                                 left join transport_assignments a
                                   on a.institute_id = ta.institute_id
                                  and a.student_id = ta.student_id
                                  and (:sessionId is null or a.academic_session_id = :sessionId)
                                 where ta.institute_id = :instituteId
                                   and (:sessionId is null or a.id is not null)), 0) as attendanceRecords
                """, params("instituteId", instituteId, "sessionId", sessionId), "drivers", "assignedStudents", "attendanceRecords");
    }

    private Map<String, Object> hostelSummary(Long instituteId, Long sessionId) {
        return single("""
                select coalesce(sum(r.capacity), 0) as capacity,
                       coalesce(count(res.id) filter (where lower(coalesce(res.status, 'active')) = 'active'), 0) as occupied,
                       coalesce(count(distinct h.id), 0) as hostels,
                       coalesce(count(distinct r.id), 0) as rooms
                from hostels h
                left join hostel_rooms r on r.hostel_id = h.id and r.institute_id = h.institute_id and lower(coalesce(r.status, 'active')) <> 'archived'
                left join hostel_residents res on res.room_id = r.id and res.institute_id = h.institute_id and (:sessionId is null or res.academic_session_id = :sessionId)
                where h.institute_id = :instituteId
                  and lower(coalesce(h.status, 'active')) <> 'archived'
                """, params("instituteId", instituteId, "sessionId", sessionId), "capacity", "occupied", "hostels", "rooms");
    }

    private Map<String, Object> holidaySummary(Long instituteId) {
        return single("""
                select count(*) as total,
                       count(*) filter (where holiday_date >= current_date) as upcoming
                from holidays
                where institute_id = :instituteId
                """, params("instituteId", instituteId), "total", "upcoming");
    }

    private Long resolveAcademicSessionId(Long instituteId, Long academicSessionId) {
        if (academicSessionId != null) {
            Object value = entityManager.createNativeQuery("""
                    select id
                    from academic_sessions
                    where institute_id = :instituteId
                      and id = :academicSessionId
                    limit 1
                    """)
                    .setParameter("instituteId", instituteId)
                    .setParameter("academicSessionId", academicSessionId)
                    .getResultStream()
                    .findFirst()
                    .orElse(null);
            if (value == null) {
                throw new IllegalArgumentException("INVALID_ACADEMIC_SESSION");
            }
            return academicSessionId;
        }
        Object value = entityManager.createNativeQuery("""
                select id
                from academic_sessions
                where institute_id = :instituteId
                  and current = true
                order by updated_at desc
                limit 1
                """)
                .setParameter("instituteId", instituteId)
                .getResultStream()
                .findFirst()
                .orElse(null);
        return value == null ? null : ((Number) value).longValue();
    }

    private Map<String, Object> bundle(List<Map<String, Object>> reports) {
        return row("reports", reports);
    }

    private Map<String, Object> report(String id, String title, String description, List<Map<String, Object>> rows, List<Map<String, String>> columns, List<Map<String, Object>> charts, List<Map<String, Object>> kpis) {
        return row("id", id, "title", title, "description", description, "rows", rows, "columns", columns, "charts", charts, "chartRows", charts.isEmpty() ? List.of() : charts.get(0).get("data"), "kpis", kpis, "filters", filtersForReport(id));
    }

    private Map<String, Object> report(String id, String title, String description, List<Map<String, Object>> rows, List<Map<String, String>> columns, List<Map<String, Object>> charts, List<Map<String, Object>> kpis, Map<String, Object> page) {
        Map<String, Object> report = report(id, title, description, rows, columns, charts, kpis);
        report.put("page", page);
        return report;
    }

    private Map<String, Object> page(Pageable pageable, long totalElements) {
        int size = pageSize(pageable);
        int number = pageable == null || pageable.isUnpaged() ? 0 : pageable.getPageNumber();
        long totalPages = size <= 0 ? 1 : Math.max(1, (long) Math.ceil(totalElements / (double) size));
        return row("number", number, "size", size, "totalElements", totalElements, "totalPages", totalPages);
    }

    private List<Map<String, Object>> filtersForReport(String id) {
        List<Map<String, Object>> filters = new ArrayList<>();
        if (List.of("student-directory", "teacher-directory").contains(id)) {
            filters.add(row("key", "search", "label", "Search", "type", "text"));
        }
        if (List.of("low-attendance", "needs-attention").contains(id)) {
            filters.add(row("key", "threshold", "label", "Threshold", "type", "number", "defaultValue", 75));
        }
        if (id.contains("attendance") || id.contains("fee") || id.contains("salary")) {
            filters.add(row("key", "dateRange", "label", "Date Range", "type", "select"));
        }
        return filters;
    }

    private List<Map<String, String>> columns(String... pairs) {
        List<Map<String, String>> columns = new ArrayList<>();
        for (int index = 0; index < pairs.length; index += 2) {
            columns.add(Map.of("key", pairs[index], "label", pairs[index + 1]));
        }
        return columns;
    }

    private List<Map<String, Object>> charts(String title, String type, List<Map<String, Object>> rows, String xLabel, String yLabel) {
        return List.of(row("title", title, "type", type, "data", colorRows(rows), "xLabel", xLabel, "yLabel", yLabel));
    }

    private List<Map<String, Object>> simpleRows(Map<String, Object> source) {
        return source.entrySet().stream()
                .map(entry -> row("label", label(entry.getKey()), "value", scalar(entry.getValue())))
                .toList();
    }

    private List<Map<String, Object>> kpis(Map<String, Object> source) {
        return source.entrySet().stream()
                .limit(4)
                .map(entry -> row("label", label(entry.getKey()), "value", scalar(entry.getValue())))
                .toList();
    }

    private List<Map<String, Object>> kpisFromRows(List<Map<String, Object>> rows, String countLabel, String valueLabel) {
        BigDecimal total = rows.stream().map(row -> number(row.get("value"))).reduce(BigDecimal.ZERO, BigDecimal::add);
        return List.of(row("label", countLabel, "value", rows.size()), row("label", valueLabel, "value", scalar(total)));
    }

    private List<Map<String, Object>> chartRows(List<Map<String, Object>> rows, String labelKey, String valueKey) {
        return rows.stream().map(row -> row("label", row.get(labelKey), "value", row.get(valueKey))).toList();
    }

    private Map<String, Object> bucketRow(Map<String, Object> source) {
        return row("label", source.get("bucket"), "value", source.get("amount"), "amount", source.get("amount"), "paymentCount", source.get("paymentCount"));
    }

    private List<Map<String, String>> amountColumns(String label) {
        return columns("label", label, "amount", "Amount", "paymentCount", "Payments");
    }

    private List<Map<String, Object>> colorRows(List<Map<String, Object>> rows) {
        String[] colors = {"#0891b2", "#0f172a", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"};
        List<Map<String, Object>> colored = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            Map<String, Object> row = map();
            row.putAll(rows.get(index));
            row.putIfAbsent("fill", colors[index % colors.length]);
            colored.add(row);
        }
        return colored;
    }

    private List<Map<String, Object>> grouped(String sql, Map<String, Object> params) {
        return rows(sql, params, "label", "value");
    }

    private Map<String, Object> single(String sql, Map<String, Object> params, String... columns) {
        Query query = entityManager.createNativeQuery(sql);
        params.forEach(query::setParameter);
        Object result = query.getSingleResult();
        Object[] row = result instanceof Object[] values ? values : new Object[]{result};
        Map<String, Object> mapped = map();
        for (int index = 0; index < columns.length; index++) {
            mapped.put(columns[index], index < row.length ? row[index] : null);
        }
        return mapped;
    }

    private long count(String sql, Map<String, Object> params) {
        Query query = entityManager.createNativeQuery(sql);
        params.forEach(query::setParameter);
        Object value = query.getSingleResult();
        return value == null ? 0 : ((Number) value).longValue();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> rows(String sql, Map<String, Object> params, String... columns) {
        Query query = entityManager.createNativeQuery(sql);
        params.forEach(query::setParameter);
        List<Object> results = query.getResultList();
        return results.stream().map(result -> {
            Object[] row = result instanceof Object[] values ? values : new Object[]{result};
            Map<String, Object> mapped = map();
            for (int index = 0; index < columns.length; index++) {
                mapped.put(columns[index], index < row.length ? row[index] : null);
            }
            return mapped;
        }).toList();
    }

    private Map<String, Object> params(Object... pairs) {
        Map<String, Object> params = map();
        for (int index = 0; index < pairs.length; index += 2) {
            params.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return params;
    }

    private Map<String, Object> row(Object... pairs) {
        Map<String, Object> row = map();
        for (int index = 0; index < pairs.length; index += 2) {
            row.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return row;
    }

    private Map<String, Object> map() {
        return new LinkedHashMap<>();
    }

    private String filter(Map<String, String> filters, String key) {
        String value = filters == null ? "" : filters.getOrDefault(key, "");
        return StringUtils.hasText(value) && !"all".equalsIgnoreCase(value) ? value.trim() : "";
    }

    private Long longFilter(Map<String, String> filters, String key) {
        String value = filter(filters, key);
        if (!StringUtils.hasText(value)) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private int intFilter(Map<String, String> filters, String key, int fallback) {
        String value = filter(filters, key);
        if (!StringUtils.hasText(value)) return fallback;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }

    private LocalDate dateFilter(Map<String, String> filters, String key) {
        String value = filter(filters, key);
        if (!StringUtils.hasText(value)) return null;
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private int pageSize(Pageable pageable) {
        if (pageable == null || pageable.isUnpaged()) return 25;
        return Math.min(Math.max(pageable.getPageSize(), 1), 100);
    }

    private int exportLimit(Pageable pageable) {
        return pageable == null || pageable.isUnpaged() ? 10_000 : pageSize(pageable);
    }

    private long offset(Pageable pageable) {
        if (pageable == null || pageable.isUnpaged()) return 0;
        return pageable.getOffset();
    }

    private String defaultValue(String value, String fallback) {
        return StringUtils.hasText(value) ? value.trim() : fallback;
    }

    private BigDecimal number(Object value) {
        if (value instanceof BigDecimal decimal) return decimal;
        if (value instanceof Number number) return BigDecimal.valueOf(number.doubleValue());
        if (value == null) return BigDecimal.ZERO;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal percent(BigDecimal numerator, BigDecimal denominator) {
        if (denominator.compareTo(BigDecimal.ZERO) <= 0) return BigDecimal.ZERO;
        return numerator.multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private Object scalar(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal.stripTrailingZeros().toPlainString();
        }
        return value == null ? 0 : value;
    }

    private String label(Object value) {
        String text = String.valueOf(value == null ? "" : value);
        if (!StringUtils.hasText(text)) return "Value";
        return text.replaceAll("([a-z])([A-Z])", "$1 $2").replace('_', ' ');
    }
}
