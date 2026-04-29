# 多图帖子与本地草稿箱设计方案

## 范围

本文档定义 Snapgram 阶段二“多图帖子、媒体模型与本地草稿箱”的总体实现方案。

本期目标：

- 将当前单图帖子模型升级为最多 6 张图片的多图帖子模型。
- 继续复用现有 `content-actions` Function，新增创建和编辑帖子的服务端最终写入边界。
- 保留浏览器直传 Appwrite Storage 的上传路径，由 Function 负责最终落库、权限切换和一致性收口。
- 创建帖子支持图片压缩、拖拽排序、首图封面和持久化本地草稿箱。
- 编辑帖子支持增删改排图片，但不提供草稿能力。
- 帖子详情第一版支持类似小红书的图片轮播。
- 支持对现有少量单图帖子做一次性迁移，不要求长期兼容旧单图写入模型。

本期不包含：

- 云端草稿
- 跨设备同步草稿
- 视频、Live Photo 或其他非图片媒体
- SVG 帖子媒体支持
- 评论系统
- 详情模态路由
- 全站虚拟化或国际化

## 当前现状

当前相关文件：

- `app/features/post/components/PostForm.tsx`
- `app/components/shared/FileUploader.tsx`
- `app/features/post/services/post.service.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/api/post.actions.api.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/lib/image-metadata.ts`
- `app/routes/createPost.tsx`
- `app/routes/editPost.tsx`
- `app/routes/postDetails.tsx`
- `functions/content-actions/src/main.ts`
- `app/lib/appwrite/config.ts`
- `app/lib/validation/index.ts`
- `appwrite.config.json`
- `scripts/migrations/backfill-resource-permissions.mjs`

当前行为：

- 创建和编辑帖子仍是浏览器端直接写 `posts` row。
- 帖子模型仍以 `posts.imageId / imageUrl` 为唯一图片来源。
- 图片上传组件只支持单图选择。
- 详情页只渲染单图，不支持图片组。
- 前端已有图片宽高、比例桶和 placeholder 预计算工具，但没有上传前压缩。
- 阶段一已完成点赞、收藏和删帖的服务端化，`content-actions` Function 已上线并可复用。

当前 Appwrite 约束：

- 运行在 Appwrite Cloud 免费版约束下。
- `TablesDB` 事务只能覆盖数据库行写入，不能把 Storage 文件写入一起纳入同一个事务。
- 当前 `media` bucket 仍是公开读模型，不适合“先上传、后发布”的多图中间态。
- 远端 schema 由人工在 Appwrite Console 更新，本仓库只维护本地配置快照和迁移脚本。

## 已确认需求

已确认需求：

- 创建帖子和编辑帖子都要服务端化，沿用同一个 `content-actions` Function。
- 采用“浏览器直传 Storage，Function 负责最终落库”的方案。
- 允许直接修改 Appwrite 远端 schema，并对旧帖子做一次性迁移。
- 多图详情页第一版使用类似小红书的轮播体验。
- 图片压缩策略以 Appwrite Free 配额优先，由前端在上传前完成。
- 第一版图片处理采用原生浏览器能力、主线程串行执行。
- 媒体处理模块从第一版开始按“可迁移到 Worker”的接口分层设计。
- 第一版暂不引入图片压缩库。
- 创建帖子需要本地草稿箱：
  - 草稿只用于“创建帖子”
  - 草稿按 `accountId` 隔离
  - 同一浏览器、同一设备上，刷新页面和关闭浏览器后再次打开仍可恢复
  - 草稿需要保存：
    - `caption`
    - `location`
    - `tags`
    - 图片文件本体
    - 图片顺序
    - 每张图的本地预处理结果
  - 不做数量限制
  - 创建页顶部提供“草稿箱”按钮
  - 点击后打开抽屉，展示当前用户草稿列表
  - 草稿可点击进入继续编辑
  - 草稿可手动删除
  - 创建页保留“暂存草稿”和“发布”按钮
- 编辑帖子不需要草稿功能，只提供发布链路。
- 编辑帖子允许自由增删改排图片，但最终必须保持 `1-6` 张。
- 帖子媒体不再支持 SVG。

## 改了什么，改在哪里

### 1. 将 `posts` 从“单图源数据”重构为“帖子摘要 + 封面投影”

更新：

- `appwrite.config.json`
- 线上 Appwrite `posts` 表 schema
- `app/features/post/types/post.type.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`

设计：

- 现有 `posts.imageId / imageUrl / aspectRatioBucket / imagePlaceholder / imageWidth / imageHeight` 不再代表“唯一图片”，而是代表“封面图片投影字段”。
- 新增 `posts.mediaCount`，表示帖子当前图片总数。
- `posts` 继续承载：
  - `creator`
  - `caption`
  - `location`
  - `tags`
  - `searchText`
  - `status`
  - `likeCount / saveCount / commentCount`
  - 封面投影字段
  - `mediaCount`

这样，首页、搜索、个人页等只展示封面的列表查询，仍然可以只读 `posts` 表，不需要为每张卡片额外回查媒体表。

### 2. 新增 `postMedia` 表，作为帖子图片组的真实数据源

更新：

- `appwrite.config.json`
- 线上 Appwrite schema
- `app/lib/appwrite/config.ts`
- `functions/content-actions/src/config.ts`
- `app/vite-env.d.ts`
- `.env.local`
- `.env.migration.local`

新增表建议：

- 表 ID：`postMedia`
- 显示名：`Post Media`

建议字段：

- `post`
  - relationship
  - `manyToOne`
  - 指向 `posts`
- `fileId`
  - `varchar`
  - 必填
- `sortOrder`
  - `integer`
  - 必填
  - 从 `0` 开始
- `width`
  - `integer`
  - 可空
- `height`
  - `integer`
  - 可空
- `aspectRatioBucket`
  - enum
  - `1:1`、`3:4`、`4:3`
- `placeholder`
  - `text`
  - 可空

建议索引：

- `post_media_post_sort_idx`
  - `post + sortOrder`
  - 用于详情和编辑页按顺序加载
- `post_media_post_idx`
  - `post`
- `post_media_post_file_unique`
  - `post + fileId`
  - 防止同一帖子重复挂同一文件

读取约定：

- `posts` 是列表摘要源。
- `postMedia` 是详情页和编辑页的真实图片源。
- 详情页和编辑页不直接依赖 `posts` 反向 relationship 自动展开，而是显式按 `postId` 列出 `postMedia` rows 并按 `sortOrder` 排序，避免关系选择过宽和排序不透明。

### 3. 调整 Storage 权限模型，支持“私有上传，发布后公开”

更新：

- `appwrite.config.json`
- 远端 `media` bucket 权限
- `app/features/post/api/post.api.ts`
- `functions/content-actions/src/appwrite.ts`
- `functions/content-actions/src/config.ts`
- 新增 `functions/content-actions/src/post-media.ts` 或同类 helper
- `scripts/migrations/migrate-post-images-to-media.mjs`

远端 bucket 建议：

- 保持 `fileSecurity = true`
- bucket 级权限只保留 `create("users")`
- 移除 bucket 级 `read("any")`

上传阶段：

- 浏览器上传压缩后的图片时，文件权限设为当前账户私有：
  - `read(Role.user(accountId))`
  - `update(Role.user(accountId))`
  - `delete(Role.user(accountId))`

发布成功后：

- `content-actions` 将最终保留的图片权限切换为已发布状态：
  - `read(Role.any())`
- 已发布图片不再给客户端保留 `update/delete` 权限，避免绕过帖子写入链路直接删文件。

发布失败后：

- 前端对本次新上传文件做 best-effort 删除。
- 即使删除失败，也只会留下当前用户私有的孤儿文件，而不是公开脏资源。

### 4. 增加前端图片压缩和多图预处理链路

更新：

- `app/features/post/lib/image-metadata.ts`
- 新增 `app/features/post/lib/post-image-compression.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/services/post.service.ts`
- `app/lib/validation/index.ts`

策略：

- 仅接受：
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- 显式拒绝 `image/svg+xml`
- 第一版使用原生浏览器能力完成压缩、宽高读取、比例桶计算和 placeholder 生成。
- 第一版不引入图片压缩库。
- 第一版采用主线程串行处理，避免一次选择多张图片时并发压缩放大卡顿风险。
- 媒体处理模块需要拆成稳定的领域接口和可替换执行层：
  - 上层只依赖统一的图片处理输入输出契约
  - 第一版执行层使用主线程原生实现
  - 后续如果迁移到 Worker，只替换执行层，不改表单状态机、草稿箱和发布链路
- 新选中的图片先进入 `processing` 状态列表项，处理完成后再切到 `ready` 并显示缩略图。

默认压缩建议：

- 长边上限：`1600px`
- 首次导出格式：优先 `image/webp`
- 质量：`0.82`
- 单张目标体积上限：`1.2MB`
- 若首次导出仍超限，则降到：
  - 长边 `1400px`
  - 质量 `0.72`

输出结果：

- `compressedFile`
- `fileId` 由上传后返回
- `width / height`
- `aspectRatioBucket`
- `placeholder`

### 5. 重构帖子创建与编辑表单为多图编辑器

更新：

- `app/features/post/components/PostForm.tsx`
- `app/components/shared/FileUploader.tsx`
- 或新增：
  - `app/features/post/components/PostMediaUploader.tsx`
  - `app/features/post/components/PostMediaSortableList.tsx`
  - `app/features/post/components/PostMediaEditor.tsx`
- `app/lib/validation/index.ts`

改动：

- 创建表单支持选择 `1-6` 张图片。
- 支持拖拽调整顺序。
- 第一张图片即封面，排序变化会立即影响封面预览。
- 创建模式顶部提供 `草稿箱` 按钮，点击后打开草稿箱抽屉。
- 创建模式底部提供：
  - `暂存草稿`
  - `发布`
- 编辑模式不提供草稿入口，只保留普通返回入口和 `发布`。
- 多图编辑器使用“固定上传卡片 + 右侧图片列表”的结构：
  - 初始只显示一个上传卡片
  - 上传完成后，新图片项追加在上传卡片右侧
  - 上传卡片不参与排序
  - 图片列表项参与排序
- 上传卡片和图片列表项都固定为 `1:1` 比例。

表单数据不再是单个 `file`，而是“媒体项数组”：

- 已存在图片
- 新增未上传图片
- 新增已上传待发布图片
- 删除标记
- 当前顺序

新增图片项建议状态：

- `processing`
  - 刚被选中，正在执行压缩和元数据预处理
- `ready`
  - 已拿到压缩后文件、元数据和本地预览，可参与草稿保存和发布
- `failed`
  - 处理失败，允许用户删除或重试

交互要求：

- 用户选图后立即插入新的列表项，并显示 loading 状态。
- 处理完成前不显示最终缩略图。
- 处理完成后列表项显示缩略图。
- 图片列表项整张卡片都可作为拖拽目标，不额外拆分拖拽把手。
- 鼠标悬浮图片项时显示“查看”按钮，点击后打开本地大图预览。
- 只要列表中仍存在 `processing` 项，创建页的“暂存草稿”和“发布”都保持禁用，避免把半处理状态写入草稿箱或发布链路。
- 上传入口使用原生文件选择器，不要求支持拖动上传。

拖拽排序实现建议：

- 优先使用 `@dnd-kit` 这类聚焦排序的小型依赖，而不是自写 pointer drag。
- 原因是本期同时要求：
  - 桌面拖拽
  - 移动端可用
  - 顺序稳定
  - 代码不要演变成临时手写手势系统

### 6. 扩展 `content-actions`，增加 `post.create` 和 `post.update`

更新：

- `functions/content-actions/src/action.ts`
- `functions/content-actions/src/main.ts`
- 新增：
  - `functions/content-actions/src/create-post.ts`
  - `functions/content-actions/src/update-post.ts`
  - `functions/content-actions/src/post-media.ts`
  - 如有必要，新增图片权限 helper
- `app/features/post/api/post.actions.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.mutation.ts`

新增 action：

- `post.create`
- `post.update`

`post.create` 请求建议：

- `caption`
- `location`
- `tags`
- `media`
  - `fileId`
  - `sortOrder`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`

`post.update` 请求建议：

- `postId`
- `caption`
- `location`
- `tags`
- `media`
  - 直接传“最终媒体列表”
  - 每项要么引用已有 `mediaId`
  - 要么引用新上传 `fileId`
  - 并附带最终 `sortOrder`

Function 职责：

- 从执行上下文解析当前用户身份。
- 校验创建者身份、编辑者是否为作者。
- 校验媒体总数必须在 `1-6` 之间。
- 校验每个新上传 `fileId` 的私有权限属于当前账户。
- 在数据库事务中：
  - 创建或更新 `posts`
  - 创建、更新、删除 `postMedia`
  - 回写封面投影字段
  - 回写 `mediaCount`
- 事务成功后：
  - 将保留图片切换为公开可读
  - 删除被移除图片的 Storage 文件

### 7. 将前端写入链路改为“先私有上传，再 Function 发布”

更新：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/queries/post.mutation.ts`

创建帖子流程：

1. 用户在表单中完成多图编辑。
2. 前端执行压缩和元数据预处理。
3. 点击“发布”后，前端上传所有新图片到 Storage，权限为私有。
4. 全部上传成功后，调用 `content-actions.post.create`。
5. Function 成功落库并切换图片权限。
6. 前端清空草稿并失效缓存。

编辑帖子流程：

1. 加载现有 `postMedia` 列表。
2. 用户增删改排图片。
3. 点击“发布”后，仅上传本次新增图片，权限为私有。
4. 调用 `content-actions.post.update`，传最终媒体列表。
5. Function 事务化更新 `posts + postMedia`，再清理旧文件并公开保留文件。

### 8. 调整读模型，补齐详情轮播和编辑页媒体加载

更新：

- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`
- `app/features/post/mappers/post.mapper.ts`
- `app/features/post/types/post.type.ts`
- `app/features/post/queries/post.queries.ts`
- `app/routes/postDetails.tsx`
- `app/routes/editPost.tsx`
- 新增：
  - `app/features/post/components/PostMediaCarousel.tsx`
  - 如有必要，新增 `PostCarouselControls.tsx`

读路径设计：

- 首页、搜索、个人页、Explore：
  - 继续只读 `posts` 表上的封面投影字段
- 帖子详情：
  - 读取 `posts` 主记录
  - 再读取该帖子的 `postMedia` 列表
- 编辑页：
  - 读取 `posts` 主记录
  - 再读取该帖子的 `postMedia` 列表

详情轮播第一版：

- 横向滑动
- 保持媒体顺序
- 移动端支持手势滑动
- 桌面端支持左右箭头
- 提供页码或指示点
- 首版不做无限循环和缩放
- 第一版使用原生实现，不引入第三方轮播库。
- 轮播基础交互采用：
  - 横向滚动容器
  - CSS `scroll-snap`
  - 少量受控状态同步当前页
- 当前页索引建议由实际可见 slide 驱动，而不是仅靠按钮点击计数，优先使用 `IntersectionObserver` 同步可见页。
- 左右箭头、页码和指示点都基于当前索引驱动，并可点击切换到对应图片。
- 当前上限固定为 6 张图，原生实现足以覆盖第一版需求；如果后续出现更复杂的需求，再考虑引入轻量轮播库。

### 9. 新增旧单图数据迁移脚本

新增：

- `scripts/migrations/migrate-post-images-to-media.mjs`

更新：

- `appwrite.config.json`
- 如有必要，补充迁移说明文档

脚本职责：

- 扫描现有 `posts` rows。
- 对每条旧单图帖子创建一个 `postMedia` row：
  - `fileId = posts.imageId`
  - `sortOrder = 0`
  - 元数据来自现有封面字段
- 回填 `posts.mediaCount = 1`
- 将旧文件权限调整为“已发布公开读”模型
- 设计为幂等脚本，重复执行不会重复建 row

迁移完成后：

- 旧 `image*` 字段继续保留，但语义变为封面投影字段。
- 应用所有读写路径都切到新模型，不再把它们当成唯一媒体源。

### 10. 新增“创建帖子本地草稿箱”能力，只覆盖创建场景

新增：

- `app/features/post/drafts/create-post-draft.repository.ts`
- `app/features/post/drafts/create-post-draft.db.ts`
- `app/features/post/drafts/create-post-draft.type.ts`
- `app/features/post/drafts/useCreatePostDraftBox.ts`
- `app/features/post/components/CreatePostDraftDrawer.tsx`
- 如有必要，新增：
  - `app/features/post/components/CreatePostDraftList.tsx`
  - `app/features/post/components/CreatePostDraftRow.tsx`

更新：

- `app/features/post/components/PostForm.tsx`
- `app/routes/createPost.tsx`
- `app/features/auth/queries/auth.queries.ts`
- `package.json`

设计：

- 草稿只作用于“创建帖子”。
- 草稿按 `accountId` 隔离，避免不同账号串数据。
- 草稿持久化存储在浏览器本地 `IndexedDB`，不写 Appwrite。
- 为了降低直接操作原生 IndexedDB API 的样板代码，建议引入轻量封装依赖 `idb`。
- 草稿记录建议字段：
  - `draftId`
  - `accountId`
  - `caption`
  - `location`
  - `tags`
  - `mediaItems`
    - `clientMediaId`
    - `file`
    - `sortOrder`
    - `previewUrl`
    - `width`
    - `height`
    - `aspectRatioBucket`
    - `placeholder`
  - `createdAt`
  - `updatedAt`
- 草稿列表按 `updatedAt` 倒序展示，最新编辑的草稿排在最前。
- 草稿箱通过创建页顶部按钮打开抽屉，不新增独立路由页。
- 点击草稿列表项后，关闭抽屉并将对应草稿载入当前创建表单。
- 草稿支持手动删除。
- 草稿不做数量限制，也不做自动淘汰。
- 自动暂存继续保留，建议使用 `3s debounce`：
  - 首次产生有效编辑时，为当前创建会话分配稳定 `draftId`
  - 后续自动暂存和手动“暂存草稿”都更新同一条草稿，而不是反复创建新草稿
- 手动点击“暂存草稿”时：
  - 立即写入当前草稿
  - 给出成功反馈
  - 不自动离开页面
- 创建页可通过 query 参数如 `?draft=<draftId>` 标识当前正在编辑的草稿，便于刷新后重新载入同一条草稿。
- 创建成功后，清空当前草稿并关闭相关 query 参数。
- 用户登出后，不清空 IndexedDB 草稿；同一设备、同一浏览器下再次登录同一账号时仍可看到草稿箱内容。

这样可以同时满足：

- 保留 `File` / `Blob` 本体
- 跨刷新和跨浏览器重开继续恢复
- 不同账号隔离
- 通过草稿箱继续编辑历史草稿

## 为什么选择这个方案

### 为什么继续使用浏览器直传 Storage

- Appwrite Web SDK 已适合浏览器端上传大文件，避免“浏览器 -> Function -> Storage”的额外中转。
- 同步 Function 存在 30 秒超时约束，多图场景下把二进制也塞进 Function 风险更高。
- 浏览器直传更容易保留上传进度和重试体验。
- 最终写入仍由 Function 控制，因此安全边界和业务一致性仍然可以服务端收口。

### 为什么把 `posts` 保留为封面投影，而不是彻底去掉 `image*` 字段

- 当前首页、搜索、资料页、Explore 都已围绕 `posts.image*` 字段建立查询和卡片映射。
- 直接删除这些字段会把阶段二的读改造面放大到所有列表页。
- 将其改造成“封面投影字段”，可以保留现有高频列表查询的轻量性，同时让 `postMedia` 成为真实来源。
- 这符合“小红书式详情读全量媒体，feed 只读封面”的目标。

### 为什么这一期不把 `image*` 重命名为 `cover*`

- 把 `imageId / imageUrl / imagePlaceholder / imageWidth / imageHeight` 改成 `cover*` 语义上更准确，但本期收益不高。
- 现有首页、搜索、资料页、Explore、mapper、types 和组件都已围绕 `image*` 建立稳定读链路。
- 阶段二的核心复杂度在多图真实数据源、服务端最终写入、草稿箱和文件权限模型，而不在字段命名本身。
- 如果本期同时做字段更名，会扩大改造面并提高迁移成本，却不会实质提升阶段二的核心能力。
- 因此本期选择保留 `image*` 命名，只在语义上明确它们已经变为封面投影字段；后续若需要做 schema 清理，再单独处理命名重构。

### 为什么新建 `postMedia` 表，而不是把多图直接存进 `posts` 数组

- 多图并不是简单的 `url[]`，而是一组需要独立维护的子资源：
  - 每张图有自己的 `fileId`
  - 每张图有自己的 `width / height / placeholder / aspectRatioBucket`
  - 编辑时需要支持插入、删除、替换和重排
- 如果直接存在 `posts` 表里，通常会演变成多组并行数组，数据结构脆弱，顺序一旦错位就会出现元数据配错图片的问题。
- 编辑链路中，`post.update` 需要处理“保留旧图 + 删除旧图 + 插入新图 + 最终排序”的组合操作。用独立 `postMedia` rows 表达这些变更会比整体重写数组集合更清晰。
- 删除帖子和编辑帖子时都需要做文件清理。独立媒体表更适合作为“当前帖子到底挂了哪些文件”的真实来源。
- 详情页和列表页的读取需求不同：列表页只要封面，详情页和编辑页需要完整图片组。独立媒体表可以保持读模型分层，避免把 `posts` row 变成过胖的大对象。
- 当前上限虽然只有 6 张，但这仍然是一组可独立管理的子资源。新建 `postMedia` 表是更稳的长期结构。

### 为什么保留 `posts.mediaCount`

- `mediaCount` 不是绝对必需字段，但它和封面投影字段属于同一类摘要信息，适合保留在 `posts` 主记录上。
- 列表页、搜索结果和资料页卡片如果后续需要展示“多图”角标或图片数量，可以直接读取 `posts.mediaCount`，不必额外回查 `postMedia`。
- 在服务端调试、排查和运营回看数据时，`mediaCount` 能更直观地反映一个帖子当前是否为多图以及图片数量是否异常。
- 既然本期已经决定在 `posts` 上保留封面投影字段，那么同步保留 `mediaCount` 作为摘要字段是自然的延伸。
- 维护成本可控，因为 `mediaCount` 和封面投影字段都会在 `post.create / post.update` 的同一个数据库事务中回写，不会额外引入新的写入路径。

### 为什么草稿只做创建场景，而且采用本地持久化草稿箱

- 编辑已有帖子时，正式数据已经存在于服务端，继续叠加草稿箱会明显放大 diff、冲突和文件清理复杂度，收益低于创建场景。
- 本期草稿不仅要保存 `caption / location / tags`，还要保存图片文件本体、图片顺序和每张图的本地预处理结果，因此它本质上是“带二进制文件的结构化本地数据”，而不是简单表单缓存。
- `IndexedDB` 更适合这类数据：
  - 支持保存结构化对象以及 `File` / `Blob`
  - 支持按 `accountId`、`updatedAt` 等字段组织和查询草稿
  - 具备事务语义，适合把一条草稿和其媒体项作为一次完整写入处理
  - 能满足“刷新后、关闭浏览器后、同一设备再次登录仍可恢复”的持久化要求
- 原生 IndexedDB API 过于底层，直接使用会引入较多 `open / upgrade / transaction / request` 样板代码；这里更适合引入一个薄封装，而不是把存储细节散落到表单组件里。
- 推荐 `idb` 作为 IndexedDB 封装：
  - 它基本保持 IndexedDB 原始模型，只把事件式 API 收敛为 Promise 风格，学习和排障成本低
  - 体积小，适合当前“一个草稿仓库 + 少量索引查询”的需求，不会为了草稿箱引入一套更重的本地数据库抽象
  - 对 TypeScript 和数据库升级流程足够友好，后续如果新增草稿 schema 版本也容易维护
- 不优先选更重的 IndexedDB 封装库：
  - 像 Dexie 这类方案能力更强，但当前草稿箱并不需要复杂 query DSL、响应式本地数据库或同步扩展
  - 像 localForage 这类方案更偏“异步版 localStorage”心智，并且带有对 WebSQL / localStorage 的回退设计，不是本项目这种现代浏览器、结构化草稿仓库场景的最佳贴合点
- 不选 `localStorage`：
  - 只适合小体量字符串数据，草稿里的图片文件和预处理结果需要额外序列化，成本高且容易撞上配额
  - 它没有事务和索引能力，不适合草稿列表、按账号隔离和按更新时间排序
- 不选 `sessionStorage`：
  - 生命周期随 tab/session 结束而结束，不满足关闭浏览器后仍保留草稿的需求
  - 同样只适合轻量字符串，不适合保存图片文件本体
- 不选 React state / 内存 store：
  - 只覆盖当前运行时，刷新页面、关闭浏览器或登出后数据就会丢失
  - 适合作为“当前编辑态”，不适合作为真正的持久化草稿箱
- 不选 Appwrite 云端草稿：
  - 当前需求明确是“同一浏览器、同一设备持久保留”，并不要求跨设备同步
  - 一旦做云端草稿，就需要额外处理草稿表、草稿文件权限、未发布文件清理、登出登录后的同步与冲突，这会显著扩大阶段二范围
  - 草稿里包含尚未发布的图片文件，把它们提前上传到云端也会直接增加 Storage 占用和一致性治理成本
- 不选文件系统类 API：
  - 这类 API 依赖用户显式授权文件/目录访问，交互模型更像“用户把文件交给应用管理”，不适合发布表单里的无感草稿箱
  - 浏览器兼容性和权限行为比 IndexedDB 更复杂，不适合当前面向通用 Web 应用的第一版
  - 即便使用 Origin Private File System，本期也没有需要它才成立的超大文件、分块写入或离线编辑器级场景
- 草稿按 `accountId` 分桶，可以满足同一设备多账号隔离。
- 草稿箱抽屉比单一“离开前暂存一次”的模型更符合小红书类内容产品的长期创作心智：用户可以主动回看、继续编辑和删除未发布内容。

### 为什么第一版选择原生串行压缩，而不是压缩库或第一时间上 Worker

- 第一版上限固定为 6 张图片，采用主线程串行处理可以先控制复杂度，把重点放在多图状态机、草稿箱和最终发布链路上。
- 原生实现更容易精确控制：
  - 长边上限
  - 质量回退策略
  - 格式降级
  - 何时进入 `processing / ready / failed`
- 当前项目的真正复杂点不在“单次压缩能力”，而在“图片处理结果如何进入列表项、草稿箱、上传和发布”。原生方案更适合把整条处理链路封装成项目自己的契约。
- 压缩库虽然能减少一部分底层样板代码，但第一版已经明确不启用 Worker，库的优势会被削弱，反而会引入额外依赖和抽象层。
- 从第一版开始就将媒体处理模块拆成“稳定接口 + 可替换执行层”，后续若迁移到 Worker，只需替换执行层，不需要重写表单和草稿箱逻辑。

### 为什么上传文件要先私有，再由 Function 切换公开

- 多图发布和编辑都存在“图片已上传，但最终未落库”的中间态。
- 如果 bucket 继续全局公开读，中间态文件会直接变成公开脏资源。
- 私有上传 + 发布后公开，可以把失败残留压缩为“当前用户私有孤儿文件”，风险更低。

### 为什么创建和编辑都改走 `content-actions`

- 多图编辑本质是多步写入：
  - 更新帖子文本
  - 写多条媒体记录
  - 维护排序
  - 回写封面
  - 清理旧文件
- 这些步骤如果继续放在浏览器端，失败后很容易出现 row 和文件状态漂移。
- 阶段一已经把敏感互动写入收进 Function，本期继续沿用同一个服务端边界，架构更一致。

## 实现顺序与依赖关系

### 第一步：定义 schema 和环境变量契约

依赖：

- 用户手动修改远端 Appwrite schema 的方式已确定。

工作：

- 在 `appwrite.config.json` 中补齐 `postMedia` 表和 `posts.mediaCount`。
- 在本地 env 契约中新增：
  - `VITE_APPWRITE_POST_MEDIA_TABLE_ID`
  - `APPWRITE_POST_MEDIA_TABLE_ID`
- 明确 bucket 新权限模型。

验收：

- 本地类型和配置能引用 `postMedia` 表。
- 远端 schema 修改清单完整。

### 第二步：实现前端图片压缩和多图表单模型

依赖：

- schema 契约已确定。

工作：

- 增加图片压缩工具。
- 使用原生浏览器能力实现第一版串行压缩，不引入图片压缩库。
- 将图片处理模块拆成“领域接口 + 主线程执行实现”，为后续迁移到 Worker 预留替换点。
- 调整 `PostValidation`，改为 `1-6` 张图片校验和 SVG 拒绝。
- 重构 `PostForm` 的媒体项数据结构。
- 落地多图预览、删除和排序交互。

验收：

- 创建和编辑表单都能在本地维护稳定的多图状态。
- 新图预处理结果可复用给上传和 Function 请求。
- 新选图片会先显示 `processing` 列表项，处理完成后再显示缩略图和本地大图预览入口。

### 第三步：扩展 `content-actions` 的创建和编辑 action

依赖：

- schema 和前端请求模型已确定。

工作：

- 扩展 `action.ts` 请求契约。
- 在 Function 中新增 `post.create`、`post.update`。
- 增加 `postMedia` row 的事务化写入和封面投影回写。
- 增加新旧文件权限切换和清理逻辑。

验收：

- Function 可独立完成创建和编辑最终落库。
- 非作者更新会被拒绝。

### 第四步：切换前端创建和编辑写入链路

依赖：

- Function 的 `post.create`、`post.update` 已可用。

工作：

- `post.service.ts` 不再直接 `createRow / updateRow` 帖子。
- 改成：
  - 上传私有文件
  - 调 Function 最终发布
  - 失败后删除本次新上传文件
- 继续沿用 React Query mutation 和缓存失效体系。

验收：

- 网络层不再出现浏览器端直接写 `posts` 或 `postMedia` 的最终写入请求。
- 创建成功会删除当前草稿记录，编辑成功不会影响草稿箱其他草稿。

### 第五步：切换读路径和详情轮播

依赖：

- `postMedia` 表已有数据写入能力。

工作：

- 详情页和编辑页接入 `postMedia` 列表查询。
- 新增详情轮播组件。
- 保持列表页继续使用 `posts` 封面投影字段。

验收：

- 详情页按顺序展示完整图片组。
- 编辑页能稳定回显旧图顺序。

### 第六步：编写并执行旧数据迁移脚本

依赖：

- `postMedia` 表、Function 和读写模型已可用。

工作：

- 实现 `migrate-post-images-to-media.mjs`。
- 在远端现有少量数据上执行迁移。
- 验证每条旧帖子都具备一条 `postMedia` 记录。

验收：

- 迁移后旧帖子详情可显示图片组。
- `posts.mediaCount` 正确为 `1`。

### 第七步：回归和清理

依赖：

- 新旧数据都能走新读写路径。

工作：

- 回归创建、编辑、详情、首页、搜索、个人页。
- 校验文件权限是否符合“私有上传，发布后公开”。
- 清理不再使用的旧单图写入代码。

验收：

- 阶段二验收项全部满足。

### 第八步：实现创建帖子持久化草稿箱

依赖：

- 多图表单状态已稳定。

工作：

- 新增 IndexedDB 草稿 repository 和轻量封装。
- 接入 `3s debounce` 自动暂存。
- 增加创建页顶部“草稿箱”按钮和抽屉列表。
- 增加底部“暂存草稿”按钮。
- 建立 `draftId` 和 query 参数的映射，支持刷新后恢复当前草稿。
- 保证登出后本地草稿保留，再次登录同一账号仍可读取。

验收：

- 同一浏览器、同一设备上，刷新页面和关闭浏览器后仍可恢复草稿。
- 不同账号只能看到自己的草稿。

## 关键风险及应对策略

### 风险一：发布失败后留下孤儿文件

风险：

- 浏览器已上传文件，但 Function 拒绝或中途失败。

应对：

- 上传文件默认私有，不公开暴露。
- 前端记录本次新上传 `fileId[]`，失败后立即删除。
- Function 内对已接管但最终移除的文件也做补偿删除。
- 迁移脚本和后续运维可以按私有权限模式识别异常文件。

### 风险二：`posts` 封面投影与 `postMedia` 真实列表漂移

风险：

- 如果封面和 `mediaCount` 没有在同一次事务中更新，列表页会展示错误封面或错误数量。

应对：

- `post.create` 和 `post.update` 中，`posts` 投影字段和 `postMedia` rows 必须在同一个 `TablesDB` 事务内写入。
- 客户端禁止直接写 `posts.image*` 和 `mediaCount`。

### 风险三：bucket 权限配置错误，导致未发布图片公开可见

风险：

- 如果远端 bucket 仍保留 `read("any")`，则私有上传方案失效。

应对：

- 将 bucket 权限调整作为阶段二前置条件。
- 在迁移和上线验证中，抽查未发布上传文件是否只能被当前用户读取。

### 风险四：非作者编辑或陈旧页面触发无效上传

风险：

- 用户在陈旧编辑页中点发布，可能先上传新图，再被 Function 拒绝。

应对：

- 编辑入口继续要求先成功加载 editor 数据。
- Function 做最终作者校验。
- 即使被拒绝，新图也是私有文件，并在失败后立即清理。
- 如后续发现无效上传明显偏多，再补轻量 preflight author check。

### 风险五：多图编辑 diff 逻辑复杂，误删旧图或顺序错乱

风险：

- 编辑场景同时涉及：
  - 保留旧图
  - 删除旧图
  - 插入新图
  - 混合排序

应对：

- `post.update` 不接收“增删操作列表”，而接收“最终媒体列表”。
- Function 统一做 diff，避免客户端和服务端各自维护一套操作序列。
- `sortOrder` 始终由最终数组顺序唯一决定。

### 风险六：持久化草稿箱保存图片文件后触发浏览器存储配额或数据损坏

风险：

- 草稿保存 `File` / `Blob` 本体后，IndexedDB 占用会明显高于纯文本草稿。
- 某些浏览器在极端低存储空间下可能清理站点数据，或导致写入失败。

应对：

- 草稿图片在进入草稿箱前复用压缩后的文件，而不是原始文件，控制本地占用。
- IndexedDB 写入失败时，前端提供明确错误提示，不伪装成已成功保存。
- 草稿记录只保存当前发布实际需要的数据，不额外缓存冗余派生结果。
- 草稿读取失败时，允许用户删除损坏草稿并重新开始创建。

### 风险七：自动暂存与手动暂存并存，导致重复草稿或覆盖错误

风险：

- 如果自动暂存每次都新建记录，草稿箱会快速堆积重复草稿。
- 如果当前编辑态没有稳定 `draftId`，手动保存可能覆盖错误对象。

应对：

- 首次产生有效编辑时即分配稳定 `draftId`。
- 自动暂存和手动“暂存草稿”只更新同一条草稿。
- 从草稿箱进入编辑后，显式绑定当前 `draftId`，避免保存到错误草稿。

### 风险八：迁移脚本重复执行导致重复媒体记录

风险：

- 手工迁移时常会重复 dry-run / run / verify。

应对：

- 迁移脚本设计为幂等。
- 通过 `post + fileId` 唯一约束或迁移前查重避免重复写入。
- 先 dry-run，再 run，再 verify。

### 风险九：详情页一次性读取全量媒体，后续扩展受限

风险：

- 如果未来图片数继续增长，详情页查询模型会变重。

应对：

- 当前上限固定为 6 张，详情页一次性读取全部媒体是可控的。
- feed 列表继续只读封面投影字段，不把全量媒体带入高频列表。

## 阶段完成后的预期状态

- 创建帖子和编辑帖子都通过 `content-actions` 最终发布。
- 帖子模型支持 `1-6` 张图片。
- `postMedia` 成为图片组真实数据源。
- `posts.image*` 继续存在，但语义变为封面投影字段。
- 首页、搜索、Explore、个人页继续高效读取封面。
- 帖子详情页按顺序展示完整图片轮播。
- 创建页支持持久化本地草稿箱、定时暂存、手动“暂存草稿”和草稿抽屉继续编辑。
- 草稿按账号隔离，并在同一浏览器、同一设备上跨刷新、跨关闭浏览器和登出后重新登录继续保留。
- 编辑页支持增删改排图片，但不引入草稿。
- 浏览器上传的中间态文件默认私有，发布成功后才公开。
