# 首页瀑布流步骤三：创建与更新帖子链路接入图片元数据

## 目的

本步骤将图片元数据工具真正接入帖子创建与更新流程，并将此前“在 `post.service.ts` 中拿到 `File` 后生成元数据”的设计修正为：

- `FileUploader` 预计算
- `post.service.ts` 复用并兜底

本步骤的目标是：

- 用户在选择图片后，前端尽早异步计算图片元数据，而不是把计算成本全部压到提交瞬间。
- 创建帖子时，优先复用 `FileUploader` 预计算好的元数据，再由 `post.service.ts` 做最终兜底。
- 更新帖子时：
  - 如果没有替换图片，沿用旧图元数据
  - 如果替换了图片，优先复用预计算元数据，必要时由 `post.service.ts` 重新计算
- 图片元数据生成失败时，不阻断发帖或改帖，只允许对应帖子走降级路径。
- 为未来多图、封面选择和排序保留自然的扩展空间。

本步骤不负责：

- 首页分页查询接入
- 渐进式图片组件实现
- 瀑布流组件实现

## 验收标准

本步骤完成后，应满足以下验收标准：

- `FileUploader` 在用户选择新图片后，会自动触发图片元数据预计算。
- `PostForm` 能接收到并持有本次选图对应的预计算元数据。
- 创建帖子时：
  - 提交链路优先使用预计算元数据
  - 如果预计算元数据缺失或无效，`post.service.ts` 会重新计算一次
  - 如果再次失败，仍允许发帖成功，但写入空 placeholder 和安全降级值
- 更新帖子时：
  - 未替换图片时，沿用当前帖子的已有元数据
  - 替换图片时，优先使用新图的预计算元数据，必要时 service 重新计算
- `createPostRow` / `updatePostRow` 已将以下字段写入 `posts` row：
  - `aspectRatioBucket`
  - `imagePlaceholder`
  - `imageWidth`
  - `imageHeight`
- 编辑帖子初始数据能拿到当前帖子的图片元数据，以便“不换图”时直接沿用。
- 图片元数据生成失败不会导致用户因为一张“可正常上传的图片”而无法创建或更新帖子。
- 现有单图发布链路仍然可用。
- 设计上不阻断未来多图扩展。

## 改了什么，改在哪里

### 一、在 `FileUploader` 中接入元数据预计算

改动位置：

- `app/components/shared/FileUploader.tsx`

当前状态：

- 只负责接收 `react-dropzone` 的文件
- 回传 `File[]`
- 生成一个本地预览 URL

建议改动：

- 新增预计算回调，例如：
  - `onPreparedChange`
  - 或语义等价的命名
- 在 `onDrop` 后立即触发图片元数据异步计算
- 将以下信息回传给上层：
  - 选中的 `File[]`
  - 预计算得到的元数据
  - 元数据状态，例如：
    - `idle`
    - `pending`
    - `ready`
    - `failed`

建议不要让 `FileUploader` 只把 metadata 留在自己内部 state，因为后续提交时 service 层需要复用这份结果。

如果采用最小单图实现，建议上抛的结构类似：

```ts
type PreparedImageDraft = {
  file: File;
  metadata: {
    width: number | null;
    height: number | null;
    aspectRatioBucket: PostAspectRatioBucket;
    placeholder: string | null;
  } | null;
  metadataStatus: 'pending' | 'ready' | 'failed';
};
```

当前仍是单图场景，因此 `FileUploader` 可以只关注第一张图，但结构上不要把“元数据只可能有一份”写死成不可扩展接口。

### 二、在 `PostForm` 中持有图片草稿状态

改动位置：

- `app/features/post/components/PostForm.tsx`

建议改动：

- 保留 `react-hook-form` 对用户输入字段的管理：
  - `caption`
  - `file`
  - `location`
  - `tags`
- 同时在 `PostForm` 中新增一份本地草稿状态，用于持有选图后的元数据结果，例如：
  - `preparedImageDraft`
  - 或等价命名

不建议把完整 metadata 状态强行塞进 `react-hook-form` 的 `PostFormValues` 中，原因是：

- 它不是用户主动输入字段
- 它是异步生成的派生数据
- 它更适合由表单组件局部状态管理
- 这样可以减少 `zod` 校验和表单值序列化上的噪音

`PostForm` 的职责变为：

- 从 `FileUploader` 接收预计算结果
- 在提交时将：
  - `nextFile`
  - `preparedImageDraft`
  一起传给 create / update mutation

### 三、扩展表单初始数据与更新路径所需的旧图元数据

改动位置：

- `app/features/post/types/post.type.ts`
- `app/features/post/api/post.api.ts`
- `app/features/post/services/post.service.ts`

原因：

- 更新帖子时，如果用户没有替换图片，服务层必须知道当前帖子的旧图元数据，才能“原样沿用”

建议补齐：

- `RawPostEditorRow`
- `POST_EDITOR_SELECT`
- `PostEditorInitialData`

需要新增到编辑初始数据中的字段：

- `aspectRatioBucket`
- `imagePlaceholder`
- `imageWidth`
- `imageHeight`

这样编辑页在“未替换图片”的情况下，提交时才能把旧元数据一起带到 `updatePostRow`。

### 四、扩展 create / update 输入类型

改动位置：

- `app/features/post/types/post.type.ts`

建议新增或扩展以下输入类型：

- `CreatePostInput`
- `UpdatePostInput`
- `CreatePostApiInput`
- `UpdatePostApiInput`

需要补充的字段方向：

- 预计算元数据
- 当前图片元数据

建议服务层输入包含：

- 创建时：
  - `file`
  - `preparedImageMetadata?: ImageMetadataResult | null`
- 更新时：
  - `nextFile?: File | null`
  - `nextPreparedImageMetadata?: ImageMetadataResult | null`
  - `currentAspectRatioBucket`
  - `currentImagePlaceholder`
  - `currentImageWidth`
  - `currentImageHeight`

这样 service 层才能区分：

- 新图元数据
- 旧图元数据
- 是否需要兜底重新计算

### 五、在 `post.service.ts` 中复用并兜底

改动位置：

- `app/features/post/services/post.service.ts`

这是本步骤的核心修正点。

新的 service 职责不是“唯一生成元数据”，而是：

- 优先复用表单阶段已经算好的元数据
- 在缺失或无效时做最终兜底

建议新增 service 内部 helper，例如：

- `resolveImageMetadata()`

职责：

- 接收：
  - `file`
  - `preparedImageMetadata`
- 返回稳定的元数据结果

行为：

- 如果传入的预计算元数据存在且有效：
  - 直接复用
- 否则：
  - 调用 `getImageMetadata(file)` 再计算一次
- 如果仍失败：
  - 返回降级结果：
    - `aspectRatioBucket: '3:4'`
    - `placeholder: null`
    - `width: null`
    - `height: null`

创建帖子时：

- 上传原图
- 解析最终元数据
- 将原图 URL 和元数据一并传给 `createPostRow`

更新帖子时：

- 如果没有替换图片：
  - 直接沿用当前图片 URL、ID 和现有元数据
- 如果替换图片：
  - 上传新图
  - 优先使用预计算元数据
  - 必要时再次计算
  - 将新图 URL 和最终元数据一并传给 `updatePostRow`

### 六、在 `post.api.ts` 中写入元数据字段

改动位置：

- `app/features/post/api/post.api.ts`

建议改动：

- 在 `createPostRow()` 的 `data` 中增加：
  - `aspectRatioBucket`
  - `imagePlaceholder`
  - `imageWidth`
  - `imageHeight`
- 在 `updatePostRow()` 的 `data` 中增加同样字段

这样创建和编辑提交后，`posts` row 才真正具备首页瀑布流所需的元数据。

## 为什么选择这个方案

### 为什么改成“FileUploader 预计算，service 复用并兜底”

因为“只在 service 提交时计算”虽然可用，但不是最佳体验，也不利于后续扩展。

当前修正方案的优势：

- 用户选图后就开始计算元数据，提交时等待更少
- 元数据失败能更早暴露，而不是全部压到点击提交后才知道
- service 仍保留最终兜底，避免仅依赖 UI 层状态
- 为未来多图、封面切换、排序变化建立更自然的设计基础

这是一个兼顾体验与稳定性的双阶段方案。

### 为什么不只在 `FileUploader` 里算完就完全信任结果

因为 UI 层状态并不一定可靠到可以作为唯一事实来源。

可能出现的情况：

- 用户换图
- 表单状态和组件状态短暂不一致
- 异步计算被中断
- 某次预计算失败，但文件本身没问题

如果 service 完全不兜底，一旦 UI 层 metadata 缺失，就只能直接写入空值。

因此 service 层必须保留一次“最终确认”的职责。

### 为什么不把 metadata 全塞进 `react-hook-form`

原因：

- metadata 不是用户直接填写的数据
- 它是异步派生结果
- 它更适合由 `PostForm` 本地状态管理
- 这样可以减少校验模型膨胀，保持 `PostValidation` 聚焦在真正的用户输入上

### 为什么“不换图时沿用旧图元数据”

更新帖子但未替换图片时，重新生成元数据没有意义：

- 原图未变
- 原图 URL 未变
- 原图尺寸未变
- 原图 placeholder 理应不变

直接沿用旧图元数据更高效，也避免无意义的重复处理。

### 为什么这个方案更适合未来多图

多图场景下，最合理的思路不是“提交时才对最终封面重新算一次”，而是：

- 每张图在进入表单时就预计算自己的 metadata
- 当前封面只是从这些已准备好的草稿中选一个

当前将预计算逻辑放在 `FileUploader` 和表单草稿层，就是在为这种扩展预留自然路径。

## 实现顺序与依赖关系

### 第一步：完成图片元数据工具

依赖：

- 依赖步骤二中的 `image-metadata.ts`

原因：

- `FileUploader` 和 `post.service.ts` 都要调用它

### 第二步：扩展类型与编辑初始数据契约

操作：

- 扩展 `PostEditorInitialData`
- 扩展 create / update 输入类型
- 补充 `POST_EDITOR_SELECT`

依赖：

- 依赖步骤一中的 schema 和类型准备

### 第三步：改造 `FileUploader`

操作：

- 在 dropzone 成功选图后触发 metadata 预计算
- 将结果通过回调上抛

依赖：

- 依赖 `image-metadata.ts`

### 第四步：改造 `PostForm`

操作：

- 增加本地草稿状态
- 接收 `FileUploader` 的预计算结果
- 提交时将预计算元数据传给 mutation

依赖：

- 依赖 `FileUploader` 提供新回调
- 依赖输入类型已扩展

### 第五步：改造 `post.service.ts`

操作：

- 增加复用并兜底的 metadata 解析逻辑
- 创建 / 更新时选择正确的元数据来源

依赖：

- 依赖前面的类型、表单和上传器改造

### 第六步：改造 `post.api.ts`

操作：

- 在 row 写入中加入元数据字段

依赖：

- 依赖 schema 已具备新字段
- 依赖 service 已能提供最终元数据

### 第七步：验证创建与更新链路

验证项：

- 创建帖子时新图 metadata 正常写入
- 编辑帖子不换图时 metadata 不丢失
- 编辑帖子换图时 metadata 更新
- 预计算失败但 service 兜底成功
- 预计算和 service 都失败时，帖子仍可成功保存但走降级

## 关键风险及应对策略

### 风险：UI 预计算与最终提交使用的文件不一致

问题：

- 用户快速替换图片时，旧的异步元数据结果可能晚于新的文件到达，导致草稿状态被污染。

应对：

- 为每次选图生成唯一标识
- 仅接收与当前最新文件匹配的异步结果
- 在 `FileUploader` 内处理过期结果丢弃

### 风险：预计算失败导致帖子没有 placeholder

问题：

- 如果预计算失败，且 service 层不再尝试，就会导致本来可正常处理的图片失去 placeholder。

应对：

- service 层必须保留最终兜底重算
- 只有在两次都失败时，才允许写入降级值

### 风险：编辑帖子时旧图元数据未被正确带回

问题：

- 如果编辑页初始数据没有带回旧图元数据，不换图提交时就会把这些字段丢掉。

应对：

- 扩展 `POST_EDITOR_SELECT`
- 扩展 `PostEditorInitialData`
- 提交更新时明确传入当前图片元数据

### 风险：`PostForm` 状态过于分散

问题：

- 当前表单已有 `react-hook-form`，如果再增加局部状态，容易出现维护负担。

应对：

- 明确职责边界：
  - `react-hook-form` 只管理用户输入
  - `PostForm` 局部 state 管理上传草稿和预计算元数据
- 不要让同一份 metadata 同时存在于多套状态系统中

### 风险：service 过度信任前端预计算结果

问题：

- 即使 metadata 已预计算完成，也不意味着它一定完整、当前、可用。

应对：

- service 在复用前对 metadata 做最基本的归一化与缺省处理
- 缺字段、异常值或空结果时触发兜底重算

### 风险：未来多图扩展时当前接口难以演进

问题：

- 如果这一步把接口写死成“只有一个 file 和一份 metadata”，未来支持多图会重构成本较高。

应对：

- 当前单图实现中，也尽量使用“图片草稿”概念，而不是只传裸 `File`
- 回调和类型命名避免过度绑定单图假设
- 将“封面图 metadata”与“所有图片草稿”概念区分开

## 预期结果

本步骤完成后，创建与更新帖子链路将形成清晰的双阶段元数据策略：

- 用户选图后，`FileUploader` 立即预计算图片元数据
- `PostForm` 保留这份结果供提交复用
- `post.service.ts` 在提交时进行最终确认与兜底
- 创建帖子时新图元数据会被写入 `posts`
- 更新帖子时不换图沿用旧元数据，换图则刷新元数据
- 整条链路既兼顾当前体验，也为未来多图和封面扩展保留了合理空间
