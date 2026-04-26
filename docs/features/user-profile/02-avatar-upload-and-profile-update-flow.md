# 用户资料功能步骤二：实现头像上传与更新链路

## 目的

本步骤用于在现有用户资料契约之上，补齐“头像上传与资料更新”的数据层与服务层链路。

当前项目已经具备：

- `users` 表中的头像字段：
  - `imageId`
  - `imageUrl`
- 浏览器端直连 Appwrite 的 `Storage` 与 `TablesDB`
- 成熟的帖子图片上传与回滚样板：
  - `app/features/post/api/post.api.ts`
  - `app/features/post/services/post.service.ts`

但当前 `user` feature 仍缺少以下能力：

- 用户头像上传 helper
- 用户头像删除 helper
- 面向编辑资料页的窄更新接口
- “上传新头像 -> 更新 users row -> 清理旧头像”的完整编排
- 用户 row 更新失败时的新文件回滚

本步骤的目标是：

- 在不引入 Functions、服务端 API 或新 bucket 的前提下，完成浏览器端头像上传链路。
- 复用现有 `media` bucket 与现有权限策略，而不是为头像单独设计一套存储体系。
- 将复杂的多步骤流程放在 `user.service.ts`，保持 `user.api.ts` 只负责原始 Appwrite 调用。
- 支持两类编辑场景：
  - 只改 `name / bio`
  - 替换 `avatar` 并同步更新 `name / bio`
- 在替换头像时保证顺序固定为：
  1. 上传新头像
  2. 更新 `users` row
  3. 成功后删除旧头像
- 在用户 row 更新失败时，主动删除刚上传的新头像，尽量避免孤儿文件。
- 为后续独立编辑页和缓存一致性处理提供稳定的数据层基础。

本步骤不负责：

- 编辑资料页 UI
- 头像裁剪
- 文件选择器与预览交互
- 成功后的缓存失效与回写
- 用户名或邮箱编辑

## 验收标准

本步骤完成后，应满足以下验收标准：

- `user` feature 已具备独立的头像上传与删除 helper，不再只能操作 `imageUrl` 字符串。
- 用户资料编辑链路已具备窄更新接口，只允许写入：
  - `name`
  - `bio`
  - `imageId`
  - `imageUrl`
- 仅更新 `name / bio` 时：
  - 不会触发头像上传
  - 不会误清空现有 `imageId / imageUrl`
- 替换头像时：
  - 新头像会上传到现有 `media` bucket
  - 新头像文件权限与当前帖子图片权限策略保持一致
  - `users` row 会写入新的 `imageId / imageUrl`
- 如果新头像上传成功，但 `users` row 更新失败：
  - 刚上传的新文件会被主动删除
  - 原资料头像仍保持不变
- 如果 `users` row 更新成功，但旧头像删除失败：
  - 不回滚新的资料数据
  - 页面仍可继续使用新的头像
  - 失败会被记录为可观测日志
- 默认头像场景仍然成立：
  - 当用户当前头像来源于 `avatars.getInitials()` 时，允许 `imageId` 为空
  - 替换时不会尝试删除一个不存在的旧文件
- 本步骤不会破坏现有认证链路：
  - `signUpWithEmail()`
  - `getCurrentUser()`
  - `retryInitializeCurrentUserProfile()`
- 本步骤不新增 bucket、不新增表、不引入 Appwrite Functions，符合当前免费版约束。

## 改了什么，改在哪里

### 一、补齐头像更新链路所需的输入输出类型

改动位置：

- `app/features/user/types/user.type.ts`

本步骤建议在步骤一已拆好的用户资料契约基础上，继续补齐“服务层编排”所需类型。

建议新增或明确以下类型：

- `UpdateEditableUserProfileInput`
  - 供 `users` row 窄更新使用
  - 只包含：
    - `name`
    - `bio`
    - `imageId`
    - `imageUrl`
- `UpdateEditableUserProfileWithAvatarInput`
  - 供 `user.service.ts` 使用
  - 建议包含：
    - `profileId`
    - `ownerAccountId`
    - `name`
    - `bio`
    - `currentImageId`
    - `currentImageUrl`
    - `nextAvatarFile?: File | null`

这里不建议把“是否换头像”的判断塞进一个继续承担认证修复职责的宽类型。

原因：

- 编辑资料与认证修复已经在步骤一中被明确拆开。
- 本步骤的服务层需要知道：
  - 当前头像是什么
  - 新头像文件是否存在
  - 新旧头像何时切换
- 这些信息不适合继续混入认证初始化使用的 repair 输入契约。

### 二、在 `user.api.ts` 中补齐头像存储 helper

改动位置：

- `app/features/user/api/user.api.ts`

建议新增以下原始 Appwrite helper：

- `getUserAvatarImageView(fileId)`
- `uploadUserAvatar(file, ownerAccountId)`
- `deleteUserAvatarImage(fileId)`

建议行为：

- `getUserAvatarImageView(fileId)`
  - 复用 `storage.getFileView()`
  - 返回最终写入 `users.imageUrl` 的可展示 URL
- `uploadUserAvatar(file, ownerAccountId)`
  - 复用现有 `media` bucket
  - 复用 `buildPublicOwnerPermissions(ownerAccountId)`
  - 返回 Appwrite 文件对象，供 service 拿到新 `fileId`
- `deleteUserAvatarImage(fileId)`
  - 复用 `storage.deleteFile()`
  - 对 `404` 视为幂等成功，不再向上抛出

这里不建议让编辑页组件直接调用 `Storage`。

原因：

- `Storage` 调用属于基础设施细节。
- 后续如果头像链路要补日志、限流、防御性处理，应该收敛在 `user.api.ts`。
- 这样也和现有 `post.api.ts` 的项目分层保持一致。

### 三、在 `user.api.ts` 中新增编辑资料专用窄更新方法

改动位置：

- `app/features/user/api/user.api.ts`

在步骤一中，用户资料已经需要拆出编辑专用输入契约。本步骤应继续把对应的 raw update API 补齐。

建议新增：

- `updateEditableUserProfile(profileId, input)`

写入字段只包含：

- `name`
- `bio`
- `imageId`
- `imageUrl`

这里不建议继续复用当前的：

- `updateUserProfile()`

原因：

- 当前 `updateUserProfile()` 仍包含：
  - `email`
  - `username`
- 这与本期编辑资料页的产品边界冲突。
- 头像上传链路一旦继续依赖宽接口，后续很容易把不该写的字段重新带回编辑流。

### 四、新增 `user.service.ts` 承载多步骤编排

建议新增：

- `app/features/user/services/user.service.ts`

这是本步骤的核心改动。

建议新增服务方法，例如：

- `updateEditableUserProfileWithAvatar(input)`

服务职责：

- 统一处理“只改文本”和“替换头像”两条路径
- 管理：
  - 新头像上传
  - 用户 row 更新
  - 失败回滚
  - 旧头像清理

建议流程分两条：

1. 如果 `nextAvatarFile` 不存在：
   - 直接调用 `updateEditableUserProfile()`
   - 沿用当前 `imageId / imageUrl`
2. 如果 `nextAvatarFile` 存在：
   - 先上传新头像
   - 生成新 `imageId / imageUrl`
   - 调用 `updateEditableUserProfile()`
   - 更新成功后，尝试删除旧头像

建议新增 service 内部 helper：

- `cleanupUploadedAvatar(fileId, context)`

职责：

- 当新头像上传完成后，如果后续 `users` row 更新失败，主动清理新文件
- 将这类清理行为从主流程中抽出，降低重复逻辑

### 五、固定替换头像的顺序与失败语义

改动位置：

- `app/features/user/services/user.service.ts`

本步骤需要明确固定顺序，而不是把顺序交给调用方自由组合。

固定顺序应为：

1. 上传新头像
2. 更新 `users` row
3. 删除旧头像

失败语义应为：

- 新头像上传失败：
  - 整个保存失败
  - 不改动原用户资料
- 新头像上传成功，row 更新失败：
  - 删除新头像回滚
  - 整个保存失败
- row 更新成功，旧头像删除失败：
  - 资料保存仍视为成功
  - 只记录清理失败日志

这里不建议在“旧头像删除失败”时回滚用户 row。

原因：

- 资料页已经成功指向新头像，用户看到的新头像是有效的。
- 如果为了解决一个旧文件清理失败而回滚 row，反而会把用户带回旧资料状态。
- 在纯客户端直连 Appwrite 的架构里，这类问题更适合定义为“最佳努力清理”，而不是“强一致事务回滚”。

### 六、继续使用 `imageId + imageUrl` 双字段，而不是只保留其中一个

改动位置：

- `app/features/user/types/user.type.ts`
- `app/features/user/api/user.api.ts`
- `app/features/user/services/user.service.ts`

本步骤中，头像更新后的用户资料仍建议同时维护：

- `imageId`
- `imageUrl`

原因：

- `imageId` 是删除旧文件和定位存储对象的唯一稳定句柄。
- `imageUrl` 是当前 UI 直接消费的展示字段。
- 当前全站头像展示逻辑已经普遍依赖 `imageUrl`，包括：
  - 侧边栏
  - 底栏
  - 帖子作者信息

这里不建议在现阶段把所有头像展示都重构成“运行时再由 `imageId` 现算 URL”。

原因：

- 会放大改动面
- 会让默认头像 URL 与上传头像 URL 的处理方式变复杂
- 不符合本期“先把资料链路打通”的目标

### 七、本步骤不提前把 UI、路由和缓存失效混进来

本步骤明确不要求改动：

- `app/routes/updateProfile.tsx`
- React Query mutation hooks
- 缓存失效策略

原因：

- 这一步的职责是把底层上传与更新链路先做稳。
- 编辑页接入属于后续步骤。
- 缓存一致性属于总体设计中的单独步骤，应该独立处理。

这样可以让当前步骤的验收聚焦在：

- 数据层是否正确
- 回滚逻辑是否正确
- 存储清理是否正确

## 为什么选择这个方案

### 为什么把复杂流程放到 `user.service.ts`

因为当前项目已经形成了稳定分层：

- `api` 负责原始 Appwrite 调用
- `service` 负责多步骤业务编排

帖子图片链路就是现成样板：

- 上传文件
- 写 row
- 失败回滚
- 旧文件清理

头像替换本质上和帖子换图是同一类问题，因此继续沿用这个分层最自然，也最容易维护。

### 为什么继续复用现有 `media` bucket`

原因：

- 当前项目已经有可用的公共媒体 bucket。
- Appwrite Cloud 免费版下，不适合为头像单独再增加一套存储结构。
- 头像与帖子图片在权限模型上是兼容的：
  - 公开可读
  - 所有者可更新 / 删除

复用同一个 bucket 可以减少：

- schema 与配置改动
- 部署成本
- 文档与环境变量复杂度

### 为什么采用“先上传新头像，再更新 row，最后删旧头像”

原因：

- 在浏览器端直连 Appwrite 的架构下，`Storage` 与 `TablesDB` 之间没有事务。
- 因此只能采用“主流程 + 补偿回滚”的顺序。
- 如果先删旧头像再上传新头像，一旦中间失败，用户资料就会短暂或永久指向失效头像。

固定为：

- 上传新头像
- 更新 row
- 删除旧头像

是风险最低的顺序。

### 为什么 `users` row 更新失败时必须删除新文件

因为这是本步骤最直接、也最可控的垃圾文件来源。

如果不回滚：

- `users` row 仍然指向旧头像
- 新头像文件却已经留在 bucket 中
- 该文件后续没有稳定引用，极易变成孤儿文件

在免费版资源约束下，这类浪费应尽量在写路径上立即处理。

### 为什么旧头像删除失败时不回滚新的资料数据

原因：

- 新的 `imageId / imageUrl` 已经成功写入 row
- 页面已经可以读取并展示新头像
- 此时唯一的问题是旧文件残留，而不是用户资料失效

旧文件清理失败更适合定义为：

- 非阻断问题
- 记录日志
- 后续再排查或补清理

而不是把用户体验一起拖回失败状态。

### 为什么继续保留默认头像 URL 的兼容路径

当前项目在注册和资料修复时，会使用：

- `avatars.getInitials()`

这意味着并非每个用户的头像都对应一个 Storage 文件。

因此本步骤必须允许：

- `imageId` 为空
- `imageUrl` 仍然可用

否则默认头像用户一进入编辑链路，就会被错误地当成“缺失头像数据”的异常状态。

## 实现顺序与依赖关系

### 第一步：先完成步骤一中的用户资料契约拆分

依赖：

- `01-user-profile-contract.md`

原因：

- 本步骤依赖编辑资料专用输入契约
- 本步骤依赖 `imageId` 已进入前端类型
- 本步骤依赖认证修复路径与编辑路径已经分开

### 第二步：在 `user.api.ts` 中补齐头像存储 helper

操作：

- 新增头像 URL helper
- 新增头像上传 helper
- 新增头像删除 helper

依赖：

- 依赖现有 `media` bucket
- 依赖现有 `Storage` 客户端

### 第三步：新增编辑资料专用 row 更新 API

操作：

- 新增 `updateEditableUserProfile()`
- 明确只写编辑页允许修改的字段

依赖：

- 依赖第一步的窄输入类型

### 第四步：新增 `user.service.ts` 并完成主流程编排

操作：

- 接入“只改文本”路径
- 接入“替换头像”路径
- 增加 row 更新失败时的新文件回滚
- 增加旧头像最佳努力清理

依赖：

- 依赖第二步和第三步已提供基础 API

### 第五步：补齐最小验证与日志

操作：

- 验证空 `profileId`
- 验证空 `ownerAccountId`
- 验证空文件输入
- 对关键失败点输出上下文明确的日志

依赖：

- 依赖第四步主流程已成形

### 第六步：做链路验证，为编辑页接入做准备

验证项：

- 只更新 `name / bio`
- 更新 `name / bio + avatar`
- 上传成功但 row 更新失败
- row 更新成功但旧文件删除失败
- 当前头像为默认头像时的替换场景

这一步完成后，后续步骤即可基于稳定服务层继续接入：

- 独立编辑页
- mutation hooks
- 缓存一致性处理

## 关键风险及应对策略

### 风险：浏览器端直连 Appwrite，头像替换不是事务操作

问题：

- `Storage.createFile()` 与 `TablesDB.updateRow()` 之间没有事务保证
- 中途任一环节失败，都可能留下半完成状态

应对：

- 将链路固定为“主流程 + 补偿回滚”
- row 更新失败时主动删除新文件
- 旧文件删除失败时不回滚新 row，只做最佳努力清理

### 风险：新头像上传成功但 row 更新失败，产生孤儿文件

问题：

- 这是纯客户端链路中最容易出现的垃圾文件来源

应对：

- 在 `user.service.ts` 中集中实现 `cleanupUploadedAvatar()`
- 只要新文件已经上传并拿到 `fileId`，后续失败就尝试清理

### 风险：旧头像先删除会导致资料短暂指向坏链接

问题：

- 如果先删旧头像，再更新 row 或上传新头像，中途失败会直接损坏用户资料展示

应对：

- 强制固定顺序：
  - 先上传新头像
  - 再更新 row
  - 最后删除旧头像

### 风险：默认头像没有 `imageId`，删除逻辑误报异常

问题：

- 一部分用户当前头像来自 `avatars.getInitials()`
- 这类头像并没有 Storage 文件可删

应对：

- 只有当前资料存在 `imageId` 时才尝试删除旧头像
- 对 `imageId` 为空视为正常路径，而不是异常

### 风险：继续复用宽更新接口，把 `email / username` 带回编辑流

问题：

- 这会重新破坏步骤一建立的边界

应对：

- 本步骤只接编辑资料专用窄更新方法
- 认证修复接口与头像更新接口保持分离

### 风险：旧文件删除失败导致免费版存储逐渐被残留文件吃掉

问题：

- 即使用户资料更新成功，旧文件残留仍会持续占用 bucket 空间

应对：

- 将旧文件删除定义为最佳努力清理，但保留明确日志
- 后续如有需要，可在运维阶段增加一次性清理脚本
- 当前先优先保证主链路稳定与用户资料可用

### 风险：在本步骤过早引入 UI、mutation、缓存处理，导致改动面失控

问题：

- 头像上传链路本身已经包含存储、row 更新、回滚和清理
- 如果同时把编辑页、toast、缓存刷新一起接入，问题定位会变困难

应对：

- 本步骤只落数据层与服务层
- 编辑页接入放到后续步骤
- 缓存一致性放到独立步骤处理

## 预期结果

本步骤完成后，项目将具备一条稳定、可复用的用户头像更新基础链路：

- `user.api.ts` 能独立处理头像上传、头像删除和窄资料更新
- `user.service.ts` 能安全编排文本更新与头像替换
- 新头像上传成功但资料更新失败时，能够主动回滚新文件
- 资料更新成功后，能够按最佳努力清理旧头像
- 默认头像与上传头像可以在同一套资料模型中共存

这样后续实现独立编辑页时，就不需要再在页面层重新设计上传顺序、失败回滚和存储清理逻辑，只需接入这条已经稳定的数据链路即可。
