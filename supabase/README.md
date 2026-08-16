# Supabase 数据库

本目录保存 AI 旅行规划助手的数据库迁移、测试与本地配置。当前迁移创建 6 张自建表；账号、邮箱与登录身份继续由 Supabase Auth 的 `auth.users` 管理。

## 文件

- `migrations/20260815193440_create_travel_product_schema.sql`：表、约束、索引、触发器、RLS、权限及行程版本 RPC。
- `migrations/20260815193628_add_trip_owner_fk_indexes.sql`：补齐复合外键覆盖索引。
- `tests/database/travel_product_schema.test.sql`：pgTAP 数据库测试。
- `seed.sql`：首版不预置业务数据。

## 本地验证

需要先安装并启动 Docker Desktop，然后在项目根目录执行：

```powershell
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:test
pnpm supabase:lint
```

停止本地 Supabase：

```powershell
pnpm supabase:stop
```

## 部署到 Supabase 项目

先在 Supabase Dashboard 创建项目，再执行：

```powershell
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push
pnpm exec supabase db lint --linked
```

`db push` 会修改远程数据库，执行前应先在本地通过迁移测试。项目 URL、公开的 anon/publishable key 和服务端 service-role key 后续分别放入 `.env.local`；service-role key 只能在服务端使用，不能使用 `NEXT_PUBLIC_` 前缀。

## 安全边界

- `anon` 没有业务表权限。
- `authenticated` 只能通过 RLS 访问自己的公开业务数据。
- `private.generation_runs` 仅 `service_role` 可访问，不保存完整提示词、酒店地址或原始模型响应。
- 新规划版本通过 `public.create_itinerary_version` 在同一事务中切换，避免同一行程出现多个当前版本。
