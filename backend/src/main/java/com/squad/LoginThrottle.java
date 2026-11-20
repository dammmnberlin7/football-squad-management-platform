package com.squad;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.concurrent.*;
import org.springframework.web.filter.OncePerRequestFilter;

/** Bounded, per-instance failed-authentication throttle; ingress limits complement it. */
public class LoginThrottle extends OncePerRequestFilter {
  record Attempts(int failures, long until) {}

  final ConcurrentMap<String, Attempts> attempts = new ConcurrentHashMap<>();

  @Override
  protected void doFilterInternal(
      HttpServletRequest req, HttpServletResponse res, FilterChain chain)
      throws ServletException, IOException {
    if (!req.getRequestURI().startsWith("/api/")
        || req.getRequestURI().equals("/api/auth/config")) {
      chain.doFilter(req, res);
      return;
    }
    long now = System.currentTimeMillis();
    String key = req.getRemoteAddr();
    var a = attempts.get(key);
    if (a != null && a.until() > now && a.failures() >= 5) {
      res.setStatus(429);
      res.setHeader("Retry-After", String.valueOf(Math.max(1, (a.until() - now) / 1000)));
      res.setContentType("application/json");
      res.getWriter().write("{\"error\":\"Too many authentication failures; retry later\"}");
      return;
    }
    if (attempts.size() >= 10000) {
      attempts.entrySet().removeIf(e -> e.getValue().until() <= now);
      if (attempts.size() >= 10000 && a == null) {
        res.setStatus(429);
        res.setHeader("Retry-After", "300");
        return;
      }
    }
    chain.doFilter(req, res);
    if (res.getStatus() == 401)
      attempts.compute(
          key,
          (k, old) ->
              old == null || old.until() <= now
                  ? new Attempts(1, now + 300000)
                  : new Attempts(old.failures() + 1, old.until()));
  }
}
