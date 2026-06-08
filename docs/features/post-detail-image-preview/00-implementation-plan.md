# 帖子详情图片预览实现方案

## 范围

本文档定义帖子详情图片预览功能的实现方案。

本期目标：

- 仅在帖子详情页和帖子详情 modal 内启用图片预览。
- 鼠标悬停详情图片时显示放大镜语义的光标。
- 点击详情图片后打开全屏图片预览层、遮罩和底部工具栏。
- 工具栏支持：上一张、当前页码、下一张、当前原始尺寸百分比、缩小、放大、原始尺寸 / 适应页面切换、旋转、下载。
- 打开预览时默认使用适应页面模式，图片按安全显示区域缩放，不与底部工具栏重叠，并与顶部保持距离。
- 切换到原始尺寸或手动缩放 / 拖动后进入自由查看状态，图片允许与工具栏重叠。
- 点击图片或遮罩关闭预览；拖动图片时不触发关闭。
- 支持鼠标和移动端触摸拖动图片。
- 左上角提供关闭按钮。
- 下载文件名包含帖子 ID、图片序号、作者名。

本期不包含：

- 不改变 feed、profile、search、explore 卡片点击行为。
- 不给列表卡片或网格图增加预览能力。
- 不引入第三方 lightbox 库。
- 不支持视频或非图片媒体。
- 不实现双指缩放，除非后续单独扩展。

## 当前现状

相关文件：

- `app/features/post/components/PostMediaCarousel.tsx`
- `app/features/post/components/PostDetailsContent.tsx`
- `app/features/post/components/PostDetailsRouteView.tsx`
- `app/features/post/types/post.type.ts`
- `app/components/ui/button.tsx`
- `components.json`

当前行为：

- `PostMediaCarousel` 已负责详情媒体展示。
- 轮播基于横向 scroll-snap，支持左右按钮、dots、当前页状态、键盘左右切换和单图错误态。
- 详情内容由 `PostDetailsContent` 组合，左侧为媒体区，右侧为帖子交互区。
- `PostDetailsRouteView` 已同时支持独立详情页和详情 modal。
- 详情 modal 已有遮罩、关闭按钮、body 滚动锁定。
- `PostMediaViewModel` 已包含 `imageUrl`、`fileId`、`width`、`height`、`aspectRatioBucket`，足够支撑预览、原始尺寸百分比和下载。
- 项目使用 shadcn/ui 风格组件，`components.json` 显示 `base` 为 `radix`，图片预览使用本地 shadcn Dialog 作为 modal 基础设施。

## 官方依据

本方案基于以下官方文档和平台能力：

- shadcn/ui Dialog 文档：`Dialog` 是覆盖在主窗口或另一个 dialog 之上的窗口，并让底层内容不可交互。项目当前 `base` 为 `radix`，适合通过 shadcn CLI 添加 radix 版本 Dialog。
  - https://ui.shadcn.com/docs/components/radix/dialog
- Radix Dialog 文档：Dialog primitive 负责 modal 语义、Portal、Overlay、Esc 关闭、焦点管理和可访问性基础。
  - https://www.radix-ui.com/primitives/docs/components/dialog
- React `createPortal` 文档：Portal 只改变 DOM 物理位置，不改变 React 组件关系，适合把 modal 渲染到 `document.body`，避免被局部 overflow 和 stacking context 限制。
  - https://react.dev/reference/react-dom/createPortal
- MDN Pointer Events：`setPointerCapture()` 可让拖动过程中即使指针离开元素，也继续把 pointer 事件派发给该元素，适合实现稳定拖拽。
  - https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- MDN `touch-action`：可控制触摸手势的默认浏览器行为，避免移动端拖动图片时被页面滚动或缩放手势抢占。
  - https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- MDN `HTMLAnchorElement.download`：`download` 可提示浏览器按指定文件名保存资源，但最终行为受浏览器和资源来源策略影响。
  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLAnchorElement/download

## 方案选择

采用“shadcn/ui Dialog + 自研图片查看器”的方案。

核心边界：

- 业务组件只使用 `~/components/ui/dialog`，不直接依赖 Radix primitive。
- shadcn/ui Dialog 承担 Portal、Overlay、modal 语义、焦点处理和 Esc 关闭。
- 图片预览的业务交互由项目自研：缩放、拖动、旋转、页码、下载、点击关闭。

为什么不直接使用 Radix：

- 项目已有 shadcn/ui 组件层，业务代码直接 import Radix 会绕过项目 UI 抽象。
- 后续会出现两套 overlay/dialog 写法，降低一致性。
- shadcn/ui 组件本身就是项目源码，必要时可以在 `app/components/ui/dialog.tsx` 内扩展，而不污染业务层。

为什么不引入第三方 lightbox：

- 当前需求集中在详情页预览，范围明确。
- 第三方 lightbox 会引入额外依赖、样式体系和默认交互约束。
- 本需求对百分比含义、原始尺寸、点击图片关闭、拖动判定和下载命名都有明确规则，自研查看器更直接。

为什么不复用详情 modal 壳：

- 帖子详情 modal 本身已经是一个 route-level overlay。
- 图片预览需要在详情 modal 之上再打开一层更高优先级的 modal。
- 预览层的滚动、拖动、点击关闭和工具栏行为与帖子详情壳不同，强行复用会让两个职责耦合。

## 改了什么，改在哪里

### 1. 新增 shadcn/ui Dialog

改动位置：

- `app/components/ui/dialog.tsx`

实现方式：

- 通过 shadcn CLI 添加官方 Dialog：
  - `npx shadcn@latest add dialog`
- 添加后读取生成文件，确认：
  - import alias 使用 `~/`。
  - 组件风格与现有 `button.tsx`、`dropdown-menu.tsx` 一致。
  - `DialogTitle` 可用于 `sr-only` 无障碍标题。

该组件用于：

- 图片预览层的 Portal。
- 全屏 Overlay。
- Dialog modal 语义。
- Esc 关闭与焦点返回。

### 2. 新增图片预览组件

建议新增：

- `app/features/post/components/PostImagePreviewDialog.tsx`

职责：

- 接收帖子媒体数组、初始图片索引、帖子 ID、作者名、打开状态和关闭回调。
- 渲染全屏预览层。
- 维护预览内部状态：
  - `currentIndex`
  - `scale`
  - `rotation`
  - `offsetX`
  - `offsetY`
  - `mode`，取值为 `fit`、`original` 或 `custom`
  - drag transient refs
- 根据当前图片原始尺寸计算百分比：
  - 百分比 = 当前 CSS 显示尺寸 / 图片原始像素尺寸。
  - 若缺少 `width` 或 `height`，退化为基于已加载图片 `naturalWidth / naturalHeight`。
- 适应页面模式使用独立的安全显示区域计算 `fitScale`：
  - 扣除顶部关闭按钮和顶部留白。
  - 扣除底部工具栏高度和工具栏上方间距。
  - 图片中心对齐到安全显示区域中心，而不是整个视口中心。
  - `fitScale` 可小于、等于或大于 100%，以安全显示区域为准，不强制封顶为原始尺寸。
- 原始尺寸模式使用 `scale = 1`，不再受安全显示区域约束。
- 手动放大、缩小或拖动后进入 `custom` 模式，保留当前视觉位置，并允许图片与工具栏重叠。
- 使用 `transform: translate(...) rotate(...) scale(...)` 控制图片显示。
- 使用 Pointer Events 实现鼠标和触摸拖动。
- 区分点击与拖动：
  - pointer down 记录起点。
  - pointer move 超过阈值后标记为 dragging。
  - pointer up 若未超过阈值，则按点击图片关闭处理。
  - pointer up 若发生拖动，则只结束拖动，不关闭。
- 下载当前图片，文件名格式建议：
  - `snapgram-post-${postId}-image-${index + 1}-${creatorSlug}.jpg`
  - `creatorSlug` 仅保留安全字符，空值回退为 `creator`。

### 3. 扩展 `PostMediaCarousel` 的预览入口

改动位置：

- `app/features/post/components/PostMediaCarousel.tsx`

改动点：

- 新增 props：
  - `postId: string`
  - `creatorName: string`
  - `enablePreview?: boolean`
- 在详情页使用时开启预览。
- 图片 hover 时添加放大镜光标样式。
- 点击当前 slide 图片时设置 `previewIndex`，打开 `PostImagePreviewDialog`。
- 轮播自身的左右切换、dots、键盘行为保持不变。
- 单图或加载失败图片不影响预览组件边界：
  - 单图时预览工具栏的左右切换按钮 disabled。
  - 加载失败的 slide 不打开预览，或预览中展示媒体级错误态。

注意：

- 不要把预览能力加到 feed/profile/search/explore 卡片组件。
- `PostMediaCarousel` 当前只被详情内容使用，因此 `enablePreview` 可作为显式保护，也方便未来复用。

### 4. 扩展 `PostDetailsContent` 传参

改动位置：

- `app/features/post/components/PostDetailsContent.tsx`

改动点：

- 调用 `PostMediaCarousel` 时传入：
  - `postId={post.id}`
  - `creatorName={post.creator.name}`
  - `enablePreview`

原因：

- 下载命名需要帖子 ID 和作者名。
- 预览入口只应在详情组件链路显式打开。

### 5. 可选：补充组件级工具函数

如果 `PostImagePreviewDialog.tsx` 变长，建议新增同目录工具文件：

- `app/features/post/lib/post-image-preview.ts`

可放入：

- `clampScale()`
- `sanitizeDownloadFileNamePart()`
- `createPostImageDownloadFileName()`
- `getNaturalSizeFromMedia()`
- `resolveFitScale()`

原则：

- 只有纯函数才抽出。
- 不为一次性 JSX 或局部事件处理制造额外抽象。

## 实现顺序与依赖关系

### 步骤一：添加 Dialog 基础组件

依赖：无。

操作：

1. 运行 `npx shadcn@latest add dialog`。
2. 阅读新增的 `app/components/ui/dialog.tsx`。
3. 确认和项目配置匹配：React Router、Tailwind v4、`~/` alias、radix base。

完成标准：

- 可以从 `~/components/ui/dialog` 导入 Dialog 组件。
- `npm run typecheck` 不因新增 Dialog 报错。

### 步骤二：实现 `PostImagePreviewDialog`

依赖：步骤一。

操作：

1. 建立受控组件 API。
2. 先实现打开、关闭、当前图片展示、遮罩和左上角关闭按钮。
3. 实现底部工具栏静态布局。
4. 实现上一张 / 下一张和页码。
5. 实现 fit / original / custom 三种模式。
6. 实现缩小 / 放大和百分比显示。
7. 实现旋转。
8. 实现 pointer 拖动与点击关闭判定。
9. 实现下载文件名。

完成标准：

- 图片预览能在详情页和详情 modal 上层稳定打开。
- 点击遮罩关闭。
- 点击图片关闭。
- 拖动图片不关闭。
- 工具栏功能可用。

### 步骤三：接入 `PostMediaCarousel`

依赖：步骤二。

操作：

1. 增加预览相关 props。
2. 在 `<img>` 上添加打开预览事件和放大镜 cursor。
3. 渲染 `PostImagePreviewDialog`。
4. 保持现有 carousel 逻辑不改动。

完成标准：

- 现有轮播切换行为不回退。
- 只有详情媒体图片点击打开预览。

### 步骤四：从 `PostDetailsContent` 传入下载上下文

依赖：步骤三。

操作：

1. 给 `PostMediaCarousel` 传 `post.id` 和 `post.creator.name`。
2. 明确 `enablePreview`。

完成标准：

- 下载文件名包含帖子 ID、图片序号和作者名。

### 步骤五：验证和修正边界

依赖：前四步。

建议验证：

- `npm run typecheck`
- 多图帖子详情页。
- 多图帖子详情 modal。
- 单图帖子。
- 缺少 `width / height` 的旧数据。
- 图片加载失败。
- 移动端 viewport。
- 预览中拖动、点击、缩放、旋转、切图、下载。
- 打开详情 modal 后再打开图片预览，Esc 和关闭按钮关闭的是正确层级。

## 关键风险及应对策略

### 风险一：详情 modal 内再打开图片 preview，层级和关闭事件互相干扰

表现：

- 点击预览遮罩同时关闭帖子详情 modal。
- Esc 一次关闭了两层。
- 预览层被详情 modal 的 `overflow-hidden` 裁剪。

应对：

- 图片预览使用 shadcn Dialog 的 Portal 渲染到 body。
- 预览 Dialog 层级高于详情 route modal。
- 预览内容内部阻止不该冒泡到下层的 pointer/click 事件。
- 验证“详情 modal 中打开预览后，关闭预览仍停留在帖子详情 modal”。

### 风险二：点击图片关闭和拖动图片冲突

表现：

- 用户拖动结束后误关闭预览。
- 轻微手抖导致点击不关闭。

应对：

- 使用 pointer down / move / up 计算位移。
- 设置小阈值，例如 4 到 6 CSS px。
- 低于阈值视为点击，高于阈值视为拖动。
- 使用 `setPointerCapture()` 保证拖动过程中事件稳定。

### 风险三：移动端触摸拖动被浏览器滚动或缩放接管

表现：

- 拖动图片时页面跟着滚。
- 工具栏点击不稳定。

应对：

- 预览可拖动区域设置合适的 `touch-action`，例如 `none`。
- Dialog 打开时依赖 Radix modal 行为隔离底层交互。
- 只在预览图片表面阻止默认拖动，不影响工具栏按钮点击。

### 风险四：百分比计算不准确

表现：

- 数据库 `width / height` 缺失时显示 `NaN%`。
- fit 模式下百分比和用户理解不一致。

应对：

- 优先使用 `PostMediaViewModel.width / height`。
- 缺失时读取当前图片 `naturalWidth / naturalHeight`。
- 仍缺失时百分比显示为 `--%`，但不阻塞其他功能。
- 文案和逻辑明确：百分比相对图片原始像素尺寸。

### 风险五：下载文件名或下载行为不稳定

表现：

- 跨源图片不按 `download` 文件名保存。
- 作者名含特殊字符导致文件名异常。

应对：

- 对作者名做文件名安全化处理。
- 文件名始终包含 `postId` 和图片序号，作者名为空时回退为 `creator`。
- 使用 `<a href={imageUrl} download={fileName}>` 的标准能力。
- 若浏览器因资源来源策略忽略 `download`，本期接受为平台限制；后续可用服务端代理下载增强。

### 风险六：fit 安全区域和原始尺寸模式语义混淆

表现：

- 适应页面模式仍然显示为 `100%`，和原始尺寸没有区别。
- 默认打开时图片被底部工具栏遮挡。
- 用户点击放大后，图片仍被强制限制在安全区域内，导致放大按钮看起来无效。

应对：

- `fit` 只表示“适应页面预设”，默认打开和点击适应页面按钮时使用。
- `fitScale` 基于安全显示区域计算，而不是整个预览 stage。
- `fit` 模式下图片中心对齐安全区域中心，确保顶部和底部工具栏都有留白。
- `original` 使用 `scale = 1`，允许超出视口并与工具栏重叠。
- 手动放大、缩小或拖动时进入 `custom`，允许与工具栏重叠；再次点击适应页面才回到 `fit`。

### 风险七：自研 transform 状态过度复杂

表现：

- 切图后保留上一张图的旋转和偏移。
- fit / original 切换后图片位置混乱。

应对：

- 切换图片时重置 `scale`、`rotation`、`offset` 和 `mode` 到默认 fit。
- fit / original 切换时重置 offset。
- 从 fit 进入 custom 前，把 fit 安全区域中心偏移写入 offset，避免缩放或拖动时图片位置跳变。
- 缩放以容器中心为基准，避免本期引入鼠标位置锚点缩放复杂度。
- 只抽纯函数，不提前引入复杂状态机。

### 风险八：Dialog 默认样式不适合全屏预览

表现：

- 默认 `DialogContent` 像卡片一样居中，带宽高限制或关闭按钮。
- 覆盖 className 过多，组件使用处变脆。

应对：

- 先使用 shadcn Dialog 的 `className` 覆盖为全屏预览容器。
- 如果默认结构无法干净覆盖，则在 `app/components/ui/dialog.tsx` 内新增项目级全屏内容组件，例如 `DialogFullscreenContent`。
- 业务组件仍只 import `~/components/ui/dialog`，不直接 import Radix。

## 验收标准

功能验收：

- 详情页图片 hover 时显示放大镜语义光标。
- 点击详情页图片打开预览。
- 详情 modal 内点击图片打开预览，关闭预览后仍停留在详情 modal。
- 遮罩左上角关闭按钮可关闭预览。
- 点击遮罩关闭预览。
- 点击图片关闭预览。
- 拖动图片不会关闭预览。
- 鼠标和移动端触摸均可拖动图片。
- 多图时左右按钮可切换，页码正确。
- 单图时左右按钮 disabled。
- 百分比相对于图片原始像素尺寸。
- 打开预览默认处于 fit 模式，图片不与底部工具栏重叠，并与顶部保持距离。
- 缩小、放大、fit/original、旋转可用。
- 缩小、放大或拖动后进入 custom 模式，图片允许与工具栏重叠。
- 原始尺寸允许超出视口，并可拖动查看。
- 下载文件名包含帖子 ID、图片序号、作者名。
- feed、profile、search、explore 卡片点击行为不变。

技术验收：

- `npm run typecheck` 通过。
- 不新增第三方 lightbox 依赖。
- 不直接在业务组件中使用 Radix primitive。
- 预览组件卸载时没有残留全局事件监听。
- 现有 `PostMediaCarousel` scroll-snap 轮播行为不回退。
