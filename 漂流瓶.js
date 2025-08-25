// ==UserScript==
// @name         漂流瓶 (改良版)
// @author       Dogbird狗鸟 (modified)
// @version      1.1.0
// @description  改自自己编写的lua版本漂流瓶，发送 .漂流瓶帮助 查看帮助
// @timestamp    2025/8/25
// @license      MIT
// ==/UserScript==

(function () {
  if (seal.ext.find('bottle-pro')) return;
  const ext = seal.ext.new('bottle-pro', 'Dogbird狗鸟', '1.1.0');
  seal.ext.register(ext);

  // ---------- 公共工具 ----------
  const nowSec = () => Math.floor(Date.now() / 1000);
  const rand100 = () => Math.floor(Math.random() * 100) + 1;

  const KEY = {
    BOTTLES: 'bottles',
    USER_STATE: 'userState',
    CD_THROW: 'cd_throw',
    CD_PICK: 'cd_pick',
    CD_SEARCH: 'cd_search',
    CD_INTO_GROUP: 'cd_into_group',
    SWITCH_GLOBAL: 'switch_global',
    SWITCH_GROUP: 'switch_group',
    CONFIG: 'config'
  };

  // 默认配置（**注意**：这些字段会深度合并到用户保存的 config）
  const defaultConfig = {
    dis_priv: true,
    maxlen: 0,
    throw_cd: 10,
    pick_cd: 10,
    search_cd: 10,
    into_cd: 10,
    // 统一把几处概率改成更直观的结构：百分数 (0-100)
    prob: { throw: 10, pick: 10, into: 10 },
    // 多个随机死因（增加多种变为尸体的方式）
    corpse_causes: {
      throw: [
        '扔漂流瓶时失足掉入水中',
        '触碰到暗流，被卷入深处',
        '被水下的未知生物拖走'
      ],
      pick: [
        '捡漂流瓶时被海鸥撞进海里淹死了',
        '拉网时落水，挣扎不及',
        '被散落的渔网缠住'
      ],
      into: [
        '下水查看时被海浪卷走了',
        '意外触碰暗礁受伤失血过多',
        '被突如其来的潮汐吞没'
      ]
    },
    msg: {
      bottle_nil: '海面平静，什么也没有……',
      content_nil: '你把空瓶塞给了海风，什么也没写。',
      photo_num: '瓶子里不能塞图片哦。',
      maxlen: '内容太长啦，装不进瓶子。',
      thrown_live: '你向海里抛出一个瓶子，它随着潮汐渐行渐远。',
      thrown_dead: '亡魂也能扔下执念（你仍在逝去的彼端）……瓶子沉沉落海。',
      throwing_dead: '你脚下一滑跌入海中，挣扎间化作一具冰冷的尸体……',
      pick_dead: '你在海边打捞，不慎遭遇意外，没能上岸……',
      pick_found_bottle_live: '你捡到一个瓶子：\n来自 {nick}\n----------\n{content}\nTime: {time}',
      pick_found_bottle_dead: '{nick}的灵魂从海里飘起千里迢迢来到岸边，扯了扯海边播下的网，取下了一个瓶子：\n来自 {ownerNick}[{ownerQQ}]\n----------\n{content}\nTime: {time}',
      pick_found_corpse_live: '你打捞上来的是一具尸体……\n{ownerNick} 于 {time} 不幸溺亡\n死因：{cause}',
      pick_found_corpse_dead: '{nick}的灵魂从海里飘起千里迢迢来到岸边，但是这次网里却是一具尸体...\n{ownerNick}[{ownerQQ}] 于 {time} 不幸淹死。\n死因：{cause}',
      into_dead: '你潜入海中查看，巨浪袭来，将你卷入深处……'
    }
  };

  // 深度合并（源到目标，返回新对象）
  function deepMerge(target, source) {
    if (!source) return target;
    const out = Array.isArray(target) ? target.slice() : Object.assign({}, target);
    for (const k of Object.keys(source)) {
      if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = deepMerge(out[k] === undefined ? {} : out[k], source[k]);
      } else {
        out[k] = source[k];
      }
    }
    return out;
  }

  // persist helpers
  function read(key, def) {
    const raw = ext.storageGet(key);
    if (!raw) return def;
    try { return JSON.parse(raw); } catch { return def; }
  }
  function write(key, val) { ext.storageSet(key, JSON.stringify(val)); }

  // load persisted state
  const bottles = read(KEY.BOTTLES, []);
  const userState = read(KEY.USER_STATE, {});
  const cdThrow = read(KEY.CD_THROW, {});
  const cdPick = read(KEY.CD_PICK, {});
  const cdSearch = read(KEY.CD_SEARCH, {});
  const cdIntoGroup = read(KEY.CD_INTO_GROUP, {});
  let switchGlobal = read(KEY.SWITCH_GLOBAL, 'off'); // 默认全局关闭（按你的要求）
  const switchGroup = read(KEY.SWITCH_GROUP, {});    // 每群单独管理，缺省视为 off
  // load config and deep-merge defaults
  const savedConfig = read(KEY.CONFIG, {});
  let config = deepMerge(defaultConfig, savedConfig);

  // 注册 UI 编辑（会把完整 JSON 放在扩展配置里）
  seal.ext.registerStringConfig(ext, 'config.json', JSON.stringify(config, null, 2), '漂流瓶配置(JSON)');

  // 如果用户在扩展配置改了 JSON，管理员需要点“保存/应用”后将该 JSON 写回 storage（这里尝试安全解析并写回）
  function reloadConfigFromStorage() {
    const raw = ext.storageGet(KEY.CONFIG);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      config = deepMerge(defaultConfig, parsed);
      // 如果保存的 config 有变动，就把标准化后的写回 storage，保证后续运行读取是合并后的版本
      write(KEY.CONFIG, config);
    } catch (e) {
      // ignore parse error — 保持旧配置
      console.warn('bottle-pro: 无法解析 config.json（保持现有配置）', e);
    }
  }
  // 立刻尝试一次（若管理员通过 UI 修改 config.json，你需要保存后重启扩展或手动触发 reload）
  reloadConfigFromStorage();

  // helper: 保存所有必要数据
  function ensurePersist() {
    write(KEY.BOTTLES, bottles);
    write(KEY.USER_STATE, userState);
    write(KEY.CD_THROW, cdThrow);
    write(KEY.CD_PICK, cdPick);
    write(KEY.CD_SEARCH, cdSearch);
    write(KEY.CD_INTO_GROUP, cdIntoGroup);
    write(KEY.SWITCH_GROUP, switchGroup);
    write(KEY.SWITCH_GLOBAL, switchGlobal);
    write(KEY.CONFIG, config);
  }

  // cd 检查（返回剩余秒数，大于0表示还在冷却；等于0表示已过）
  function checkCd(map, key, cdSec) {
    const now = nowSec();
    if (map[key] && map[key] > now) return map[key] - now;
    map[key] = now + cdSec;
    return 0;
  }

  const isDiceMaster = (ctx) => ctx.privilegeLevel >= 100;
  const getQQ = (ctx, msg) => (msg?.sender?.id || ctx?.player?.userId || '').toString().replace(/^QQ-User:/, '');
  const getNick = (ctx, msg) => (msg?.sender?.nickname || (ctx.player && ctx.player.name) || '未知昵称');
  const getGroupId = (ctx) => (ctx.group && ctx.group.groupId ? String(ctx.group.groupId).replace(/^QQ-Group:/, '') : '');
  const isPrivate = (ctx) => !(ctx.group && ctx.group.groupId);

  // 更严格的命令内容截取：支持前导 . 或 全角句号（。），并只取命令后的内容（不会吞掉命令）
  function stripCommandPrefix(msgText, commandBase) {
    // commandBase 例如 '扔漂流瓶'
    const re = new RegExp('^[\\.\\u3002]?\\s*' + commandBase + '\\s*', 'i');
    return msgText.replace(re, '').trim();
  }

  function checkBasic(ctx) {
    if (config.dis_priv && isPrivate(ctx)) return '（禁止在私聊中使用漂流瓶）';
    if (switchGlobal !== 'on') return '漂流瓶功能已被全局关闭。';
    const gid = getGroupId(ctx);
    if (!gid) return '只有群聊可用漂流瓶功能。';
    if ((switchGroup[gid] || 'off') !== 'on') return '本群漂流瓶功能已关闭。';
    return '';
  }

  const reply = (ctx, msg, text) => seal.replyToSender(ctx, msg, text);

  // 发送通知到指定管理群（多重尝试：不同 seal 环境 API 可能不同）
  function sendToGroupFallback(groupId, text, ctx, msg) {
    try {
      // 最常见的可能实现（请根据你运行的 Seal/环境调整）
      if (typeof seal.sendGroupMessage === 'function') {
        seal.sendGroupMessage(String(groupId), text);
        return;
      }
      if (typeof seal.sendGroupMsg === 'function') {
        // 有些环境叫 sendGroupMsg
        seal.sendGroupMsg(String(groupId), text);
        return;
      }
      // ext 可能暴露发送接口
      if (typeof ext.sendGroupMessage === 'function') {
        ext.sendGroupMessage(String(groupId), text);
        return;
      }
      // 如果以上都没有：尝试把通知回复到当前会话（如果提供了 ctx/msg）
      if (ctx && msg) {
        // 作为降级：在当前对话回复一条，告诉操作者已生成通知（避免丢失）
        seal.replyToSender(ctx, msg, `（已尝试通知管理群 ${groupId}）\n${text}`);
        return;
      }
      // 最后降级：记录控制台
      console.log(`[bottle-pro notify -> ${groupId}] ${text}`);
    } catch (e) {
      console.error('bottle-pro: 发送群通知失败', e);
      try {
        if (ctx && msg) seal.replyToSender(ctx, msg, `尝试通知管理群失败：${e.message}`);
      } catch (e2) { /* ignore */ }
    }
  }

  // 选死因（按动作类型）
  function pickCause(action) {
    const arr = (config.corpse_causes && config.corpse_causes[action]) || [];
    if (!arr.length) return '不明的意外';
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- 命令实现 ----------

  // 扔漂流瓶
  const cmdThrow = seal.ext.newCmdItemInfo();
  cmdThrow.name = '扔漂流瓶';
  cmdThrow.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }

    const qq = getQQ(ctx, msg);
    const nick = getNick(ctx, msg);
    const text = stripCommandPrefix(msg.message, '扔漂流瓶');
    const left = checkCd(cdThrow, qq, config.throw_cd);
    if (left > 0) { reply(ctx, msg, `冷却中，请 ${left}s 后再试。`); return seal.ext.newCmdExecuteResult(true); }
    if (!text) { reply(ctx, msg, config.msg.content_nil); return seal.ext.newCmdExecuteResult(true); }

    // 如果用户已经是 dead，则不再重复变尸体（只创建普通瓶）
    const alreadyDead = (userState[qq] === 'dead');

    if (!alreadyDead && rand100() <= (config.prob && config.prob.throw ? config.prob.throw : 10)) {
      // 变尸体
      userState[qq] = 'dead';
      const cause = pickCause('throw');
      const corpse = { id: `corpse_${Date.now()}`, type: 'corpse', group: getGroupId(ctx), qq, nick, message: '', time: new Date().toLocaleString(), cause };
      bottles.push(corpse);
      ensurePersist();
      reply(ctx, msg, config.msg.throwing_dead);
    } else {
      // 正常扔瓶（若已 dead，则使用 thrown_dead 的特殊文案）
      userState[qq] = userState[qq] || 'live';
      const bottle = { id: `bottle_${Date.now()}`, type: 'bottle', group: getGroupId(ctx), qq, nick, message: text, time: new Date().toLocaleString() };
      bottles.push(bottle);
      ensurePersist();
      if (alreadyDead) reply(ctx, msg, config.msg.thrown_dead);
      else reply(ctx, msg, config.msg.thrown_live);
    }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdThrow.name] = cmdThrow;

  // 捡漂流瓶（默认不删除普通瓶；捞到尸体则删除尸体并复活对应用户）
  const cmdPick = seal.ext.newCmdItemInfo();
  cmdPick.name = '捡漂流瓶';
  cmdPick.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }

    const qq = getQQ(ctx, msg);
    const nick = getNick(ctx, msg);
    const left = checkCd(cdPick, qq, config.pick_cd);
    if (left > 0) { reply(ctx, msg, `冷却中，请 ${left}s 后再试。`); return seal.ext.newCmdExecuteResult(true); }

    if (!bottles.length) {
      reply(ctx, msg, config.msg.bottle_nil);
      return seal.ext.newCmdExecuteResult(true);
    }

    // 首先检查：是否会在捡瓶时发生意外变尸体（只有当拾取者目前为 live 才会）
    const pickerAlive = (userState[qq] || 'live') === 'live';
    if (pickerAlive && rand100() <= (config.prob && config.prob.pick ? config.prob.pick : 10)) {
      // 捡瓶时变尸体
      userState[qq] = 'dead';
      const cause = pickCause('pick');
      const corpse = { id: `corpse_${Date.now()}`, type: 'corpse', group: getGroupId(ctx), qq, nick, message: '', time: new Date().toLocaleString(), cause };
      bottles.push(corpse);
      ensurePersist();
      reply(ctx, msg, config.msg.pick_dead);
      return seal.ext.newCmdExecuteResult(true);
    }

    // 正常捡取（随机抽取一个）
    const i = Math.floor(Math.random() * bottles.length);
    const item = bottles[i];
    if (item.type === 'bottle') {
      // 不删除普通瓶（保持原逻辑），但在配置中支持两种文案——live / dead
      const out = (userState[qq] === 'dead')
        ? config.msg.pick_found_bottle_dead
        : config.msg.pick_found_bottle_live;
      const textOut = out
        .replace('{nick}', nick)
        .replace('{ownerNick}', item.nick || '未知')
        .replace('{ownerQQ}', item.qq || '')
        .replace('{content}', item.message || '')
        .replace('{time}', item.time || '');
      // 设置 cd
      cdPick[qq] = nowSec() + config.pick_cd;
      ensurePersist();
      reply(ctx, msg, textOut);
    } else {
      // 打捞到尸体：删除尸体并将其所有者复活
      bottles.splice(i, 1);
      userState[item.qq] = 'live';
      ensurePersist();
      const out = (userState[qq] === 'dead')
        ? config.msg.pick_found_corpse_dead
        : config.msg.pick_found_corpse_live;
      const textOut = out
        .replace('{nick}', nick)
        .replace('{ownerNick}', item.nick || '未知')
        .replace('{ownerQQ}', item.qq || '')
        .replace('{cause}', item.cause || '')
        .replace('{time}', item.time || '');
      // 设置 cd
      cdPick[qq] = nowSec() + config.pick_cd;
      ensurePersist();
      reply(ctx, msg, textOut);
    }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdPick.name] = cmdPick;

  // 下水查看（群级 CD，且有变尸体概率）
  const cmdInto = seal.ext.newCmdItemInfo();
  cmdInto.name = '下水查看';
  cmdInto.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }

    const gid = getGroupId(ctx);
    const qq = getQQ(ctx, msg);
    const nick = getNick(ctx, msg);
    const left = checkCd(cdIntoGroup, gid, config.into_cd);
    if (left > 0) { reply(ctx, msg, `本群刚下过水，请 ${left}s 后再试。`); return seal.ext.newCmdExecuteResult(true); }

    // 下水时也有概率被卷走（变尸体），但若发起者已为 dead 则不再重复变尸体
    const alreadyDead = (userState[qq] === 'dead');
    if (!alreadyDead && rand100() <= (config.prob && config.prob.into ? config.prob.into : 10)) {
      userState[qq] = 'dead';
      const cause = pickCause('into');
      const corpse = { id: `corpse_${Date.now()}`, type: 'corpse', group: gid, qq, nick, message: '', time: new Date().toLocaleString(), cause };
      bottles.push(corpse);
      ensurePersist();
      reply(ctx, msg, config.msg.into_dead);
    } else {
      // 只统计数据并展示统计信息
      const userRemain = bottles.filter(b => String(b.qq) === String(qq)).length;
      const groupRemain = bottles.filter(b => String(b.group) === String(gid)).length;
      const total = bottles.length;
      // 设置群级 CD
      cdIntoGroup[gid] = nowSec() + config.into_cd;
      ensurePersist();
      const out = (userState[qq] === 'dead')
        ? `死去的${nick}发现水有：\n个人瓶子数: ${userRemain}\n本群瓶子数: ${groupRemain}\n总瓶子数: ${total}`
        : `${nick}潜入水中，看见水下：\n个人瓶子数: ${userRemain}\n本群瓶子数: ${groupRemain}\n总瓶子数: ${total}`;
      reply(ctx, msg, out);
    }
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdInto.name] = cmdInto;

  // 查询漂流瓶
  const cmdSearch = seal.ext.newCmdItemInfo();
  cmdSearch.name = '查询漂流瓶';
  cmdSearch.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }

    const text = stripCommandPrefix(msg.message, '查询漂流瓶');
    if (!text) { reply(ctx, msg, '请输入 QQ 或 #ID。'); return seal.ext.newCmdExecuteResult(true); }

    if (text.startsWith('#')) {
      const idx = Number(text.replace('#', '').trim());
      if (!(idx >= 1 && idx <= bottles.length)) { reply(ctx, msg, '没有这个编号的瓶子。'); return seal.ext.newCmdExecuteResult(true); }
      const item = bottles[idx - 1];
      if (item.type === 'bottle') {
        reply(ctx, msg, `第${idx}个瓶子：\n来自 ${item.nick}\n----------\n${item.message}\nTime: ${item.time}`);
      } else {
        reply(ctx, msg, `第${idx}个尸体：\n${item.nick} 于 ${item.time} 不幸溺亡\n死因：${item.cause}`);
      }
      return seal.ext.newCmdExecuteResult(true);
    }

    const qq = text.match(/\d+/)?.[0];
    if (!qq) { reply(ctx, msg, '请输入QQ号数字。'); return seal.ext.newCmdExecuteResult(true); }
    const arr = bottles.filter(b => String(b.qq) === String(qq));
    if (!arr.length) { reply(ctx, msg, '没有找到记录。'); return seal.ext.newCmdExecuteResult(true); }
    let lines = arr.map((b, i) =>
      b.type === 'bottle'
        ? `ID:${i + 1} 来自 ${b.nick}\nTime:${b.time}\n内容:${b.message}`
        : `ID:${i + 1} 尸体:${b.nick}\nTime:${b.time}\n死因:${b.cause}`
    );
    reply(ctx, msg, lines.join('\n\n'));
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdSearch.name] = cmdSearch;

  // 下水回收（可按 #ID 或 QQ）
  const cmdDelete = seal.ext.newCmdItemInfo();
  cmdDelete.name = '下水回收';
  cmdDelete.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }

    const caller = getQQ(ctx, msg);
    const text = stripCommandPrefix(msg.message, '下水回收');
    if (!text) { reply(ctx, msg, '请输入 QQ 或 #ID。'); return seal.ext.newCmdExecuteResult(true); }

    if (text.startsWith('#')) {
      const idx = Number(text.replace('#', '').trim());
      if (!(idx >= 1 && idx <= bottles.length)) { reply(ctx, msg, '没有这个编号。'); return seal.ext.newCmdExecuteResult(true); }
      const rec = bottles[idx - 1];
      if (!isDiceMaster(ctx) && String(rec.qq) !== String(caller)) {
        reply(ctx, msg, '只有骰主或本人可以删除这条记录。'); return seal.ext.newCmdExecuteResult(true);
      }
      bottles.splice(idx - 1, 1);
      ensurePersist();
      reply(ctx, msg, `已删除第${idx}条记录。`);
      return seal.ext.newCmdExecuteResult(true);
    }

    const qq = text.match(/\d+/)?.[0];
    if (!qq) { reply(ctx, msg, '请输入QQ号数字。'); return seal.ext.newCmdExecuteResult(true); }
    if (!isDiceMaster(ctx) && String(qq) !== String(caller)) {
      reply(ctx, msg, '只有骰主或本人可以删除这些记录。'); return seal.ext.newCmdExecuteResult(true);
    }
    const before = bottles.length;
    for (let i = bottles.length - 1; i >= 0; i--) {
      if (String(bottles[i].qq) === String(qq)) bottles.splice(i, 1);
    }
    ensurePersist();
    reply(ctx, msg, `已删除 ${before - bottles.length} 条记录。`);
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdDelete.name] = cmdDelete;

  // 清空漂流瓶（可带 QQ）
  const cmdClear = seal.ext.newCmdItemInfo();
  cmdClear.name = '清空漂流瓶';
  cmdClear.solve = (ctx, msg) => {
    const deny = checkBasic(ctx);
    if (deny) { reply(ctx, msg, deny); return seal.ext.newCmdExecuteResult(true); }
    if (!isDiceMaster(ctx)) { reply(ctx, msg, '只有骰主可以操作。'); return seal.ext.newCmdExecuteResult(true); }

    const text = stripCommandPrefix(msg.message, '清空漂流瓶');
    if (!text) {
      bottles.splice(0, bottles.length);
      ensurePersist();
      reply(ctx, msg, '已清空所有记录。');
      return seal.ext.newCmdExecuteResult(true);
    }

    const qq = text.match(/\d+/)?.[0];
    if (!qq) { reply(ctx, msg, '请输入QQ号数字。'); return seal.ext.newCmdExecuteResult(true); }
    for (let i = bottles.length - 1; i >= 0; i--) {
      if (String(bottles[i].qq) === String(qq)) bottles.splice(i, 1);
    }
    ensurePersist();
    reply(ctx, msg, `已清空 ${qq} 的所有记录。`);
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdClear.name] = cmdClear;

  // 群开关（群内开启/关闭）
  const cmdOn = seal.ext.newCmdItemInfo();
  cmdOn.name = '开启漂流瓶';
  cmdOn.solve = (ctx, msg) => {
    if (!isDiceMaster(ctx)) { reply(ctx, msg, '只有骰主可以操作。'); return seal.ext.newCmdExecuteResult(true); }
    const gid = getGroupId(ctx);
    switchGroup[gid] = 'on';
    ensurePersist();
    reply(ctx, msg, '已开启本群漂流瓶。');
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdOn.name] = cmdOn;

  const cmdOff = seal.ext.newCmdItemInfo();
  cmdOff.name = '关闭漂流瓶';
  cmdOff.solve = (ctx, msg) => {
    if (!isDiceMaster(ctx)) { reply(ctx, msg, '只有骰主可以操作。'); return seal.ext.newCmdExecuteResult(true); }
    const gid = getGroupId(ctx);
    switchGroup[gid] = 'off';
    ensurePersist();
    reply(ctx, msg, '已关闭本群漂流瓶。');
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdOff.name] = cmdOff;

  // 全局开关（只有骰主可操作）
  const cmdAllOn = seal.ext.newCmdItemInfo();
  cmdAllOn.name = '漂流瓶全局开启';
  cmdAllOn.solve = (ctx, msg) => {
    if (!isDiceMaster(ctx)) { reply(ctx, msg, '只有骰主可以操作。'); return seal.ext.newCmdExecuteResult(true); }
    switchGlobal = 'on';
    ensurePersist();
    reply(ctx, msg, '已全局开启漂流瓶（注意：每个群仍需单独开启）。');
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdAllOn.name] = cmdAllOn;

  const cmdAllOff = seal.ext.newCmdItemInfo();
  cmdAllOff.name = '漂流瓶全局关闭';
  cmdAllOff.solve = (ctx, msg) => {
    if (!isDiceMaster(ctx)) { reply(ctx, msg, '只有骰主可以操作。'); return seal.ext.newCmdExecuteResult(true); }
    switchGlobal = 'off';
    ensurePersist();
    reply(ctx, msg, '已全局关闭漂流瓶。');
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdAllOff.name] = cmdAllOff;

  // 帮助
  const cmdHelp = seal.ext.newCmdItemInfo();
  cmdHelp.name = '漂流瓶帮助';
  cmdHelp.solve = (ctx, msg) => {
    reply(ctx, msg, `漂流瓶指令列表：
.扔漂流瓶 内容   或 扔漂流瓶 内容
.捡漂流瓶
.下水查看
.查询漂流瓶 #编号 或 QQ号
.下水回收 #编号 或 QQ号
.清空漂流瓶 [QQ号]
.开启漂流瓶 / 关闭漂流瓶
.漂流瓶全局开启 / 漂流瓶全局关闭

配置编辑：在扩展配置中编辑 config.json（可修改回复词 & 概率）`);
    return seal.ext.newCmdExecuteResult(true);
  };
  ext.cmdMap[cmdHelp.name] = cmdHelp;

  // 初始持久化（确保 storage 中存在 config 等）
  ensurePersist();

  // 结束
})();
