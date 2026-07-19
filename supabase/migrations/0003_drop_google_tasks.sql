alter table public.profiles drop column if exists google_refresh_token;
alter table public.tasks drop constraint if exists tasks_user_id_google_task_id_key;
alter table public.tasks drop column if exists google_task_id;
