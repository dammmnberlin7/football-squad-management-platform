-- Oracle 19c+ schema. Run once as the schema owner with SQLcl or SQL*Plus.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
CREATE SEQUENCE squad_club_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_club (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, name VARCHAR2(120 CHAR) NOT NULL);
CREATE SEQUENCE squad_player_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_player (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, name VARCHAR2(120 CHAR) NOT NULL, position VARCHAR2(40 CHAR) NOT NULL, club_id NUMBER(19) NOT NULL REFERENCES squad_club(id));
CREATE SEQUENCE squad_contract_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_contract (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, player_id NUMBER(19) NOT NULL REFERENCES squad_player(id), club_id NUMBER(19) NOT NULL REFERENCES squad_club(id), starts DATE NOT NULL, ends DATE NOT NULL, salary NUMBER(14,2) NOT NULL CHECK (salary >= 0), status VARCHAR2(20 CHAR) NOT NULL CHECK (status IN ('DRAFT','SIGNED','TERMINATED')), CHECK (ends >= starts));
CREATE SEQUENCE squad_contractevent_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_contractevent (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, contract_id NUMBER(19) NOT NULL REFERENCES squad_contract(id), action VARCHAR2(40 CHAR) NOT NULL, occurred_at TIMESTAMP(6) WITH TIME ZONE NOT NULL, actor VARCHAR2(120 CHAR) NOT NULL);
CREATE SEQUENCE squad_performance_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_performance (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, player_id NUMBER(19) NOT NULL REFERENCES squad_player(id), match_date DATE NOT NULL, minutes NUMBER(10) NOT NULL CHECK(minutes BETWEEN 0 AND 130), goals NUMBER(10) NOT NULL CHECK(goals BETWEEN 0 AND 50), assists NUMBER(10) NOT NULL CHECK(assists BETWEEN 0 AND 50));
CREATE SEQUENCE squad_transfer_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_transfer (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL, player_id NUMBER(19) NOT NULL REFERENCES squad_player(id), from_club_id NUMBER(19) NOT NULL REFERENCES squad_club(id), to_club_id NUMBER(19) NOT NULL REFERENCES squad_club(id), fee NUMBER(14,2) NOT NULL CHECK(fee >= 0), completed_on DATE NOT NULL, CHECK (from_club_id <> to_club_id));
CREATE INDEX contract_player_idx ON squad_contract(player_id);
CREATE INDEX event_contract_idx ON squad_contractevent(contract_id);
