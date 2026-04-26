# 用户资料功能步骤六：实现独立编辑页

## 目的

本步骤用于将当前占位的：

- `app/routes/updateProfile.tsx`

重构成真正可用的独立编辑资料页，完成以下能力：

- 展示当前头像
- 选择并替换新头像
- 编辑 `name`
- 编辑 `bio`
- 只读展示 `email`
- 保存成功后返回资料页

经过第一步和第二步后，项目已经具备或将具备：

- 编辑资料专用的用户契约
- 按 `profileId` 获取 editable profile 的查询能力
- 头像上传、用户 row 更新、旧头像清理和失败回滚链路

但当前项目仍缺少真正的页面接入层，也就是：

- 编辑页路由本身
- 编辑页表单组件
- 专用头像上传组件
- 编辑页对应的 query / mutation hooks
- 编辑页的 owner-only 访问控制

本步骤的目标是：

- 在现有路由结构中落地独立编辑页，而不是继续保留占位实现。
- 编辑页只开放本期允许编辑的字段：
  - `avatar`
  - `name`
  - `bio`
- 明确把以下字段排除在编辑提交流之外：
  - `email`
  - `username`
- 复用当前项目已经成熟的：
  - `React Hook Form`
  - `zodResolver`
  - `PageLoadingState / PageErrorState / PageEmptyState`
  - route module + query hook + mutation hook 的组织方式
- 在进入编辑页时尽早判断 owner 身份，避免他人直访时先请求 editable profile 再跳转。
- 保持第七步边界清晰：
  - 第六步先把编辑页路由、表单和 mutation 主链路接通
  - 第七步再统一处理缓存刷新与回填

本步骤不负责：

- 资料页壳路由
- tab 内容页
- 全局缓存一致性最终方案
- 头像裁剪
- 用户名占用校验
- 邮箱修改

## 验收标准

本步骤完成后，应满足以下验收标准：

- `app/routes/updateProfile.tsx` 不再是占位实现。
- 编辑页路由会读取 `params.id` 作为 `profileId`。
- 编辑页默认依赖 `rootLayout` 的 `RequireAuth` 处理登录态，不重复新增第二套 auth guard。
- 编辑页会在 owner / visitor 判断完成后再决定是否查询 editable profile。
- 非本人直访：
  - `/update-profile/:id`
  会直接重定向到：
  - `/profile/:id/posts`
- 编辑页会通过 query 加载 editable profile 快照，而不是直接复用 `CurrentUserDto` 作为完整编辑数据源。
- 编辑页首次加载时：
  - 显示页面级 loading state
- editable profile 查询失败时：
  - 显示页面级 error state
  - 提供重试能力
- editable profile 返回 `null` 时：
  - 显示页面级 empty / not found state
- 编辑页表单只展示以下可编辑项：
  - `avatar`
  - `name`
  - `bio`
- 编辑页表单会展示只读 `email`。
- 编辑页不会把 `email` 放进 mutation 提交载荷。
- 编辑页不会展示可编辑 `username` 字段。
- 编辑页会使用独立的头像上传组件，而不是直接复用帖子图片 `FileUploader`。
- 新头像选择后可立即看到本地预览。
- 当前头像未变更时，保存不会触发头像上传。
- 仅修改 `name / bio` 时，保存不会误清空现有 `imageId / imageUrl`。
- 点击保存时：
  - 调用编辑资料专用 mutation
  - 保存中按钮 disabled
  - 不允许重复提交
- 保存成功后：
  - 显示成功反馈
  - 跳回该用户资料页
- 点击取消时：
  - 返回 `/profile/:id/posts`
- 编辑页有 route 级 `ErrorBoundary`，用于承接非预期异常。
- 第六步不会把“侧边栏、资料页头部、帖子作者头像同步刷新”的完整处理散落在页面内部；这些由第七步统一收敛。

## 改了什么，改在哪里

### 一、在 `user` feature 中补齐编辑页专用 query / mutation 层

建议新增：

- `app/features/user/queries/user.keys.ts`
- `app/features/user/queries/user.queries.ts`
- `app/features/user/queries/user.mutations.ts`

建议职责如下：

- `user.keys.ts`
  - 提供 editable profile 查询 key
- `user.queries.ts`
  - 提供：
    - `useEditableUserProfileQuery(profileId)`
- `user.mutations.ts`
  - 提供：
    - `useUpdateEditableUserProfileMutation()`

这里不建议让：

- `routes/updateProfile.tsx`

直接调用 `user.api.ts` 或 `user.service.ts`。

原因：

- 当前项目已经形成：
  - service
  - query hook
  - route / component
  的稳定分层。
- 编辑页也应该沿用同一套结构，而不是绕开 React Query。

### 二、在 `user.type.ts` 和校验层中补齐编辑页表单契约

改动位置：

- `app/features/user/types/user.type.ts`
- `app/lib/validation/index.ts`

建议新增或明确：

- `EditableUserProfileFormValues`
- `EditProfileValidation`

建议表单值只包含真正可编辑的字段，例如：

- `name`
- `bio`
- `avatarFile`

这里不建议把：

- `email`
- `username`

也放进 form values，再靠提交时手动剔除。

原因：

- 这会弱化第一步建立的“窄提交契约”边界。
- 一旦 `email / username` 出现在 form values 中，后续非常容易被误接入 mutation。

建议校验规则：

- `name`
  - 继续与当前注册流程口径保持一致，避免注册和编辑出现两套名字长度规则
- `bio`
  - 与当前 `users.bio` schema 上限保持一致
- `avatarFile`
  - 可为空
  - 有值时做客户端类型和体积校验

这里建议给头像增加一个远小于 bucket 上限的客户端限制，而不是完全沿用 bucket 的：

- `50MB`

原因：

- 头像属于高频、小体积媒体，不需要允许接近 bucket 上限的文件进入上传链路。
- 当前项目运行在 Appwrite Cloud 免费版约束下，应该尽量避免不必要的大文件上传。

### 三、新增专用头像上传组件，而不是复用帖子图片上传组件

建议新增：

- `app/features/user/components/AvatarUploader.tsx`

建议职责：

- 只处理单文件头像选择
- 展示当前头像预览
- 展示新头像本地预览
- 管理 object URL 的创建与释放
- 暴露：
  - `onChange(file: File | null)`

这里不建议直接复用当前的：

- `app/components/shared/FileUploader.tsx`

原因：

- 当前 `FileUploader` 是为帖子大图设计的：
  - 预览比例偏大
  - 交互文案面向“帖子图片”
  - 内部还会准备图片元数据
  - 表单接口是 `File[]`
- 编辑头像页需要的是：
  - 单文件
  - 头像语义
  - 小预览
  - 不需要比例桶和 placeholder 这类帖子专属逻辑

继续复用 `FileUploader` 只会让编辑页为了迁就旧组件而引入无关复杂度。

### 四、在 `user` feature 中新增编辑页表单组件

建议新增：

- `app/features/user/components/EditProfileForm.tsx`

建议职责：

- 使用 `react-hook-form` 管理表单
- 使用 `zodResolver(EditProfileValidation)` 处理校验
- 接收 editable profile 初始数据
- 渲染：
  - 头像上传区
  - `name`
  - `bio`
  - 只读 `email`
  - `Save / Cancel`
- 提交时调用：
  - `useUpdateEditableUserProfileMutation()`

建议表单内部处理：

- 顶部 inline submit error
- 保存中状态
- 无变更时的 no-op 保护

这里建议把“是否发生变更”的判断纳入表单组件，而不是让 route module 再次比较。

原因：

- 变更判断依赖：
  - 当前名字
  - 当前 bio
  - 当前头像文件是否替换
- 这些都属于表单上下文，更适合放在表单组件内统一处理。

### 五、将 `updateProfile.tsx` 改造成真正的 route module

改动位置：

- `app/routes/updateProfile.tsx`

本步骤中，`updateProfile.tsx` 建议承担以下职责：

- 读取 `params.id`
- 读取当前 viewer：
  - 复用 `useCurrentUserQuery()`
- 判断当前 viewer 是否与 `params.id` 对应的 profile owner 相同
- 在 owner 判定通过后，发起：
  - `useEditableUserProfileQuery(profileId)`
- 按编辑页页面状态渲染：
  - loading
  - error
  - empty
  - form

这里建议 route module 的结构尽量参考当前：

- `app/routes/editPost.tsx`

原因：

- `editPost.tsx` 已经验证了“路由页壳 + query loading/error/empty + 表单组件”的组织方式。
- 编辑资料页与编辑帖子页属于同一类页面：
  - 都是独立编辑路由
  - 都需要先拉取初始数据
  - 都要处理页面级反馈态

### 六、在路由层尽早做 owner-only 访问控制

改动位置：

- `app/routes/updateProfile.tsx`

本步骤必须明确：

- 编辑页的越权访问控制应发生在 editable profile 查询之前

建议判断方式：

- `useCurrentUserQuery()` 返回 authenticated user
- 比较：
  - `currentUser.profileId`
  - `params.id`

若不相等，则直接：

- `<Navigate to={/profile/:id/posts} replace />`

这里不建议先查 editable profile，再根据结果决定是否跳转。

原因：

- editable profile 本身就是私有编辑数据，不应先对非 owner 发起读取。
- 当前设计已经明确，非本人访问编辑页应重定向，而不是展示无权限页。

### 七、补齐编辑页页面级反馈态与边界

改动位置：

- `app/routes/updateProfile.tsx`

建议复用现有反馈组件：

- `PageLoadingState`
- `PageErrorState`
- `PageEmptyState`
- `RouteErrorState`

建议行为：

- 当前 viewer 尚未可用或 editable profile query pending：
  - `PageLoadingState`
- editable profile query error：
  - `PageErrorState`
- editable profile 为 `null`：
  - `PageEmptyState`
- route module 非预期异常：
  - `ErrorBoundary + RouteErrorState`

这里不建议把 editable profile 缺失直接抛给 route `ErrorBoundary`。

原因：

- “找不到可编辑资料”更接近页面空态或不可用态，而不是技术异常。
- `ErrorBoundary` 应保留给真正的非预期错误。

### 八、明确取消与保存后的导航策略

改动位置：

- `app/features/user/components/EditProfileForm.tsx`
- `app/routes/updateProfile.tsx`

建议导航统一为：

- 成功后：
  - `/profile/:id/posts`
- 取消时：
  - `/profile/:id/posts`

这里不建议默认使用：

- `navigate(-1)`

原因：

- 编辑页允许用户直接刷新、直接访问或从不同入口进入。
- `navigate(-1)` 在这些场景下会引入不稳定行为：
  - 返回到非资料页
  - 返回到站外
  - 没有可返回历史

对编辑页而言，资料页本身就是最自然、最稳定的返回目标。

### 九、本步骤只接通页面和 mutation 主链路，不提前分散缓存失效逻辑

改动位置：

- `app/features/user/queries/user.mutations.ts`
- `app/routes/updateProfile.tsx`

本步骤建议：

- mutation hook 先负责稳定执行更新请求
- 成功后完成：
  - toast
  - 导航

对于以下缓存一致性问题：

- 侧边栏头像
- 顶栏头像
- 资料页头部信息
- 帖子作者头像 / 名字

统一留到第七步集中处理。

这里不建议在第六步就把：

- `auth`
- `profile`
- `post`

各类缓存失效逻辑零散写进表单组件或 route module。

原因：

- 这样会让第六步同时承担：
  - 页面接入
  - mutation 主链路
  - 全局缓存策略
- 问题定位会明显变差，也会与第七步边界重叠。

## 为什么选择这个方案

### 为什么编辑页继续使用独立 route，而不是回到模态框

原因：

- 这一步的工作流已经包含：
  - 数据预取
  - 文件选择与预览
  - 提交状态
  - owner-only 访问控制
- 当前项目已经有独立编辑帖子页的成熟样板。
- 独立路由比模态框更适合移动端滚动、键盘弹起和未来头像裁剪扩展。

### 为什么编辑页组件放在 `features/user`，而不是继续堆到 `features/profile`

原因：

- 资料页壳属于页面编排逻辑，适合放在：
  - `features/profile`
- 编辑资料表单本身只操作用户领域数据：
  - editable profile query
  - update profile mutation
  - avatar uploader

因此本步骤更合理的划分是：

- 页面壳与 route guard：`features/profile` / route module
- 编辑表单与 mutation：`features/user`

这样边界更清晰，也更符合当前项目按领域组织组件的方式。

### 为什么不复用帖子图片 `FileUploader`

原因：

- 帖子图片上传与头像上传不是同一种交互。
- 头像上传不需要：
  - 大尺寸卡片预览
  - 图片元数据准备
  - 多余的帖子文案
  - `File[]` 风格接口

专用头像组件的实现成本很低，但能显著降低页面适配成本和后续维护负担。

### 为什么只读 `email` 应展示在 UI 中，但不进入可写契约

原因：

- 产品上用户需要看到当前邮箱，确认这是哪个账号的资料。
- 但邮箱真正的数据源不仅是 `users` row，还关联 Appwrite account。
- 如果把它放进表单提交流，就会制造“资料页看似可改、实际不能安全改”的错误边界。

因此最合理的做法是：

- UI 展示 email
- 提交契约完全不包含 email

### 为什么 `username` 本期既不展示可编辑，也不纳入提交流

原因：

- 当前产品并未要求用户名编辑流。
- `username` 带有唯一性语义，一旦开放，就要一起处理：
  - 占用校验
  - 全站引用一致性
  - 失败提示

本步骤的目标是把独立编辑页主链路先打通，而不是同时开启第二条更复杂的资料编辑子流程。

### 为什么取消和成功后都应稳定返回资料页，而不是 history back

原因：

- 编辑资料页天然属于资料页的附属页面。
- 当前路由参数已经提供稳定返回目标。
- 直接跳回：
  - `/profile/:id/posts`
  比依赖浏览器历史更可控，也更易测试。

### 为什么第六步不提前把所有缓存刷新写死

原因：

- 第七步已经被明确拆分为“缓存刷新与回填”。
- 如果第六步现在就临时加一批局部 invalidation，很容易变成：
  - 表单里一部分
  - mutation hook 里一部分
  - route 回调里一部分

先把编辑页主链路跑通，再在第七步统一梳理缓存策略，是更稳的工程顺序。

## 实现顺序与依赖关系

### 第一步：确认第一步和第二步的用户资料基础能力已经就绪

依赖：

- `01-user-profile-contract.md`
- `02-avatar-upload-and-profile-update-flow.md`

要求：

- 已能按 `profileId` 获取 editable profile
- 已有编辑资料专用窄更新接口
- 已有头像替换服务链路

如果这两步未完成，本步骤不应直接从 route 层开始硬接。

### 第二步：在 `user` feature 中补齐 query / mutation hooks

操作：

- 新增 `user.keys.ts`
- 新增 `user.queries.ts`
- 新增 `user.mutations.ts`

依赖：

- 依赖第一步和第二步的数据层 / service 已稳定

原因：

- 编辑页 route 和表单组件都应消费 hook，而不是直接碰 API / service

### 第三步：补齐表单值类型与 zod 校验

操作：

- 在 `user.type.ts` 中新增表单值类型
- 在 `validation/index.ts` 中新增 `EditProfileValidation`

依赖：

- 依赖编辑页允许修改的字段范围已经明确

### 第四步：实现专用头像上传组件

操作：

- 新增 `AvatarUploader.tsx`
- 补齐预览、替换、object URL 清理和文件校验错误展示

依赖：

- 依赖表单字段契约已明确

原因：

- 编辑表单一开始就需要稳定的头像交互，不应先用帖子上传组件做临时适配

### 第五步：实现 `EditProfileForm`

操作：

- 接入 RHF + zod
- 接入 editable profile 初始值
- 接入 mutation
- 补齐保存、取消、错误提示、提交中状态

依赖：

- 依赖第三步和第四步

### 第六步：替换 `updateProfile.tsx` 占位页

操作：

- 读取 `profileId`
- 读取当前 viewer
- 做 owner redirect
- 接 editable profile query
- 渲染 loading / error / empty / form
- 增加 route `ErrorBoundary`

依赖：

- 依赖第二步和第五步

### 第七步：验证编辑页主链路

验证项：

- 本人访问编辑页
- 他人直访编辑页被重定向
- 仅修改 `name`
- 修改 `bio`
- 替换头像
- 默认头像用户替换头像
- 保存成功跳回资料页
- 取消返回资料页
- editable profile 加载失败的重试

这一步完成后，才能进入第七步统一处理缓存刷新与回填。

## 关键风险及应对策略

### 风险：owner 判断发生太晚，非本人会先请求 editable profile

问题：

- 这会产生无意义请求，也会让私有编辑数据暴露在错误的读取路径上。

应对：

- 在 route module 中先拿当前 viewer
- 先比较：
  - `currentUser.profileId`
  - `params.id`
- owner 判定通过后再启用 editable profile query

### 风险：`email` 被误带进 mutation，重新破坏编辑边界

问题：

- 页面为了显示只读 email，如果直接把它纳入 form values，很容易被顺手带进提交逻辑。

应对：

- email 只作为展示值，不进入提交 schema
- mutation 输入仍然只使用编辑页窄契约

### 风险：`username` 被顺手加入表单，导致范围失控

问题：

- 一旦把用户名输入框加上，后续就必须补一整套唯一性和错误提示逻辑。

应对：

- 本步骤明确不展示 username 编辑能力
- 即使 editable profile query 返回 username，也只作为内部数据，不进入 UI

### 风险：继续复用帖子图片上传组件，导致页面承担无关逻辑

问题：

- 会把头像上传页面绑到帖子图片预处理和大图预览上。

应对：

- 新建专用 `AvatarUploader`
- 只保留头像场景真正需要的交互

### 风险：默认头像没有 `imageId`，表单把它误判为异常数据

问题：

- 当前默认头像可能来自 `avatars.getInitials()`
- 这种情况本来就没有存储文件

应对：

- editable profile 允许：
  - `imageId = null`
  - `imageUrl` 仍为可展示头像
- 表单和预览组件都应把它视为正常初始态

### 风险：头像本地预览产生 object URL 泄漏

问题：

- 用户多次替换头像文件时，如果不回收旧 URL，会造成浏览器内存泄漏。

应对：

- `AvatarUploader` 统一管理 object URL
- 新预览替换旧预览时立即回收
- 组件卸载时再次清理

### 风险：没有变更仍然提交，造成不必要的 Appwrite writes

问题：

- 当前项目运行在免费版约束下，无意义写入和潜在上传都应该避免。

应对：

- 表单内增加 no-op 判断
- 无变更时：
  - 禁用保存
  - 或提交时直接短路并给出轻量反馈

### 风险：保存成功后页面立即返回资料页，但缓存仍显示旧数据

问题：

- 这是用户最容易感知到的不一致之一。

应对：

- 本步骤先保证：
  - mutation 成功
  - 跳转链路稳定
- 第七步统一补齐：
  - 当前用户缓存
  - 资料页缓存
  - 帖子作者展示缓存

### 风险：取消按钮使用 `navigate(-1)`，在直访场景下返回不可控

问题：

- 用户可能刷新后直开编辑页，或从站外进入。

应对：

- 取消统一返回：
  - `/profile/:id/posts`

### 风险：在第六步就把缓存策略和 UI 接入一起做满，导致改动面过大

问题：

- 编辑页本身已经包含：
  - route guard
  - query
  - form
  - avatar upload
  - mutation
- 如果此时再把全部缓存一致性加进来，定位问题会变困难。

应对：

- 第六步聚焦编辑页主链路
- 第七步专注缓存刷新与回填

## 预期结果

本步骤完成后，项目将拥有一个真正可访问、可提交的独立编辑资料页：

- `/update-profile/:id` 不再是占位页
- 本人可编辑头像、名字和简介
- 邮箱可见但不可编辑
- 非本人直访会被稳定重定向
- 编辑页具备完整的 loading / error / empty / submit 反馈
- 保存和取消都能稳定返回资料页

这样资料功能才算真正补齐“展示页 + 编辑页”两个核心入口，而第七步则可以在这个基础上继续完善全局缓存一致性。
