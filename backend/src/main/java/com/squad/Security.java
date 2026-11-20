package com.squad;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class Security {
  @Bean
  PasswordEncoder encoder() {
    return PasswordEncoderFactories.createDelegatingPasswordEncoder();
  }

  @Bean
  UserDetailsService users(UserRepository users) {
    return username -> {
      var u =
          users
              .findByUsername(username)
              .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
      return User.withUsername(u.username)
          .password(u.passwordHash)
          .roles(u.roles.split(","))
          .disabled(!u.enabled)
          .build();
    };
  }

  @Bean
  ApplicationRunner initializeAccounts(UserAccounts accounts, Environment env) {
    return args -> {
      if (env.matchesProfiles("production") && env.matchesProfiles("dev"))
        throw new IllegalStateException("Production and dev profiles cannot be combined");
      accounts.initialize();
    };
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity h, Environment env) throws Exception {
    boolean production = env.matchesProfiles("production");
    if (production && env.matchesProfiles("dev"))
      throw new IllegalStateException("Production and dev profiles cannot be combined");
    h.csrf(c -> c.ignoringRequestMatchers("/api/**"))
        .authorizeHttpRequests(
            a ->
                a.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR)
                    .permitAll()
                    .requestMatchers(
                        "/",
                        "/index.html",
                        "/assets/**",
                        "/favicon.ico",
                        "/actuator/health",
                        "/api/auth/config")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .httpBasic(
            b ->
                b.authenticationEntryPoint(
                    (request, response, error) -> {
                      response.setStatus(401);
                      response.setContentType("application/json");
                      response.getWriter().write("{\"error\":\"Invalid credentials\"}");
                    }))
        .sessionManagement(
            s ->
                s.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS));
    if (production) {
      h.requiresChannel(
          c ->
              c.requestMatchers(r -> !r.getRequestURI().equals("/actuator/health"))
                  .requiresSecure());
      h.headers(
          headers ->
              headers.contentSecurityPolicy(
                  c ->
                      c.policyDirectives(
                          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src"
                              + " 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors"
                              + " 'none'; base-uri 'self'; form-action 'self'")));
      h.addFilterBefore(new LoginThrottle(), BasicAuthenticationFilter.class);
    }
    return h.build();
  }
}
