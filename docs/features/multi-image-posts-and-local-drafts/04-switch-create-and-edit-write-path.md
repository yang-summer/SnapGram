# 多图帖子与本地草稿箱步骤四：切换前端创建和编辑写入链路

## 目的

本步骤用于把前两步和第三步已经准备好的能力真正接到浏览器端发布入口上。

前置条件已经具备：

- 步骤二已经把创建页和编辑页重构为多图媒体编辑器模型。
- 步骤三已经让 `content-actions` 提供：
  - `post.create`
  - `post.update`
  - 多图版 `post.delete`

但当前项目里的真实前端写入路径仍然是旧的单图直写模式：

- `post.service.ts` 仍然直接调用：
  - `uploadPostImage()`
  - `createPostRow()`
  - `updatePostRow()`
- `uploadPostImage()` 仍然给新文件设置公开读权限。
- `PostForm.tsx` 仍然围绕：
  - `file[0]`
  - `PreparedImageDraft`
  - 单图 `currentImageId / currentImageUrl`
  来提交数据。
- `useCreatePostMutation()` 和 `useUpdatePostMutation()` 仍然以旧的单图 `CreatePostInput / UpdatePostInput` 为输入。

本步骤的目标有七个：

- 让创建和编辑都改走“浏览器直传私有文件 + Function 最终发布”的新链路。
- 停止浏览器端直接写 `posts` 或未来的 `postMedia` 最终数据。
- 让前端只负责：
  - 上传 staged private files
  - 组装最终媒体列表 payload
  - 调用 `content-actions`
  - 在失败时清理本次新上传文件
- 让 `PostForm` 改为消费步骤二的多图编辑器状态，而不是继续使用单图字段。
- 显式处理第三步返回的 warning flag，避免客户端把“已成功但补偿失败”误判成整体失败。
- 保持现有 React Query mutation、导航和缓存失效体系，不额外引入新的全局状态层。
- 为后续草稿箱接入预留成功回调边界，但不在本步骤真正实现 IndexedDB 草稿删除。

本步骤不包含：

- 不切换详情页为 `postMedia` 读路径
- 不实现详情轮播
- 不实现本地草稿箱仓库、抽屉、自动暂存和手动暂存
- 不执行旧数据迁移
- 不在浏览器端新增对 `posts` / `postMedia` 的最终写入兜底分支

## 验收标准

本步骤完成后，应满足以下验收标准：

- 创建帖子时，浏览器端不再直接调用 `tablesDB.createRow(posts)`。
- 编辑帖子时，浏览器端不再直接调用 `tablesDB.updateRow(posts)`。
- 浏览器端对帖子创建/编辑的直接网络写操作只剩两类：
  - `storage.createFile()` / `storage.deleteFile()`，用于 staged upload 与失败清理
  - `functions.createExecution()`，用于调用 `content-actions`
- 新上传文件在浏览器端创建时使用私有 staged permissions，而不是公开读。
- `createPost()` 和 `updatePost()` 的 service 输入已经从单图模型切到多图媒体编辑器模型。
- 创建提交时，payload 可以表达最多 6 张新图的最终顺序。
- 编辑提交时，payload 可以表达：
  - 保留的 existing media
  - 新上传的 local media
  - 被删除的旧图通过“最终列表缺席”隐式表达
- 任一上传或发布失败时，前端会对“本次新上传成功的 staged files”做 best-effort cleanup。
- 第三步 Function 返回 success + warning 时：
  - 前端仍然按成功处理
  - 但会展示明确 warning toast
- `useCreatePostMutation()` 与 `useUpdatePostMutation()` 显式关闭 retry，避免重复发帖或重复更新。
- 创建成功后：
  - 导航到 `/posts/:postId`
  - 失效列表和个人主页相关缓存
- 编辑成功后：
  - 导航到 `/posts/:postId`
  - 失效详情、编辑页、列表和个人主页相关缓存
- 对于编辑链路，前端已经能拿到构造 `post.update` 必需的 existing media 标识；如果完整详情读路径仍未切换，则至少要有 editor-only 的最小 `postMedia` 读取能力。

## 改了什么，改在哪里

### 一、把创建和编辑的“上传 + 发布 + 清理”编排下沉到 service 层

改动位置：

- `app/features/post/services/post.service.ts`
- 如有必要，新增：
  - `app/features/post/lib/post-publish-payload.ts`
  - `app/features/post/lib/post-upload-cleanup.ts`

当前状态：

- `PostForm.tsx` 直接组织旧单图入参
- `post.service.ts` 直接：
  - 上传一张图
  - 写 `posts` row
  - 编辑时再删旧图
- 旧写链路把“UI 状态”“上传”“数据库写入”“失败补偿”混在一个单图流程里

本步骤建议把发布编排稳定为以下 service 边界：

- `createPost(input)`
  - 接收：
    - 文本字段
    - 创建模式的多图媒体项数组
    - 当前用户身份
  - 负责：
    - 上传全部新图为 staged private files
    - 组装 `post.create` payload
    - 调 `createPostWithContentAction()`
    - 在失败时清理本次新上传文件
- `updatePost(input)`
  - 接收：
    - `postId`
    - 文本字段
    - 编辑模式的最终媒体项数组
    - 当前用户身份
  - 负责：
    - 只上传 `kind: 'local' && status: 'ready'` 的新增媒体
    - 组装 `post.update` payload
    - 调 `updatePostWithContentAction()`
    - 在失败时清理本次新上传文件

这里不建议把“上传 staged files + Function publish + cleanup”写回 `PostForm.tsx`。

原因：

- 这是一条业务发布链路，不是纯表单展示逻辑。
- 失败补偿和 warning 处理需要被 mutation 复用，而不是只绑在某个组件里。
- 后续草稿发布、创建页继续编辑、可能的快捷发布入口都应共用同一套 service 编排。

### 二、切换浏览器上传权限模型：从公开读改为 staged private upload

改动位置：

- `app/features/post/api/post.api.ts`
- `app/lib/appwrite/permissions.ts`

当前状态：

- `uploadPostImage(file, ownerAccountId)` 仍然调用：
  - `storage.createFile()`
  - `buildPublicOwnerPermissions(ownerAccountId)`
- 这意味着浏览器一上传成功，文件就已经公开可读

本步骤建议改成：

- 保留浏览器直传 Storage
- 但改为上传“私有暂存文件”
- 只在 Function 发布成功后，由 `content-actions` 切换到公开读

建议新增或替换的前端权限 helper：

- `buildPrivateStagedFilePermissions(accountId)`
  - `read(user(accountId))`
  - `update(user(accountId))`
  - `delete(user(accountId))`

建议的 API 形状：

- `uploadPostMediaFile(file, ownerAccountId)`
- `deletePostMediaFile(fileId)`

这里不建议继续复用 `buildPublicOwnerPermissions()`。

原因：

- 第三步已经把“发布成功后公开”定义成服务端责任。
- 如果前端还在直接创建公开文件，那么整条 staged upload 设计就失去意义。
- 失败后留下的孤儿文件也会从“当前用户私有垃圾”变成“公开脏资源”。

### 三、在前端定义真正用于发布的 create/update 输入类型，而不是继续沿用旧单图模型

改动位置：

- `app/features/post/types/post.type.ts`

当前状态：

- `CreatePostInput` 仍然要求：
  - `file`
  - `preparedImageMetadata`
- `UpdatePostInput` 仍然要求：
  - `nextFile`
  - `currentImageId`
  - `currentImageUrl`
  - 单图封面投影字段

这些类型和步骤二、步骤三都已经不匹配。

本步骤建议新增前端发布输入类型，例如：

- `CreatePostPublishInput`
  - `creatorProfileId`
  - `ownerAccountId`
  - `caption`
  - `location`
  - `tags`
  - `mediaItems`
    - 仅允许创建模式下的 ready local items
- `UpdatePostPublishInput`
  - `postId`
  - `ownerAccountId`
  - `caption`
  - `location`
  - `tags`
  - `mediaItems`
    - 允许：
      - ready existing items
      - ready local items

同时建议新增 service 结果类型，直接承接第三步 action 返回，而不是继续沿用旧单图 `PostMutationResult`：

- `CreatePostPublishResult`
  - `postId`
  - `mediaCount`
  - `filePublicationFailed`
- `UpdatePostPublishResult`
  - `postId`
  - `mediaCount`
  - `filePublicationFailed`
  - `removedFileCleanupFailed`

这里不建议继续让 `PostMutationResult` 作为 create/update 的返回值。

原因：

- 旧类型中的 `imageId / imageUrl` 属于单图时代的“唯一图片”语义。
- 第三步 Function 已经把返回值重心切换到：
  - `postId`
  - `mediaCount`
  - warning flags
- 前端如果继续强行映射回旧单图结果，只会把多图语义重新压扁。

### 四、增加“媒体编辑器状态 -> Function payload”的纯映射层，避免组件里手写 JSON

改动位置：

- 新增 `app/features/post/lib/post-publish-payload.ts`
- 或在 `post.service.ts` 内部抽出同名纯函数

当前状态：

- 旧 `PostForm` 提交只需要：
  - 取 `file[0]`
  - 填几项 image metadata
- 新链路需要：
  - 保留最终顺序
  - 区分 existing / local
  - 在上传完成后把 local item 转成 `fileId`
  - 在 update 模式下表达最终媒体列表

本步骤建议把 payload 构造拆成纯函数：

- `buildCreatePostActionPayload(input, uploadedFileIdByClientMediaId)`
- `buildUpdatePostActionPayload(input, uploadedFileIdByClientMediaId)`

建议输入：

- 文本字段
- 最终 `mediaItems`
- `uploadedFileIdByClientMediaId`

建议输出：

- 第三步定义好的 `post.create` request body
- 第三步定义好的 `post.update` request body

映射规则应明确：

- create：
  - 所有项都必须是 ready local item
  - 最终按数组顺序生成 `sortOrder`
- update：
  - existing item 输出：
    - `type: 'existing'`
    - `mediaId`
    - `sortOrder`
  - local item 输出：
    - `type: 'new'`
    - `fileId`
    - `sortOrder`
    - `width / height / aspectRatioBucket / placeholder`

这里不建议让 `PostForm` 自己拼接 payload。

原因：

- payload 构造本质上是业务序列化，不是 UI 逻辑。
- 这层逻辑后续会被创建页、编辑页、草稿恢复后的发布流程共同依赖。
- 提前做成纯映射层，最容易单测和排查。

### 五、重构 `PostForm` 提交逻辑，改为消费步骤二的多图编辑器状态

改动位置：

- `app/features/post/components/PostForm.tsx`
- 如有必要，更新：
  - `app/routes/createPost.tsx`
  - `app/routes/editPost.tsx`

当前状态：

- `PostForm` 仍然：
  - 用 `PostFormValues.file`
  - 依赖 `PreparedImageDraft`
  - `nextFile = values.file[0]`
- 编辑模式仍然通过 `currentImageId / currentImageUrl` 传旧图

本步骤应改成：

- RHF 继续只管理文本字段：
  - `caption`
  - `location`
  - `tags`
- 媒体部分直接消费步骤二的媒体编辑器状态：
  - `items`
  - `hasProcessingItems`
  - `hasReadyItems`
  - `mediaError`
- 提交时先调用：
  - `validatePostMediaItemsForSubmit(items, mode)`
- 通过校验后，再把：
  - 文本字段
  - `items`
  - 当前用户身份
  交给 `createPost()` 或 `updatePost()`

建议的 UI 行为：

- 只要存在 `processing` 项：
  - 提交按钮禁用
- 存在媒体级错误时：
  - 使用 `InlineErrorAlert` 或媒体区域错误文案展示
- create/update pending 时：
  - 阻止重复提交

这里不建议为了兼容旧代码，继续保留 `file[0]` 的旁路逻辑。

原因：

- 一旦保留单图旁路，后续会反复污染：
  - 提交校验
  - draft save
  - payload mapping
  - upload cleanup
- 第四步的目标就是彻底切走旧写入模型，而不是在新旧模型间长期双轨。

### 六、为编辑链路前移最小 `postMedia` 读取能力，避免 `post.update` 缺少 existing `mediaId`

改动位置：

- 建议新增 `app/features/post/api/post-media.api.ts`
- 或在 `app/features/post/api/post.api.ts` 中增加 editor-only `postMedia` 查询
- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.queries.ts`

这是第四步最容易被低估的一点。

第三步 `post.update` 的 payload 已经明确要求：

- existing 项必须传 `mediaId`

但当前编辑页拿到的仍然只是：

- `posts.imageId`
- `posts.imageUrl`
- 封面投影字段

这不足以表达真正的多图 update。

因此这里推荐做一个“最小前移”，只为编辑链路补齐必要读能力：

- 新增 editor-only 查询：
  - `listPostMediaByPostIdForEditor(postId)`
- 让 `getPostEditorInitialData(postId)` 返回：
  - 文本字段
  - 封面投影字段
  - `existingMediaItems`

注意，这不是把第五步整个读路径提前。

第四步只需要 editor route 拿到：

- `mediaId`
- `fileId`
- `sortOrder`
- `imageUrl`
- `width / height / aspectRatioBucket / placeholder`

第五步仍然负责：

- 详情页切到 `postMedia`
- 详情轮播
- 更通用的读路径整理

这里不建议硬撑着用当前单图 editor 数据去“伪造” update payload。

原因：

- `post.update` 的 existing item 没有 `mediaId` 就不完整。
- 依赖 `posts.imageId` 只能表达封面，不能表达完整媒体组。
- 如果第四步不补 editor-only `postMedia` 读取，就不能声称“编辑写入链路已经真正切换完成”。

### 七、调整 mutation、缓存失效、导航和 warning UX

改动位置：

- `app/features/post/queries/post.mutation.ts`
- `app/features/post/components/PostForm.tsx`
- 如有必要，更新：
  - `app/routes/createPost.tsx`
  - `app/routes/editPost.tsx`

当前状态：

- `useCreatePostMutation()` 只失效 `postKeys.lists()`
- `useUpdatePostMutation()` 失效：
  - `detail`
  - `editor`
  - `lists`
- 两个 mutation 都没有显式声明 `retry: false`
- `PostForm` 只区分“成功”或“抛错”，还没有第三步 warning flag 的 UI 分支

本步骤建议改动：

- create mutation：
  - 显式 `retry: false`
  - 成功后失效：
    - `postKeys.lists()`
    - `postKeys.profileRoot()`
- update mutation：
  - 显式 `retry: false`
  - 成功后失效：
    - `postKeys.detail(postId)`
    - `postKeys.editor(postId)`
    - `postKeys.lists()`
    - `postKeys.profileRoot()`
- `PostForm` 根据结果分三类 toast：
  - 纯成功：
    - “Post published successfully.”
    - “Post updated successfully.”
  - 成功但 `filePublicationFailed`：
    - 主提示仍是成功
    - 附加 warning：“Post was published, but media publication is still incomplete.”
  - update 成功但 `removedFileCleanupFailed`：
    - 主提示仍是成功
    - 附加 warning：“Post was updated, but some removed media files could not be cleaned up.”

这里不建议把 warning flag 当成异常抛出。

原因：

- 第三步已经明确 warning 语义属于“事务内成功，事务外补偿失败”
- 如果前端把它再变回 error，就会诱导用户重试 create/update
- create 重试会直接带来重复帖子风险

### 八、为未来草稿箱预留“发布成功后清理草稿”的回调边界，但不提前实现草稿仓库

改动位置：

- `app/features/post/components/PostForm.tsx`
- 如有必要，更新：
  - `app/routes/createPost.tsx`

总体设计文档在第四步验收里写了：

- 创建成功会删除当前草稿记录

但项目当前还没有草稿仓库和 `draftId` 概念，这属于第八步的工作。

因此本步骤建议只做“接线位预留”，例如：

- `PostForm` 支持可选：
  - `onCreatePublishSuccess(result)`
  - `currentDraftId?`

当前阶段：

- 如果没有草稿功能，这个回调就是空实现

到第八步：

- 再由创建页把：
  - 当前 `draftId`
  - 删除草稿逻辑
  接进来

这里不建议为了满足总体文档的一句验收描述，就在第四步提前落一个半成品草稿仓库。

原因：

- 草稿箱真正复杂点在：
  - IndexedDB schema
  - 媒体文件持久化
  - 按账号隔离
  - 列表与抽屉交互
- 第四步只需要把“成功后有机会清理草稿”这个边界预留好即可。

## 为什么选择这个方案

### 为什么把上传、发布、清理编排放在 service 层，而不是 `PostForm`

原因：

- `PostForm` 的职责应聚焦在：
  - 文本字段
  - 媒体编辑器状态展示
  - 提交触发
- staged upload、payload mapping、best-effort cleanup 都属于业务写入编排
- 这些逻辑未来会被：
  - 创建页
  - 编辑页
  - 草稿恢复后的发布
  共同复用

把它们放在 service 层，后续最容易：

- 单测
- 复用
- 排查上传残留
- 统一处理 warning flag

### 为什么前端只负责上传文件和调用 Function，而不再直接写 `posts`

原因：

- 第三步已经把最终一致性边界收口到 `content-actions`
- 浏览器端如果继续直接写 `posts`，就会绕过：
  - `postMedia` 事务写入
  - staged ownership 校验
  - 文件权限切换
  - removed media cleanup

所以第四步的本质不是“换个 API 名字”，而是让浏览器端退出最终落库职责。

### 为什么要显式把 mutation `retry` 设为 `false`

原因：

- create 不是幂等操作
- update 虽然语义上可重复，但在 staged upload 存在时，重试会带来新的 fileId 与清理复杂度
- 第三步已经把“已成功但有 warning”的情况设计成 success，前端没有理由再自动重试

即使当前库默认不重试 mutation，这里也建议显式写出来。

原因：

- 这是高风险写操作
- 显式声明比依赖框架默认值更安全，也更容易代码审查

### 为什么第四步要前移“编辑页最小 `postMedia` 读能力”

原因：

- `post.update` 的 payload 需要 existing `mediaId`
- 当前 editor query 只有 `posts` 封面投影字段
- 不前移这部分最小读取能力，编辑写入链路就只能：
  - 退回单图思维
  - 或者根本无法正确提交多图 update

这里前移的只是 editor-only 依赖，不是把第五步整体并进来。

这样做的好处：

- 第四步可以真正闭环“编辑提交”
- 第五步仍然保留为“详情页与通用读路径切换”
- 阶段边界仍然清楚

### 为什么只预留草稿清理回调，而不在第四步提前实现草稿删除

原因：

- 第四步的核心是发布链路切换，不是本地持久化
- 草稿删除只有在第八步草稿仓库落地后才有实际意义
- 先留回调位，可以避免第八步再回头改整个发布成功流程

这是最小、最稳的做法。

## 实现顺序与依赖关系

### 第一步：冻结前端发布输入、返回结果和 warning 语义

工作：

- 在 `post.type.ts` 中定义：
  - `CreatePostPublishInput`
  - `UpdatePostPublishInput`
  - `CreatePostPublishResult`
  - `UpdatePostPublishResult`
- 移除 create/update 对旧单图 `PostMutationResult` 的依赖
- 对齐第三步：
  - `filePublicationFailed`
  - `removedFileCleanupFailed`

依赖：

- 依赖步骤二已冻结媒体编辑器状态模型
- 依赖步骤三已冻结 `post.create / post.update` action contract

说明：

- 类型先稳定，后面的上传编排和 payload adapter 才不会来回改。

### 第二步：切换 Storage upload API 到 staged private permissions

工作：

- 更新 `app/lib/appwrite/permissions.ts`
- 更新 `post.api.ts`：
  - `uploadPostImage()` 改为 staged private upload
  - `deletePostImage()` 保留为通用 file cleanup 能力，或重命名为 `deletePostMediaFile()`

依赖：

- 依赖步骤一环境和 bucket/fileSecurity 契约已就绪
- 依赖步骤三 Function 已准备接管文件权限发布

说明：

- 这是第四步的基础门槛；如果上传仍然默认公开，后续所有前端清理和 warning 设计都会变形。

### 第三步：增加 payload adapter 和 staged cleanup helper

工作：

- 新增 `post-publish-payload.ts`
- 在 service 中补齐：
  - `uploadNewMediaItems()`
  - `cleanupUploadedMediaFiles()`
  - `buildUploadedFileIdMap()`

依赖：

- 依赖第一步发布输入类型已稳定
- 依赖第二步上传 API 已改成 staged private

说明：

- 先把纯映射和补偿 helper 搭好，再切 create/update，避免两条写链路各自手写一遍。

### 第四步：先切创建帖子写入链路

工作：

- 重构 `createPost()`：
  - 上传全部 new local media
  - 构造 `post.create` payload
  - 调 `createPostWithContentAction()`
  - 失败后 cleanup 本次上传文件
- `PostForm` 创建分支改为提交多图媒体项数组

依赖：

- 依赖第三步 helper 已稳定

说明：

- create 链路不依赖 existing `mediaId`，比 update 更容易先闭环验证。

### 第五步：为编辑页前移最小 `postMedia` editor 读取能力

工作：

- 新增 editor-only `postMedia` 查询
- 调整 `PostEditorInitialData` 或新增：
  - `PostEditorPublishInitialData`
- 让编辑页可以拿到：
  - existing `mediaId`
  - `fileId`
  - 顺序和媒体元数据

依赖：

- 依赖第三步 Function/类型契约稳定

说明：

- 这一步是 update 写链路真正可用的前置条件。
- 它不是第五步详情页读路径切换的替代，而是第四步对编辑提交的最小补充。

### 第六步：切换编辑帖子写入链路

工作：

- 重构 `updatePost()`：
  - 上传新增 local media
  - 组装最终媒体列表
  - 调 `updatePostWithContentAction()`
  - 失败后 cleanup 本次新增上传文件
- `PostForm` 编辑分支改为提交最终媒体项数组，而不是：
  - `nextFile`
  - `currentImageId`

依赖：

- 依赖第五步编辑页已经能拿到 existing `mediaId`
- 依赖第四步 create 链路已跑通

说明：

- update 复用 create 的 staged upload 和 cleanup 逻辑，只在 payload 构造上多一层 existing/new 区分。

### 第七步：补齐 mutation、导航、warning toast 和草稿成功回调预留

工作：

- 更新 `post.mutation.ts`
  - 显式 `retry: false`
  - 补齐缓存失效范围
- 更新 `PostForm.tsx`
  - success toast
  - warning toast
  - `navigate(/posts/:postId)`
  - 可选 `onCreatePublishSuccess`

依赖：

- 依赖第四步和第六步 service 已可工作

说明：

- 到这一步，前端写入切换才算真正完成，不只是 service 代码换了调用目标。

### 第八步：局部验证与旧单图写代码清理

工作：

- 验证：
  - 创建 1 张图
  - 创建 6 张图
  - 编辑只重排 existing
  - 编辑新增 1-6 张新图
  - 编辑删除旧图
  - 上传成功、Function 失败后的 staged cleanup
  - success + warning toast
- 清理：
  - 停止 create/update 使用：
    - `createPostRow()`
    - `updatePostRow()`
    - 单图 `CreatePostInput / UpdatePostInput`

依赖：

- 依赖前七步完成

说明：

- 这一步完成后，网络层的最终写入职责就已经彻底收口到 Function。

## 关键风险及应对策略

### 风险一：部分文件上传成功，但 Function 调用失败，留下 staged orphan files

问题：

- create/update 都可能出现：
  - 前几张图上传成功
  - 后续上传失败
  - 或全部上传成功但 Function 返回 error

应对：

- service 层记录“本次上传成功的 fileIds”
- 任意失败都对这批 fileIds 做 best-effort cleanup
- cleanup 只针对本次新增上传文件，不触碰 existing media

### 风险二：Function 返回 success + warning，但前端误判成失败并触发重试

问题：

- 第三步已经明确：
  - warning 不是整体失败
- 如果前端把 warning 当 error，会造成：
  - create 重复发帖
  - update 再次上传新文件

应对：

- service 层只把真正的 action error 抛异常
- warning flags 以成功结果返回
- mutation 显式 `retry: false`
- UI 上用 warning toast，而不是 error toast

### 风险三：编辑页仍只拿到单图封面投影，无法构造合法的 `post.update` payload

问题：

- `posts.imageId` 只代表封面
- update payload 需要的是 existing `mediaId`

应对：

- 在第四步前移 editor-only `postMedia` 查询
- 不接受“先拿封面图硬凑 payload”的过渡写法
- 如果阶段联调必须临时分步，也只能先切 create，不要宣称 edit 已完成

### 风险四：新旧权限 helper 混用，导致 staged file 一上传就公开

问题：

- 当前项目已有 `buildPublicOwnerPermissions()`
- 如果开发时不留意，很容易继续误用在 post upload 上

应对：

- 为帖子上传新增语义明确的 helper 名称：
  - `buildPrivateStagedFilePermissions()`
- 在 `post.api.ts` 里把上传 API 名称也改成 staged 语义
- 回归时显式检查上传后的文件权限是否仍为私有

### 风险五：缓存失效范围不够，导致创建或编辑后 profile feed / count 显示旧数据

问题：

- 当前 create mutation 只失效 `postKeys.lists()`
- 这不会覆盖：
  - `postKeys.profileRoot()`
  - `postKeys.profilePostCount()`

应对：

- create/update 都补齐 `postKeys.profileRoot()` 失效
- 详情和 editor query 在 update 成功后也继续失效
- 不新增手写本地 cache patch，先保持失效模型简单可靠

### 风险六：`PostForm` 同时维护媒体编辑器状态和旧 `file[]` 字段，形成双事实来源

问题：

- 一旦保留双轨：
  - payload 到底取谁
  - 错误到底展示谁
  - submit disable 到底看谁
  都会开始漂移

应对：

- 第四步明确切掉 create/update 对旧 `file[]` 字段的依赖
- 文本字段归 RHF
- 媒体顺序和媒体就绪状态只认步骤二的 editor state

### 风险七：总体文档要求“创建成功删除当前草稿”，但草稿箱步骤尚未落地

问题：

- 如果第四步强行落一个半成品 draft cleanup，会把发布链路和本地持久化提前耦合

应对：

- 第四步只预留 `onCreatePublishSuccess` / `currentDraftId?`
- 第八步草稿箱落地后，再把真正的草稿删除逻辑挂进去
- 文档上明确区分：
  - 这一步提供边界
  - 草稿仓库实现属于后续步骤

### 风险八：编辑时用户新增多张图，部分上传成功后再次点击提交，导致重复 staged files

问题：

- 如果 pending 状态不统一，用户可能在上一轮未结束前再次触发 submit

应对：

- submit 按钮在 mutation pending 时强制禁用
- `PostForm` 在 pending 期间不允许再次提交
- service 内部不做“静默复用上一轮上传结果”的复杂逻辑，直接依赖按钮禁用和 mutation 单次执行

## 预期结果

本步骤完成后，项目会获得一个真正可运行的“前端多图发布链路”：

- 创建和编辑都不再由浏览器直接写帖子最终数据。
- 浏览器端只负责上传私有 staged files、调用 `content-actions`、以及失败时清理本次新上传文件。
- create/update 的 payload 已和步骤二的媒体编辑器状态、步骤三的 Function 契约完全对齐。
- warning flag 会被正确处理成“成功但需提醒”，而不是“失败并重试”。
- 编辑链路已经具备提交 existing/new 混合媒体列表的最小读写闭环。
- 第五步只需要继续切详情页与通用读路径，而不用再回头修第四步的发布模型。
