# 用户资料功能设计方案

## 范围

本文档定义 Snapgram 用户资料功能的第一版实现方案。

本期目标：

- 实现可访问的用户资料页，包含资料头、tab 栏和对应内容区。
- 资料页主路由继续使用 `profileId`，并使用子路由承载 `posts / saved / liked` 三个 tab。
- 资料页内容区统一使用瀑布流容器，支持分页、空态、错误态和结束态。
- 实现独立编辑资料页，支持编辑：
  - `avatar`
  - `name`
  - `bio`
- 编辑页展示只读 `email`，但本期不支持编辑：
  - `email`
  - `username`
- 头像支持上传与替换，并在替换成功后删除旧头像文件。
- 方案需要适配 Appwrite Cloud 免费版约束，避免不必要的请求、存储浪费和额外基础设施。

本期不包含：

- 头像裁剪
- 用户名占用提示
- 资料页 URL 切换到 `username`
- 资料统计扩展为关注数、粉丝数、获赞总数等更复杂指标
- 通过 Appwrite Functions 或服务端 API 重构当前前端直连架构

## 当前现状

当前相关文件：

- `app/routes.ts`
- `app/routes/profile.tsx`
- `app/routes/updateProfile.tsx`
- `app/features/user/api/user.api.ts`
- `app/features/user/types/user.type.ts`
- `app/features/auth/services/auth.service.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/api/post.engagement.api.ts`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/queries/post.engagement.queries.ts`
- `app/features/post/components/MasonryFeed.tsx`
- `app/features/post/components/MasonryPostCard.tsx`
- `appwrite.config.json`

当前行为：

- 路由中已经预留了 `profile/:id/*` 和 `update-profile/:id`，但两个页面仍是占位实现。
- 用户资料表 `users` 已包含：
  - `name`
  - `username`
  - `email`
  - `bio`
  - `imageId`
  - `imageUrl`
- 帖子表 `posts`、互动表 `saves`、`likes` 已存在，并已具备首页和探索页所需的基础分页与瀑布流能力。
- 当前只有帖子图片上传链路，没有用户头像上传链路。
- `saved` 和 `liked` 当前采用 owner-private 权限，天然适合“仅本人可见”。

当前 Appwrite 约束：

- 前端通过浏览器端 SDK 直连 `TablesDB` 和 `Storage`。
- 项目运行在 Appwrite Cloud 免费版约束下，因此本期应：
  - 尽量只请求当前 tab 所需数据
  - 避免引入必须依赖 Functions 的新方案
  - 控制头像替换时的冗余文件残留
  - 避免把列表和计数设计成高频、全量扫描式实现

## 已确认需求

已确认需求：

- 资料页公开 URL 继续使用 `profileId`。
- 资料页主路径使用子路由 tabs：
  - `/profile/:id/posts`
  - `/profile/:id/saved`
  - `/profile/:id/liked`
- `/profile/:id` 应重定向到 `/profile/:id/posts`。
- 他人主页只显示 `posts`。
- 非本人直访他人的：
  - `saved`
  - `liked`
  - `update-profile`
  应直接重定向，而不是展示无权限页。
- `posts` 只展示已发布内容。
- `saved` 和 `liked` 使用瀑布流，并按互动时间倒序展示。
- tab 上需要显示数量。
- 已删除帖子在 `saved` 和 `liked` 的列表中应直接忽略。
- `saved` 和 `liked` 当前不做基于有效帖子的精确计数。
- `saved` 和 `liked` 的 tab 数量暂使用互动记录原始数量，后续通过服务端级联清理逐步消除数量偏差。
- 编辑资料采用独立编辑页，不使用模态框。
- 编辑页采用单页表单，一次保存。
- 编辑字段仅包含：
  - `avatar`
  - `name`
  - `bio`
- `email` 只读展示。
- `username` 本期不进入编辑流。
- 头像本期支持：
  - 上传
  - 替换
- 头像本期不支持：
  - 裁剪
  - 移除恢复默认头像

## 改动内容

### 1. 重构资料页路由结构

更新：

- `app/routes.ts`
- `app/routes/profile.tsx`

新增或补齐：

- `profile` 资料页壳路由
- `posts` 子路由
- `saved` 子路由
- `liked` 子路由

职责：

- `profile` 壳路由负责：
  - 加载资料头
  - 渲染 tab 栏
  - 渲染 tab 数量
  - 判断是否本人主页
  - 处理 index redirect
  - 承载 `Outlet`
- 子路由负责：
  - 拉取对应 tab 的分页数据
  - 渲染瀑布流
  - 处理空态、错误态和结束态

### 2. 新增资料页专用页面层

新增一个页面级 feature，例如：

- `app/features/profile`

建议职责：

- `ProfileHeader`
- `ProfileTabs`
- `ProfileTabCount`
- `ProfileEmptyState`
- `ProfileRouteGuard`

原因：

- 资料页同时依赖 `user` 和 `post` 两个领域。
- 这类页面编排逻辑不适合塞回 `user` API 层或 `post` API 层。
- 独立 `profile` feature 更适合承接路由壳、tab 编排和越权跳转逻辑。

### 3. 扩展用户资料数据契约

更新：

- `app/features/user/types/user.type.ts`
- `app/features/user/api/user.api.ts`

改动：

- 正式将 `imageId` 纳入用户资料读写链路，不再只依赖 `imageUrl`。
- 新增按 `profileId` 获取用户资料的查询方法，而不仅是按 `accountId`。
- 新增编辑资料专用输入类型，避免继续复用当前包含 `email / username` 的宽接口。
- 新增头像上传、头像删除和资料更新 helper。

本期用户资料读写字段：

- `name`
- `bio`
- `imageId`
- `imageUrl`

只读字段：

- `email`
- `username`

### 4. 新增头像上传与替换链路

更新：

- `app/features/user/api/user.api.ts`
- 如有必要，新增 `app/features/user/services/user.service.ts`

新增：

- 用户头像上传方法
- 用户头像替换流程
- 旧头像清理逻辑

建议流程：

1. 选择新头像文件
2. 上传到现有 `media` bucket
3. 拿到新的 `imageId / imageUrl`
4. 更新用户 row
5. 更新成功后删除旧头像文件

失败处理要求：

- 如果新头像上传成功但用户 row 更新失败，应删除刚上传的新文件，避免残留脏文件。
- 只有旧头像存在 `imageId` 时才执行旧文件清理。

### 5. 新增资料页帖子与互动分页能力

更新：

- `app/features/post/types/post.type.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/api/post.engagement.api.ts`
- `app/features/post/queries/post.engagement.queries.ts`

新增能力：

- 按 `creator = profileId` 分页查询用户公开帖子。
- 按 `saves` 互动记录时间倒序分页，映射为资料页 `saved` feed。
- 按 `likes` 互动记录时间倒序分页，映射为资料页 `liked` feed。
- 统计：
  - `posts` 使用公开帖子原始数量
  - `saved` 使用 `saves` 互动记录原始数量
  - `liked` 使用 `likes` 互动记录原始数量

实现要求：

- `posts` 只查询 `published`。
- `saved / liked` 先按互动记录分页，再批量回查帖子。
- 已删除或不可读帖子在结果组装时直接过滤。
- `saved / liked` 的最终顺序以互动记录时间倒序为准，而不是帖子发布时间。
- `saved / liked` 为了渲染当前页瀑布流，仍需回查当前页帖子。
- `saved / liked` 当前不为计数额外做全量有效性校正。

### 6. 复用现有瀑布流组件承载资料页内容区

复用：

- `app/features/post/components/MasonryFeed.tsx`
- `app/features/post/components/MasonryPostCard.tsx`

原因：

- 资料页 tab 内容本质仍然是帖子瀑布流。
- 现有首页瀑布流已经具备分页追加和响应式列数能力。
- 第一版不需要为资料页重造卡片系统，只需为 profile feed 补齐数据查询和页面包装。

必要时可补充：

- 资料页专用 load-more 状态组件
- 资料页 tab 内容包装组件

### 7. 实现独立编辑资料页

更新：

- `app/routes/updateProfile.tsx`
- `app/lib/validation/index.ts`

新增：

- 资料编辑表单组件
- 头像上传组件

页面职责：

- 展示当前头像
- 支持选择并替换新头像
- 编辑 `name`
- 编辑 `bio`
- 只读展示 `email`
- 提供 `Save / Cancel`

交互要求：

- 单页表单，一次保存
- 保存成功后返回资料页
- 成功后需要同步刷新：
  - 当前用户缓存
  - 资料页缓存
  - 帖子相关展示缓存

### 8. 处理缓存一致性

更新：

- `app/features/auth/queries/auth.mutations.ts`
- 以及相关 `post` / `user` query keys 与 mutations

要求：

- 编辑资料成功后，左侧栏、底栏、资料页头部和帖子卡片中的作者信息应尽快刷新。
- 不允许出现资料页已更新，但侧边栏仍显示旧头像或旧名字的明显不一致。

## 为什么选择这个方案

### 为什么资料页主 tab 使用子路由

资料页选择：

- `/profile/:id/posts`
- `/profile/:id/saved`
- `/profile/:id/liked`

而不是统一使用 `?tab=...`

原因：

- 当前只有三类一层主 tab，没有必须使用 query 表达的二级筛选需求。
- `saved / liked` 具有明确的权限差异，用子路由更适合直接做越权重定向。
- 每个 tab 都有独立分页状态和空态，用子路由更容易隔离状态。
- 当前项目已经预留了 `profile/:id/*`，与子路由方案天然一致。

### 为什么资料页公开 URL 继续使用 `profileId`

本期继续使用 `profileId` 而不是 `username`。

原因：

- 当前项目所有用户跳转都已经基于 `profileId`。
- `profileId` 与 Appwrite row 主键直接对应，查询路径最短。
- 如果切换到 `username`，需要同步重做：
  - 路由解析
  - 用户查找
  - 全站链接生成
  - 唯一性依赖

本期目标是先把资料页链路打通，而不是同时重构 URL 策略。

### 为什么编辑资料使用独立页而不是模态框

本期虽然编辑字段不多，但已经包含头像上传，并明确为后续头像裁剪和用户名占用提示留扩展位。

独立页更适合承载：

- 文件选择和预览
- 上传失败恢复
- 移动端键盘和滚动
- 后续头像裁剪
- 后续异步校验

相比之下，模态框更适合轻量文本表单，不适合承载会继续增长的编辑工作流。

### 为什么本期不支持编辑 `email` 和 `username`

原因：

- `email` 不只是 `users` 表字段，还关联真正的 Appwrite 账户登录邮箱。
- 如果只改 profile row 而不改 account，会造成数据源分裂。
- `username` 虽然在表中存在唯一索引，但当前产品未要求本期处理占用校验和全站引用更新。

因此本期将两者排除在编辑流之外，只保留：

- `avatar`
- `name`
- `bio`

### 为什么头像先做上传与替换，不做裁剪

原因：

- 头像上传是本期资料页完整性的必要能力。
- 头像裁剪会显著增加状态和交互复杂度。
- 当前项目没有现成裁剪组件基础。

第一版先打通：

- 选择文件
- 本地预览
- 上传
- 替换
- 旧文件清理

为后续裁剪预留接口和页面空间即可。

### 为什么 `saved / liked` 必须按互动时间倒序

因为用户进入这两个 tab 时，预期看到的是：

- 最近收藏了什么
- 最近点赞了什么

而不是：

- 这些帖子本身何时发布

因此最终排序应以互动记录时间为准，而不是帖子发布时间。

### 为什么已删除帖子只在列表中忽略，而当前不做 `saved / liked` 精确计数

原因：

- 当前项目的 `saved / liked` 表只有互动记录，没有卡片渲染所需的帖子数据。
- 因此资料页要渲染 `saved / liked` 的当前页瀑布流时，无论是否做精确计数，都必须对当前页互动记录对应的帖子做回查。
- 但如果要让 `saved / liked` 的 tab 数量也只统计有效帖子，就需要在当前页渲染之外，为计数额外做更大范围的有效性校正。
- 在当前纯客户端直连 Appwrite 的架构下，这会增加额外请求、缓存复杂度和免费版资源消耗。
- 由于后续已经决定通过服务端级联清理在删帖时同步清理 `likes / saves`，当前阶段没有必要为了过渡状态额外实现精确计数链路。

本期策略：

- 列表只显示当前页回查成功的有效帖子。
- `saved / liked` 数量暂按互动记录原始数量展示。
- 后续通过服务端级联清理逐步消除“数量与可见内容不完全一致”的过渡问题。

## 实现顺序与依赖关系

### 第一步：补齐用户资料契约

任务：

- 扩展用户类型
- 扩展按 `profileId` 查询能力
- 补齐 `imageId` 读写
- 新增编辑资料专用输入类型

依赖：

- 依赖现有 `users` schema 已具备：
  - `imageId`
  - `imageUrl`
  - `bio`

### 第二步：实现头像上传与更新链路

任务：

- 新增头像上传 helper
- 新增头像替换流程
- 加入失败回滚和旧头像清理

依赖：

- 依赖第一步的用户资料更新契约
- 依赖现有 `media` bucket

### 第三步：实现资料页分页与计数数据层

任务：

- 新增 `posts` feed
- 新增 `saved` feed
- 新增 `liked` feed
- 新增 tab 数量查询

依赖：

- 依赖第一步的用户资料查询能力
- 依赖现有 `post` 和 `engagement` 查询基础

### 第四步：重构资料页路由壳

任务：

- 让 `profile.tsx` 成为真正的资料页壳路由
- 接入资料头、tab 栏、数量和 `Outlet`
- 处理 index redirect 和越权重定向

依赖：

- 依赖第三步的数据层已可用

### 第五步：接入三个 tab 内容页

任务：

- `posts`、`saved`、`liked` 分别接入 infinite query
- 统一渲染瀑布流
- 处理空态、错误态、结束态

依赖：

- 依赖第三步的分页服务
- 依赖现有 `MasonryFeed`

### 第六步：实现独立编辑页

任务：

- 新增编辑资料表单
- 新增头像上传组件
- 接入 `name / bio / avatar` 更新
- 展示只读 `email`

依赖：

- 依赖第二步的头像链路
- 依赖第一步的用户更新接口

### 第七步：补齐缓存刷新与回填

任务：

- 编辑成功后同步刷新资料页和全局用户展示缓存

依赖：

- 依赖第四步和第六步已经接通

### 第八步：验证

任务：

- 运行 `npm run typecheck`
- 验证本人主页
- 验证他人主页
- 验证 `saved / liked` 越权跳转
- 验证头像替换与旧文件清理
- 验证已删除帖子过滤逻辑
- 验证 `saved / liked` 数量按互动记录原始口径展示
- 验证 `saved / liked` 列表只显示当前页回查成功的有效帖子

## 关键风险及应对策略

### 风险：`saved / liked` 存在指向已删除帖子的脏记录

问题：

- 互动记录仍存在，但帖子已被删除或不可访问。

应对：

- `saved / liked` 结果始终以“仍然存在且可读的帖子”为准。
- 组装 feed 时直接过滤失效帖子。
- `saved / liked` 数量暂按互动记录原始口径展示。
- 后续通过服务端级联清理在删帖时同步清理互动记录，逐步消除数量偏差。

### 风险：`saved / liked` 数量可能大于当前可见卡片数

问题：

- 在服务端级联清理上线前，删除帖子后残留的互动记录会导致 tab 数量与可见内容不完全一致。

应对：

- 第一版接受该偏差，避免为过渡状态增加精确计数链路复杂度。
- 列表渲染仍以有效帖子为准，优先保证内容可用性和页面稳定性。
- 在后续实现服务端级联清理后，再逐步收敛该问题。

### 风险：纯客户端直连 Appwrite，资料页容易放大读请求和带宽消耗

问题：

- 如果资料页壳一次性拉全部 tab 内容或做大范围全量扫描，会明显增加免费版成本。

应对：

- 只加载当前 tab 内容。
- 计数查询与列表查询分离，避免为资料头阻塞整页。
- 继续使用分页，不做无边界全量读取。
- 复用最小必要字段的 `select` 集合，避免过度取数。

### 风险：头像替换流程产生孤儿文件或坏链接

问题：

- 新头像上传成功后，如果 row 更新失败，可能遗留垃圾文件。
- 如果旧头像删除时机不当，可能导致资料临时指向失效图片。

应对：

- 固定流程为：
  - 上传新头像
  - 更新 row
  - 成功后删除旧头像
- row 更新失败时主动删除新文件回滚。
- 旧头像清理只在存在 `imageId` 时执行。

### 风险：编辑成功后多处用户展示信息不一致

问题：

- 资料页、侧边栏、底栏、帖子卡片中的作者信息可能显示不同版本。

应对：

- 保存成功后统一失效：
  - 当前用户缓存
  - 资料页缓存
  - 帖子相关缓存
- 必要时可直接回写当前用户缓存，减少明显闪烁。

### 风险：非本人直访私有 tab 或编辑页时出现短暂闪烁

问题：

- 页面先渲染，再发现无权限并跳转，体验会显得不稳定。

应对：

- 在路由壳和编辑页入口尽早判断 viewer 与 profile owner 的关系。
- 优先重定向，不先渲染私有内容。

### 风险：未来加入头像裁剪或用户名占用提示时需要大改

问题：

- 如果第一版把编辑逻辑塞进资料页本身，后续扩展会快速失控。

应对：

- 从第一版开始就使用独立编辑页。
- 将头像上传组件、表单组件和资料展示页职责分离。
- 为未来裁剪与异步校验保留页面空间和组件边界。

## 预期结果

实现完成后：

- 用户资料页将成为真正可访问的页面，而不是占位实现。
- 资料页会包含稳定的资料头、tab 栏和瀑布流内容区。
- 本人和访客将看到不同范围的 tab，权限规则清晰。
- `saved / liked` 会以互动时间倒序展示，并在列表中正确忽略已删除帖子。
- `saved / liked` 的 tab 数量第一版暂使用互动记录原始数量，后续通过服务端级联清理逐步消除偏差。
- 编辑资料页可以完成头像替换、名字更新和简介更新。
- 编辑成功后，全局与资料相关的头像和名字展示将尽量保持一致。
- 方案与当前项目架构和 Appwrite 免费版约束保持一致，并为后续头像裁剪和更完整资料能力预留扩展空间。
