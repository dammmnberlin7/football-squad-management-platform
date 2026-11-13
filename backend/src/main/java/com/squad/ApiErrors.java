package com.squad;

import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler({IllegalArgumentException.class, MethodArgumentNotValidException.class})
  ResponseEntity<?> bad(Exception e) {
    return ResponseEntity.badRequest()
        .body(
            java.util.Map.of(
                "error",
                "Invalid request",
                "detail",
                e instanceof IllegalArgumentException
                    ? e.getMessage()
                    : "Check required fields and ranges"));
  }

  @ExceptionHandler({
    IllegalStateException.class,
    org.springframework.dao.OptimisticLockingFailureException.class,
    org.springframework.dao.PessimisticLockingFailureException.class
  })
  ResponseEntity<?> conflict(Exception e) {
    return ResponseEntity.status(409)
        .body(
            java.util.Map.of(
                "error",
                "Conflict",
                "detail",
                e instanceof IllegalStateException
                    ? e.getMessage()
                    : "Concurrent update; reload and retry"));
  }

  @ExceptionHandler(java.util.NoSuchElementException.class)
  ResponseEntity<?> missing() {
    return ResponseEntity.status(404).body(java.util.Map.of("error", "Not found"));
  }
}
