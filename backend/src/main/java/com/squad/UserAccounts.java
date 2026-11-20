package com.squad;

import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserAccounts {
  final UserRepository users;
  final PasswordEncoder encoder;
  final Environment env;
  final Audit audit;

  UserAccounts(UserRepository u, PasswordEncoder p, Environment e, Audit audit) {
    this.audit = audit;
    users = u;
    encoder = p;
    env = e;
  }

  @Transactional
  public void initialize() {
    if (users.count() != 0) return;
    if (env.matchesProfiles("production")) {
      String username = env.getRequiredProperty("APP_BOOTSTRAP_ADMIN_USERNAME"),
          password = env.getRequiredProperty("APP_BOOTSTRAP_ADMIN_PASSWORD");
      if (!username.matches("[a-zA-Z0-9._-]{3,80}") || password.isBlank() || password.length() < 16)
        throw new IllegalStateException(
            "Bootstrap administrator requires a valid username and a password of at least 16"
                + " characters");
      add(username, password, "ADMIN");
    } else {
      for (String role : new String[] {"ADMIN", "FINANCE", "COACH"}) {
        String password = env.getProperty("APP_" + role + "_PASSWORD");
        if (password == null || password.isBlank()) {
          if (!env.matchesProfiles("dev"))
            throw new IllegalStateException("Account password bindings required outside dev");
          password = "dev-" + role.toLowerCase();
        }
        add(role.toLowerCase(), password, role);
      }
    }
  }

  void add(String name, String password, String role) {
    var u = new AppUser();
    u.username = name;
    u.passwordHash = encoder.encode(password);
    u.roles = role;
    users.save(u);
    audit.record("BOOTSTRAP_CREATED", "USER", u.id);
  }
}
