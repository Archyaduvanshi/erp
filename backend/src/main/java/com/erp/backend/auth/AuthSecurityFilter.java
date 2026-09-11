package com.erp.backend.auth;

import java.io.IOException;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import com.erp.backend.platform.FeatureCode;
import com.erp.backend.platform.service.EntitlementService;

@Component
public class AuthSecurityFilter extends OncePerRequestFilter {
    private static final Map<String, String> FEATURE_ROUTES = new LinkedHashMap<>();

    static {
        FEATURE_ROUTES.put("/api/students", "admissionStudent");
        FEATURE_ROUTES.put("/api/teachers", "teacher");
        FEATURE_ROUTES.put("/api/library", "library");
        FEATURE_ROUTES.put("/api/hostel", "hostel");
        FEATURE_ROUTES.put("/api/fees", "fees");
        FEATURE_ROUTES.put("/api/cashbook", "cashbook");
        FEATURE_ROUTES.put("/api/transport", "transport");
        FEATURE_ROUTES.put("/api/attendance", "attendance");
        FEATURE_ROUTES.put("/api/marks", "examinations");
        FEATURE_ROUTES.put("/api/results", "result");
        FEATURE_ROUTES.put("/api/class-subjects", "courses");
        FEATURE_ROUTES.put("/api/classes", "courses");
        FEATURE_ROUTES.put("/api/course-books", "courses");
        FEATURE_ROUTES.put("/api/curriculum", "courses");
        FEATURE_ROUTES.put("/api/subjects", "courses");
        FEATURE_ROUTES.put("/api/examinations", "examinations");
        FEATURE_ROUTES.put("/api/timetables", "timetable");
        FEATURE_ROUTES.put("/api/salary", "salary");
        FEATURE_ROUTES.put("/api/notices", "notices");
        FEATURE_ROUTES.put("/api/holidays", "holidays");
        FEATURE_ROUTES.put("/api/reports", "reports");
    }

    private final JwtTokenService jwtTokenService;
    private final TeacherAuthorizationService teacherAuthorizationService;
    private final EntitlementService entitlementService;

    public AuthSecurityFilter(JwtTokenService jwtTokenService, TeacherAuthorizationService teacherAuthorizationService,
                              EntitlementService entitlementService) {
        this.jwtTokenService = jwtTokenService;
        this.teacherAuthorizationService = teacherAuthorizationService;
        this.entitlementService = entitlementService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return path.equals("/api/health")
                || path.equals("/api/settings/login")
                || path.equals("/api/auth/refresh")
                || path.equals("/api/auth/logout")
                || path.equals("/api/auth/password/forgot")
                || path.equals("/api/auth/password/reset")
                || path.equals("/api/institutes/login")
                || path.equals("/api/uploads/registration-logo")
                || path.equals("/api/platform/auth/login")
                || path.equals("/api/platform/auth/refresh")
                || path.equals("/api/platform/auth/logout")
                || ("POST".equalsIgnoreCase(request.getMethod()) && path.equals("/api/cashfree/webhook"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (StringUtils.hasText(authorization) && authorization.startsWith("Bearer ")) {
            AuthPrincipal principal;
            try {
                principal = jwtTokenService.parse(authorization.substring(7));
            } catch (RuntimeException exception) {
                SecurityContextHolder.clearContext();
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired session.");
                return;
            }
            try {
                enforcePasswordChange(request, principal);
                enforceRoleAuthorization(request, principal);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        principal.getAuthorities()
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
                filterChain.doFilter(request, response);
                return;
            } catch (RuntimeException exception) {
                SecurityContextHolder.clearContext();
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Unauthorized action.");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private void enforceRoleAuthorization(HttpServletRequest request, AuthPrincipal principal) {
        if (isAlwaysAllowed(request)) {
            return;
        }
        String path = request.getRequestURI();
        if ("SUPER_ADMIN".equals(principal.role())) {
            if (path.startsWith("/api/platform/")) return;
            throw new AccessDeniedException("Platform identities cannot access tenant business APIs.");
        }
        if (path.startsWith("/api/platform/")) {
            throw new AccessDeniedException("Platform access is required.");
        }
        entitlementService.validateInstituteAccess(principal.instituteId());
        FeatureCode platformFeature = FeatureCode.fromLegacyKey(featureForPath(path));
        if (platformFeature != null) {
            entitlementService.validateFeature(principal.instituteId(), platformFeature);
        }
        if ("ADMIN".equals(principal.role())) {
            return;
        }
        if ("STUDENT".equals(principal.role())) {
            enforceStudentAccess(request, principal);
            return;
        }
        if ("TEACHER".equals(principal.role())) {
            enforceTeacherAccess(request, principal);
            return;
        }
        throw new AccessDeniedException("Role is not allowed to access this endpoint.");
    }

    private boolean isAlwaysAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/")
                || path.startsWith("/api/platform/auth/")
                || path.equals("/api/health");
    }

    private void enforceStudentAccess(HttpServletRequest request, AuthPrincipal principal) {
        String path = request.getRequestURI();
        if (path.startsWith("/api/cashfree/student/me/")
                && (isReadMethod(request.getMethod()) || "POST".equalsIgnoreCase(request.getMethod()))) {
            return;
        }
        if ("POST".equalsIgnoreCase(request.getMethod()) && path.equals("/api/fees/student/me/payments")) {
            return;
        }
        if (!isReadMethod(request.getMethod())) {
            throw new AccessDeniedException("Student accounts cannot modify admin resources.");
        }
        if (path.startsWith("/api/students/me/")
                || path.startsWith("/api/attendance/students/me")
                || path.startsWith("/api/transport/student/me")
                || path.startsWith("/api/hostel/student/me")
                || path.startsWith("/api/library/student/me")
                || path.startsWith("/api/fees/student/me")
                || path.startsWith("/api/examinations/student/me")
                || path.startsWith("/api/notices/portal")
                || isStudentPortalRead(request, principal)
                || isSharedReadReference(request)) {
            return;
        }
        if (path.matches("^/api/students/\\d+$") && pathId(path).equals(principal.studentId())) {
            return;
        }
        throw new AccessDeniedException("Student accounts can access only their own /me data.");
    }

    private void enforceTeacherAccess(HttpServletRequest request, AuthPrincipal principal) {
        String path = request.getRequestURI();
        if ("POST".equalsIgnoreCase(request.getMethod()) && path.equals("/api/scanner/resolve")) {
            return;
        }
        if (path.startsWith("/api/teachers/me/")) {
            return;
        }
        if (isReadMethod(request.getMethod()) && isSharedReadReference(request)) {
            return;
        }
        if (isReadMethod(request.getMethod()) && isTeacherPortalSelfRead(request, principal)) {
            return;
        }
        if (isTeacherPortalAttendanceWrite(request)) {
            return;
        }
        if (isTeacherPortalMarksAccess(request)) {
            return;
        }
        if (isReadMethod(request.getMethod()) && path.matches("^/api/teachers/\\d+$") && pathId(path).equals(principal.teacherId())) {
            return;
        }
        String feature = featureForPath(path);
        if (!StringUtils.hasText(feature)) {
            throw new AccessDeniedException("Teacher role is not allowed to access this endpoint.");
        }
        if (isReadMethod(request.getMethod())) {
            if (!teacherAuthorizationService.canRead(principal, feature)) {
                throw new AccessDeniedException("Feature is not assigned to teacher.");
            }
            return;
        }
        if (!teacherAuthorizationService.canWrite(principal, feature)) {
            throw new AccessDeniedException("Teacher does not have write permission for this feature.");
        }
    }

    private void enforcePasswordChange(HttpServletRequest request, AuthPrincipal principal) {
        if (!principal.mustChangePassword()) {
            return;
        }
        String path = request.getRequestURI();
        if (path.equals("/api/auth/me")
                || path.equals("/api/auth/refresh")
                || path.equals("/api/auth/logout")
                || path.equals("/api/auth/password/change")) {
            return;
        }
        throw new IllegalArgumentException("Password change is required before continuing.");
    }

    private String featureForPath(String path) {
        return FEATURE_ROUTES.entrySet().stream()
                .filter(entry -> path.startsWith(entry.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private boolean isReadMethod(String method) {
        return "GET".equalsIgnoreCase(method) || "HEAD".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method);
    }

    private boolean isSharedReadReference(HttpServletRequest request) {
        if (!isReadMethod(request.getMethod())) {
            return false;
        }
        String path = request.getRequestURI();
        return path.startsWith("/api/academic-sessions")
                || path.startsWith("/api/holidays");
    }

    private boolean isStudentPortalRead(HttpServletRequest request, AuthPrincipal principal) {
        String path = request.getRequestURI();
        if (path.equals("/api/fees/structures")) {
            return true;
        }
        if (path.equals("/api/fees/payments")) {
            Long studentId = queryLong(request, "studentId");
            return studentId != null && studentId.equals(principal.studentId());
        }
        return false;
    }

    private boolean isTeacherPortalSelfRead(HttpServletRequest request, AuthPrincipal principal) {
        String path = request.getRequestURI();
        if (path.startsWith("/api/notices/portal")
                || path.startsWith("/api/attendance/teachers/me/")
                || path.startsWith("/api/examinations/teacher/me")
                || path.equals("/api/examinations/date-sheets")
                || path.startsWith("/api/salary/teacher/me/")) {
            return true;
        }
        if (path.matches("^/api/attendance/classes/\\d+/(students|session)$")) {
            return true;
        }
        if (path.matches("^/api/attendance/classes/\\d+/monthly$")) {
            Long teacherId = queryLong(request, "teacherId");
            return teacherId != null && teacherId.equals(principal.teacherId());
        }
        if (path.equals("/api/salary/payments")) {
            Long teacherId = queryLong(request, "teacherId");
            return teacherId != null && teacherId.equals(principal.teacherId());
        }
        return false;
    }

    private boolean isTeacherPortalAttendanceWrite(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "PUT".equalsIgnoreCase(request.getMethod())
                && path.matches("^/api/attendance/classes/\\d+/session$");
    }

    private boolean isTeacherPortalMarksAccess(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (isReadMethod(method)) {
            return path.equals("/api/marks") || path.equals("/api/marks/exam-renames");
        }
        return "POST".equalsIgnoreCase(method)
                && (path.equals("/api/marks/register") || path.equals("/api/marks/exam-renames"));
    }

    private Long queryLong(HttpServletRequest request, String name) {
        String value = request.getParameter(name);
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Long pathId(String path) {
        List<String> parts = List.of(path.split("/"));
        return Long.parseLong(parts.get(parts.size() - 1));
    }
}
