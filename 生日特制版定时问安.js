// ==UserScript==
// @name         生日特别版定时问安系统
// @author       多布Dogbird
// @version      1.1.2
// @description  定时发送问候消息，包含生日特别祝福（不要注册太多任务，会炸）
// @timestamp    1710000000
// 2024-03-10
// @license      MIT
// @homepageURL  https://github.com/your-repo
// @sealVersion  1.4.6
// ==/UserScript==

//可在下方修改骰娘生日，问候语，定时任务

console.log('开始加载问候插件 v1.1.2');

const ext = seal.ext.new('birthday-greeting', '多布Dogbird', '1.1.2');

// 存储键名
const STORAGE_KEY = 'greetingStatus';

// 骰娘生日 (6月20日)
const ZHL_BIRTHDAY_MONTH = 6;
const ZHL_BIRTHDAY_DATE = 20;
const ZHL_BIRTH_YEAR = 2025; // 骰娘诞生年份

// 安全的存储操作
function safeStorageGet(key, defaultValue = '{}') {
    try {
        const data = ext.storageGet(key);
        if (!data) {
            return JSON.parse(defaultValue);
        }
        const parsed = JSON.parse(data);
        return parsed && typeof parsed === 'object' ? parsed : JSON.parse(defaultValue);
    } catch (e) {
        console.error('存储读取失败，使用默认值:', e);
        return JSON.parse(defaultValue);
    }
}

function safeStorageSet(key, value) {
    try {
        const jsonString = JSON.stringify(value);
        ext.storageSet(key, jsonString);
        return true;
    } catch (e) {
        console.error('存储写入失败:', e);
        return false;
    }
}

// 初始化存储
ext.onLoad = function() {
    const currentData = safeStorageGet(STORAGE_KEY, '{}');
    if (Object.keys(currentData).length === 0) {
        safeStorageSet(STORAGE_KEY, {});
        console.log('初始化存储完成');
    }
    console.log('存储初始化检查完成');
    
    // 注册定时任务
    registerTimedTasks();
};

// 插件卸载清理
ext.onUnload = function() {
    console.log('插件卸载，清理资源');
};

// 获取中文星期几
function getChineseWeekday() {
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const day = new Date().getDay();
    return `星期${weekdays[day]}`;
}

// 获取某月第n个星期x的日期
function getNthWeekdayOfMonth(year, month, weekday, n) {
    // weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
    const firstDay = new Date(year, month - 1, 1);
    const firstWeekday = firstDay.getDay();
    
    // 计算第一个目标星期几的日期
    let daysToAdd = (weekday - firstWeekday + 7) % 7;
    if (daysToAdd === 0 && n > 1) {
        daysToAdd = 7; // 如果第一天就是目标星期几，但我们要第n个(n>1)
    }
    
    const targetDate = 1 + daysToAdd + (n - 1) * 7;
    
    // 检查日期是否在当月范围内
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    return targetDate <= lastDayOfMonth ? targetDate : null;
}

// 获取节日问候
function getHolidayGreeting() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const year = now.getFullYear();
    
    // 生日特别祝福 (6月20日)
    if (month === ZHL_BIRTHDAY_MONTH && date === ZHL_BIRTHDAY_DATE) {
        const age = year - ZHL_BIRTH_YEAR;
        return `🎂 祝我生日快乐！祝我${age}岁生日快乐！感谢大家一直以来的陪伴与支持~`;
    }
    
    // 固定日期节日（只保留公历节日）
    const fixedHolidays = {
        '0101': '元旦快乐！新年新气象，愿您万事如意！',
        '0214': '情人节快乐！无论是与爱人一起过还是您自己，愿今日都是爱与温暖的一日！',
        '0308': '女神节快乐！愿大家永远美丽！',
        '0501': '劳动节快乐！用假期犒劳自己的劳动吧！',
        '0601': '儿童节快乐！永远都不要丢掉童心，买杯奶茶一起过儿童节吧！',
        '1001': '国庆节快乐！祝福祖国繁荣昌盛，国泰民安！',
        '1225': '圣诞节快乐！叮叮当，叮叮当，铃儿响叮当！'
    };
    
    // 特殊节日（基于星期计算）
    const specialHolidays = [
        {
            month: 5,
            weekday: 0, // 星期日
            nth: 2,     // 第二个
            greeting: '母亲节快乐！感谢天下母亲的伟大付出，愿您健康幸福！'
        },
        {
            month: 6,
            weekday: 0, // 星期日
            nth: 3,     // 第三个
            greeting: '父亲节快乐！父爱如山，感谢您的默默守护！'
        }
    ];
    
    // 检查固定日期节日
    const dateKey = `${month.toString().padStart(2, '0')}${date.toString().padStart(2, '0')}`;
    if (fixedHolidays[dateKey]) {
        return fixedHolidays[dateKey];
    }
    
    // 检查特殊节日
    for (const holiday of specialHolidays) {
        if (month === holiday.month) {
            const targetDate = getNthWeekdayOfMonth(year, month, holiday.weekday, holiday.nth);
            if (targetDate && date === targetDate) {
                return holiday.greeting;
            }
        }
    }
    
    return null;
}

// 获取星期特色问候
function getWeekdaySpecial() {
    const weekday = new Date().getDay();
    const specials = [
        "周日到了，享受最后一天的休息吧！",
        "周一到了，加油吧！",
        "周二到了，继续努力！",
        "周三到了，胜利在望！",
        "周四到了，已经重新充满动力了！",
        "周五到了，坚持就是胜利！",
        "周六到了，周末来啦！"
    ];
    return specials[weekday] || "新的一天，加油！";
}

// 生成问候语
function generateGreeting(time) {
    const weekday = getChineseWeekday();
    const weekSpecial = getWeekdaySpecial();
    const holidayGreeting = getHolidayGreeting();
    
    // 基础问候语库
    const baseGreetings = {
        '6:00': [
            `6点了\n----------------\n黑暗之中，星空尚未恢复其冷酷的面貌，但那些古老的存在早已在阴影中悄然醒来。`,
            `6点了\n----------------\n沉睡的恐惧从黑暗的深处缓缓爬升，仿佛那无尽的深渊始终在等待。`,
            `6点了\n----------------\n清晨的阳光未能驱散夜的阴霾，远处的星空依旧冷寂，深不可测。`,
            `6点了\n----------------\n即便阳光洒满大地，那个在深海沉睡的恶梦依旧不曾远去。`,
            `6点了\n----------------\n晨曦微弱，但远方的星光依旧提醒着我们，宇宙的恐怖从未远离。`,
            `6点了\n----------------\n人类！在星辰的照耀下你们不过是微不足道的存在，无法逃避的命运已然定下。——《克苏鲁的呼唤》`,
            `6点了\n----------------\n清晨的第一缕阳光下，隐藏着无法言喻的恐惧，它早已在无声的深处悄然蔓延。`,
            `6点了\n----------------\n每一个新的一天，都是离真相更近一步的步伐，尽管你尚未察觉。`,
            `6点了\n----------------\n那遥远的星辰，早已照亮了你通向深渊的道路，只是你看不见。`,
            `6点了\n----------------\n白昼来临，夜的幽暗依旧潜伏在空气中，它不会放过任何一个迷失者。`
    ],
    '9:00': [
            `9点了\n----------------\n晨光中的阴影并未消失，只是换了一个角度注视着你。`,
            `9点了\n----------------\n星辰的冷光在白昼中隐匿，但它们的注视从未消散。——《克苏鲁的呼唤》`,
            `9点了\n----------------\n那些古老的低语在空气中回荡，即使阳光普照，它们依旧清晰可闻。`,
            `9点了\n----------------\n人类的日程井然有序，而深渊的时钟却从未为你停摆。`,
            `9点了\n----------------\n清晨的劳作，只是通往未知的必经之路。`,
            `9点了\n----------------\n你所见到的光明，并非真正的庇护。——《克苏鲁的呼唤》`,
            `9点了\n----------------\n空气中弥漫着一种说不清的气息，仿佛某种存在正悄然苏醒。`,
            `9点了\n----------------\n在你未察觉的角落，深渊的目光已经落在了你身上。`,
            `9点了\n----------------\n白昼不过是掩盖黑暗的面纱，随时可能被撕开。`,
            `9点了\n----------------\n你脚下的道路，看似平稳，却直通向不可名状的终点。`
    ],
    '12:00': [
            `12点了\n----------------\n正午的阳光最盛之时，阴影也在它脚下生长。`,
            `12点了\n----------------\n在太阳之下，也有不可见的恐怖潜伏着。——《克苏鲁的呼唤》`,
            `12点了\n----------------\n热浪中夹带着深海的湿气，那是旧日支配者呼吸的痕迹。`,
            `12点了\n----------------\n喧嚣的人群并未察觉，他们早已走在古神编织的轨迹上。`,
            `12点了\n----------------\n看似平凡的一刻，可能正被记录在永恒的黑暗史册中。`,
            `12点了\n----------------\n天空湛蓝，而在那之上，是你无法直视的虚空。`,
            `12点了\n----------------\n午阳下的阴影，正向你身后悄然延伸。`,
            `12点了\n----------------\n无论昼夜，虚空的注视从未转移。——《克苏鲁的呼唤》`,
            `12点了\n----------------\n这光芒只是虚假的庇护，足够让你放下戒心。`,
            `12点了\n----------------\n你以为自己安然无恙，但脚下的土地早已被深渊蚕食。`
    ],
    '15:00': [
            `15点了\n----------------\n下午的阳光开始倾斜，影子变得修长，像是要触碰到未知的深处。`,
            `15点了\n----------------\n影子拉长的方向，正是深渊凝视的所在。——《克苏鲁的呼唤》`,
            `15点了\n----------------\n风吹过时，带来了来自海底的寒意。`,
            `15点了\n----------------\n时间正在你背后无声流逝，古老的钟声即将敲响。`,
            `15点了\n----------------\n午后的宁静不过是暴风雨前的沉默。`,
            `15点了\n----------------\n你正行走在旧日的梦境中，只是你尚未醒来。——《克苏鲁的呼唤》`,
            `15点了\n----------------\n阳光渐弱，深处的黑暗开始滋生新的低语。`,
            `15点了\n----------------\n你或许能感到空气中的压力，那是古神的目光所致。`,
            `15点了\n----------------\n再过不久，影子将彻底吞没光明。`,
            `15点了\n----------------\n命运的齿轮在这时转动，发出微不可闻的摩擦声。`
    ],
    '18:00': [
            `18点了\n----------------\n夕阳的血色洒在大地，像极了古老祭坛上的献祭。`,
            `18点了\n----------------\n在白昼死去之时，夜的使者便会降临。——《克苏鲁的呼唤》`,
            `18点了\n----------------\n天空的颜色开始变暗，群星的呼吸声渐渐可闻。`,
            `18点了\n----------------\n黄昏的风中夹杂着盐与血的味道。`,
            `18点了\n----------------\n你脚下的影子与夜色相连，仿佛有手从另一侧伸来。`,
            `18点了\n----------------\n夕阳是白昼最后的悲鸣。——《克苏鲁的呼唤》`,
            `18点了\n----------------\n天空像被谁按下了开关，迅速失去色彩。`,
            `18点了\n----------------\n古老的低语变得清晰，它们催促着你加快脚步。`,
            `18点了\n----------------\n黑暗已在地平线上等待多时。`,
            `18点了\n----------------\n昼夜交替之际，最适合召唤的仪式已经开始。`
    ],
    '21:00': [
            `21点了\n----------------\n夜色完全降临，星光是深渊的信号灯。`,
            `21点了\n----------------\n在夜的怀抱中，群星的位置就是古老文字的排列。——《克苏鲁的呼唤》`,
            `21点了\n----------------\n黑暗中的每一颗星，都是一只注视你的眼睛。`,
            `21点了\n----------------\n海风传来低沉的吟唱，像是某种仪式的开端。`,
            `21点了\n----------------\n夜晚的空气比白昼更沉重，仿佛压在你的心口。`,
            `21点了\n----------------\n你以为夜只是白昼的尽头，却不知它才是真正的开始。——《克苏鲁的呼唤》`,
            `21点了\n----------------\n群星闪烁间，仿佛在传递某种无法理解的信息。`,
            `21点了\n----------------\n黑暗是旧日支配者的幕布，它们正缓缓拉开。`,
            `21点了\n----------------\n远方的雷声像是巨物翻身时的低吼。`,
            `21点了\n----------------\n在这个时刻，梦境与现实的界限变得模糊。`
    ],
    '24:00': [
            `24点了\n----------------\n午夜的钟声敲响，世界的帷幕被彻底揭开。`,
            `24点了\n----------------\n在这个时刻，所有屏障都最为脆弱。——《克苏鲁的呼唤》`,
            `24点了\n----------------\n黑暗完全吞没了世界，只有星光仍在闪烁。`,
            `24点了\n----------------\n深渊的低语此刻最为清晰。`,
            `24点了\n----------------\n当你在午夜醒来，不要向窗外张望。——《克苏鲁的呼唤》`,
            `24点了\n----------------\n空气仿佛凝固，每一次呼吸都能听见自己的心跳。`,
            `24点了\n----------------\n这一刻，连影子都不愿陪伴你。`,
            `24点了\n----------------\n梦境的大门敞开，等待着你的到来。`,
            `24点了\n----------------\n旧日支配者的名字在夜色中被悄声呼唤。`,
            `24点了\n----------------\n你已置身于它们的国度，只是你尚未察觉。`
        ]
    };



    
    // 安全获取问候语
    const greetingList = baseGreetings[time];
    if (!greetingList || greetingList.length === 0) {
        return { 
            message: `${weekSpecial}`, 
            holiday: holidayGreeting 
        };
    }
    
    const randomIndex = Math.floor(Math.random() * greetingList.length);
    const base = greetingList[randomIndex];
    
    return { message: base, holiday: holidayGreeting };
}

// 获取群组状态
function getGroupStatus(groupId) {
    if (!groupId) return false;
    
    try {
        const data = safeStorageGet(STORAGE_KEY, '{}');
        return !!data[groupId];
    } catch (e) {
        console.error('读取群组状态失败:', e);
        return false;
    }
}

// 设置群组状态
function setGroupStatus(groupId, status) {
    if (!groupId) return false;
    
    try {
        const data = safeStorageGet(STORAGE_KEY, '{}');
        data[groupId] = !!status;
        const success = safeStorageSet(STORAGE_KEY, data);
        if (success) {
            console.log(`群组 ${groupId} 状态设置为 ${status}`);
        }
        return success;
    } catch (e) {
        console.error('设置群组状态失败:', e);
        return false;
    }
}

// 开启问候功能指令
const cmdEnable = seal.ext.newCmdItemInfo();
cmdEnable.name = '定时问安开启';
cmdEnable.help = '开启定时问候功能';
cmdEnable.solve = (ctx, msg, cmdArgs) => {
    console.log('>>> 收到开启指令 <<<');
    
    // 检查是否完全匹配指令
    if (cmdArgs.rawArgs.trim() !== '') {
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查是否在群组中使用
    if (!msg.groupId) {
        seal.replyToSender(ctx, msg, '请在群内使用此指令');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查权限（群主/管理员/邀请者）
    if (ctx.privilegeLevel < 40) {
        seal.replyToSender(ctx, msg, '权限不足，需要邀请者或更高权限');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查当前状态
    const currentStatus = getGroupStatus(msg.groupId);
    if (currentStatus) {
        seal.replyToSender(ctx, msg, '定时问安已是开启状态');
        return seal.ext.newCmdExecuteResult(true);
    }
    
    // 设置群组状态
    const success = setGroupStatus(msg.groupId, true);
    if (success) {
        seal.replyToSender(ctx, msg, '已开启定时问候功能！将在每日 6:00、9:00、12:00、15:00、18:00、21:00、0:00 为大家送上问候~');
    } else {
        seal.replyToSender(ctx, msg, '开启失败，请稍后重试');
    }
    
    return seal.ext.newCmdExecuteResult(true);
};

// 关闭问候功能指令
const cmdDisable = seal.ext.newCmdItemInfo();
cmdDisable.name = '定时问安关闭';
cmdDisable.help = '关闭定时问候功能';
cmdDisable.solve = (ctx, msg, cmdArgs) => {
    console.log('>>> 收到关闭指令 <<<');
    
    // 检查是否完全匹配指令
    if (cmdArgs.rawArgs.trim() !== '') {
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查是否在群组中使用
    if (!msg.groupId) {
        seal.replyToSender(ctx, msg, '请在群内使用此指令');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查权限（群主/管理员/邀请者）
    if (ctx.privilegeLevel < 40) {
        seal.replyToSender(ctx, msg, '权限不足，需要邀请者或更高权限');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查当前状态
    const currentStatus = getGroupStatus(msg.groupId);
    if (!currentStatus) {
        seal.replyToSender(ctx, msg, '定时问安已是关闭状态');
        return seal.ext.newCmdExecuteResult(true);
    }
    
    // 设置群组状态
    const success = setGroupStatus(msg.groupId, false);
    if (success) {
        seal.replyToSender(ctx, msg, '已关闭定时问候功能！');
    } else {
        seal.replyToSender(ctx, msg, '关闭失败，请稍后重试');
    }
    
    return seal.ext.newCmdExecuteResult(true);
};

// 测试指令
const cmdTest = seal.ext.newCmdItemInfo();
cmdTest.name = '问候测试';
cmdTest.help = '测试问候功能';
cmdTest.solve = (ctx, msg, cmdArgs) => {
    console.log('>>> 收到测试指令 <<<');
    
    // 检查是否完全匹配指令
    if (cmdArgs.rawArgs.trim() !== '') {
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查是否在群组中使用
    if (!msg.groupId) {
        seal.replyToSender(ctx, msg, '请在群内使用此指令');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查当前群组状态
    const status = getGroupStatus(msg.groupId);
    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // 生成测试问候语
    const { message, holiday } = generateGreeting('12:00');
    let testMessage = `**测试成功！插件工作正常**\n\n`;
    testMessage += `**当前状态信息：**\n`;
    testMessage += `• 群组状态: ${status ? '已开启' : '已关闭'}\n`;
    testMessage += `• 当前时间: ${timeStr}\n`;
    testMessage += `• 插件版本: v1.1.2\n`;
    
    // 检查存储数据
    const allData = safeStorageGet(STORAGE_KEY, '{}');
    const activeGroups = Object.keys(allData).filter(groupId => allData[groupId]);
    testMessage += `• 活跃群组数: ${activeGroups.length}\n`;
    
    // 检查接入点
    const endpoints = seal.getEndPoints();
    testMessage += `• 可用接入点: ${endpoints ? endpoints.length : 0}\n\n`;
    
    testMessage += `💬 **示例问候语：**\n${message}`;
    
    if (holiday) {
        testMessage += `\n\n🎉 **今日节日问候：**\n${holiday}`;
    }
    
    // 如果群组已开启，提供立即测试选项
    if (status) {
        testMessage += `\n\n💡 **提示：** 您也可以使用「立即问候」指令进行实时测试`;
    }
    
    seal.replyToSender(ctx, msg, testMessage);
    return seal.ext.newCmdExecuteResult(true);
};

// 立即问候测试指令
const cmdInstantGreet = seal.ext.newCmdItemInfo();
cmdInstantGreet.name = '立即问候';
cmdInstantGreet.help = '立即发送一次问候（测试用）';
cmdInstantGreet.solve = (ctx, msg, cmdArgs) => {
    console.log('>>> 收到立即问候指令 <<<');
    
    // 检查是否完全匹配指令
    if (cmdArgs.rawArgs.trim() !== '') {
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查是否在群组中使用
    if (!msg.groupId) {
        seal.replyToSender(ctx, msg, '请在群内使用此指令');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    // 检查群组是否开启问候
    const status = getGroupStatus(msg.groupId);
    if (!status) {
        seal.replyToSender(ctx, msg, '当前群组未开启定时问候功能，请先使用「定时问安开启」');
        return seal.ext.newCmdExecuteResult(false);
    }
    
    try {
        // 获取当前时间对应的问候语
        const now = new Date();
        const hour = now.getHours();
        let timeKey = '12:00'; // 默认值
        
        if (hour >= 0 && hour < 6) timeKey = '0:00';
        else if (hour >= 6 && hour < 9) timeKey = '6:00';
        else if (hour >= 9 && hour < 12) timeKey = '9:00';
        else if (hour >= 12 && hour < 15) timeKey = '12:00';
        else if (hour >= 15 && hour < 18) timeKey = '15:00';
        else if (hour >= 18 && hour < 21) timeKey = '18:00';
        else timeKey = '21:00';
        
        const { message, holiday } = generateGreeting(timeKey);
        
        let finalMessage = `**立即问候测试** \n\n${message}`;
        if (holiday) {
            finalMessage += `\n\n**特别问候** \n${holiday}`;
        }
        
        seal.replyGroup(ctx, msg, finalMessage);
        console.log(`立即问候测试成功，群组: ${msg.groupId}`);
        
    } catch (error) {
        console.error('立即问候测试失败:', error);
        seal.replyToSender(ctx, msg, '测试失败，请查看控制台日志');
    }
    
    return seal.ext.newCmdExecuteResult(true);
};

// 注册指令
ext.cmdMap['定时问安开启'] = cmdEnable;
ext.cmdMap['定时问安关闭'] = cmdDisable;
ext.cmdMap['问候测试'] = cmdTest;
ext.cmdMap['立即问候'] = cmdInstantGreet;

// 注册定时任务
function registerTimedTasks() {
    const greetingTimes = ['6:00', '9:00', '12:00', '15:00', '18:00', '21:00', '0:00'];
    
    console.log(`开始注册 ${greetingTimes.length} 个定时任务`);
    
    greetingTimes.forEach(time => {
        try {
            const taskName = `greeting_${time.replace(':', '')}`;
            console.log(`注册定时任务: ${time} (${taskName})`);
            
            seal.ext.registerTask(ext, 'daily', time, (taskCtx) => {
                console.log(`[${new Date().toLocaleString()}] 执行定时任务: ${time}`);
                
                // 安全获取存储数据
                const statusData = safeStorageGet(STORAGE_KEY, '{}');
                console.log(`获取到存储数据:`, statusData);
                
                const activeGroups = Object.keys(statusData).filter(groupId => statusData[groupId]);
                console.log(`活跃群组列表:`, activeGroups);
                
                if (activeGroups.length === 0) {
                    console.log(`没有群组开启问候功能，跳过执行`);
                    return;
                }
                
                console.log(`准备向 ${activeGroups.length} 个群组发送问候`);
                
                try {
                    // 生成问候语
                    const { message, holiday } = generateGreeting(time);
                    console.log(`生成的问候语: ${message}`);
                    if (holiday) {
                        console.log(`节日问候: ${holiday}`);
                    }
                    
                    // 获取接入点
                    const endpoints = seal.getEndPoints();
                    console.log(`可用接入点数量: ${endpoints ? endpoints.length : 0}`);
                    
                    if (!endpoints || endpoints.length === 0) {
                        console.error(`[${time}] 未找到可用的接入点`);
                        return;
                    }
                    
                    // 遍历所有开启问候的群组
                    activeGroups.forEach((groupId, index) => {
                        try {
                            console.log(`[${index + 1}/${activeGroups.length}] 处理群组: ${groupId}`);
                            
                            // 创建临时消息上下文
                            const tempMsg = seal.newMessage();
                            tempMsg.groupId = groupId;
                            tempMsg.messageType = 'group';
                            
                            const tempCtx = seal.createTempCtx(endpoints[0], tempMsg);
                            
                            // 最终消息 = 基础问候 + 节日问候
                            let finalMessage = message;
                            if (holiday) {
                                finalMessage += `\n\n✨ **特别问候** ✨\n${holiday}`;
                            }
                            
                            // 发送消息
                            seal.replyGroup(tempCtx, tempMsg, finalMessage);
                            console.log(`[${time}] 已向群组 ${groupId} 发送问候`);
                            
                        } catch (groupError) {
                            console.error(`[${time}] 向群组 ${groupId} 发送问候失败:`, groupError);
                            console.error('详细错误信息:', groupError.stack || groupError.message);
                        }
                    });
                } catch (error) {
                    console.error(`[${time}] 生成问候语或获取接入点时出错:`, error);
                    console.error('详细错误信息:', error.stack || error.message);
                }
            }, taskName, `${time}问候任务`);
            
            console.log(`定时任务 ${time} 注册成功`);
        } catch (taskError) {
            console.error(`注册定时任务 ${time} 失败:`, taskError);
            console.error('详细错误信息:', taskError.stack || taskError.message);
        }
    });
    
    console.log(`定时任务注册完成，共注册了 ${greetingTimes.length} 个任务`);
}

// 注册扩展
seal.ext.register(ext);

console.log('问候插件注册完成');
