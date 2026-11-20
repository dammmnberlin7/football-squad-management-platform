package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ContractRepository
    extends JpaRepository<Contract, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Contract> {
  List<Contract> findByStatusAndEndsBetweenOrderByEndsAscIdAsc(
      String status, java.time.LocalDate from, java.time.LocalDate to);

  long countByStatusAndStartsLessThanEqualAndEndsGreaterThanEqual(
      String status, java.time.LocalDate starts, java.time.LocalDate ends);

  List<Contract> findByPlayerId(Long playerId);
}
