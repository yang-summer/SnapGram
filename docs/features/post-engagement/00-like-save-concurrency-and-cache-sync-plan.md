# 帖子点赞与收藏并发处理方案

## 现状

当前帖子互动链路分为“读”和“写”两部分：

- 读：通过 React Query 拉取点赞/收藏状态和计数。
- 写：通过 `content-actions` Function 执行 `post.like` / `post.unlike` / `post.save` / `post.unsave`。

现有问题有两类：

- 快速连点会触发并发 mutation，前端没有统一的 single-flight 约束。
- 主页瀑布流的初始点赞态来自批量 query，详情页和瀑布流卡片不是同一份缓存真值，导致单帖更新后主页卡片未必同步。

现有实现特征：

- `MasonryPostCard` 通过 `usePostLikeToggle` 维护本地点赞态。
- `PostStats` 通过单帖 query 初始化点赞/收藏态，并在本地维护收藏态。
- `PostMasonryFeed` 先批量拉取 `viewerLikedPostsByPostIds`，再把结果转成 `initialIsLiked` 传给卡片。
- mutation 成功后只做了部分 query invalidation，收藏相关的 profile feed/count 还不完整。
- 后端已经有唯一索引和事务，但前端仍会因为并发点击产生抖动和状态竞争。

## 目标

- 同一 `postId` 的点赞请求只能有一个 in-flight。
- 同一 `postId` 的收藏请求只能有一个 in-flight。
- 点赞/收藏状态改为由 React Query cache 统一驱动，不再只放在组件本地 `useState`。
- 主页瀑布流、详情页、网格列表等多个入口共享同一份互动真值。
- 主页瀑布流初始点赞态采用方案 A：将批量 query 的结果灌入单帖 key，保证后续单帖更新可以同步到所有入口。
- 失败时可回滚，成功后可按需失效相关查询，保证最终和服务端一致。

## 改了什么，改在哪里

### 1. 新增统一的帖子互动 mutation 层

改动位置：

- `app/features/post/queries/post.engagement.mutations.ts`

改动内容：

- 新增点赞和收藏的统一 mutation 包装。
- 为点赞和收藏分别定义稳定的 `mutationKey`。
- 为同一 `postId` 的点赞和收藏分别定义稳定的 `scope.id`，实现串行化。
- 在 mutation 生命周期里实现 optimistic update、rollback 和 final invalidation。

建议 key 结构：

- 点赞：`['posts', 'engagement', 'like', postId]`
- 收藏：`['posts', 'engagement', 'save', postId]`

建议 scope 结构：

- 点赞：`post:${postId}:like`
- 收藏：`post:${postId}:save`

### 2. 将互动状态上移到 React Query cache

改动位置：

- `app/features/post/hooks/usePostLikeToggle.ts`
- `app/features/post/components/PostStats.tsx`
- `app/features/post/components/MasonryPostCard.tsx`

改动内容：

- 点赞不再以组件本地 `useState` 作为核心真值。
- 收藏不再以组件本地 `useState` 作为核心真值。
- 组件只消费 query cache 中的 `isLiked / isSaved / likeCount / saveCount`，并触发 mutation。
- `MasonryPostCard` 和详情页、网格列表使用同一套互动数据来源。

### 3. 主页瀑布流采用方案 A 做初始态灌入

改动位置：

- `app/features/post/components/PostMasonryFeed.tsx`
- `app/features/post/queries/post.engagement.queries.ts`
- `app/features/post/queries/post.engagement.mutations.ts`

改动内容：

- 主页批量 query 仍保留，用于首屏预热和批量读取。
- 批量结果成功后，将可见 `postId` 的点赞状态逐个写入单帖 key：`postKeys.viewerLike(viewerProfileId, postId)`。
- 之后所有组件统一读取单帖 key，批量 query 仅作为预热来源和批量刷新来源。
- mutation 成功后优先更新单帖 key，再按需失效批量 scope。

### 4. 补齐收藏相关无效化范围

改动位置：

- `app/features/post/queries/post.engagement.mutations.ts`

改动内容：

- 收藏成功 / 取消收藏后，补齐失效：
  - `postKeys.profileSavedFeedScope(viewerProfileId)`
  - `postKeys.profileSavedCount(viewerProfileId)`
- 保持对 `postKeys.viewerSavesScope(viewerProfileId)` 的失效。

### 5. 保留后端幂等和事务兜底

改动位置：

- `functions/content-actions/src/engagement.ts`
- `appwrite.config.json`

改动内容：

- 保留 `likes_user_post_unique` / `saves_user_post_unique` 唯一索引。
- 保留事务内“写互动记录 + 改帖子计数”的原子操作。
- 前端只负责降低并发和提升体验，不把一致性完全压给 UI。

## 为什么选择这个方案

- React Query 适合承载跨组件共享的服务端状态，不适合把点赞/收藏真值分散在多个组件本地 `useState` 中。
- `scope.id` 能把同一帖子同一动作串行化，解决快速连点导致的请求并发。
- `mutationKey` 能让 pending 状态可查询、可共享、可调试。
- optimistic update 可以让用户立即看到反馈，而不需要等待网络 round-trip。
- 方案 A 让单帖 key 成为统一真值，主页瀑布流、详情页、网格列表不会再各读各的状态。
- 方案 B 虽然改动更少，但读模型会长期分叉，后续更难维护。

## 实现顺序与依赖关系

1. 先补齐 `postKeys` 和互动 query/mutation 的 key 设计。
2. 再实现单帖 key 作为统一真值的 cache 更新逻辑。
3. 然后把 `PostMasonryFeed` 的批量结果灌入单帖 key，完成方案 A。
4. 接着把 `usePostLikeToggle` 和 `PostStats` 改成只读 cache + 调 mutation。
5. 再补齐点赞/收藏的 optimistic update、rollback 和 invalidation。
6. 最后补齐按钮级 pending 控制，统一处理快速连点。

依赖关系：

- 第 3 步依赖第 1 步的 key 设计。
- 第 4 步依赖第 2 步的 cache 真值设计。
- 第 5 步依赖第 2、3 步完成，确保乐观更新和批量灌入不会互相覆盖。
- 第 6 步依赖第 1、5 步完成，确保 pending 判断和 mutation 串行化一致。

## 关键风险及应对策略

### 风险 1：单帖 key 与批量 key 状态分叉

应对：

- 统一以单帖 key 作为读模型真值。
- 批量 query 只负责预热和批量回填，不作为最终 UI 真值。
- mutation 后主动刷新批量 scope，防止批量缓存长期陈旧。

### 风险 2：并发点击导致乐观状态和服务端结果打架

应对：

- 对同一 `postId` 的点赞 / 收藏使用独立 `scope.id` 串行化。
- 点击期间禁用同一动作按钮。
- 在 mutation 前 `cancelQueries`，避免旧 refetch 覆盖乐观值。
- 失败时用 snapshot 回滚。

### 风险 3：收藏链路的 profile feed / count 仍然陈旧

应对：

- 收藏成功与取消收藏后，补齐 `profileSavedFeedScope` 和 `profileSavedCount` 的失效。
- 不把收藏链路只停留在 `viewerSavesScope`。

### 风险 4：多个组件实例各自维护本地状态，导致 UI 不一致

应对：

- 取消核心互动状态的本地真值存储。
- 组件只消费 React Query cache。
- 对同一帖子只维护一份互动状态来源。

### 风险 5：前端优化掩盖后端异常

应对：

- 保留后端唯一索引和事务。
- optimistic update 只作为体验优化，不作为最终一致性保证。
- 请求失败时必须回滚并按需重新失效相关查询。

### 风险 6：批量灌入逻辑遗漏当前可见帖子

应对：

- `PostMasonryFeed` 只对当前 items 的 `postId` 做灌入。
- items 变化时重新灌入当前可见集合。
- 批量 key 的数据只用于当前视口和当前列表，不做全量推导。
