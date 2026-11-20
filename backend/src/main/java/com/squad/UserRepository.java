package com.squad;

import jakarta.persistence.LockModeType;
import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface UserRepository extends JpaRepository<AppUser, Long> {
  Optional<AppUser> findByUsername(String username);

  long countByEnabledTrueAndRolesContaining(String role);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from AppUser u order by u.id")
  List<AppUser> lockAll();
}
