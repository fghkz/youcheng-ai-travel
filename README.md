# 悠程 AI 旅行规划助手

基于 Next.js App Router、TypeScript 和 Tailwind CSS 的 AI 旅行规划 MVP。目前支持演示模式，并已接入阿里云市场“全国景点查询”产品的服务端适配器。

## 环境要求

- Node.js 20.9 或更高版本
- npm 10 或更高版本

## 本地启动（演示模式）

1. 安装依赖：

   ```bash
   npm install
   ```

2. 复制环境变量示例：

   PowerShell：

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. 确认 `.env.local` 中包含：

   ```dotenv
   APP_DATA_MODE=demo
   ALLOW_DEMO_FALLBACK=true
   ```

4. 启动开发服务器：

   ```bash
   npm run dev
   ```

5. 打开 <http://localhost:3000>。

演示模式支持杭州、北京和上海，无需任何 API Key。页面会明确标记演示数据。

## 真实接口模式

将 `APP_DATA_MODE` 改为 `live`，并配置：

```dotenv
DEEPSEEK_API_KEY=
DEEPSEEK_API_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
AMAP_API_KEY=
ALIYUN_SCENIC_API_HOST=
ALIYUN_SCENIC_API_PATH=
ALIYUN_SCENIC_API_KEY=
ALIYUN_SCENIC_API_APPCODE=
```

密钥只能写在 `.env.local` 或部署平台的服务端环境变量中，不要添加 `NEXT_PUBLIC_` 前缀，也不要提交真实密钥。

阿里云景点接口使用商品 `cmapi00064421`：

- `POST https://jmqgjdcx.market.alicloudapi.com/area/scenic-spots`
- 请求头：`Authorization: APPCODE <你的 AppCode>`
- 请求体：`application/x-www-form-urlencoded`
- 当前使用 `keyword=<目的地>&page=1` 查询，并将 `data.list` 映射为统一景点模型。

购买商品后，在 `.env.local` 中填写 `ALIYUN_SCENIC_API_APPCODE`。不要把 AppCode 写入源码、`.env.example` 或聊天消息。

## 质量检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## 当前边界

- 不使用数据库、登录或浏览器持久化，刷新页面后状态清空。
- 最多选择 8 个景点。
- 首个景点之前和最后一个景点之后的交通不纳入规划。
- 演示路线是基于景点坐标生成的估算值，不可作为实际导航依据。
