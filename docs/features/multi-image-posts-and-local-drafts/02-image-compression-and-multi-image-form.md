# 多图帖子与本地草稿箱步骤二：实现前端图片压缩和多图表单模型

## 目的

本步骤用于把当前“单图上传表单”重构成一个可承载阶段二后续能力的前端媒体编辑器。

第一步已经完成了资源契约准备：

- `posts` 将保留封面投影字段
- `postMedia` 将成为真实图片组来源
- `content-actions` 和客户端后续都能读取 `postMedia` 表 ID

但当前前端仍然存在明显的单图硬编码：

- `PostForm` 仍然只处理 `file[0]`
- `FileUploader` 只支持单图选择和替换
- `PreparedImageDraft` 只描述单个文件
- `PostValidation` 没有表达 `1-6` 张图片和 SVG 拒绝
- 创建/编辑页还没有“处理中 / 就绪 / 失败 / 可排序”的媒体状态模型

本步骤的目标有六个：

- 在浏览器端完成多图图片压缩、格式筛选、宽高提取、比例桶计算和 placeholder 生成。
- 将帖子表单从“单个文件字段”升级为“媒体项数组 + 文本字段”的结构。
- 为创建页和编辑页建立统一的媒体编辑状态模型。
- 让排序、删除、重试、本地预览和提交禁用条件建立在同一个媒体状态机上。
- 保持实现可直接对接后续的 `post.create / post.update` Function 契约。
- 为后续本地草稿箱预留兼容的数据形状，但本步骤不真正落地草稿持久化。

本步骤不包含：

- 不改 Appwrite 写入链路
- 不实现 `content-actions.post.create / post.update`
- 不接入本地草稿箱
- 不接入详情页媒体轮播
- 不切换编辑页为真实 `postMedia` 列表读取

## 验收标准

本步骤完成后，应满足以下验收标准：

- 创建表单可以一次选择 `1-6` 张图片。
- 仅接受：
  - `image/jpeg`
  - `image/png`
  - `image/webp`
- `image/svg+xml` 会在选择阶段和校验阶段都被明确拒绝。
- 每张新图片在本地都会经历：
  - `processing`
  - `ready`
  - `failed`
  三态之一。
- 处理完成前，不显示最终缩略图，也不允许提交。
- 处理完成后，图片项具备：
  - 压缩后的 `File`
  - `width / height`
  - `aspectRatioBucket`
  - `placeholder`
  - 本地预览 URL
- 列表顺序可以通过拖拽调整，排序后的第一张图即当前封面。
- 创建和编辑表单共享同一套媒体项类型与排序交互。
- 文本字段继续由 React Hook Form 管理；媒体项不再作为普通 `File[]` 塞进单一字段。
- 媒体编辑状态的唯一事实来源清晰，不会同时在 RHF、局部 state 和子组件内部各存一份顺序。
- 当前列表中只要仍存在 `processing` 项，提交按钮必须禁用。
- 删除本地图片、替换选择、组件卸载时，已创建的 object URL 会被正确释放。

## 改了什么，改在哪里

### 一、引入前端图片处理管线，取代当前“只算 metadata”的单图准备逻辑

改动位置：

- 新增 `app/features/post/lib/post-image-compression.ts`
- 更新 `app/features/post/lib/image-metadata.ts`
- 更新 `app/features/post/types/post.type.ts`

当前状态：

- `image-metadata.ts` 只负责：
  - 读取图片宽高
  - 计算比例桶
  - 生成 placeholder
- `PostForm` 和 `FileUploader` 仍然把原图直接留给后续上传链路

本步骤建议把图片处理拆成两层：

- `image-metadata.ts`
  - 保留为底层图片元数据工具
  - 负责：
    - `loadImageFromFile()`
    - `pickNearestAspectRatioBucket()`
    - `createImagePlaceholderDataUrl()`
- `post-image-compression.ts`
  - 作为帖子媒体处理的领域入口
  - 负责：
    - 校验 MIME 类型
    - 读取图片
    - 缩放到目标长边
    - 使用 `canvas.toBlob()` 导出压缩结果
    - 在体积超限时执行第二轮降质/降边长
    - 生成最终上传文件与元数据

建议在 `post.type.ts` 中新增压缩结果类型，例如：

- `PreparedPostImageAsset`
  - `file`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`

以及失败结果辅助类型，例如：

- `PostImagePreparationErrorCode`
  - `unsupported_type`
  - `empty_file`
  - `decode_failed`
  - `compress_failed`

推荐的默认策略：

- 首选输出格式：`image/webp`
- 首轮长边上限：`1600`
- 首轮质量：`0.82`
- 单张目标体积上限：`1.2MB`
- 若首轮仍超限：
  - 第二轮长边：`1400`
  - 第二轮质量：`0.72`
- 若浏览器不支持 `image/webp` 导出：
  - 回退到 `image/jpeg`

这里不建议继续沿用“先用原图预览，再在提交前另算 metadata”的模式。

原因是：

- 后续草稿箱要保存压缩后的文件，而不是原始手机大图。
- 后续提交链路要上传压缩后的文件。
- 当前列表卡片需要围绕最终文件建立尺寸、placeholder 和预览，而不是围绕原图建立一套、上传前再重算一套。

### 二、重构帖子类型定义，建立“媒体项数组”而不是单个 `file` 字段

改动位置：

- `app/features/post/types/post.type.ts`

当前状态：

- `PostFormValues.file: File[]`
- `PreparedImageDraft` 只适合单文件
- `CreatePostInput` / `UpdatePostInput` 仍是单图形状

本步骤需要先改的是“前端编辑态类型”，不是最终 Function payload。

建议新增前端媒体项类型：

- `PostMediaProcessStatus`
  - `processing`
  - `ready`
  - `failed`
- `ExistingPostMediaEditorItem`
  - `kind: 'existing'`
  - `clientMediaId`
  - `mediaId?`
  - `fileId?`
  - `imageUrl`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`
  - `status: 'ready'`
- `LocalPostMediaEditorItem`
  - `kind: 'local'`
  - `clientMediaId`
  - `status`
  - `file`
    - `processing / failed` 时可暂存原始 `File`
    - `ready` 时替换为压缩后 `File`
  - `previewUrl`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`
  - `errorMessage?`
- `PostMediaEditorItem`
  - `ExistingPostMediaEditorItem | LocalPostMediaEditorItem`

建议新增或调整以下表单相关类型：

- `PostTextFormValues`
  - `caption`
  - `location`
  - `tags`
- `PostMediaEditorState`
  - `items`
  - `activePreviewItemId`
  - `isPreparing`
  - `hasProcessingItems`

同时建议停止让 `PostFormValues` 同时承担“文本字段 + 文件输入值”的职责。

推荐结果是：

- RHF 管理：
  - `caption`
  - `location`
  - `tags`
- 媒体编辑器自己管理：
  - `items`
  - 排序
  - 处理状态
  - object URL 生命周期

这里的关键约束是：

- **数组顺序本身就是媒体顺序的唯一事实来源**
- `sortOrder` 只在序列化提交 payload 或草稿快照时根据数组下标生成

不建议在 state 中同时维护：

- `items[]` 的顺序
- 每项内部的 `sortOrder`

否则拖拽后两者很容易漂移。

### 三、拆分校验职责：文本字段继续走 Zod，媒体校验改为领域辅助校验

改动位置：

- `app/lib/validation/index.ts`
- 如有必要，新增 `app/features/post/lib/post-media-validation.ts`

当前状态：

- `PostValidation` 只有一个总 schema
- `file` 还是一个没有业务规则的 `z.custom<File[]>()`

本步骤建议把校验拆成两层：

- 文本校验
  - 继续使用 Zod
  - 只覆盖：
    - `caption`
    - `location`
    - `tags`
- 媒体校验
  - 使用 feature 侧辅助函数
  - 覆盖：
    - 图片数量必须在 `1-6`
    - MIME 只能是 `jpeg/png/webp`
    - 不能存在 `processing` 项
    - 不能全部失败或全部被删除
    - 编辑模式删除后仍必须保留至少 `1` 张

建议保留一个总的“提交前断言”辅助函数，例如：

- `validatePostMediaItemsForSubmit(items, mode)`

并在 `PostForm` 中把它的失败结果转换为：

- 表单顶部 `InlineErrorAlert`
- 或媒体区块下方的专用错误文案

不建议强行把媒体编辑器整个状态树塞回 Zod schema。

原因：

- `File`
- `previewUrl`
- `processing/failed`
- `activePreviewItemId`

这些都不是典型的“可序列化提交字段”，强行放回 Zod 会让 schema 与真实提交流程混在一起。

### 四、引入 feature 内的媒体编辑状态机，停止复用共享单图 `FileUploader`

改动位置：

- 新增 `app/features/post/hooks/usePostMediaEditor.ts`
- 新增 `app/features/post/components/PostMediaEditor.tsx`
- 新增 `app/features/post/components/PostMediaSortableList.tsx`
- 新增 `app/features/post/components/PostMediaCard.tsx`
- 如有必要，新增 `app/features/post/components/PostMediaPreviewDialog.tsx`
- 更新 `app/features/post/components/PostForm.tsx`
- 停止在帖子功能中使用 `app/components/shared/FileUploader.tsx`

当前状态：

- `FileUploader.tsx` 是一个面向单图上传和替换的 shared 组件
- 它内部直接处理：
  - 单图预览 URL
  - 单图 metadata 回调
  - 选择即替换

多图能力不建议继续压在 shared 组件上。

建议的新职责分层：

- `usePostMediaEditor.ts`
  - 维护媒体项状态机
  - 处理：
    - 选择文件
    - 串行准备图片
    - 插入 processing 项
    - 成功后替换为 ready 项
    - 失败后标记为 failed 项
    - 删除项
    - 重试失败项
    - 拖拽重排
    - 释放 object URL
- `PostMediaEditor.tsx`
  - 作为组合容器
  - 渲染：
    - 上传卡片
    - 可排序列表
    - 媒体区错误
    - 预览弹层
- `PostMediaSortableList.tsx`
  - 只负责列表布局和 DnD 容器
- `PostMediaCard.tsx`
  - 只负责单个媒体项的显示
  - 显示：
    - processing skeleton
    - ready thumbnail
    - failed state
    - “查看”按钮
    - 删除按钮

这里建议：

- 不再让 `PostForm` 自己直接维护媒体项数组操作细节
- 也不让子卡片各自持有局部顺序 state

而是把所有媒体编辑逻辑集中到 `usePostMediaEditor()`

这样后续：

- 草稿箱保存
- 提交 payload 映射
- 编辑页旧图回填

都可以复用同一份媒体编辑状态。

### 五、为排序交互统一到最新版 `dnd-kit React` API

改动位置：

- `package.json`
- `package-lock.json`
- `app/features/post/components/PostMediaSortableList.tsx`

建议依赖：

- `@dnd-kit/react`

当前项目保留：

- `react-dropzone`

但它继续只服务于头像上传这类“支持拖放选取”的场景。帖子多图编辑器本步骤明确改为：

- 原生文件选择器
- 排序交给 `DragDropProvider + useSortable`

建议交互：

- 用 `DragDropProvider`
- `DragDropProvider` 与 `DragOverlay` 从 `@dnd-kit/react` 导入
- `useSortable` 与 `isSortable / isSortableOperation` 从 `@dnd-kit/react/sortable` 导入
- 单个媒体卡片通过 `useSortable({ id, index })` 注册为 sortable
- 列表顺序与渲染顺序保持一致
- 单容器排序优先采用最新版文档推荐的“手动状态管理”方式：
  - 只在 `onDragEnd` 更新数组顺序
  - 从 `event.operation.source.initialIndex` 与 `event.operation.target.index` 读取拖拽前后位置
  - 或使用 `isSortableOperation(operation)` / `isSortable(source)` 做类型收窄
- 不再基于旧版 mental model 使用：
  - `DndContext`
  - `SortableContext`
  - `closestCenter`
  - `sortableKeyboardCoordinates`
  - `active.id / over.id` 这套排序判断方式
- 默认沿用 `DragDropProvider` 内置的 `PointerSensor` 与 `KeyboardSensor`
- 如果后续需要调节整卡拖拽的激活阈值，再通过 `sensors` 配置自定义 `PointerSensor.configure(...)`
- 整张媒体卡片本身就是 draggable / droppable 元素，不额外引入拖拽把手
- 只对 `ready / failed / existing` 项开放拖拽
- `processing` 项不注册 sortable，或在 `useSortable` 上显式 `disabled: true`
- 上传卡片不调用 `useSortable`

如果列表是横向卡片流，推荐：

- 横向滚动容器
- 每张媒体卡片固定 `1:1`
- DnD 时使用 `DragOverlay`

这样可以避免在滚动容器里拖动时，原位节点被压缩或抖动。

### 六、重构 `PostForm`，让它只做“文本表单 + 媒体编辑器桥接”

改动位置：

- `app/features/post/components/PostForm.tsx`
- 如有必要，更新 `app/routes/createPost.tsx`
- 如有必要，更新 `app/routes/editPost.tsx`

当前状态：

- `PostForm` 同时承担：
  - RHF 文本表单
  - 单图上传组件接线
  - 直接把 `PreparedImageDraft` 交给当前 submit 逻辑

本步骤后，`PostForm` 的职责应该收敛为：

- 仍然创建 RHF 实例管理文本字段
- 调用 `usePostMediaEditor()` 获取媒体编辑状态和操作
- 将媒体编辑器渲染到表单中
- 在提交时：
  - 先跑文本校验
  - 再跑媒体校验
  - 再将文本字段 + 媒体项映射为下一步写链路需要的数据结构

建议新增两个 adapter：

- `mapSingleImagePostToInitialMediaItems(post)`
  - 在当前编辑页仍只有单图 editor 数据时，把旧 `PostEditorInitialData` 包装成一个 `ExistingPostMediaEditorItem`
- `mapMediaEditorItemsToCreateDraftInput(items)`
  - 只做本地结构映射，不触发真实网络写入

这两个 adapter 的作用不同：

- 前者解决“步骤二先落地编辑器，步骤五再切真实 `postMedia` 读取”之间的过渡问题
- 后者为后续提交链路和草稿箱留出复用点

需要强调：

- 本步骤的 `PostForm` 不再依赖 `PreparedImageDraft`
- `PreparedImageDraft` 应该被删除或迁移成更通用的多图类型

### 七、明确这一步对当前创建/编辑 mutation 的边界

改动位置：

- 主要是设计约束，尽量不改：
  - `app/features/post/services/post.service.ts`
  - `app/features/post/queries/post.mutation.ts`

原因：

- 当前 mutation 和 service 仍然是单图提交契约。
- 真正的多图最终写入要等第三步、第四步完成后再接。

因此本步骤的推荐边界是：

- 把前端媒体编辑器、压缩结果和表单桥接完成
- 先不要把 `post.service.ts` 强行改成半成品多图写入

如果为了本地联调必须临时保留旧提交能力，允许在分支内做一个**临时 adapter**：

- 只取当前排序后的第一张 ready 图片作为封面
- 继续调用现有单图 create/update mutation

但这个临时 adapter 只适合：

- 组件开发期
- 分支内联调

不适合当作步骤二的正式产物长期保留。

## 为什么选择这个方案

### 为什么文本字段继续用 React Hook Form，媒体项改成独立状态机

原因：

- `caption / location / tags` 是典型表单字段，适合 RHF。
- 媒体项则包含大量非普通表单信息：
  - `File`
  - object URL
  - processing 状态
  - failed 状态
  - 本地预览弹层
  - 排序交互
  - 后续草稿序列化

如果把媒体项完整塞进 RHF：

- 排序操作会放大表单层更新复杂度
- 失败重试和 object URL 生命周期会和表单值纠缠
- 未来草稿箱还要再抽一层结构出来

将其拆成“RHF 管文本、媒体状态机管图片”，是更清晰的边界。

### 为什么不继续复用 `FileUploader.tsx`

原因：

- 这个 shared 组件本质上是单图 abstraction，不是通用 abstraction。
- 多图编辑器要处理的行为已经明显是帖子领域专属：
  - 最多 6 张
  - 排序
  - 封面
  - 处理态
  - 删除/重试
  - 本地大图预览

继续往 shared 组件里堆这些逻辑，只会得到一个对其他场景也不好复用的“假共享组件”。

更合理的方案是：

- 帖子媒体编辑器回到 `features/post/components`
- 头像上传等保留在自己的组件里

### 为什么图片处理采用“原生串行压缩 + 单次处理后持有最终文件”

原因：

- 当前上限是 6 张，不需要一开始就上 Worker 和并发调度。
- 串行处理更容易把控：
  - 正在处理哪一张
  - 何时插入 processing 项
  - 何时允许提交
  - 失败时该标记哪一项
- 使用 `canvas.toBlob()` 可以直接拿到适合上传和草稿持久化的 `Blob/File` 结果。

同时，MDN 对 `HTMLCanvasElement.toBlob()` 和 object URL 的行为已经足够明确，适合当前这种浏览器端图片处理链路。

### 为什么 ready 项只保存压缩后的文件，而不是长期同时保留原图和压缩图

原因：

- 后续上传要用的是压缩图。
- 后续草稿箱想保存的也是压缩图。
- 同时长期保留两份文件会无意义增加内存占用。

因此推荐策略是：

- `processing / failed` 阶段可临时持有原始 `File`
- 一旦成功进入 `ready`，媒体项上保留的应是最终上传文件

这样后续不会出现“UI 用原图、提交用压缩图、草稿又存第三份图”的三套文件状态。

### 为什么数组顺序要成为唯一的排序事实来源

原因：

- DnD 最终修改的是列表顺序。
- 封面规则就是“第一张图”。
- 提交 payload 和草稿快照最终都需要 `sortOrder`。

如果把 `sortOrder` 同时存进每个 item，再单独维护数组顺序，拖拽一次就有两套真相。

更稳的做法是：

- UI 内只维护数组顺序
- 需要落库或持久化时，再按下标生成 `sortOrder`

### 为什么排序选择最新版 `dnd-kit React` 的 sortable 能力

原因：

- 当前需求是单容器、多项卡片排序，不需要更重的拖拽系统。
- 最新 React 文档已经把排序能力统一到：
  - `DragDropProvider`
  - `useSortable`
  - `DragOverlay`
  - `isSortable / isSortableOperation`
- 默认已经带有：
  - 指针输入
  - 键盘输入
  - 可访问性
  - optimistic sorting
- 单列表场景下，官方推荐直接在 `onDragEnd` 基于 sortable 的 `initialIndex / index` 回写数组顺序。

这比手写 pointer drag 更稳，也比继续沿用旧版 `active / over + SortableContext` 思维更贴近当前官方 API。

### 为什么步骤二不建议立即改写 `post.service.ts`

原因：

- 当前真正的多图最终写入契约还没落到 Function。
- 如果这一步就去改 service，很容易写出一套马上要在第三步、第四步推翻的中间态网络逻辑。

因此这一步的正确产出是：

- 稳定的本地媒体编辑器
- 稳定的图片处理结果
- 稳定的表单桥接层

而不是“先做一个假的多图上传服务层再删掉”。

## 实现顺序与依赖关系

### 第一步：冻结前端媒体项类型和状态流转

工作：

- 在 `post.type.ts` 中定义：
  - `PostMediaProcessStatus`
  - `PostMediaEditorItem`
  - `PostTextFormValues`
  - 处理结果类型
- 明确状态流转：
  - 选择文件
  - 插入 processing 项
  - 成功变 ready
  - 失败变 failed
  - 删除 / 重试 / 重排

依赖：

- 依赖第一步 schema 契约已经明确 `1-6` 张和封面投影语义

说明：

- 这一步先统一数据形状，避免组件和工具函数各自长出一套状态字段。

### 第二步：实现图片压缩与元数据处理工具

工作：

- 新增 `post-image-compression.ts`
- 调整 `image-metadata.ts`
- 定义：
  - 格式筛选
  - 长边缩放
  - 二次降质
  - placeholder 生成

依赖：

- 依赖第一步已冻结处理结果类型

说明：

- 工具层先稳定，媒体状态机才能围绕它实现 success / failure 分支。

### 第三步：实现媒体编辑状态机 hook

工作：

- 新增 `usePostMediaEditor.ts`
- 处理：
  - `selectFiles(files)`
  - `removeItem(clientMediaId)`
  - `retryItem(clientMediaId)`
  - `moveItem(fromIndex, toIndex)`
  - `openPreview(clientMediaId)`
  - `closePreview()`
  - `dispose()`

依赖：

- 依赖第二步的处理工具已经可返回稳定结果

说明：

- 这一步先把“行为”做好，再让 UI 只是消费状态。

### 第四步：落地媒体编辑器 UI 组件

工作：

- 新增 `PostMediaEditor.tsx`
- 新增 `PostMediaSortableList.tsx`
- 新增 `PostMediaCard.tsx`
- 可选新增 `PostMediaPreviewDialog.tsx`
- 接入 `dnd-kit`

依赖：

- 依赖第三步状态机已可驱动 UI

说明：

- 这一步只关心渲染与交互，不重新实现图片处理逻辑。

### 第五步：重构 `PostForm`

工作：

- 文本字段继续使用 RHF
- 删除对单图 `file` 字段和 `PreparedImageDraft` 的依赖
- 接入媒体编辑器
- 接入媒体区错误与提交禁用逻辑

依赖：

- 依赖第四步 UI 组件已可工作

说明：

- 这一步完成后，创建页和编辑页已经具备统一的多图前端编辑外观。

### 第六步：补一个单图编辑态适配器

工作：

- 用当前 `PostEditorInitialData` 包装出一个 `ExistingPostMediaEditorItem`
- 让编辑页在步骤五之前继续能显示单图旧数据

依赖：

- 依赖第五步 `PostForm` 已改为消费媒体项数组

说明：

- 这是为步骤五之前的旧编辑查询做过渡，不是最终编辑读模型。
- 真正读取 `postMedia` 列表要等后续读路径步骤完成。

### 第七步：局部验证与清理

工作：

- 验证：
  - 选 1 张图
  - 选 6 张图
  - 选超过 6 张图
  - 选 SVG
  - 删除某一项
  - 拖拽重排
  - processing 中禁用提交
  - 组件卸载后 object URL 回收
- 清理：
  - 移除 `PreparedImageDraft`
  - 删除或停用帖子场景下的 `FileUploader.tsx`

依赖：

- 依赖前六步完成

说明：

- 这一步结束后，多图编辑器本身已经稳定，但还未接入最终多图写入链路。

## 关键风险及应对策略

### 风险一：主线程串行压缩导致连续选 6 张大图时出现明显卡顿

问题：

- 当前方案明确不使用 Worker。
- 手机大图在浏览器主线程压缩时，可能造成短时间掉帧。

应对：

- 串行处理时，每次只处理一张，避免并发解码/绘制放大卡顿。
- UI 上立刻插入 processing 项，给用户明确反馈。
- 每张图压缩完成后立即更新该项，而不是等全部完成后一次性刷出。
- 后续如果实测卡顿明显，再把处理执行层迁移到 Worker，而不改状态机和 UI 契约。

### 风险二：object URL 泄漏造成内存占用持续增长

问题：

- 本地预览依赖 `URL.createObjectURL()`
- 如果删除、替换或卸载时不回收，会持续占用内存

应对：

- 只为 ready 的本地项创建 object URL
- 删除项时立即 `URL.revokeObjectURL()`
- 整个媒体编辑器卸载时，统一释放仍存活的本地 object URL
- 远端图片 URL 不参与 revoke

### 风险三：压缩失败后媒体项丢失，用户不知道哪张图出了问题

问题：

- 如果处理异常直接丢弃文件，用户只会看到数量不对，不知道原因

应对：

- 失败时保留 failed 项，而不是静默删除
- failed 项上显示明确错误文案
- 提供：
  - 删除
  - 重试
  两个动作

### 风险四：把媒体项强塞进 RHF，导致排序、删除和失败重试逻辑变得脆弱

问题：

- RHF 擅长普通输入字段，不擅长承载 `File + DnD + object URL + processing state`

应对：

- 这一步明确将媒体项抽离成独立状态机
- RHF 只管理文本字段和提交触发
- 媒体错误由 `PostForm` 进行桥接展示

### 风险五：提交禁用条件散落在多个组件，导致处理中的图片仍可能被提交

问题：

- 如果按钮禁用、媒体区错误和提交断言分别写在不同组件里，状态很容易不一致

应对：

- 在 `usePostMediaEditor()` 中统一导出：
  - `hasProcessingItems`
  - `hasReadyItems`
  - `hasFailedItems`
- `PostForm` 只消费这些聚合状态决定：
  - 是否禁用提交
  - 是否展示错误

### 风险六：步骤二完成后，前端已是多图 UI，但后端仍是单图写入

问题：

- 这是当前分步实施带来的天然中间态。

应对：

- 把本步骤定义为“前端编辑器准备阶段”，而不是可独立上线的最终业务阶段。
- 正式合并或上线前，至少要连上第三步、第四步的 Function 与写链路。
- 如果分支内需要临时联调，只允许用“取第一张图走旧链路”的过渡 adapter，且不能长期保留。

### 风险七：编辑页当前只拿到单图 editor 数据，无法真正回显旧多图

问题：

- 读模型要到后续步骤才会切到 `postMedia`。

应对：

- 本步骤仅提供单图适配器，把旧 editor 数据包装成一个 existing item
- 不在这一步强行实现“伪多图编辑回显”
- 真正的旧图多张回显放到读路径步骤解决

### 风险八：processing 项参与排序，导致顺序和处理完成回填错乱

问题：

- 用户如果在处理过程中拖拽还没完成的项，回填 ready 结果时容易插错位置

应对：

- processing 项默认不参与拖拽排序
- 等该项转为 ready 或 failed 后再进入可操作列表
- 列表中上传卡片也不参与排序

### 风险九：校验规则同时存在于选择阶段、处理阶段和提交阶段，后续容易漂移

问题：

- 例如：
  - 选择阶段限制 6 张
  - 提交阶段又单独限制 6 张
  - 未来草稿保存阶段也要判断 processing

应对：

- 统一封装媒体校验 helper
- 选择阶段做“即时拦截”
- 提交阶段复用同一套 helper 做最终断言
- 后续草稿箱保存继续复用，不另起一套规则

## 预期结果

本步骤完成后，项目会获得一个稳定的“前端多图编辑层”：

- 浏览器端可以把新选图片处理成真正的上传候选文件，而不是只做单图 metadata 预读。
- 帖子表单不再被单个 `file` 字段限制住。
- 创建页和编辑页共享同一套媒体项状态模型。
- 排序、封面、删除、失败重试、本地预览和提交禁用条件都围绕同一个媒体编辑状态机工作。
- 这套状态模型可以直接承接后续：
  - `content-actions.post.create / post.update`
  - 编辑页 `postMedia` 回显
  - 本地草稿箱持久化
