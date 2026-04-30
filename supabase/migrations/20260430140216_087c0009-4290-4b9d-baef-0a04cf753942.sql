UPDATE public.agent_projects
SET execution_status = 'error',
    error_message = 'Worker terminato prima del completamento (timeout). Usa "Riprendi produzione" per ripartire.'
WHERE execution_status = 'running'
  AND updated_at < now() - interval '5 minutes';