package com.squad;

import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class Security {
  @Bean
  SecurityFilterChain chain(HttpSecurity h) throws Exception {
    return h.csrf(c -> c.ignoringRequestMatchers("/api/**"))
        .authorizeHttpRequests(
            a -> a.requestMatchers("/actuator/health").permitAll().anyRequest().authenticated())
        .httpBasic(b -> {})
        .sessionManagement(
            s ->
                s.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
        .build();
  }

  @Bean
  UserDetailsService users(Environment e) {
    var enc = new BCryptPasswordEncoder();
    boolean dev =
        java.util.Arrays.asList(e.getActiveProfiles()).contains("dev")
            || (e.getActiveProfiles().length == 0);
    var users = new java.util.ArrayList<UserDetails>();
    for (String role : new String[] {"ADMIN", "FINANCE", "COACH"}) {
      String password = e.getProperty("APP_" + role + "_PASSWORD");
      if (password == null || password.isBlank()) {
        if (!dev) throw new IllegalStateException("APP_" + role + "_PASSWORD required");
        password = "dev-" + role.toLowerCase();
      }
      users.add(
          User.withUsername(role.toLowerCase())
              .password("{bcrypt}" + enc.encode(password))
              .roles(role)
              .build());
    }
    return new InMemoryUserDetailsManager(users);
  }
}
