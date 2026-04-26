# 用户资料功能步骤七：补齐缓存刷新与回填

## 目的

本步骤用于在资料编辑页主链路已经接通的前提下，补齐“编辑成功后的缓存一致性策略”，解决以下问题：

- 资料已经更新成功，但左侧栏仍显示旧头像或旧名字
- 编辑页保存成功并跳回资料页后，资料头短暂显示旧数据
- 首页、探索页、资料页 tab、帖子详情页中的作者信息继续使用旧缓存

当前项目已经具备：

- `auth.currentUser` 这类全局用户态 query
- `post` 领域下较完整的 query key 与 invalidate 模式
- 资料页公开资料查询、编辑页 editable profile 查询与编辑 mutation 主链路

但当前项目还没有一套明确的“资料更新成功后，哪些缓存需要立即回写，哪些缓存只需要标记失效”的策略。

本步骤的目标是：

- 在不做整页刷新、不清空整个 QueryClient 的前提下，补齐资料编辑成功后的缓存刷新与回填。
- 明确区分两类动作：
  - `回填`
    - 直接用 mutation 返回结果写回关键缓存，避免明显闪烁
  - `刷新`
    - 对作者信息嵌入在不同帖子数据形状中的缓存做定向失效，保证后续页面拿到新值
- 保持方案与当前项目架构一致：
  - React Query mutation hook 负责缓存策略
  - route module 和表单组件只关心页面行为
- 兼顾 Appwrite Cloud 免费版约束：
  - 不为了更新一个头像去做全量重新拉取
  - 不做高复杂度、覆盖所有帖子数据形状的缓存深度改写

本步骤不负责：

- 编辑页 UI
- 头像上传链路本身
- 资料页壳路由
- tab 内容页

本步骤只负责“编辑成功之后，怎样让界面尽快一致”。

## 验收标准

本步骤完成后，应满足以下验收标准：

- 编辑资料 mutation 成功后，不需要手动刷新页面就能看到以下区域尽快更新：
  - 左侧栏当前用户头像和名字
  - 底栏当前用户入口
  - 资料页头部头像、名字、bio
- 编辑资料 mutation 成功后，不允许通过：
  - `window.location.reload()`
  - `queryClient.clear()`
  - 整站强制 remove 所有 query
  这类粗暴方式实现一致性。
- `authKeys.currentUser()` 会在 mutation 成功后被直接回写，而不是只依赖后续 refetch。
- 当前编辑用户对应的：
  - public profile cache
  - editable profile cache
  会在 mutation 成功后被直接回写，而不是等资料页重新请求后才变化。
- 资料页保存成功并跳回 `/profile/:id/posts` 时：
  - 资料头不会明显闪一下旧头像或旧名字
- 帖子相关展示缓存会在 mutation 成功后被定向失效，至少覆盖：
  - 首页 feed
  - Explore / Search 列表
  - 资料页 `posts / saved / liked` feed
  - 帖子详情页
- 失效帖子相关缓存时，不会误删：
  - viewer like/save 状态缓存
  - 与资料编辑无关的 auth cache
- mutation hook 中的缓存策略不会散落到：
  - `EditProfileForm`
  - `updateProfile.tsx`
  - `ProfileHeader`
  这些页面或组件内部。
- 若 mutation 返回的是当前登录用户自己的资料更新结果：
  - `auth.currentUser` 会被立即同步
- 若未来复用同一个 mutation 更新别人的资料数据：
  - 不会错误覆盖当前登录用户缓存
- 资料更新成功后，帖子相关缓存采用“失效为主”的方案，而不是对所有不同数据形状做深层手工 patch。
- 当前页面存在中的相关 active query，在失效后会按 React Query 规则自动刷新；inactive query 则在后续再次进入页面时拿到新数据。

## 改了什么，改在哪里

### 一、让编辑资料 mutation 返回可用于回填缓存的完整资料快照

改动位置：

- `app/features/user/types/user.type.ts`
- `app/features/user/services/user.service.ts`
- `app/features/user/queries/user.mutations.ts`

本步骤建议编辑资料 mutation 不返回：

- `void`
- 仅成功布尔值

而是返回一份足够完整的更新后资料快照，至少能覆盖：

- `profileId`
- `accountId`
- `email`
- `username`
- `name`
- `imageId`
- `imageUrl`
- `bio`

原因：

- 如果 mutation 返回值过窄，后续缓存回填就只能完全依赖额外 refetch。
- 第七步的目标正是减少明显闪烁，因此 mutation 返回结果必须足够支撑：
  - 当前用户缓存回填
  - 公开资料缓存回填
  - editable profile 缓存回填

### 二、在 `user` queries 层新增缓存辅助 helper

建议新增：

- `app/features/user/queries/user.cache.ts`

建议职责：

- 根据更新后的 editable profile 结果，派生并回填：
  - `CurrentUserDto`
  - `PublicUserProfileViewModel`
  - `EditableUserProfileViewModel`
- 集中处理：
  - query cancel
  - setQueryData
  - invalidateQueries

建议至少拆出以下 helper：

- `backfillCurrentUserCache(queryClient, updatedProfile)`
- `backfillUserProfileCaches(queryClient, updatedProfile)`
- `invalidateUpdatedProfilePresentationCaches(queryClient, updatedProfile.profileId)`

这里不建议把所有缓存逻辑都直接塞进：

- `useUpdateEditableUserProfileMutation()`

的 `onSuccess` 回调里。

原因：

- 第七步会同时依赖：
  - `authKeys`
  - `userKeys`
  - `postKeys`
- 如果全写在 mutation hook 文件里，很快会变得难读、难测、难复用。

### 三、即时回填 `auth.currentUser`，避免侧边栏和底栏闪旧值

改动位置：

- `app/features/auth/queries/auth.keys.ts`
- `app/features/user/queries/user.cache.ts`
- `app/features/user/queries/user.mutations.ts`

当前项目里最明显的用户资料展示入口是：

- `app/components/shared/LeftSidebar.tsx`
- `app/components/shared/Bottombar.tsx`

这两个组件都直接消费：

- `useCurrentUserQuery()`

因此本步骤必须把：

- `authKeys.currentUser()`

作为最高优先级回填目标。

建议行为：

- mutation 成功后，若更新的 `profileId` 与当前 authenticated user 的 `profileId` 一致：
  - 直接 `setQueryData(authKeys.currentUser(), nextCurrentUserResult)`

这里不建议只做：

- `invalidateQueries({ queryKey: authKeys.currentUser() })`

原因：

- `currentUser` 是全局壳层正在使用的 active query。
- 仅 invalidation 会在 refetch 完成前保留旧值，侧边栏和底栏会出现明显“资料已保存但还没变”的短暂不一致。

### 四、即时回填 public / editable profile 缓存，避免返回资料页时资料头闪旧值

改动位置：

- `app/features/user/queries/user.keys.ts`
- `app/features/user/queries/user.cache.ts`
- `app/features/user/queries/user.mutations.ts`

本步骤建议 `user` feature 至少具备以下 query key：

- `userKeys.scope(profileId)`
- `userKeys.publicProfile(profileId)`
- `userKeys.editableProfile(profileId)`

在 mutation 成功后，建议直接回填：

- `userKeys.publicProfile(profileId)`
- `userKeys.editableProfile(profileId)`

原因：

- 编辑页保存成功后会立即跳回资料页。
- 资料页父壳会立刻消费 public profile cache。
- 如果这两个 key 不先回写，资料头最容易出现“跳转回来先显示旧数据，随后再刷新”的体验问题。

这里同样不建议只靠 invalidate。

### 五、帖子相关展示缓存采用“定向失效”而不是“深层全量 patch”

改动位置：

- `app/features/post/queries/post.keys.ts`
- `app/features/user/queries/user.cache.ts`
- `app/features/user/queries/user.mutations.ts`

当前项目中作者名字和头像被嵌入到多类帖子 view model 中，例如：

- `HomeFeedPostViewModel`
- `PostGridItemViewModel`
- `PostDetailViewModel`

并且这些缓存分布在不同 query key 下：

- `postKeys.lists()`
- `postKeys.details()`
- 以及第三步中为资料页新增的：
  - `postKeys.profileScope(profileId)`
  - 或等价 profile feed scope

本步骤建议：

- 不去深度遍历并手写 patch 所有帖子列表与详情缓存
- 而是在 mutation 成功后定向失效帖子展示相关根 key

建议至少失效：

- `postKeys.lists()`
- `postKeys.details()`
- `postKeys.profileScope(profileId)` 或等价 profile feed scope

原因：

- 当前帖子缓存形状并不单一：
  - 普通 query
  - infinite query
  - 不同 view model
- 为了同步一个作者头像去深层 patch 所有帖子缓存，会明显抬高实现复杂度与维护成本。
- React Query 的“标记 stale，active query 自动刷新，inactive query 下次进入再刷新”机制，已经足够匹配这个场景。

### 六、不要误伤与资料编辑无关的互动状态缓存

改动位置：

- `app/features/user/queries/user.cache.ts`
- `app/features/user/queries/user.mutations.ts`

当前项目中还有一批 viewer 互动状态缓存，例如：

- `postKeys.viewerLikesScope(viewerProfileId)`
- `postKeys.viewerSavesScope(viewerProfileId)`

这些缓存承载的是：

- 当前 viewer 是否点赞 / 收藏某帖

它们不依赖作者头像和作者名字。

因此本步骤不建议在资料编辑成功后去无差别失效：

- `postKeys.all()`

原因：

- 那会把资料更新和互动状态缓存错误地绑在一起。
- 既增加无意义 refetch，也让缓存策略边界变模糊。

### 七、在 mutation 成功回调中统一编排缓存更新顺序

改动位置：

- `app/features/user/queries/user.mutations.ts`

建议 `useUpdateEditableUserProfileMutation()` 的 `onSuccess` 顺序固定为：

1. 取消当前可能在飞行中的相关 query：
   - `authKeys.currentUser()`
   - `userKeys.publicProfile(profileId)`
   - `userKeys.editableProfile(profileId)`
2. 回填关键用户缓存：
   - `auth.currentUser`
   - `public profile`
   - `editable profile`
3. 定向失效帖子展示缓存：
   - `postKeys.lists()`
   - `postKeys.details()`
   - `postKeys.profileScope(profileId)` 或等价 root
4. 将导航和 toast 交给页面层或 mutation hook 既定流程

这里建议先：

- `cancelQueries`

再：

- `setQueryData`

原因：

- 如果在 mutation 成功前，某些相关 query 正在 refetch，中间返回的旧响应有机会把刚回填的新数据覆盖掉。
- 先 cancel 再回填可以降低这种竞态风险。

### 八、让页面层只消费 mutation 结果，不自带缓存策略

改动位置：

- `app/routes/updateProfile.tsx`
- `app/features/user/components/EditProfileForm.tsx`

本步骤建议：

- route module 继续只负责：
  - owner guard
  - editable profile query
  - 页面级 loading / error / empty
- 表单组件继续只负责：
  - 收集输入
  - 调 mutation
  - 显示提交错误
  - 导航

而不要在这些文件里再手写：

- `queryClient.invalidateQueries(...)`
- `queryClient.setQueryData(...)`

原因：

- 缓存一致性是第七步的核心横切逻辑。
- 一旦散落在 route / form / mutation 三处，后续很难判断真实缓存来源。

## 为什么选择这个方案

### 为什么要把“回填”和“刷新”拆成两类动作

原因：

- 不是所有缓存都值得手写 patch。
- 当前用户缓存和资料缓存是高价值、低复杂度的回填目标：
  - 结构稳定
  - 体验收益直接
- 帖子展示缓存则是高分散、多形状的数据：
  - 手写 patch 成本高
  - 稍不小心就会漏掉某一种数据结构

因此最稳妥的方案是：

- 关键用户缓存直接回填
- 帖子展示缓存定向刷新

### 为什么 `auth.currentUser` 必须直接回填

原因：

- 这是当前壳层中最显眼的用户信息来源。
- 左侧栏和底栏都依赖它。
- 如果只做失效不做回填，用户在编辑页保存成功后最容易看到旧头像和旧名字残留。

这是整体体验里最不能接受的一处不一致。

### 为什么 public / editable profile 也要直接回填

原因：

- 编辑成功后，用户的下一跳通常就是资料页。
- 资料页头部正是 public profile 的直接消费者。
- editable profile 又是编辑页本身的直接数据源。

直接回填这两个 key，可以让：

- 留在编辑页时数据立即一致
- 跳回资料页时 header 立即一致

### 为什么不建议全量深改所有帖子缓存

原因：

- 当前帖子缓存形状已经分散在：
  - infinite query page
  - 单条 detail
  - grid item
  - home feed item
- 想把作者名字和头像一次性 patch 进所有这些缓存，不是做不到，而是：
  - 复杂度高
  - 漏洞面大
  - 维护成本高

这不符合当前项目“简单、可维护、生产友好”的约束。

### 为什么只定向失效相关帖子根 key 就足够

原因：

- React Query 的 stale 机制天然适合这类“展示层派生数据更新”。
- 当前编辑资料后，并不是每一个帖子页面都需要立刻在同一帧内更新。
- 只要：
  - 当前壳层用户信息即时正确
  - 资料页头即时正确
  - 活跃中的帖子展示页能自动刷新
  - 非活跃页面在下次进入时拿到新数据

用户感知上就已经足够一致。

### 为什么不使用整页刷新或清空整个缓存

原因：

- 这会带来不必要的：
  - 网络请求
  - 页面闪烁
  - 状态丢失
- 当前项目已经有明确的 query key 结构，不需要用最粗糙的方式解决局部一致性问题。

### 为什么缓存策略应收敛在 mutation hook，而不是页面层

原因：

- 缓存刷新与回填本质上是“数据写成功后的副作用”。
- 它天然属于 mutation 的职责边界。
- 页面层更适合只关心：
  - 提交
  - 成功提示
  - 页面跳转

## 实现顺序与依赖关系

### 第一步：确认第四步和第六步已稳定接通

依赖：

- `04-profile-route-shell.md`
- `06-profile-edit-page.md`

要求：

- 资料页父壳已经有 public profile query
- 编辑页已经有 editable profile query 和 update mutation 主链路

如果这两步未完成，第七步没有稳定缓存目标可操作。

### 第二步：补齐 `user` query key 与 mutation 返回类型

操作：

- 确认 `userKeys.publicProfile(profileId)`
- 确认 `userKeys.editableProfile(profileId)`
- 让编辑资料 mutation 返回完整资料快照

依赖：

- 依赖第一步的用户契约和第六步的 mutation 主链路

### 第三步：新增缓存辅助 helper

操作：

- 新建 `user.cache.ts`
- 封装：
  - current user 回填
  - profile cache 回填
  - post cache 失效

依赖：

- 依赖 `authKeys`
- 依赖 `userKeys`
- 依赖 `postKeys`

### 第四步：将缓存策略接入 `useUpdateEditableUserProfileMutation()`

操作：

- 在 mutation `onSuccess` 中按固定顺序：
  - cancel
  - backfill
  - invalidate

依赖：

- 依赖第三步 helper 已稳定

### 第五步：清理页面层零散缓存逻辑

操作：

- 确保 `updateProfile.tsx` 和 `EditProfileForm.tsx` 不再自带额外 invalidation

依赖：

- 依赖第四步 mutation hook 已承担完整职责

### 第六步：验证关键一致性场景

验证项：

- 编辑自己的头像后，左侧栏头像立即更新
- 编辑自己的名字后，底栏与侧栏名字立即更新
- 保存成功返回资料页后，资料头不闪旧值
- 返回资料页 `posts` tab 后，当前页作者信息会刷新
- 之后进入首页 / Explore / 帖子详情页时，作者信息已更新
- viewer like/save 状态缓存未被无意义清空

## 关键风险及应对策略

### 风险：仅 invalidation 不回填 `currentUser`，导致壳层明显闪旧值

问题：

- 左侧栏和底栏都依赖当前用户缓存。
- 如果只标记 stale，refetch 返回前会继续显示旧数据。

应对：

- 对 `auth.currentUser` 使用 `setQueryData` 直接回填
- 不把它和帖子列表缓存使用同一策略

### 风险：mutation 返回值太窄，缓存回填只能依赖额外 refetch

问题：

- 没有完整资料快照时，回填逻辑就无法准确生成 next cache value。

应对：

- 明确让 mutation 返回更新后的资料快照
- 以服务层返回值为缓存更新的唯一可信来源

### 风险：在飞行中的旧 query 覆盖刚回填的新数据

问题：

- 编辑成功前发起的旧请求，可能在 mutation 成功后才返回。

应对：

- 先 `cancelQueries`
- 再 `setQueryData`
- 最后对需要重新拉取的缓存做 invalidate

### 风险：无差别失效 `postKeys.all()`，误伤互动状态与无关页面

问题：

- 资料编辑不影响 viewer like/save 状态。
- 粗暴失效会引入额外请求并模糊边界。

应对：

- 只失效帖子展示相关 root：
  - `lists`
  - `details`
  - `profileScope(profileId)`
- 不失效 viewer engagement scope

### 风险：试图深层 patch 所有帖子缓存，导致实现复杂度爆炸

问题：

- 不同帖子查询返回的数据结构并不统一。
- 一次性 patch 全部缓存很容易漏掉某个分支。

应对：

- 只对高价值、低复杂度缓存做回填
- 对帖子展示缓存坚持失效为主

### 风险：缓存策略散落在 route、form、mutation 三处，后续无法维护

问题：

- 同一类缓存可能在不同文件里被重复更新或相互覆盖。

应对：

- 缓存刷新与回填统一收敛到 mutation hook 与缓存 helper
- 页面层不再自行管理这类副作用

### 风险：资料页 count 也被一起频繁 refetch，造成额外读取

问题：

- 名字、头像、bio 更新本身并不影响帖子数、收藏数、点赞数。

应对：

- 如果 `profileScope(profileId)` 同时包含 count 和 feed，第一版接受该 scope 的小范围额外失效
- 若后续确认 count 读放大明显，再把 feed root 与 count root 拆分

### 风险：非本人资料更新也回填了当前用户缓存

问题：

- 这会把当前登录用户数据污染成另一个 profile 的资料。

应对：

- 回填 `auth.currentUser` 前必须显式判断：
  - 当前缓存状态为 `authenticated`
  - 且 `currentUser.user.profileId === updatedProfile.profileId`

## 预期结果

本步骤完成后，资料编辑成功将不再只是“服务端数据已更新”，而会真正形成稳定的前端一致性闭环：

- 左侧栏和底栏的当前用户展示会立即更新
- 资料页头部不会在跳回后明显闪旧值
- 帖子相关作者展示会通过定向失效逐步更新
- 缓存策略集中、边界清晰，不会散落在页面层

这样第六步的独立编辑页才算真正完成从“可提交”到“可稳定使用”的最后一公里。
