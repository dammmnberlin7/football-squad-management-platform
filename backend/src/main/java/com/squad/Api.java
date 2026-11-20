package com.squad;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.security.Principal;
import java.time.*;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Transactional
public class Api {
  final ClubRepository clubs;
  final PlayerRepository players;
  final ContractRepository contracts;
  final TransferRepository transfers;
  final PerformanceRepository performances;
  final ContractEventRepository events;
  final Clock clock;
  final Audit audit;

  Api(
      ClubRepository c,
      PlayerRepository p,
      ContractRepository co,
      TransferRepository t,
      PerformanceRepository pe,
      ContractEventRepository e,
      Clock clock,
      Audit audit) {
    this.audit = audit;
    this.clock = clock;
    clubs = c;
    players = p;
    contracts = co;
    transfers = t;
    performances = pe;
    events = e;
  }

  record ClubInput(@NotBlank @Size(max = 120) String name, Long version) {}

  record PlayerInput(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Size(max = 40) String position,
      @NotNull Long clubId,
      Long version) {}

  record ContractInput(
      @NotNull Long playerId,
      @NotNull Long clubId,
      @NotNull LocalDate starts,
      @NotNull LocalDate ends,
      @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal salary,
      Long version) {}

  record Change(@NotNull Long version) {}

  record TransferInput(
      @NotNull Long playerId,
      @NotNull Long toClubId,
      @NotNull @DecimalMin("0") @Digits(integer = 12, fraction = 2) BigDecimal fee,
      @NotNull Long playerVersion) {}

  record PerformanceInput(
      @NotNull Long playerId,
      @NotNull @PastOrPresent LocalDate matchDate,
      @NotNull @Min(0) @Max(130) Integer minutes,
      @NotNull @Min(0) @Max(50) Integer goals,
      @NotNull @Min(0) @Max(50) Integer assists) {}

  void version(Long actual, Long expected) {
    if (expected == null || !expected.equals(actual))
      throw new IllegalStateException("Stale version; reload");
  }

  @GetMapping("/me")
  Map<String, Object> me(org.springframework.security.core.Authentication a) {
    return Map.of(
        "username",
        a.getName(),
        "roles",
        a.getAuthorities().stream().map(Object::toString).toList());
  }

  @GetMapping("/clubs")
  List<Club> clubs() {
    return clubs.findAll();
  }

  @PostMapping(value = "/clubs", consumes = "application/json")
  @PreAuthorize("hasRole('ADMIN')")
  Club createClub(@Valid @RequestBody ClubInput i) {
    var c = new Club();
    c.name = i.name();
    clubs.save(c);
    audit.record("CREATED", "CLUB", c.id);
    return c;
  }

  @PutMapping(value = "/clubs/{id}", consumes = "application/json")
  @PreAuthorize("hasRole('ADMIN')")
  Club club(@PathVariable Long id, @Valid @RequestBody ClubInput i) {
    var c = clubs.findById(id).orElseThrow();
    version(c.version, i.version());
    c.name = i.name();
    audit.record("UPDATED", "CLUB", c.id);
    return c;
  }

  @GetMapping("/players")
  List<Player> players() {
    return players.findAll();
  }

  record PlayerSummary(
      Player player,
      Club club,
      int appearances,
      long minutes,
      long goals,
      long assists,
      BigDecimal goalsPer90,
      List<Performance> recentPerformances) {}

  @GetMapping("/players/{id}/summary")
  PlayerSummary playerSummary(@PathVariable Long id) {
    var player = players.findById(id).orElseThrow();
    var records = performances.findByPlayerIdOrderByMatchDateDescIdDesc(id);
    long minutes = records.stream().mapToLong(p -> p.minutes).sum();
    long goals = records.stream().mapToLong(p -> p.goals).sum();
    return new PlayerSummary(
        player,
        clubs.findById(player.clubId).orElseThrow(),
        records.size(),
        minutes,
        goals,
        records.stream().mapToLong(p -> p.assists).sum(),
        minutes == 0
            ? BigDecimal.ZERO
            : BigDecimal.valueOf(goals)
                .multiply(BigDecimal.valueOf(90))
                .divide(BigDecimal.valueOf(minutes), 2, java.math.RoundingMode.HALF_UP),
        records.stream().limit(5).toList());
  }

  @PostMapping(value = "/players", consumes = "application/json")
  @PreAuthorize("hasRole('ADMIN')")
  Player createPlayer(@Valid @RequestBody PlayerInput i) {
    clubs.findById(i.clubId()).orElseThrow();
    var p = new Player();
    p.name = i.name();
    p.position = i.position();
    p.clubId = i.clubId();
    players.save(p);
    audit.record("CREATED", "PLAYER", p.id);
    return p;
  }

  @PutMapping(value = "/players/{id}", consumes = "application/json")
  @PreAuthorize("hasRole('ADMIN')")
  Player player(@PathVariable Long id, @Valid @RequestBody PlayerInput i) {
    var p = players.locked(id).orElseThrow();
    version(p.version, i.version());
    if (!p.clubId.equals(i.clubId()))
      throw new IllegalArgumentException("Use transfers to change club");
    p.name = i.name();
    p.position = i.position();
    audit.record("UPDATED", "PLAYER", p.id);
    return p;
  }

  @GetMapping("/contracts")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  List<Contract> contracts() {
    return contracts.findAll();
  }

  @GetMapping("/contracts/expiring")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  List<Contract> expiring(@RequestParam(defaultValue = "90") int days) {
    if (days < 0 || days > 366)
      throw new IllegalArgumentException("Expiry window must be between 0 and 366 days");
    var today = LocalDate.now(clock);
    return contracts.findByStatusAndEndsBetweenOrderByEndsAscIdAsc(
        "SIGNED", today, today.plusDays(days));
  }

  void fill(Contract c, ContractInput i) {
    if (i.ends().isBefore(i.starts())) throw new IllegalArgumentException("End precedes start");
    var p = players.locked(i.playerId()).orElseThrow();
    clubs.findById(i.clubId()).orElseThrow();
    if (!p.clubId.equals(i.clubId()))
      throw new IllegalStateException("Player belongs to another club");
    c.playerId = i.playerId();
    c.clubId = i.clubId();
    c.starts = i.starts();
    c.ends = i.ends();
    c.salary = i.salary();
  }

  @PostMapping(value = "/contracts", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Contract draft(@Valid @RequestBody ContractInput i) {
    var c = new Contract();
    fill(c, i);
    contracts.save(c);
    audit.record("DRAFT_CREATED", "CONTRACT", c.id);
    return c;
  }

  @PutMapping(value = "/contracts/{id}", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Contract edit(@PathVariable Long id, @Valid @RequestBody ContractInput i) {
    var c = contracts.findById(id).orElseThrow();
    version(c.version, i.version());
    if (!c.status.equals("DRAFT"))
      throw new IllegalStateException("Signed terms immutable; create new draft");
    fill(c, i);
    audit.record("DRAFT_UPDATED", "CONTRACT", c.id);
    return c;
  }

  void event(Contract c, String action, Principal who) {
    var e = new ContractEvent();
    e.contractId = c.id;
    e.action = action;
    e.actor = who.getName();
    e.occurredAt = Instant.now(clock);
    events.save(e);
    audit.record(action, "CONTRACT", c.id);
  }

  @PostMapping(value = "/contracts/{id}/sign", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Contract sign(@PathVariable Long id, @Valid @RequestBody Change i, Principal who) {
    var c = contracts.findById(id).orElseThrow();
    var p = players.locked(c.playerId).orElseThrow();
    version(c.version, i.version());
    if (!c.status.equals("DRAFT")) throw new IllegalStateException("Only drafts can sign");
    if (!p.clubId.equals(c.clubId)) throw new IllegalStateException("Player club changed");
    if (contracts.findByPlayerId(c.playerId).stream()
        .anyMatch(
            x ->
                x.status.equals("SIGNED")
                    && !x.ends.isBefore(c.starts)
                    && !x.starts.isAfter(c.ends)))
      throw new IllegalStateException("Overlapping signed contract");
    c.status = "SIGNED";
    event(c, "SIGNED", who);
    return c;
  }

  @PostMapping(value = "/contracts/{id}/terminate", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Contract terminate(@PathVariable Long id, @Valid @RequestBody Change i, Principal who) {
    var c = contracts.findById(id).orElseThrow();
    players.locked(c.playerId).orElseThrow();
    version(c.version, i.version());
    if (!c.status.equals("SIGNED"))
      throw new IllegalStateException("Only signed contracts terminate");
    c.status = "TERMINATED";
    event(c, "TERMINATED", who);
    return c;
  }

  @GetMapping("/contracts/{id}/history")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  List<ContractEvent> history(@PathVariable Long id) {
    contracts.findById(id).orElseThrow();
    return events.findByContractId(id);
  }

  @GetMapping("/transfers")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  List<Transfer> transfers() {
    return transfers.findAll();
  }

  @PostMapping(value = "/transfers", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Transfer transfer(@Valid @RequestBody TransferInput i, Principal who) {
    var p = players.locked(i.playerId()).orElseThrow();
    version(p.version, i.playerVersion());
    clubs.findById(i.toClubId()).orElseThrow();
    if (p.clubId.equals(i.toClubId())) throw new IllegalArgumentException("Choose another club");
    var t = new Transfer();
    t.playerId = p.id;
    t.fromClubId = p.clubId;
    t.toClubId = i.toClubId();
    t.fee = i.fee();
    t.completedOn = LocalDate.now(clock);
    for (var c : contracts.findByPlayerId(p.id)) {
      if (c.status.equals("SIGNED")) {
        c.status = "TERMINATED";
        event(c, "TRANSFER_TERMINATED", who);
      }
    }
    p.clubId = i.toClubId();
    transfers.save(t);
    audit.record("COMPLETED", "TRANSFER", t.id);
    return t;
  }

  @GetMapping("/performances")
  List<Performance> performances() {
    return performances.findAll();
  }

  @PostMapping(value = "/performances", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','COACH')")
  Performance performance(@Valid @RequestBody PerformanceInput i) {
    players.findById(i.playerId()).orElseThrow();
    var p = new Performance();
    p.playerId = i.playerId();
    p.matchDate = i.matchDate();
    p.minutes = i.minutes();
    p.goals = i.goals();
    p.assists = i.assists();
    performances.save(p);
    audit.record("CREATED", "PERFORMANCE", p.id);
    return p;
  }

  record PerformanceEdit(
      @NotNull Long version,
      @NotNull Long playerId,
      @NotNull @PastOrPresent LocalDate matchDate,
      @NotNull @Min(0) @Max(130) Integer minutes,
      @NotNull @Min(0) @Max(50) Integer goals,
      @NotNull @Min(0) @Max(50) Integer assists) {}

  @PutMapping(value = "/performances/{id}", consumes = "application/json")
  @PreAuthorize("hasAnyRole('ADMIN','COACH')")
  Performance editPerformance(@PathVariable Long id, @Valid @RequestBody PerformanceEdit i) {
    var p = performances.findById(id).orElseThrow();
    version(p.version, i.version());
    if (!p.playerId.equals(i.playerId()))
      throw new IllegalArgumentException(
          "The player on an existing performance record cannot change");
    p.matchDate = i.matchDate();
    p.minutes = i.minutes();
    p.goals = i.goals();
    p.assists = i.assists();
    performances.saveAndFlush(p);
    audit.record("UPDATED", "PERFORMANCE", p.id);
    return p;
  }

  @GetMapping("/dashboard")
  Map<String, Object> dashboard(org.springframework.security.core.Authentication a) {
    var m = new LinkedHashMap<String, Object>();
    m.put("clubs", clubs.count());
    m.put("players", players.count());
    m.put("performances", performances.count());
    m.put("goals", performances.findAll().stream().mapToInt(x -> x.goals).sum());
    if (a.getAuthorities().stream()
        .anyMatch(x -> Set.of("ROLE_ADMIN", "ROLE_FINANCE").contains(x.getAuthority()))) {
      var today = LocalDate.now(clock);
      m.put(
          "activeContracts",
          contracts.countByStatusAndStartsLessThanEqualAndEndsGreaterThanEqual(
              "SIGNED", today, today));
      m.put("expiringContracts", expiring(90).size());
      m.put(
          "signedContracts",
          contracts.findAll().stream().filter(x -> x.status.equals("SIGNED")).count());
      m.put(
          "transferSpend",
          transfers.findAll().stream().map(x -> x.fee).reduce(BigDecimal.ZERO, BigDecimal::add));
    }
    return m;
  }
}
