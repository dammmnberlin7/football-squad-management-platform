package com.squad;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OperationsTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired AuditRepository audit;
  @Autowired Audit auditWriter;
  @Autowired DocumentRepository documents;

  JsonNode post(String path, Object input) throws Exception {
    return json.readTree(
        mvc.perform(
                org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                        "/api/" + path)
                    .contentType("application/json")
                    .content(json.writeValueAsBytes(input)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString());
  }

  long club(String name) throws Exception {
    return post("clubs", java.util.Map.of("name", name)).get("id").asLong();
  }

  long player(long club) throws Exception {
    return post(
            "players",
            java.util.Map.of("name", "Operations player", "position", "Forward", "clubId", club))
        .get("id")
        .asLong();
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void performanceEditsAreVersionedAndAudited() throws Exception {
    long p = player(club("Performance FC"));
    var initial =
        post(
            "performances",
            java.util.Map.of(
                "playerId", p, "matchDate", "2026-01-01", "minutes", 90, "goals", 1, "assists", 0));
    var body =
        java.util.Map.of(
            "version",
            0,
            "playerId",
            p,
            "matchDate",
            "2026-01-01",
            "minutes",
            90,
            "goals",
            3,
            "assists",
            2);
    mvc.perform(
            put("/api/performances/" + initial.get("id"))
                .contentType("application/json")
                .content(json.writeValueAsBytes(body)))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/performances/" + initial.get("id"))
                .contentType("application/json")
                .content(json.writeValueAsBytes(body)))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/players/" + p + "/summary")).andExpect(jsonPath("$.goals").value(3));
    assertTrue(
        audit.findAll().stream()
            .anyMatch(a -> a.resource.equals("PERFORMANCE") && a.action.equals("UPDATED")));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void documentsAreAppendOnlyScopedAndDownloadable() throws Exception {
    long c = club("Document FC"), p = player(c);
    var contract =
        post(
            "contracts",
            java.util.Map.of(
                "playerId",
                p,
                "clubId",
                c,
                "starts",
                "2026-01-01",
                "ends",
                "2029-01-01",
                "salary",
                70000));
    long id = contract.get("id").asLong();
    post("contracts/" + id + "/sign", java.util.Map.of("version", 0));
    byte[] bytes = "%PDF-1.7\nSample contract\n%%EOF".getBytes();
    var file = new MockMultipartFile("file", "../../signed.pdf", "application/pdf", bytes);
    var upload =
        mvc.perform(
                multipart("/api/contracts/" + id + "/documents")
                    .file(file)
                    .header("X-Requested-With", "Touchline"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.filename").value("signed.pdf"))
            .andExpect(jsonPath("$.content").doesNotExist())
            .andReturn();
    var result = json.readTree(upload.getResponse().getContentAsString());
    long docId = result.get("id").asLong();
    assertEquals(
        java.util.HexFormat.of()
            .formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)),
        result.get("sha256").asText());
    mvc.perform(get("/api/contracts/" + id + "/documents/" + docId))
        .andExpect(status().isOk())
        .andExpect(
            header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
        .andExpect(content().bytes(bytes));
    mvc.perform(get("/api/contracts/999999/documents/" + docId)).andExpect(status().isNotFound());
    mvc.perform(
            multipart("/api/contracts/" + id + "/documents")
                .file(
                    new MockMultipartFile(
                        "file", "fake.pdf", "application/pdf", "not PDF".getBytes()))
                .header("X-Requested-With", "Touchline"))
        .andExpect(status().isBadRequest());
    mvc.perform(multipart("/api/contracts/" + id + "/documents").file(file))
        .andExpect(status().isBadRequest());
    assertEquals(1, documents.findByContractIdOrderByIdDesc(id).size());
    mvc.perform(get("/api/contracts/" + id + "/history"))
        .andExpect(jsonPath("$.length()").value(1));
  }

  @Test
  @WithMockUser(roles = "COACH")
  void coachCannotReadDocumentsAccountsFinancialRegistersOrAudit() throws Exception {
    for (String path :
        new String[] {
          "/api/contracts/1/documents",
          "/api/users",
          "/api/registers/contracts",
          "/api/registers/transfers",
          "/api/audit"
        }) mvc.perform(get(path)).andExpect(status().isForbidden());
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void registersPageSearchLiteralWildcardsAndFilterOnServer() throws Exception {
    long a = club("Search Alpha% FC"), b = club("Search Beta FC");
    for (int i = 0; i < 12; i++)
      post(
          "players",
          java.util.Map.of(
              "name",
              "Search player " + String.format("%02d", i),
              "position",
              "Defender",
              "clubId",
              i < 6 ? a : b));
    mvc.perform(
            get("/api/registers/players")
                .param("q", "SEARCH PLAYER")
                .param("size", "5")
                .param("page", "1"))
        .andExpect(jsonPath("$.totalElements").value(12))
        .andExpect(jsonPath("$.content.length()").value(5))
        .andExpect(jsonPath("$.content[0].name").value("Search player 05"));
    mvc.perform(
            get("/api/registers/players").param("q", "Search").param("clubId", String.valueOf(a)))
        .andExpect(jsonPath("$.totalElements").value(6));
    mvc.perform(get("/api/lookups/players").param("q", "Search player").param("size", "5"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(5))
        .andExpect(jsonPath("$.totalElements").value(12));
    mvc.perform(get("/api/lookups/clubs").param("id", String.valueOf(a)))
        .andExpect(jsonPath("$.content[0].id").value(a));
    mvc.perform(get("/api/registers/clubs").param("q", "%"))
        .andExpect(jsonPath("$.totalElements").value(1));
    for (String query : new String[] {"page=-1", "size=101", "status=WRONG", "clubId=-2"})
      mvc.perform(get("/api/registers/players?" + query)).andExpect(status().isBadRequest());
  }

  @Test
  @WithMockUser(roles = "FINANCE")
  void financialAuditExcludesRosterAndAccounts() throws Exception {
    auditWriter.record("UPDATED", "PLAYER", 1L);
    auditWriter.record("SIGNED", "CONTRACT", 2L);
    auditWriter.record("ACCESS_UPDATED", "USER", 3L);
    mvc.perform(get("/api/audit").param("q", "UPDATED"))
        .andExpect(jsonPath("$.totalElements").value(0));
    mvc.perform(get("/api/audit").param("q", "SIGNED"))
        .andExpect(jsonPath("$.content[0].resource").value("CONTRACT"));
  }

  @Test
  @WithMockUser(username = "admin", roles = "ADMIN")
  void managesAccountsWithoutLeakingHashesOrLosingAdminAccess() throws Exception {
    var created =
        post(
            "users",
            java.util.Map.of(
                "username",
                "test-coach",
                "password",
                "test-password-long",
                "roles",
                java.util.List.of("COACH")));
    assertFalse(created.has("passwordHash"));
    long id = created.get("id").asLong();
    mvc.perform(
            put("/api/users/" + id)
                .contentType("application/json")
                .content(
                    json.writeValueAsBytes(
                        java.util.Map.of(
                            "version",
                            0,
                            "roles",
                            java.util.List.of("FINANCE"),
                            "enabled",
                            false,
                            "password",
                            "new-password-long"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(false));
    var users =
        json.readTree(
            mvc.perform(get("/api/users")).andReturn().getResponse().getContentAsString());
    for (var user : users) {
      assertFalse(user.has("passwordHash"));
      if (user.get("username").asText().equals("admin"))
        mvc.perform(
                put("/api/users/" + user.get("id"))
                    .contentType("application/json")
                    .content(
                        json.writeValueAsBytes(
                            java.util.Map.of(
                                "version",
                                user.get("version").asLong(),
                                "roles",
                                java.util.List.of("COACH"),
                                "enabled",
                                false))))
            .andExpect(status().isConflict());
    }
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void demoIsIdempotentAndPreservesExistingWork() throws Exception {
    long before = club("Existing work");
    var first = post("dev/demo", java.util.Map.of());
    assertFalse(first.get("alreadyLoaded").asBoolean());
    var second = post("dev/demo", java.util.Map.of());
    assertTrue(second.get("alreadyLoaded").asBoolean());
    mvc.perform(get("/api/registers/clubs").param("q", "Existing work"))
        .andExpect(jsonPath("$.content[0].id").value(before));
    mvc.perform(get("/api/registers/players").param("q", "Alex Morgan"))
        .andExpect(jsonPath("$.totalElements").value(3));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void incompletePerformanceRequestsCannotEraseStatistics() throws Exception {
    long player = player(club("Required statistics FC"));
    var input = new java.util.HashMap<String, Object>();
    input.put("playerId", player);
    input.put("matchDate", "2026-01-01");
    input.put("minutes", 90);
    input.put("goals", 2);
    input.put("assists", 1);
    var record = post("performances", input);
    long id = record.get("id").asLong();
    for (String field : java.util.List.of("minutes", "goals", "assists")) {
      var incomplete = new java.util.HashMap<>(input);
      incomplete.remove(field);
      mvc.perform(
              org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                      "/api/performances")
                  .contentType("application/json")
                  .content(json.writeValueAsBytes(incomplete)))
          .andExpect(status().isBadRequest());
      incomplete.put("version", 0);
      mvc.perform(
              put("/api/performances/" + id)
                  .contentType("application/json")
                  .content(json.writeValueAsBytes(incomplete)))
          .andExpect(status().isBadRequest());
    }
    mvc.perform(get("/api/players/" + player + "/summary"))
        .andExpect(jsonPath("$.appearances").value(1))
        .andExpect(jsonPath("$.goals").value(2))
        .andExpect(jsonPath("$.assists").value(1));
    input.put("goals", 0);
    input.put("assists", 0);
    input.put("version", 0);
    mvc.perform(
            put("/api/performances/" + id)
                .contentType("application/json")
                .content(json.writeValueAsBytes(input)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.goals").value(0));
  }

  @Test
  @WithMockUser(roles = "ADMIN")
  void missingAccountAccessAndNullRolesAreRejected() throws Exception {
    var user =
        post(
            "users",
            java.util.Map.of(
                "username",
                "required-access-coach",
                "password",
                "test-required-password",
                "roles",
                java.util.List.of("COACH")));
    var body = java.util.Map.of("version", 0, "roles", java.util.List.of("COACH"));
    mvc.perform(
            put("/api/users/" + user.get("id"))
                .contentType("application/json")
                .content(json.writeValueAsBytes(body)))
        .andExpect(status().isBadRequest());
    mvc.perform(
            org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/users")
                .contentType("application/json")
                .content(
                    "{\"username\":\"invalid-null-role\",\"password\":\"test-long-password\",\"roles\":[null]}"))
        .andExpect(status().isBadRequest());
    mvc.perform(get("/api/users"))
        .andExpect(jsonPath("$[?(@.username == 'required-access-coach')].enabled").value(true));
  }
}
