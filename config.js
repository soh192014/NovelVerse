/* =====================================================
   NovelVerse — Supabase Configuration
   Version: 1.0
   ===================================================== */

// Supabase 项目设置
window.NOVELVERSE_CONFIG = {

    // Supabase 项目 URL
    SUPABASE_URL: "https://lbhplckordconkepbnlq.supabase.co",

    // Supabase Publishable Key 或旧版 anon public key
    SUPABASE_ANON_KEY: "sb_publishable_xHC5vA3oBYJEpMHEatEQwA_r1izOwNh",

    // 网站设置
    APP_NAME: "NovelVerse",

    APP_VERSION: "1.0.0",

    // 小说文件设置
    MAX_BOOK_SIZE: 20 * 1024 * 1024,

    MAX_COVER_SIZE: 5 * 1024 * 1024,

    // 支持的文件格式
    ALLOWED_BOOK_TYPES: [
        "txt",
        "pdf",
        "epub"
    ],

    // 积分设置
    POINTS: {

        NEW_USER_BONUS: 150,

        MIN_CHECKIN: 10,

        MAX_CHECKIN: 100,

        MIN_READ_PRICE: 10,

        MAX_READ_PRICE: 200,

        MIN_OFFLINE_PRICE: 200,

        MAX_OFFLINE_PRICE: 1000,

        MIN_DOWNLOAD_PRICE: 2000,

        MAX_DOWNLOAD_PRICE: 10000,

        MIN_COMPLETE_REWARD: 50,

        MAX_COMPLETE_REWARD: 200
    },

    // 默认主题
    THEME: {

        DEFAULT: "default",

        ALLOW_CUSTOM_COLOR: true,

        SAVE_LOCALLY: true

    }

};

// 配置检查
window.checkNovelVerseConfig = function () {

    const config = window.NOVELVERSE_CONFIG;

    if (!config) {
        console.error("NovelVerse: 配置文件不存在。");
        return false;
    }

    if (
        !config.SUPABASE_URL ||
        config.SUPABASE_URL === "YOUR_SUPABASE_URL"
    ) {
        console.warn("NovelVerse: 尚未填写 Supabase URL。");
        return false;
    }

    if (
        !config.SUPABASE_ANON_KEY ||
        config.SUPABASE_ANON_KEY ===
        "YOUR_SUPABASE_PUBLISHABLE_KEY"
    ) {
        console.warn("NovelVerse: 尚未填写 Supabase 公共密钥。");
        return false;
    }

    return true;

};

console.log("NovelVerse configuration loaded.");
