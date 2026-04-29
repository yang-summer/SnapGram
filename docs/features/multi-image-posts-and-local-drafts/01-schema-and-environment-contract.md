# 多图帖子与本地草稿箱步骤一：定义 Schema 与环境变量契约

## 目的

本步骤用于把阶段二实现所依赖的底层资源契约先定义清楚。

当前项目已经具备：

- `posts` 表及其单图封面字段
- `media` bucket
- `content-actions` Function
- 前端与 Function 各自独立的 Appwrite 环境变量读取逻辑

但距离多图帖子和本地草稿箱的正式实现，还缺少一层明确的“资源边界”：

- `posts` 在多图时代到底保留哪些摘要字段
- 真实图片组由哪个表承载
- 客户端、Function 和迁移脚本分别从哪里读取 `postMedia` 表 ID
- 现有共享 bucket 如何从“公开读”过渡到“私有上传，发布后公开”

本步骤的目标有五个：

- 为多图帖子定义稳定的数据库资源结构。
- 为客户端、Function 和迁移脚本补齐一致的环境变量契约。
- 为后续 `post.create / post.update` Function 提前准备好可引用的表 ID 和 bucket 权限模型。
- 在不破坏现有单图读链路的前提下，为多图读写改造留出空间。
- 将“哪些远端配置必须先改、哪些代码可以后改”讲清楚，避免后续实现顺序出错。

本步骤只定义契约，不落地以下内容：

- 不实现多图表单状态机
- 不实现图片压缩
- 不实现 `post.create / post.update`
- 不实现旧数据迁移脚本
- 不修改创建/编辑帖子前端业务逻辑

## 验收标准

本步骤完成后，应满足以下验收标准：

- `posts` 表已补齐 `mediaCount` 字段，并明确其在迁移完成前的兼容策略。
- 远端 Appwrite 已定义 `postMedia` 表结构与索引。
- 仓库内的 `appwrite.config.json` 已同步记录新的 `postMedia` 表和 `posts.mediaCount` 字段。
- 前端环境变量契约已新增 `VITE_APPWRITE_POST_MEDIA_TABLE_ID`。
- Function 环境变量契约已新增 `APPWRITE_POST_MEDIA_TABLE_ID`。
- 本地运行、Function 本地验证、迁移脚本三套环境读取入口都能拿到 `postMedia` 表 ID。
- `media` bucket 的目标权限模型已被明确为：
  - bucket 级不再依赖 `read("any")`
  - 文件级权限决定是否公开
  - 已发布帖子图片最终公开读
  - 未发布上传文件保持当前用户私有
- `postMedia` 的读写权限模型已被明确为：
  - table-level `read("any")`
  - 浏览器端不拥有 `create / update / delete`
  - 未发布中间态安全性由 Storage staged file 权限保证
- 本步骤结束后，后续代码步骤可以直接开始引用：
  - `appwriteConfig.postMediaTableId`
  - `readConfig().postMediaTableId`

## 改了什么，改在哪里

### 一、扩展 `posts` 表，让它从“单图源数据”过渡为“帖子摘要 + 封面投影”

改动位置：

- `appwrite.config.json`
- 线上 Appwrite 项目的 `posts` 表

建议新增字段：

- `mediaCount`
  - 类型：`integer`
  - 必填：否
  - 默认值：`null`
  - 最小值：`1`
  - 最大值：`6`

字段职责：

- 表示当前帖子关联的图片总数。
- 作为列表摘要字段保留在 `posts` 主记录上。
- 后续可直接支持首页、搜索结果、个人页卡片上的“多图角标”或图片数量展示。

兼容策略：

- 本步骤不要求历史单图帖子立刻补齐 `mediaCount = 1`。
- 在迁移脚本执行前，允许旧行保持 `null`。
- 新的 `post.create / post.update` 上线后，应用层和 Function 层共同保证新写入帖子始终落在 `1-6` 之间。

本步骤不改动以下旧字段命名：

- `imageId`
- `imageUrl`
- `aspectRatioBucket`
- `imagePlaceholder`
- `imageWidth`
- `imageHeight`

这些字段继续保留，语义从“唯一图片字段”切换为“封面投影字段”。

### 二、新增 `postMedia` 表，作为帖子图片组的真实来源

改动位置：

- `appwrite.config.json`
- 线上 Appwrite 项目的数据库 schema

建议新增表：

- 表 ID：`postMedia`
- 显示名：`Post Media`
- `rowSecurity`：`false`

建议表级权限：

- 授予浏览器端 `read("any")`
- 不授予浏览器端 `create / update / delete`

原因：

- `postMedia` 的最终写入来自 `content-actions` Function，而不是浏览器直写。
- 详情页和编辑页后续会显式 `listRows(postMedia)`，使用 table-level `read("any")` 更符合运行时读路径。
- `postMedia` 不承载未发布中间态；未发布安全性由 staged private file 权限负责。

建议字段：

- `postId`
  - 类型：`varchar`
  - 必填：是
  - 长度：`128`
- `fileId`
  - 类型：`varchar`
  - 必填：是
  - 长度：`512`
- `sortOrder`
  - 类型：`integer`
  - 必填：是
  - 最小值：`0`
  - 最大值：`5`
- `width`
  - 类型：`integer`
  - 必填：否
  - 默认值：`null`
  - 最小值：`1`
- `height`
  - 类型：`integer`
  - 必填：否
  - 默认值：`null`
  - 最小值：`1`
- `aspectRatioBucket`
  - 类型：枚举字符串
  - 必填：否
  - 默认值：`null`
  - 可选值：`1:1`、`3:4`、`4:3`
- `placeholder`
  - 类型：`text`
  - 必填：否
  - 默认值：`null`

建议索引：

- `post_media_post_sort_idx`
  - 类型：`key`
  - 列：`postId`, `sortOrder`
  - 排序：`asc`, `asc`
- `post_media_post_idx`
  - 类型：`key`
  - 列：`postId`
  - 排序：`asc`
- `post_media_post_file_unique`
  - 类型：`unique`
  - 列：`postId`, `fileId`
  - 排序：`asc`, `asc`

读取与外键约定：

- 后续详情页和编辑页显式按 `postId` 查询 `postMedia` 并按 `sortOrder` 排序。
- 不依赖 Appwrite relationship 自动展开渲染详情，避免关系选择过宽。
- `postMedia` 通过标量 `postId` 与 `posts.$id` 建立应用层外键语义，由 `content-actions` Function 保证最终一致性。

### 三、补齐客户端的 `postMedia` 环境变量契约

改动位置：

- `app/vite-env.d.ts`
- `.env.local`
- `app/lib/appwrite/config.ts`

建议新增：

- `VITE_APPWRITE_POST_MEDIA_TABLE_ID`

建议在 `ImportMetaEnv` 中声明：

- `readonly VITE_APPWRITE_POST_MEDIA_TABLE_ID: string`

建议在 `appwriteConfig` 中新增：

- `postMediaTableId: import.meta.env.VITE_APPWRITE_POST_MEDIA_TABLE_ID`

本步骤完成后，前端代码侧就可以稳定引用：

- `appwriteConfig.postMediaTableId`

即使这一阶段还没有开始真正查询 `postMedia`，也应该先把配置入口统一补齐，避免后续组件、API 和 service 在不同地方各自读取裸环境变量。

### 四、补齐 `content-actions` Function 的 `postMedia` 环境变量契约

改动位置：

- `functions/content-actions/src/config.ts`
- `functions/content-actions/.env`
- `appwrite.config.json`
  - `functions[0].vars`

建议新增：

- `APPWRITE_POST_MEDIA_TABLE_ID`

建议改动：

- 将 `APPWRITE_POST_MEDIA_TABLE_ID` 加入 `REQUIRED_RESOURCE_ENV_KEYS`
- 在 `AppwriteResourceConfig` 中新增：
  - `postMediaTableId: string`
- 在 `readConfig()` 中补齐读取逻辑

这样后续 Function 在实现：

- `post.create`
- `post.update`
- `post.delete` 多图清理

时，可以直接通过统一配置对象读取 `postMedia` 表，而不是在业务文件中手写环境变量读取。

注意：

- Appwrite Function 的环境变量变更需要重新部署后才会生效。
- 因此远端 Console 中的 Function vars 更新，必须先于依赖该变量的新部署代码激活。

### 五、补齐迁移与脚本侧的 `postMedia` 环境变量契约

改动位置：

- `.env.migration.local`
- 后续将新增的 `scripts/migrations/migrate-post-images-to-media.mjs`

建议新增：

- `APPWRITE_POST_MEDIA_TABLE_ID`

原因：

- 历史单图迁移脚本后续一定需要知道 `postMedia` 表 ID。
- 现在先把环境变量契约写入迁移环境文件，可以避免后续脚本开发时再反向改一次基础设施层。

本步骤不要求立即修改当前的：

- `scripts/migrations/backfill-resource-permissions.mjs`

因为它当前只处理：

- `users`
- `posts`
- `likes`
- `saves`
- bucket 中已有文件权限

但 `.env.migration.local` 可以提前补齐新表 ID，作为后续迁移脚本的共用契约。

### 六、调整 `media` bucket 的目标权限模型

改动位置：

- `appwrite.config.json`
- 线上 Appwrite 项目的 `media` bucket

当前状态：

- bucket 级权限包含 `read("any")`
- `fileSecurity = true`

目标状态：

- 保持 `fileSecurity = true`
- bucket 级仅保留创建能力，例如 `create("users")`
- 移除 bucket 级 `read("any")`
- 文件是否公开，完全由 file-level permissions 决定

后续将形成两类文件权限模型：

- 已发布帖子图片：
  - `read("any")`
- 未发布上传图片：
  - `read("user:{accountId}")`
  - `update("user:{accountId}")`
  - `delete("user:{accountId}")`

需要额外说明的是，这个 bucket 现在同时承载：

- 帖子图片
- 用户头像

因此本步骤不是把整个 bucket 变成“私有文件桶”，而是把访问控制从 bucket 级公共读收回到 file 级别：

- 头像文件继续可以使用“公开读 + owner update/delete”
- 已发布帖子图片使用“公开读”
- 未发布帖子图片使用“当前用户私有”

也就是说，**共享 bucket 不变，文件权限模型分流**。

与 `postMedia` 的分工：

- 未发布中间态安全性：
  - 由 Storage staged file 私有权限保证
- 已发布媒体元数据公开：
  - 由 `postMedia` table-level `read("any")` 保证
- 浏览器端仍然不拥有 `postMedia` 的 `create / update / delete`

## 为什么选择这个方案

### 为什么 `posts` 只新增 `mediaCount`，而不是一步到位重命名所有封面字段

原因：

- 当前代码已经大面积依赖 `imageId / imageUrl / imagePlaceholder / imageWidth / imageHeight`。
- 这些字段已经服务于首页、搜索、个人页、Explore 和详情封面展示。
- 阶段二的主复杂度在多图真实源、Function 最终写入和草稿箱，不在字段改名本身。

因此这一步选择：

- 保留现有 `image*` 字段
- 只补 `mediaCount`
- 在语义上把 `image*` 明确为“封面投影字段”

这能最小化第一步的改动面，也能避免后续每一层实现都同时承受“多图重构 + 字段改名”两套成本。

### 为什么 `mediaCount` 允许为空，而不是立刻设为必填默认 `1`

原因：

- 当前线上已有少量历史单图帖子。
- 步骤一发生在迁移脚本之前。
- 如果过早把 `mediaCount` 设成强约束，第一步就会和历史数据迁移耦合。

允许 `null` 的好处：

- 旧数据可以先平稳过渡。
- 第一步只负责“建模”，不强迫现在就完成旧数据回填。
- 后续迁移脚本可以显式把旧帖子补到 `1`，而不是把这个动作隐藏在 schema 默认值里。

### 为什么要单独建 `postMedia` 表，而不是把多图直接塞进 `posts` 数组字段

原因：

- 多图不是单纯的 `fileId[]` 或 `imageUrl[]`。
- 每张图都有自己的：
  - `fileId`
  - `sortOrder`
  - `width`
  - `height`
  - `aspectRatioBucket`
  - `placeholder`
- 编辑场景需要支持：
  - 保留旧图
  - 删除旧图
  - 插入新图
  - 混合重排

如果把这些信息压进 `posts` 的并行数组里：

- 顺序错位风险很高
- diff 难以维护
- 清理文件时缺少稳定的真实来源

用独立 `postMedia` rows 表达图片组，是这个项目当前复杂度下最稳妥的结构。

### 为什么 `postMedia` 使用标量 `postId`，而不是 relationship 字段

原因：

- 当前 Appwrite 的 relationship 列无法满足本方案最需要的两个约束：
  - 不能可靠地作为必填外键
  - 不能用于我们需要的索引组合
- 详情页和编辑页需要稳定按 `postId + sortOrder` 查询，标量字段更直接。
- update/delete/create 的一致性本来就由 `content-actions` Function 负责，没必要把关键约束压在 relationship 能力上。

因此本步骤选择：

- schema 层使用标量 `postId`
- 运行时显式查询 `postMedia`

这样可以保留可索引、可必填、可显式查询的结构，同时避免 relationship 能力限制反向影响后续实现。

### 为什么 `postMedia` 不依赖 relationship 级联删除

原因：

- 多图删帖后不仅要删 `postMedia` rows，还要删 Storage 文件。
- 即使关系层支持 `cascade`，也无法把文件删除纳入同一套删除链路。
- 后续 `post.delete` 仍然必须显式掌控：
  - 先删哪些 rows
  - 再删哪些 files
  - 哪些失败需要重试或告警

因此删除语义应完全由显式业务逻辑控制，而不是依赖 schema 关系能力。

### 为什么不新建第二个私有暂存 bucket，而是继续复用当前 `media` bucket

原因：

- 当前项目已经稳定使用一个 `media` bucket 承载头像和帖子资源。
- 新建第二个 bucket 会引入更多：
  - bucket ID 环境变量
  - 文件视图 URL 构造逻辑
  - 迁移与回填脚本分支
  - 运维和 Console 配置成本

由于当前 bucket 已经启用了 `fileSecurity = true`，完全可以通过 file-level permissions 实现：

- 上传中私有
- 发布后公开

在这个前提下，再拆第二个 bucket 收益不高，复杂度却明显上升。

### 为什么客户端、Function 和迁移脚本都要补齐 `postMedia` 表 ID

原因：

- 这三个入口都会在阶段二里直接或间接操作 `postMedia`：
  - 客户端后续需要查询详情和编辑页媒体列表
  - Function 需要最终写入和清理 `postMedia`
  - 迁移脚本需要为旧帖子补建 `postMedia` rows

如果只给其中一层补环境变量，其他层后面一定还要再回补一次，容易出现命名漂移或读取方式不一致。

因此第一步就把三套入口一次性补齐，是更干净的做法。

## 实现顺序与依赖关系

### 第一步：冻结命名和资源形状

工作：

- 确定：
  - `posts.mediaCount`
  - `postMedia`
  - `postMedia.postId`
  - `postMedia.fileId`
  - `postMedia.sortOrder`
- 确定新增环境变量命名：
  - `VITE_APPWRITE_POST_MEDIA_TABLE_ID`
  - `APPWRITE_POST_MEDIA_TABLE_ID`

依赖：

- 依赖总体设计文档已确认使用 `postMedia` 作为真实图片源

说明：

- 这一步是纯命名冻结，目的是防止后续 Console、代码、脚本三边各自起名。

### 第二步：更新仓库内的配置快照

工作：

- 修改 `appwrite.config.json`
  - 为 `posts` 增加 `mediaCount`
  - 新增 `postMedia` 表定义
  - 调整 `media` bucket 目标权限快照
  - 在 `functions[0].vars` 中加入 `APPWRITE_POST_MEDIA_TABLE_ID`

依赖：

- 依赖第一步的命名已冻结

说明：

- 仓库内配置快照先更新，后续所有实现步骤都可以引用同一份目标状态。

### 第三步：补齐前端环境变量类型与配置读取

工作：

- 修改 `app/vite-env.d.ts`
- 修改 `.env.local`
- 修改 `app/lib/appwrite/config.ts`

依赖：

- 依赖第二步已经确定 `postMedia` 表 ID 命名

说明：

- 这一步完成后，前端代码层已经具备读取 `postMedia` 表 ID 的能力，但还不会马上消费。

### 第四步：补齐 Function 环境变量类型与本地读取

工作：

- 修改 `functions/content-actions/src/config.ts`
- 修改 `functions/content-actions/.env`

依赖：

- 依赖第二步已经确定 `APPWRITE_POST_MEDIA_TABLE_ID` 命名

说明：

- 这一步只做配置读取补齐，不实现 `post.create / post.update`。

### 第五步：补齐迁移环境文件

工作：

- 修改 `.env.migration.local`

依赖：

- 依赖第二步命名冻结

说明：

- 这样后续新增迁移脚本时，不需要再回头改一遍环境文件契约。

### 第六步：按“先远端、后依赖代码”的顺序修改 Appwrite Console

工作：

- 线上新增 `posts.mediaCount`
- 线上创建 `postMedia` 表及索引
- 线上为 `content-actions` 增加 `APPWRITE_POST_MEDIA_TABLE_ID`
- 线上更新 `media` bucket 权限

依赖：

- 依赖第二步已经明确目标快照

说明：

- 远端是运行真相，必须先完成资源与环境变量的 additive 改动。
- 尤其是 Function vars，因为新的环境变量缺失会直接影响后续依赖新配置的部署。

### 第七步：验证契约可被三侧读取

工作：

- 验证前端配置对象能读取 `postMediaTableId`
- 验证 Function `readConfig()` 能读取 `postMediaTableId`
- 验证迁移环境文件已经具备新变量
- 验证 bucket 级 `read("any")` 移除后，现有头像和已发布图片仍可访问
- 验证 `postMedia` 在 table-level `read("any")` 下，浏览器端可以稳定执行 `listRows()` 读取指定 `postId` 的媒体列表

依赖：

- 依赖第三到第六步完成

说明：

- 只有这一步通过，后续的多图表单、Function action 和迁移脚本才值得继续实现。

## 关键风险及应对策略

### 风险一：仓库快照与远端 Appwrite schema 漂移

问题：

- 当前项目的远端 schema 通过 Console 手动修改。
- 如果只改线上、不改 `appwrite.config.json`，后续实现会基于错误快照开发。

应对：

- 固定流程为：先更新设计文档，再更新 `appwrite.config.json`，再改远端 Console。
- 每次远端修改完成后，立刻核对：
  - 表 ID
  - 字段 key
  - 索引 key
  - bucket 权限
  - function vars

### 风险二：过早把 `mediaCount` 做成强约束，阻塞历史数据

问题：

- 历史单图帖子在迁移前没有 `mediaCount`。
- 如果第一步直接强制要求该字段非空，可能会把 schema 准备与迁移脚本绑死。

应对：

- 本步骤将 `mediaCount` 定义为可空。
- 用迁移脚本显式回填旧帖子。
- 用后续 `post.create / post.update` 在应用层保证新数据始终合法。

### 风险三：bucket 级 `read("any")` 移除后，现有公开资源失效

问题：

- 当前 bucket 同时存放帖子图片和头像。
- 如果历史文件还依赖 bucket 级公共读，而没有 file-level 公共读，权限切换后会出现图片失效。

应对：

- 在切换 bucket 权限前，先确认历史头像和帖子文件已经具备 file-level 公共读权限。
- 如有疑虑，先运行现有权限回填脚本校验和补齐。
- 切换后抽样验证：
  - 用户头像
  - 已发布帖子封面
  - 已发布帖子详情图片

### 风险四：Function 代码先要求新环境变量，远端 vars 还没配齐

问题：

- `functions/content-actions/src/config.ts` 一旦把 `APPWRITE_POST_MEDIA_TABLE_ID` 设为必填，而远端 vars 尚未更新，新部署或新执行就会失败。

应对：

- 执行顺序固定为：
  1. 先在 Console 增加新的 Function env var
  2. 再部署依赖该变量的新代码
- 本地 `.env` 也同步补齐，避免本地验证与线上行为不一致

### 风险五：`postMedia` 表公开可读后，误写入中间态 row 会被直接暴露

问题：

- 如果实现时绕过既定流程，先创建了 `postMedia` row 再决定是否发布，那么 table-level `read("any")` 会直接暴露这条元数据。

应对：

- 本步骤明确：
  - 浏览器端不拥有 `postMedia` `create / update / delete` 权限
  - `postMedia` 只承载已发布媒体元数据
  - 浏览器端先上传 staged private files
  - 最终 row 写入和删除都由 Function 负责

### 风险六：共享 bucket 中混用头像与帖子图片，导致权限模型理解混乱

问题：

- 头像仍需要“公开读 + owner 可替换”
- 已发布帖子图片需要“公开读”
- 未发布帖子图片需要“当前用户私有”

如果不在第一步把这三种文件状态讲清楚，后续实现很容易互相覆盖。

应对：

- 本步骤把 bucket 视为“共享存储容器”，不再把权限策略绑定到 bucket 级。
- 所有公开/私有差异都下沉到 file-level permissions。
- 后续实现时，头像上传链路与帖子上传链路分别维护自己的目标权限集合。

### 风险七：字段与索引命名在代码、Console、文档之间不一致

问题：

- `postId`、`post_media_post_sort_idx`、`post_media_post_file_unique` 等命名一旦漂移，后续排查会非常低效。

应对：

- 本步骤就冻结这些名字。
- 后续无论是 `appwrite.config.json`、Console 手工创建还是迁移脚本，都必须复用同一命名。

## 预期结果

本步骤完成后，项目会获得一个稳定的“多图底层资源契约”：

- `posts` 继续承担列表摘要与封面投影字段。
- `postMedia` 成为真实图片组的承载表。
- 客户端、Function 和迁移脚本都具备一致的 `postMedia` 表 ID 读取入口。
- `media` bucket 的访问模型从“bucket 公共读”切换为“file 级显式公开或私有”。
- `postMedia` 的访问模型明确为“table-level public read + Function-only write”，而未发布安全性由 Storage staged file 权限承担。
- 后续步骤可以在这个契约之上直接推进：
  - 多图压缩与表单模型
  - `content-actions.post.create / post.update`
  - 详情页轮播
  - 单图历史数据迁移
