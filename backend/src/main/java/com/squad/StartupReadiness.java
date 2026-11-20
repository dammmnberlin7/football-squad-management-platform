package com.squad;

import org.springframework.boot.actuate.health.*;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Health must not report ready until account and demo-marker initialization completes. */
@Component
public class StartupReadiness implements HealthIndicator {
  private volatile boolean ready;

  @EventListener(ApplicationReadyEvent.class)
  public void ready() {
    ready = true;
  }

  @Override
  public Health health() {
    return ready ? Health.up().build() : Health.outOfService().build();
  }
}
