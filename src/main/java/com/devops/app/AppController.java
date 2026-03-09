package com.devops.app;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class AppController {

    @GetMapping("/")
    public Map<String, String> home() {
        return Map.of(
            "app",     "DevOps App — EFEFIC-FDVP20261",
            "version", "2.0.0",
            "status",  "running"
        );
    }

    @GetMapping("/hello")
    public Map<String, String> hello() {
        return Map.of(
            "message",    "Hello from the CI/CD Pipeline!",
            "ci",         "GitHub Actions — Maven + SonarQube + Snyk + Docker",
            "cd",         "Jenkins on Kubernetes",
            "monitoring", "Prometheus + Grafana",
            "mcp",        "MCP K8s Server active"
        );
    }
}
