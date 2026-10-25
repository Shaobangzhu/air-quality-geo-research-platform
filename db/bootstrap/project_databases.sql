-- Provisioning only: executed inside the newly created project container.
-- Password variables arrive through psql stdin, never command arguments.
CREATE ROLE aq_workbench_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
CREATE ROLE aq_workbench_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'test_password';

CREATE DATABASE air_quality_geo_research OWNER aq_workbench_app;
CREATE DATABASE air_quality_geo_research_test OWNER aq_workbench_test;
REVOKE ALL ON DATABASE air_quality_geo_research FROM PUBLIC;
REVOKE ALL ON DATABASE air_quality_geo_research_test FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;

\connect air_quality_geo_research
REVOKE ALL ON SCHEMA public FROM PUBLIC;

\connect air_quality_geo_research_test
REVOKE ALL ON SCHEMA public FROM PUBLIC;
