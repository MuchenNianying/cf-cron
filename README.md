# CF-Cron - Cloudflare Worker 定时任务管理系统

## 项目简介

CF-Cron 是一个基于 Cloudflare Workers 和 D1 数据库的定时任务管理系统，参考了 gocron 的设计理念。它支持 HTTP 请求类型的定时任务，并提供了完整的 Web 管理界面。

### 核心功能

- ✅ 定时任务管理（创建、编辑、删除、启用/禁用）
- ✅ HTTP 请求支持（GET、POST、PUT、DELETE）
- ✅ 自定义请求头和请求体
- ✅ 任务执行日志记录
- ✅ 角色权限管理（管理员/普通用户）
- ✅ 响应式 Web 界面
- ✅ 支持部署到 Cloudflare Workers

## 技术栈

### 前端
- React + TypeScript
- Vite 构建工具
- Ant Design UI 库
- React Router 路由管理
- Axios HTTP 客户端

### 后端
- Cloudflare Workers
- Hono Web 框架
- Cloudflare D1 数据库
- JWT 认证
- Cron 表达式解析

## 项目结构

```
cf-cron/
├── client/              # 前端代码
│   ├── public/          # 静态资源
│   ├── src/             # 源代码
│   │   ├── components/  # 通用组件
│   │   ├── pages/       # 页面组件
│   │   ├── App.tsx      # 应用入口
│   │   └── main.tsx     # 主入口
│   ├── package.json     # 前端依赖
│   └── vite.config.ts   # Vite 配置
├── server/              # 服务端代码
│   ├── routes/          # API 路由
│   ├── services/        # 业务逻辑
│   ├── sql/             # 数据库文件
│   ├── index.ts         # 服务端入口
│   ├── package.json     # 服务端依赖
│   └── wrangler.toml    # Cloudflare 配置
├── .gitignore           # Git 忽略文件
└── README.md            # 项目文档
```

## 本地开发环境设置

### 1. 前提条件

- Node.js 18+ 环境
- npm 或 yarn 包管理器
- Cloudflare 账户
- Wrangler CLI 已安装 (`npm install -g wrangler`)

### 2. 安装依赖

#### 前端依赖

```bash
cd client
npm install
```

#### 后端依赖

```bash
cd server
npm install
```

### 3. 本地开发启动

#### 启动服务端

```bash
cd server
npm run dev -- --test-scheduled
```

服务端将运行在 `http://127.0.0.1:8787`

#### 启动前端

```bash
cd client
npm run dev
```

前端将运行在 `http://localhost:5173`

## Cloudflare 部署步骤

### 1. 准备工作

1. 登录 Cloudflare 账户
2. 创建一个新的 Worker 项目
3. 创建一个 D1 数据库（命名为 `cf-cron-db`）

### 2. 配置 Wrangler

编辑 `server/wrangler.toml` 文件，配置数据库绑定和JWT密钥：

```toml
name = "cf-cron"
main = "index.ts"
compatibility_date = "2025-12-08"

d1_databases = [
  {
    binding = "DB",
    database_name = "cf-cron-db",
    database_id = ""  # 在Cloudflare控制台创建数据库后填入
  }
]

[vars]
JWT_SECRET = ""  # 填入安全的JWT密钥

[triggers]
crons = ["* * * * *"]  # 每分钟触发一次检查
```

### 3. 配置 Worker 环境变量

在部署前，你需要在 Cloudflare Workers 控制台或通过 Wrangler CLI 设置以下配置项：

1. **数据库配置**：
   - 在 Cloudflare 控制台创建 D1 数据库
   - 将数据库 ID 填入 `wrangler.toml` 文件的 `database_id` 字段

2. **JWT 密钥配置**：
   - 在 `wrangler.toml` 文件的 `JWT_SECRET` 字段填入安全的密钥
   - 或通过 Cloudflare 控制台设置环境变量

### 4. 数据库初始化

执行数据库初始化脚本：

```bash
cd server
npm run db:migrate
```

### 4. 部署服务端

```bash
cd server
npm run deploy
```

部署成功后，Wrangler 会返回 Worker 的 URL。

### 5. 配置前端 API 地址

编辑 `client/src/App.tsx` 文件，将 API 地址改为你的 Worker URL：

```typescript
const API_BASE_URL = 'https://YOUR_WORKER_NAME.YOUR_ACCOUNT.workers.dev';
```

### 6. 构建前端

```bash
cd client
npm run build
```

## 部署到 Cloudflare

### 1. 后端部署（cf-cron-server）

1. **配置文件**：
   - `server/wrangler.toml` 已配置为 `cf-cron-server`

2. **部署方式**：
   - **手动部署**：
     ```bash
     cd server
     npm run deploy
     ```
   - **自动部署**：通过 GitHub Actions 自动部署

### 2. 前端部署（cf-cron）

1. **构建**：
   ```bash
   cd client
   npm run build
   ```

2. **部署方式**：
   - **手动部署**：将 `client/dist` 目录部署到 Cloudflare Pages
   - **自动部署**：通过 GitHub Actions 自动部署

### 3. GitHub Actions 自动部署

项目已配置 GitHub Actions 自动部署：

#### 配置文件
- `/.github/workflows/deploy_server.yml`：自动部署后端到 Cloudflare Workers
- `/.github/workflows/deploy_client.yml`：自动部署前端到 Cloudflare Pages

#### 所需 GitHub Secrets

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中设置以下 Secrets：

1. **通用配置**：
   - `CLOUDFLARE_API_TOKEN`：Cloudflare API 令牌（需要 Workers 和 Pages 编辑权限）
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID

2. **前端配置**：
   - `SERVER_URL`：后端 API 服务地址（例如：`https://cf-cron-server.your-account.workers.dev/api`）

#### Cloudflare API Token 权限设置

创建 Cloudflare API Token 时，需要设置以下权限：

1. **权限范围**：
   - **Account** → **Workers Scripts** → **Edit**：用于部署 Workers
   - **Account** → **Pages** → **Edit**：用于部署 Pages
   - **Account** → **D1** → **Edit**：用于管理 D1 数据库

2. **创建步骤**：
   - 登录 Cloudflare 控制台
   - 访问：https://dash.cloudflare.com/profile/api-tokens
   - 点击 "Create Token"
   - 选择 "Create Custom Token"
   - 名称：`cf-cron-deployment`
   - 权限设置：
     - 选择 "Account" → "Workers Scripts" → "Edit"
     - 选择 "Account" → "Pages" → "Edit"
     - 选择 "Account" → "D1" → "Edit"
   - 账户资源：选择你的 Cloudflare 账户
   - 点击 "Continue to summary"
   - 点击 "Create Token"
   - 复制生成的 API Token 并保存到 GitHub Secrets

#### 部署流程
1. 推送代码到 `master` 分支
2. GitHub Actions 自动触发部署
3. 后端部署到 Cloudflare Workers（cf-cron-server）
4. 前端构建并部署到 Cloudflare Pages（cf-cron）

### 4. 环境变量配置

#### 后端环境变量
- `SECRET_KEY`：JWT签名密钥（通过Cloudflare控制台或Wrangler CLI设置为密钥类型）

#### 前端环境变量
- `SERVER_URL`：后端 API 服务地址（默认：`/api`）

## 数据库结构

系统使用以下数据表：

### `users` 表 - 用户信息
- `id` (INTEGER PRIMARY KEY): 用户 ID
- `username` (TEXT UNIQUE): 用户名
- `password` (TEXT): 密码哈希
- `is_admin` (INTEGER): 是否为管理员 (1=是, 0=否)
- `created_at` (TIMESTAMP): 创建时间

### `tasks` 表 - 任务信息
- `id` (INTEGER PRIMARY KEY): 任务 ID
- `name` (TEXT): 任务名称
- `level` (INTEGER): 任务级别
- `dependency_task_id` (TEXT): 依赖任务 ID
- `dependency_status` (INTEGER): 依赖状态
- `spec` (TEXT): Cron 表达式（6位格式：秒 分 时 日 月 星期）
- `protocol` (INTEGER): 执行协议 (1=HTTP, 其他值保留)
- `command` (TEXT): 请求 URL（当 protocol=1 时）
- `http_method` (INTEGER): HTTP 请求方法 (1=GET, 2=POST)
- `timeout` (INTEGER): 超时时间（秒）
- `multi` (INTEGER): 是否允许多实例执行
- `retry_times` (INTEGER): 重试次数
- `retry_interval` (INTEGER): 重试间隔（秒）
- `notify_status` (INTEGER): 通知状态
- `notify_type` (INTEGER): 通知类型
- `notify_receiver_id` (TEXT): 通知接收者 ID
- `notify_keyword` (TEXT): 通知关键词
- `tag` (TEXT): 任务标签
- `remark` (TEXT): 任务备注
- `status` (INTEGER): 是否启用 (1=启用, 0=禁用)
- `request_headers` (TEXT): HTTP 请求头 (JSON 格式)
- `request_body` (TEXT): HTTP 请求体

### `task_logs` 表 - 任务执行日志
- `id` (INTEGER PRIMARY KEY): 日志 ID
- `task_id` (INTEGER): 任务 ID
- `name` (TEXT): 任务名称
- `spec` (TEXT): Cron 表达式
- `protocol` (INTEGER): 执行协议
- `command` (TEXT): 执行命令/URL
- `timeout` (INTEGER): 超时时间
- `retry_times` (INTEGER): 重试次数
- `start_time` (TIMESTAMP): 开始时间
- `end_time` (TIMESTAMP): 结束时间
- `status` (INTEGER): 执行状态 (2=成功, 0=失败)
- `result` (TEXT): 执行结果

## 初始账户

系统初始化后会创建一个默认管理员账户：

- **用户名**: `admin`
- **密码**: `admin123`

首次登录后请立即修改密码！

## 使用指南

### 1. 登录系统

访问前端页面，使用默认账户登录系统。

### 2. 管理任务

#### 创建任务
1. 点击「任务管理」→「新建任务」
2. 填写任务名称、Cron 表达式（6位格式：秒 分 时 日 月 星期）
3. 选择请求方法（GET、POST、PUT、DELETE）
4. 填写请求 URL
5. 设置请求头和请求体（JSON 格式，如果需要）
6. 选择任务状态（启用/禁用）
7. 填写标签和备注（可选）
8. 点击「创建」按钮

#### 编辑任务
1. 在任务列表中找到要编辑的任务
2. 点击「编辑」按钮
3. 修改任务信息
4. 点击「更新」按钮

#### 执行任务
1. 在任务列表中找到要执行的任务
2. 点击「执行」按钮
3. 任务将立即执行，并在日志中记录结果

### 3. 查看日志

点击「任务日志」查看所有任务的执行记录。

### 4. 管理用户

**仅管理员可操作**

1. 点击「用户管理」
2. 可以查看、编辑用户信息，或创建新用户

### 5. 系统设置

**仅管理员可操作**

点击「系统设置」查看系统信息和配置。

## 常见问题排查

### 1. 任务不执行

- 检查任务是否已启用
- 验证 Cron 表达式是否正确
- 检查网络连接是否正常
- 查看任务日志了解详细错误信息

### 2. 登录失败

- 检查用户名和密码是否正确
- 确认服务端是否正常运行
- 查看浏览器控制台是否有错误信息

### 3. API 调用失败

- 检查前端 API 地址配置是否正确
- 确认服务端是否正常运行
- 查看浏览器网络请求详情

### 4. 部署到 Cloudflare 后任务不执行

- 确认 `wrangler.toml` 中的 `crons` 配置已设置
- 检查 Cloudflare Worker 的状态
- 查看 Cloudflare 控制台的日志

## Cron 表达式格式

系统使用标准的 6 位 Cron 表达式格式（秒 分 时 日 月 星期）：

```
┌───────────── 秒 (0-59)
│ ┌───────────── 分钟 (0-59)
│ │ ┌───────────── 小时 (0-23)
│ │ │ ┌───────────── 日 (1-31)
│ │ │ │ ┌───────────── 月 (1-12)
│ │ │ │ │ ┌───────────── 星期 (0-6) (0 表示星期日)
│ │ │ │ │ │
* * * * * *
```

### 示例

- `* * * * * *` - 每秒执行一次
- `0 * * * * *` - 每分钟执行一次
- `0 0 * * * *` - 每小时执行一次
- `0 0 0 * * *` - 每天午夜执行一次
- `0 0 0 * * 0` - 每周日午夜执行一次
- `0 0 0 1 * *` - 每月1日午夜执行一次

## 安全建议

1. **修改默认密码**：首次登录后立即修改管理员密码
2. **使用 HTTPS**：确保所有通信都通过 HTTPS 进行
3. **限制访问**：考虑使用 Cloudflare Access 限制对管理界面的访问
4. **定期备份**：定期备份 D1 数据库
5. **使用强密码**：为所有用户设置强密码
6. **最小权限**：仅为需要管理权限的用户分配管理员角色

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过 GitHub Issues 提交。

---

**注意**：本系统仅供学习和内部使用，生产环境请确保适当的安全措施。