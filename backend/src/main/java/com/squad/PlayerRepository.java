package com.squad;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface PlayerRepository extends JpaRepository<Player, Long> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select p from Player p where p.id=:id")
  Optional<Player> locked(Long id);
}
