package com.erp.backend.platform.auth;

import com.erp.backend.platform.auth.entity.PlatformUser;
import com.erp.backend.platform.auth.repository.PlatformUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class PlatformAdminBootstrap implements ApplicationRunner {
    private final PlatformUserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;
    private final String displayName;

    public PlatformAdminBootstrap(
            PlatformUserRepository repository,
            PasswordEncoder passwordEncoder,
            @Value("${app.platform.bootstrap.username:}") String username,
            @Value("${app.platform.bootstrap.password:}") String password,
            @Value("${app.platform.bootstrap.display-name:Platform Owner}") String displayName
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
        this.displayName = displayName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) return;
        if (password.length() < 12) throw new IllegalStateException("PLATFORM_ADMIN_PASSWORD must contain at least 12 characters.");
        String normalized = username.trim().toLowerCase();
        repository.findByNormalizedUsername(normalized).orElseGet(() -> {
            PlatformUser user = new PlatformUser();
            user.setNormalizedUsername(normalized);
            user.setDisplayName(displayName.trim());
            user.setPasswordHash(passwordEncoder.encode(password));
            return repository.save(user);
        });
    }
}
