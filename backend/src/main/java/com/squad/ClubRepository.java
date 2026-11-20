package com.squad;

import java.util.*;
import org.springframework.data.jpa.repository.*;

public interface ClubRepository
    extends JpaRepository<Club, Long>,
        org.springframework.data.jpa.repository.JpaSpecificationExecutor<Club> {}
