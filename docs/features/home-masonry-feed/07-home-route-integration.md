# 首页瀑布流步骤七：Home 路由接入与分页状态管理

## 目的

本步骤用于完成首页路由 `home.tsx` 的最终接入，将前面已经完成的数据层、渐进式图片组件和瀑布流组件真正组合成首页可用功能。

本步骤的目标是：

- 将首页从固定数量的纵向帖子列表切换为真正的分页瀑布流。
- 接入首页专用的 `useHomeFeedInfiniteQuery()`。
- 使用 `MasonryFeed` 渲染首页卡片。
- 通过底部 sentinel 实现自动加载下一页。
- 对首页的不同阶段状态做清晰区分：
  - 首次加载
  - 首次加载失败
  - 空列表
  - 正常内容
  - 后续分页加载中
  - 后续分页失败
  - 没有更多内容
- 保持首页状态管理清晰，不将首屏状态和分页尾部状态混在一起。

本步骤是首页瀑布流功能的最终页面接入阶段。

## 验收标准

本步骤完成后，应满足以下验收标准：

- `app/routes/home.tsx` 不再使用：
  - `useGetRecentPostsQuery()`
- `app/routes/home.tsx` 改为使用：
  - `useHomeFeedInfiniteQuery()`
- 首页不再渲染旧的纵向 `PostCard` 列表。
- 首页改为渲染 `MasonryFeed`。
- 首页会将分页结果拍平成一个 feed items 数组，再交给 `MasonryFeed`。
- 首页首次加载中时：
  - 显示整页 loading state
- 首页首次加载失败时：
  - 显示整页 error state
  - 提供整页重试能力
- 首页为空时：
  - 显示空状态
- 首页已有内容时：
  - 始终保留已加载内容
  - 后续分页失败不覆盖整个页面
- 底部存在单独的分页状态区，支持：
  - 正在加载下一页
  - 下一页加载失败后的重试
  - 没有更多内容
- 底部存在一个 sentinel，用于自动触发下一页加载。
- sentinel 只在以下条件满足时自动调用 `fetchNextPage()`：
  - 进入视口范围
  - `hasNextPage === true`
  - 当前不在 `isFetchingNextPage`
  - 当前不处于“后续分页失败等待手动重试”的状态
- 分页失败后不会进入自动无限重试。

## 改了什么，改在哪里

### 一、改造 `home.tsx` 的数据来源

改动位置：

- `app/routes/home.tsx`

当前首页使用：

- `useGetRecentPostsQuery()`

该 query 只适用于固定数量的单次加载列表，不适合首页无限滚动瀑布流。

本步骤中改为：

- `useHomeFeedInfiniteQuery()`

这样首页获取的数据将变为：

- 分页后的 `pages`
- `fetchNextPage`
- `hasNextPage`
- `isFetchingNextPage`
- 以及相应错误状态

### 二、改造首页主内容渲染方式

改动位置：

- `app/routes/home.tsx`

当前首页内容区域是：

- 纵向 `<ul>`
- `PostCard`

本步骤中改为：

- 将 `data.pages` 拍平成一个 items 数组
- 用 `MasonryFeed` 进行渲染

即首页主内容从“单列列表”切换为“瀑布流容器”。

### 三、增加首页分页状态分层

改动位置：

- `app/routes/home.tsx`

首页不能只靠一个 `isError` 和一个 `isPending` 来切换所有 UI。

本步骤中建议派生出以下语义状态：

- `isInitialLoading`
- `isInitialError`
- `isEmpty`
- `isLoadingMore`
- `isLoadMoreError`
- `isEndReached`

这些状态的职责不同：

- `isInitialLoading`
  - 控制整页 loading
- `isInitialError`
  - 控制整页错误页
- `isEmpty`
  - 控制空列表提示
- `isLoadingMore`
  - 控制底部“加载更多中”
- `isLoadMoreError`
  - 控制底部“重试”
- `isEndReached`
  - 控制底部“没有更多内容”

### 四、增加底部自动加载 sentinel

改动位置：

- `app/routes/home.tsx`

建议复用当前项目中已存在的模式：

- `react-intersection-observer`
- `useInView()`

底部自动加载的实现方式：

- 在 `MasonryFeed` 下方放一个 sentinel 元素
- 用 `useInView()` 监听它是否进入视口附近
- 当 sentinel 进入触发范围且满足自动加载条件时，调用 `fetchNextPage()`

推荐：

- 使用 `rootMargin`
  - 提前触发下一页加载
  - 避免用户滚到底才开始请求

sentinel 不应放在瀑布流某一列内部，而应放在：

- `MasonryFeed` 外部
- feed 底部状态区之后或附近

否则它会被当成列中普通内容参与布局，导致触发时机异常。

### 五、增加底部分页状态区

改动位置：

- `app/routes/home.tsx`
- 如需要可抽成单独组件，例如：
  - `app/features/post/components/HomeFeedLoadMoreState.tsx`

底部分页状态区建议单独处理，不与主内容状态混用。

它负责显示：

- 正在加载下一页
- 后续分页失败时的“重试”入口
- 没有更多内容

第一版即使不抽单独组件，也建议保持这块逻辑独立，避免 `home.tsx` 变成一个巨大的条件分支文件。

## 为什么选择这个方案

### 为什么首页必须从 `useGetRecentPostsQuery()` 切换到 `useHomeFeedInfiniteQuery()`

因为首页的产品目标已经从：

- 固定数量列表

变成了：

- 真正的无限滚动 feed

`useGetRecentPostsQuery()` 的语义和能力都不匹配：

- 不支持 cursor
- 不支持下一页
- 不支持尾部分页状态
- 不适合瀑布流持续追加内容

因此首页必须完全切换到首页专用分页 query，而不是在旧 query 上继续叠加逻辑。

### 为什么首页状态要分成“首屏状态”和“尾部分页状态”

首页的错误和加载并不只有一种。

如果混在一起处理，会出现两个典型问题：

- 首次分页失败时，整页内容被错误覆盖
- 翻页失败时，页面被误判为整体错误

而用户真实需要的是：

- 首次加载失败：看整页错误页
- 后续分页失败：保留已有内容，只在底部提示重试

因此必须分层处理。

### 为什么底部自动加载使用 sentinel

因为对于无限滚动来说，这种方式最直接、也最符合当前项目已有实现模式。

它的优势：

- 不需要手动监听滚动位置
- 可以提前通过 `rootMargin` 预取下一页
- 与 React 组件结构更容易结合
- 当前项目 Explore 已有类似模式，复用心智成本低

### 为什么分页失败后要停止自动重试

如果分页失败后 sentinel 仍在视口中，而逻辑没有阻断自动触发，页面可能进入：

- 一边报错
- 一边自动重复请求

这种体验和网络行为都不可接受。

因此后续分页失败后，应：

- 停止自动加载
- 改为用户点击“重试”后再次触发 `fetchNextPage()`

### 为什么已有内容时不能被整页错误覆盖

因为首页 feed 是渐进式积累内容的：

- 用户已经看到前几页
- 只是在加载第 N+1 页时失败

此时正确行为应该是：

- 保留已有内容
- 只在底部提示下一页失败

而不是把整个 feed 清空。

## 实现顺序与依赖关系

### 第一步：完成首页分页数据层

依赖：

- 依赖步骤四中的首页分页 API / service / query

原因：

- `home.tsx` 直接依赖 `useHomeFeedInfiniteQuery()`

### 第二步：完成 `MasonryFeed` 和首页卡片组件

依赖：

- 依赖步骤六中的：
  - `MasonryFeed`
  - `MasonryPostCard`

原因：

- `home.tsx` 需要有实际可渲染的首页瀑布流组件

### 第三步：在首页中拍平分页数据

操作：

- 从 `data.pages` 中提取所有 `items`
- 形成单一数组传给 `MasonryFeed`

依赖：

- 依赖 `CursorPage<T>` 数据结构已稳定

### 第四步：派生首页页面级状态

操作：

- 判断：
  - 首次 loading
  - 首次 error
  - 空列表

依赖：

- 依赖分页数据和 query 状态已可用

### 第五步：派生底部分页状态

操作：

- 判断：
  - `isLoadingMore`
  - `isLoadMoreError`
  - `isEndReached`

依赖：

- 依赖 `fetchNextPage`
- 依赖 `hasNextPage`
- 依赖已有内容已存在

### 第六步：接入 sentinel 自动加载逻辑

操作：

- 使用 `useInView()`
- 在合适条件下触发 `fetchNextPage()`

依赖：

- 依赖分页状态已派生完成

### 第七步：接入底部状态区

操作：

- 渲染“加载中 / 重试 / 没有更多内容”

依赖：

- 依赖尾部分页状态已明确

### 第八步：移除旧首页卡片逻辑

操作：

- 移除旧的 `PostCard` 列表渲染逻辑
- 不再依赖 `useGetRecentPostsQuery()`

依赖：

- 依赖新首页链路已完整可用

## 关键风险及应对策略

### 风险：首页状态分支混乱，导致 UI 条件判断失控

问题：

- 如果将首屏状态、分页状态、尾部状态全部混在一个 `if / else if` 链中，`home.tsx` 会变得难以维护。

应对：

- 将状态分成：
  - 页面级状态
  - 内容级状态
  - 底部分页状态
- 尽量先派生语义变量，再渲染 UI

### 风险：分页失败后进入自动无限重试

问题：

- sentinel 仍在视口中，如果失败后不阻断自动加载，会不断重复请求下一页。

应对：

- 将“后续分页失败”视为手动重试状态
- 失败后禁止自动再次调用 `fetchNextPage()`

### 风险：sentinel 放错位置，导致触发时机异常

问题：

- 如果把 sentinel 放到瀑布流某一列中，它会受列高度差异影响，触发时机不稳定。

应对：

- sentinel 放在 `MasonryFeed` 外部
- 作为整个 feed 的底部触发器存在

### 风险：已有内容被整页错误覆盖

问题：

- 翻页失败时，如果直接根据 `isError` 显示整页错误，会把已加载内容错误替换掉。

应对：

- 明确区分：
  - 首次 error
  - 后续分页 error
- 仅首次 error 使用整页错误态

### 风险：首页 items 拍平逻辑重复计算过多

问题：

- 每次 render 都重新拍平所有分页数据，虽然通常可接受，但会让后续逻辑越来越杂。

应对：

- 第一版可直接拍平
- 如后续需要优化，再用更明确的派生变量或缓存方式

### 风险：首页 route 过度承担组件职责

问题：

- 如果 `home.tsx` 既管理 query，又管理分页状态，又负责底部状态文案和复杂 UI，会快速变重。

应对：

- 第一版先在 `home.tsx` 中完成接入
- 如逻辑增长明显，再抽：
  - 底部状态组件
  - feed 内容包装组件

## 预期结果

本步骤完成后，首页路由将真正接入新的瀑布流架构：

- 首页使用首页专用分页 query
- 首页内容由 `MasonryFeed` 渲染
- 底部自动加载下一页可工作
- 首屏状态与后续分页状态被清晰分层
- 分页失败不会破坏已有内容
- 没有更多内容时，用户能明确获得反馈
