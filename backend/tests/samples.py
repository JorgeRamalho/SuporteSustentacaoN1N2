"""Amostra mínima compartilhada pela suíte."""

SAMPLE_LOG = """2026-11-07 08:01:12 INFO [db] healthcheck oracle-erp ok
2026-11-07 08:13:44 ERROR [db] Connection pool exhausted for oracle-erp after 30s timeout
2026-11-07 08:13:45 ERROR [db] Connection pool exhausted for oracle-erp after 31s timeout
2026-11-07 08:13:46 ERROR [db] Connection pool exhausted for oracle-erp after 32s timeout
2026-11-07 08:14:02 FATAL [billing] OutOfMemoryError: Java heap space while processing lote 4491
\tat com.empresa.Faturamento.process
Caused by: java.lang.OutOfMemoryError: Java heap space
2026-11-07 09:02:03 ERROR [mail] javax.mail.MessagingException: 421 4.3.2 queue frozen
"""
