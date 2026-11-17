-- One public bucket for covers, event photos and product images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[1] = 'products' and public.is_admin())));
create policy media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'media' and (owner = auth.uid() or public.is_admin()));
