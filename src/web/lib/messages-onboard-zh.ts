/* 组织者设置 / 参与者澄清页面的中文文案。

   只翻译界面文案：工作坊事实、参与者姓名、AI 问题/原话、服务端错误保留原始语言。
   英文文件里个别键在首尾带空格，是因为 JSX 里用 <strong> 打断句子，空格只能放在
   其中一侧；中文按中文排版习惯处理，不受影响。 */
export const onboardZh: Record<string, string> = {
  /* ------------------------------- 组织者设置 ------------------------------ */
  'onboard.setup.eyebrow': '组织者 · 第 1 步',
  'onboard.setup.title': '设置你的工作坊',
  'onboard.setup.intro':
    '一个商家、一场两小时的工作坊、三个候选时间。这些就是每位参与者最终会在固定方案里看到的信息。',
  'onboard.setup.loadSample': '载入示例工作坊',
  'onboard.setup.loadingSample': '正在载入示例…',
  'onboard.setup.formNoteBefore': '所有字段都用示例工作坊预填，方便快速走一遍。全部可改 —— 在你按下',
  'onboard.setup.formNoteConfirm': '创建工作坊',
  'onboard.setup.formNoteAfter': '之前，什么都不会创建。',
  'onboard.setup.apiError': '工作坊未创建',
  'onboard.setup.factsLegend': '工作坊信息',

  'onboard.setup.field.merchantName': '商家名称',
  'onboard.setup.field.title': '工作坊标题',
  'onboard.setup.field.description': '描述',
  'onboard.setup.field.descriptionHint': '这场活动会发生什么。这段文字会原样出现在方案里。',
  'onboard.setup.field.venue': '场地',
  'onboard.setup.field.timezone': '时区（IANA）',
  'onboard.setup.field.duration': '时长（分钟）',
  'onboard.setup.field.price': '每人价格（USD）',
  'onboard.setup.field.priceHint': '固定价格、全部包含，以整数分为单位存储。',
  'onboard.setup.field.inclusions': '价格包含哪些内容',
  'onboard.setup.field.inclusionsHint': '每行一项，这些内容会列在方案里。',
  'onboard.setup.field.minParticipants': '最低参与人数',
  'onboard.setup.field.capacity': '容量',
  'onboard.setup.field.authDeadline': '授权截止时间（{timezone}）',
  'onboard.setup.field.authDeadlineHint': '授权窗口关闭的时间，必须早于第一场活动开始。',

  'onboard.setup.slots.legend': '候选时间（3）',
  'onboard.setup.slots.hint': '请按 {timezone} 的当地时间填写。存储的是 UTC 时刻，每个页面都会换算回这个时区显示。',
  'onboard.setup.slot.title': '时间 {n}',
  'onboard.setup.slot.start': '开始',
  'onboard.setup.slot.end': '结束',

  'onboard.setup.create': '创建工作坊',
  'onboard.setup.creating': '正在创建工作坊…',
  'onboard.setup.actionsNote':
    '服务器会再次校验草稿：已经过去的授权截止时间、高于容量的最低人数、或相互重叠的时间都会被拒绝。',

  /* ------------------------------ 创建完成 ------------------------------ */
  'onboard.setup.created.eyebrow': '组织者',
  'onboard.setup.created.title': '你的工作坊已设置完成',
  'onboard.setup.created.intro': '{merchant} · 每人 {price} {currency} · 最低 {min} 人，容量 {capacity} 人。',
  'onboard.setup.status.offerOpen': '方案已开放',
  'onboard.setup.status.clarifying': '正在澄清条件',
  'onboard.setup.status.collecting': '正在收集意向',
  'onboard.setup.created.facts': '工作坊信息',
  'onboard.setup.created.venue': '场地',
  'onboard.setup.created.timezone': '时区',
  'onboard.setup.created.length': '时长',
  'onboard.setup.created.lengthValue': '{n} 分钟',
  'onboard.setup.created.includes': '包含内容',
  'onboard.setup.created.deadline': '授权截止时间',
  'onboard.setup.created.candidateTimes': '候选时间',
  'onboard.setup.created.next': '下一步',
  'onboard.setup.created.nextBefore': '参与者现在会看到核心问题，并建立一份可复核的偏好。每个人按下',
  'onboard.setup.created.nextConfirm': '确认我的偏好',
  'onboard.setup.created.nextAfter':
    '后才会计入。用上方的身份切换器，以某位参与者的身份体验。',
  'onboard.setup.created.openPlan': '打开方案',
  'onboard.setup.created.openParticipant': '打开参与者视角',

  /* ---------------------------- 客户端校验错误 --------------------------- */
  'onboard.setup.error.required': '请填写{label}。',
  'onboard.setup.error.timezone': '请选择有效的 IANA 时区。',
  'onboard.setup.error.duration': '时长必须是整数分钟。',
  'onboard.setup.error.price': '价格必须是美元金额，最多保留两位小数。',
  'onboard.setup.error.inclusions': '请至少列出价格包含的一项内容。',
  'onboard.setup.error.min': '最低人数必须是整数。',
  'onboard.setup.error.capacity': '容量必须是整数。',
  'onboard.setup.error.minOverCapacity': '最低人数不能大于容量。',
  'onboard.setup.error.deadlineFormat': '请填写授权截止时间的日期和时间。',
  'onboard.setup.error.deadlineFuture': '授权截止时间必须晚于当前时间。',
  'onboard.setup.error.slotRange': '第 {n} 个时间需要填写开始和结束时间。',
  'onboard.setup.error.slotOrder': '第 {n} 个时间的结束时间必须晚于开始时间。',
  'onboard.setup.error.slotOverlap': '候选时间不能重叠。',
  'onboard.setup.error.deadlineBeforeFirst': '授权截止时间必须早于第一场开始。',

  /* ------------------------------ 参与者澄清 ----------------------------- */
  'onboard.clarify.eyebrow': '参与者 · {name}',
  'onboard.clarify.preferences': '你的偏好',
  'onboard.clarify.openOffer': '查看开放中的方案',

  'onboard.clarify.noParticipant.title': '这个页面属于某位参与者',
  'onboard.clarify.noParticipant.body': '用上方的身份切换器，以某位参与者的身份体验。',

  'onboard.clarify.none.title': '没有需要你回答的问题',
  'onboard.clarify.none.emptyTitle': '现在没有需要回答的内容',
  'onboard.clarify.none.body1':
    '只有当某个商家信息可能影响某个时间是否适合你时，才会提出问题。大多数人根本不会被问到，而每个人最多只会被问一次。',
  'onboard.clarify.none.body2': '你已确认的偏好仍然按你设定时的样子如实计入。',

  'onboard.clarify.answered.titleYes': '谢谢 —— 这个时间现在会计入',
  'onboard.clarify.answered.titleNo': '你的偏好没有变化',
  'onboard.clarify.answered.intro': '你这边不需要再做任何事。这个问题已经结束，不会再问你。',
  'onboard.clarify.answered.badge': '已回答',
  'onboard.clarify.answered.heading': '你的回答',
  'onboard.clarify.answered.yesStrong': '可以，这个时间没问题。',
  'onboard.clarify.answered.noStrong': '不行，保留我的偏好。',
  'onboard.clarify.answered.yesBody':
    '你的偏好已更新，包含这个时间 —— 仍然受同一份固定方案和与所有人相同的授权步骤约束。',
  'onboard.clarify.answered.noBody': '你原来的偏好完全按你确认时的样子保留。没有惩罚，没有折扣，也不会再问一次。',
  'onboard.clarify.answered.quoteLabel': '你最初写的内容',

  'onboard.clarify.proposed.title': '还没有问题发给你',
  'onboard.clarify.proposed.emptyTitle': '组织者还在审阅一个可能的问题',
  'onboard.clarify.proposed.body':
    '还没有任何内容发给你，在发出之前都不计入。你已确认的偏好没有变化。',

  'onboard.clarify.ask.title': '关于你的条件，有一个问题',
  'onboard.clarify.ask.intro': '一次点击就能回答。这是你唯一会被问到的问题。',
  'onboard.clarify.ask.badge': '等待你的回答',
  'onboard.clarify.ask.saveError': '你的回答没有保存',
  'onboard.clarify.ask.toldHeading': '你告诉我们的内容',
  'onboard.clarify.ask.verbatim': '{name} · 原话',
  'onboard.clarify.ask.toldNote': '这是你确认偏好时写下的内容。',
  'onboard.clarify.ask.dependsHeading': '取决于什么',
  'onboard.clarify.ask.dependsNote':
    '这是商家提供的信息，不是 GatherReady 或 AI 的承诺。组织者在发出问题前已核对过。',
  'onboard.clarify.ask.heading': '问题',
  'onboard.clarify.ask.sourcePrefix': '措辞来源：{source}。只涉及 ',
  'onboard.clarify.ask.sourceAi': '由 AI 撰写，组织者已核对',
  'onboard.clarify.ask.sourceTemplate': '模板文案 —— 未使用 AI',
  'onboard.clarify.ask.sourceSuffix': ' 这一时段。',
  'onboard.clarify.ask.answerGroupAria': '回答问题',
  'onboard.clarify.ask.saving': '保存中…',
  'onboard.clarify.ask.yes': '可以，这个时间没问题',
  'onboard.clarify.ask.no': '不行，保留我的偏好',
  'onboard.clarify.ask.noStrong': '说“不”就是完整的回答。',
  'onboard.clarify.ask.noNote': '你的偏好保持原样，不会再问你，也不会有人代你被扣款。',
};
