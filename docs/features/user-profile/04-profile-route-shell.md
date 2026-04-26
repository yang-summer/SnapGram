# 用户资料功能步骤四：重构资料页路由壳

## 目的

本步骤用于将当前占位的 `profile` 路由重构成真正可用的资料页壳路由。

经过前三步后，项目已经具备：

- 按 `profileId` 获取公开资料的用户契约
- 头像更新链路
- `posts / saved / liked` 三类 feed 与 count 数据层

但资料页目前仍缺少一个真正负责页面编排的父路由。当前的：

- `app/routes/profile.tsx`

仍只是占位实现，无法承担以下职责：

- 承载资料头
- 承载 tab 导航
- 渲染 tab 数量
- 处理 `/profile/:id` 到 `/profile/:id/posts` 的默认跳转
- 判断当前访问者是否为资料拥有者
- 拦截他人直访私有 tab
- 为子路由页面提供统一壳布局和 `Outlet`

本步骤的目标是：

- 将资料页改为标准的父子路由结构，而不是继续依赖 `profile/:id/*` 的占位页。
- 让 `profile.tsx` 成为真正的 layout-style route shell。
- 用一个显式的 index route 处理默认跳转，而不是在父组件里通过副作用重定向。
- 在父路由中尽早完成 owner / visitor 判断，避免子页面先发起私有 tab 数据请求后再跳转。
- 将资料头、tab、count 和 `Outlet` 的职责聚合到一个页面级 `profile` feature 中。
- 保持与当前项目架构一致：
  - 继续使用 React Query，而不是为单个页面引入 route loader 架构
  - 继续使用当前反馈组件体系
  - 继续由 `rootLayout` 的 `RequireAuth` 负责登录态守卫

本步骤不负责：

- `posts / saved / liked` tab 内容页的实际列表渲染
- 编辑资料页
- 缓存一致性处理

## 验收标准

本步骤完成后，应满足以下验收标准：

- `routes.ts` 中的资料页路由已改为显式嵌套路由结构，而不是继续只保留一个 `profile/:id/*` 占位入口。
- 资料页父路由 `profile.tsx` 能：
  - 读取 `profileId`
  - 获取公开资料
  - 获取当前 viewer
  - 判断是否本人主页
  - 渲染资料头、tab 导航、数量和 `Outlet`
- 访问 `/profile/:id` 时，会通过 index child route 重定向到 `/profile/:id/posts`。
- 本人访问资料页时：
  - 可以看到 `posts / saved / liked`
  - 三个 tab 都可进入
- 他人访问资料页时：
  - 只显示 `posts`
  - 不显示 `saved / liked`
- 非本人直访：
  - `/profile/:id/saved`
  - `/profile/:id/liked`
  会被立即重定向到 `/profile/:id/posts`
- 私有 tab 的越权重定向发生在父路由壳层，避免子路由先发请求再闪跳。
- 资料页父路由只负责资料头与 tab 导航所需的数据，不会提前把三个 tab 的 feed 都一起加载。
- `posts` 数量始终可用。
- `saved / liked` 数量只在本人主页场景下查询和展示。
- 资料不存在时，资料页会展示明确的 not found / empty state，而不是渲染一个坏掉的壳。
- 查询异常时，资料页壳会展示 query 级错误态；真正的路由级异常仍由 `ErrorBoundary` 承担。

## 改了什么，改在哪里

### 一、将 `routes.ts` 改成显式嵌套资料页路由

改动位置：

- `app/routes.ts`

当前项目的资料页路由是：

- `route('profile/:id/*', 'routes/profile.tsx')`

本步骤建议改为显式子路由结构，例如：

- 父路由：
  - `route('profile/:id', 'routes/profile.tsx', [...children])`
- 子路由：
  - `index('routes/profile.index.tsx')`
  - `route('posts', 'routes/profile.posts.tsx')`
  - `route('saved', 'routes/profile.saved.tsx')`
  - `route('liked', 'routes/profile.liked.tsx')`

这里不建议继续把所有子路径都隐藏在一个：

- `profile/:id/*`

里由父组件自己解析 pathname。

原因：

- React Router 官方文档已经明确支持在 `routes.ts` 中通过 `route(..., children)` 建立嵌套路由。
- 子路由显式声明后，路由结构、URL 语义和 `Outlet` 关系都更清晰。
- 后续 step 5 接入 tab 内容页时，路由模块边界会自然很多。

### 二、新增资料页 index route，专门负责默认跳转

建议新增：

- `app/routes/profile.index.tsx`

职责：

- 访问 `/profile/:id` 时，返回：
  - `<Navigate to="posts" replace />`

这里不建议把默认跳转逻辑写在：

- `profile.tsx` 的 `useEffect`
- 或父组件渲染分支中直接判断 pathname 后手动 `useNavigate`

原因：

- React Router 官方文档对 index route 的定位很明确：它就是父路由默认子页面。
- 用显式 index child route 做跳转，父壳组件可以保持纯粹，只处理 layout 和 guard。
- `replace` 语义也更符合“默认落到 posts，而不是新增一次无意义历史记录”。

### 三、让 `profile.tsx` 成为真正的 route shell

改动位置：

- `app/routes/profile.tsx`

本步骤中，`profile.tsx` 的职责应从占位页升级为资料页父壳。

建议职责包括：

- 读取 `params.id`
- 读取当前 viewer：
  - 复用 `useCurrentUserQuery()`
- 查询公开资料：
  - 复用步骤一补齐的 public profile 查询能力
- 查询 tab 数量：
  - `posts` 数量始终查询
  - `saved / liked` 数量仅在本人场景查询
- 判断：
  - `isOwner`
  - 当前激活 tab 是否为私有 tab
- 对越权访问执行重定向
- 渲染：
  - `ProfileHeader`
  - `ProfileTabs`
  - `Outlet`

这里不建议把 `posts / saved / liked` 的列表 query 也塞进父壳。

原因：

- 那会让父组件在初次渲染时一次性拉多个 tab 内容。
- 与总体设计中“只请求当前 tab 所需数据”的原则冲突。
- step 5 已经明确，feed 内容页应由各自子路由负责。

### 四、新增页面级 `profile` feature 承接壳层组件

建议新增：

- `app/features/profile`

建议至少包含：

- `components/ProfileHeader.tsx`
- `components/ProfileTabs.tsx`
- `components/ProfileRouteGuard.tsx`

视实现细节可补充：

- `components/ProfileCounts.tsx`
- `lib/profile-tabs.ts`

职责划分建议如下：

- `ProfileHeader`
  - 展示头像、名字、用户名、bio
  - 展示基础统计
  - 在本人主页场景展示 “Edit Profile” 入口
- `ProfileTabs`
  - 渲染可见 tab
  - 使用 `NavLink`
  - 显示 count
- `ProfileRouteGuard`
  - 输入：
    - `isOwner`
    - `profileId`
    - `activeTab`
  - 输出：
    - 正常渲染
    - 或 `<Navigate to={/profile/:id/posts} replace />`

这里不建议把这些页面编排逻辑继续塞进：

- `user.api.ts`
- `post.api.ts`
- `routes/profile.tsx` 一个超长文件

原因：

- 资料页壳天然是跨领域页面逻辑。
- 它既依赖用户资料，又依赖帖子 count 和路由状态。
- 单独建 `profile` feature 更符合当前项目分层，也能避免 route module 膨胀。

### 五、在父路由中只查询“壳层需要的数据”

改动位置：

- `app/routes/profile.tsx`
- `app/features/profile/components/*`

建议父壳只消费以下数据：

- 当前 viewer
- 公开资料
- `posts` count
- `saved` count（仅本人）
- `liked` count（仅本人）

不应在本步骤中于父壳层加载：

- `posts` feed
- `saved` feed
- `liked` feed

原因：

- 这些属于当前 tab 内容页的数据。
- 父壳只需要 header 和 tabs 所需的最小数据即可。
- 这样才能保持资料页首屏足够轻，避免免费版下不必要的读请求放大。

### 六、把 owner / visitor 判断提前到父壳，避免私有 tab 闪烁

改动位置：

- `app/routes/profile.tsx`
- `app/features/profile/components/ProfileRouteGuard.tsx`

本步骤必须明确一个实现原则：

- 私有 tab 越权判断应发生在父壳渲染 `Outlet` 之前

判断条件建议为：

- 当前 viewer 的 `profileId`
- 当前页面参数里的 `profileId`
- 当前激活 tab 是否是：
  - `saved`
  - `liked`

当：

- `!isOwner && activeTab in ['saved', 'liked']`

时，应直接：

- `<Navigate to={/profile/:id/posts} replace />`

这里不建议把私有 tab 的重定向逻辑完全下沉到：

- `profile.saved.tsx`
- `profile.liked.tsx`

原因：

- 如果子路由先执行，再判断越权，页面很容易先闪一下加载态，再跳回 posts。
- step 5 的私有子页会依赖 `likes / saves` 表，这些表是 owner-private；越权请求没有必要先发出去。

### 七、为资料页父路由补齐反馈态与边界

改动位置：

- `app/routes/profile.tsx`

建议沿用当前项目既有反馈组件：

- `PageLoadingState`
- `PageErrorState`
- `PageEmptyState`
- `RouteErrorState`

建议处理方式：

- 公开资料查询中：
  - pending：`PageLoadingState`
  - query error：`PageErrorState`
  - `profile === null`：`PageEmptyState`
- route module 级异常：
  - `ErrorBoundary` + `RouteErrorState`

这里不建议“查不到用户资料就直接抛异常交给 ErrorBoundary”。

原因：

- 资料不存在更接近产品态的 empty / not found，而不是技术异常。
- 真正的边界错误仍应保留给：
  - 路由参数缺失
  - 渲染异常
  - 非预期 throw

### 八、本步骤不提前实现 tab 内容页，但应为 step 5 预留稳定骨架

改动位置：

- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`

本步骤虽然不负责真正接入列表内容，但路由骨架应先稳定下来。

建议做法：

- 先创建这三个 route module
- 第一版可以保持最小占位或简单空壳
- step 5 再接入各自的 infinite query 和瀑布流内容

这样可以让第四步先把“路由结构和父子关系”定型，而不是等到第五步再一起重做路由。

## 为什么选择这个方案

### 为什么要把资料页改成显式父子路由

原因：

- React Router 官方文档明确支持在 `routes.ts` 中使用嵌套路由配置。
- 子路由会自然渲染到父路由的 `Outlet` 中。
- index route 也天然适合承载资料页默认 tab。

资料页当前恰好就是一个典型的“共享页头 + 可切换内容区”结构，因此显式父子路由是最自然的做法。

### 为什么默认跳转用 index route，而不是父组件副作用

原因：

- index route 的语义就是“父路由默认子页面”。
- 用它做 `/profile/:id -> /profile/:id/posts` 跳转，路由层次最清晰。
- 这也避免了在父组件里：
  - 手动读 pathname
  - `useEffect` 触发跳转
  - 初次渲染短暂出现空壳

### 为什么父壳只查 header 和 count，不查所有 tab 内容

原因：

- 当前项目运行在 Appwrite Cloud 免费版约束下。
- 如果父壳一次性把三个 tab 的内容都查出来，首屏读请求会被显著放大。
- 而用户一次只会真正看到一个 tab。

因此这一步应坚持：

- 父壳负责 layout 数据
- 子页负责当前 tab 列表数据

### 为什么 owner / visitor 判断必须在父壳层完成

原因：

- 资料页的私有性不是 tab 内容本身的局部问题，而是整个路由访问控制问题。
- 父壳比子页更早拿到：
  - route params
  - current viewer
  - active child path

在父壳层做 guard 可以确保：

- 私有 tab 不会短暂渲染
- 私有 tab 不会先发请求再跳转
- tab 导航可见范围和真实可访问范围一致

### 为什么继续使用 React Query，而不是引入 route loader

原因：

- 当前项目已有明确的数据访问架构：
  - api
  - service
  - mapper
  - query hooks
  - route / component
- `rootLayout` 和其他页面也都是围绕 React Query 组织的。
- 只为了资料页一个模块切到 loader-first，会造成架构风格混用。

因此本步骤更合理的选择是：

- 路由负责页面结构
- 数据继续走现有 React Query 体系

### 为什么要引入 `app/features/profile`

原因：

- 资料页同时依赖：
  - user 资料
  - post count
  - engagement count
  - route state
- 这类编排逻辑不属于单一领域 feature。

把它收敛到页面级 `profile` feature，可以避免两种坏结果：

- 把 UI 组件和路由判断逻辑塞进 route module
- 把页面逻辑错误地下沉到 `user` 或 `post` 领域层

## 实现顺序与依赖关系

### 第一步：先稳定资料页嵌套路由结构

操作：

- 更新 `app/routes.ts`
- 新增 index child route
- 新增 `posts / saved / liked` 三个子 route module 骨架

依赖：

- 依赖 React Router 当前 `routes.ts` 配置体系

### 第二步：把 `profile.tsx` 改造成真正父壳

操作：

- 读取 `profileId`
- 接入当前 viewer
- 接入公开资料查询
- 接入 count 查询
- 渲染 `Outlet`

依赖：

- 依赖步骤一的嵌套路由已建立
- 依赖步骤一和步骤三的数据契约已可用

### 第三步：抽出页面级 `profile` feature 组件

操作：

- 新增 `ProfileHeader`
- 新增 `ProfileTabs`
- 新增 `ProfileRouteGuard`

依赖：

- 依赖第二步父壳的最小数据流已经清晰

### 第四步：接入 index redirect 与私有 tab redirect

操作：

- 在 `profile.index.tsx` 中实现默认跳转
- 在父壳中接入 private tab guard

依赖：

- 依赖步骤一的 route tree
- 依赖步骤二当前 viewer 和 params 已可用

### 第五步：补齐反馈态与错误边界

操作：

- 父壳 query loading/error/empty state
- `profile.tsx` 的 route `ErrorBoundary`

依赖：

- 依赖第二步壳层数据流已稳定

### 第六步：为 step 5 的 tab 内容页接入做准备

操作：

- 保证子路由模块和 `Outlet` 边界稳定
- 保证私有 tab 在父壳层已被 guard

依赖：

- 依赖前五步完成

本步骤完成后，step 5 可以直接在：

- `profile.posts.tsx`
- `profile.saved.tsx`
- `profile.liked.tsx`

中接入真正的分页与瀑布流内容，而不需要再改路由壳结构。

## 关键风险及应对策略

### 风险：父壳与子页职责混乱，导致后续继续返工

问题：

- 如果父壳把 feed 内容也一起查了，step 5 会很难再把 tab 内容拆回子页。

应对：

- 在本步骤明确约束：
  - 父壳只负责资料头、tabs、counts、guard、Outlet
  - tab feed 只在子页加载

### 风险：继续沿用 `profile/:id/*`，后续子路由边界不清晰

问题：

- 如果不改成显式 children route，路由语义会持续模糊。

应对：

- 在 `routes.ts` 中显式声明嵌套 child routes
- 父壳通过 `Outlet` 承载内容区

### 风险：私有 tab 越权重定向发生太晚，出现闪烁或无权限请求

问题：

- 子页若先渲染，再发现无权限并跳转，体验会明显不稳定。

应对：

- 将私有 tab guard 提前到父壳
- 父壳在 `Outlet` 渲染前就决定是否重定向

### 风险：资料不存在时仍然渲染壳布局，产生坏状态

问题：

- 如果 profile 查询返回 `null`，但壳仍继续渲染 header/tabs，会出现空对象依赖问题。

应对：

- 将“资料是否存在”作为父壳首要判定条件
- `null` 时直接返回明确 empty / not found state

### 风险：访客场景仍然查询私有 count，浪费请求

问题：

- 他人主页根本不会展示 `saved / liked`

应对：

- `saved / liked` count query 仅在 `isOwner` 时启用
- 访客只查询公开资料和 `posts` count

### 风险：父壳再次实现一套独立 auth 守卫，与 `RequireAuth` 重叠

问题：

- 当前 `rootLayout` 已经统一处理 guest / profile_missing

应对：

- 本步骤不再复制登录态守卫
- 父壳直接复用已缓存的 `useCurrentUserQuery()` 结果，只做 owner / visitor 判断

### 风险：index redirect 使用副作用实现，导致历史栈和首帧行为不稳定

问题：

- 父组件副作用跳转通常会先渲染一次空白或壳体

应对：

- 使用显式 index route + `<Navigate replace />`
- 让默认子路由成为路由配置的一部分

## 预期结果

本步骤完成后，资料页将从一个占位页面升级为真正的路由壳：

- `/profile/:id` 会稳定落到 `/profile/:id/posts`
- 父路由能渲染资料头、tab 栏、数量和内容区 `Outlet`
- 本人和访客看到的 tab 范围不同，越权重定向清晰且无明显闪烁
- 父壳只加载最小必要数据，为后续 tab 内容页保留干净边界

这样 step 5 接入三个 tab 的列表页面时，只需要关注 feed 内容本身，而不需要再回头重做资料页的路由结构与父级编排。
