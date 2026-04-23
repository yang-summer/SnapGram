# 用户资料功能步骤一：补齐用户资料契约

## 目的

本步骤用于补齐用户资料功能在前端代码侧的数据契约。

当前项目的 `users` 表已经具备本期资料功能所需的大部分字段：

- `name`
- `username`
- `email`
- `bio`
- `imageId`
- `imageUrl`
- `accountId`

但当前前端代码仍存在几个明显缺口：

- `UserProfileRecord` 没有声明 `imageId`
- 用户资料查询只支持按 `accountId` 查找，不支持按 `profileId` 查找
- 当前 `updateUserProfile()` 是一个“宽更新接口”，同时包含：
  - `email`
  - `username`
  - `name`
  - `imageUrl`
  - `bio`
- 资料展示页、编辑页、认证恢复流程尚未拥有各自清晰分离的数据契约

本步骤的目标有五个：

- 将 `users` 表已有字段在前端类型中完整表达出来
- 为资料页公开访问建立按 `profileId` 读取资料的能力
- 为编辑资料页建立“仅编辑 `avatar / name / bio`”的专用输入输出契约
- 让认证初始化与资料编辑不再共用同一个宽接口
- 为后续头像上传、资料页路由和缓存回填提供稳定的数据基础

这是用户资料功能的第一个正式工程步骤，也是后续头像上传、资料页路由壳和独立编辑页的前置条件。

## 验收标准

本步骤完成后，应满足以下验收标准：

- 前端 `UserProfileRecord` 已补齐 `imageId` 字段定义。
- 前端不再只有“按 `accountId` 查资料”这一种用户资料查询方式。
- 已新增按 `profileId` 获取用户资料的查询能力，满足公开资料页路由需求。
- 已为以下场景分别定义清晰的数据契约：
  - 认证初始化 / 资料修复
  - 公开资料展示
  - 编辑资料页
- 编辑资料页的数据契约只包含本期允许编辑的字段：
  - `avatar`
  - `name`
  - `bio`
- `email` 和 `username` 不会被误放入资料编辑页的提交接口。
- 现有认证流程不被破坏：
  - `signUpWithEmail()`
  - `retryInitializeCurrentUserProfile()`
  - `getCurrentUser()`
- 用户资料相关 `select` 字段按场景拆分，避免公开资料页和编辑页被动取出不必要字段。

## 改了什么，改在哪里

### 一、补齐 `users` row 的原始类型定义

改动位置：

- `app/features/user/types/user.type.ts`

建议改动：

- 为 `UserProfileRecord` 增加：
  - `imageId?: string | null`
- 保留现有：
  - `accountId`
  - `email`
  - `name`
  - `username`
  - `imageUrl`
  - `bio`

原因：

- `users` 表 schema 已经存在 `imageId`，但前端 row type 仍未声明它。
- 后续头像替换流程需要依赖旧头像的 `imageId` 做文件清理。

本步骤不修改线上 schema，也不新增字段，只是让前端类型与现有 schema 对齐。

### 二、拆分用户资料输入类型，停止复用“宽更新接口”

改动位置：

- `app/features/user/types/user.type.ts`
- `app/features/user/api/user.api.ts`
- `app/features/auth/services/auth.service.ts`

当前问题：

- `UpdateUserProfileInput` 同时承担了：
  - 资料修复
  - 认证初始化补全
  - 编辑资料页更新

这会导致两个问题：

- 编辑资料页很容易误拿到 `email / username` 可写能力
- 认证恢复流程与资料编辑流程耦合在同一个更新接口上

建议拆分为三类输入：

- `CreateUserProfileInput`
  - 保留给注册时初始化使用
- `RepairUserProfileInput`
  - 供 `retryInitializeCurrentUserProfile()` 或缺失资料修复使用
  - 仍允许带上：
    - `email`
    - `username`
    - `name`
    - `imageUrl`
    - `bio`
- `UpdateEditableUserProfileInput`
  - 供独立编辑页使用
  - 只包含：
    - `name`
    - `bio`
    - `imageId`
    - `imageUrl`

这里不建议继续让编辑页直接复用当前 `UpdateUserProfileInput`。

### 三、按场景拆分用户资料查询字段集合

改动位置：

- `app/features/user/api/user.api.ts`

当前只有一个：

- `USER_PROFILE_SELECT`

建议拆分为至少三组：

- `USER_PROFILE_AUTH_SELECT`
  - 用于认证初始化与当前用户恢复
  - 建议字段：
    - `$id`
    - `accountId`
    - `email`
    - `name`
    - `username`
    - `imageUrl`
    - `bio`
- `USER_PROFILE_PUBLIC_SELECT`
  - 用于公开资料页头部
  - 建议字段：
    - `$id`
    - `name`
    - `username`
    - `imageUrl`
    - `bio`
- `USER_PROFILE_EDIT_SELECT`
  - 用于独立编辑页
  - 建议字段：
    - `$id`
    - `accountId`
    - `email`
    - `name`
    - `username`
    - `imageId`
    - `imageUrl`
    - `bio`

这里不建议继续所有场景复用一套 `select`。

原因是：

- 公开资料页不需要拿 `email` 或 `accountId`
- 编辑页必须拿到 `imageId`，否则无法安全替换头像
- 认证恢复需要 `email / username`，但公开资料页不应关心这些字段

### 四、新增按 `profileId` 查询用户资料的 API

改动位置：

- `app/features/user/api/user.api.ts`

当前已有：

- `getUserProfileByAccountId(accountId)`

建议新增：

- `getPublicUserProfileById(profileId)`
- `getEditableUserProfileById(profileId)`

建议行为：

- `getPublicUserProfileById(profileId)`
  - 通过 `tablesDB.getRow()` 按 row id 读取
  - 使用 `USER_PROFILE_PUBLIC_SELECT`
- `getEditableUserProfileById(profileId)`
  - 通过 `tablesDB.getRow()` 按 row id 读取
  - 使用 `USER_PROFILE_EDIT_SELECT`

这里不建议让资料页路由继续走“先拿 `profileId`，再倒推出 `accountId`”的模式。

原因：

- 资料页公开 URL 本身就是 `profileId`
- `profileId` 就是 `users` row 的 `$id`
- 直接按 row id 查询最短、最清晰，也最符合当前路由结构

### 五、新增用户资料专用 view model 和 mapper

改动位置：

- `app/features/user/types/user.type.ts`
- 建议新增：`app/features/user/mappers/user.mapper.ts`

建议新增至少两类 view model：

- `PublicUserProfileViewModel`
  - `id`
  - `name`
  - `username`
  - `imageUrl`
  - `bio`
- `EditableUserProfileViewModel`
  - `id`
  - `accountId`
  - `email`
  - `name`
  - `username`
  - `imageId`
  - `imageUrl`
  - `bio`

建议新增 mapper：

- `mapUserProfileRowToPublicViewModel()`
- `mapUserProfileRowToEditableViewModel()`

原因：

- 不建议让路由层或表单层直接消费 `Models.Row`
- 资料头与编辑页的数据形状不同，强行共用 raw row 只会扩大泄漏面
- mapper 层更适合统一处理：
  - `null` 值
  - 缺省头像
  - 文本 trim

### 六、保持认证当前用户契约稳定，但让它依赖更明确的数据源

改动位置：

- `app/features/auth/types/auth.type.ts`
- `app/features/auth/services/auth.service.ts`

当前 `CurrentUserDto` 已经能满足：

- 侧边栏
- 底栏
- 顶部用户态

本步骤不建议把它直接膨胀成“可用于编辑页的完整资料模型”。

原因：

- `CurrentUserDto` 的职责是“当前登录用户会话展示”
- 编辑页需要的是“可编辑资料快照”，包括：
  - `imageId`
  - 只读 `email`
  - 可能的后续头像元数据

因此建议：

- 保持 `CurrentUserDto` 基本稳定
- 让编辑页单独通过 `getEditableUserProfileById(profileId)` 获取所需资料
- 让认证服务改用新的 `RepairUserProfileInput` / `USER_PROFILE_AUTH_SELECT`

这样既不破坏现有全局用户态，又能给编辑页建立更清晰的边界。

## 为什么选择这个方案

### 为什么这一步不改 schema，而只补代码契约

原因：

- `users` 表当前已经具备：
  - `imageId`
  - `imageUrl`
  - `bio`
  - `accountId`
- 本期缺口不在数据库字段，而在前端类型、查询方式和输入边界

如果在这一步去改 schema，只会增加无意义的变更面，反而掩盖真正的问题：

- 代码没有完整表达现有字段
- 查询方式不匹配公开资料页路由
- 编辑接口过宽

### 为什么要拆分“认证修复”和“资料编辑”的输入契约

原因：

- 认证修复场景仍需要处理：
  - `email`
  - `username`
- 但资料编辑页本期明确不允许编辑这两个字段

如果两者继续共用一个 `UpdateUserProfileInput`，工程上就会埋下两个风险：

- 编辑页误获得超出产品需求的可写能力
- 未来更改认证恢复逻辑时误伤资料编辑页

按场景拆分输入契约，是最小复杂度、也最安全的方案。

### 为什么要新增按 `profileId` 查询的用户 API

原因：

- 公开资料页 URL 已经固定使用 `profileId`
- 资料页路由参数天然就是 `users.$id`
- 当前只支持按 `accountId` 查找，会让资料页被迫绕远路

按 `profileId` 查询更符合：

- 路由结构
- 数据主键
- 公开资料展示的使用方式

### 为什么用户资料查询要拆成多套 `select`

原因：

- 当前项目跑在 Appwrite 免费版约束下，应按场景取最少数据
- 不同页面真正需要的字段并不相同：
  - 公开资料页不需要 `email`
  - 编辑页必须拿到 `imageId`
  - 认证恢复需要 `accountId + email + username`

如果继续只维护一个大而全的 `USER_PROFILE_SELECT`，结果会是：

- 无关页面多取字段
- 公共页面无意泄漏内部字段依赖
- 后续维护时难以判断某个字段为什么必须存在

### 为什么要新增用户资料 mapper

原因：

- 当前 `user` feature 还没有 mapper 层，但资料页和编辑页会显著放大“直接消费 raw row”的维护成本
- view model 能让组件层只依赖稳定、按场景裁剪后的数据
- mapper 也是统一处理默认值和空值的最好位置

这是在资料功能开始前补齐边界的最佳时机。

## 实现顺序与依赖关系

### 第一步：补齐 `UserProfileRecord`

操作：

- 在 `user.type.ts` 中增加 `imageId`

依赖：

- 依赖现有 `users` schema 已包含该字段

### 第二步：拆分输入类型

操作：

- 保留 `CreateUserProfileInput`
- 新增 `RepairUserProfileInput`
- 新增 `UpdateEditableUserProfileInput`

依赖：

- 依赖第一步完成后，字段全集已经明确

### 第三步：拆分用户资料 `select`

操作：

- 在 `user.api.ts` 中新增：
  - `USER_PROFILE_AUTH_SELECT`
  - `USER_PROFILE_PUBLIC_SELECT`
  - `USER_PROFILE_EDIT_SELECT`

依赖：

- 依赖第一步已明确 raw row 字段范围

### 第四步：新增按 `profileId` 查询能力

操作：

- 新增公开资料查询
- 新增编辑资料查询

依赖：

- 依赖第三步的 `select` 已拆分完成

### 第五步：新增用户资料 mapper 与 view model

操作：

- 新增公开资料 view model
- 新增编辑资料 view model
- 新增 mapper

依赖：

- 依赖第一步和第四步，确保 raw row 与 API 已稳定

### 第六步：接入认证服务兼容改造

操作：

- 让 `auth.service.ts` 改为显式使用认证修复契约
- 保证 `getCurrentUser()` 与 `retryInitializeCurrentUserProfile()` 继续正常工作

依赖：

- 依赖第二步的输入类型拆分
- 依赖第三步的认证用 `select`

### 第七步：验证“用户资料契约准备”完成

验证项：

- 类型编译正常
- `UserProfileRecord` 与现有 schema 字段一致
- 公开资料页可通过 `profileId` 获取稳定数据
- 编辑页可拿到 `imageId`
- 认证恢复流程未被破坏
- 编辑页提交接口不会暴露 `email / username`

这一步完成后，后续头像上传链路、资料页壳路由和独立编辑页才能在稳定契约上继续开发。

## 关键风险及应对策略

### 风险：误把 `email / username` 暴露到编辑页可写契约中

问题：

- 如果继续复用当前宽接口，后续实现时很容易顺手把两个字段也做成可编辑。

应对：

- 在类型层显式拆分 `UpdateEditableUserProfileInput`
- 编辑页只依赖编辑专用 view model 和编辑专用 mutation

### 风险：忘记把 `imageId` 纳入查询，后续无法安全替换头像

问题：

- 只有 `imageUrl` 没有 `imageId` 时，旧头像文件将无法稳定删除。

应对：

- 在 raw row、编辑页 `select` 和编辑 view model 中统一纳入 `imageId`
- 公开资料页则继续不暴露 `imageId`

### 风险：按 `profileId` 查询时误带出不必要字段

问题：

- 如果公开资料页直接复用认证用 `select`，会让公开页面依赖 `email / accountId` 这类无关字段。

应对：

- 公共展示与编辑页使用独立 `select`
- 公共展示只返回真正需要的字段

### 风险：重构 `updateUserProfile()` 时破坏认证恢复流程

问题：

- 当前 `retryInitializeCurrentUserProfile()` 依赖宽更新能力修补缺失的 `username` 和 `email`。

应对：

- 不直接“收窄旧接口然后全量替换”
- 先引入新的 `RepairUserProfileInput` 或内部修复接口
- 让认证服务显式迁移到修复专用接口

### 风险：路由层直接消费 raw row，导致后续页面契约继续扩散

问题：

- 一旦 `profile` 路由、编辑页和全局用户态都直接消费 `UserProfileRecord`，后续边界会越来越模糊。

应对：

- 在本步骤就引入用户资料 mapper
- 页面只依赖按场景裁剪后的 view model

### 风险：本地代码契约与线上 schema 名称脱节

问题：

- 虽然这一步不改 schema，但如果前端类型字段名与现有 Appwrite 字段不一致，后续问题会更隐蔽。

应对：

- 以当前 `appwrite.config.json` 为准逐项核对：
  - `accountId`
  - `email`
  - `name`
  - `username`
  - `bio`
  - `imageId`
  - `imageUrl`

## 预期结果

本步骤完成后，项目会具备一个稳定的“用户资料数据准备层”：

- `users` 表现有字段已在前端完整表达
- 用户资料可以按 `profileId` 直接读取
- 认证恢复、公开展示、编辑资料三类场景拥有各自清晰的数据边界
- 编辑资料页后续需要的 `imageId` 已经进入稳定契约
- 现有认证流程继续可用，不会因资料页开发而被破坏

这一步完成后，后续可以直接在这个契约基础上继续实现：

- 头像上传与替换
- 资料页路由壳
- `posts / saved / liked` 三个 tab
- 独立编辑资料页
