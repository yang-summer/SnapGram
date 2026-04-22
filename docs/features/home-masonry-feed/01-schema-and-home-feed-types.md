# 首页瀑布流步骤一：Schema 与首页 Feed 类型准备

## 目的

本步骤将“扩展 Appwrite `posts` schema”与“补齐前端类型、首页专用查询字段和 mapper”合并为一个准备阶段。

目的有四个：

- 为后续帖子上传时写入图片比例和占位图元数据提供合法字段。
- 为首页瀑布流分页查询提供稳定的数据契约。
- 让旧帖子在缺失新字段时仍能安全渲染，不阻塞首页改造上线。
- 将首页瀑布流需要的字段与现有普通帖子列表查询隔离，避免不必要的过取。

这是首页瀑布流实现的第一个正式工程步骤，也是后续上传链路、分页 API、渐进式图片组件和瀑布流组件的前置条件。

## 验收标准

本步骤完成后，应满足以下验收标准：

- `posts` 表新增以下字段，并已在本地配置和线上 Appwrite schema 中一致存在：
  - `aspectRatioBucket`
  - `imagePlaceholder`
  - `imageWidth`
  - `imageHeight`
- 以上字段全部允许为空，或采用不会阻断旧数据和旧写入逻辑的安全默认策略。
- 前端帖子原始类型已补齐上述字段定义。
- 前端已新增首页 feed 专用 view model，不强行复用现有 `PostCardViewModel` 或 `PostGridItemViewModel`。
- 前端已新增首页 feed 专用 `Query.select()` 字段常量，包含瀑布流首页需要的图片元数据字段。
- mapper 已对旧数据做统一降级：
  - `aspectRatioBucket` 缺失或非法时默认回落为 `3:4`
  - `imagePlaceholder` 缺失时返回 `null`
  - `imageWidth` / `imageHeight` 缺失时返回 `null`
- 现有首页以外的帖子查询行为不受影响，不会因为首页新增字段而被动带上 placeholder 等高负载字段。

## 改了什么，改在哪里

### 一、扩展 Appwrite `posts` schema

改动位置：

- `appwrite.config.json`
- 线上 Appwrite 项目的 `posts` 表

新增字段建议：

- `aspectRatioBucket`
  - 类型：枚举字符串
  - 可选值：`1:1`、`3:4`、`4:3`
  - 建议：可为空
- `imagePlaceholder`
  - 类型：`text`
  - 建议：可为空
- `imageWidth`
  - 类型：`integer`
  - 建议：可为空
- `imageHeight`
  - 类型：`integer`
  - 建议：可为空

字段职责：

- `aspectRatioBucket`
  - 用于首页卡片首屏比例占位
  - 用于瀑布流卡片高度估算
- `imagePlaceholder`
  - 用于首页图片的 LQIP 占位图
- `imageWidth` / `imageHeight`
  - 为后续真实尺寸分析、调试和布局优化提供数据基础

本阶段不增加与这些字段相关的索引，因为它们不参与查询过滤、搜索或排序。

### 二、扩展帖子类型定义

改动位置：

- `app/features/post/types/post.type.ts`

建议改动：

- 新增统一比例桶类型，例如：
  - `PostAspectRatioBucket = '1:1' | '3:4' | '4:3'`
- 扩展 `RawPostRow`
- 扩展 `RawPostListRow`
- 扩展 `RawPostWriteRow`
- 如后续 create / update API 输入需要，也可提前扩展：
  - `CreatePostApiInput`
  - `UpdatePostApiInput`
- 新增首页专用 view model，例如：
  - `HomeFeedPostViewModel`

首页专用 view model 建议包含：

- `id`
- `createdAt`
- `caption`
- `imageUrl`
- `imagePlaceholder`
- `aspectRatioBucket`
- `imageWidth`
- `imageHeight`
- `creator`
- `likeCount`

这里不建议复用现有：

- `PostCardViewModel`
- `PostGridItemViewModel`

因为首页瀑布流对图片元数据有明确新增需求，继续复用旧类型只会让模型职责混乱。

### 三、增加首页 feed 专用 select 字段

改动位置：

- `app/features/post/api/post.api.ts`

当前已有：

- `POST_CARD_SELECT`
- `POST_GRID_SELECT`
- `POST_DETAIL_SELECT`
- `POST_EDITOR_SELECT`

建议新增：

- `POST_HOME_FEED_SELECT`

建议字段：

- `$id`
- `$createdAt`
- `caption`
- `imageUrl`
- `imagePlaceholder`
- `aspectRatioBucket`
- `imageWidth`
- `imageHeight`
- `likeCount`
- `creator.$id`
- `creator.name`
- `creator.imageUrl`

这里不建议直接把新字段塞进 `POST_CARD_SELECT` 或 `POST_GRID_SELECT`。

原因是：

- `imagePlaceholder` 会增加返回体积
- 首页需要这些字段，不代表其他页面也需要
- 不同场景应按需取数，避免 Appwrite 免费版读流量和响应体积无意义放大

### 四、增加首页 feed 专用 mapper 与统一降级逻辑

改动位置：

- `app/features/post/mappers/post.mapper.ts`

建议新增：

- `normalizePostAspectRatioBucket()`
- `mapPostRowToHomeFeedItemViewModel()`
- `mapPostRowsToHomeFeedItemViewModels()`

降级规则统一放在 mapper 层处理，不要分散到组件层：

- `aspectRatioBucket` 缺失或非法：
  - 返回 `3:4`
- `imagePlaceholder` 缺失：
  - 返回 `null`
- `imageWidth` / `imageHeight` 缺失：
  - 返回 `null`
- `creator` 缺失：
  - 延续现有坏数据拦截策略

这样首页组件不需要反复写：

- `post.aspectRatioBucket ?? '3:4'`
- `post.imagePlaceholder ?? null`

组件层只消费已经整理好的稳定数据。

## 为什么选择这个方案

### 为什么把 schema 与类型/select/mapping 合成一步

这两件事虽然技术上可以分开，但工程上属于同一个“数据契约准备阶段”。

原因：

- schema 先决定“哪些字段合法存在”
- 类型定义决定“这些字段在前端如何表达”
- select 决定“首页真正取哪些字段”
- mapper 决定“旧数据如何降级”

如果把这四部分拆得过散，会导致后续上传链路和首页分页开发时反复返工数据结构。

将其视为同一步的好处：

- 数据契约一次定清
- 首页字段范围一次定清
- 降级策略一次定清
- 后续步骤只在这个契约上做写入和消费

### 为什么新字段全部允许为空

原因：

- 现有帖子没有这些字段
- 本期明确接受旧数据不迁移
- 允许为空可以让旧帖子和新代码共存
- 新帖子在上传链路完成后会逐步自然补齐这些字段

数据库层允许为空，前端层统一降级，是兼顾兼容性和实现速度的最小复杂度方案。

### 为什么 `aspectRatioBucket` 不建议直接在数据库层写死默认值

建议数据库存 `null`，由 mapper 统一回退到 `3:4`。

这样做的好处：

- 可以明确区分“真实写入过的比例元数据”和“旧帖子或缺失数据的兜底值”
- 后续如果想统计元数据覆盖率，更容易做
- 如果未来默认比例策略调整，只需改 mapper，不需要回改数据库默认值

### 为什么 `imagePlaceholder` 只在首页专用 select 中查询

原因：

- placeholder 属于首页图片渲染所需的高负载字段
- 它不是每个页面都需要
- 如果将它加入通用帖子 select，会让无关页面也承担更大的响应体积
- 当前项目运行在 Appwrite 免费版约束下，应该尽量按场景取最少的数据

### 为什么需要首页专用 view model

首页瀑布流的卡片与现有页面有明显差异：

- 需要比例占位
- 需要占位图
- 需要渐进式图片状态

如果继续强行复用现有：

- `PostCardViewModel`
- `PostGridItemViewModel`

会出现两个问题：

- 类型不断膨胀，职责不清
- 查询和组件之间会被迫共享不必要字段

新增首页专用 view model 可以让数据契约更清晰，也更利于后续组件复用。

## 实现顺序与依赖关系

### 第一步：更新本地 schema 配置

操作：

- 修改 `appwrite.config.json`
- 为 `posts` 表增加新字段定义

目的：

- 让仓库内的配置与目标 schema 保持一致

### 第二步：同步线上 Appwrite schema

操作：

- 在线上 Appwrite 项目的 `posts` 表中增加相同字段

依赖：

- 依赖第一步完成，字段命名和类型已明确

注意：

- 线上 schema 完成后，前端代码才能安全开始读写这些字段

### 第三步：扩展前端类型

操作：

- 更新 `post.type.ts`
- 补齐原始 row、写入 row 和首页 view model 类型

依赖：

- 依赖 schema 已确定

### 第四步：新增首页专用 select

操作：

- 在 `post.api.ts` 中增加 `POST_HOME_FEED_SELECT`

依赖：

- 依赖 schema 已经具备这些字段
- 依赖 raw type 已补齐

### 第五步：实现 mapper 降级逻辑

操作：

- 在 `post.mapper.ts` 中新增首页 mapper 和统一降级方法

依赖：

- 依赖类型和首页 select 范围已定

### 第六步：验证“数据契约准备”完成

验证项：

- 类型编译无误
- 新字段命名在 schema、type、select、mapper 中完全一致
- mapper 对旧帖子降级逻辑明确
- 现有非首页查询未被动带上 placeholder 等字段

这一步完成后，后续上传写入链路和首页分页 API 才能基于稳定契约继续开发。

## 关键风险及应对策略

### 风险：本地 `appwrite.config.json` 与线上 schema 不一致

问题：

- 仓库中记录的 schema 与线上实际 schema 脱节，后续维护时容易误判字段状态。

应对：

- 以线上 schema 为运行真相
- 每次修改线上字段后，同步更新 `appwrite.config.json`
- 在本阶段完成后做一次字段名称和类型的双向核对

### 风险：代码先发布，schema 后发布

问题：

- 如果前端先读写新字段，而线上 schema 尚未创建这些字段，创建帖子或查询会直接失败。

应对：

- 固定发布顺序：先 schema，后代码
- 本步骤完成前，不启动后续 create/update 写入改造

### 风险：`imagePlaceholder` 导致响应体积增大

问题：

- 如果把 placeholder 加入所有帖子查询，Appwrite 免费版下读请求和网络负担会被放大。

应对：

- 仅在首页专用 `POST_HOME_FEED_SELECT` 中加入该字段
- 不污染 `POST_GRID_SELECT`、`POST_CARD_SELECT`

### 风险：旧数据缺字段，导致组件中出现大量分支判断

问题：

- 如果降级逻辑散落在组件层，后续首页卡片和图片组件会充满重复判断。

应对：

- 所有默认值和缺省规则统一收敛在 mapper
- 组件只消费整理后的 view model

### 风险：比例桶值在不同文件中重复定义，后续不一致

问题：

- schema、前端类型、上传元数据工具、mapper 可能分别维护不同的比例枚举值。

应对：

- 在 `post.type.ts` 中定义统一的比例桶类型
- 后续上传元数据工具和 mapper 统一复用这一套定义
- schema 枚举值也严格与其保持一致

### 风险：首页继续复用旧 view model，导致职责混乱

问题：

- 现有 `PostCardViewModel` 和 `PostGridItemViewModel` 并不适合承载首页瀑布流专属字段。

应对：

- 明确新增首页专用 view model
- 将首页卡片与现有列表卡片的数据契约隔离

## 预期结果

本步骤完成后，项目将具备一个稳定的“首页瀑布流数据准备层”：

- Appwrite `posts` 表已具备承载比例和占位图元数据的字段
- 前端已有首页专用类型和查询字段定义
- mapper 已经对旧帖子建立统一降级规则
- 后续步骤可以直接在这个契约基础上继续实现：
  - 上传时写入图片元数据
  - 首页分页 API
  - 渐进式图片组件
  - 瀑布流组件和首页接入
