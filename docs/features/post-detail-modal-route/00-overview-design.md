# 帖子详情模态框路由设计方案

## 范围

本文档定义 Snapgram 的帖子详情模态框路由方案。

本期目标：

- 统一帖子详情 URL 为 `/posts/:id`。
- 从任意帖子列表进入详情时，以模态框方式展示帖子内容。
- 直达或刷新 `/posts/:id` 时，展示独立详情页。
- 关闭模态框后回到进入前的列表页，并保留原滚动位置与页面状态。
- 移动端模态框全屏展示，宽屏左右分栏展示。
- 删除帖子后跳转到首页。

本期不包含：

- 改造帖子数据模型
- 改造搜索、发布、编辑流程
- 新增独立的详情子路由路径
- 引入第三方 modal / dialog 依赖

## 当前现状

当前相关文件：

- `app/routes.ts`
- `app/layouts/rootLayout.tsx`
- `app/routes/postDetails.tsx`
- `app/root.tsx`
- `app/features/post/components/PostCard.tsx`
- `app/features/post/components/MasonryPostCard.tsx`
- `app/features/post/components/GridPostList.tsx`
- `app/routes/home.tsx`
- `app/routes/explore.tsx`
- `app/routes/searchResult.tsx`
- `app/routes/profile.tsx`
- `app/routes/profile.posts.tsx`
- `app/routes/profile.saved.tsx`
- `app/routes/profile.liked.tsx`

当前行为：

- `app/routes.ts` 已经定义了 `route('posts/:id', 'routes/postDetails.tsx')`。
- 帖子卡片点击后直接进入详情页，没有 modal route。
- `postDetails.tsx` 已经实现了完整的帖子详情能力：
  - 拉取帖子详情
  - 删除帖子
  - 编辑入口
  - stats 展示
- 根布局 `rootLayout.tsx` 已经承载了所有已登录页面的共同 shell。
- `root.tsx` 已经渲染了 `ScrollRestoration`。
- 列表页目前覆盖：
  - 首页瀑布流
  - Explore
  - 搜索结果页
  - 资料页各 tab

## 已确认需求

- 模态框路由统一使用 `/posts/:id`。
- 直接访问 `/posts/:id` 时显示独立详情页。
- modal 覆盖全部帖子列表入口。
- 关闭 modal 后回到上一个列表页，并保留滚动位置和搜索状态。
- 宽屏 modal 左右分栏。
- 窄屏 modal 全屏。
- 关闭按钮在宽屏遮罩左上角，窄屏在头像左侧。
- 点击遮罩关闭 modal。
- 删除帖子后跳首页。

## React Router v7 依据

本方案基于 React Router v7 官方 API：

- [`Link`](https://reactrouter.com/api/components/Link) 支持 `state` 与 `preventScrollReset`。
- [`useLocation`](https://api.reactrouter.com/v7/functions/react-router.useLocation.html) 可读取当前 location 与 `location.state`。
- [`useNavigate`](https://api.reactrouter.com/v7/functions/react-router.useNavigate.html) 支持 `state`、`replace`、`preventScrollReset` 和 `navigate(-1)`。
- [`useOutlet`](https://api.reactrouter.com/v7/functions/react-router.useOutlet.html) 可拿到当前子路由 element，适合做背景页快照。
- [`ScrollRestoration`](https://api.reactrouter.com/v7/functions/react-router.ScrollRestoration.html) 负责前进 / 后退滚动恢复，应保留在根入口。

关键点：

- `location.state` 是 history entry 状态，不在 URL 里。
- 这意味着 modal 只是增强模式，不是唯一数据来源。
- 直达或刷新时 `location.state` 会丢失，因此必须自动回退到独立详情页。

## 方案概述

核心思路：

- URL 只保留帖子 id。
- modal 与页面态的区别放在 `location.state` 里。
- 根布局负责保留背景页。
- 详情页负责按当前上下文渲染 page 或 modal 样式。

具体流程：

1. 列表页点击帖子卡片时，跳转到 `/posts/:id`，同时写入 `state.backgroundLocation`。
2. `rootLayout.tsx` 发现当前导航带有背景页信息时，不销毁原列表，而是保留上一个 `Outlet` 作为背景层。
3. `postDetails.tsx` 在 modal 场景渲染遮罩层内容，在直达场景渲染独立页面内容。
4. 关闭 modal 时执行 `navigate(-1)`，回到上一个历史条目。
5. 删除成功后统一 `navigate('/', { replace: true })`。

## 改了什么，改在哪里

### 1. `app/layouts/rootLayout.tsx`

职责从“普通 shell”升级为“modal host”。

改动点：

- 使用 `useOutlet()` 获取当前子路由 element。
- 在非 modal 导航时，缓存最近一次正常页面的 outlet。
- 在 modal 导航时，保持背景页 outlet 不卸载。
- 在根层级渲染 modal 遮罩，而不是放进具体列表页里。

建议新增一个很小的本地状态缓存逻辑：

- 仅在非 modal 导航时更新背景 outlet。
- modal 打开后不要覆盖背景 outlet。

这样可以直接保住：

- 列表滚动位置
- 搜索框输入状态
- 已加载的分页数据
- 资料页 tab 状态

### 2. `app/routes/postDetails.tsx`

职责从“纯页面路由”升级为“页面 / modal 双模式详情路由”。

改动点：

- 保留当前的数据读取、删除、编辑逻辑。
- 抽出共享详情内容组件，例如 `PostDetailsContent`。
- 根据 `useLocation().state` 判断当前是否为 modal 场景。
- modal 场景渲染全屏 / 遮罩壳。
- page 场景渲染独立详情页壳。

建议拆分：

- `PostDetailsContent`
  - 负责帖子详情数据与主体内容
- `PostDetailsPage`
  - 负责独立详情页布局
- `PostDetailsModal`
  - 负责遮罩、关闭按钮、响应式 modal 布局

### 3. `app/features/post/components/PostCard.tsx`

改成打开 modal 的入口。

改动点：

- 点击帖子封面或内容时，跳转到 `/posts/:id`。
- 携带 `state.backgroundLocation`。
- 加上 `preventScrollReset`。

### 4. `app/features/post/components/MasonryPostCard.tsx`

同样改成 modal 入口。

改动点：

- 使用相同的背景页 state 约定。
- 保证首页瀑布流打开详情时可回到原 scroll 位置。

### 5. `app/features/post/components/GridPostList.tsx`

同样改成 modal 入口。

改动点：

- 所有帖子卡片链接都要带背景 location state。
- 避免 Explore / 搜索结果页打开详情后丢失搜索状态。

### 6. `app/root.tsx`

原则上不改结构。

要求：

- 保留唯一的 `ScrollRestoration`。
- 位置继续放在 `Scripts` 前面。

### 7. `app/routes.ts`

原则上不改路由结构。

原因：

- 现有 `/posts/:id` 已经是正确的统一详情 URL。
- modal route 不需要新增第二套详情路径。

## 为什么选择这个方案

### 为什么不用额外 query 参数

不额外引入 `?modal=1` 之类参数，因为：

- 用户只要求 URL 能反映帖子 id。
- modal 是否打开本质上是临时 UI 状态。
- 该状态更适合放在 history state，而不是污染 URL。

### 为什么用 `location.state` 而不是全局 store

因为这个场景的“背景页”只对一次导航有效。

`location.state` 的优势：

- 语义直接
- 不需要新建全局状态管理
- 刷新后自然失效，直接回落到独立详情页
- 关闭时可直接 `navigate(-1)`

### 为什么 rootLayout 负责保留背景页

因为所有帖子列表都在同一个已登录 shell 内：

- 首页
- Explore
- 搜索结果页
- 资料页各 tab

把 modal host 放在 `rootLayout.tsx` 能一次覆盖全部入口。

如果把逻辑分散到每个列表页：

- 容易重复
- 容易漏入口
- 不利于统一关闭、遮罩和滚动恢复

### 为什么不使用第三方 dialog 组件

当前需求不复杂，不值得引入额外依赖。

本地实现已经足够：

- 遮罩
- 关闭按钮
- 点击外部关闭
- 响应式布局
- body scroll lock

保持最小方案更稳。

### 为什么要保留 background outlet 快照

这是满足“关闭 modal 回到原列表并保留状态”的关键。

好处：

- 不需要把列表状态额外挂到全局 store。
- 不需要在关闭时重新请求列表数据。
- `Explore` 搜索输入、profile tab、无限滚动都能原样保留。

### 为什么直达时必须回落到独立详情页

因为 `location.state` 不存在于 URL。

所以：

- 刷新 `/posts/:id`
- 外部直达 `/posts/:id`

都应该得到独立详情页，而不是空 modal。

这是该方案的正确默认行为。

## 实现顺序与依赖关系

### 第一步：抽出详情内容组件

任务：

- 从 `postDetails.tsx` 中抽出共享详情内容。
- 保留现有请求、删除、编辑逻辑。

依赖：

- 无。

### 第二步：接入背景 location 约定

任务：

- 所有帖子列表入口都改成写入 `state.backgroundLocation`。
- 同时加上 `preventScrollReset`。

依赖：

- 依赖 `postDetails` 仍然是统一目标路由。

### 第三步：改造 `rootLayout.tsx`

任务：

- 引入 `useOutlet()`。
- 实现背景页快照与 modal host。
- 加 body scroll lock。

依赖：

- 依赖第二步能正确标识 modal 导航。

### 第四步：改造 `postDetails.tsx`

任务：

- 根据 `location.state` 切换 page / modal 样式。
- 补齐关闭、遮罩、宽窄屏布局。

依赖：

- 依赖第一步共享内容已抽出。
- 依赖第三步背景页保留逻辑已完成。

### 第五步：调整删除与返回逻辑

任务：

- modal 关闭走 `navigate(-1)`。
- 删除成功后跳首页。

依赖：

- 依赖前面 modal 行为已成型。

### 第六步：全量回归

任务：

- 首页打开 / 关闭 modal
- Explore 打开 / 关闭 modal
- 搜索结果打开 / 关闭 modal
- profile 各 tab 打开 / 关闭 modal
- 直接访问 `/posts/:id`
- 刷新 `/posts/:id`
- 删除帖子后回首页

依赖：

- 前面所有步骤完成。

## 关键风险及应对策略

### 风险：背景页 outlet 被错误覆盖

问题：

- modal 打开后，如果 rootLayout 继续用当前 outlet 覆盖背景，就会丢失列表状态。

应对：

- 只在非 modal 导航时更新背景 outlet。
- modal 打开后冻结背景快照，直到关闭为止。

### 风险：打开 modal 时滚动被重置

问题：

- 默认导航可能触发回到顶部。

应对：

- 所有帖子入口都使用 `preventScrollReset`。
- 保留 `ScrollRestoration`，让 back/forward 的滚动恢复继续生效。

### 风险：直达 / 刷新后 modal 状态丢失

问题：

- `location.state` 不在 URL 里，刷新后会消失。

应对：

- 这是预期行为。
- 直达时直接渲染独立详情页。

### 风险：删除后 `navigate(-1)` 不适用

问题：

- 直达 `/posts/:id` 时，`navigate(-1)` 可能回到外部来源或没有可用历史。

应对：

- 删除成功统一跳首页，不依赖 history 回退。

### 风险：modal 打开时后台列表继续运行

问题：

- 背景页面保持挂载，会继续保留自己的 query、observer 和本地状态。

应对：

- 这正是本方案要保留的能力。
- 背景页通常是虚拟化列表，额外成本可接受。

### 风险：遮罩与根布局层级冲突

问题：

- `Topbar`、`Bottombar`、侧边栏都是固定定位，modal 容器如果层级不够会被盖住。

应对：

- modal host 放在 `rootLayout` 顶层。
- 使用明确的高 `z-index`。
- modal 覆盖整屏并锁 body scroll。

### 风险：无障碍问题

问题：

- modal 需要键盘关闭、焦点管理和语义声明。

应对：

- `role="dialog"`、`aria-modal="true"`。
- 初始焦点放在关闭按钮。
- 点击遮罩关闭，点击内容不冒泡。
- 如有余力，补 `Esc` 关闭。

## 预期结果

完成后，帖子详情会形成统一、稳定的 modal route 体验：

- 列表页打开详情时是 modal。
- 直达或刷新时是独立页面。
- 关闭后能准确回到原列表并保留状态。
- 所有帖子列表入口行为一致。
- 不增加新的详情 URL 复杂度。
- 方案与当前 React Router v7 / 文件式路由架构一致。

## 参考

- React Router Link: https://reactrouter.com/api/components/Link
- React Router useLocation: https://api.reactrouter.com/v7/functions/react-router.useLocation.html
- React Router useNavigate: https://api.reactrouter.com/v7/functions/react-router.useNavigate.html
- React Router useOutlet: https://api.reactrouter.com/v7/functions/react-router.useOutlet.html
- React Router ScrollRestoration: https://api.reactrouter.com/v7/functions/react-router.ScrollRestoration.html

