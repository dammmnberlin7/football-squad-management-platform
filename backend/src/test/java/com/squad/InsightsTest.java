package com.squad;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class InsightsTest {
  @Autowired MockMvc mvc;
  @Autowired Clock clock;
  @Autowired ClubRepository clubs;
  @Autowired PlayerRepository players;
  @Autowired PerformanceRepository performances;
  @Autowired ContractRepository contracts;

  Player player() {
    var club = new Club();
    club.name = "Insights FC";
    clubs.save(club);
    var player = new Player();
    player.name = "Test player";
    player.position = "Forward";
    player.clubId = club.id;
    return players.save(player);
  }

  Performance record(Player player, int minutes, int goals, int assists, LocalDate date) {
    var p = new Performance();
    p.playerId = player.id;
    p.minutes = minutes;
    p.goals = goals;
    p.assists = assists;
    p.matchDate = date;
    return performances.save(p);
  }

  Contract contract(Player player, LocalDate starts, LocalDate ends, String status) {
    var c = new Contract();
    c.playerId = player.id;
    c.clubId = player.clubId;
    c.starts = starts;
    c.ends = ends;
    c.salary = new BigDecimal("123456.78");
    c.status = status;
    return contracts.save(c);
  }

  @Test
  @WithMockUser(roles = "COACH")
  void profileAggregatesOnlySelectedPlayerAndHidesFinancials() throws Exception {
    var p = player();
    var other = player();
    var today = LocalDate.now(clock);
    record(p, 90, 2, 1, today.minusDays(1));
    record(p, 45, 1, 2, today);
    record(other, 90, 10, 10, today);
    contract(p, today.minusYears(1), today.plusYears(1), "SIGNED");
    mvc.perform(get("/api/players/" + p.id + "/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.appearances").value(2))
        .andExpect(jsonPath("$.minutes").value(135))
        .andExpect(jsonPath("$.goals").value(3))
        .andExpect(jsonPath("$.assists").value(3))
        .andExpect(jsonPath("$.goalsPer90").value(2.0))
        .andExpect(jsonPath("$.recentPerformances[0].minutes").value(45))
        .andExpect(jsonPath("$.salary").doesNotExist())
        .andExpect(jsonPath("$.contracts").doesNotExist());
  }

  @Test
  @WithMockUser(roles = "COACH")
  void emptyProfileAndZeroMinutesAreSafe() throws Exception {
    var p = player();
    mvc.perform(get("/api/players/" + p.id + "/summary"))
        .andExpect(jsonPath("$.appearances").value(0))
        .andExpect(jsonPath("$.recentPerformances").isEmpty())
        .andExpect(jsonPath("$.goalsPer90").value(0));
    record(p, 0, 0, 0, LocalDate.now(clock));
    mvc.perform(get("/api/players/" + p.id + "/summary"))
        .andExpect(jsonPath("$.goalsPer90").value(0));
    mvc.perform(get("/api/players/99999999/summary")).andExpect(status().isNotFound());
  }

  @Test
  @WithMockUser(roles = "COACH")
  void recentProfileLimitedAndOrdered() throws Exception {
    var p = player();
    for (int i = 0; i < 7; i++) record(p, 90, i, 0, LocalDate.now(clock).minusDays(i));
    mvc.perform(get("/api/players/" + p.id + "/summary"))
        .andExpect(jsonPath("$.appearances").value(7))
        .andExpect(jsonPath("$.recentPerformances.length()").value(5))
        .andExpect(jsonPath("$.recentPerformances[0].goals").value(0))
        .andExpect(jsonPath("$.recentPerformances[4].goals").value(4));
  }

  @Test
  @WithMockUser(roles = "FINANCE")
  void expiryWindowIncludesBoundaryAndExcludesDraftTerminatedAndPast() throws Exception {
    var p = player();
    var today = LocalDate.now(clock);
    var first = contract(p, today.minusYears(1), today, "SIGNED");
    var last = contract(p, today.minusYears(1), today.plusDays(90), "SIGNED");
    contract(p, today.minusYears(1), today.minusDays(1), "SIGNED");
    contract(p, today.minusYears(1), today.plusDays(91), "SIGNED");
    contract(p, today, today.plusDays(10), "DRAFT");
    contract(p, today, today.plusDays(20), "TERMINATED");
    mvc.perform(get("/api/contracts/expiring"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].id").value(first.id))
        .andExpect(jsonPath("$[1].id").value(last.id));
    mvc.perform(get("/api/contracts/expiring?days=0")).andExpect(jsonPath("$.length()").value(1));
    mvc.perform(get("/api/contracts/expiring?days=-1")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/contracts/expiring?days=367")).andExpect(status().isBadRequest());
  }

  @Test
  @WithMockUser(roles = "FINANCE")
  void dashboardSeparatesActiveFromFutureAndExpiredContracts() throws Exception {
    var p = player();
    var today = LocalDate.now(clock);
    long baseline =
        contracts.countByStatusAndStartsLessThanEqualAndEndsGreaterThanEqual(
            "SIGNED", today, today);
    contract(p, today, today.plusDays(90), "SIGNED");
    contract(p, today.plusDays(1), today.plusYears(1), "SIGNED");
    contract(p, today.minusYears(1), today.minusDays(1), "SIGNED");
    mvc.perform(get("/api/dashboard")).andExpect(jsonPath("$.activeContracts").value(baseline + 1));
  }

  @Test
  @WithMockUser(roles = "COACH")
  void coachCannotReadExpiryOrFinancialMetrics() throws Exception {
    mvc.perform(get("/api/contracts/expiring")).andExpect(status().isForbidden());
    mvc.perform(get("/api/dashboard"))
        .andExpect(jsonPath("$.activeContracts").doesNotExist())
        .andExpect(jsonPath("$.expiringContracts").doesNotExist());
  }
}
