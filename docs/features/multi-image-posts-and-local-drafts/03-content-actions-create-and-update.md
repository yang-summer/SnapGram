# 多图帖子与本地草稿箱步骤三：扩展 `content-actions` 的创建、编辑 action，并升级 `post.delete`

## 目的

本步骤用于把阶段二的最终写入与清理边界补齐到 `content-actions` Function 中。

前两步已经完成的前置准备分别是：

- 步骤一：定义了 `postMedia`、`posts.mediaCount` 和新的环境变量契约
- 步骤二：定义了前端多图编辑器、压缩结果和媒体项状态模型

但当前真正的创建/编辑写入路径仍然是单图浏览器直写：

- `post.service.ts` 仍然直接：
  - 上传一张图到 Storage
  - 调 `createPostRow()` / `updatePostRow()`
- `content-actions` 目前只覆盖：
  - `post.like`
  - `post.unlike`
  - `post.save`
  - `post.unsave`
  - `post.delete`
- 现有 `post.delete` 虽然已经服务端化，但仍只按 `posts.imageId` 清理单张图片。

本步骤的目标有七个：

- 将创建帖子和编辑帖子纳入 `content-actions` 的受信任服务端边界。
- 定义稳定的 `post.create` 和 `post.update` 请求/响应契约。
- 同步升级现有 `post.delete`，使其以 `postMedia` 为主数据源清理多图帖子。
- 让 `posts` 封面投影字段、`mediaCount` 和 `postMedia` rows 在同一个数据库事务中更新。
- 让浏览器上传的私有中间态文件只在 Function 最终成功后公开。
- 让更新帖子时的“保留旧图 / 删除旧图 / 插入新图 / 调整顺序”由服务端统一做 diff。
- 让删帖、编辑清图和创建发布共享同一套媒体 helper、重试与 warning 语义。

本步骤不包含：

- 不切换 create/update 在 `post.service.ts` 和 `post.mutation.ts` 中的正式调用路径
- 不切换详情页和编辑页为 `postMedia` 读路径
- 不实现草稿箱
- 不实现前端多图提交流程的最终接线
- 不重做删帖交互，只在现有删除入口上升级返回语义与提示文案

## 验收标准

本步骤完成后，应满足以下验收标准：

- `content-actions` 已新增：
  - `post.create`
  - `post.update`
- 现有 `content-actions.post.delete` 已升级为多图清理版本。
- Function 请求体可以完整表达：
  - 文本字段
  - 最终媒体顺序
  - 新上传图片
  - 已存在图片引用
- Function 会从执行上下文解析当前用户身份，不信任客户端传入的 `accountId` 或 `profileId`。
- `post.create` 会在数据库事务中同时：
  - 创建 `posts` row
  - 创建全部 `postMedia` rows
  - 回写封面投影字段
  - 回写 `mediaCount`
- `post.update` 会在数据库事务中同时：
  - 更新 `posts` row
  - 更新保留媒体的排序
  - 创建新增媒体 row
  - 删除被移除的媒体 row
  - 回写封面投影字段
  - 回写 `mediaCount`
- Function 会校验媒体数量始终在 `1-6` 之间。
- Function 会校验 `sortOrder` 连续且唯一。
- Function 会校验新上传 `fileId` 确实属于当前账户，且仍处于私有暂存状态。
- Function 提交成功后，会把最终保留的新文件权限切换为公开读。
- `post.update` 提交成功后，会清理被移除旧图的 Storage 文件。
- `post.delete` 会在数据库事务中同时：
  - 删除 `likes`
  - 删除 `saves`
  - 删除 `postMedia` rows
  - 删除 `posts` row
- `post.delete` 会在事务提交后清理该帖最终关联的全部 Storage 文件，而不是只删封面图。
- `post.delete` 在迁移窗口内兼容两种数据形状：
  - 优先按 `postMedia.fileId` 清理
  - 若不存在 `postMedia` rows，则回退到 `posts.imageId`
- 当数据库事务成功但事务外文件操作失败时，Function 不会把已提交的帖子误报为整体失败，而是返回明确 warning 标记。
- `post.delete` 的返回结果会升级为多图语义：
  - `postId`
  - `mediaCleanupFailed`
- 新增的客户端 `post.actions.api.ts` 封装可以独立调用 `post.create / post.update`，现有删帖入口则同步消费新的 warning 字段。

## 改了什么，改在哪里

### 一、扩展前后端 `content-actions` 契约，增加 `post.create`、`post.update` 并收紧 `post.delete` 返回语义

改动位置：

- `functions/content-actions/src/action.ts`
- `functions/content-actions/src/main.ts`
- `app/features/post/api/post.actions.api.ts`
- `app/features/post/types/post.type.ts`
- `app/routes/postDetails.tsx`

当前状态：

- `action.ts` 只解析互动和删帖 action
- 前端 `post.actions.api.ts` 也只封装互动和删帖调用
- 现有 `DeletePostResult` 仍然使用单图时代的 `imageCleanupFailed`
- 现有 `PostMutationResult` 仍然是单图行写入时代的返回形状

本步骤建议新增两组请求契约：

- `post.create`
- `post.update`

建议的 `post.create` 请求体：

- `action: 'post.create'`
- `caption`
- `location`
- `tags`
- `media`
  - 每项包含：
    - `fileId`
    - `sortOrder`
    - `width`
    - `height`
    - `aspectRatioBucket`
    - `placeholder`

建议的 `post.update` 请求体：

- `action: 'post.update'`
- `postId`
- `caption`
- `location`
- `tags`
- `media`
  - 使用判别联合表示最终媒体列表
  - 每项要么是：
    - `type: 'existing'`
    - `mediaId`
    - `sortOrder`
  - 要么是：
    - `type: 'new'`
    - `fileId`
    - `sortOrder`
    - `width`
    - `height`
    - `aspectRatioBucket`
    - `placeholder`

这里不建议让 `post.update` 接收“操作日志”，例如：

- `deleteMediaIds[]`
- `reorderOperations[]`
- `newMedia[]`

而是只接收“最终媒体列表”。

原因：

- 前端多图编辑器的唯一真实来源就是最终数组顺序。
- 服务端只要按最终列表做 diff 即可。
- 这样可以避免客户端和服务端各自维护一套操作语义。

建议新增独立的 action 返回类型，不再复用旧的单图 `PostMutationResult`：

- `CreatePostWithContentActionResult`
  - `postId`
  - `mediaCount`
  - `filePublicationFailed`
- `UpdatePostWithContentActionResult`
  - `postId`
  - `mediaCount`
  - `filePublicationFailed`
  - `removedFileCleanupFailed`
- `DeletePostResult`
  - `postId`
  - `mediaCleanupFailed`

这里不建议仍返回：

- `imageId`
- `imageUrl`

因为阶段二以后，这些值只是封面投影字段，不再代表唯一媒体源。

对于 `post.delete`，这里也不建议继续保留 `imageCleanupFailed` 这个命名。

原因：

- 删帖清理对象已经从“单张图片”升级为“整组帖子媒体”
- 当前前端只在 `postDetails.tsx` 消费这个 warning，改名成本很低
- 直接统一成 `mediaCleanupFailed`，可以避免后续多图时代继续传播错误语义

### 二、扩展 Function 配置与入口分发，并把 `postMediaTableId` 暴露到 healthcheck

改动位置：

- `functions/content-actions/src/config.ts`
- `functions/content-actions/src/main.ts`

前提：

- 第一步应已经把 `APPWRITE_POST_MEDIA_TABLE_ID` 纳入配置契约。

本步骤建议改动：

- `AppwriteResourceConfig` 增加：
  - `postMediaTableId`
- `healthcheck` 返回值中增加：
  - `postMediaTableId`
- `main.ts` 新增 switch case：
  - `post.create`
  - `post.update`

原因：

- 这样可以在正式切换前，先通过 healthcheck 确认 Function 线上环境变量已完整。
- 也可以在本地或测试环境隔离验证 action 分发和配置读取，而不必立刻接业务入口。

### 三、抽取共享事务、权限与媒体清理 helper，避免 create/update/delete 各写一套基础设施逻辑

改动位置：

- 新增 `functions/content-actions/src/transactions.ts`
- 新增 `functions/content-actions/src/permissions.ts`
- 如有必要，更新：
  - `functions/content-actions/src/delete-post.ts`
  - `functions/content-actions/src/engagement.ts`

当前状态：

- `engagement.ts` 和 `delete-post.ts` 各自复制了一份 `runTransaction()`
- `delete-post.ts` 还内置了“只删一个 `imageId`”的重试循环
- 文件/row 权限构造逻辑分散，没有统一的“多图发布权限” helper

本步骤建议抽取两个共享 helper：

- `transactions.ts`
  - `runTransaction(tablesDB, run)`
- `permissions.ts`
  - `buildPublishedPostPermissions(accountId)`
    - `read(any)`
    - `update(user(accountId))`
    - `delete(user(accountId))`
  - `buildPublishedPostMediaRowPermissions()`
    - `read(any)`
  - `buildPublishedPostMediaFilePermissions()`
    - `read(any)`
  - `buildStagedPostMediaFilePermissions(accountId)`
    - `read(user(accountId))`
    - `update(user(accountId))`
    - `delete(user(accountId))`

这里有一个关键边界：

- 浏览器上传的文件必须先是“当前用户私有暂存文件”
- Function 成功落库后，再把最终保留的新文件切换成“公开读”

因此权限 helper 必须显式区分：

- staged file permissions
- published file permissions

### 四、新增 `post-media.ts`，集中处理媒体 payload 规范化、校验、diff 与文件操作

改动位置：

- 新增 `functions/content-actions/src/post-media.ts`

建议把所有与帖子媒体相关的通用逻辑收敛到这个 helper 中，而不是分散在 `create-post.ts` 和 `update-post.ts` 里。

建议职责包括：

- 常量定义
  - `POST_MEDIA_MIN_ITEMS = 1`
  - `POST_MEDIA_MAX_ITEMS = 6`
- payload 规范化
  - `normalizeCreateMediaPayload()`
  - `normalizeUpdateMediaPayload()`
- 校验
  - 数量必须在 `1-6`
  - `sortOrder` 必须连续且唯一
  - 不能重复引用同一个 `mediaId`
  - 不能重复引用同一个 `fileId`
- 已有媒体读取
  - `listPostMediaRowsByPostId(postId)`
- staged upload 校验
  - `assertOwnedStagedFiles(storage, fileIds, accountId)`
- 封面投影计算
  - `buildPostCoverProjectionFromMedia(firstMediaItem)`
- update diff
  - `resolvePostMediaDiff(existingRows, finalPayload)`
- delete 文件解析
  - `resolvePostDeleteFileIds(post, mediaRows)`
- 事务外文件操作
  - `publishNewMediaFiles(storage, fileIds)`
  - `cleanupRemovedMediaFiles(storage, fileIds)`
  - `cleanupMediaFiles(storage, fileIds, log, error, context)`

这里建议把 update diff 设计成“保留已有 media row ID”的策略：

- 保留的旧图：
  - 只更新其 `sortOrder`
- 新增的新图：
  - 新建 `postMedia` row
- 被移除的旧图：
  - 删除其 `postMedia` row
  - 在事务提交后删除其 Storage 文件

不建议在 update 时“全部删掉再重建所有 `postMedia` row`”。

原因：

- 当前 payload 已经区分了 `existing mediaId` 与 `new fileId`
- 保留已有 row ID 更符合“服务端做 diff”的语义
- 可以避免无意义的 row churn
- 也更利于后续调试和数据排查

对 delete 来说，同一个 helper 还应承担两个职责：

- 在迁移窗口内把 `postMedia.fileId[]` 和 legacy `posts.imageId` 统一抽象成“待清理 fileIds”
- 对 fileId 去重，避免同一张封面图既在 `posts.imageId` 又在 `postMedia.fileId` 时重复删除

### 五、新增 `create-post.ts`，实现 `post.create`

改动位置：

- 新增 `functions/content-actions/src/create-post.ts`

建议流程：

1. 解析并规范化 create payload
2. 校验媒体数量、顺序和字段完整性
3. 校验所有 `fileId` 都属于当前账户的 staged private upload
4. 根据排序后的第一张图计算：
   - `imageId`
   - `imageUrl`
   - `aspectRatioBucket`
   - `imagePlaceholder`
   - `imageWidth`
   - `imageHeight`
   - `mediaCount`
5. 在 `runTransaction()` 中：
   - 创建 `posts` row
   - 创建全部 `postMedia` rows
6. 事务成功后：
   - 将新文件权限切换为 `read(any)`
7. 返回：
   - `postId`
   - `mediaCount`
   - `filePublicationFailed`

建议的事务内写入顺序：

- 先创建 `posts` row
- 再创建 `postMedia` rows

原因：

- `postMedia.postId` 需要引用新帖子 ID
- `postMedia` rows 需要依赖新帖子 ID

注意：

- 数据库事务失败时，Function 不主动清理客户端本次上传的新文件
- 这些 staged files 仍然是当前用户私有文件
- 下一步前端切换写入链路时，由客户端在 action 失败后负责 best-effort 删除

这样可以避免服务端在“用户还可能马上重试”的场景下过早删除暂存文件。

### 六、新增 `update-post.ts`，实现 `post.update`

改动位置：

- 新增 `functions/content-actions/src/update-post.ts`

建议流程：

1. 读取目标 post 的最小快照
   - `$id`
   - `creator.$id`
2. 校验当前用户必须是作者
3. 读取当前该帖子的全部 `postMedia` rows
4. 规范化 update payload
5. 校验：
   - 数量 `1-6`
   - `sortOrder` 连续且唯一
   - `existing mediaId` 必须都属于当前帖子
   - `new fileId` 必须是当前账户的 staged private upload
6. 执行 diff，得到：
   - `retainedExistingRows`
   - `newMediaInputs`
   - `removedRows`
7. 根据最终第一张图重新计算封面投影字段和 `mediaCount`
8. 在 `runTransaction()` 中：
   - 更新 `posts` row
   - 更新保留媒体的 `sortOrder`
   - 创建新增 `postMedia` rows
   - 删除被移除的 `postMedia` rows
9. 事务成功后：
   - 将新增文件权限切为公开读
   - 删除被移除旧图的 Storage 文件
10. 返回：
   - `postId`
   - `mediaCount`
   - `filePublicationFailed`
   - `removedFileCleanupFailed`

这里建议：

- `existing` 项只传 `mediaId`，不再重复传 `fileId`
- `new` 项必须传 `fileId + metadata`

原因：

- 旧图真实 fileId 已经在 `postMedia` row 中
- 新图才需要服务端接管 staged upload
- 这能在 payload 层就把“旧图引用”和“新图接管”分开

### 七、升级 `delete-post.ts`，让删帖链路与多图写入链路对齐

改动位置：

- `functions/content-actions/src/delete-post.ts`
- `functions/content-actions/src/post-media.ts`
- `functions/content-actions/src/transactions.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/api/post.actions.api.ts`
- `app/routes/postDetails.tsx`

当前状态：

- `delete-post.ts` 只读取：
  - `posts.imageId`
  - `creator.$id`
- 数据删除事务里只删除：
  - `likes`
  - `saves`
  - `posts`
- 事务提交后也只尝试删除一张 Storage 文件

建议流程：

1. 读取目标 post 的最小快照
   - `$id`
   - `imageId`
   - `creator.$id`
2. 校验当前用户必须是作者
3. 读取当前帖子的全部 `postMedia` rows
4. 解析最终要清理的 `fileIds`
   - 若 `postMedia` rows 存在：
     - 以这些 rows 的 `fileId` 为主
   - 若 `postMedia` rows 为空：
     - 回退到 `posts.imageId`
   - 对结果去重
5. 在 `runTransaction()` 中：
   - 删除 `likes`
   - 删除 `saves`
   - 删除 `postMedia` rows
   - 删除 `posts` row
6. 事务成功后：
   - 对全部 `fileIds` 做有限重试删除
7. 返回：
   - `postId`
   - `mediaCleanupFailed`

这里建议显式删除 `postMedia` rows，而不是把行为寄托给 relationship cascade。

原因：

- 当前项目正处在单图到多图的迁移阶段，关系删除策略不应成为隐藏前提
- 显式删 `postMedia` 更容易审计事务操作数和失败点
- `delete-post.ts` 与 `update-post.ts` 共享媒体 helper 后，行为会更透明

### 八、把事务内数据库一致性和事务外文件补偿策略显式拆开

改动位置：

- `functions/content-actions/src/create-post.ts`
- `functions/content-actions/src/update-post.ts`
- `functions/content-actions/src/delete-post.ts`
- `functions/content-actions/src/post-media.ts`

根据 Appwrite 官方文档，事务只覆盖数据库操作，不覆盖 Storage 文件操作。

因此本步骤必须明确两段式策略：

- 事务内：
  - `posts`
  - `postMedia`
  - `likes`
  - `saves`
- 事务外：
  - 文件权限公开
  - 被移除旧文件删除
  - 删帖时全部媒体文件删除

推荐的补偿语义：

- 若数据库事务失败：
  - 返回 action error
  - 不误报成功
  - 不在 Function 侧删除本次 staged upload
- 若数据库事务成功，但新文件公开失败：
  - 返回 success
  - `filePublicationFailed = true`
  - 记录日志，避免客户端误重试 create/update
- 若数据库事务成功，但旧文件删除失败：
  - 返回 success
  - `removedFileCleanupFailed = true`
  - 记录日志
- 若删帖事务成功，但部分媒体文件删除失败：
  - 返回 success
  - `mediaCleanupFailed = true`
  - 记录日志

这里不建议在“事务外文件操作失败”时直接抛整体错误。

原因：

- 帖子内容已经落库成功
- 如果返回整体失败，客户端很可能重试 create/update
- create 重试会有重复发帖风险
- update 重试会引发更复杂的 staged file 漂移
- delete 在 row 已经删除后重试，也无法恢复事务内状态

因此这类场景应使用“成功 + warning flag”的语义，而不是“失败 + 鼓励重试”。

### 九、同步为客户端新增 typed wrapper，并更新删帖 warning 消费，但不在本步骤正式切 create/update 业务入口

改动位置：

- `app/features/post/api/post.actions.api.ts`
- `app/features/post/types/post.type.ts`
- `app/routes/postDetails.tsx`

建议新增：

- `createPostWithContentAction(payload)`
- `updatePostWithContentAction(payload)`

这样下一步切换写入链路时，`post.service.ts` 只需要：

- 上传私有文件
- 组装 payload
- 调用上述 wrapper

同时应同步更新现有删帖消费端：

- `DeletePostResult.imageCleanupFailed`
  -> `DeletePostResult.mediaCleanupFailed`
- `postDetails.tsx` 的 warning toast 改为“帖子已删除，但部分媒体清理失败”

本步骤中，原则上不要求立即改：

- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.mutation.ts`

因为正式业务切换属于下一步。

如果需要做 isolated verification，可在本步骤内：

- 新增 wrapper
- 用独立测试入口或临时脚本调用

但不要让 `PostForm` 直接开始依赖这些新 wrapper。

## 为什么选择这个方案

### 为什么 `post.delete` 必须并入第三步

原因：

- 一旦 `post.create / post.update` 开始写入 `postMedia`，删帖就不能再停留在单图模型
- 否则系统会在第一批多图帖子产生后立刻出现：
  - `postMedia` 脏 row
  - 多个孤儿文件
- 当前删帖已经走 `content-actions`，改造范围主要集中在 Function 和一个前端 warning 消费点，额外成本可控

因此更稳妥的边界不是“先放 gate，后补实现”，而是把 delete 直接纳入同一步交付。

### 为什么继续使用同一个聚合式 `content-actions` Function

原因：

- 阶段一已经在这个 Function 里建立了：
  - 身份解析
  - 统一错误响应
  - 日志模式
  - 动态 API key 使用方式
- 当前项目运行在 Appwrite Free 限制下，继续扩展一个聚合式 Function 比拆多个 Function 更经济。

这样可以保持：

- 一个 Function 负责所有高风险帖子写操作
- 一个入口维持统一错误 envelope
- 一个部署单元维护环境变量和 scopes

### 为什么 `post.update` 要接收“最终媒体列表”，而不是操作日志

原因：

- 前端多图编辑器的真实状态就是最终数组。
- `sortOrder` 本来就由最终顺序生成。
- 如果前端传操作日志，服务端还要再把操作日志重放成最终状态。

直接传最终列表的好处：

- 客户端简单
- 服务端权威
- diff 算法单一
- 调试时容易对照

### 为什么要把新文件接管校验放在服务端

原因：

- 浏览器端上传完成后，用户完全可以伪造 `fileId`
- 如果 Function 不校验 staged upload ownership，就会允许：
  - 把别人的私有上传文件挂到自己帖子上
  - 把已经公开的旧文件重复注入到新帖子里

因此服务端必须验证：

- 文件存在
- 文件仍处于 staged private 状态
- staged 权限对应的 owner 就是当前账号

### 为什么 `postMedia` row 权限建议只有公开读

原因：

- `postMedia` rows 只在 publish 成功后才创建
- 中间态文件不会先写 `postMedia` row
- 浏览器端不应该拥有编辑 `postMedia` rows 的能力

因此对已发布媒体 row，最小权限集合就是：

- `read(any)`

删除和修改都交给 Server SDK 完成，不依赖 row-level update/delete 权限。

### 为什么事务外文件失败要用 warning flag，而不是整体报错

原因：

- 数据库事务一旦提交，帖子已经真实存在
- 这时如果把文件权限公开失败伪装成整体失败，客户端会倾向重试
- create 重试天然不是幂等的，存在重复发帖风险

因此更安全的反馈模式是：

- success
- 带 warning flag
- 前端提示“帖子已发布，但媒体处理未完全完成”

这也与升级后的 `post.delete.mediaCleanupFailed` 语义保持一致。

### 为什么当前规模下不需要 `createOperations`

原因：

- Appwrite Free 计划每个事务最多 100 个操作
- 本项目最多 6 张图
- 即使是 update 最坏场景：
  - 1 次 post update
  - 6 次 old media delete
  - 6 次 new media create
  - 6 次 retained media sort update
  也远小于上限

因此使用逐条 `transactionId` 的 staged operations：

- 更直观
- 日志更清楚
- 出错时更容易定位

没有必要为了当前规模提前引入更抽象的 `createOperations` 编排。

### 为什么不在 Function 里主动清理所有 action 失败时的 staged upload

原因：

- 这些 staged files 仍然归当前用户所有
- action 失败后，用户可能只需要修正文案或顺序就重试
- 如果 Function 过早删除 staged upload，会增加重试成本和失败面

因此这里的责任边界是：

- Function 负责验证和最终接管
- 客户端在下一步切换写入链路后，负责在 action 明确失败时对“本次新上传文件”做 best-effort cleanup

## 实现顺序与依赖关系

### 第一步：冻结 action request/response 契约

工作：

- 在 `app/features/post/types/post.type.ts` 中定义：
  - create/update 请求体
  - create/update 返回体
- 收紧删帖返回体：
  - `DeletePostResult.mediaCleanupFailed`
- 在 `functions/content-actions/src/action.ts` 中扩展 discriminated union 与 payload parser
- 如有必要，只在 `post.actions.api.ts` 先补共享 type import，不提前新增真正的 create/update wrapper

依赖：

- 依赖步骤一已经定义 `postMedia` 契约
- 依赖步骤二已经定义前端媒体编辑器状态模型

说明：

- 这一阶段先冻结 payload 和 delete warning 语义，不先写具体业务逻辑。

### 第二步：补齐 Function 配置与共享 helper

工作：

- `config.ts` 读取 `postMediaTableId`
- 抽取 `transactions.ts`
- 抽取 `permissions.ts`
- 新增 `post-media.ts`
- 补齐：
  - `resolvePostDeleteFileIds()`
  - `cleanupMediaFiles()`

依赖：

- 依赖步骤一的环境变量已经就绪

说明：

- 先把基础设施层补齐，再写 create/update/delete，避免三个 action 各写一套事务和权限逻辑。

### 第三步：先升级 `post.delete`

工作：

- 更新 `delete-post.ts`
- 完成：
  - 读取 `postMedia`
  - 解析最终 `fileIds`
  - 事务删除 `likes / saves / postMedia / posts`
  - 全量媒体文件清理
  - legacy `posts.imageId` fallback

依赖：

- 依赖第二步 helper 已稳定

说明：

- 删帖是当前已经上线的真实入口，先把它升级到多图兼容状态，可以提前消除最危险的资源残留风险。

### 第四步：实现 `post.create`

工作：

- 新增 `create-post.ts`
- 完成：
  - payload 校验
  - staged file ownership 校验
  - post row create
  - postMedia rows create
  - 文件权限公开

依赖：

- 依赖第二步 helper 已稳定
- 依赖第三步删帖链路已具备多图清理能力

说明：

- create 逻辑比 update 简单，先落 create 更容易验证整条“私有上传 -> 最终发布”链路。

### 第五步：实现 `post.update`

工作：

- 新增 `update-post.ts`
- 完成：
  - 作者校验
  - 读取 existing postMedia
  - diff
  - 事务更新
  - 新文件公开
  - 旧文件清理

依赖：

- 依赖第四步 create 链路已经跑通

说明：

- update 复用 create 已验证过的 staged file 校验与 projection 计算能力。

### 第六步：接入 `main.ts` 分发与 healthcheck

工作：

- `main.ts` 增加 `post.create / post.update` case
- healthcheck 输出补齐 `postMediaTableId`

依赖：

- 依赖第四步和第五步业务 helper 已完成

说明：

- 到这一步，Function 才真正对外完整暴露 create/update 能力。

### 第七步：补齐前端 typed wrapper，并更新删帖消费，但不正式切写入链路

工作：

- `post.actions.api.ts` 新增真正调用 Function 的 create/update wrapper
- 更新：
  - `DeletePostResult` 类型
  - `postDetails.tsx` 的 warning 判断与 toast 文案
- isolated 调用验证：
  - 成功
  - 非作者更新
  - staged file 权限不合法
  - 文件权限公开失败 warning
  - 删除旧文件失败 warning
  - 删帖部分媒体删除失败 warning

依赖：

- 依赖第六步已可执行 create/update

说明：

- 这一步只建立 create/update 调用能力，并收口删帖 warning 语义，不改变 create/update 正式业务入口。

## 关键风险及应对策略

### 风险一：步骤二的前端媒体模型和步骤三的 action payload 漂移

问题：

- 如果前端媒体项类型和 Function payload 各自演化，下一步切写入链路时会出现重复映射或字段不一致。

应对：

- 本步骤开始前先冻结 create/update request types
- 步骤四再由前端 adapter 从 `PostMediaEditorItem[]` 映射到 action payload
- 不允许 `PostForm` 直接手写裸 JSON

### 风险二：新上传 `fileId` 被伪造或重复利用

问题：

- 客户端可以手动构造任意 `fileId`
- 如果 Function 不校验 staged ownership，就会把安全边界重新打开

应对：

- 对所有 `type: 'new'` 项，Function 必须读取文件元数据并校验 staged private permissions
- 已公开文件不能作为 staged new file 再次接入
- 非当前账户拥有的 staged file 直接拒绝

### 风险三：数据库事务提交成功，但文件公开失败

问题：

- 帖子已经落库成功，但新图片仍是私有

应对：

- 重试文件权限切换
- 超过重试次数后：
  - 记录 execution error
  - 返回 `filePublicationFailed = true`
- 不返回整体失败，避免客户端重试 create/update

### 风险四：数据库事务提交成功，但被移除旧图文件删除失败

问题：

- 帖子最终状态正确，但 Storage 留下孤儿文件

应对：

- 复用现有删帖链路中的有限重试模式
- 超过重试后：
  - 返回 `removedFileCleanupFailed = true`
  - 记录 fileId 便于后续清理

### 风险五：`post.update` 的 `existing mediaId` 不属于当前帖子

问题：

- 客户端如果能把其他帖子的 mediaId 混入 payload，就会破坏数据边界

应对：

- update 前先加载当前帖子的全部 existing media rows
- 所有 `existing mediaId` 必须在这个集合内
- 否则直接返回 400/403 类业务错误

### 风险六：迁移窗口内 `post.delete` 同时面对 legacy 单图数据和新多图数据

问题：

- rollout 过程中会同时存在：
  - 只有 `posts.imageId` 的旧帖子
  - 已迁移出 `postMedia` 的帖子
  - `posts.imageId` 与 `postMedia.fileId` 同时存在的过渡态帖子

应对：

- delete 先读取 `postMedia` rows，再决定清理集合
- 若存在 `postMedia` rows，以其 `fileId` 为主
- 若不存在 `postMedia` rows，则回退到 `posts.imageId`
- 最终 cleanup 前先对 `fileIds` 去重

### 风险七：create action 被自动重试，导致重复发帖

问题：

- create 天然不是幂等操作
- 一旦事务已提交但客户端误以为失败，再重试就会生成重复帖子

应对：

- 本步骤的 Function 设计对“事务外文件失败”返回 success + warning
- 下一步正式接入时，客户端 mutation 必须保持 `retry: false`
- 当前阶段不额外引入 idempotency key，先保持范围可控

### 风险八：update diff 逻辑写得过重，反而增加出错面

问题：

- 虽然媒体上限只有 6 张，但如果把 diff 拆成过多抽象层，会降低可维护性

应对：

- 保持 diff helper 聚焦三类结果：
  - retained
  - new
  - removed
- 不为当前规模引入复杂 patch DSL 或多阶段 reconciliation engine

### 风险九：事务操作数或权限模型被误判

问题：

- 如果对 Free 计划事务上限或权限范围理解不清，容易过度设计或上线后报错

应对：

- 本步骤明确：
  - 事务操作数远低于 Free 计划上限
  - rows/files 没有 `create` 型资源权限
  - bucket/file、table/row 权限语义要分开对待
- 先用 isolated wrapper 做最小成功/失败路径验证，再接业务入口

## 预期结果

本步骤完成后，项目会获得一个稳定的“多图最终发布服务端边界”：

- `content-actions` 可以原子化处理：
  - 创建多图帖子
  - 编辑多图帖子
  - 删除多图帖子
- `posts` 封面投影字段和 `postMedia` 真正建立起一致性写入关系
- staged private upload 只有在发布成功后才会公开
- 更新帖子时的媒体 diff 和旧文件清理都由服务端统一掌控
- 删帖会优先按 `postMedia` 清理整组媒体，并在迁移窗口兼容 legacy `posts.imageId`
- 下一步前端只需要切换：
  - 上传私有文件
  - 组装 payload
  - 调 Function

而不必再自己承担多步写入一致性。
