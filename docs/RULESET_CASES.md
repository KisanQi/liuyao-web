# `jingfang-zengshan-v1` 最小黄金场景

## 适用口径

- 本文件定义规则验收场景；核心场景已进入 `tests/liuyao-engine.test.ts` 与 `tests/liuyao-ruleset.test.ts` 自动回归。
- 六个爻值始终按“初爻→上爻”排列；`6/9` 为动爻，`7/8` 为静爻；爻位字段为 1 基序号。
- 固定时间均为 ISO 8601，并显式写 `+08:00`。应用保留实际时间戳，每次计算前把内核时区重新锁定为固定 UTC+8，并在 `timing` 中记录民用时间和 23:00 换日边界。
- “必须成立”优先使用应用稳定协议 `LiuyaoReading` 的 `chart`、`timing`、`lines`、`hiddenSpirits` 与 `analysis`；`seasonState`、`isDayClash`、暗动、日破、月破均已进入协议。
- `jingfang-zengshan-v1` 是当前 `rulesetVersion`；结果协议为 `schemaVersion: "2.2"`。
- 当前时区实现面向现代北京时间，按固定 UTC+8 解释用户填写的民用时间；不宣称覆盖中国历史夏令时。

## 1. 既济→随：方向、动爻与世应基准

- 输入爻值：`[7, 8, 9, 6, 7, 8]`。
- 固定时间：`2025-01-01T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `chart.original === "水火既济"`，`chart.changed === "泽雷随"`。
  - `chart.movingPositions === [3, 4]`。
  - `chart.palace === "坎"`，`chart.palaceElement === "水"`，`chart.palaceStage === "三世"`。
  - 第 3 爻为世、第 6 爻为应。
  - 六爻地支依次为 `卯、丑、亥、申、戌、子`；六亲依次为 `子孙、官鬼、兄弟、父母、官鬼、兄弟`。
- 专门防止：把输入倒成上爻→初爻、漏翻 `6/9`、变卦查错、世应位置偏移。
- 证据源码路径：
  - `tests/liuyao-engine.test.ts:20-45`。
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:674-710`。
  - `node_modules/mingyu-core/dist/divination/divination-data.js:43-51,81,103`。

## 2. 乾静卦：八纯卦与静卦边界

- 输入爻值：`[7, 7, 7, 7, 7, 7]`。
- 固定时间：`2025-01-02T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `chart.original === "乾为天"`，稳定协议中 `chart.changed === null`。
  - `chart.movingPositions === []`，`chart.specialPattern === "静卦"`。
  - `chart.palace === "乾"`，`chart.palaceElement === "金"`，`chart.palaceStage === "首卦"`。
  - 第 6 爻为世、第 3 爻为应；六爻 `isChanging` 均为 `false`，均无 `changed`。
  - `hiddenSpirits === []`，因为本卦就是乾宫首卦。
- 专门防止：把 `7` 误判成动阳、静卦仍生成变爻、八纯卦世应安反、首卦错误生成伏神。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:467-490,497-535,548-554,674-710`。
  - `node_modules/mingyu-core/dist/divination/divination-data.js:30-44,69`。

## 3. 坤全动：用六优先于普通全动

- 输入爻值：`[6, 6, 6, 6, 6, 6]`。
- 固定时间：`2025-01-02T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `chart.original === "坤为地"`，`chart.changed === "乾为天"`。
  - `chart.movingPositions === [1, 2, 3, 4, 5, 6]`；六爻均 `isChanging === true` 且均有 `changed`。
  - `chart.palace === "坤"`，`chart.palaceElement === "土"`，`chart.palaceStage === "首卦"`。
  - `chart.specialPattern === "坤卦用六"`，不得降级成普通的 `"全动卦"`。
- 专门防止：老阴不翻阳、六动漏爻、先命中通用全动分支而覆盖坤卦用六。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:548-583,674-725`。
  - `node_modules/mingyu-core/dist/divination/divination-data.js:30-51,122-130`。

## 4. 游魂：火地晋归乾宫

- 输入爻值：`[8, 8, 8, 7, 8, 7]`。
- 固定时间：`2025-01-02T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `chart.original === "火地晋"`，稳定协议中 `chart.changed === null`，`chart.movingPositions === []`。
  - `chart.palace === "乾"`，`chart.palaceElement === "金"`，`chart.palaceStage === "游魂"`。
  - 第 4 爻为世、第 1 爻为应。
- 专门防止：按上下卦表象把火地晋误归离宫、八宫序索引偏一、游魂仍按五世或首卦安世应。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/divination-data.js:40-51,68-76`。
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:497-535`。

## 5. 归魂：火天大有归乾宫

- 输入爻值：`[7, 7, 7, 7, 8, 7]`。
- 固定时间：`2025-01-02T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `chart.original === "火天大有"`，稳定协议中 `chart.changed === null`，`chart.movingPositions === []`。
  - `chart.palace === "乾"`，`chart.palaceElement === "金"`，`chart.palaceStage === "归魂"`。
  - 第 3 爻为世、第 6 爻为应。
- 专门防止：把归魂误当回到八纯卦、把宫序第八项误算为游魂、世应三位关系算反。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/divination-data.js:40-51,68-76`。
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:497-535`。

## 6. 缺亲伏神：既济缺妻财

- 输入爻值：`[7, 8, 7, 8, 7, 8]`。
- 固定时间：`2025-01-07T08:00:00+08:00`。
- 指定六亲：`妻财`。
- 必须成立：
  - `chart.original === "水火既济"`，`chart.palace === "坎"`。
  - 稳定协议中 `chart.changed === null`。
  - 明现六亲为 `子孙、官鬼、兄弟、父母、官鬼、兄弟`，其中没有妻财。
  - `hiddenSpirits` 包含且只需锁定一项：第 3 爻 `妻财／午／火`；其所附的 `lines[2]` 本爻即飞神 `兄弟／亥／水`。
  - `lines[2].hiddenSpirits` 包含同一伏神；不得只在顶层数组保存而丢失逐爻关联。
- 专门防止：把“明盘未见妻财”写成“盘中没有妻财”、把本宫首卦所有六亲都生成伏神、伏神与飞神错位。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:467-490,796-801`。
  - `node_modules/mingyu-core/dist/divination/divination-data.js:22-27,43-45,78-85`。
  - `src/domain/liuyao/engine.ts` 的 `normalizeHiddenSpirits()` 与 `toReading()`。
  - `tests/liuyao-engine.test.ts:29-45`（同一主卦的既有伏神断言）。

## 7. 变爻六亲：必须沿用主卦宫五行

- 输入爻值：`[7, 8, 9, 6, 7, 8]`。
- 固定时间：`2025-01-01T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - 主卦为坎宫水火既济，变卦为震宫序列中的泽雷随；六亲基准仍是主卦坎宫水。
  - 第 3 爻变爻为 `辰／土／官鬼`。
  - 第 4 爻变爻为 `亥／水／兄弟`。
  - 应用协议对应为 `lines[2].changed.sixRelative === "官鬼"`、`lines[3].changed.sixRelative === "兄弟"`。
- 专门防止：重新按变卦震宫木定六亲；该错误会把上述两项误算成 `妻财`、`父母`。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:711-718,729-793`。
  - `node_modules/mingyu-core/dist/divination/divination-data.js:22-27,43-48`。
  - `src/domain/liuyao/engine.ts` 的 `toReading()` 变爻字段映射。

## 8. 旺相静爻逢日冲：暗动

- 输入爻值：`[7, 7, 7, 7, 7, 7]`。
- 固定时间：`2025-01-01T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `timing.month === "丙子"`，`timing.day === "庚午"`。
  - 乾卦初爻为 `子／水`，本身是静爻；子水在子月为旺，又被午日冲。
  - 初爻 `isChanging === false`、`isHiddenMove === true`、`isDayBreak === false`。
  - `chart.movingPositions === []`；暗动不能伪装成原始值为 `6/9` 的明动。
  - 稳定协议中 `chart.changed === null`。
- 专门防止：静爻逢日冲一律判日破、暗动被加入明动位置、忽略月令旺相条件。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:191-200,729-767`。
  - `node_modules/mingyu-core/dist/ganzhi/relations.js:23-38,143-154,341-361`。
  - `src/domain/liuyao/engine.ts` 的 `toReading()` 暗动、日破字段映射。

## 9. 休囚静爻逢日冲：日破

- 输入爻值：`[7, 7, 7, 7, 7, 7]`。
- 固定时间：`2025-01-07T08:00:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - `timing.month === "丁丑"`，`timing.day === "丙子"`。
  - 乾卦第 4 爻为 `午／火`，本身是静爻；午火在丑月为休，又被子日冲。
  - 第 4 爻 `isChanging === false`、`isHiddenMove === false`、`isDayBreak === true`。
  - `chart.movingPositions === []`。
  - 稳定协议中 `chart.changed === null`。
- 专门防止：静爻逢日冲一律判暗动、把“休”误当有力、日破与月破字段混用。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:191-200,729-767`。
  - `node_modules/mingyu-core/dist/ganzhi/relations.js:23-38,143-154,341-361`。
  - `src/domain/liuyao/engine.ts` 的 `toReading()` 暗动、日破字段映射。

## 10. 交节前后月建：小寒分钟边界

- 输入爻值：前后均为 `[7, 7, 7, 7, 7, 7]`。
- 固定时间：交节前 `2025-01-05T10:32:00+08:00`；交节后 `2025-01-05T10:33:00+08:00`。
- 问题主题：`通用（general）`。
- 必须成立：
  - 两盘本卦均为乾为天，日柱均为 `甲戌`、时柱均为 `己巳`；只有月柱跨界，从 `丙子` 变为 `丁丑`。
  - 两盘稳定协议中的 `chart.changed` 均为 `null`。
  - 交节前第 4 爻午火 `isMonthBreak === true`；交节后变为 `false`。
  - 第 3 爻辰土被戌日冲：交节前为 `isDayBreak === true`、`isHiddenMove === false`；交节后因丑月土旺，变为 `isDayBreak === false`、`isHiddenMove === true`。
- 专门防止：按公历月份或农历初一换月建、只按日期零点换月、忽略节气分钟、运行环境时区造成边界漂移。
- 证据源码路径：
  - `node_modules/mingyu-core/dist/calendar/timeManager.js:8-30,68-76,141-155`。
  - `node_modules/mingyu-core/dist/divination/algorithms/liuyao.js:674-710,729-767`。
  - `node_modules/mingyu-core/dist/ganzhi/relations.js:23-38,143-154,341-361`。

## 问题主题映射与取用边界

| 主题 | 当前默认候选 | 边界 |
|---|---|---|
| 事业 `shiye` | 第一候选官鬼；父母仅作文书、单位、消息辅证 | “事业”过宽时，职位、考试、合同、创业、同事竞争可能对应不同主轴；没有具体问题语义时只能列候选。 |
| 财运 `caifu` | 第一候选妻财；子孙仅作财源、经营能力辅证 | 工资、回款、投资、借贷、买卖、合作分配并非同一对象；不得因主题叫“财运”就跳过身份与交易关系。 |
| 感情 `ganqing` | 世爻为我方、应爻为对方的双轴候选 | 稳定协议不设置单一 `selectedCandidate`，而在 `focusCandidates` 并列双方；不按性别自动把妻财/官鬼设为唯一用神。 |
| 通用 `general` | 世爻主轴、应爻辅轴、最多前两个明动爻作为触发候选 | 通用主题本身不提供事项语义，不能自动定某一六亲为用神。 |

以下情况只能输出候选，不能自动宣称“已定用神”：

- 只有宽泛主题，没有具体所问对象、求测者身份、对方身份或事件关系；稳定协议将 `questionAssessment.canAnalyze` 设为 `false`，只排盘不生成完整业务摘要。
- 感情题没有明确双方角色；当前规则只能先列世、应，不能自行补充性别化妻财/官鬼规则。
- 明确指定的六亲在本卦和伏神中均未匹配；此时必须报告“缺少可用候选”，改看世应与动变，不能偷偷换成别的六亲。
- 第一主候选未匹配但辅助候选匹配；当前证据逻辑只在第一候选有引用时产生 `selectedCandidate`，辅助项不得自动顶替主候选。
- 即使候选已匹配，也只证明盘面中找到相应本卦爻或伏神；仍须结合问题语义、身份、月日、动变、空破墓等条件复核，不能据匹配数量换算吉凶或成功率。
- 上层明确提供 `usefulGodRelative` 时，它优先于主题默认候选；若该指定本身含糊或与实际问法冲突，应返回候选与限制，不替用户猜测。

主题映射证据源码路径：

- `node_modules/mingyu-core/dist/divination/liuyao-evidence.js:5-20,394-480,727-780`。
- `node_modules/mingyu-core/dist/divination/liuyao-evidence.d.ts:4-10,44-62`。
