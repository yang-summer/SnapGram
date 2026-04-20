# 首页瀑布流步骤四：首页分页 API / Service / Query 数据层

## 目的

本步骤用于为首页瀑布流建立独立的分页数据层，替换当前首页“一次性获取最近 20 条”的固定列表模式。

本步骤的目标是：

- 为首页提供真正的 cursor 分页 feed 数据接口。
- 按“最新发布”语义稳定返回帖子，即按 `$createdAt desc` 排序。
- 支持首页无限滚动所需的下一页游标。
- 仅查询首页瀑布流真正需要的字段，避免无关字段增加返回体积。
- 与现有 `Explore` 的无限滚动结构保持一致，但不强行复用其具体查询逻辑。
- 为后续首页瀑布流组件和渐进式图片组件提供稳定的分页数据来源。

本步骤不负责：

- 首页 UI 改造
- 渐进式图片组件实现
- 瀑布流组件实现
- 创建 / 编辑帖子时写入图片元数据

本步骤只负责：

- `post.api.ts`
- `post.service.ts`
- `post.queries.ts`
- `post.keys.ts`

这一层的“首页 feed 分页数据能力”。

## 验收标准

本步骤完成后，应满足以下验收标准：

- 新增首页专用分页 API：
  - `listHomeFeedPostRows`
- 新增首页专用 service：
  - `getHomeFeedPage`
- 新增首页专用 query hook：
  - `useHomeFeedInfiniteQuery`
- 新增首页专用 query key：
  - `postKeys.homeFeed(...)`
- 首页 feed 查询按以下规则工作：
  - 只查询 `published` 状态帖子
  - 按 `$createdAt desc` 排序
  - 使用 `Query.cursorAfter()`
  - 使用 `Query.limit()`
  - 使用 `total: false`
- 首页 feed 查询使用首页专用 `Query.select()`，包含瀑布流和渐进式图片所需字段：
  - `imagePlaceholder`
  - `aspectRatioBucket`
  - `imageWidth`
  - `imageHeight`
  - 以及首页卡片所需的作者、caption、点赞数等字段
- 首页 feed 不复用当前 `getRecentPosts()` 的固定 20 条逻辑。
- 首页分页 service 返回统一结构：

```ts
type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
}
```

- 当查询为空时，返回空页结构而不是异常。
- 当查询结果数量不足一页时，`nextCursor` 为 `null`。
- query 层使用 `useInfiniteQuery`，并能正确根据 `nextCursor` 获取下一页。

## 改了什么，改在哪里

### 一、在 `post.keys.ts` 中新增首页分页 key

改动位置：

- `app/features/post/queries/post.keys.ts`

建议新增：

- `homeFeed: (params: { limit: number }) => ...`

不建议复用：

- `recent()`

原因：

- `recent()` 语义是固定列表
- `homeFeed()` 语义是可持续翻页的首页 feed
- 两者缓存语义不同，不应共享 key

### 二、在 `post.api.ts` 中新增首页专用查询

改动位置：

- `app/features/post/api/post.api.ts`

建议新增：

- `DEFAULT_HOME_FEED_PAGE_SIZE`
- `POST_HOME_FEED_SELECT`
- `listHomeFeedPostRows()`

建议默认 page size：

- `20`

不建议第一版默认用 `24`，原因是首页是图片密集型瀑布流，同时还会带 `imagePlaceholder` 等元数据，`20` 更稳，更适合 Appwrite 免费版读流量和首屏成本控制。

`POST_HOME_FEED_SELECT` 建议字段：

- `$id`
- `$createdAt`
- `caption`
- `imageUrl`
- `imagePlaceholder`
- `aspectRatioBucket`
- `imageWidth`
- `imageHeight`
- `likeCount`
- `creator.$id`
- `creator.name`
- `creator.imageUrl`

这里刻意不加入：

- `tags`
- `location`
- `saveCount`
- `imageId`

原因：

- 当前首页卡片需求不需要这些字段
- 首页查询应按需取数
- 尤其 `imagePlaceholder` 已经会增加返回体积，更应避免无关字段叠加

`listHomeFeedPostRows()` 的职责：

- 只做 Appwrite 查询拼装
- 不做 view model 转换
- 使用以下查询条件：
  - `Query.select(POST_HOME_FEED_SELECT)`
  - `Query.equal('status', 'published')`
  - `Query.orderDesc('$createdAt')`
  - `Query.limit(normalizedLimit)`
  - 当存在 cursor 时加 `Query.cursorAfter(cursor)`
- 设置：
  - `total: false`

### 三、在 `post.service.ts` 中新增首页分页 service

改动位置：

- `app/features/post/services/post.service.ts`

建议新增：

- `getHomeFeedPage()`

职责：

- 调用 `listHomeFeedPostRows()`
- 处理空结果
- 调首页专用 mapper
- 生成统一的 `CursorPage<T>` 结构

建议行为：

- 如果 response 不存在或 `rows` 为空：
  - 返回 `{ items: [], nextCursor: null }`
- 如果返回数量等于 page size：
  - `nextCursor = 最后一条 row 的 $id`
- 否则：
  - `nextCursor = null`

这里第一版建议沿用当前 `Explore` 的游标策略，不做“多取一条”的 overfetch 优化，保持与现有代码风格一致，降低实现复杂度。

### 四、在 `post.queries.ts` 中新增首页 infinite query

改动位置：

- `app/features/post/queries/post.queries.ts`

建议新增：

- `useHomeFeedInfiniteQuery(limit = DEFAULT_HOME_FEED_PAGE_SIZE)`

职责：

- 使用 `useInfiniteQuery`
- 使用首页专用 query key
- 使用首页专用 service
- 负责 `pageParam` 到 `cursor` 的传递

建议配置：

- `initialPageParam: null`
- `getNextPageParam: (lastPage) => lastPage.nextCursor`
- `staleTime: 30_000`

### 五、在 mapper 层补首页分页结果转换

改动位置：

- `app/features/post/mappers/post.mapper.ts`

依赖前面步骤已经新增好的首页专用 raw type 和 view model。

建议新增：

- `mapPostRowToHomeFeedItemViewModel()`
- `mapPostRowsToHomeFeedItemViewModels()`
- `mapHomeFeedRowsToCursorPage()`

职责：

- 将首页 row 转成首页卡片可消费的数据
- 对旧数据做降级
- 统一生成 `items + nextCursor`

虽然这部分严格说属于 mapper 层，但它与首页分页 service 高度耦合，因此本步骤需要一并覆盖。

## 为什么选择这个方案

### 为什么首页 feed 必须独立于 `getRecentPosts()`

当前 `getRecentPosts()` 的职责是：

- 固定拉取最近 20 条
- 用于一次性列表展示
- 返回旧首页卡片所需数据

它不适合首页瀑布流，原因有四个：

- 没有 cursor 参数
- 没有 `total: false`
- 没有首页瀑布流需要的图片元数据字段
- 语义上是“固定列表”，不是“可持续翻页的 feed”

如果强行在 `getRecentPosts()` 上叠加分页逻辑，会让它逐渐变成一个混合职责接口，后续维护更差。

### 为什么选择 cursor pagination

Appwrite 官方文档明确建议在以下场景优先使用 cursor pagination：

- 社交 feed
- 评论流
- 聊天记录
- 无限滚动列表

相比 offset 分页，cursor pagination 更适合首页这种持续变化的数据流，因为：

- 不依赖页码和偏移量
- 在新数据插入时更不容易产生重复和遗漏
- 更适合懒加载和无限滚动

因此首页应直接基于：

- `Query.orderDesc('$createdAt')`
- `Query.cursorAfter(cursor)`

来构建。

### 为什么选择 `$createdAt desc`

这是为了准确匹配“最新发布”的业务语义。

不选 `$updatedAt` 的原因：

- 旧帖子一旦被编辑，就会重新上浮
- 不符合当前首页需求

不选其他字段的原因：

- 当前排序语义已经明确，不需要额外复杂度

### 为什么使用 `total: false`

首页 feed 是无限滚动列表，不需要：

- 总页数
- 总帖子数
- 分页器页码

因此跳过 total 统计更符合官方建议，也更适合当前项目的 Appwrite 免费版资源约束。

### 为什么首页使用专用 `Query.select()`

首页瀑布流需要的字段，与现有 Explore / Detail / Editor 查询并不完全一致。

尤其新增了：

- `imagePlaceholder`
- `aspectRatioBucket`
- `imageWidth`
- `imageHeight`

这些字段只应出现在真正需要它们的查询里。

如果把这些字段加入通用 select：

- 会增加其他页面响应体积
- 会浪费 Appwrite 读资源
- 会让数据契约逐渐失去边界

因此首页应有自己专用的 `POST_HOME_FEED_SELECT`。

### 为什么沿用现有 `Explore` 的结构，但不复用具体实现

当前项目已经有一套清晰的无限滚动组织方式：

- API：`listExplorePostRows`
- Service：`getExplorePostPage`
- Query：`useExplorePostsInfiniteQuery`

这套结构已经符合当前仓库风格，因此首页继续沿用这套分层方式最合理。

但首页不能直接复用 `Explore` 的实现，因为：

- 排序语义不同
- 字段契约不同
- 首页需要 LQIP 和比例元数据
- 首页卡片 view model 不同

所以结论是：

- 结构复用
- 数据契约分开

## 实现顺序与依赖关系

### 第一步：完成首页专用类型与 mapper 契约

依赖：

- 依赖步骤一中已经完成的首页 raw type、view model 和降级策略

原因：

- API / service / query 层要围绕首页专用数据结构构建

### 第二步：在 `post.keys.ts` 中新增首页 key

操作：

- 增加 `postKeys.homeFeed({ limit })`

目的：

- 先确定缓存语义，再接 query hook

### 第三步：在 `post.api.ts` 中新增首页分页查询

操作：

- 增加首页专用 `select`
- 增加 `listHomeFeedPostRows()`

依赖：

- 依赖 schema 已经存在图片元数据字段
- 依赖首页 raw type 已准备好

### 第四步：在 `post.mapper.ts` 中增加首页分页映射

操作：

- 增加首页分页结果 mapper

依赖：

- 依赖首页查询返回字段已确定

### 第五步：在 `post.service.ts` 中新增 `getHomeFeedPage()`

操作：

- 调 API
- 处理空页
- 组装 cursor page

依赖：

- 依赖 mapper 与 API 已稳定

### 第六步：在 `post.queries.ts` 中新增 `useHomeFeedInfiniteQuery()`

操作：

- 接入 `useInfiniteQuery`
- 接首页专用 query key 和 service

依赖：

- 依赖 service 已能稳定返回 `CursorPage`

### 第七步：验证数据层输出

验证项：

- 首次请求返回第一页数据
- 翻页时正确带上 cursor
- 最后一页返回 `nextCursor: null`
- 空列表正常返回，不报错
- 非首页查询未被影响

只有在这一层稳定后，下一步首页 UI 接入才有意义。

## 关键风险及应对策略

### 风险：继续复用旧首页查询，导致职责混乱

问题：

- 如果在 `getRecentPosts()` 上继续叠加首页 feed 所需逻辑，后续函数语义会越来越不清晰。

应对：

- 明确新增独立首页分页链路
- 保留旧函数给旧逻辑使用，不混用

### 风险：首页 select 字段过多，响应体积偏大

问题：

- 首页已经需要 placeholder 和图片元数据，如果仍然把 tags、location、saveCount 等非必需字段带上，会放大响应体积。

应对：

- 首页专用 `POST_HOME_FEED_SELECT` 严格按需取数
- 后续只有 UI 真需要字段时才追加

### 风险：游标分页在数据变动时出现重复或漏项

问题：

- 首页是按时间倒序的动态 feed，理论上在用户滚动期间可能有新帖子插入。

应对：

- 使用 Appwrite 官方推荐的 cursor pagination
- 以首页 feed 的懒加载体验为优先
- 第一版接受极少量边界重复 / 变化风险，不提前引入复杂去重策略
- 如果后续发现重复明显，再在 service 层增加基于 `id` 的去重

### 风险：最后一页刚好等于 page size，导致多发一次空请求

问题：

- 目前策略是“返回条数等于 page size 就认为可能还有下一页”，最后一页刚好满页时会再发一次请求确认。

应对：

- 第一版接受这一点，保持实现简单并与现有 Explore 一致
- 如果后续要优化，再升级为 `limit + 1` 模式

### 风险：排序字段选择错误，导致首页内容不符合预期

问题：

- 如果误用 `$updatedAt`，编辑旧帖会导致其重新浮到首页顶部。

应对：

- 首页排序固定为 `$createdAt desc`
- 将这一点写入 API 层常量和文档，避免后续误改

### 风险：`total: false` 被遗漏，造成额外统计开销

问题：

- 首页不需要总数，如果遗漏该配置，会让 Appwrite 做无意义统计。

应对：

- 在 `listHomeFeedPostRows()` 中显式写出 `total: false`
- 不依赖 Appwrite 默认行为

### 风险：首页 query key 与 `recent()` 混用导致缓存污染

问题：

- 如果首页分页和旧首页 recent 列表共享缓存 key，可能出现缓存语义混乱。

应对：

- 独立新增 `postKeys.homeFeed`
- 不复用 `postKeys.recent()`

## 预期结果

本步骤完成后，项目将具备一套独立、清晰、符合首页 feed 语义的分页数据层：

- 首页拥有自己的分页 API、service 和 query hook
- 查询按“最新发布”语义返回数据
- 查询字段按首页真实需求最小化
- 数据层与现有 Explore 结构保持一致，但契约独立
- 后续首页瀑布流 UI 可以直接消费分页数据，而不需要再改底层分页模型
