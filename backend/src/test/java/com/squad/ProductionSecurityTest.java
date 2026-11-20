package com.squad;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "spring.profiles.active=production",
      "spring.datasource.url=jdbc:h2:mem:production-security;MODE=Oracle;DB_CLOSE_DELAY=-1",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "APP_BOOTSTRAP_ADMIN_USERNAME=operator",
      "APP_BOOTSTRAP_ADMIN_PASSWORD=test-only-bootstrap-password"
    })
@AutoConfigureMockMvc
class ProductionSecurityTest {
  @Autowired MockMvc mvc;

  @Test
  void productionBootstrapUsesIndividualAccountAndRequiresHttps() throws Exception {
    mvc.perform(get("/api/me")).andExpect(status().is3xxRedirection());
    mvc.perform(
            get("/api/me")
                .secure(true)
                .with(httpBasic("operator", "test-only-bootstrap-password"))
                .with(
                    r -> {
                      r.setRemoteAddr("192.0.2.10");
                      return r;
                    }))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("operator"));
    mvc.perform(
            get("/api/me")
                .secure(true)
                .with(httpBasic("admin", "dev-admin"))
                .with(
                    r -> {
                      r.setRemoteAddr("192.0.2.11");
                      return r;
                    }))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/auth/config").secure(true))
        .andExpect(jsonPath("$.mode").value("production"))
        .andExpect(jsonPath("$.demoAvailable").value(false));
    mvc.perform(
            post("/api/dev/demo")
                .secure(true)
                .with(httpBasic("operator", "test-only-bootstrap-password"))
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isNotFound());
  }

  @Test
  void repeatedFailuresAreThrottled() throws Exception {
    for (int i = 0; i < 5; i++)
      mvc.perform(
              get("/api/me")
                  .secure(true)
                  .with(httpBasic("operator", "incorrect"))
                  .with(
                      r -> {
                        r.setRemoteAddr("192.0.2.20");
                        return r;
                      }))
          .andExpect(status().isUnauthorized());
    mvc.perform(
            get("/api/me")
                .secure(true)
                .with(httpBasic("operator", "incorrect"))
                .with(
                    r -> {
                      r.setRemoteAddr("192.0.2.20");
                      return r;
                    }))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().exists("Retry-After"));
  }
}
