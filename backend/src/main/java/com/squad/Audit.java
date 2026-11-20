package com.squad;

import java.time.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.*;

@Component
public class Audit {
  final AuditRepository repository;
  final Clock clock;

  Audit(AuditRepository r, Clock c) {
    repository = r;
    clock = c;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void record(String action, String resource, Long id) {
    var event = new AuditEvent();
    var auth = SecurityContextHolder.getContext().getAuthentication();
    event.actor = auth == null ? "system" : auth.getName();
    event.action = action;
    event.resource = resource;
    event.resourceId = id;
    event.financial = java.util.Set.of("CONTRACT", "TRANSFER", "DOCUMENT").contains(resource);
    event.occurredAt = Instant.now(clock);
    repository.save(event);
  }
}
