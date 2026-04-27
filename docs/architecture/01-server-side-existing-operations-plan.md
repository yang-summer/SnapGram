# 阶段一：已有操作服务端化细化实现方案

## 目标与范围

本阶段只迁移当前已经存在且高风险的写操作：

- 点赞帖子
- 取消点赞
- 收藏帖子
- 取消收藏
- 删除帖子

本阶段不迁移注册、登录、用户资料/头像更新、创建帖子、编辑帖子、多图、评论。创建和编辑帖子继续由浏览器端直连 Appwrite，但帖子 row 权限需要从当前的全登录用户可更新，收回到作者可更新。

服务端化使用 Appwrite Functions 加 `node-appwrite` Server SDK。浏览器端继续保留当前 Appwrite Account session，敏感写操作改为调用一个聚合式 Function，由 Function 根据当前执行用户解析 profile，并使用受信任 Server SDK 执行多步写入、计数更新、权限校验和删除清理。

## 官方文档依据

- Appwrite Functions 用于运行后端代码和处理执行请求：<https://appwrite.io/docs/products/functions/functions>
- Functions 开发文档说明运行时可以读取请求、响应、环境变量和调用上下文：<https://appwrite.io/docs/products/functions/develop>
- API keys 用于 Server SDK 访问 Appwrite 资源，适合受信任服务端边界：<https://appwrite.io/docs/advanced/platform/api-keys>
- Appwrite 权限模型适合客户端最小权限，服务端通过受信任边界执行跨资源操作：<https://appwrite.io/docs/advanced/platform/permissions>
- TablesDB 支持 transactions，可将多次 row 写入作为一组提交或回滚：<https://appwrite.io/docs/products/databases/transactions>
- TablesDB 支持 atomic numeric operations，可安全增减计数字段：<https://appwrite.io/docs/products/databases/atomic-numeric-operations>

## 改了什么，改在哪里

### 一、增加一个聚合式 Appwrite Function

建议新增目录：

- `functions/content-actions/`

建议职责：

- 只暴露一个 Function，例如 `content-actions`。
- 用 `action` 字段分发当前阶段的 5 个写操作。
- Function 内部按领域拆小 helper，但不要拆成多个 Appwrite Function，避免免费额度和部署复杂度扩散。

建议请求契约：

```ts
type ContentActionRequest =
  | { action: 'post.like'; postId: string }
  | { action: 'post.unlike'; postId: string }
  | { action: 'post.save'; postId: string }
  | { action: 'post.unsave'; postId: string }
  | { action: 'post.delete'; postId: string };
```

客户端不再传 `viewerProfileId` 或 `viewerAccountId`。Function 必须从 Appwrite 执行上下文中的当前用户 account id 派生身份，再查询 `users` table 得到 profile id。

Function 内部建议文件：

- `src/main.ts`：入口、action 分发、统一错误响应。
- `src/appwrite.ts`：Server SDK client、`TablesDB`、`Storage` 初始化。
- `src/auth.ts`：解析当前 account id、加载当前用户 profile。
- `src/engagement.ts`：点赞、取消点赞、收藏、取消收藏。
- `src/delete-post.ts`：删除帖子和当前单图媒体清理。
- `src/config.ts`：读取 database、table、bucket 环境变量。

必要环境变量：

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_DATABASE_ID`
- `APPWRITE_STORAGE_ID`
- `APPWRITE_USERS_TABLE_ID`
- `APPWRITE_POSTS_TABLE_ID`
- `APPWRITE_LIKES_TABLE_ID`
- `APPWRITE_SAVES_TABLE_ID`

Function 需要可读写 TablesDB rows、可删除 Storage files 的服务端权限。优先使用 Appwrite Functions 运行时提供的动态 API key；如果改用手动 API key，则只给本 Function 所需最小 scopes。

### 二、客户端增加 Function 调用封装

改动位置：

- `app/lib/appwrite/config.ts`
- `app/vite-env.d.ts`
- 新增或调整 `app/features/post/api/post.actions.api.ts`
- 调整 `app/features/post/services/post.engagement.service.ts`
- 调整 `app/features/post/services/post.service.ts` 中删除帖子入口

`config.ts` 需要增加：

- `contentActionsFunctionId: import.meta.env.VITE_APPWRITE_CONTENT_ACTIONS_FUNCTION_ID`
- `functions = new Functions(client)`

客户端 Function 调用统一走一个窄封装：

- 序列化 `{ action, postId }`
- 使用同步 execution
- 解析 `responseBody`
- 将 Function 返回的业务错误转成普通 `Error`

基于本项目当前 `appwrite@23`，浏览器 SDK 支持对象式调用：

```ts
functions.createExecution({
  functionId,
  body: JSON.stringify(payload),
  async: false,
  xpath: '/',
  method: ExecutionMethod.POST,
  headers: { 'content-type': 'application/json' },
});
```

文档中使用 `xpath` 是因为当前 SDK 参数名如此；它会被 SDK 转换成 Appwrite execution payload 的 `path` 字段。

### 三、点赞和收藏写入改为服务端事务

改动位置：

- `app/features/post/api/post.engagement.api.ts`
- `app/features/post/services/post.engagement.service.ts`
- `app/features/post/queries/post.engagement.mutations.ts`
- `app/features/post/components/PostStats.tsx`

客户端保留现有乐观 UI，但 mutation 输入从：

- `postId`
- `viewerProfileId`
- `viewerAccountId`

收敛为：

- `postId`

Function 内部执行：

1. 读取当前 account id。
2. 查询 `users` table，得到当前 profile id。
3. 校验 post 存在且可互动。
4. 在 TablesDB transaction 中创建或删除 `likes/saves` row，并同步增减 `posts.likeCount/saveCount`。
5. `409` unique conflict 视为幂等成功，但不能重复增加计数。
6. 取消操作找不到记录时视为幂等成功，但不能重复减少计数。

当前 `likes_user_post_unique` 和 `saves_user_post_unique` 已存在，继续作为并发去重和数据唯一性的边界。新写入的互动 row 继续使用 `ID.unique()`，不引入确定性 row id。Function 在遇到 `409` unique conflict 后按 `userId + postId` 查询已有 row 并返回幂等成功即可。

### 四、删除帖子改为服务端权限校验和清理

改动位置：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.mutation.ts`
- `app/routes/postDetails.tsx`

客户端仍只传 `postId`。Function 内部执行：

1. 读取当前 account id。
2. 查询当前 profile。
3. 读取 post 的 `$id`、`creator.$id`、`imageId`。
4. 如果当前 profile 不是作者，返回 403。
5. 查询并清理当前 `likes/saves` 中 `postId` 对应的互动记录。
6. 删除 post row。
7. 删除当前单图 `imageId` 对应的 Storage file。

当前阶段仍是单图结构，删除 helper 只需要处理 `posts.imageId`。实现时应将媒体清理封装成 `cleanupPostMedia(post)`，后续多图阶段把内部实现替换为遍历媒体表和文件即可，外层 action 契约不变。

Storage 删除不能和 TablesDB transaction 放进同一个事务。应对策略：

- DB 删除前必须先完成作者校验。
- 关联 `likes/saves` 和 post row 删除尽量放在同一个 DB transaction 中。
- Storage 删除放在 DB 删除成功后执行。
- Storage `404` 视为成功。
- Storage 删除失败时 Function 内部做有限重试并记录日志，返回 `imageCleanupFailed: true`，前端提示“帖子已删除，媒体清理稍后重试或需人工检查”。

本阶段不新增清理任务表，避免违反“只迁移现有能力，不引入新数据模型”的边界。

### 五、收紧帖子和互动表权限

改动位置：

- `app/lib/appwrite/permissions.ts`
- `app/features/post/api/post.api.ts`
- `appwrite.config.json`
- `scripts/migrations/backfill-resource-permissions.mjs`

当前 `buildTransitionalPostPermissions()` 给了：

```ts
Permission.update(Role.users())
```

这是为了让任意登录用户能在客户端更新互动计数。阶段一完成后，互动计数由 Function 用 Server SDK 更新，客户端不再需要这个权限。

新建帖子 row 权限应改为：

- `read(Role.any())`
- `update(Role.user(ownerAccountId))`
- `delete(Role.user(ownerAccountId))`

可以直接复用 `buildPublicOwnerPermissions(ownerAccountId)`，或新增语义更清晰的 `buildPublicContentOwnerPermissions()`。

`likes` 和 `saves` table 的 table-level `create("users")` 也应在前端切换到 Function 后移除。客户端仍可读取自己 row，但不应再拥有 delete 权限，否则用户仍能绕过 Function 直接删除互动记录，导致计数不一致。

新建和回填后的 engagement row 权限应为：

- `read(Role.user(viewerAccountId))`

因此建议新增 `buildPrivateOwnerReadPermissions(accountId)`，并让服务端 Function 创建 `likes/saves` row 时使用它。Server SDK 使用 API key 删除互动 row，不依赖 row-level delete 权限。

历史数据需要跑权限回填脚本。当前 `backfill-resource-permissions.mjs` 仍会把 post row 回填成 transitional 权限，因此脚本必须同步改为 owner-only post 权限，再执行：

1. `--dry-run`
2. `--run`
3. `--verify`

### 六、缓存失效策略保持前端现状

改动位置：

- `app/features/post/queries/post.engagement.mutations.ts`
- `app/features/post/queries/post.mutation.ts`

点赞、收藏成功后继续失效：

- `postKeys.detail(postId)`
- `postKeys.lists()`
- 当前 viewer 的 likes/saves scope

删除帖子成功后继续：

- remove detail query
- invalidate post lists
- invalidate 作者 profile posts/count
- invalidate viewer liked/saved feeds if needed

当前 `useDeletePostMutation()` 只失效 detail 和 lists。阶段一应补齐个人页相关缓存，避免删除后 profile tab 仍展示旧帖子或旧 count。

## 为什么选择这个方案

### 一、符合路线图的阶段边界

路线图明确阶段一只迁移已有敏感写操作，不处理多图、评论和发帖模型重构。点赞、收藏、删除已经存在且风险集中，适合优先服务端化。

注册、资料头像、发帖编辑虽然也有多步写入，但迁移收益和阶段一目标不完全匹配：

- 注册涉及 Auth user 和 profile row 两类资源，服务端化能减少 `profile_missing`，但不能让跨资源一致性从原理上完全消失。
- 头像完全服务端化需要 Function 接收二进制文件，复杂度高于本阶段收益。
- 发帖编辑马上会进入多图媒体模型重构，现在服务端化单图写入会增加阶段二返工。

### 二、一个聚合式 Function 适合 Appwrite Free 限制

把 5 个动作拆成 5 个 Function 会让部署、环境变量、日志和额度管理变复杂。一个 `content-actions` Function 加 action 分发足够清晰，也符合路线图中“聚合式服务端写入边界”的取舍。

### 三、服务端派生身份，避免客户端伪造

当前客户端会把 `viewerProfileId` 和 `viewerAccountId` 传进 mutation。服务端化后这些字段不再从客户端接收，Function 只信任 Appwrite 执行上下文中的当前 account id，再通过 `users.accountId` 解析 profile。

这样可以防止用户构造请求替别人点赞、收藏、删除。

### 四、事务和唯一索引共同解决计数一致性

当前互动链路是：

- 创建 like/save row
- 再 increment post count

或：

- 删除 like/save row
- 再 decrement post count

任何一步失败都会导致 row 和 count 不一致。Function 内使用 TablesDB transaction 后，这两类 DB 写入可以一起提交或一起回滚。唯一索引用于防重复记录，atomic numeric operations 用于安全增减计数。

### 五、权限收紧后仍不阻塞创建和编辑帖子

创建和编辑帖子仍是作者行为，owner-only update 权限足够支持。互动计数不再依赖浏览器直接更新帖子 row，因此可以移除 `update(Role.users())`。

## 实现顺序与依赖关系

### 第一步：准备 Function 配置和本地结构

依赖：

- Appwrite 项目已启用 Functions。
- 项目已有 `node-appwrite` 依赖。

工作：

- 新增 `functions/content-actions/`。
- 配置 Function ID、运行时、入口文件和环境变量。
- 在 Appwrite Console 或 CLI 中给 Function 配置最小可用 scopes。
- 不先改前端调用，不先改权限。

验收：

- Function 可以被当前登录用户同步执行。
- 未登录执行返回 401。
- 空 action 或非法 action 返回 400。

### 第二步：实现服务端身份解析

依赖：

- Function 能拿到当前执行用户 account id。
- `users.accountId` unique index 已存在。

工作：

- 从执行上下文读取当前 account id。
- 查询 `users` table：`Query.equal('accountId', accountId)`。
- 找不到 profile 时返回 `profile_missing` 类错误。
- 所有 action 都只使用解析出的 `profileId/accountId`。

验收：

- 不能通过 payload 伪造 `viewerProfileId`。
- 缺失 profile 时不会创建互动记录。

### 第三步：迁移点赞和取消点赞

依赖：

- 身份解析可用。
- `likes_user_post_unique` 可用。
- `posts.likeCount` 字段可用。

工作：

- Function 实现 `post.like`。
- Function 实现 `post.unlike`。
- 使用 transaction 包住 like row 写入和 `likeCount` 增减。
- 处理 `409`、`404`、重复点击和并发点击。

验收：

- 重复点赞不重复加 count。
- 重复取消不把 count 减成负数。
- transaction 失败时不会留下 row/count 单边状态。

### 第四步：迁移收藏和取消收藏

依赖：

- 点赞链路的通用 engagement helper 已稳定。
- `saves_user_post_unique` 可用。
- `posts.saveCount` 字段可用。

工作：

- 复用 engagement helper 实现 `post.save` 和 `post.unsave`。
- 保留 saved feed 和 saved count 查询现状。

验收：

- 重复收藏不重复加 count。
- 重复取消不把 count 减成负数。
- 个人 saved feed 能正确刷新。

### 第五步：前端切换互动 mutation

依赖：

- Function 中 4 个互动 action 已可用。

工作：

- `post.engagement.api.ts` 中新增 Function action 调用或用新文件替代旧写入 API。
- `post.engagement.service.ts` 中写入方法改为调用 Function。
- `PostStats.tsx` mutation 输入移除 `viewerAccountId`。
- 保留现有乐观更新和失败回滚。

验收：

- UI 行为不变。
- Network 中不再出现浏览器直接 `createRow/deleteRow/incrementRowColumn/decrementRowColumn` 的互动写请求。

### 第六步：实现删除帖子 Function

依赖：

- 身份解析可用。
- Server SDK 能读写 posts、likes、saves，能删除 Storage file。

工作：

- 实现作者校验。
- 清理当前 post 的 likes/saves row。
- 删除 post row。
- 删除单图 `imageId` 文件。
- `404` 删除视为幂等成功。
- Storage 失败做有限重试并返回明确结果。

验收：

- 非作者删除返回 403。
- 作者删除后详情、列表、个人页不再显示该帖子。
- 当前单图 Storage file 被删除或返回明确 cleanup warning。

### 第七步：前端切换删除 mutation

依赖：

- `post.delete` action 已可用。

工作：

- `deletePostById()` 改为 Function action。
- `postDetails.tsx` 保留现有 toast，但根据 Function 返回的 `imageCleanupFailed` 显示 warning。
- 补齐 profile posts/count、liked/saved feeds 的缓存失效。

验收：

- 页面行为与现有删除行为一致。
- 删除失败能展示明确错误。

### 第八步：权限收紧和历史数据回填

依赖：

- 前端已切换到 Function。
- Function 线上可用。

工作：

- `createPostRow()` 改成 owner-only post row permissions。
- `buildTransitionalPostPermissions()` 停止用于新帖子；可以删除或仅保留迁移兼容注释。
- `appwrite.config.json` 移除 likes/saves table 的 `create("users")`。
- 修改 `backfill-resource-permissions.mjs`，将 posts row 回填目标改为 owner-only update/delete，将 likes/saves row 回填目标改为 owner read-only。
- 对远端数据先 dry-run，再 run，再 verify。

验收：

- 新帖子不再带 `update("users")`。
- 历史帖子不再带 `update("users")`。
- 新旧 likes/saves row 不再带客户端 delete 权限。
- 浏览器端普通登录用户不能直接更新他人帖子 row。
- 浏览器端普通登录用户不能直接创建或删除 likes/saves row。
- 点赞、收藏、删除仍正常。

### 第九步：回归验证

依赖：

- 权限已收紧。

工作：

- 跑 `npm run typecheck`。
- 手工验证：
  - 登录用户点赞、取消点赞。
  - 快速重复点击点赞。
  - 收藏、取消收藏。
  - 删除自己的帖子。
  - 尝试删除他人的帖子。
  - 删除后首页、详情页、个人页刷新。
  - Appwrite Console 检查 posts row permissions。

验收：

- 阶段一路线图验收项全部满足。

## 关键风险及应对策略

### 风险一：Function 无法可靠识别当前用户

风险：

- 如果 Function execution 允许 guest，或代码错误地信任 payload 中的 user id，会重新引入伪造身份问题。

应对：

- Function 层强制要求当前 account id。
- 所有 action 都忽略 payload 中除 `postId/action` 之外的身份字段。
- Function 权限只允许 authenticated users 执行。
- 缺少 account id 时返回 401。

### 风险二：互动计数仍出现重复累加或漏减

风险：

- 用户快速点击、网络重试、Function 重试可能导致重复 create/delete。

应对：

- 保留 `likes_user_post_unique` 和 `saves_user_post_unique`。
- 创建 row 与 increment 放进同一个 transaction。
- 删除 row 与 decrement 放进同一个 transaction。
- `409` conflict 只返回已有记录，不再 increment。
- 找不到待删除记录时返回幂等成功，不再 decrement。
- decrement 使用 `min: 0`。

### 风险三：Storage 删除无法和 DB 删除事务化

风险：

- post row 已删除，但 Storage file 删除失败，会留下孤儿文件。

应对：

- Storage 删除在 Function 内做有限重试。
- `404` 视为成功。
- 返回 `imageCleanupFailed`，前端保留 warning。
- Function 日志记录 file id，便于人工或脚本清理。
- 不在本阶段新增清理任务表，避免超出阶段范围。

### 风险四：权限回填误配导致作者无法编辑帖子

风险：

- 历史 post row 的 creator profile 无法映射到 account id。
- 回填脚本错误地移除了作者 update 权限。

应对：

- 修改回填脚本后必须先 `--dry-run`。
- 对 `missingOwnerAccountId`、`conflictingImageOwners` 等统计为 0 后再 `--run`。
- `--run` 后执行 `--verify`。
- 抽样检查作者能编辑自己的历史帖子。

### 风险五：先收权限再切前端会造成线上互动失败

风险：

- 如果先移除 `update(Role.users())` 或 likes/saves `create("users")`，旧前端还在直连写入，互动会失败。

应对：

- 顺序必须是：
  1. 部署 Function。
  2. 前端切换到 Function。
  3. 验证线上互动。
  4. 收紧权限。
  5. 回填历史权限。

### 风险六：删除帖子和互动并发

风险：

- 用户 A 删除帖子时，用户 B 同时点赞或收藏，可能出现短暂竞态。

应对：

- Function 中所有互动 action 必须先确认 post 存在。
- 删除 action 做作者校验后尽快清理关联 row 并删除 post。
- 对当前作品规模，接受短窗口竞态；评论和多图阶段如果需要更强一致性，再引入 `status = deleting` 或删除任务模型。

### 风险七：Function 冷启动和免费额度

风险：

- 多个 Function 会放大冷启动、日志和调用管理成本。

应对：

- 只建一个聚合式 `content-actions` Function。
- 不在 Function 中处理图片上传和压缩。
- action 内只做必要 DB/Storage 操作。

## 阶段完成后的预期状态

- 浏览器端不再直接写 `likes/saves` row。
- 浏览器端不再直接更新 `posts.likeCount/saveCount`。
- 浏览器端不再直接执行帖子删除的多步清理。
- 帖子 row 不再需要 `update(Role.users())`。
- 点赞、收藏计数由服务端事务维护。
- 删除帖子由服务端校验作者并清理当前单图资源。
- 创建和编辑帖子仍保持客户端直连，为阶段二多图模型重构保留空间。
