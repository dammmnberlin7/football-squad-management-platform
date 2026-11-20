package com.squad;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
@Transactional
public class AccountsApi {
  final UserRepository users;
  final PasswordEncoder encoder;
  final Audit audit;

  AccountsApi(UserRepository u, PasswordEncoder p, Audit a) {
    users = u;
    encoder = p;
    audit = a;
  }

  record UserView(Long id, Long version, String username, List<String> roles, boolean enabled) {
    static UserView of(AppUser u) {
      return new UserView(u.id, u.version, u.username, List.of(u.roles.split(",")), u.enabled);
    }
  }

  record Create(
      @NotBlank @Pattern(regexp = "[a-zA-Z0-9._-]{3,80}") String username,
      @NotBlank @Size(min = 12, max = 72) String password,
      @NotEmpty Set<@NotBlank @Pattern(regexp = "ADMIN|FINANCE|COACH") String> roles) {}

  record Update(
      @NotNull Long version,
      @NotEmpty Set<@NotBlank @Pattern(regexp = "ADMIN|FINANCE|COACH") String> roles,
      @NotNull Boolean enabled,
      @Size(max = 72) String password) {}

  @GetMapping
  List<UserView> list() {
    return users.findAll().stream().map(UserView::of).toList();
  }

  @PostMapping(consumes = "application/json")
  UserView create(@Valid @RequestBody Create input) {
    users.lockAll();
    if (users.findByUsername(input.username()).isPresent())
      throw new IllegalStateException("Username already exists");
    var u = new AppUser();
    u.username = input.username();
    u.passwordHash = encoder.encode(input.password());
    u.roles = String.join(",", new TreeSet<>(input.roles()));
    users.saveAndFlush(u);
    audit.record("CREATED", "USER", u.id);
    return UserView.of(u);
  }

  @PutMapping(value = "/{id}", consumes = "application/json")
  UserView update(@PathVariable Long id, @Valid @RequestBody Update input, Principal principal) {
    var u = users.lockAll().stream().filter(x -> x.id.equals(id)).findFirst().orElseThrow();
    if (!u.version.equals(input.version()))
      throw new IllegalStateException("Stale version; reload");
    if (u.username.equals(principal.getName())
        && (!input.enabled() || !input.roles().contains("ADMIN")))
      throw new IllegalStateException("You cannot remove your own administrator access");
    if (u.enabled
        && u.roles.contains("ADMIN")
        && (!input.enabled() || !input.roles().contains("ADMIN"))
        && users.countByEnabledTrueAndRolesContaining("ADMIN") <= 1)
      throw new IllegalStateException("At least one enabled administrator is required");
    if (input.password() != null && !input.password().isEmpty()) {
      if (input.password().isBlank() || input.password().length() < 12)
        throw new IllegalArgumentException("Password must contain at least 12 characters");
      u.passwordHash = encoder.encode(input.password());
    }
    u.enabled = input.enabled();
    u.roles = String.join(",", new TreeSet<>(input.roles()));
    users.saveAndFlush(u);
    audit.record(
        input.password() != null && !input.password().isEmpty()
            ? "ACCESS_AND_PASSWORD_UPDATED"
            : "ACCESS_UPDATED",
        "USER",
        u.id);
    return UserView.of(u);
  }
}
