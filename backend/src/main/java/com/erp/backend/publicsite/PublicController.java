package com.erp.backend.publicsite;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public")
public class PublicController {
    private final PublicCatalogService catalog;
    private final DemoRequestService demos;
    public PublicController(PublicCatalogService catalog, DemoRequestService demos) { this.catalog=catalog; this.demos=demos; }
    @GetMapping("/plans") public List<PublicDtos.Plan> plans() { return catalog.plans(); }
    @GetMapping("/config") public PublicDtos.Config config() { return catalog.config(); }
    @PostMapping("/demo-requests") @ResponseStatus(HttpStatus.ACCEPTED)
    public PublicDtos.Accepted demo(@Valid @RequestBody PublicDtos.DemoRequest request) {
        demos.submit(request);
        return new PublicDtos.Accepted("Your demo request has been received.");
    }
}
