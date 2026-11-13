WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
-- Signed terms and historical events cannot be rewritten or removed.
CREATE OR REPLACE TRIGGER preserve_signed_terms
BEFORE UPDATE OR DELETE ON squad_contract FOR EACH ROW
BEGIN
 IF :OLD.status <> 'DRAFT' THEN
  IF DELETING THEN RAISE_APPLICATION_ERROR(-20001, 'Signed contract history cannot be deleted'); END IF;
  IF UPDATING AND (:NEW.player_id <> :OLD.player_id OR :NEW.club_id <> :OLD.club_id OR :NEW.starts <> :OLD.starts OR :NEW.ends <> :OLD.ends OR :NEW.salary <> :OLD.salary OR :NEW.status NOT IN ('SIGNED','TERMINATED')) THEN
   RAISE_APPLICATION_ERROR(-20002, 'Signed contract terms are immutable');
  END IF;
 END IF;
END;
/
CREATE OR REPLACE TRIGGER preserve_contract_events
BEFORE UPDATE OR DELETE ON squad_contractevent
BEGIN
 RAISE_APPLICATION_ERROR(-20003, 'Contract events are append only');
END;
/
-- Advisory validation for SQL tooling. Application uses the same player-row lock
-- protocol and checks inside its transaction; never grant direct DML to end users.
CREATE OR REPLACE PACKAGE squad_contract_rules AS
 PROCEDURE assert_available(p_player_id NUMBER, p_starts DATE, p_ends DATE);
END;
/
CREATE OR REPLACE PACKAGE BODY squad_contract_rules AS
 PROCEDURE assert_available(p_player_id NUMBER, p_starts DATE, p_ends DATE) IS
  v_id NUMBER; v_count NUMBER;
 BEGIN
  SELECT id INTO v_id FROM squad_player WHERE id=p_player_id FOR UPDATE;
  SELECT COUNT(*) INTO v_count FROM squad_contract WHERE player_id=p_player_id
   AND status='SIGNED' AND starts<=p_ends AND ends>=p_starts;
  IF v_count>0 THEN RAISE_APPLICATION_ERROR(-20004, 'Overlapping signed contract'); END IF;
 END;
END;
/
