# 搜索帖子功能设计方案

## 范围

本文档定义 Snapgram 第一版“搜索帖子”功能的实现方案。

本期目标：

- 将顶部栏搜索框接成全局搜索入口。
- 用户在任意已登录页面输入关键词后，点击搜索 icon 或按回车，跳转到：
  - `/search-result?keyword=...`
- 搜索结果页使用与首页一致的瀑布流卡片和无限滚动模式。
- 搜索范围第一版只覆盖帖子：
  - `caption`
  - `tags`
- 搜索结果按：
  - `$createdAt desc`
  排序。
- 当 URL 中已有 `keyword` 时，顶部搜索框自动回填关键词。
- 空输入或少于 Appwrite `Query.search()` 最小长度限制时：
  - 不发请求
  - 用 `toast` 提示
- 用户直接访问 `/search-result` 但没有 `keyword` 时：
  - 显示空态页
  - 引导输入关键词

本期不包含：

- 改造 `Explore` 的旧搜索实现
- 搜索建议、联想词、热搜词
- 作者名、地点、评论内容搜索
- `contains + search` 混合召回
- 相关性打分、相关性排序或 relevance merge
- 接入 Meilisearch / Algolia 等外部搜索引擎
- 新的响应式搜索交互设计

## 当前现状

当前相关文件：

- `app/routes.ts`
- `app/layouts/rootLayout.tsx`
- `app/components/shared/Topbar.tsx`
- `app/routes/explore.tsx`
- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/queries/post.keys.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/components/MasonryFeed.tsx`
- `app/features/post/components/MasonryPostCard.tsx`
- `app/components/feedback/page-empty-state.tsx`
- `app/components/feedback/page-error-state.tsx`
- `app/components/feedback/page-loading-state.tsx`
- `app/root.tsx`

当前行为：

- `Topbar` 已经有搜索输入框和搜索 icon，但目前只是静态 UI，没有提交、跳转或查询逻辑。
- 所有认证后页面都经过 `rootLayout.tsx`，因此顶部搜索框天然适合作为全局入口。
- `Explore` 页面已有一版搜索，但它是：
  - 页内 debounce 即时搜索
  - 单次查询
  - 固定高度网格卡片
  - 不是带 URL 的搜索结果页
- 首页和资料页已经有稳定的：
  - `MasonryFeed`
  - `MasonryPostCard`
  - `useInfiniteQuery`
  - sentinel 自动加载
  - 页级 loading / error / empty / end state 模式
- 帖子表已经有 `searchText` 字段和 Appwrite full-text index。
- 发帖和编辑帖子时，`searchText` 会由：
  - `caption`
  - `tags`
  归一化拼接而成。
- 当前 `searchPostRows()` 已经使用：
  - `Query.search('searchText', term)`
  但它是：
  - 固定数量
  - 非 cursor 分页
  - 按 `$updatedAt desc` 排序
  - 返回 Explore 旧网格所需字段
- 全局 `Toaster` 已经在 `app/root.tsx` 接好，可直接复用 `sonner` 的 `toast()`。

当前 Appwrite 约束：

- 前端通过浏览器端 SDK 直连 Appwrite `TablesDB`。
- 本期不引入新的服务端搜索层。
- 已确认 Appwrite `Query.search()` 需要至少 3 个字符。
- Appwrite Databases 查询没有可直接使用的相关性分数或相关性排序能力。

## 已确认需求

已确认需求：

- 搜索结果使用独立路由：
  - `/search-result?keyword=...`
- 搜索不新开标签页，仍然是当前 SPA 内部路由跳转。
- URL 中的 `keyword` 保留“原关键词语义”。
- query string 序列化使用标准 URL 编码即可，不手动做双重编码。
- `Topbar` 是全局搜索入口。
- 提交动作只包括：
  - 点击搜索 icon
  - 输入框回车
- 搜索结果页使用首页同款瀑布流卡片。
- 搜索结果页支持无限滚动分页。
- 当 URL 中已有 `keyword` 时，`Topbar` 搜索框自动回填。
- 输入为空或纯空白时：
  - 不触发搜索
  - 使用 `toast` 提示
- 最小关键词长度接受 Appwrite `Query.search()` 的限制。
- 搜索页和提交入口都要在前端拦截短关键词，并提示。
- 用户直接访问 `/search-result` 且没有 `keyword` 时：
  - 显示空态页
  - 引导输入关键词
- 多关键词匹配语义第一版直接接受 Appwrite 全文搜索默认行为。
- 第一版搜索范围只搜：
  - `caption + tags`
- 排序按：
  - `$createdAt desc`
- `Explore` 旧搜索本期不动。
- 本期不新增响应式搜索交互设计。

## 改了什么，改在哪里

### 1. 新增独立的搜索结果路由

更新：

- `app/routes.ts`

新增：

- `app/routes/searchResult.tsx`

职责：

- 读取并归一化 `keyword` query param。
- 区分以下页面状态：
  - 无关键词空态
  - 关键词过短的引导态
  - 首屏 loading
  - 首屏 error
  - 搜索结果为空
  - 正常瀑布流内容
  - 后续分页加载中
  - 后续分页失败
  - 没有更多结果
- 调用搜索专用 infinite query。
- 将分页结果拍平成单一数组后交给 `MasonryFeed` 渲染。
- 在底部挂载 sentinel 和分页状态区。

这里不建议把搜索结果页继续塞回 `Explore`。

原因：

- 产品语义已经从“探索页内过滤”变成“全局搜索结果页”。
- URL 需要独立稳定，便于浏览器前进后退和直接访问。
- 后续 `Explore` 会改成其他功能，当前应避免继续加重其职责。

### 2. 改造 `Topbar`，将其接成全局搜索入口

更新：

- `app/components/shared/Topbar.tsx`

建议改动：

- 将当前输入框改为受控输入。
- 使用 `useNavigate()` 承担提交后的路由跳转。
- 使用 `useLocation()` 或 `useSearchParams()` 读取当前 URL 中的 `keyword`。
- 当当前路由是 `/search-result` 且 URL 中存在 `keyword` 时：
  - 自动回填输入框
- 将搜索 icon 改为可提交按钮，而不是纯展示图标。
- 输入框与 icon 使用统一的 `<form>` 提交语义。

提交规则：

1. 对输入执行 `trim()`。
2. 如果为空：
   - `toast.error(...)`
   - 不跳转
3. 如果长度小于 3：
   - `toast.error(...)`
   - 不跳转
4. 如果合法：
   - 跳转到 `/search-result?keyword=...`

URL 处理要求：

- 业务层保存原始关键词字符串。
- 通过 `URLSearchParams` 或 React Router 的标准 search params 能力完成 query string 序列化。
- 不先手动执行 `encodeURIComponent(keyword)` 再塞进 `keyword` 参数。
- 不采用 `%25E7...` 这类双重编码后的 query param 形式。

这里建议由 `Topbar` 负责提交校验与跳转，但不直接负责拉取搜索结果数据。

这样可以保持：

- `Topbar`
  只负责“输入与导航”
- `searchResult.tsx`
  只负责“根据 URL 渲染结果页”

### 3. 在 `post` 数据层中新增搜索结果专用分页链路

更新：

- `app/features/post/types/post.type.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.queries.ts`
- `app/features/post/queries/post.keys.ts`

建议新增或调整：

- 搜索专用 page params 类型，例如：
  - `SearchPostPageParams`
- 搜索结果专用 page size 常量，例如：
  - `DEFAULT_SEARCH_POST_PAGE_SIZE`
- 搜索结果专用 API，例如：
  - `listSearchPostRows()`
- 搜索结果专用 service，例如：
  - `getSearchPostPage()`
- 搜索结果专用 query key，例如：
  - `postKeys.searchFeed({ keyword, limit })`
- 搜索结果专用 hook，例如：
  - `useSearchPostsInfiniteQuery(keyword, limit)`

查询要求：

- 使用：
  - `Query.equal('status', 'published')`
  - `Query.search('searchText', normalizedKeyword)`
  - `Query.orderDesc('$createdAt')`
  - `Query.limit(normalizedLimit)`
  - `Query.cursorAfter(cursor)`
- 使用：
  - `total: false`

注意：

- 现有 `searchPostRows()` / `searchExplorePosts()` / `useSearchPostsQuery()` 是 Explore 旧链路，本期不建议直接替换。
- 为降低回归风险，应新增一条“搜索结果页专用”分页链路，而不是在旧单次查询链路上做破坏式改造。

### 4. 复用首页瀑布流的数据契约，而不是再造一套搜索卡片契约

更新：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/types/post.type.ts`

建议做法：

- 搜索结果查询直接复用首页卡片所需的字段集合：
  - `POST_HOME_FEED_SELECT`
- 搜索结果 service 直接复用首页 feed 的映射能力：
  - `mapHomeFeedRowsToCursorPage()`
- 搜索结果页直接消费：
  - `HomeFeedPostViewModel`

原因：

- 搜索结果的视觉就是首页同款瀑布流卡片。
- 现有 Explore 搜索结果只返回 `PostGridItemViewModel`，缺少：
  - `caption`
  - `imagePlaceholder`
  - `aspectRatioBucket`
  - `imageWidth`
  - `imageHeight`
- 如果再做一套“搜索专用瀑布流卡片类型”，会让同一视觉出现两套近似契约，增加维护成本。

因此第一版更合理的方案是：

- 搜索结果页在数据层上尽量对齐首页 feed
- 只把“过滤条件是搜索”视为差异
- 不把“卡片结构”也做成另一套

### 5. 复用现有页面状态组件和无限滚动模式

复用：

- `app/components/feedback/page-loading-state.tsx`
- `app/components/feedback/page-error-state.tsx`
- `app/components/feedback/page-empty-state.tsx`
- `app/features/post/components/MasonryFeed.tsx`
- `react-intersection-observer`

建议：

- 搜索结果页沿用首页和资料页已经验证过的：
  - 首屏状态与后续分页状态分层
  - sentinel 自动翻页
  - 后续分页失败时保留已有内容
  - 尾部重试 / 结束态

必要时可新增一个轻量包装组件，例如：

- `app/features/post/components/SearchResultLoadMoreState.tsx`

但第一版不强制要求新建复杂页面级 feature。

### 6. 本期不改 schema，也不改 `Explore` 旧搜索 UI

本期不改：

- `appwrite.config.json`
- `app/routes/explore.tsx`
- `app/features/post/components/SearchResults.tsx`

原因：

- `searchText` 字段和 full-text index 已存在。
- 发帖与编辑帖子时已经维护 `searchText`。
- 当前需求的核心缺口不是 schema，而是：
  - 全局入口
  - 独立路由
  - cursor 分页
  - 瀑布流结果页

这能显著缩小本期改动面，避免把 `Explore` 回归风险和全局搜索接入绑在同一个提交里。

## 为什么选择这个方案

### 为什么使用独立的 `/search-result` 路由

因为当前需求已经不是“在 Explore 页做局部过滤”，而是：

- 让顶部栏成为全局搜索入口
- 让搜索结果成为一个可直接访问、可前进后退的页面

独立路由的优势：

- URL 能表达当前搜索上下文
- 浏览器刷新后结果可恢复
- Topbar 可以根据 URL 回填关键词
- 后续 `Explore` 改版时不会被历史搜索逻辑牵制

### 为什么 URL 中保留原关键词语义，而不是采用双重编码

本期搜索 URL 选择：

- 在业务层保留原始 `keyword`
- 让浏览器、`URLSearchParams` 或 React Router 负责标准 query string 编码

而不是：

- 先手动把关键词编码成 `%E7...`
- 再把这段编码后的字符串作为 `keyword` 参数继续放进 URL

原因：

- 可读性更好，便于调试、排查、分享链接和人工验证。
- `Topbar` 输入框回填逻辑更直接，避免出现多一层解码责任。
- 更符合当前项目复杂度，不需要维护额外的编码 / 解码约定。
- 双重编码不会带来实际的后端搜索性能收益，反而更容易引入：
  - 少解一次
  - 多解一次
  - 参数层次混乱
  这类问题。

因此本期明确采用：

- 原关键词语义 + 标准 URL 编码

### 为什么 `Topbar` 只负责提交和 URL 同步，不直接拉数据

因为搜索数据天然属于结果页。

如果让 `Topbar` 直接查询，会带来几个问题：

- 共享布局组件会承担页面数据状态
- 多页面切换时，搜索请求和搜索展示职责混杂
- 无法让 `/search-result?keyword=...` 成为真正的 URL 驱动页面

因此这里采用：

- `Topbar` 负责输入、校验、导航
- `searchResult.tsx` 负责查询、状态和渲染

职责边界更清晰。

### 为什么第一版直接使用 Appwrite `Query.search()`

这是当前需求已经明确确认的方案。

同时，它也和项目现状匹配：

- `posts.searchText` 已存在
- `searchText` full-text index 已存在
- 发帖 / 编辑链路已经维护该字段

相比本期再引入：

- `contains`
- 复合召回
- 自定义切词
- 外部搜索基础设施

直接复用现有 `Query.search()` 是更小、更稳的落地路径。

代价也明确存在：

- 受最小 3 字符限制影响
- 多关键词行为依赖 Appwrite 默认全文搜索语义
- 没有相关性排序

这些限制本期接受，并通过前端校验和文档边界显式管理。

### 为什么搜索结果要单独新增 infinite query 链路，而不是改掉 Explore 旧搜索

因为两个场景的职责已经不同：

- Explore 旧搜索：
  - 页内即时搜索
  - 旧网格卡片
  - 固定数量
- 新搜索结果页：
  - 全局导航入口
  - 独立 URL
  - 瀑布流卡片
  - cursor 分页

如果直接在旧搜索链路上硬改，会同时影响：

- Explore 页面行为
- 旧 query key
- 旧 mapper 契约

第一版应优先隔离新功能，避免不必要的回归面。

### 为什么搜索结果复用首页瀑布流契约

因为目标视觉已经明确是“首页同款瀑布流卡片”。

现有首页契约已经稳定覆盖：

- 图片
- 比例桶
- 占位图
- caption
- 作者信息
- 点赞数

如果搜索结果为了“语义独立”再造一套近似 view model，只会增加：

- select 字段维护成本
- mapper 重复
- 卡片适配分叉

因此本期选择：

- 搜索结果页复用首页 feed 契约
- 将差异控制在“查询条件”和“页面入口”层

### 为什么排序固定为 `$createdAt desc`

这是为了直接匹配已确认需求。

同时它比 `$updatedAt desc` 更符合搜索结果预期：

- 编辑旧帖子不会重新上浮
- 与“最新发布内容中的搜索命中结果”语义一致

当前 Appwrite 原生查询也不提供可直接使用的相关性排序，因此第一版固定时间倒序是最稳定的方案。

### 为什么第一版不做 relevance merge

因为当前 Appwrite Databases 查询能力没有暴露：

- relevance score
- score-based order
- 多路召回后的原生相关性融合

如果本期强行做相关性 merge，只能走：

- 多次查询
- 应用层打分
- 应用层去重排序

这会显著提高复杂度，并直接影响 cursor 分页稳定性。

在当前项目阶段，更合适的取舍是：

- 先做稳定召回
- 先做稳定 URL 与分页
- 先做可复用瀑布流结果页
- 暂不追求专业搜索引擎级别的排序体验

## 实现顺序与依赖关系

### 第一步：补齐搜索结果专用数据层

任务：

- 在 `post.type.ts` 中增加搜索分页参数类型
- 在 `post.keys.ts` 中增加搜索结果专用 key
- 在 `post.api.ts` 中增加搜索结果分页 API
- 在 `post.service.ts` 中增加 `getSearchPostPage()`
- 在 `post.queries.ts` 中增加 `useSearchPostsInfiniteQuery()`

依赖：

- 依赖现有 `searchText` 字段和 full-text index 已存在
- 依赖首页瀑布流 view model 已经稳定

原因：

- 搜索结果页必须先有稳定分页数据来源

### 第二步：实现 `/search-result` 路由页面

任务：

- 新增 `app/routes/searchResult.tsx`
- 解析 `keyword`
- 派生页面级状态
- 接入 `MasonryFeed`
- 接入底部 sentinel 和分页状态区

依赖：

- 依赖第一步的搜索 infinite query 已完成

原因：

- 先让页面本身能通过 URL 独立工作，再接全局入口

### 第三步：改造 `Topbar` 为全局搜索入口

任务：

- 输入框受控化
- 提交校验
- 空值与短关键词 `toast`
- 提交后导航
- URL 回填输入框

依赖：

- 依赖 `/search-result` 路由路径已经稳定

原因：

- `Topbar` 需要一个真实存在的结果页目标来承接跳转

### 第四步：验证手动直访与异常边界

任务：

- 验证 `/search-result` 无 `keyword`
- 验证 `keyword` 少于 3 字符
- 验证空结果
- 验证首屏失败与翻页失败
- 验证浏览器前进后退后 Topbar 回填是否正确

依赖：

- 依赖页面和 Topbar 两端都已经接通

### 第五步：回归验证旧功能

任务：

- 验证首页瀑布流未受影响
- 验证资料页瀑布流未受影响
- 验证 `Explore` 旧搜索仍按原行为工作
- 验证发帖和编辑帖子后，`searchText` 仍正常写入

依赖：

- 依赖前面功能接通后完成

### 第六步：类型检查与最终验收

任务：

- 运行 `npm run typecheck`
- 手动验证搜索主链路
- 验证分页尾部状态与结束态

这是本期收口阶段。

## 关键风险及应对策略

### 风险：Appwrite `Query.search()` 的最小长度限制导致大量短词无法搜索

问题：

- 中文场景下，2 字词非常常见。
- `Query.search()` 至少 3 字符的限制会直接影响：
  - “自习”
  - “穿搭”
  - “摄影”
  等搜索词。

应对：

- 在 `Topbar` 提交时前端拦截并 `toast` 提示。
- 在 `/search-result` 路由页面中也做二次保护，避免用户手动访问短关键词 URL 时直接发请求。
- 在文档中明确这是第一版能力边界，而不是 bug。
- 如果后续产品不能接受，再评估：
  - `contains`
  - `contains + search`
  - 外部搜索引擎

### 风险：手动访问短关键词或空关键词 URL 时，页面状态和 toast 语义混乱

问题：

- 显式提交时需要 `toast`
- 但用户手动访问 URL 时，不应每次进入页面都自动弹 toast

应对：

- `toast` 只放在显式提交动作里。
- 结果页对无效 `keyword` 只展示空态 / 引导态，不自动提示 toast。
- 将“提交校验”和“页面兜底”分为两层职责。

### 风险：Topbar 输入框与 URL 状态不同步

问题：

- 用户搜索后再点浏览器后退
- 用户刷新结果页
- 用户直接粘贴带 `keyword` 的 URL

都可能让输入框与当前页面上下文不一致。

应对：

- 在搜索结果页上，以 URL 中的 `keyword` 作为输入框同步来源。
- 监听路由变化并在必要时覆盖本地输入状态。
- 不把“上次输入值”作为唯一真相来源。

### 风险：搜索结果页错误复用 Explore 旧网格契约，导致瀑布流卡片字段不足

问题：

- 旧 `PostGridItemViewModel` 不包含瀑布流卡片需要的字段。

应对：

- 搜索分页 API 直接使用首页 feed 的 `select` 契约。
- 搜索结果 service 直接返回 `HomeFeedPostViewModel` page。
- 避免在 route 层做字段拼装或临时补丁。

### 风险：修改旧搜索 query 造成 Explore 回归

问题：

- 如果直接把 `searchPostRows()` 改成 cursor 分页和瀑布流契约，Explore 旧功能会被迫跟着改。

应对：

- 本期新增独立搜索结果页链路。
- 旧 Explore 搜索链路保持不动。
- 等 Explore 后续改版时再统一清理旧实现。

### 风险：搜索分页过程中，由于数据变动导致重复或漏项

问题：

- 搜索结果按 `$createdAt desc` 分页，滚动过程中后台可能有新帖子插入。

应对：

- 第一版沿用当前项目既有 cursor pagination 模式。
- 接受极少量边界重复 / 漏项风险，不提前引入复杂去重逻辑。
- 如果后续真实出现明显重复，再在 route 或 service 层追加基于 `post.id` 的轻量去重。

### 风险：Appwrite 默认全文搜索语义对多关键词行为不够透明

问题：

- 第一版接受 Appwrite 默认行为，但官方文档没有把空格分隔多关键词的匹配语义讲得非常细。

应对：

- 本期明确把该行为视为底层能力边界。
- route / service 层只暴露单一 `keyword` 输入，不在第一版做自定义切词或语义补丁。
- 后续如需更可控语义，再演进为：
  - 自定义 token 规则
  - `contains + search`
  - 外部搜索引擎

### 风险：搜索体验缺少相关性排序，结果质量可能不如用户预期

问题：

- 当前只能按 `$createdAt desc` 排序。
- 更相关但更旧的内容可能排在较后位置。

应对：

- 在本期范围中明确“时间倒序优先”的产品取舍。
- 不把“相关性最好”作为第一版验收标准。
- 等搜索主链路稳定后，再评估：
  - 应用层打分
  - 外部搜索引擎同步

### 风险：历史帖子 `searchText` 不完整，导致结果缺失

问题：

- 如果早期数据或异常数据没有正确写入 `searchText`，则这些帖子不会被搜索到。

应对：

- 在上线前检查现有帖子数据质量。
- 如有需要，运行已有 backfill 脚本或补充一次搜索字段校验。
- 将“搜索依赖 `searchText` 完整性”作为上线检查项之一。

## 预期结果

本方案完成后，项目将具备一条清晰、可维护的搜索帖子主链路：

- 顶部栏成为真正的全局搜索入口。
- 搜索提交后进入独立的结果页 URL，而不是停留在页内即时过滤模型。
- 搜索结果页复用现有瀑布流卡片和无限滚动能力。
- 搜索数据层与 Explore 旧搜索解耦，降低回归风险。
- URL、Topbar 和结果页三者之间的状态关系保持明确。
- 方案完全基于当前项目已有的：
  - Appwrite `searchText`
  - React Query infinite query
  - Masonry feed
  - 全局 toast
  能力落地，不额外引入复杂基础设施。
