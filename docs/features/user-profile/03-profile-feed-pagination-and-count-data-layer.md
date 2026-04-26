# 用户资料功能步骤三：实现资料页分页与计数数据层

## 目的

本步骤用于为用户资料页建立稳定的分页与计数数据层，覆盖以下四类能力：

- `posts` 分页 feed
- `saved` 分页 feed
- `liked` 分页 feed
- tab 数量查询

当前项目已经具备：

- `posts` 表的公开帖子分页基础
- `likes / saves` 表的单条记录查询、按 postIds 批量查询和当前 viewer 互动状态查询
- `MasonryFeed` / `MasonryPostCard` 所需的帖子卡片数据形状
- `React Query + api / service / mapper / queries` 的稳定分层

但资料页当前仍缺少以下关键能力：

- 按 `creator = profileId` 查询某个用户公开帖子的 feed
- 按互动记录顺序查询某个用户的 `saved / liked` feed
- 资料页 tab 数量查询
- 将互动记录分页结果映射为瀑布流帖子卡片的服务层编排
- 将“当前页互动记录对应的帖子回查结果”按互动顺序重新组装

本步骤的目标是：

- 在不改动路由和 UI 的前提下，先把 profile 页未来要用的数据层补齐。
- `posts` 只查询 `published` 且公开可读的帖子。
- `saved / liked` 先按互动记录分页，再批量回查当前页帖子。
- `saved / liked` 的最终排序保持“最近互动优先”，而不是“帖子发布时间优先”。
- `saved / liked` 当前页若存在已删除或不可读帖子，直接在组装结果时过滤。
- tab 数量与 feed 分页解耦，避免为了资料头阻塞整页列表。
- 保持与 Appwrite Cloud 免费版约束一致：
  - 只加载当前 tab 所需数据
  - feed 列表默认 `total: false`
  - 避免复用“最多读 100 条全量互动记录”的旧实现
  - 用最小 `select` 集合控制返回体积

本步骤不负责：

- `profile` 路由壳
- `posts / saved / liked` 子路由页面
- 越权跳转
- tab UI
- 编辑资料页
- 缓存一致性回填

## 验收标准

本步骤完成后，应满足以下验收标准：

- `post` 数据层已新增资料页 `posts` feed 分页能力。
- `post.engagement` 数据层已新增资料页 `saved / liked` feed 分页能力。
- 已新增资料页 tab 数量查询能力：
  - `posts` 数量按公开 `published` 帖子原始数量
  - `saved` 数量按 `saves` 互动记录原始数量
  - `liked` 数量按 `likes` 互动记录原始数量
- `posts` feed 查询满足：
  - 按 `creator = profileId`
  - 按 `status = published`
  - 按创建顺序倒序
  - 使用 `Query.cursorAfter()`
  - 使用 `Query.limit()`
  - 使用 `total: false`
- `saved / liked` feed 查询满足：
  - 先查互动表
  - 再按当前页 `postIds` 批量回查帖子表
  - 互动页与帖子页解耦
  - 最终结果顺序以互动记录顺序为准
- `saved / liked` 的分页游标基于互动记录页，而不是基于回查成功的帖子数。
- 当某一页互动记录中存在失效帖子时：
  - 该帖子不会出现在最终 feed 中
  - 只要互动记录页还有下一页，`nextCursor` 仍然可能非空
- 资料页 feed 返回的数据形状可直接复用现有瀑布流卡片，不要求后续再做重映射。
- 当前 `PostStats` 使用的 viewer 单帖状态查询不被破坏。
- 当前 `getViewerLikedPosts()` / `getViewerSavedPosts()` 这类“全量取当前 viewer 互动记录”的旧接口，不会被资料页 feed 直接复用。
- 本步骤不会把他人主页的私有 tab 权限判断塞进 service 层；越权控制仍由后续路由层负责。

## 改了什么，改在哪里

### 一、在 `post.type.ts` 中补齐资料页分页与计数契约

改动位置：

- `app/features/post/types/post.type.ts`

本步骤建议补齐两类类型：

- 分页参数类型
- 资料页 feed / 计数专用返回类型

建议新增或明确：

- `ProfilePostPageParams`
  - `profileId`
  - `cursor?: string | null`
  - `limit?: number`
- `ProfileEngagementPageParams`
  - `profileId`
  - `cursor?: string | null`
  - `limit?: number`
- `ProfileTabCountResult`
  - `count: number`

对于资料页卡片数据形状，第一版建议直接复用现有瀑布流兼容类型：

- `HomeFeedPostViewModel`

原因：

- 现有 `MasonryFeed` 和 `MasonryPostCard` 已经依赖这组字段。
- `posts / saved / liked` 三个 tab 的内容本质上都是同一种瀑布流卡片。
- 当前阶段不需要再平行维护一套新的 profile card type。

这里是一个工程上的收敛选择：虽然名称里有 `HomeFeed`，但其字段集合已经是“瀑布流帖子卡片”的通用最小集。第一版可以先直接复用，后续如果全站多个场景都使用同一模型，再统一泛化命名。

### 二、在 `post.keys.ts` 中新增资料页 feed 与 count 的缓存 key

改动位置：

- `app/features/post/queries/post.keys.ts`

建议新增一组资料页专用 key，而不是继续复用：

- `homeFeed(...)`
- `explore(...)`
- `viewerLikes(...)`
- `viewerSaves(...)`

建议至少新增：

- `profileScope(profileId)`
- `profilePosts(profileId, { limit })`
- `profilePostCount(profileId)`
- `profileLikedFeed(profileId, { limit })`
- `profileLikedCount(profileId)`
- `profileSavedFeed(profileId, { limit })`
- `profileSavedCount(profileId)`

这里不建议把资料页 feed 混入当前的：

- `viewerLikes(...)`
- `viewerSaves(...)`

原因：

- 当前这些 key 的语义是“当前登录 viewer 的互动状态或互动集合”。
- 资料页 feed 的语义是“某个 profile 的可展示内容页”。
- 两者缓存生命周期、数据形状和失效条件都不同。

### 三、在 `post.api.ts` 中新增资料页 `posts` feed 与计数 API

改动位置：

- `app/features/post/api/post.api.ts`

建议新增：

- `DEFAULT_PROFILE_FEED_PAGE_SIZE`
- `listProfilePublishedPostRows()`
- `countProfilePublishedPosts()`
- `listPublishedFeedPostRowsByIds()`

其中：

- `listProfilePublishedPostRows()`
  - 负责按 `creator = profileId` 查询公开帖子
  - 建议条件：
    - `Query.select(POST_HOME_FEED_SELECT)` 或等价的瀑布流 select
    - `Query.equal('creator', profileId)`
    - `Query.equal('status', 'published')`
    - `Query.orderDesc('$createdAt')`
    - `Query.limit(normalizedLimit)`
    - 有 cursor 时加 `Query.cursorAfter(cursor)`
    - `total: false`
- `countProfilePublishedPosts()`
  - 负责返回原始数量
  - 建议条件：
    - `Query.select(['$id'])`
    - `Query.equal('creator', profileId)`
    - `Query.equal('status', 'published')`
    - `Query.limit(1)`
    - 保持 `total` 为默认值，让 Appwrite 返回总数
- `listPublishedFeedPostRowsByIds()`
  - 负责按 `postIds` 批量回查当前页帖子
  - 建议条件：
    - `Query.select(POST_HOME_FEED_SELECT)`
    - `Query.equal('$id', normalizedPostIds)`
    - `Query.equal('status', 'published')`
    - `Query.limit(normalizedPostIds.length)`
    - `total: false`

这里建议新增 `listPublishedFeedPostRowsByIds()`，而不是让 `saved / liked` service 对每个帖子逐条 `getRow()`。

原因：

- 当前页 feed 只需要一页帖子，而不是 N 次逐条请求。
- 批量回查更符合免费版读配额和带宽约束。
- 当前瀑布流卡片只需要最小字段，不应为每张卡片走完整详情查询。

### 四、在 `post.service.ts` 中新增资料页 `posts` feed 与计数 service

改动位置：

- `app/features/post/services/post.service.ts`

建议新增：

- `getProfilePostPage()`
- `getProfilePostCount()`

职责：

- `getProfilePostPage()`
  - 调用 `listProfilePublishedPostRows()`
  - 处理空页
  - 复用现有瀑布流 mapper
  - 返回统一的 `CursorPage<HomeFeedPostViewModel>`
- `getProfilePostCount()`
  - 调用 `countProfilePublishedPosts()`
  - 返回 number

关于排序，这里建议 `posts` 继续使用：

- `$createdAt desc`

这是一个基于现有项目行为做出的工程推断：

- 首页 feed 当前按 `$createdAt desc`
- 资料页 `posts` tab 直觉上也应表示“这个用户最近发布了什么”

因此第一版不建议把资料页 `posts` 改成与首页不同的排序口径。

### 五、在 `post.engagement.api.ts` 中新增资料页互动分页与计数 API

改动位置：

- `app/features/post/api/post.engagement.api.ts`

当前文件已经有：

- 单条 like/save 记录查询
- 按 postIds 批量查询当前 viewer 的互动状态
- 当前 viewer 的“最多 100 条全量记录”读取

但这些仍不适合直接支撑资料页 feed。

建议新增：

- `listProfileLikeRecordsPage()`
- `listProfileSaveRecordsPage()`
- `countProfileLikeRecords()`
- `countProfileSaveRecords()`

建议分页选择字段：

- `$id`
- `$createdAt`
- `$sequence`
- `postId`
- `userId`

对于 `saved / liked` feed 的排序，建议在实现层优先使用：

- `Query.orderDesc('$sequence')`

这是本步骤基于 Appwrite 官方 order 文档做出的实现推断：

- 官方文档明确指出 `$sequence` 适合高频插入下的稳定分页排序。
- `likes / saves` 在当前项目里是 append-only 的互动记录表：
  - 点赞 / 收藏时创建记录
  - 取消时删除记录
- 因此对“当前仍存在的互动记录”而言，`$sequence desc` 与“最近互动优先”的用户语义等价，但分页稳定性更好。

对应 API 的职责：

- `listProfileLikeRecordsPage()`
  - `Query.equal('userId', profileId)`
  - `Query.orderDesc('$sequence')`
  - `Query.limit(normalizedLimit)`
  - 有 cursor 时加 `Query.cursorAfter(cursor)`
  - `total: false`
- `listProfileSaveRecordsPage()`
  - 与上面同理
- `countProfileLikeRecords()`
  - `Query.equal('userId', profileId)`
  - `Query.select(['$id'])`
  - `Query.limit(1)`
  - 返回 `result.total`
- `countProfileSaveRecords()`
  - 与上面同理

这里不建议继续复用当前：

- `listAllViewerLikeRecords()`
- `listAllViewerSaveRecords()`

原因：

- 这两个方法的语义是“取一批当前 viewer 的全量互动记录”。
- 当前实现还带有 `VIEWER_RECORD_LIMIT = 100` 上限。
- 资料页 feed 需要的是严格分页，而不是最多读取一段历史后再在前端切片。

### 六、在 `post.mapper.ts` 中新增“按外部顺序重排帖子”的 mapper helper

改动位置：

- `app/features/post/mappers/post.mapper.ts`

当前 mapper 已经能把 `RawPostHomeFeedRow` 映射成瀑布流卡片，但 `saved / liked` 还缺一个关键能力：

- 按互动记录顺序重排回查到的帖子

建议新增 helper，例如：

- `mapPostRowsToOrderedHomeFeedItems()`

输入建议包含：

- 当前页回查得到的 `RawPostHomeFeedRow[]`
- 互动记录顺序对应的 `orderedPostIds`

职责：

- 先把帖子 rows 映射成 view model
- 再按 `orderedPostIds` 重建顺序
- 自动跳过缺失项

这里不建议把“重排 + 过滤缺失帖子”的逻辑散落在 route 层或 query hook 里。

原因：

- 这本质仍属于数据转换逻辑，而不是页面逻辑。
- mapper 层更适合统一处理：
  - creator 为空
  - 图片元数据为空
  - 部分帖子回查失败
  - 按指定顺序输出

### 七、在 `post.engagement.service.ts` 中编排 `saved / liked` feed

改动位置：

- `app/features/post/services/post.engagement.service.ts`

这是本步骤的核心编排层。

建议新增：

- `getProfileLikedFeedPage()`
- `getProfileSavedFeedPage()`
- `getProfileLikedCount()`
- `getProfileSavedCount()`

其中 `getProfileLikedFeedPage()` / `getProfileSavedFeedPage()` 建议采用同一类内部流程：

1. 查询一页互动记录
2. 从当前页互动记录中提取 `postIds`
3. 去重后批量回查 `published` 帖子
4. 将帖子按互动记录顺序重排
5. 过滤已删除或不可读帖子
6. 返回：
   - `items`
   - `nextCursor`

这里有一个必须明确的实现要求：

- `nextCursor` 只能由“互动记录页”决定
- 不能由“最终映射成功的帖子数”决定

原因：

- 当前页互动记录可能有一部分已指向失效帖子。
- 如果用最终可见帖子数来推断是否还有下一页，就会错误地提前结束分页。

因此第一版允许出现这种情况：

- `items.length === 0`
- 但 `nextCursor !== null`

这不是异常，而是脏互动记录被过滤后的正常结果。

### 八、在 `post.queries.ts` 和 `post.engagement.queries.ts` 中新增资料页 hook

改动位置：

- `app/features/post/queries/post.queries.ts`
- `app/features/post/queries/post.engagement.queries.ts`

建议新增：

- `useProfilePostsInfiniteQuery(profileId, limit?)`
- `useProfilePostCountQuery(profileId)`
- `useProfileLikedFeedInfiniteQuery(profileId, limit?)`
- `useProfileLikedCountQuery(profileId)`
- `useProfileSavedFeedInfiniteQuery(profileId, limit?)`
- `useProfileSavedCountQuery(profileId)`

职责：

- `posts` 使用 `useInfiniteQuery + postKeys.profilePosts(...)`
- `saved / liked` 使用 `useInfiniteQuery + 各自的 profile feed key`
- 计数使用 `useQuery`
- 统一设置合理的 `staleTime`

这里不建议在第三步就把多个 count 聚合成一个跨领域 hook。

原因：

- 当前项目的分层仍然以 `post` / `engagement` 为中心。
- `profile` 页面壳将在后续步骤引入，届时再决定是否做更高层的组合。
- 先把底层原子能力补齐，更符合当前代码架构。

## 为什么选择这个方案

### 为什么 `saved / liked` 必须先分页互动记录，再回查帖子

因为 `likes / saves` 表当前只存：

- `userId`
- `postId`

并不存渲染卡片所需的帖子快照。

因此资料页要展示：

- 最近点赞了什么
- 最近收藏了什么

就必须以互动记录为第一页数据源，再用这些 `postIds` 回查帖子。

这里不建议为了绕开回查而在 `likes / saves` 表中直接冗余帖子摘要。

原因：

- 会带来写放大和数据一致性问题
- 删帖和改资料时都要同步维护快照
- 当前项目目标是先用最小复杂度打通资料页

### 为什么计数查询与 feed 查询分离

原因：

- Appwrite `listRows()` 可以返回总数，但 feed 查询当前普遍使用 `total: false` 来避免额外计算。
- 资料页壳需要 tab 数量，但内容区只需要当前 tab 的列表。
- 如果把 count 和 list 强行绑定，会导致：
  - 壳层被内容区阻塞
  - 非当前 tab 也被动发起列表查询
  - 免费版读请求和响应体积都被放大

因此第一版应采用：

- feed：`total: false`
- count：独立小查询

### 为什么 `saved / liked` 数量仍按互动记录原始数量展示

原因：

- 这是当前总体设计已经明确的产品口径。
- 如果要把 count 校正为“只统计仍可见帖子”，就必须做更大范围的帖子有效性扫描。
- 在纯客户端直连 Appwrite 的架构下，这会显著增加读请求和缓存复杂度。

第一版优先保证：

- 列表内容可用
- 分页稳定
- 请求量可控

而不是为了过渡期的脏记录做昂贵的精确计数。

### 为什么资料页内容继续复用现有瀑布流 view model

原因：

- `MasonryFeed` / `MasonryPostCard` 已经是现成稳定实现。
- 资料页内容本质仍是同一类帖子卡片。
- 如果第三步就为 profile feed 再造一套新的 view model，会平白增加 mapper 和缓存复杂度。

因此第一版更合理的做法是：

- 数据层直接返回瀑布流兼容数据
- 后续 route 层直接渲染

### 为什么 `saved / liked` 选择 `$sequence desc` 作为实现层分页顺序

原因：

- Appwrite 官方文档明确指出，`$sequence` 适合高频插入下的稳定分页排序。
- `likes / saves` 当前是标准互动流水表，天然符合这个使用场景。
- 用户关心的是“最近一次互动发生顺序”，而不是时间字段的格式化精度。

这是一个实现层选择，不改变产品语义：

- 对用户仍然是“最近互动优先”
- 对工程实现则是“更稳定的 cursor 分页”

### 为什么不复用当前“全量 viewer 互动记录”接口

原因：

- 那套接口的目标是：
  - 支撑单帖点赞状态
  - 支撑一批已知 postIds 的 viewer 状态判断
- 它不是为 profile 页无限滚动设计的
- 当前还带有 100 条上限

如果资料页继续复用它，就会自然滑向：

- 一次性取很多互动记录
- 前端自己切页
- 历史数据越多越浪费读请求

这与本期“按当前 tab 最小请求”的原则冲突。

## 实现顺序与依赖关系

### 第一步：补齐资料页分页与计数类型、query keys

操作：

- 在 `post.type.ts` 增加 profile feed / count 相关类型
- 在 `post.keys.ts` 增加资料页 feed 和 count key

依赖：

- 依赖当前 `CursorPage<T>` 与现有 query key 结构

### 第二步：补齐 `post.api.ts` 的 profile posts 基础查询

操作：

- 新增 profile posts 分页 API
- 新增公开帖子计数 API
- 新增按 postIds 批量回查瀑布流字段的 API

依赖：

- 依赖现有 `posts` schema
- 依赖现有 `POST_HOME_FEED_SELECT` 或等价最小字段集合

### 第三步：补齐 `post.engagement.api.ts` 的互动分页与计数查询

操作：

- 新增 likes/saves 分页 API
- 新增 likes/saves count API

依赖：

- 依赖现有 `likes / saves` 表
- 依赖现有 owner-private 权限模型

### 第四步：在 mapper / service 层完成“互动页 -> 帖子页 -> 瀑布流卡片”的组装

操作：

- 增加顺序重排 helper
- 增加 `saved / liked` page service
- 增加 `posts` count / page service

依赖：

- 依赖第二步和第三步的 API 已具备

### 第五步：在 queries 层开放资料页可消费的 hooks

操作：

- 新增 infinite query hooks
- 新增 count query hooks

依赖：

- 依赖第四步 service 已稳定

### 第六步：做数据层验证，为后续路由壳和 tab 页面接入做准备

验证项：

- 公开 `posts` feed 正常分页
- `saved / liked` 按互动顺序返回
- 已删除帖子被过滤
- 脏记录页返回空 `items` 时仍保留正确 `nextCursor`
- `posts / saved / liked` count 口径正确

这一步完成后，后续步骤可以直接基于这些 hooks 和 service 接入：

- 资料页壳路由
- 三个 tab 页面
- tab 数量展示

## 关键风险及应对策略

### 风险：`saved / liked` 存在大量指向已删除帖子的脏记录

问题：

- 互动记录存在，但帖子已经删除或不可访问。

应对：

- 当前页帖子回查失败时直接过滤
- `nextCursor` 仍由互动记录页决定
- 不为了第一版精确计数去做额外全量校正

### 风险：某一页最终可见帖子数少于 page size，甚至为 0

问题：

- 如果当前页互动记录大部分都失效，映射后的 `items` 会明显少于请求上限
- 极端情况下这一页可能没有任何可见卡片

应对：

- 明确这是允许的正常结果
- `nextCursor` 基于互动记录页而不是基于 `items.length`
- 后续 UI 层只在“所有已加载页都为空且无下一页”时判定整体空态

### 风险：继续复用旧的“全量 viewer 互动记录”接口，导致读请求失控

问题：

- 那套接口天然会向“先全量读，再前端切页”滑坡

应对：

- 资料页 feed 新增独立分页 API
- 旧接口继续只服务单帖状态或已知 postIds 批量判断

### 风险：`saved / liked` 的数量与当前可见卡片数不一致

问题：

- 脏互动记录会导致 tab count 大于最终可见内容

应对：

- 第一版接受该偏差
- 明确 count 口径就是“互动记录原始数量”
- 通过后续删帖级联清理逐步收敛

### 风险：互动顺序在分页场景下不稳定

问题：

- 如果只按时间字段做排序，可能在高频写入下出现分页边界不稳定

应对：

- 在实现层优先使用 `$sequence desc`
- 仍保留 `$createdAt` 供后续需要时展示或调试

### 风险：回查帖子时忘记显式 select 关系字段，导致 creator 信息缺失

问题：

- Appwrite 关系加载是 opt-in 的
- 如果漏选 `creator.$id / name / imageUrl`，当前 mapper 会直接把卡片过滤掉

应对：

- 统一复用瀑布流专用 select 集合
- 不在多个地方手写分散的 profile feed select

### 风险：批量回查 `postIds` 时出现重复 ID 或无效 ID

问题：

- 当前页互动记录理论上可能包含重复或脏数据

应对：

- 在批量回查前先去重、trim、过滤空值
- 最终排序时仍按原互动顺序重建输出

### 风险：路由层误调用他人的私有 tab 查询，直接触发权限错误

问题：

- `likes / saves` 为 owner-private 表

应对：

- 本步骤不在 service 层吞掉权限错误
- 后续路由壳应在请求前尽早判断 owner / viewer 关系并重定向

## 预期结果

本步骤完成后，项目将具备资料页真正需要的底层数据能力：

- 能按 `profileId` 获取公开 `posts` feed
- 能按互动顺序获取 `saved / liked` feed
- 能查询三类 tab 的数量
- 能将 `saved / liked` 当前页互动记录稳定映射为瀑布流帖子卡片
- 能在存在脏互动记录时保持分页链路稳定，而不是提前终止

这样后续重构资料页路由壳和三个 tab 页面时，就不需要再临时拼接跨领域查询逻辑，只需消费这套已经明确的 profile 数据层即可。
