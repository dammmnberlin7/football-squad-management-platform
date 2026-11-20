package com.squad;

import org.springframework.boot.*;
import org.springframework.boot.autoconfigure.*;

@SpringBootApplication
public class Application {
  @org.springframework.context.annotation.Bean
  java.time.Clock applicationClock() {
    return java.time.Clock.systemUTC();
  }

  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
