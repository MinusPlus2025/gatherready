/* 流程页面（组织者方案、参与者偏好/授权）与状态引擎的中文文案。

   键名与英文文件一一对应。数据（工作坊标题与商家、时间标签、AI 问题与引用、
   服务器报错、报价条款原文）作为插值原样呈现，不翻译。 */

export const flowZh: Record<string, string> = {
  /* ------------------------------ 通用文案 ------------------------------- */
  'flow.action.setUpWorkshop': '设置工作坊',
  'flow.action.done': '已完成',
  'flow.participant.eyebrow': '参与者 · {name}',
  'flow.strip.minimum': '最低 {count} 人',

  /* --------------------------- 状态：组织者状态带 ------------------------- */
  'flow.status.organizer.noWorkshop.headline': '暂无工作坊',
  'flow.status.organizer.noWorkshop.detail':
    '先创建活动信息：三个候选时间、价格、最低人数和授权截止时间。',
  'flow.status.organizer.confirmed.headline': '工作坊已确认并完成扣款',
  'flow.status.organizer.confirmed.detailOne': '已完成 {count} 笔扣款 · 共扣款 {amount}。',
  'flow.status.organizer.confirmed.detailMany': '已完成 {count} 笔扣款 · 共扣款 {amount}。',
  'flow.status.organizer.notConfirmed.headline': '工作坊未确认',
  'flow.status.organizer.cancelling.detail': '正在释放授权并处理退款。',
  'flow.status.organizer.cancelled.detail':
    '本轮未达到最低人数。预授权已释放；已完成的扣款按取消政策处理。',
  'flow.status.organizer.compensating.headline': '扣款出现问题 — 正在补偿处理',
  'flow.status.organizer.compensating.detail':
    '未扣款的预授权正在释放，已扣款的会退款。请以逐人明细为准。',
  'flow.status.organizer.settling.headline': '正在扣款',
  'flow.status.organizer.settling.detail':
    '批次已锁定。服务器会逐笔扣款，并向 PayPal 核对每一笔结果。',
  'flow.status.organizer.readyToCollect.headline': '授权人数已达到最低要求 — 可以扣款',
  'flow.status.organizer.readyToCollect.detail':
    '{authorized} 笔授权（不是扣款）· 待扣款 {amount} · {deadline} 截止。',
  'flow.status.organizer.offerOpen.headlineOne': '报价已发布 — 还需 {count} 人授权',
  'flow.status.organizer.offerOpen.headlineMany': '报价已发布 — 还需 {count} 人授权',
  'flow.status.organizer.offerOpen.detail':
    '{slot} · 已授权 {authorized}/{minimum}（授权不是扣款）· {deadline} 截止。',
  'flow.status.organizer.workableSlot.headline': '{slot} 已达到 {minimum} 人最低要求',
  'flow.status.organizer.workableSlot.detail':
    '发布一份固定报价。发布后，价格、时间和条款都会冻结，每位参与者都必须重新阅读并授权。',
  'flow.status.organizer.questionOut.headline': '已发出一个问题 — 等待 {name} 回答',
  'flow.status.organizer.questionOut.detail':
    '“{question}” · 只有本人确认的“可以”才计入最低人数。',
  'flow.status.organizer.suggestion.headlineOne':
    '还需 {count} 人确认才能达到 {minimum} 人最低要求',
  'flow.status.organizer.suggestion.headlineMany':
    '还需 {count} 人确认才能达到 {minimum} 人最低要求',
  'flow.status.organizer.suggestion.detail':
    '{name} 的条件：“{condition}” · 若回答“可以”，{slot} 的确认人数将从 {before} 升至 {after}。',
  'flow.status.organizer.suggestion.noPath.detail':
    '没有任何单一未定条件能补上缺口。需要更多已确认的意向，或换一个时间。',
  'flow.status.organizer.noConfirmations.headline': '还没有人确认偏好',
  'flow.status.organizer.noConfirmations.detail':
    '只有本人确认之后，意向才会计入。现在不能假定任何数字。',
  'flow.status.organizer.noConfirmations.action': '查看参与者视图',
  'flow.status.organizer.recompute': '重新计算方案',

  /* ---------------------------- 状态：操作按钮 --------------------------- */
  'flow.status.action.seeResult': '查看结果',
  'flow.status.action.openFunding': '打开扣款页面',
  'flow.status.action.watchFunding': '查看扣款进度',
  'flow.status.action.confirmAndCollect': '确认并扣款',
  'flow.status.action.publishTheOffer': '发布报价',
  'flow.status.action.seeQuestion': '查看问题',
  'flow.status.action.askTheOneQuestion': '提出这个问题',

  /* --------------------------- 状态：三个进度指标 ------------------------- */
  'flow.status.rails.noWorkshop.matchDetail': '暂无工作坊',
  'flow.status.rails.notSelected': '尚未选择',
  'flow.status.rails.noOfferPublished': '尚未发布报价',
  'flow.status.rails.nothingToAuthorize': '暂无可授权内容',
  'flow.status.rails.matchMet': '有一个时间已满足最低人数',
  'flow.status.rails.matchBest': '最佳时间的确认人数',
  'flow.status.rails.selectedVersion': '已选择 · v{version}',
  'flow.status.rails.termsDetail': '{slot} · 哈希 {hash}',
  'flow.status.rails.publishToFreeze': '发布一份固定报价以冻结条款',
  'flow.status.rails.capturedCharged': '{count} 笔已扣款',
  'flow.status.rails.authorizedNotCharged': '已授权，尚未扣款',
  'flow.status.rails.noAuthorization': '尚无授权',

  /* --------------------- 状态：参与者四步状态 --------------------------- */
  'flow.status.participant.step.interest': '意向',
  'flow.status.participant.step.interest.confirmed': '已确认 · v{version}',
  'flow.status.participant.step.interest.parsed': '已解析，尚未确认',
  'flow.status.participant.step.interest.empty': '尚未填写',
  'flow.status.participant.step.terms': '条款',
  'flow.status.participant.step.terms.agreed': '已同意 · 报价 v{version}',
  'flow.status.participant.step.terms.current': '报价已发布——请阅读并同意',
  'flow.status.participant.step.terms.waiting': '组织者尚未发布包含你的方案',
  'flow.status.participant.step.authorization': '授权（预授权）',
  'flow.status.participant.step.authorization.authorized': '已授权 — 未扣款',
  'flow.status.participant.step.authorization.charged': '已扣款',
  'flow.status.participant.step.authorization.capturing': '正在扣款',
  'flow.status.participant.step.authorization.failed': '需要核对状态',
  'flow.status.participant.step.authorization.holdOnly': '仅是预授权，绝不会扣款',
  'flow.status.participant.step.charge': '扣款 / 取消',
  'flow.status.participant.step.charge.charged': '已扣款 — 工作坊已确认',
  'flow.status.participant.step.charge.refunded': '未确认 — 已退款',
  'flow.status.participant.step.charge.refunding': '未确认 — 退款处理中',
  'flow.status.participant.step.charge.voided': '未确认 — 预授权已释放',
  'flow.status.participant.step.charge.failed': '结果未知，正在核对',
  'flow.status.participant.step.charge.waiting': '仅在工作坊确认时才会发生',

  /* ---------------------- 状态：参与者主状态 --------------------------- */
  'flow.status.participant.noWorkshop.headline': '暂无可以加入的工作坊',
  'flow.status.participant.noWorkshop.detail': '组织者还没有发布活动信息。',
  'flow.status.participant.noPreference.headline': '你还没有表达偏好',
  'flow.status.participant.noPreference.detail':
    '写一句话，或勾选合适的时间，然后自己确认。只有已确认的条件才会计入。',
  'flow.status.participant.noPreference.action': '表达我的偏好',
  'flow.status.participant.notConfirmed.headline': '你的偏好尚未确认',
  'flow.status.participant.notConfirmed.detail':
    '请在卡片上核对时间和条件，然后确认。点击确认之前，什么都不算数。',
  'flow.status.participant.notConfirmed.action': '查看并确认',
  'flow.status.participant.failed.headline': '你的支付状态需要核对',
  'flow.status.participant.failed.detail':
    '服务器会先向 PayPal 查询，绝不会重复扣款。请以每笔支付的状态为准。',
  'flow.status.participant.failed.action': '查看我的状态',
  'flow.status.participant.refunded.headline': '未确认 — 已退款',
  'flow.status.participant.refunded.detail':
    'PayPal 已确认退款。仅有退款请求，不会显示为“已退款”。',
  'flow.status.participant.refunding.headline': '未确认 — 退款处理中',
  'flow.status.participant.refunding.detail':
    '退款已发起，但 PayPal 尚未确认，因此不会显示为“已退款”。',
  'flow.status.participant.voided.headline': '未确认 — 预授权已释放',
  'flow.status.participant.voided.detail': '没有产生任何扣款；授权已释放。',
  'flow.status.participant.charged.headline': '工作坊已确认 — 已完成扣款',
  'flow.status.participant.charged.detail':
    '你已支付 {amount}。工作坊已根据组织者的扣款结果确认。',
  'flow.status.participant.authorized.headline': '已授权 — 尚未扣款',
  'flow.status.participant.authorized.detail':
    '你的授权会冻结 {amount}，但不会扣款。只有工作坊确认后才会扣款，否则将被释放。',
  'flow.status.participant.authorized.action': '查看我的授权',
  'flow.status.participant.inOffer.headline': '方案已发布 — 接下来查看条款',
  'flow.status.participant.inOffer.detail':
    '条款已冻结：{slot} · {amount} · 最低 {minimum} 人。授权是预授权，不是扣款。',
  'flow.status.participant.inOffer.action': '查看并授权',
  'flow.status.participant.waiting.headline': '你的偏好已确认 — 等待组织者发布方案',
  'flow.status.participant.waiting.detail':
    '固定报价发布后，你将看到准确条款并完成授权；授权是预授权，不是扣款。',
  'flow.status.participant.moneyNotes':
    '{amount} · 最低 {minimum} 人 · {deadline} 截止 · 若未成行：释放预授权，已完成的扣款原路退回',

  /* ---------------------------- 组织者方案页 ----------------------------- */
  'flow.plan.empty.body': '活动信息创建后，这里就会出现主页。',
  'flow.plan.eyebrow': '组织者',
  'flow.plan.title': '工作坊主页',
  'flow.plan.intro':
    '现在真实的情况是什么、谁适合哪个时间，以及唯一下一步。时间可行不等于付款：授权是另外一步。',
  'flow.plan.recompute': '重新计算',
  'flow.plan.recomputing': '正在重新计算…',
  'flow.plan.strip.aria': '工作坊信息',
  'flow.plan.strip.perPerson': '{amount} / 人',
  'flow.plan.notice.errorTitle': '这次没有成功',
  'flow.plan.notice.questionSent': '已向 {name} 发送问题。这将是对方收到的唯一问题。',
  'flow.plan.notice.recomputed': '已根据最新确认的偏好重新计算方案。',
  'flow.plan.preparing': '正在准备…',
  'flow.plan.question.title': '建议提问',
  'flow.plan.question.titleFor': '建议向 {name} 提问',
  'flow.plan.question.sent': '已发送 · 等待回答',
  'flow.plan.question.proposed': '已拟好 · 尚未发送',
  'flow.plan.question.notSent': '尚未发送',
  'flow.plan.question.why': '{label}：{value} · 补上缺口后，确认人数 {before} → {after}。',
  'flow.plan.question.whyOnly': '只有这位参与者本人确认“可以”，才计入最低人数。',
  'flow.plan.question.sending': '正在发送…',
  'flow.plan.question.send': '向 {name} 发送问题',
  'flow.plan.question.sentNote': '问题已出现在对方的参与者视图中。“不行”即为最终答复，不会再次询问。',
  'flow.plan.question.review': '查看问题',
  'flow.plan.question.source': '措辞来源：AI 或模板，已记录在审计日志中。',
  'flow.plan.matrix.best':
    '目前最佳时间：{slot} · {count} 人确认可行 · 上限 {ceiling}。确认时间不等于付款；每位入选者仍需各自阅读冻结的报价并授权。',
  'flow.plan.tech.summary': '技术细节（方案输入哈希、审计记录、排序依据）',
  'flow.plan.tech.rules':
    '采用确定性规则，而不是模型评分：先看已确认可行的人数，再看待定条件较少的，然后是偏好匹配，最后取更早的时间。相同的输入始终得到相同的方案。',
  'flow.plan.tech.hashLabel': '方案输入哈希：',

  /* ------------------------ 参与者偏好：提取来源 ------------------------- */
  'flow.preferences.extraction.live':
    '由实时模型提取。确认前请核对并修改——模型永远没有最终发言权。',
  'flow.preferences.extraction.liveWithModel':
    '由实时模型（{model}）提取。确认前请核对并修改——模型永远没有最终发言权。',
  'flow.preferences.extraction.recorded':
    '录制样本：这是预先准备好的演示样本，不是针对任意文本的实时模型回答。确认前请核对并修改。',
  'flow.preferences.extraction.structured':
    '结构化：仅根据你勾选的时间和填写的条件生成，未使用 AI。',
  'flow.preferences.extraction.seeded': '预置的演示偏好。确认前请核对并修改。',
  'flow.preferences.extraction.label.live': '实时模型提取',
  'flow.preferences.extraction.label.recorded': '录制样本提取',
  'flow.preferences.extraction.label.structured': '结构化 — 未使用 AI',
  'flow.preferences.extraction.label.seeded': '预置提取',

  /* --------------------------- 参与者偏好页 ----------------------------- */
  'flow.preferences.empty.noWorkshop.title': '暂无可回应的活动',
  'flow.preferences.empty.noWorkshop.action': '设置演示工作坊',
  'flow.preferences.empty.noWorkshop.body':
    '组织者还没有发布工作坊。发布后，这一页会显示三个候选时间。',
  'flow.preferences.empty.organizer.title': '此页面属于参与者',
  'flow.preferences.empty.organizer.body':
    '当前会话是组织者视图。请使用上方的演示视图切换器，以某位合成参与者的身份操作。',
  'flow.preferences.title': '怎样安排，这个工作坊对你才合适？',
  'flow.preferences.intro':
    '用你自己的话说，或者直接勾选合适的时间。我们会整理成一张简短、可核对的卡片——在你确认之前，什么都不算数。',
  'flow.preferences.badge.confirmed': '已确认',
  'flow.preferences.badge.withdrawn': '已退出',
  'flow.preferences.badge.unconfirmed': '尚未确认',
  'flow.preferences.strip.aria': '工作坊',
  'flow.preferences.notice.errorTitle': '没有保存任何内容',
  'flow.preferences.error.needSomething': '请写一句话，或至少勾选一个时间。',
  'flow.preferences.error.needTime': '请至少选择一个适合你的时间——或者直接退出。',
  'flow.preferences.error.preferredMustBeAccepted':
    '“优先考虑”的时间也必须是你勾选为合适的时间。',
  'flow.preferences.notice.confirmed':
    '偏好已确认。你的内容没有分享给其他参与者；组织者只会看到你的条件。',
  'flow.preferences.notice.withdrawn': '你已退出。你不会被计入方案，也不会再被询问。',
  'flow.preferences.answer.changeTitle': '修改你的回答',
  'flow.preferences.answer.title': '你的回答',
  'flow.preferences.answer.equalPaths':
    '两种方式完全等价：如果你不想写自由文本，下面的勾选框无需任何 AI 也能用。任选一种，重建下方的卡片即可。',
  'flow.preferences.answer.purpose':
    '用途说明：你的这句话只会发送给已配置的模型服务，用来提取这些条件。内容不会写入日志，合成的演示文本会在 7 天内删除。这是沙盒原型——没有真实资金流转。',
  'flow.preferences.free.heading': '用你自己的话',
  'flow.preferences.free.label': '你的原话',
  'flow.preferences.free.hint':
    '{count}/600 个字符。仅用于本次工作坊；组织者看到的是条件，而不是你的私人理由。',
  'flow.preferences.free.placeholder': '周六上午可以，只要所有材料都包含在内…',
  'flow.preferences.free.extracting': '正在提取…',
  'flow.preferences.free.extract': '提取条件',
  'flow.preferences.structured.heading': '或者直接勾选合适的时间',
  'flow.preferences.structured.legend': '适合你的时间',
  'flow.preferences.structured.conditionLabel': '可选：需要满足什么前提？',
  'flow.preferences.structured.conditionHint':
    '最多一个条件。组织者可能就这一点向商家提出一个“是/否”问题。',
  'flow.preferences.structured.conditionPlaceholder': '如果所有材料都包含在内…',
  'flow.preferences.structured.conditionSlot': '这个条件适用于哪个时间？',
  'flow.preferences.structured.building': '正在生成…',
  'flow.preferences.structured.useTimes': '使用这些时间',
  'flow.preferences.footnote':
    '改主意了？在报价关闭前，你都可以确认新版本，也可以无需理由直接退出。',
  'flow.preferences.compose.times': '这些时间对我来说可以：{times}。',
  'flow.preferences.compose.condition': '我的条件：{condition}。',

  /* ------------------------- 参与者偏好：核对卡片 ------------------------ */
  'flow.preferences.review.title': '核对我们的理解',
  'flow.preferences.review.sourceLabel': '你的原话（原文照录）',
  'flow.preferences.review.mustHave': '必须满足',
  'flow.preferences.review.mustHaveHint': '适合你的时间',
  'flow.preferences.review.preferred': '优先考虑',
  'flow.preferences.review.preferredHint': '加分项，绝不是硬性要求',
  'flow.preferences.review.clarify': '待澄清',
  'flow.preferences.review.clarifyHint': '每人最多一个问题',
  'flow.preferences.review.dependsOnCondition': '这个时间取决于下面的条件。',
  'flow.preferences.review.tickFirst': '请先在“必须满足”里勾选一个时间。',
  'flow.preferences.review.nothingToClarify': '你的回答没有需要澄清的地方。',
  'flow.preferences.review.conditionLabel': '条件 {index}',
  'flow.preferences.review.conditionHint':
    '用平实的语言写一个条件。组织者可能就它向商家提出一个“是/否”问题。',
  'flow.preferences.review.appliesTo': '适用于',
  'flow.preferences.review.conditionQuoteLabel': '摘自你的原话（原文照录）',
  'flow.preferences.review.removeCondition': '删除条件',
  'flow.preferences.review.needsClarificationBadge': '待澄清',
  'flow.preferences.review.questionPolicy':
    '只有当某个商家信息会改变这个时间是否可行时，才会向你提问。你可以回答“可以”或“不行”，“不行”会被尊重。',
  'flow.preferences.review.promiseTitle': '在你确认之前，什么都不算数。',
  'flow.preferences.review.promiseRest': '在那之前，你的回答只是你自己能看到的草稿。',
  'flow.preferences.review.confirming': '正在确认…',
  'flow.preferences.review.confirm': '确认我的偏好',
  'flow.preferences.withdraw.summary': '退出这个工作坊',
  'flow.preferences.withdraw.bodyDraft':
    '退出后会立刻把你从方案中移除：不计入人数、不会再被询问，也不会有人替你付款。',
  'flow.preferences.withdraw.withdrawing': '正在撤回…',
  'flow.preferences.withdraw.button': '撤回我的偏好',
  'flow.preferences.review.shared': '已向商家共享：{times}。',
  'flow.preferences.review.sharedWithConditions': '已向商家共享：{times}；条件：{conditions}。',
  'flow.preferences.review.nothingYet': '暂无',

  /* ----------------------- 参与者偏好：已确认卡片 ----------------------- */
  'flow.preferences.confirmed.title': '偏好已确认',
  'flow.preferences.confirmed.meta': '确认于 {when}。版本 {version}。',
  'flow.preferences.confirmed.version': '版本 {version}。',
  'flow.preferences.confirmed.mustHave': '必须满足',
  'flow.preferences.confirmed.preferred': '优先考虑',
  'flow.preferences.confirmed.noPreference': '都不特别优先',
  'flow.preferences.confirmed.needsFact': '还差一个商家信息',
  'flow.preferences.confirmed.conditionSuffix': '只有在 {condition} 时才可行。',
  'flow.preferences.confirmed.quoteLabel': '你的原话（原文照录）',
  'flow.preferences.confirmed.questionNote':
    '最多只会就这一点向你发送一个“是/否”问题，这不是承诺。',
  'flow.preferences.confirmed.reviewOffer': '查看开放中的报价',
  'flow.preferences.confirmed.update': '查看并更新偏好',
  'flow.preferences.confirmed.withdrawBody':
    '退出后会立刻把你从方案中移除，并释放所有预授权。不会有人替你付款。',

  /* --------------------------- 参与者授权页 ----------------------------- */
  'flow.authorize.empty.noWorkshop.title': '暂无工作坊',
  'flow.authorize.empty.noWorkshop.body': '组织者还没有创建工作坊，现在没有可授权的内容。',
  'flow.authorize.empty.organizer.title': '此页面属于参与者',
  'flow.authorize.empty.organizer.body':
    '请使用上方的演示视图切换器，以某位合成参与者的身份操作。',
  'flow.authorize.noOffer.title': '暂无固定报价',
  'flow.authorize.noOffer.emptyTitle': '目前没有可授权的内容',
  'flow.authorize.noOffer.body':
    '组织者还没有发布固定报价。你已确认的偏好仍然有效；在你完整查看报价并表示同意之前，不会产生任何扣款。',
  'flow.authorize.noOffer.link': '你的偏好',
  'flow.authorize.notIncluded.title': '这份报价不包含你',
  'flow.authorize.notIncluded.emptyTitle': '你未被计入这份报价',
  'flow.authorize.notIncluded.leadBefore': '组织者发布了 ',
  'flow.authorize.notIncluded.leadAfter':
    ' 的报价，但你已确认的偏好未接受该时间。不会产生扣款，你的偏好保持不变。',
  'flow.authorize.notIncluded.link': '查看你的偏好',
  'flow.authorize.title': '查看并授权',
  'flow.authorize.intro':
    '请完整阅读下面的摘要。现在不会扣款——这里只会创建一笔与总额完全一致的 PayPal 临时预授权，仅在工作坊确认后才会扣款。',
  'flow.authorize.errorTitle': '未发生任何扣款',
  'flow.authorize.offer.title': '1 · 固定报价',
  'flow.authorize.offer.meta':
    '{slot} · 报价版本 {version}。下面每一行都是报价的组成部分，而不是事后补写的摘要。',
  'flow.authorize.offer.chip': '沙盒 · 不涉及真实资金',
  'flow.authorize.offer.totalLabel': '工作坊确认后应付总额',
  'flow.authorize.offer.totalNote':
    '仅在至少 {minimum} 人完成授权、且授权截止时间未过时，才会扣款一次。',
  'flow.authorize.offer.techSummary': '技术细节（报价指纹）',
  'flow.authorize.consent.title': '2 · 你的同意',
  'flow.authorize.consent.hint':
    '这个勾选框故意默认为未勾选。在你勾选并按下按钮之前，什么都不会发生。',
  'flow.authorize.pay.title': '3 · 授权',
  'flow.authorize.checking.headline': '正在向 PayPal 查询',
  'flow.authorize.checking.body':
    '你的浏览器已从 PayPal 返回。本页面只显示服务器报告的结果——按钮走完并不代表已经付款，所以我们会等待授权状态返回。',
  'flow.authorize.checking.waitingServer': '正在等待服务器',
  'flow.authorize.checking.refresh': '授权处理中时，本页面每 4 秒刷新一次。',
  'flow.authorize.authorized.headline': '已授权 — 尚未扣款',
  'flow.authorize.authorized.body':
    '你的 PayPal 账户中有一笔 {amount} 的临时预授权。只有在工作坊达到人数并确认后，工作室才会收到款项；否则预授权将被释放，不会产生任何扣款。',
  'flow.authorize.authorized.amount': '金额',
  'flow.authorize.authorized.authorization': '授权',
  'flow.authorize.authorized.mode': '支付方式',
  'flow.authorize.authorized.simulated': '模拟 PayPal — 不涉及真实资金',
  'flow.authorize.authorized.sandbox': 'PayPal 沙盒',
  'flow.authorize.withdraw.summary': '撤回这笔授权',
  'flow.authorize.withdraw.body':
    '你可以在组织者扣款前撤回，预授权会被释放，不会产生任何扣款。如果工作坊已经结算，结果会显示在结果页。',
  'flow.authorize.withdraw.withdrawing': '正在撤回…',
  'flow.authorize.withdraw.button': '撤回授权',
  'flow.authorize.settled.changed': '你的授权状态已变更',
  'flow.authorize.settled.statusFromServer':
    '{status}。该状态来自服务器，而不是来自按钮点击。',
  'flow.authorize.settled.voided': '临时预授权已释放，未产生任何扣款。',
  'flow.authorize.settled.refunded': '退款已由 PayPal 确认。',
  'flow.authorize.settled.refunding':
    '退款已发起，但尚未确认——在 PayPal 确认之前，我们不会称其为“已退款”。',
  'flow.authorize.settled.manual': '结果不确定，需要人工核对 PayPal。不会自动重试。',
  'flow.authorize.pay.simulatedStrong': '模拟 PayPal — 不涉及真实资金。',
  'flow.authorize.pay.simulatedRest':
    '不会联系任何 PayPal 账户。服务器会记录一个沙盒替身，以便完整跑通后续流程。',
  'flow.authorize.pay.sandboxNote':
    '你将被带到 PayPal 沙盒，为准确总额完成授权。不涉及真实资金。',
  'flow.authorize.pay.afterConsent':
    '按下按钮后，你将被带到 PayPal。返回本页并不代表已付款——我们会从服务器重新读取授权状态。',
  'flow.authorize.pay.beforeConsent':
    '请先勾选上方的同意框以启用支付控件。在勾选之前它一直处于禁用状态。',
  'flow.authorize.footnote':
    '改主意了？你可以在扣款前撤回。如果工作坊未能确认，所有预授权都会被释放，不会产生任何扣款。',
  'flow.authorize.error.noCheckout':
    '服务器没有返回结账信息。未产生扣款，也没有创建预授权。',
  'flow.authorize.notice.mock': '开发模拟：代替 PayPal 审批步骤。不会联系任何 PayPal 账户。',
  'flow.authorize.error.noApproveLink': '服务器没有返回审批链接。未产生任何扣款。',
  'flow.authorize.notice.withdrawn': '你的授权已撤回，预授权正在释放。未产生任何扣款。',
};
