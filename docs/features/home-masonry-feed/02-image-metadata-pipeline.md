# 首页瀑布流步骤二：图片元数据工具与 LQIP 生成方案

## 目的

本步骤用于为帖子图片建立一套前端可复用的元数据生成能力，服务于首页瀑布流的比例占位和渐进式图片加载。

本步骤的目标是：

- 在浏览器端从用户上传的 `File` 中读取原图宽高。
- 基于原图宽高选择最接近的比例桶：
  - `1:1`
  - `3:4`
  - `4:3`
- 为首页卡片生成体积受控的 LQIP `data URL`。
- 对 placeholder 长度做保护，避免数据库 row 和首页响应体积失控。
- 在失败场景下安全降级，不能阻断发帖或改帖。
- 保持工具接口稳定，使后续可以从当前实现平滑升级到：
  - `createImageBitmap + toBlob`

本步骤不负责：

- 将元数据写入 Appwrite
- 改造创建 / 编辑帖子 service
- 改造首页分页查询
- 改造图片组件或瀑布流组件

它只负责提供一个稳定的图片元数据生成工具，供后续步骤调用。

## 验收标准

本步骤完成后，应满足以下验收标准：

- 新增图片元数据工具文件：
  - `app/features/post/lib/image-metadata.ts`
- 工具对外暴露稳定方法，能够接收一个浏览器 `File`，返回：

```ts
{
  width: number | null;
  height: number | null;
  aspectRatioBucket: PostAspectRatioBucket;
  placeholder: string | null;
}
```

- 工具内部采用以下技术路径：
  - `HTMLImageElement`
  - `URL.createObjectURL()`
  - `<canvas>`
  - `canvas.toDataURL()`
- 工具能够正确读取图片原始宽高。
- 工具能够根据宽高返回最接近的比例桶。
- 工具能够生成小尺寸 LQIP data URL。
- 工具对 placeholder 长度有显式上限控制。
- 工具在以下场景下不会抛出阻断业务的未处理异常：
  - 图片解码失败
  - canvas 绘制失败
  - data URL 超过预设阈值
- 在失败降级场景下：
  - `aspectRatioBucket` 至少有稳定默认值
  - `placeholder` 返回 `null`
- 工具内部资源有正确清理：
  - `URL.revokeObjectURL()`
- 工具设计上保留未来升级接口，使后续替换底层实现时，不需要改调用方函数签名。

## 改了什么，改在哪里

### 一、新增图片元数据工具模块

新增文件：

- `app/features/post/lib/image-metadata.ts`

建议职责拆分如下：

- `getImageMetadata(file: File): Promise<ImageMetadataResult>`
  - 作为主入口
- `loadImageFromFile(file: File): Promise<HTMLImageElement>`
  - 负责 object URL、图片加载和资源释放
- `pickNearestAspectRatioBucket(width: number, height: number): PostAspectRatioBucket`
  - 负责比例桶判断
- `createImagePlaceholderDataUrl(image: HTMLImageElement, options?): string | null`
  - 负责 canvas 缩放和 `toDataURL()`
- `isPlaceholderWithinLimit(placeholder: string, options?): boolean`
  - 负责长度保护

建议返回类型：

```ts
type ImageMetadataResult = {
  width: number | null;
  height: number | null;
  aspectRatioBucket: PostAspectRatioBucket;
  placeholder: string | null;
};
```

### 二、与现有类型定义对齐

改动位置：

- `app/features/post/types/post.type.ts`

前提要求：

- 复用第一步已经定义好的：
  - `PostAspectRatioBucket`

本步骤不建议在 `image-metadata.ts` 中重新定义比例桶字面量类型。
应直接从帖子类型文件中复用，保持上传链路、mapper、首页 view model 的比例值一致。

### 三、约定稳定的实现接口

虽然本步骤选型为：

- `HTMLImageElement + object URL + canvas.toDataURL()`

但对调用方只暴露统一入口，例如：

```ts
export async function getImageMetadata(file: File): Promise<ImageMetadataResult>
```

后续如果切换到底层方案：

- `createImageBitmap + OffscreenCanvas/toBlob + FileReader.readAsDataURL()`

只替换工具内部实现，不修改 service 层或表单层调用签名。

这一步是“保留可升级接口”的核心。

## 为什么选择这个方案

### 为什么当前选择 `HTMLImageElement + object URL + canvas.toDataURL()`

当前项目第一阶段目标是尽快打通首页瀑布流的完整能力链路，而不是提前构建一套复杂的图像处理基础设施。

这个方案的优势：

- 浏览器支持最成熟，兼容性最好。
- 实现简单，调试成本低。
- 不需要引入 worker、`OffscreenCanvas` 分支或更复杂的图像 API。
- 对当前项目来说，LQIP 只是极小尺寸占位图，`toDataURL()` 的使用场景合理。
- 足够满足当前：
  - 读取宽高
  - 选择比例桶
  - 生成 placeholder
  - 长度保护
  - 失败降级

当前阶段更重要的是稳定落地，而不是为了“更现代”而提前增加复杂度。

### 为什么设计上保留升级接口

虽然第一版采用更稳的方案，但后续如果出现以下情况，升级到底层新实现会更合理：

- 上传时主线程卡顿明显
- placeholder 质量和体积控制需要更细粒度能力
- 希望后续迁移到更适合 blob 编码和资源释放的路径
- 希望把图片处理能力进一步抽象成可拓展基础设施

如果现在就把调用方和底层实现耦合死，后续升级时就需要同时修改：

- create post service
- update post service
- 上传表单逻辑
- 单元测试

因此本步骤选择：

- 当前实现稳妥
- 接口层提前稳定

这是兼顾短期效率和中期演进的最低复杂度方案。

### 为什么比例桶判断要独立成纯函数

比例桶本身是业务规则，不应该和图片解码方式耦合。

将其独立为纯函数的好处：

- 更容易测试
- 更容易复用
- 后续切换图片处理底层时无需改比例判断逻辑
- 便于在 mapper、调试工具或迁移脚本中复用同一规则

### 为什么 placeholder 长度保护必须内置在工具里

placeholder 会直接进入：

- `posts.imagePlaceholder`
- 首页 feed 查询响应

如果长度保护交给调用方分散处理，会带来两个问题：

- 规则容易不一致
- 后续调用方增加时容易漏掉保护逻辑

因此长度保护应被视为工具本身的职责，而不是调用方的可选行为。

## 实现顺序与依赖关系

### 第一步：确定工具输入输出契约

操作：

- 在 `image-metadata.ts` 中定义稳定返回结构
- 明确使用 `PostAspectRatioBucket`

依赖：

- 依赖第一步文档中已经补齐的比例桶类型

目的：

- 保证后续 create / update service 可以直接对接

### 第二步：实现图片加载与宽高读取

操作：

- 使用 `URL.createObjectURL(file)`
- 使用 `new Image()`
- 等待图片加载完成
- 读取：
  - `naturalWidth`
  - `naturalHeight`
- 在结束后调用 `URL.revokeObjectURL()`

依赖：

- 只依赖浏览器环境和 `File`

### 第三步：实现比例桶选择逻辑

操作：

- 计算 `width / height`
- 与目标比例做最小差值匹配：
  - `1:1 => 1`
  - `3:4 => 0.75`
  - `4:3 => 1.333...`

依赖：

- 依赖宽高读取成功
- 如果宽高读取失败，则回退到默认桶 `3:4`

### 第四步：实现 placeholder 生成逻辑

操作：

- 创建一个小尺寸 canvas
- 以等比缩放方式绘制原图
- 通过 `canvas.toDataURL('image/webp', quality)` 或兼容格式输出 data URL

建议：

- 最长边控制在 `24-40px`
- 质量参数保持低质量，优先控制体积

依赖：

- 依赖图片已成功加载

### 第五步：实现长度保护与失败降级

操作：

- 对输出的 data URL 长度做上限检查
- 超出阈值时直接丢弃 placeholder，返回 `null`
- 任一非关键步骤失败时：
  - 不中断整个流程
  - 仍尽量返回宽高与比例桶

依赖：

- 依赖前面步骤已返回基础元数据

### 第六步：完成接口封装

操作：

- 对外只暴露统一入口，例如：
  - `getImageMetadata(file)`
- 将未来可升级实现隐藏在工具内部

依赖：

- 依赖前面所有内部方法完成

### 第七步：验证工具行为

验证项：

- 正常图片可读出宽高
- 横图、竖图、接近正方形图片能落入正确比例桶
- 能生成合理长度的 placeholder
- 超长 placeholder 会被丢弃
- 失败场景下返回值稳定，不抛出业务阻断异常

该步骤完成后，后续“创建 / 编辑帖子链路接入图片元数据写入”才可以安全开始。

## 关键风险及应对策略

### 风险：主线程负担增加

问题：

- 图片解码、canvas 绘制和 `toDataURL()` 都发生在前端，理论上会增加主线程负担。

应对：

- LQIP 尺寸严格控制为极小尺寸
- 仅在用户主动上传或替换图片时执行，不在 feed 浏览阶段运行
- 保持工具实现轻量
- 如果后续观察到明显卡顿，再平滑升级到 `createImageBitmap + toBlob`

### 风险：生成的 placeholder 过大

问题：

- 即使图像尺寸被缩小，某些图片类型或质量参数也可能导致生成的 data URL 偏大。

应对：

- 控制输出尺寸
- 设定最大长度阈值
- 超出阈值时直接返回 `null`
- 不让占位图成为写库负担

### 风险：图片加载失败或文件异常

问题：

- 用户上传的文件可能损坏、格式异常，或浏览器在解码过程中失败。

应对：

- 将 placeholder 生成视为增强能力
- 失败时返回：
  - `placeholder: null`
  - `aspectRatioBucket: '3:4'` 或基于已知宽高的最接近桶
- 不阻断后续发帖流程

### 风险：object URL 未释放导致资源泄漏

问题：

- 如果 `URL.createObjectURL()` 创建后未及时回收，会造成浏览器资源泄漏。

应对：

- 在图片加载结束或失败后统一调用 `URL.revokeObjectURL()`
- 将 object URL 生命周期封装在内部 helper 中，不暴露给调用方

### 风险：底层实现与调用方耦合过深，后续难以升级

问题：

- 如果 create / update service 直接依赖某种图片处理细节，未来切换到底层新方案时改动面会扩大。

应对：

- 统一只暴露 `getImageMetadata(file)` 这样的入口
- 将图片加载、比例计算、placeholder 生成等细节都封装在工具内部
- 未来升级时只替换内部实现，不改外部调用方式

### 风险：比例桶逻辑在不同位置重复实现

问题：

- 如果上传工具、mapper、调试代码各自维护一套比例判断逻辑，会出现不一致。

应对：

- 以 `image-metadata.ts` 中的纯函数为主逻辑来源
- 后续其他层如果需要复用，直接复用这一实现

## 预期结果

本步骤完成后，项目将具备一套稳定、轻量、可升级的图片元数据生成工具：

- 能从本地图片读取宽高
- 能稳定选择最接近的比例桶
- 能生成受控长度的 LQIP data URL
- 能在失败时优雅降级
- 能为后续帖子创建 / 编辑链路提供统一输入
- 同时为未来平滑升级到底层更现代的图片处理方案保留接口空间
