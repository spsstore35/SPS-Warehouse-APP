alter table public.bookings add column if not exists payment_method text;
alter table public.public_sale_items add column if not exists size_chart_url text;
