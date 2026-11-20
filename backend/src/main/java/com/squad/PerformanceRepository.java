package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface PerformanceRepository extends JpaRepository<Performance, Long> {
  List<Performance> findByPlayerIdOrderByMatchDateDescIdDesc(Long playerId);
}
