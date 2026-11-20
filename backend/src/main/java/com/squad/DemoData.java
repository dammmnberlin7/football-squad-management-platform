package com.squad;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("dev")
public class DemoData {
  final DemoRepository state;
  final ClubRepository clubs;
  final PlayerRepository players;
  final ContractRepository contracts;
  final PerformanceRepository performances;
  final ContractEventRepository events;
  final Clock clock;
  final Audit audit;

  DemoData(
      DemoRepository s,
      ClubRepository c,
      PlayerRepository p,
      ContractRepository co,
      PerformanceRepository pe,
      ContractEventRepository e,
      Clock cl,
      Audit a) {
    state = s;
    clubs = c;
    players = p;
    contracts = co;
    performances = pe;
    events = e;
    clock = cl;
    audit = a;
  }

  @Transactional
  public void initialize() {
    if (!state.existsById(1L)) state.save(new DemoState());
  }

  @Transactional
  public Map<String, Object> load() {
    var marker = state.lock().orElseThrow();
    if (marker.loaded) return Map.of("loaded", true, "alreadyLoaded", true);
    var today = LocalDate.now(clock);
    String[] positions = {"Goalkeeper", "Defender", "Midfielder", "Forward"};
    String[] names = {
      "Alex Morgan", "Jamie Silva", "Riley Becker", "Sam Okafor", "Taylor Rossi", "Jordan Park"
    };
    for (int c = 0; c < 3; c++) {
      var club = new Club();
      club.name = new String[] {"Berlin United", "London Athletic", "Milano City"}[c];
      clubs.save(club);
      audit.record("DEMO_CREATED", "CLUB", club.id);
      for (int i = 0; i < 6; i++) {
        var p = new Player();
        p.name = names[i] + (c == 0 ? "" : " " + (c + 1));
        p.position = positions[i % 4];
        p.clubId = club.id;
        players.save(p);
        var contract = new Contract();
        contract.playerId = p.id;
        contract.clubId = club.id;
        contract.starts = today.minusMonths(6);
        contract.ends = today.plusDays(i == 0 ? 30 : 180 + i * 60);
        contract.salary = BigDecimal.valueOf(60000 + i * 25000);
        contract.status = i == 5 ? "DRAFT" : "SIGNED";
        contracts.save(contract);
        if (contract.status.equals("SIGNED")) {
          var event = new ContractEvent();
          event.contractId = contract.id;
          event.action = "SIGNED";
          event.actor = "demo-seed";
          event.occurredAt = Instant.now(clock);
          events.save(event);
        }
        audit.record("DEMO_CREATED", "CONTRACT", contract.id);
        for (int match = 0; match < 4; match++) {
          var perf = new Performance();
          perf.playerId = p.id;
          perf.matchDate = today.minusDays(match * 7L);
          perf.minutes = i == 0 ? 90 : 60 + match * 5;
          perf.goals = i == 3 ? match % 3 : 0;
          perf.assists = i == 2 ? 1 : 0;
          performances.save(perf);
        }
      }
    }
    marker.loaded = true;
    audit.record("DEMO_DATA_LOADED", "DEMO", 1L);
    return Map.of(
        "loaded", true, "alreadyLoaded", false, "clubs", 3, "players", 18, "performances", 72);
  }
}
