# 帖子详情模态框路由改造方案（上下文子路由）

## 现状

当前帖子详情模态框路由使用的是“统一详情 URL + 背景页快照”的方案。

当前核心实现：

- 统一详情页路径仍然是 `/posts/:id`
- 帖子卡片点击时写入 `location.state.backgroundLocation`
- 根布局 `app/layouts/rootLayout.tsx` 使用 `useOutlet()` 缓存背景页 `outlet`
- 根布局通过 `UNSAFE_LocationContext` 把背景页伪装成仍处于旧 location
- `app/routes/postDetails.tsx` 根据运行态决定渲染 modal 还是独立详情页

当前相关文件：

- `app/routes.ts`
- `app/layouts/rootLayout.tsx`
- `app/routes/postDetails.tsx`
- `app/routes/home.tsx`
- `app/routes/searchResult.tsx`
- `app/routes/profile.tsx`
- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`
- `app/features/post/components/MasonryPostCard.tsx`
- `app/features/post/components/GridPostList.tsx`
- `app/features/post/components/PostCard.tsx`
- `app/features/post/lib/post-detail-navigation.ts`
- `app/features/post/lib/post-detail-modal-runtime.tsx`

当前问题与约束：

- 现有方案依赖 `UNSAFE_LocationContext`，属于内部 API，升级兼容性存在风险
- 根布局承担了“背景页冻结 + location 劫持 + modal host”三层职责，复杂度偏高
- 直达、刷新、会话恢复时，需要额外防御旧 history state 导致的 modal 误触发
- 当前 `home` 是 index route，天然不适合作为带子路由的上下文页
- 当前 `explore` 页面可以移除，不再要求保留

## 目标

本次改造目标：

- 移除 `UNSAFE_LocationContext`
- 不使用内部 API 或 unstable API
- 保留独立详情页 `/posts/:id`
- 列表页内打开详情时仍显示 modal
- 直接访问上下文子路由时，使用 `replace` 跳转到独立详情页 `/posts/:id`
- 关闭 modal 时明确回到所属上下文页，不依赖 `navigate(-1)`
- 保持 Home、Search Result、Profile tabs 三类入口的行为一致

本次方案不追求：

- 地址栏始终保持统一详情 URL `/posts/:id` 的产品效果
- 复制“小红书资料页打开但 URL 仍是 explore”的行为
- 保留现有基于背景页快照的全局 modal host 实现

## 改了什么，改在哪里

### 1. 路由树改成“canonical 详情页 + 上下文子路由”

核心思路：

- `/posts/:id` 继续作为唯一独立详情页
- 列表上下文各自拥有自己的帖子子路由
- modal 只在这些上下文子路由内出现
- 直接访问这些上下文子路由时，重定向到 `/posts/:id`

建议路由树：

```ts
layout('layouts/rootLayout.tsx', [
  index('routes/rootRedirect.tsx'),
  route('feed', 'routes/feed.tsx', [
    route('posts/:postId', 'routes/feed.post.tsx'),
  ]),
  route('search-result', 'routes/searchResult.tsx', [
    route('posts/:postId', 'routes/searchResult.post.tsx'),
  ]),
  route('posts/:id', 'routes/postDetails.tsx'),
  route('profile/:id', 'routes/profile.tsx', [
    index('routes/profile.index.tsx'),
    route('posts', 'routes/profile.posts.tsx', [
      route(':postId', 'routes/profile.posts.post.tsx'),
    ]),
    route('saved', 'routes/profile.saved.tsx', [
      route(':postId', 'routes/profile.saved.post.tsx'),
    ]),
    route('liked', 'routes/profile.liked.tsx', [
      route(':postId', 'routes/profile.liked.post.tsx'),
    ]),
  ]),
  route('update-profile/:id', 'routes/updateProfile.tsx'),
])
```

说明：

- `home` 从 index route 迁移为显式的 `/feed`
- `/` 改为 `replace` 到 `/feed`
- `explore` 页面下线，必要时可临时 `replace` 到 `/feed`
- `search-result` 保留 query `keyword`
- profile 三个 tab 各自拥有自己的 modal 子路由

对应文件：

- `app/routes.ts`
- 新增 `app/routes/rootRedirect.tsx`
- `app/routes/home.tsx` 迁移或重命名为 `app/routes/feed.tsx`
- 新增：
  - `app/routes/feed.post.tsx`
  - `app/routes/searchResult.post.tsx`
  - `app/routes/profile.posts.post.tsx`
  - `app/routes/profile.saved.post.tsx`
  - `app/routes/profile.liked.post.tsx`

### 2. 删除根布局里的全局 modal host 逻辑

`app/layouts/rootLayout.tsx` 回归普通 app shell，不再负责：

- 背景页快照缓存
- `UNSAFE_LocationContext` 注入
- 详情 modal 的全局叠加宿主
- 帖子详情运行态判定

这部分逻辑全部从根布局移除。

对应文件：

- `app/layouts/rootLayout.tsx`
- 删除或下线：
  - `app/features/post/lib/post-detail-navigation.ts`
  - `app/features/post/lib/post-detail-modal-runtime.tsx`

### 3. 为每个上下文页增加最小路由运行态 Provider

需要新增一个很小的上下文层，例如：

- `app/features/post/lib/contextual-post-route.tsx`

职责：

- 为当前页面实例生成一个运行时 `contextId`
- 暴露当前上下文的 modal route 构造能力
- 暴露关闭 modal 后应返回的确定性 URL

建议的最小 state 约定：

```ts
type ContextualPostModalState = {
  kind: 'context-post-modal';
  source: 'feed' | 'search-result' | 'profile-posts' | 'profile-saved' | 'profile-liked';
  contextId: string;
};
```

建议暴露的上下文能力：

- `buildPostHref(postId: string): string`
- `modalState: ContextualPostModalState`
- `closeTo: string`

作用：

- 卡片组件不再自己推导 modal 链接
- 子路由不再相信任意 `location.state`
- 只要 `contextId` 与当前运行态不匹配，就认定为直达/刷新/恢复场景，重定向到 `/posts/:id`

### 4. 列表页负责“列表 + Outlet”，子路由负责 modal

父页面改造原则：

- 继续渲染列表内容
- 在内容区末尾渲染 `<Outlet />`
- 用上下文 Provider 包住列表和 `<Outlet />`

对应页面：

- `app/routes/feed.tsx`
- `app/routes/searchResult.tsx`
- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`

其中：

- `searchResult.tsx` 需要在现有内容后追加 `<Outlet />`
- `profile.posts.tsx` / `saved.tsx` / `liked.tsx` 需要从叶子内容页升级为“内容页 + 子路由容器”

### 5. 子路由组件只做两件事：判定是否合法、渲染 modal 或重定向

每个 `*.post.tsx` 子路由的职责：

1. 读取 `postId`
2. 判断当前 `location.state` 是否为当前页面实例发起的合法 modal 导航

如果合法：

- 渲染 `PostDetailsModalShell`
- 使用共享的详情内容组件，例如现有 `PostDetailsContent`
- 关闭时 `navigate(closeTo, { replace: true })` 或普通 `navigate(closeTo)`

如果不合法：

- 渲染 `<Navigate to={`/posts/${postId}`} replace />`

这里不使用 loader 做重定向，原因是 loader 无法读取浏览器 history entry 里的 `location.state`。判定必须发生在组件运行时。

对应文件：

- `app/routes/feed.post.tsx`
- `app/routes/searchResult.post.tsx`
- `app/routes/profile.posts.post.tsx`
- `app/routes/profile.saved.post.tsx`
- `app/routes/profile.liked.post.tsx`

### 6. 卡片组件不再直接链接到 `/posts/:id`

当前卡片组件：

- `app/features/post/components/MasonryPostCard.tsx`
- `app/features/post/components/GridPostList.tsx`
- `app/features/post/components/PostCard.tsx`

现状：

- 组件内部使用 `useLocation()`
- 直接构造 `/posts/:id`
- 同时写入 `backgroundLocation`

改造后：

- 卡片通过 `useContextualPostRoute()` 获取上下文链接与 state
- 在上下文页内跳向对应子路由
- 不在上下文页内时，回退到 `/posts/:id`
- 不再携带 `backgroundLocation`

### 7. 保留独立详情页，继续复用详情内容组件

`app/routes/postDetails.tsx` 继续作为独立详情页。

建议保留并复用：

- `PostDetailsContent`
- 请求逻辑
- 删除逻辑
- 空态、错误态、加载态

建议拆出或保留两个壳：

- `PostDetailsPageShell`
- `PostDetailsModalShell`

这样上下文子路由和独立详情页共享数据与内容，只分离展示壳。

### 8. 调整导航与激活态

因为 `home` 迁移到 `/feed`，需要同步更新：

- `app/components/shared/LeftSidebar.tsx`
- `app/components/shared/Bottombar.tsx`
- `app/components/shared/Topbar.tsx`

具体调整：

- 首页导航目标从 `/` 改成 `/feed`
- Logo 仍可保留跳 `/`，再由 `/` 重定向到 `/feed`
- Search 页激活判断不能再只做 `pathname === '/search-result'`
- Profile tab 和 Profile 父壳的活跃态判断需要兼容更深层的 `/:postId`

例如：

- `/profile/:id/posts/:postId` 仍然应高亮 `Posts`
- `/search-result/posts/:postId?keyword=...` 仍然应视为搜索结果上下文

## 为什么选择这个方案

### 1. 只依赖稳定公开 API

本方案只依赖 React Router v7 的稳定公开能力：

- 嵌套路由
- `Outlet`
- `Link state`
- `useLocation`
- `useNavigate`
- `Navigate`

不再依赖：

- `UNSAFE_LocationContext`
- route masking
- unstable API

### 2. 背景页天然仍在当前匹配树中

当前方案最大的问题是：

- URL 进入 `/posts/:id` 后，列表页已经不再匹配
- 但 UI 还想保留列表作为背景

这才导致必须手动缓存旧 `outlet` 并篡改 location context。

上下文子路由方案不会出现这个问题：

- `/feed/posts/:id` 时，`/feed` 仍然匹配
- `/profile/:id/posts/:postId` 时，`/profile/:id/posts` 仍然匹配
- 背景页不是“快照”，而是当前路由树中正常存在的父页面

### 3. 直达行为简单、确定

本方案明确规定：

- 直达上下文子路由，不显示 modal
- 一律 `replace` 到 `/posts/:id`

好处：

- 只有一个真正的独立详情 URL
- 不需要支持多个详情 canonical URL
- 不会让 `saved`、`liked` 这类关系型上下文变成可独立索引的详情地址

### 4. 关闭行为不依赖 history 回退

当前 `navigate(-1)` 在这些场景下不稳定：

- 外部直达
- 刷新后恢复
- 跨标签页
- history 栈混入其他页面

本方案为每个上下文提供明确的 `closeTo`：

- feed -> `/feed`
- search result -> `/search-result?keyword=...`
- profile posts -> `/profile/:id/posts`
- profile saved -> `/profile/:id/saved`
- profile liked -> `/profile/:id/liked`

关闭目标明确，可测试性更强。

### 5. 复杂度从“全局路由劫持”降到“局部父子路由”

当前方案的复杂度集中在 root layout。

新方案把复杂度分散为：

- 父页面负责列表与 `Outlet`
- 子页面负责 modal 或 redirect

结构更接近 React Router 原生心智模型，更容易维护。

## 实现顺序与依赖关系

### 第一步：确定路由目标结构

任务：

- 明确 `/feed` 替代当前首页 index route
- 确认 `explore` 下线
- 确认各上下文 modal URL 结构

产出：

- 更新后的 `app/routes.ts` 设计

依赖：

- 无

### 第二步：引入 `/feed`，保留 `/` 到 `/feed` 的兼容跳转

任务：

- 将当前 `home` 内容迁移到 `/feed`
- 新增 `rootRedirect.tsx`
- 调整侧边栏、底部导航、Logo 与首页激活逻辑

依赖：

- 依赖第一步的路由设计已确定

### 第三步：新增上下文路由运行态 Provider

任务：

- 新增 `contextual-post-route.tsx`
- 定义 `ContextualPostModalState`
- 封装 `buildPostHref`、`modalState`、`closeTo`

依赖：

- 依赖第一步的上下文 URL 结构已确定

### 第四步：让列表父页承载 `<Outlet />`

任务：

- 改造 `feed.tsx`
- 改造 `searchResult.tsx`
- 改造 `profile.posts.tsx`
- 改造 `profile.saved.tsx`
- 改造 `profile.liked.tsx`

依赖：

- 依赖第三步的 Provider 已可用

### 第五步：新增各上下文子路由组件

任务：

- 实现 `feed.post.tsx`
- 实现 `searchResult.post.tsx`
- 实现 `profile.posts.post.tsx`
- 实现 `profile.saved.post.tsx`
- 实现 `profile.liked.post.tsx`

要求：

- 合法上下文导航 -> modal
- 非法/直达/刷新 -> `replace` 到 `/posts/:id`

依赖：

- 依赖第四步父页已提供 Provider 与 `Outlet`

### 第六步：改造帖子卡片链接入口

任务：

- 改造 `MasonryPostCard.tsx`
- 改造 `GridPostList.tsx`
- 改造 `PostCard.tsx`
- 删除对 `backgroundLocation` 的依赖

依赖：

- 依赖第三步 Provider
- 依赖第五步子路由已存在

### 第七步：删除旧的全局 modal route 逻辑

任务：

- 清理 `rootLayout.tsx` 中的 modal host
- 删除 `post-detail-navigation.ts`
- 删除 `post-detail-modal-runtime.tsx`
- 清理不再使用的 `backgroundLocation` 类型与辅助函数

依赖：

- 依赖前六步已全部接通

### 第八步：回归测试

任务：

- `/` 是否稳定进入 `/feed`
- feed 打开 / 关闭 modal
- search result 打开 / 关闭 modal，并保留 `keyword`
- profile posts / saved / liked 打开 / 关闭 modal
- 直接访问所有上下文子路由是否 `replace` 到 `/posts/:id`
- 直接访问 `/posts/:id` 是否始终为独立详情页
- 删除帖子后跳转行为是否仍符合预期

依赖：

- 前面所有步骤完成

## 关键风险及应对策略

### 风险 1：首页从 `/` 迁移到 `/feed` 影响现有导航和习惯

问题：

- 当前首页是 index route
- 导航和激活态大量依赖 `'/'`

应对：

- 保留 `/` -> `/feed` 的 `replace` 跳转
- 导航组件只把 `/feed` 视作首页激活路径
- 逐步把代码中的首页硬编码从 `'/'` 调整为 `'/feed'`

### 风险 2：Search Result 的 `keyword` 在关闭 modal 时丢失

问题：

- search 页面依赖 query `keyword`
- 如果关闭时只回 `/search-result`，会丢掉上下文

应对：

- Provider 中显式保存 `closeTo`
- `closeTo` 始终带完整 query string

### 风险 3：刷新后仍被误判为 modal

问题：

- 浏览器可能保留旧 history state

应对：

- state 中带 `contextId`
- 只有当 `contextId` 与当前页面实例一致时才视为 modal
- 不一致则直接 `replace` 到 `/posts/:id`

### 风险 4：Profile tab 激活态在嵌套更深子路由时失效

问题：

- 当前 `profile.tsx` 里的 `useMatch` 是精确匹配
- 新增 `/:postId` 后，精确判断会失真

应对：

- 用通配匹配 `/profile/:id/posts/*`
- 或把 tab 激活逻辑收敛到 `NavLink` 自身

### 风险 5：会出现多份相似的 modal route 组件

问题：

- `feed.post.tsx`
- `searchResult.post.tsx`
- `profile.posts.post.tsx`
- `profile.saved.post.tsx`
- `profile.liked.post.tsx`

表面上路径不同，但行为高度相似。

应对：

- 抽共享的 modal route 工厂或基础组件
- 公共部分只保留：
  - 校验逻辑
  - 数据读取逻辑
  - `PostDetailsModalShell`
  - redirect 逻辑

### 风险 6：过早删除旧方案导致中间阶段不可用

问题：

- 如果先删根布局 modal host，再改卡片和子路由，页面会出现行为断档

应对：

- 严格按迁移顺序推进
- 新方案接通前不删除旧逻辑
- 最后一步再下线旧实现

## 参考

- React Router Routing: https://reactrouter.com/start/framework/routing
- React Router Outlet: https://reactrouter.com/api/components/Outlet
- React Router Link: https://reactrouter.com/api/components/Link
- React Router useLocation: https://reactrouter.com/api/hooks/useLocation
- React Router useNavigate: https://reactrouter.com/api/hooks/useNavigate
- React Router Navigate: https://reactrouter.com/api/components/Navigate
