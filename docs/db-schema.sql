-- ============================================================
-- 鸣潮·终焉矩阵配队模拟器 — MySQL 数据模型【参考稿 · 暂不落地】
-- 当前实现为纯前端 localStorage；若未来迁移到 云服务器+MySQL 后端，
-- 以下表结构可作为迁移目标。字段中文注释与前端 store 一一对应。
-- ============================================================

-- 1. 角色主表
CREATE TABLE `characters` (
  `id`               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `name`             VARCHAR(50)     NOT NULL                COMMENT '角色名，如 爱弥斯',
  `avatar`           VARCHAR(500)    DEFAULT NULL            COMMENT '头像：存相对路径/URL（不存base64）',
  `default_stamina`  TINYINT UNSIGNED NOT NULL DEFAULT 1     COMMENT '基础体力=单期可用次数上限(普通1，辅助/治疗2)',
  -- ↓ element 已从预留转为核心字段（鸣潮角色固有属性，六选一）
  `element`          VARCHAR(20)     DEFAULT NULL            COMMENT '属性/共鸣【核心】：热熔/冷凝/气动/导电/衍射/湮灭 六选一',
  -- ↓ 以下两列为【预留扩展字段】：当前需求不使用，保留列结构供未来启用。
  `rarity`           TINYINT UNSIGNED DEFAULT NULL           COMMENT '【预留】稀有度：4=四星 5=五星',
  `weapon_type`      VARCHAR(30)     DEFAULT NULL            COMMENT '【预留】武器类型：如 迅刀/长刃/长枪/双刃/臂铠/音感仪',
  `status`           TINYINT UNSIGNED NOT NULL DEFAULT 1     COMMENT '1=启用(出现在角色池) 0=停用(下架)',
  `remark`           VARCHAR(255)    DEFAULT NULL            COMMENT '备注',
  `sort_order`       INT UNSIGNED    NOT NULL DEFAULT 0      COMMENT '角色池展示排序',
  `created_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_status_sort` (`status`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色基础档案';

-- 2. 多模态表（1 角色 → N 模态，如 震谐/集谐）
CREATE TABLE `character_modes` (
  `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '模态ID',
  `character_id` BIGINT UNSIGNED NOT NULL                COMMENT '所属角色ID',
  `mode_name`    VARCHAR(50)     NOT NULL                COMMENT '模态名，如 震谐 / 集谐',
  `tag_color`    VARCHAR(20)     DEFAULT NULL            COMMENT '模态标签配色(hex)',
  `mode_icon`    VARCHAR(500)    DEFAULT NULL            COMMENT '模态专属图标/头像路径(可选)',
  `sort_order`   INT UNSIGNED    NOT NULL DEFAULT 0      COMMENT '模态排序',
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_char_mode` (`character_id`, `mode_name`),
  KEY `idx_character` (`character_id`),
  CONSTRAINT `fk_mode_character` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色多模态';

-- 3. 期次表（"本期强化"的期）
CREATE TABLE `periods` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '期次ID',
  `name`        VARCHAR(100)    NOT NULL                COMMENT '期次名，如 1.0第一期·矩阵',
  `source_note` VARCHAR(255)    DEFAULT NULL            COMMENT '官方数据来源备注',
  `is_current`  TINYINT(1)      NOT NULL DEFAULT 0      COMMENT '是否当前启用期(全表仅一条=1)',
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='矩阵期次';

-- 4. 期次强化配置表（1 期 → 多角色 → 多效果；强化效果为字符串输出）
CREATE TABLE `period_enhancements` (
  `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '强化效果ID',
  `period_id`     BIGINT UNSIGNED NOT NULL                COMMENT '所属期次ID',
  `character_id`  BIGINT UNSIGNED NOT NULL                COMMENT '受强化角色ID',
  `effect_text`   VARCHAR(500)    NOT NULL                COMMENT '强化描述【字符串】：技能变化等原文展示',
  `stamina_plus`  TINYINT UNSIGNED NOT NULL DEFAULT 0     COMMENT '体力特殊分支：>0 则当期该角色体力上限+X(代码if/else真实加成)；0=纯文本',
  `sort_order`    INT UNSIGNED    NOT NULL DEFAULT 0      COMMENT '效果排序',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_period` (`period_id`),
  KEY `idx_character` (`character_id`),
  KEY `idx_period_char` (`period_id`, `character_id`),
  CONSTRAINT `fk_enh_period` FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enh_character` FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='期次角色强化配置';

-- 5.（未来按需）当期体力状态/使用记录、组队方案表：随"切期重置"语义单独设计，不入 characters。
-- 6. 漂泊者（主角）特殊：体力恒1、可切换属性（衍射/湮灭/气动/导电…随版本新增），与模态切换不同；
--    已定呈现：角色池按属性拆多张卡（漂泊者·衍射 等），各属性形态共享同一体力池（全矩阵合计仅登场体力值次）。
--    未来迁后端时共享体力池需体现"同一角色不同属性卡合计占用"约束，可加共享组/父角色概念，开发期再定。
