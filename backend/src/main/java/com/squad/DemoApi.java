package com.squad;

import java.util.*;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("dev")
public class DemoApi {
  final DemoData demo;

  DemoApi(DemoData d) {
    demo = d;
  }

  @Bean
  ApplicationRunner demoInitialization(Environment env) {
    return args -> {
      demo.initialize();
      if (env.getProperty("APP_DEMO_DATA", Boolean.class, false)) demo.load();
    };
  }

  @PostMapping(value = "/api/dev/demo", consumes = "application/json")
  @PreAuthorize("hasRole('ADMIN')")
  Map<String, Object> load() {
    return demo.load();
  }
}
