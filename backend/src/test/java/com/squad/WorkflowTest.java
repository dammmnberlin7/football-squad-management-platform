package com.squad;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.*;

@SpringBootTest
@AutoConfigureMockMvc
class WorkflowTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;

  JsonNode postJson(String path, String body, int status) throws Exception {
    return json.readTree(
        mvc.perform(post("/api/" + path).contentType("application/json").content(body))
            .andExpect(status().is(status))
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  @Test
  void realPasswordAuthentication() throws Exception {
    mvc.perform(
            get("/api/me")
                .with(
                    org.springframework.security.test.web.servlet.request
                        .SecurityMockMvcRequestPostProcessors.httpBasic("coach", "dev-coach")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.username").value("coach"));
    mvc.perform(
            get("/api/me")
                .with(
                    org.springframework.security.test.web.servlet.request
                        .SecurityMockMvcRequestPostProcessors.httpBasic("coach", "wrong")))
        .andExpect(status().isUnauthorized())
        .andExpect(header().doesNotExist("WWW-Authenticate"));
  }

  @Test
  void healthAndAuthentication() throws Exception {
    mvc.perform(get("/actuator/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("UP"));
    mvc.perform(get("/api/players")).andExpect(status().isUnauthorized());
  }

  @Test
  @WithMockUser(roles = "COACH")
  void financialDataProtected() throws Exception {
    mvc.perform(get("/api/contracts")).andExpect(status().isForbidden());
    mvc.perform(get("/api/transfers")).andExpect(status().isForbidden());
    mvc.perform(get("/api/dashboard"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.transferSpend").doesNotExist());
    postJson("clubs", "{\"name\":\"Forbidden\"}", 403);
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void completeLifecycle() throws Exception {
    long a = postJson("clubs", "{\"name\":\"Berlin\"}", 200).get("id").asLong();
    long b = postJson("clubs", "{\"name\":\"London\"}", 200).get("id").asLong();
    long p =
        postJson(
                "players", "{\"name\":\"Alex\",\"position\":\"Forward\",\"clubId\":" + a + "}", 200)
            .get("id")
            .asLong();
    String terms =
        "{\"playerId\":"
            + p
            + ",\"clubId\":"
            + a
            + ",\"starts\":\"2026-01-01\",\"ends\":\"2028-12-31\",\"salary\":100000}";
    long c = postJson("contracts", terms, 200).get("id").asLong();
    var signed = postJson("contracts/" + c + "/sign", "{\"version\":0}", 200);
    Assertions.assertEquals("SIGNED", signed.get("status").asText());
    long d = postJson("contracts", terms, 200).get("id").asLong();
    postJson("contracts/" + d + "/sign", "{\"version\":0}", 409);
    mvc.perform(
            put("/api/contracts/" + c)
                .contentType("application/json")
                .content(terms.substring(0, terms.length() - 1) + ",\"version\":1}"))
        .andExpect(status().isConflict());
    postJson(
        "transfers",
        "{\"playerId\":" + p + ",\"toClubId\":" + b + ",\"fee\":250000,\"playerVersion\":5}",
        409);
    postJson(
        "transfers",
        "{\"playerId\":" + p + ",\"toClubId\":" + b + ",\"fee\":250000,\"playerVersion\":0}",
        200);
    mvc.perform(get("/api/contracts/" + c + "/history"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2));
    mvc.perform(get("/api/contracts"))
        .andExpect(jsonPath("$[?(@.id == " + c + ")].status").value("TERMINATED"));
    postJson(
        "performances",
        "{\"playerId\":"
            + p
            + ",\"matchDate\":\"2026-01-01\",\"minutes\":90,\"goals\":2,\"assists\":1}",
        200);
    mvc.perform(get("/api/dashboard")).andExpect(jsonPath("$.goals").value(2));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void rejectsInvalidRequests() throws Exception {
    postJson("clubs", "{\"name\":\"\"}", 400);
    postJson(
        "performances",
        "{\"playerId\":1,\"matchDate\":\"2026-01-01\",\"minutes\":-1,\"goals\":0,\"assists\":0}",
        400);
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void concurrentSigningSerializesOnPlayer() throws Exception {
    long club = postJson("clubs", "{\"name\":\"Race club\"}", 200).get("id").asLong();
    long player =
        postJson(
                "players",
                "{\"name\":\"Race player\",\"position\":\"GK\",\"clubId\":" + club + "}",
                200)
            .get("id")
            .asLong();
    String terms =
        "{\"playerId\":"
            + player
            + ",\"clubId\":"
            + club
            + ",\"starts\":\"2026-01-01\",\"ends\":\"2028-01-01\",\"salary\":500}";
    long one = postJson("contracts", terms, 200).get("id").asLong(),
        two = postJson("contracts", terms, 200).get("id").asLong();
    var pool = java.util.concurrent.Executors.newFixedThreadPool(2);
    var gate = new java.util.concurrent.CountDownLatch(1);
    try {
      var results = new java.util.ArrayList<java.util.concurrent.Future<Integer>>();
      for (long id : new long[] {one, two})
        results.add(
            pool.submit(
                () -> {
                  gate.await();
                  return mvc.perform(
                          post("/api/contracts/" + id + "/sign")
                              .with(
                                  org.springframework.security.test.web.servlet.request
                                      .SecurityMockMvcRequestPostProcessors.user("admin")
                                      .roles("ADMIN"))
                              .contentType("application/json")
                              .content("{\"version\":0}"))
                      .andReturn()
                      .getResponse()
                      .getStatus();
                }));
      gate.countDown();
      var statuses = new java.util.ArrayList<Integer>();
      for (var f : results) statuses.add(f.get(15, java.util.concurrent.TimeUnit.SECONDS));
      java.util.Collections.sort(statuses);
      Assertions.assertEquals(java.util.List.of(200, 409), statuses);
    } finally {
      pool.shutdownNow();
    }
  }

  @Test
  @WithMockUser(roles = "FINANCE")
  void financeCannotChangeRoster() throws Exception {
    mvc.perform(get("/api/contracts")).andExpect(status().isOk());
    postJson("clubs", "{\"name\":\"Not allowed\"}", 403);
    postJson(
        "performances",
        "{\"playerId\":1,\"matchDate\":\"2026-01-01\",\"minutes\":90,\"goals\":0,\"assists\":0}",
        403);
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void staleRosterEditRejected() throws Exception {
    long id = postJson("clubs", "{\"name\":\"Original\"}", 200).get("id").asLong();
    mvc.perform(
            put("/api/clubs/" + id)
                .contentType("application/json")
                .content("{\"name\":\"Updated\",\"version\":0}"))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/clubs/" + id)
                .contentType("application/json")
                .content("{\"name\":\"Stale\",\"version\":0}"))
        .andExpect(status().isConflict());
  }
}
