-- Apply after 001 and 002 to both new and existing schemas. Oracle execution pending.
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
CREATE SEQUENCE squad_user_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_user (id NUMBER(19) PRIMARY KEY, version NUMBER(19) NOT NULL,
 username VARCHAR2(80 CHAR) NOT NULL UNIQUE, password_hash VARCHAR2(100 CHAR) NOT NULL,
 roles VARCHAR2(60 CHAR) NOT NULL, enabled NUMBER(1) NOT NULL CHECK(enabled IN (0,1)));
CREATE SEQUENCE squad_audit_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_audit (id NUMBER(19) PRIMARY KEY, actor VARCHAR2(120 CHAR) NOT NULL,
 action VARCHAR2(60 CHAR) NOT NULL, resource VARCHAR2(40 CHAR) NOT NULL,
 resource_id NUMBER(19), financial NUMBER(1) NOT NULL CHECK(financial IN (0,1)), occurred_at TIMESTAMP(6) WITH TIME ZONE NOT NULL);
CREATE INDEX audit_time_idx ON squad_audit(occurred_at);
CREATE SEQUENCE squad_document_seq START WITH 1 INCREMENT BY 50;
CREATE TABLE squad_document (id NUMBER(19) PRIMARY KEY, contract_id NUMBER(19) NOT NULL REFERENCES squad_contract(id),
 filename VARCHAR2(120 CHAR) NOT NULL, byte_count NUMBER(19) NOT NULL CHECK(byte_count BETWEEN 1 AND 5242880),
 sha256 VARCHAR2(64 CHAR) NOT NULL, uploaded_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
 uploaded_by VARCHAR2(120 CHAR) NOT NULL, content BLOB NOT NULL);
CREATE INDEX document_contract_idx ON squad_document(contract_id);
CREATE TABLE squad_demo(id NUMBER(19) PRIMARY KEY, loaded NUMBER(1) NOT NULL CHECK(loaded IN (0,1)));
CREATE OR REPLACE TRIGGER preserve_audit_events
BEFORE UPDATE OR DELETE ON squad_audit
BEGIN RAISE_APPLICATION_ERROR(-20005, 'Audit events are append only'); END;
/
CREATE OR REPLACE TRIGGER preserve_contract_documents
BEFORE UPDATE OR DELETE ON squad_document
BEGIN RAISE_APPLICATION_ERROR(-20006, 'Contract documents are append only'); END;
/
