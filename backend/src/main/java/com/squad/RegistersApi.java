package com.squad;

import jakarta.persistence.criteria.*;
import java.util.*;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@Transactional(readOnly = true)
public class RegistersApi {
  final ClubRepository clubs;
  final PlayerRepository players;
  final ContractRepository contracts;
  final TransferRepository transfers;
  final PerformanceRepository performances;
  final AuditRepository audits;

  RegistersApi(
      ClubRepository c,
      PlayerRepository p,
      ContractRepository co,
      TransferRepository t,
      PerformanceRepository pe,
      AuditRepository a) {
    clubs = c;
    players = p;
    contracts = co;
    transfers = t;
    performances = pe;
    audits = a;
  }

  record Result<T>(
      List<T> content,
      long totalElements,
      int totalPages,
      int number,
      int size,
      List<Player> players,
      List<Club> clubs) {
    static <T> Result<T> of(Page<T> p) {
      return new Result<>(
          p.getContent(),
          p.getTotalElements(),
          p.getTotalPages(),
          p.getNumber(),
          p.getSize(),
          List.of(),
          List.of());
    }
  }

  Pageable page(int page, int size) {
    if (page < 0 || size < 1 || size > 100)
      throw new IllegalArgumentException("Page must be non-negative and size between 1 and 100");
    return PageRequest.of(page, size, Sort.by("id"));
  }

  String query(String q) {
    if (q.length() > 120)
      throw new IllegalArgumentException("Search text must be at most 120 characters");
    return "%"
        + q.trim()
            .toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        + "%";
  }

  Predicate like(CriteriaBuilder cb, Expression<String> field, String q) {
    return cb.like(cb.lower(field), q, '\\');
  }

  Subquery<Long> named(CriteriaQuery<?> query, CriteriaBuilder cb, Class<?> entity, String q) {
    var sub = query.subquery(Long.class);
    var root = sub.from(entity);
    sub.select(root.get("id")).where(like(cb, root.get("name"), q));
    return sub;
  }

  <T> Specification<T> spec(String type, String text, Long club, String status) {
    String search = query(text);
    return (root, q, cb) -> {
      List<Predicate> and = new ArrayList<>(), or = new ArrayList<>();
      if (type.equals("clubs") || type.equals("players"))
        or.add(like(cb, root.get("name"), search));
      if (type.equals("players")) {
        or.add(like(cb, root.get("position"), search));
        or.add(root.get("clubId").in(named(q, cb, Club.class, search)));
      }
      if (Set.of("contracts", "transfers", "performances").contains(type))
        or.add(root.get("playerId").in(named(q, cb, Player.class, search)));
      if (type.equals("contracts")) {
        or.add(like(cb, root.get("status"), search));
        or.add(root.get("clubId").in(named(q, cb, Club.class, search)));
        if (status != null && !status.isBlank()) and.add(cb.equal(root.get("status"), status));
      }
      if (type.equals("transfers")) {
        or.add(root.get("fromClubId").in(named(q, cb, Club.class, search)));
        or.add(root.get("toClubId").in(named(q, cb, Club.class, search)));
      }
      if (!text.isBlank()) and.add(cb.or(or.toArray(Predicate[]::new)));
      if (club != null) {
        if (type.equals("clubs")) and.add(cb.equal(root.get("id"), club));
        else if (type.equals("transfers"))
          and.add(
              cb.or(cb.equal(root.get("fromClubId"), club), cb.equal(root.get("toClubId"), club)));
        else if (type.equals("performances")) {
          var sub = q.subquery(Long.class);
          var p = sub.from(Player.class);
          sub.select(p.get("id")).where(cb.equal(p.get("clubId"), club));
          and.add(root.get("playerId").in(sub));
        } else and.add(cb.equal(root.get("clubId"), club));
      }
      return cb.and(and.toArray(Predicate[]::new));
    };
  }

  @GetMapping("/registers/{type}")
  Result<?> register(
      @PathVariable String type,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(required = false) Long clubId,
      @RequestParam(defaultValue = "") String status,
      Authentication auth) {
    var pageable = page(page, size);
    query(q);
    if (clubId != null && clubId <= 0) throw new IllegalArgumentException("Invalid club filter");
    if (!status.isBlank()
        && (!type.equals("contracts") || !Set.of("DRAFT", "SIGNED", "TERMINATED").contains(status)))
      throw new IllegalArgumentException("Invalid status filter");
    if (Set.of("contracts", "transfers").contains(type)
        && auth.getAuthorities().stream()
            .noneMatch(a -> Set.of("ROLE_ADMIN", "ROLE_FINANCE").contains(a.getAuthority())))
      throw new org.springframework.security.access.AccessDeniedException(
          "Financial access required");
    return enrich(
        switch (type) {
          case "clubs" -> Result.of(clubs.findAll(spec(type, q, clubId, status), pageable));
          case "players" -> Result.of(players.findAll(spec(type, q, clubId, status), pageable));
          case "contracts" -> Result.of(contracts.findAll(spec(type, q, clubId, status), pageable));
          case "transfers" -> Result.of(transfers.findAll(spec(type, q, clubId, status), pageable));
          case "performances" ->
              Result.of(performances.findAll(spec(type, q, clubId, status), pageable));
          default -> throw new NoSuchElementException();
        });
  }

  Result<?> enrich(Result<?> result) {
    var playerIds = new HashSet<Long>();
    var clubIds = new HashSet<Long>();
    for (var row : result.content()) {
      if (row instanceof Player p) {
        playerIds.add(p.id);
        clubIds.add(p.clubId);
      } else if (row instanceof Club c) clubIds.add(c.id);
      else if (row instanceof Contract c) {
        playerIds.add(c.playerId);
        clubIds.add(c.clubId);
      } else if (row instanceof Transfer t) {
        playerIds.add(t.playerId);
        clubIds.add(t.fromClubId);
        clubIds.add(t.toClubId);
      } else if (row instanceof Performance p) playerIds.add(p.playerId);
    }
    var namedPlayers = players.findAllById(playerIds);
    namedPlayers.forEach(p -> clubIds.add(p.clubId));
    return new Result<>(
        result.content(),
        result.totalElements(),
        result.totalPages(),
        result.number(),
        result.size(),
        namedPlayers,
        clubs.findAllById(clubIds));
  }

  @GetMapping("/lookups/{type}")
  Result<?> lookup(
      @PathVariable String type,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "50") int size,
      @RequestParam(required = false) Long id) {
    var paging = page(page, size);
    query(q);
    return switch (type) {
      case "players" ->
          id == null
              ? enrich(Result.of(players.findAll(spec("players", q, null, ""), paging)))
              : new Result<>(
                  List.of(players.findById(id).orElseThrow()), 1, 1, 0, 1, List.of(), List.of());
      case "clubs" ->
          id == null
              ? Result.of(clubs.findAll(spec("clubs", q, null, ""), paging))
              : new Result<>(
                  List.of(clubs.findById(id).orElseThrow()), 1, 1, 0, 1, List.of(), List.of());
      default -> throw new NoSuchElementException();
    };
  }

  @GetMapping("/audit")
  @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
  Result<AuditEvent> audit(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(defaultValue = "") String q,
      Authentication auth) {
    String search = query(q);
    boolean admin =
        auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    Specification<AuditEvent> spec =
        (r, qu, cb) ->
            cb.and(
                admin ? cb.conjunction() : cb.isTrue(r.get("financial")),
                cb.or(
                    like(cb, r.get("actor"), search),
                    like(cb, r.get("action"), search),
                    like(cb, r.get("resource"), search)));
    return Result.of(audits.findAll(spec, page(page, size)));
  }
}
