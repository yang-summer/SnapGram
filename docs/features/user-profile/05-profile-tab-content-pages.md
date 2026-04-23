# 用户资料功能步骤五：接入三个 tab 内容页

## 目的

本步骤用于将资料页三个子路由真正接入可用的内容页，实现：

- `posts`
- `saved`
- `liked`

三个 tab 的分页加载、瀑布流渲染和页面状态管理。

经过前三步和第四步后，项目已经具备或将具备：

- 资料页父壳路由与 `Outlet`
- `posts / saved / liked` 对应的数据层与 count 查询能力
- `MasonryFeed` / `MasonryPostCard` 这套可复用的瀑布流卡片体系
- 首页与探索页已经验证过的 infinite query + sentinel + 底部状态区模式

但当前项目仍缺少“资料页子路由内容层”本身，也就是：

- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`

这三个页面真正如何消费 query hook、如何统一渲染瀑布流、如何区分首屏状态与后续分页状态、以及如何处理 `saved / liked` 中因脏互动记录导致的“当前页没有可见卡片但仍然存在下一页”的情况。

本步骤的目标是：

- 让三个 tab 分别接入自己的 infinite query。
- 继续复用现有 `MasonryFeed`，不为资料页重造卡片系统。
- 将页面级状态拆分清楚：
  - 首次加载
  - 首次阻塞错误
  - 整体空态
  - 正常内容
  - 后续分页加载中
  - 后续分页失败
  - 已到末尾
- 保证 `saved / liked` 在遇到已删除帖子造成的空页时，不会被误判为空态。
- 让三个子页只负责“当前 tab 内容”，不重复承担资料页壳、权限守卫和 tab count 职责。

本步骤不负责：

- 资料页壳路由与 tab 导航
- 私有 tab 的 owner / visitor 越权跳转策略本身
- 编辑资料页
- count 数据层

本步骤只负责“子路由内容页”的最终接入。

## 验收标准

本步骤完成后，应满足以下验收标准：

- `app/routes/profile.posts.tsx` 已接入：
  - `useProfilePostsInfiniteQuery()`
- `app/routes/profile.saved.tsx` 已接入：
  - `useProfileSavedFeedInfiniteQuery()`
- `app/routes/profile.liked.tsx` 已接入：
  - `useProfileLikedFeedInfiniteQuery()`
- 三个 tab 页面不再是占位实现。
- 三个 tab 页面都会将 `data.pages` 拍平成单一 `items` 数组，再交给 `MasonryFeed`。
- 三个 tab 页面使用统一的页面级状态语义，而不是各自写一套不同判断。
- `posts` tab 为公开内容页：
  - 不依赖私有互动权限
- `saved / liked` tab 不重复实现 owner / visitor 权限判断：
  - 默认依赖第四步父壳的 route guard
- 任何一个 tab 在首次请求期间且当前没有可显示卡片时：
  - 显示内容区级 loading state
- 任何一个 tab 在首次请求失败，或“自动跳过空页”过程中最终失败且当前仍没有可显示卡片时：
  - 显示内容区级 error state
  - 提供重试能力
- 任何一个 tab 在已确定没有更多页且仍然没有任何可显示卡片时：
  - 才显示整体空态
- 已有内容后再请求下一页失败时：
  - 已加载内容必须保留
  - 页面底部只显示 load-more error，不覆盖整个内容区
- 页面底部存在单独的分页状态区，支持：
  - 正在加载更多
  - 加载更多失败后的手动重试
  - 没有更多内容
- 页面底部存在 sentinel，用于自动请求下一页。
- sentinel 自动加载必须满足：
  - 当前 tab 已有可见内容
  - `hasNextPage === true`
  - 当前不在 `isFetchingNextPage`
  - 当前不处于“等待手动重试”的分页失败状态
- `saved / liked` 若出现“某一页互动记录全部失效，导致 `items.length === 0` 但 `nextCursor !== null`”时：
  - 页面不会立即显示空态
  - 当当前总可见内容仍为 0 时，会继续自动请求后续页，直到：
    - 拿到可见卡片
    - 或确认没有下一页
    - 或遇到错误
- 三个 tab 内容页不重复请求：
  - 当前用户 query
  - 公开资料 query
  - tab count query
- 路由切换后，只有当前 tab 对应的 infinite query 会发起内容请求，不会一次性并行拉取三个 tab 的列表内容。

## 改了什么，改在哪里

### 一、补齐父壳到子页的最小上下文传递

改动位置：

- `app/routes/profile.tsx`
- 建议新增：`app/features/profile/types/profile-route.type.ts`

本步骤建议由资料页父壳通过 `Outlet context` 向子路由暴露最小必要信息，例如：

- `profileId`
- `isOwner`
- `profileName`

这里不建议让三个子页各自重复请求：

- `useCurrentUserQuery()`
- 公开资料 query

原因：

- 这些数据在第四步父壳中本来就已经存在。
- 子页真正需要的是“当前 tab 的 feed 查询参数”，而不是再次拼装资料页壳数据。
- 这样可以减少重复 Appwrite reads，也能避免三个子页的页面文案和 owner 判定各自漂移。

### 二、为三个 tab 抽出共用的分页状态处理

建议新增：

- `app/features/profile/hooks/useProfileInfiniteFeedState.ts`

职责：

- 统一拍平 `data.pages`
- 统一派生页面级状态
- 统一派生底部分页状态
- 统一处理“空页但仍有下一页”的自动补翻页逻辑

建议输入：

- infinite query 返回值本身
- 当前 tab 的空态文案配置

建议输出：

- `items`
- `isInitialLoading`
- `isInitialError`
- `initialError`
- `isEmpty`
- `isLoadingMore`
- `isLoadMoreError`
- `isEndReached`
- `loadMoreRef`
- `retryInitial()`
- `retryLoadMore()`

这里建议把共用逻辑集中，而不是让三个 route module 各自复制一份状态机。

原因：

- 三个 tab 的分页状态结构高度一致。
- 真正复杂的地方不是 query hook 名称，而是：
  - 首屏和翻页状态分层
  - 稀疏空页自动补翻
  - 空态和错误态的边界
- 这些逻辑一旦复制三份，后续非常容易出现某个 tab 行为和另外两个不一致。

### 三、新增资料页 tab 内容区共用渲染组件

建议新增：

- `app/features/profile/components/ProfileFeedTabContent.tsx`

必要时可拆分：

- `app/features/profile/components/ProfileFeedLoadMoreState.tsx`

职责：

- 接收已经归一化的状态和 `items`
- 渲染：
  - `PageLoadingState`
  - `PageErrorState`
  - `PageEmptyState`
  - `MasonryFeed`
  - 底部分页状态区
  - 底部 sentinel

建议这个组件保持“表现层”职责，不自己发 query，不自己做 owner 判定。

这里不建议三个 route module 都直接内联同样的 UI 分支。

原因：

- 资料页三个 tab 的内容布局、反馈态和底部状态区几乎完全一致。
- 路由文件更适合只做：
  - 取路由上下文
  - 调对应 tab 的 query hook
  - 传空态文案配置

### 四、接入 `posts` 子路由内容页

改动位置：

- `app/routes/profile.posts.tsx`

本步骤中，`posts` 页负责：

- 从父壳 `Outlet context` 或 `params` 读取 `profileId`
- 调用：
  - `useProfilePostsInfiniteQuery(profileId)`
- 将 query 结果交给共用的 feed 状态 hook / 内容组件

`posts` 是三个子页里最简单的一条路径。

建议它作为这一步的第一个落地页面。

空态建议区分两种文案：

- 本人主页：
  - `You haven't posted anything yet.`
- 访客视角：
  - `This profile hasn't published any posts yet.`

这里不建议为 `posts` 再单独做一套列表组件。

原因：

- `posts` 本质上就是 profile 场景下的公开瀑布流。
- 现有 `MasonryFeed` 已满足布局需求。

### 五、接入 `saved` 子路由内容页

改动位置：

- `app/routes/profile.saved.tsx`

本步骤中，`saved` 页负责：

- 读取父壳传下来的 `profileId`
- 调用：
  - `useProfileSavedFeedInfiniteQuery(profileId)`
- 复用共用的状态 hook 和内容组件

这里有一个必须明确写进实现要求的点：

- `saved` 页不能把“当前请求页为空”直接等价成“整个 tab 为空”

原因：

- 第三步已经明确，`saved` 以互动记录分页，再回查帖子。
- 当前页互动记录可能全部指向已删除帖子。
- 因此会出现：
  - 当前返回页 `items.length === 0`
  - 但 `nextCursor !== null`

此时正确行为是：

- 若当前总可见内容仍为 0，则继续自动请求下一页
- 只有在：
  - 总可见内容仍为 0
  - 且 `hasNextPage === false`
  时，才显示真正空态

### 六、接入 `liked` 子路由内容页

改动位置：

- `app/routes/profile.liked.tsx`

`liked` 与 `saved` 的页面组织方式应保持一致。

职责：

- 读取 `profileId`
- 调用：
  - `useProfileLikedFeedInfiniteQuery(profileId)`
- 复用共用的状态 hook 和内容组件

要求：

- 不重复复制 `saved` 页的分页状态判断代码
- 不单独请求当前用户或公开资料
- 不在子页自己做越权跳转

原因：

- 它和 `saved` 的区别只在 query hook 与文案，不在页面状态机

### 七、统一“首屏状态”和“尾部分页状态”的判断口径

改动位置：

- `app/features/profile/hooks/useProfileInfiniteFeedState.ts`
- 或 route module 内的共用 helper

本步骤建议显式派生以下语义状态：

- `hasVisibleItems`
- `isInitialLoading`
- `isInitialError`
- `isEmpty`
- `isLoadingMore`
- `isLoadMoreError`
- `isEndReached`

其中最关键的判断口径建议为：

- `hasVisibleItems`
  - 已拍平后的 `items.length > 0`
- `isInitialLoading`
  - 当前没有可见卡片
  - 且正在首屏请求或正在自动补翻空页
- `isInitialError`
  - 当前没有可见卡片
  - 且首屏 query 失败，或自动补翻空页失败
- `isEmpty`
  - 当前没有可见卡片
  - 且没有下一页
  - 且当前不在 loading / error
- `isLoadingMore`
  - 已有内容
  - 且正在请求下一页
- `isLoadMoreError`
  - 已有内容
  - 且下一页请求失败
- `isEndReached`
  - 已有内容
  - 且没有下一页
  - 且当前不在请求下一页

这里不建议继续沿用“`isError` 就显示整页错误”这种扁平判断。

原因：

- 资料页和首页一样，分页状态是分层的。
- 尤其 `saved / liked` 存在“无可见内容但仍应继续翻页”的特殊情况。

### 八、在内容页中补齐 sentinel 自动加载策略

改动位置：

- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`
- 或共用 hook 内部

建议复用当前首页模式：

- `react-intersection-observer`
- `useInView({ rootMargin: '400px 0px' })`

自动加载建议拆成两类：

1. 正常内容场景下的 sentinel 自动加载
2. 当前无可见卡片但仍有下一页时的“自动补翻空页”

其中：

- 正常内容场景通过 sentinel 驱动
- 空页补翻不依赖 sentinel，而应直接在 effect 中自动触发

这样可以避免出现：

- 页面没有任何可见内容
- 但因为 sentinel 根本不在视口逻辑中，被卡死在“既不显示空态，也不继续加载”的坏状态

## 为什么选择这个方案

### 为什么三个 tab 要分别使用自己的子路由内容页

原因：

- 资料页三个 tab 虽然都显示帖子卡片，但数据来源不同：
  - `posts` 来自公开帖子
  - `saved` 来自收藏互动流水
  - `liked` 来自点赞互动流水
- 三者分页 key、空态文案和错误上下文都不同。
- 用显式子路由承接内容页，既符合第四步的路由结构，也最容易隔离各自状态。

### 为什么内容页不应回到父壳统一请求

原因：

- 当前项目运行在 Appwrite Cloud 免费版约束下。
- 用户一次只会真正看到一个 tab。
- 如果父壳一次性把三个 tab 都查出来，会放大：
  - 读请求
  - 返回体积
  - 页面状态复杂度

因此这一步必须坚持：

- 父壳负责 header / tabs / counts / guard
- 子页负责当前 tab 的 feed 内容

### 为什么要抽共用的 feed 状态 hook / 内容组件，而不是复制三份

原因：

- 三个 tab 的真正差异只有：
  - query hook
  - 空态文案
- 它们共享的是更难写对的部分：
  - 首屏状态与尾部分页状态拆分
  - 自动翻过空页
  - 保留已有内容时的分页失败处理

这里抽一个共用 hook 和一个共用内容组件，是最小且必要的抽象。

它不会引入额外领域层，也不会制造复杂泛型体系，但能显著降低复制粘贴和行为漂移风险。

### 为什么“空页但还有下一页”要在页面层自动继续翻

原因：

- 这是 `saved / liked` 当前数据模型天然会出现的中间态。
- 如果页面看到第一页 `items` 为空就立即显示空态，会把正常的后续有效内容挡住。
- 如果完全不处理，页面会停留在无内容、无明确反馈的坏状态。

选择在页面层自动继续翻页，而不是在 service 层递归吞掉空页，原因是：

- 第三步的数据层职责是“返回真实分页结果”，不应偷偷改变分页语义。
- 页面层最清楚自己当前是否已经有可见内容，因而更适合决定：
  - 继续加载
  - 显示 loading
  - 还是显示真正空态

### 为什么继续复用 `MasonryFeed`

原因：

- 资料页 tab 内容本质仍然是同一种帖子卡片瀑布流。
- 现有 `MasonryFeed` / `MasonryPostCard` 已经满足：
  - 响应式列数
  - 图片比例适配
  - 作者信息展示
  - 点赞数展示

本期没有必要为 profile 重新造一套卡片系统。

### 为什么子页应通过 `Outlet context` 获取最小路由上下文

原因：

- 父壳已经拿到了 `profileId`、`isOwner` 和资料基础信息。
- 子页如果再各自请求这些信息，只会增加 reads 和缓存耦合。
- `Outlet context` 是当前父子路由结构下最自然的传递方式。

它比以下做法都更合适：

- 子页重复查当前用户
- 子页重复查公开资料
- 子页硬编码从 pathname 反推 tab 文案

## 实现顺序与依赖关系

### 第一步：确认第四步父壳已提供稳定的子路由入口

依赖：

- `04-profile-route-shell.md`

要求：

- `profile.posts.tsx`
- `profile.saved.tsx`
- `profile.liked.tsx`

这三个 route module 已经被声明到 `routes.ts` 中。

如果第四步尚未把 `Outlet context` 补齐，本步骤应先补最小上下文。

### 第二步：先实现共用的 tab 内容状态层

操作：

- 新增 `useProfileInfiniteFeedState()`
- 新增 `ProfileFeedTabContent`

依赖：

- 依赖第三步已经提供 profile feed 的 infinite query hooks
- 依赖现有反馈组件和 `MasonryFeed`

原因：

- 三个子页都要复用同一套状态机与 UI 容器

### 第三步：先接入 `posts` 页面

操作：

- 实现 `profile.posts.tsx`
- 验证公开分页、空态、错误态、自动加载下一页

依赖：

- 依赖 `useProfilePostsInfiniteQuery()`

原因：

- `posts` 数据模型最简单，没有脏互动记录过滤这一层复杂度
- 适合作为共用容器的第一块验证页面

### 第四步：接入 `saved` 页面

操作：

- 实现 `profile.saved.tsx`
- 补齐“空页自动补翻”逻辑验证

依赖：

- 依赖 `useProfileSavedFeedInfiniteQuery()`
- 依赖第四步父壳已在路由层完成私有 tab guard

### 第五步：接入 `liked` 页面

操作：

- 实现 `profile.liked.tsx`
- 复用 `saved` 已验证的分页状态逻辑

依赖：

- 依赖 `useProfileLikedFeedInfiniteQuery()`

### 第六步：统一验证三类页面状态

验证项：

- `posts` 首次加载
- `posts` 首次失败
- `posts` 空态
- `posts` 后续分页中 / 分页失败 / 结束态
- `saved` 首屏就是脏互动空页但后面仍有有效帖子
- `saved` 自动补翻时失败且当前仍无可见卡片
- `liked` 在已有内容下翻页失败仍保留已加载卡片
- 三个 tab 切换时仅当前页发起内容请求

## 关键风险及应对策略

### 风险：`saved / liked` 的第一页没有可见内容，但并不是真的空

问题：

- 当前页互动记录可能全部指向已删除帖子。
- 若直接按 `items.length === 0` 显示空态，会把后续有效页挡掉。

应对：

- 只有在“当前总可见内容为 0 且没有下一页”时才显示整体空态
- 当“当前总可见内容为 0 且仍有下一页”时，自动继续请求后续页

### 风险：自动补翻空页失败后，页面停留在无内容无反馈状态

问题：

- 这类失败不一定会落到 `isError`
- 但用户仍然什么都看不到

应对：

- 将“当前没有可见卡片且自动补翻失败”定义为首屏阻塞错误
- 显示内容区级 `PageErrorState`
- 重试动作根据失败点分别调用：
  - `refetch()`
  - 或 `fetchNextPage()`

### 风险：三个子页复制状态判断，后续行为逐渐不一致

问题：

- 一个 tab 修了 bug，另外两个 tab 忘记同步
- 尤其容易出现在空态 / load-more error / 自动加载边界

应对：

- 抽共用状态 hook
- 抽共用内容组件
- 让 route module 保持很薄

### 风险：子页再次请求当前用户、公开资料和 count，造成不必要的 Appwrite reads

问题：

- 这会与第四步父壳重复取数
- 在免费版约束下属于明显浪费

应对：

- 通过 `Outlet context` 传最小必要信息
- 子页只发当前 tab feed 请求

### 风险：后续分页失败覆盖整个内容区

问题：

- 用户已经看到前几页内容
- 只是在加载更多时失败

应对：

- 明确区分：
  - `isInitialError`
  - `isLoadMoreError`
- 已有内容时，分页失败只能在底部状态区提示，不覆盖瀑布流本身

### 风险：sentinel 与空页补翻逻辑混在一起，导致加载条件打架

问题：

- sentinel 适用于“已有内容继续滚动”
- 空页补翻适用于“当前无内容但仍可能有后续有效页”

应对：

- 两类自动加载逻辑分开处理
- sentinel 只负责已有内容后的自动加载
- 空页补翻由单独 effect 驱动

### 风险：私有 tab 子页自己再做一套重定向，和父壳 guard 发生分裂

问题：

- 权限逻辑散落两层，后续维护会混乱

应对：

- 本步骤明确：
  - 私有 tab 的访问控制以第四步父壳 guard 为准
  - 子页默认不重复实现 owner / visitor redirect

### 风险：route module 变得过重，后续难维护

问题：

- 如果每个路由文件里既有 query，又有复杂状态机，又有完整 UI 分支，会快速膨胀

应对：

- route module 只负责：
  - 取最小上下文
  - 调对应 query
  - 传文案配置
- 分页状态机与表现层组件下沉到 `app/features/profile`

## 预期结果

本步骤完成后，资料页三个 tab 将从“有路由、无内容”的骨架状态升级为真正可用的页面：

- `posts` 能展示该用户公开发布的瀑布流内容
- `saved` 和 `liked` 能展示按互动顺序组织的私有瀑布流内容
- 三个子页具备一致、清晰的 loading / error / empty / load-more / end 状态
- 已删除帖子造成的脏互动记录不会把整个 `saved / liked` 页面误判为空
- 子页与父壳职责清晰，不会重复请求壳层数据，也不会一次性拉取三个 tab 的内容

这样资料页在第四步完成壳层之后，才能真正形成完整可用的：

- 资料头
- tab 导航
- 当前 tab 内容区

这一整套页面结构。
