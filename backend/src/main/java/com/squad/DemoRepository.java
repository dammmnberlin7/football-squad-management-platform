package com.squad;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface DemoRepository extends JpaRepository<DemoState, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select d from DemoState d where d.id=1")
  Optional<DemoState> lock();
}
