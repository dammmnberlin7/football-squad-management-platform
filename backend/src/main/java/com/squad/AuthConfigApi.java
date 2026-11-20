package com.squad;

import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.*;

@RestController
public class AuthConfigApi {
  final Environment env;

  AuthConfigApi(Environment e) {
    env = e;
  }

  @GetMapping("/api/auth/config")
  Map<String, Object> config() {
    return Map.of(
        "mode",
        env.matchesProfiles("production") ? "production" : "development",
        "demoAvailable",
        env.matchesProfiles("dev"));
  }
}
